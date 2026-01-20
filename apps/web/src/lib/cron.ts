/**
 * Cron Jobs for JobSphere using BullMQ Repeatable Jobs
 * Scheduled tasks that run at specific intervals using Redis-backed persistence
 */

import { prisma } from '@/lib/prisma'
import { assessmentReminderQueue, emailSequenceQueue, addAssessmentReminderJob } from '@/lib/queue'
import { logger } from '@/lib/logger'

/**
 * Initialize all cron jobs as BullMQ repeatable jobs
 * This should be called once when the application starts (or workers start)
 */
export async function initializeCronJobs() {
  logger.info('Initializing BullMQ repeatable jobs')

  try {
    // Clear any existing repeatable jobs to avoid duplicates
    const assessmentRepeatable = await assessmentReminderQueue.getRepeatableJobs()
    for (const job of assessmentRepeatable) {
      await assessmentReminderQueue.removeRepeatableByKey(job.key)
    }

    const emailSeqRepeatable = await emailSequenceQueue.getRepeatableJobs()
    for (const job of emailSeqRepeatable) {
      await emailSequenceQueue.removeRepeatableByKey(job.key)
    }

    // Assessment reminders - daily at 9 AM UTC
    await assessmentReminderQueue.add(
      'daily-scan',
      { type: 'scan-pending-invites' },
      {
        repeat: {
          pattern: '0 9 * * *', // Daily at 9 AM
          tz: 'UTC',
        },
        removeOnComplete: true,
      },
    )
    logger.info('Assessment reminder cron job scheduled: daily at 9 AM UTC')

    // Email sequences - every 15 minutes
    await emailSequenceQueue.add(
      'process-sequences',
      { type: 'process-due-steps' },
      {
        repeat: {
          pattern: '*/15 * * * *', // Every 15 minutes
        },
        removeOnComplete: true,
      },
    )
    logger.info('Email sequence cron job scheduled: every 15 minutes')

    logger.info('All cron jobs initialized successfully')
  } catch (error) {
    logger.error('Failed to initialize cron jobs', { error })
    throw error
  }
}

/**
 * Assessment Reminder Scan Job Logic
 * This function is called by the worker when the repeatable job triggers
 */
export async function runAssessmentReminderJob() {
  logger.info('Starting assessment reminder cron job')

  try {
    // Find invites that need reminders
    // Criteria: created 2+ days ago, not reminded yet or reminded 2+ days ago, status is PENDING or STARTED, not expired
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

    const invites = await prisma.assessmentInvite.findMany({
      where: {
        createdAt: {
          lte: twoDaysAgo,
        },
        status: {
          in: ['PENDING', 'STARTED'],
        },
        OR: [{ remindedAt: null }, { remindedAt: { lte: twoDaysAgo } }],
        AND: [
          {
            OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
          },
        ],
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        remindedAt: true,
        candidate: {
          select: {
            contacts: {
              where: { isPrimary: true },
              take: 1,
              select: {
                email: true,
              },
            },
          },
        },
      },
    })

    logger.info('Found assessment invites to remind', {
      count: invites.length,
      inviteIds: invites.map((i) => i.id),
    })

    // Queue reminder jobs
    let queued = 0
    let failed = 0

    for (const invite of invites) {
      try {
        await addAssessmentReminderJob({ inviteId: invite.id })
        queued++
      } catch (error) {
        failed++
        logger.error('Failed to queue assessment reminder', {
          inviteId: invite.id,
          error,
        })
      }
    }

    logger.info('Assessment reminder cron job completed', {
      total: invites.length,
      queued,
      failed,
    })

    return { total: invites.length, queued, failed }
  } catch (error) {
    logger.error('Assessment reminder cron job failed', { error })
    throw error
  }
}

/**
 * Email Sequence Processing Job Logic
 * This function is called by the worker when the repeatable job triggers
 */
export async function runEmailSequenceJob() {
  logger.info('Starting email sequence processing cron job')

  try {
    // Find active email sequence runs
    const activeRuns = await prisma.emailSequenceRun.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        sequence: {
          include: {
            steps: {
              orderBy: { order: 'asc' },
            },
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
        events: {
          orderBy: { at: 'desc' },
          take: 1,
        },
      },
    })

    logger.info('Found active email sequence runs for processing', {
      count: activeRuns.length,
    })

    let processed = 0
    let failed = 0

    for (const run of activeRuns) {
      try {
        const currentStep = run.sequence.steps[run.currentStep]

        if (!currentStep) {
          logger.warn('Current step not found', {
            runId: run.id,
            stepIndex: run.currentStep,
          })
          continue
        }

        // Import dynamically to avoid circular dependencies
        const { addEmailSequenceJob } = await import('@/lib/queue')

        await addEmailSequenceJob({
          enrollmentId: run.id,
          stepId: currentStep.id,
        })

        processed++
      } catch (error) {
        failed++
        logger.error('Failed to queue email sequence step', {
          runId: run.id,
          error,
        })
      }
    }

    logger.info('Email sequence cron job completed', {
      total: activeRuns.length,
      processed,
      failed,
    })

    return { total: activeRuns.length, processed, failed }
  } catch (error) {
    logger.error('Email sequence cron job failed', { error })
    throw error
  }
}

/**
 * Manual trigger for assessment reminder job
 * Can be called from API endpoint for testing
 */
export async function triggerAssessmentReminderJob() {
  return await runAssessmentReminderJob()
}

/**
 * Manual trigger for email sequence job
 * Can be called from API endpoint for testing
 */
export async function triggerEmailSequenceJob() {
  return await runEmailSequenceJob()
}

/**
 * Get all scheduled repeatable jobs
 */
export async function getScheduledJobs() {
  const assessmentJobs = await assessmentReminderQueue.getRepeatableJobs()
  const emailJobs = await emailSequenceQueue.getRepeatableJobs()

  return {
    assessmentReminders: assessmentJobs.map((job) => ({
      key: job.key,
      name: job.name,
      pattern: job.pattern,
      next: job.next,
      tz: job.tz,
    })),
    emailSequences: emailJobs.map((job) => ({
      key: job.key,
      name: job.name,
      pattern: job.pattern,
      next: job.next,
    })),
  }
}
