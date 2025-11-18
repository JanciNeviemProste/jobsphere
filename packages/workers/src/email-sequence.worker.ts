/**
 * Email Sequence Worker
 * Spúšťa kroky email sekvencií (follow-ups, drip campaigns)
 */

import { Queue, Worker, Job } from 'bullmq'
import { prisma } from '@/lib/db'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

export const emailSequenceQueue = new Queue('email-sequence', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
})

interface SequenceStepJobData {
  enrollmentId: string
  stepId: string
}

/**
 * Send email via Microsoft Graph
 */
async function sendViaMicrosoft(
  emailAccount: any,
  to: string,
  subject: string,
  bodyHtml: string
) {
  const GRAPH_API = 'https://graph.microsoft.com/v1.0'

  const response = await fetch(`${GRAPH_API}/me/sendMail`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${emailAccount.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject,
        body: {
          contentType: 'HTML',
          content: bodyHtml,
        },
        toRecipients: [
          {
            emailAddress: {
              address: to,
            },
          },
        ],
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Microsoft send failed: ${error}`)
  }

  return { success: true }
}

/**
 * Send email via Gmail API
 */
async function sendViaGmail(
  emailAccount: any,
  to: string,
  subject: string,
  bodyHtml: string
) {
  const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1'

  // Construct RFC 2822 message
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    bodyHtml,
  ].join('\r\n')

  const encodedMessage = Buffer.from(message).toString('base64url')

  const response = await fetch(`${GMAIL_API}/users/me/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${emailAccount.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: encodedMessage,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Gmail send failed: ${error}`)
  }

  return await response.json()
}

/**
 * Send email via Resend (fallback)
 */
async function sendViaResend(
  from: string,
  to: string,
  subject: string,
  bodyHtml: string
) {
  const result = await resend.emails.send({
    from,
    to,
    subject,
    html: bodyHtml,
  })

  return result
}

/**
 * Replace template variables
 */
function replaceVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g')
    result = result.replace(regex, value)
  }

  return result
}

/**
 * BullMQ Worker - processes sequence step jobs
 */
export const emailSequenceWorker = new Worker<SequenceStepJobData>(
  'email-sequence',
  async (job: Job<SequenceStepJobData>) => {
    const { enrollmentId, stepId } = job.data

    console.log(`[Sequence] Processing step ${stepId} for enrollment ${enrollmentId}`)

    try {
      // Fetch enrollment
      const enrollment = await prisma.sequenceEnrollment.findUnique({
        where: { id: enrollmentId },
        include: {
          sequence: {
            include: {
              steps: true,
              emailAccount: true,
            },
          },
          application: {
            include: {
              candidate: {
                include: {
                  user: true,
                },
              },
              job: true,
            },
          },
        },
      })

      if (!enrollment) {
        throw new Error('Enrollment not found')
      }

      // Check if enrollment is still active
      if (enrollment.status !== 'ACTIVE') {
        console.log(`[Sequence] Enrollment ${enrollmentId} is not active, skipping`)
        return
      }

      // Find step
      const step = enrollment.sequence.steps.find((s) => s.id === stepId)
      if (!step) {
        throw new Error('Step not found')
      }

      // Get recipient email
      const recipientEmail = enrollment.application.candidate.user.email
      if (!recipientEmail) {
        throw new Error('Recipient email not found')
      }

      // Replace template variables
      const variables = {
        firstName: enrollment.application.candidate.user.name?.split(' ')[0] || 'there',
        lastName: enrollment.application.candidate.user.name?.split(' ').slice(1).join(' ') || '',
        jobTitle: enrollment.application.job.title,
        companyName: 'JobSphere', // TODO: Get from org
        candidateName: enrollment.application.candidate.user.name || 'Candidate',
      }

      const subject = replaceVariables(step.subject, variables)
      const bodyHtml = replaceVariables(step.bodyHtml || step.bodyText || '', variables)

      // Send email
      let sentMessageId: string | undefined

      if (enrollment.sequence.emailAccount) {
        const emailAccount = enrollment.sequence.emailAccount

        if (emailAccount.provider === 'MICROSOFT') {
          await sendViaMicrosoft(emailAccount, recipientEmail, subject, bodyHtml)
        } else if (emailAccount.provider === 'GMAIL') {
          const result = await sendViaGmail(emailAccount, recipientEmail, subject, bodyHtml)
          sentMessageId = result.id
        }
      } else {
        // Fallback to Resend
        const from = process.env.EMAIL_FROM || 'noreply@jobsphere.eu'
        await sendViaResend(from, recipientEmail, subject, bodyHtml)
      }

      // Update enrollment
      await prisma.sequenceEnrollment.update({
        where: { id: enrollmentId },
        data: {
          currentStepIndex: step.orderIndex + 1,
          lastStepSentAt: new Date(),
        },
      })

      // Schedule next step
      const nextStep = enrollment.sequence.steps.find(
        (s) => s.orderIndex === step.orderIndex + 1
      )

      if (nextStep) {
        const delayMs = nextStep.delayMinutes * 60 * 1000

        await emailSequenceQueue.add(
          'step',
          {
            enrollmentId,
            stepId: nextStep.id,
          },
          {
            delay: delayMs,
          }
        )

        console.log(`[Sequence] Scheduled next step in ${nextStep.delayMinutes} minutes`)
      } else {
        // Sequence completed
        await prisma.sequenceEnrollment.update({
          where: { id: enrollmentId },
          data: { status: 'COMPLETED' },
        })

        console.log(`[Sequence] Enrollment ${enrollmentId} completed`)
      }
    } catch (error) {
      console.error(`[Sequence] Error processing step:`, error)

      // Mark enrollment as failed
      await prisma.sequenceEnrollment.update({
        where: { id: enrollmentId },
        data: { status: 'FAILED' },
      })

      throw error
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    concurrency: 10,
  }
)

/**
 * Enroll candidate in sequence
 */
export async function enrollInSequence(
  sequenceId: string,
  applicationId: string
) {
  // Create enrollment
  const enrollment = await prisma.sequenceEnrollment.create({
    data: {
      sequenceId,
      applicationId,
      status: 'ACTIVE',
      currentStepIndex: 0,
    },
  })

  // Find first step
  const sequence = await prisma.emailSequence.findUnique({
    where: { id: sequenceId },
    include: { steps: { orderBy: { orderIndex: 'asc' } } },
  })

  if (!sequence || sequence.steps.length === 0) {
    throw new Error('Sequence has no steps')
  }

  const firstStep = sequence.steps[0]

  // Schedule first step
  await emailSequenceQueue.add(
    'step',
    {
      enrollmentId: enrollment.id,
      stepId: firstStep.id,
    },
    {
      delay: firstStep.delayMinutes * 60 * 1000,
    }
  )

  return enrollment
}
