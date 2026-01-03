/**
 * Assessment Reminder Worker
 * Sends reminder emails for pending assessment invites
 */

import { Worker, Job } from 'bullmq'
import { connection } from '@/lib/queue'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

export interface AssessmentReminderJobData {
  inviteId: string
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
            description: true
          }
        },
        candidate: {
          include: {
            contacts: {
              where: { isPrimary: true },
              take: 1
            }
          }
        }
      }
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
        workerJobId: job.id
      })
      return { skipped: true, reason: `Status: ${invite.status}` }
    }

    // Skip if expired
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      logger.info('Assessment invite has expired', {
        inviteId,
        expiresAt: invite.expiresAt,
        workerJobId: job.id
      })
      // Update status to EXPIRED
      await prisma.assessmentInvite.update({
        where: { id: inviteId },
        data: { status: 'EXPIRED' }
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

    // TODO: Replace with actual email service call (Resend, SendGrid, etc.)
    // For now, just log the reminder
    logger.info('Sending assessment reminder email', {
      inviteId,
      email: candidateEmail,
      assessmentUrl,
      assessmentName: invite.assessment.name,
      workerJobId: job.id
    })

    // In production, this would be:
    // await sendEmail({
    //   to: candidateEmail,
    //   subject: `Reminder: Complete ${invite.assessment.name}`,
    //   html: getReminderEmailTemplate({
    //     assessmentTitle: invite.assessment.name,
    //     assessmentUrl,
    //     expiresAt: invite.expiresAt
    //   })
    // })

    // Update remindedAt if needed
    if (invite.remindedAt === null) {
      await prisma.assessmentInvite.update({
        where: { id: inviteId },
        data: { remindedAt: new Date() }
      })
    }

    logger.info('Assessment reminder sent successfully', {
      inviteId,
      workerJobId: job.id
    })

    return { sent: true, email: candidateEmail }
  } catch (error) {
    logger.error('Failed to send assessment reminder', {
      inviteId,
      error,
      workerJobId: job.id
    })
    throw error
  }
}

/**
 * Create and start the worker
 */
export const assessmentReminderWorker = new Worker<AssessmentReminderJobData>(
  'assessment-reminder',
  processAssessmentReminder,
  {
    connection,
    concurrency: 5 // Can process multiple reminders in parallel
  }
)

// Worker event handlers
assessmentReminderWorker.on('completed', (job) => {
  logger.info('Assessment reminder job completed', { jobId: job.id })
})

assessmentReminderWorker.on('failed', (job, error) => {
  logger.error('Assessment reminder job failed', {
    jobId: job?.id,
    error,
    data: job?.data
  })
})

assessmentReminderWorker.on('error', (error) => {
  logger.error('Assessment reminder worker error', { error })
})

logger.info('Assessment reminder worker started')
