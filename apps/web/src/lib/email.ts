import { prisma } from './prisma'

interface EmailData {
  to: string
  subject: string
  html: string
  text?: string
}

/**
 * Send email using configured email service
 * Currently uses Resend (can be configured via env vars)
 */
export async function sendEmail(data: EmailData): Promise<void> {
  const emailService = process.env.EMAIL_SERVICE || 'resend'

  if (emailService === 'resend') {
    return sendResendEmail(data)
  } else if (emailService === 'sendgrid') {
    return sendSendGridEmail(data)
  } else if (emailService === 'log') {
    // Development mode - just log emails
    console.log('📧 Email would be sent:', {
      to: data.to,
      subject: data.subject,
      preview: data.text || data.html.substring(0, 100),
    })
    return
  }

  throw new Error(`Unknown email service: ${emailService}`)
}

async function sendResendEmail(data: EmailData): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    console.warn('RESEND_API_KEY not set, email not sent:', data.subject)
    return
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'JobSphere <noreply@jobsphere.app>',
        to: data.to,
        subject: data.subject,
        html: data.html,
        text: data.text,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Resend API error: ${error}`)
    }

    // Log email in database
    await prisma.email.create({
      data: {
        to: data.to,
        subject: data.subject,
        body: data.html,
        status: 'SENT',
        provider: 'resend',
      },
    })
  } catch (error) {
    console.error('Error sending email via Resend:', error)

    // Log failed email
    await prisma.email.create({
      data: {
        to: data.to,
        subject: data.subject,
        body: data.html,
        status: 'FAILED',
        provider: 'resend',
      },
    })

    throw error
  }
}

async function sendSendGridEmail(data: EmailData): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY

  if (!apiKey) {
    console.warn('SENDGRID_API_KEY not set, email not sent:', data.subject)
    return
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: data.to }] }],
        from: {
          email: process.env.EMAIL_FROM || 'noreply@jobsphere.app',
          name: 'JobSphere',
        },
        subject: data.subject,
        content: [
          {
            type: 'text/html',
            value: data.html,
          },
          ...(data.text
            ? [
                {
                  type: 'text/plain',
                  value: data.text,
                },
              ]
            : []),
        ],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`SendGrid API error: ${error}`)
    }

    // Log email in database
    await prisma.email.create({
      data: {
        to: data.to,
        subject: data.subject,
        body: data.html,
        status: 'SENT',
        provider: 'sendgrid',
      },
    })
  } catch (error) {
    console.error('Error sending email via SendGrid:', error)

    // Log failed email
    await prisma.email.create({
      data: {
        to: data.to,
        subject: data.subject,
        body: data.html,
        status: 'FAILED',
        provider: 'sendgrid',
      },
    })

    throw error
  }
}

/**
 * Email templates
 */

export function getApplicationReceivedEmail(
  candidateName: string,
  jobTitle: string,
  companyName: string
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
  applicationId: string
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
  applicationId: string
): string {
  const statusMessages: Record<string, string> = {
    REVIEWING: 'Your application is now being reviewed by our team.',
    INTERVIEWED: 'Congratulations! You have been selected for an interview.',
    ACCEPTED: 'Congratulations! Your application has been accepted.',
    REJECTED: 'Unfortunately, we have decided not to move forward with your application at this time.',
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
