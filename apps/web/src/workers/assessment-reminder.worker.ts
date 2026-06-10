/**
 * Assessment Reminder Worker
 * Sends reminder emails for pending assessment invites
 */

import { Worker, Job } from 'bullmq'
import { connection } from '@/lib/queue'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { runAssessmentReminderJob } from '@/lib/cron'

export interface AssessmentReminderJobData {
  inviteId: string
}

/**
 * Job-name dispatcher for the `assessment-reminder` queue.
 *
 *  - `'daily-scan'` — enqueued by the cron (cron.ts, daily 9 AM). Carries no inviteId;
 *    it scans for invites needing a reminder and enqueues individual `'send-reminder'`
 *    jobs. Handled by runAssessmentReminderJob().
 *  - `'send-reminder'` (and any ad-hoc job) — sends one reminder for one invite.
 *    Handled by processAssessmentReminder().
 */
async function dispatchAssessmentReminderJob(job: Job) {
  if (job.name === 'daily-scan') {
    return runAssessmentReminderJob()
  }
  return processAssessmentReminder(job as Job<AssessmentReminderJobData>)
}

/**
 * Process assessment reminder
 */
async function processAssessmentReminder(job: Job<AssessmentReminderJobData>) {
  const { inviteId } = job.data

  logger.info('Processing assessment reminder', { inviteId, workerJobId: job.id })

  try {
    // Fetch invite with assessment and candidate details
    const invite = await prisma.assessmentInvite.findUnique({
      where: { id: inviteId },
      include: {
        assessment: {
          select: {
            name: true,
            description: true,
          },
        },
        candidate: {
          include: {
            contacts: {
              where: { isPrimary: true },
              take: 1,
            },
          },
        },
      },
    })

    if (!invite) {
      logger.warn('Assessment invite not found', { inviteId, workerJobId: job.id })
      return { skipped: true, reason: 'Invite not found' }
    }

    // Skip if already completed or expired
    if (invite.status === 'COMPLETED' || invite.status === 'EXPIRED') {
      logger.info('Assessment invite already completed or expired', {
        inviteId,
        status: invite.status,
        workerJobId: job.id,
      })
      return { skipped: true, reason: `Status: ${invite.status}` }
    }

    // Skip if expired
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      logger.info('Assessment invite has expired', {
        inviteId,
        expiresAt: invite.expiresAt,
        workerJobId: job.id,
      })
      // Update status to EXPIRED
      await prisma.assessmentInvite.update({
        where: { id: inviteId },
        data: { status: 'EXPIRED' },
      })
      return { skipped: true, reason: 'Expired' }
    }

    // Send reminder email (using Resend or configured email service)
    const candidateEmail = invite.candidate.contacts?.[0]?.email
    if (!candidateEmail) {
      logger.warn('No email found for candidate', { inviteId, candidateId: invite.candidateId })
      return { skipped: true, reason: 'No email' }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const assessmentUrl = `${appUrl}/assessments/${invite.token}`

    // Send assessment reminder email
    logger.info('Sending assessment reminder email', {
      inviteId,
      email: candidateEmail,
      assessmentUrl,
      assessmentName: invite.assessment.name,
      workerJobId: job.id,
    })

    const expiryDate = invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : 'soon'

    await sendEmail({
      to: candidateEmail,
      subject: `Reminder: Complete ${invite.assessment.name}`,
      html: `
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
                <h1>⏰ Assessment Reminder</h1>
              </div>
              <div class="content">
                <p>Hi there,</p>
                <p>This is a friendly reminder that you have a pending assessment: <strong>${invite.assessment.name}</strong></p>
                <p>Please complete it before it expires on <strong>${expiryDate}</strong>.</p>
                <a href="${assessmentUrl}" class="button">Complete Assessment</a>
                <p>Good luck!</p>
                <p>Best regards,<br>The JobSphere Team</p>
              </div>
              <div class="footer">
                <p>This is an automated email from JobSphere. Please do not reply.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    })

    // Update remindedAt if needed
    if (invite.remindedAt === null) {
      await prisma.assessmentInvite.update({
        where: { id: inviteId },
        data: { remindedAt: new Date() },
      })
    }

    logger.info('Assessment reminder sent successfully', {
      inviteId,
      workerJobId: job.id,
    })

    return { sent: true, email: candidateEmail }
  } catch (error) {
    logger.error('Failed to send assessment reminder', {
      inviteId,
      error,
      workerJobId: job.id,
    })
    throw error
  }
}

/**
 * Create and start the worker
 */
export const assessmentReminderWorker = new Worker(
  'assessment-reminder',
  dispatchAssessmentReminderJob,
  {
    connection,
    concurrency: 5, // Can process multiple reminders in parallel
  },
)

// Worker event handlers
assessmentReminderWorker.on('completed', (job) => {
  logger.info('Assessment reminder job completed', { jobId: job.id })
})

assessmentReminderWorker.on('failed', (job, error) => {
  logger.error('Assessment reminder job failed', {
    jobId: job?.id,
    error,
    data: job?.data,
  })
})

assessmentReminderWorker.on('error', (error) => {
  logger.error('Assessment reminder worker error', { error })
})

logger.info('Assessment reminder worker started')
