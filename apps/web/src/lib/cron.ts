/**
 * Cron Jobs for JobSphere using BullMQ Repeatable Jobs
 * Scheduled tasks that run at specific intervals using Redis-backed persistence
 */

import { prisma } from '@/lib/prisma'
import {
  assessmentReminderQueue,
  emailSequenceQueue,
  retentionQueue,
  addAssessmentReminderJob,
} from '@/lib/queue'
import { eraseCandidatesPII } from '@/services/gdpr.service'
import { logger } from '@/lib/logger'

/**
 * Retention window (days) before soft-deleted candidates are HARD-erased.
 * Defaults to 30 days; override with CANDIDATE_RETENTION_DAYS.
 */
const CANDIDATE_RETENTION_DAYS = parseInt(process.env.CANDIDATE_RETENTION_DAYS || '30', 10)

/**
 * Retention window (days) before audit logs are anonymized (PII stripped).
 * Defaults to 365 days; override with AUDIT_LOG_RETENTION_DAYS.
 */
const AUDIT_LOG_RETENTION_DAYS = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '365', 10)

/** Max candidates to hard-erase per retention run (keeps each job bounded). */
const RETENTION_CANDIDATE_BATCH = parseInt(process.env.RETENTION_CANDIDATE_BATCH || '500', 10)

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

    const retentionRepeatable = await retentionQueue.getRepeatableJobs()
    for (const job of retentionRepeatable) {
      await retentionQueue.removeRepeatableByKey(job.key)
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

    // Data retention (GDPR) - daily at 3 AM UTC
    await retentionQueue.add(
      'run-retention',
      { type: 'enforce-retention' },
      {
        repeat: {
          pattern: '0 3 * * *', // Daily at 3 AM
          tz: 'UTC',
        },
        removeOnComplete: true,
      },
    )
    logger.info('Retention cron job scheduled: daily at 3 AM UTC')

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
    let completed = 0

    // Import once (dynamic to avoid circular deps with the worker).
    const { addEmailSequenceJob } = await import('@/lib/queue')

    for (const run of activeRuns) {
      try {
        const steps = run.sequence.steps

        // No steps, or currentStep already past the last step → finalize the run
        // here so it doesn't linger ACTIVE forever (the worker also self-heals,
        // but this keeps the scan list bounded).
        if (steps.length === 0 || run.currentStep >= steps.length) {
          await prisma.emailSequenceRun.update({
            where: { id: run.id },
            data: { status: 'COMPLETED', completedAt: new Date() },
          })
          completed++
          continue
        }

        const currentStep = steps[run.currentStep]

        // Enqueue the run's CURRENT step. The worker is idempotent and enforces
        // due-date/conditions/dedupe before actually sending, so re-enqueuing the
        // same step every 15 min is safe (it will hold until due, then send once).
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
      completed,
    })

    return { total: activeRuns.length, processed, failed, completed }
  } catch (error) {
    logger.error('Email sequence cron job failed', { error })
    throw error
  }
}

/**
 * Data Retention Job Logic (GDPR Art. 5(1)(e) — storage limitation).
 * This function is called by the worker when the daily repeatable job triggers.
 *
 * 1. HARD-erases candidates that were soft-deleted (deletedAt set) beyond the
 *    retention window, reusing the FK-safe `eraseCandidatesPII` from GdprService.
 * 2. Anonymizes audit logs older than the audit retention window by stripping
 *    PII fields (userId, ipAddress, userAgent).
 *
 * Crash-safe: each phase is wrapped so a failure in one does not abort the other,
 * and the whole job never throws on partial failure (it returns counts instead).
 */
export async function runRetentionJob() {
  logger.info('Starting data retention cron job', {
    candidateRetentionDays: CANDIDATE_RETENTION_DAYS,
    auditLogRetentionDays: AUDIT_LOG_RETENTION_DAYS,
  })

  const candidateCutoff = new Date()
  candidateCutoff.setDate(candidateCutoff.getDate() - CANDIDATE_RETENTION_DAYS)

  const auditCutoff = new Date()
  auditCutoff.setDate(auditCutoff.getDate() - AUDIT_LOG_RETENTION_DAYS)

  let candidatesErased = 0
  let auditLogsAnonymized = 0

  // --- Phase 1: hard-erase expired soft-deleted candidates --------------------
  try {
    const expiredCandidates = await prisma.candidate.findMany({
      where: {
        deletedAt: { not: null, lte: candidateCutoff },
      },
      select: { id: true },
      take: RETENTION_CANDIDATE_BATCH,
    })

    const candidateIds = expiredCandidates.map((c) => c.id)

    if (candidateIds.length > 0) {
      logger.info('Hard-erasing soft-deleted candidates past retention window', {
        count: candidateIds.length,
        cutoff: candidateCutoff.toISOString(),
      })

      // FK-safe erasure inside a single transaction, reusing GdprService logic.
      await prisma.$transaction(async (tx) => {
        await eraseCandidatesPII(tx, candidateIds)
      })

      candidatesErased = candidateIds.length
      logger.info('Candidate retention erasure complete', { candidatesErased })
    } else {
      logger.info('No candidates past retention window')
    }
  } catch (error) {
    logger.error('Retention: candidate erasure phase failed', { error })
  }

  // --- Phase 2: anonymize old audit logs --------------------------------------
  try {
    const { count } = await prisma.auditLog.updateMany({
      where: {
        createdAt: { lte: auditCutoff },
        // Only touch rows that still carry PII (avoid re-processing every run).
        OR: [{ userId: { not: null } }, { ipAddress: { not: null } }, { userAgent: { not: null } }],
      },
      data: {
        userId: null,
        ipAddress: null,
        userAgent: null,
      },
    })

    auditLogsAnonymized = count
    logger.info('Audit log anonymization complete', {
      auditLogsAnonymized,
      cutoff: auditCutoff.toISOString(),
    })
  } catch (error) {
    logger.error('Retention: audit log anonymization phase failed', { error })
  }

  logger.info('Data retention cron job completed', {
    candidatesErased,
    auditLogsAnonymized,
  })

  return { candidatesErased, auditLogsAnonymized }
}

/**
 * Manual trigger for assessment reminder job
 * Can be called from API endpoint for testing
 */
export async function triggerAssessmentReminderJob() {
  return await runAssessmentReminderJob()
}

/**
 * Manual trigger for the retention job
 * Can be called from API endpoint for testing
 */
export async function triggerRetentionJob() {
  return await runRetentionJob()
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
  const retentionJobs = await retentionQueue.getRepeatableJobs()

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
    retention: retentionJobs.map((job) => ({
      key: job.key,
      name: job.name,
      pattern: job.pattern,
      next: job.next,
      tz: job.tz,
    })),
  }
}
