import { logger } from './logger'

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
 * Replace {{key}} template variables in a string
 */
function applyVariables(text: string, variables?: Record<string, string>): string {
  if (!variables) return text
  let result = text
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  return result
}

/**
 * Send email using configured email service
 */
export async function sendEmail(data: EmailData): Promise<EmailResult> {
  // Guard against email header injection
  validateEmailHeaders(data)

  // Apply template variables
  let subject = applyVariables(data.subject, data.variables)
  let html = applyVariables(data.html, data.variables)

  // Append unsubscribe link if requested
  if (data.includeUnsubscribe) {
    html +=
      '<p style="font-size:12px;color:#999;text-align:center;margin-top:20px;">If you no longer wish to receive these emails, <a href="{{unsubscribe_url}}" style="color:#999;">unsubscribe</a>.</p>'
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
  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)

  const result = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'JobSphere <noreply@jobsphere.app>',
    to: data.to,
    subject: data.subject,
    html: data.html,
  })

  return { success: true, id: (result as any)?.id }
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

  return sendEmail({
    to: recipientEmail,
    subject: `Application Received - ${jobTitle} at ${companyName}`,
    html: `
      <div>
        <h1>Application Received</h1>
        <p>Dear ${candidateName},</p>
        <p>Thank you for applying to <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.</p>
        <p>We have received your application and will review it shortly.</p>
        <p>Best regards,<br>The ${companyName} Team</p>
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

  return sendEmail({
    to: recipientEmail,
    subject: `Application Update - ${jobTitle}`,
    html: `
      <div>
        <h1>Application Update</h1>
        <p>Dear ${candidateName},</p>
        <p>Your application for <strong>${jobTitle}</strong> has been updated.</p>
        <p>New status: <strong>${newStatus}</strong></p>
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
            <p>Hi ${candidateName},</p>
            <p>Thank you for applying to <strong>${jobTitle}</strong> at <strong>${companyName}</strong>.</p>
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
            <p>Hi ${employerName},</p>
            <p>You have received a new application for <strong>${jobTitle}</strong>.</p>
            <p><strong>Candidate:</strong> ${candidateName}</p>
            <p>Review the application and respond to the candidate:</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/employer/applicants/${applicationId}" class="button">Review Application</a>
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
            <p>Hi ${candidateName},</p>
            <p>Your application for <strong>${jobTitle}</strong> has been updated.</p>
            <p><strong>Status:</strong> ${status}</p>
            <p>${statusMessages[status] || 'Your application status has changed.'}</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/applications/${applicationId}" class="button">View Application</a>
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
