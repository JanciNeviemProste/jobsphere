import { logger } from './logger'
import { prisma } from './prisma'
import { unsubscribeFooterHtml } from './unsubscribe'
import { Resend as ResendClient } from 'resend'

interface EmailData {
  to: string
  subject: string
  html: string
  text?: string
  variables?: Record<string, string>
  includeUnsubscribe?: boolean
  retryAttempts?: number
  throwOnError?: boolean
  useQueue?: boolean
  metadata?: {
    orgId?: string
    accountId?: string
    entityType?: 'APPLICATION' | 'CANDIDATE' | 'JOB'
    entityId?: string
  }
}

interface EmailResult {
  success: boolean
  id?: string
  error?: string
  /** True when the send was skipped because the recipient is on the suppression list. */
  suppressed?: boolean
}

/**
 * Look up the recipient on the email suppression list (LOGIC-011).
 *
 * Returns the suppression reason if the address is suppressed, otherwise null.
 * The DB lookup is wrapped defensively: if the suppression table cannot be
 * queried (e.g. DB unavailable in a unit-test context), we treat the recipient
 * as NOT suppressed rather than blocking all outbound mail.
 */
async function getSuppressionReason(email: string): Promise<string | null> {
  try {
    const normalized = email.trim().toLowerCase()
    const entry = await prisma.emailSuppressionList.findUnique({
      where: { email: normalized },
      select: { reason: true },
    })
    return entry?.reason ?? null
  } catch (error) {
    logger.warn('Suppression list lookup failed; proceeding without suppression check', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Validate email fields against header injection attacks.
 */
function validateEmailHeaders(data: Pick<EmailData, 'to' | 'subject'>): void {
  const NEWLINE_REGEX = /[\r\n]/
  if (NEWLINE_REGEX.test(data.to)) {
    throw new Error(
      'Invalid email recipient: contains newline characters (possible header injection)',
    )
  }
  if (NEWLINE_REGEX.test(data.subject)) {
    throw new Error(
      'Invalid email subject: contains newline characters (possible header injection)',
    )
  }
}

/**
 * Escape HTML special characters to prevent XSS in HTML email content.
 * Exported for unit testing; prefer using the template helpers instead of calling directly.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * Replace {{key}} template variables in a string.
 * When isHtml is true (default), values are HTML-escaped to prevent XSS.
 */
function applyVariables(text: string, variables?: Record<string, string>, isHtml = true): string {
  if (!variables) return text
  let result = text
  for (const [key, value] of Object.entries(variables)) {
    const safeValue = isHtml ? escapeHtml(value) : value
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), safeValue)
  }
  return result
}

/**
 * Send email using configured email service
 */
export async function sendEmail(data: EmailData): Promise<EmailResult> {
  // Guard against email header injection
  validateEmailHeaders(data)

  // Suppression guard (LOGIC-011): never send to a suppressed address.
  // Skip + return a non-throwing suppressed result so callers (sequences, bulk,
  // transactional) all honor unsubscribes/bounces/complaints uniformly.
  const suppressionReason = await getSuppressionReason(data.to)
  if (suppressionReason) {
    logger.info('Email send skipped — recipient suppressed', {
      to: data.to,
      reason: suppressionReason,
    })
    return { success: true, suppressed: true }
  }

  // Apply template variables (subject is plain text — no HTML escaping; html is HTML — escape values)
  let subject = applyVariables(data.subject, data.variables, false)
  let html = applyVariables(data.html, data.variables, true)

  // Append unsubscribe link if requested (token-signed, per-recipient)
  if (data.includeUnsubscribe) {
    try {
      html += unsubscribeFooterHtml(data.to)
    } catch (error) {
      logger.warn('Failed to build unsubscribe footer; sending without it', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const processedData = { ...data, subject, html }
  const emailService = process.env.EMAIL_SERVICE || 'resend'
  const throwOnError = data.throwOnError !== false
  const retryAttempts = data.retryAttempts ?? 0

  try {
    let result: EmailResult

    if (emailService === 'resend') {
      result = await sendWithRetry(() => sendResendEmail(processedData), retryAttempts)
    } else if (emailService === 'sendgrid') {
      result = await sendWithRetry(() => sendSendGridEmail(processedData), retryAttempts)
    } else if (emailService === 'log') {
      logger.info('Email logged', {
        to: processedData.to,
        subject: processedData.subject,
      })
      result = { success: true }
    } else {
      throw new Error(`Unknown email service: ${emailService}`)
    }

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Failed to send email', { error: errorMessage, to: data.to, subject })

    if (!throwOnError) {
      return { success: false, error: errorMessage }
    }
    throw error
  }
}

async function sendWithRetry(
  fn: () => Promise<EmailResult>,
  retryAttempts: number,
): Promise<EmailResult> {
  let lastError: Error | undefined
  const maxAttempts = retryAttempts + 1

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt >= maxAttempts - 1) {
        throw lastError
      }
    }
  }

  throw lastError
}

async function sendResendEmail(data: EmailData): Promise<EmailResult> {
  const Resend = ResendClient
  const resend = new Resend(process.env.RESEND_API_KEY)

  const result = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'JobSphere <noreply@jobsphere.app>',
    to: data.to,
    subject: data.subject,
    html: data.html,
  })

  if (result.error) {
    throw new Error(`Resend API error: ${result.error.message || JSON.stringify(result.error)}`)
  }

  return { success: true, id: result.data?.id ?? (result as any).id }
}

async function sendSendGridEmail(data: EmailData): Promise<EmailResult> {
  const sgMail = (await import('@sendgrid/mail')).default
  sgMail.setApiKey(process.env.SENDGRID_API_KEY || '')

  const result = await sgMail.send({
    from: process.env.EMAIL_FROM || 'noreply@jobsphere.app',
    to: data.to,
    subject: data.subject,
    html: data.html,
  } as any)

  return { success: true }
}

/**
 * Send application received notification
 */
export async function sendApplicationNotification(params: {
  candidateName: string
  jobTitle: string
  companyName: string
  recipientEmail: string
}): Promise<EmailResult> {
  const { candidateName, jobTitle, companyName, recipientEmail } = params
  const safeCandidateName = escapeHtml(candidateName)
  const safeJobTitle = escapeHtml(jobTitle)
  const safeCompanyName = escapeHtml(companyName)

  return sendEmail({
    to: recipientEmail,
    subject: `Application Received - ${jobTitle} at ${companyName}`,
    html: `
      <div>
        <h1>Application Received</h1>
        <p>Dear ${safeCandidateName},</p>
        <p>Thank you for applying to <strong>${safeJobTitle}</strong> at <strong>${safeCompanyName}</strong>.</p>
        <p>We have received your application and will review it shortly.</p>
        <p>Best regards,<br>The ${safeCompanyName} Team</p>
      </div>
    `,
  })
}

/**
 * Send status change email notification
 */
export async function sendStatusChangeEmail(params: {
  candidateName: string
  jobTitle: string
  newStatus: string
  recipientEmail: string
}): Promise<EmailResult> {
  const { candidateName, jobTitle, newStatus, recipientEmail } = params
  const safeCandidateName = escapeHtml(candidateName)
  const safeJobTitle = escapeHtml(jobTitle)
  const safeNewStatus = escapeHtml(newStatus)

  return sendEmail({
    to: recipientEmail,
    subject: `Application Update - ${jobTitle}`,
    html: `
      <div>
        <h1>Application Update</h1>
        <p>Dear ${safeCandidateName},</p>
        <p>Your application for <strong>${safeJobTitle}</strong> has been updated.</p>
        <p>New status: <strong>${safeNewStatus}</strong></p>
        <p>Best regards,<br>The JobSphere Team</p>
      </div>
    `,
  })
}

/**
 * Email templates
 */

export function getApplicationReceivedEmail(
  candidateName: string,
  jobTitle: string,
  companyName: string,
): string {
  const safeCandidateName = escapeHtml(candidateName)
  const safeJobTitle = escapeHtml(jobTitle)
  const safeCompanyName = escapeHtml(companyName)
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Application Received</h1>
          </div>
          <div class="content">
            <p>Hi ${safeCandidateName},</p>
            <p>Thank you for applying to <strong>${safeJobTitle}</strong> at <strong>${safeCompanyName}</strong>.</p>
            <p>We have received your application and our team will review it shortly. You will hear from us within 5 business days.</p>
            <p>In the meantime, you can track your application status in your dashboard:</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" class="button">View Application</a>
            <p>Good luck!</p>
            <p>Best regards,<br>The JobSphere Team</p>
          </div>
          <div class="footer">
            <p>This is an automated email from JobSphere. Please do not reply.</p>
          </div>
        </div>
      </body>
    </html>
  `
}

export function getNewApplicationEmail(
  employerName: string,
  candidateName: string,
  jobTitle: string,
  applicationId: string,
): string {
  const safeEmployerName = escapeHtml(employerName)
  const safeCandidateName = escapeHtml(candidateName)
  const safeJobTitle = escapeHtml(jobTitle)
  // applicationId is an internal UUID — escape defensively
  const safeApplicationId = escapeHtml(applicationId)
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Application Received</h1>
          </div>
          <div class="content">
            <p>Hi ${safeEmployerName},</p>
            <p>You have received a new application for <strong>${safeJobTitle}</strong>.</p>
            <p><strong>Candidate:</strong> ${safeCandidateName}</p>
            <p>Review the application and respond to the candidate:</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/employer/applicants/${safeApplicationId}" class="button">Review Application</a>
            <p>Best regards,<br>The JobSphere Team</p>
          </div>
          <div class="footer">
            <p>This is an automated email from JobSphere. Please do not reply.</p>
          </div>
        </div>
      </body>
    </html>
  `
}

/**
 * Org member invitation / notification email.
 *
 * Two variants:
 *  - isNewUser=true: the recipient has no account yet. The CTA links to the
 *    set-password (reset-password) flow so they can choose a password and join.
 *  - isNewUser=false: the recipient already had an account and was simply added
 *    to the organization. The CTA links to login / the app.
 *
 * Every interpolated value (orgName, role) is HTML-escaped to prevent XSS.
 * actionUrl is a server-built URL (app origin + token/path) — escaped
 * defensively as well.
 */
export function getInvitationEmail({
  isNewUser,
  orgName,
  role,
  actionUrl,
}: {
  isNewUser: boolean
  orgName: string
  role: string
  actionUrl: string
}): string {
  const safeOrgName = escapeHtml(orgName)
  const safeRole = escapeHtml(role)
  const safeActionUrl = escapeHtml(actionUrl)

  const heading = isNewUser ? "You've been invited" : "You've been added"
  const intro = isNewUser
    ? `<p>You've been invited to join <strong>${safeOrgName}</strong> on JobSphere.</p>
            <p>To get started, set your password and join the team:</p>`
    : `<p>You've been added to <strong>${safeOrgName}</strong> as <strong>${safeRole}</strong>.</p>`
  const buttonLabel = isNewUser ? 'Set your password &amp; join' : 'Open JobSphere'
  const extras = isNewUser
    ? `<p>Or copy and paste this link into your browser:</p>
            <p style="word-break:break-all;font-size:13px;color:#6b7280;">${safeActionUrl}</p>
            <p style="font-size:13px;color:#6b7280;">This invitation link expires in 7 days.</p>`
    : ''

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .content { background: #f9fafb; padding: 30px; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            <h1>${heading}</h1>
            ${intro}
            <a href="${safeActionUrl}" style="display:inline-block;padding:12px 24px;background-color:#4F46E5;color:white;text-decoration:none;border-radius:5px;margin:16px 0;">${buttonLabel}</a>
            ${extras}
          </div>
          <hr/>
          <p style="text-align:center;color:#6b7280;font-size:12px;">JobSphere ATS</p>
        </div>
      </body>
    </html>
  `
}

export function getApplicationStatusChangeEmail(
  candidateName: string,
  jobTitle: string,
  status: string,
  applicationId: string,
): string {
  const statusMessages: Record<string, string> = {
    REVIEWING: 'Your application is now being reviewed by our team.',
    INTERVIEWED: 'Congratulations! You have been selected for an interview.',
    ACCEPTED: 'Congratulations! Your application has been accepted.',
    REJECTED:
      'Unfortunately, we have decided not to move forward with your application at this time.',
  }

  const safeCandidateName = escapeHtml(candidateName)
  const safeJobTitle = escapeHtml(jobTitle)
  const safeStatus = escapeHtml(status)
  // applicationId is an internal UUID — escape defensively
  const safeApplicationId = escapeHtml(applicationId)
  // statusMessages values are hardcoded strings — no escaping needed
  const statusMessage = statusMessages[status] || 'Your application status has changed.'

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Application Status Update</h1>
          </div>
          <div class="content">
            <p>Hi ${safeCandidateName},</p>
            <p>Your application for <strong>${safeJobTitle}</strong> has been updated.</p>
            <p><strong>Status:</strong> ${safeStatus}</p>
            <p>${statusMessage}</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/applications/${safeApplicationId}" class="button">View Application</a>
            <p>Best regards,<br>The JobSphere Team</p>
          </div>
          <div class="footer">
            <p>This is an automated email from JobSphere. Please do not reply.</p>
          </div>
        </div>
      </body>
    </html>
  `
}
