/**
 * Email Sequence Worker
 * Processes email sequence steps and sends emails to candidates
 */

import { Worker, Job } from 'bullmq'
import { connection, emailSequenceQueue, EmailSequenceJobData } from '@/lib/queue'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { sendEmail } from '@/lib/email'
import { unsubscribeFooterHtml } from '@/lib/unsubscribe'
import { runEmailSequenceJob } from '@/lib/cron'

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5')

/**
 * Decide whether a step's `conditions` mean we should SKIP sending it.
 * Returns true to SKIP (hold/advance), false to proceed.
 *
 * Conditions are an array of { type|kind, ... } objects (matches the shape
 * produced by the sequence builder). Supported: stage_changed, replied, opened.
 * Unknown/empty conditions never block a send.
 */
export async function shouldSkipStep(conditions: unknown, candidateId: string): Promise<boolean> {
  if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
    return false
  }

  for (const condition of conditions as Array<Record<string, any>>) {
    const conditionType = condition.type || condition.kind

    switch (conditionType) {
      case 'stage_changed': {
        // Skip if the candidate's latest application stage no longer matches the
        // stage this step was designed for.
        if (condition.expectedStage) {
          const application = await prisma.application.findFirst({
            where: { candidateId },
            orderBy: { updatedAt: 'desc' },
            select: { stage: true },
          })
          if (application && application.stage !== condition.expectedStage) {
            return true
          }
        }
        break
      }

      case 'replied': {
        // Skip if the candidate replied (inbound message) within the window.
        const sinceDate = condition.since
          ? new Date(condition.since)
          : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

        const replies = await prisma.emailMessage.count({
          where: {
            thread: { entityType: 'CANDIDATE', entityId: candidateId },
            direction: 'INBOUND',
            receivedAt: { gte: sinceDate },
          },
        })
        if (replies > 0) {
          return true
        }
        break
      }

      case 'opened': {
        // When required, skip if the previous email was NOT opened in the window.
        if (condition.required) {
          const sinceDate = condition.since
            ? new Date(condition.since)
            : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

          const opened = await prisma.emailEvent.count({
            where: {
              kind: 'OPENED',
              message: { thread: { entityType: 'CANDIDATE', entityId: candidateId } },
              timestamp: { gte: sinceDate },
            },
          })
          if (opened === 0) {
            return true
          }
        }
        break
      }

      default:
        logger.warn('Unknown email sequence condition type — ignoring', { conditionType })
    }
  }

  return false
}

/**
 * Compute the Date a step becomes due, relative to the run baseline.
 * Baseline = the time the previous step was SENT (so offsets are cumulative
 * across steps); for the first step it is the run's startedAt.
 */
function computeDueAt(baseline: Date, dayOffset: number, hourOffset: number): Date {
  const due = new Date(baseline)
  due.setUTCDate(due.getUTCDate() + (dayOffset || 0))
  due.setUTCHours(due.getUTCHours() + (hourOffset || 0))
  return due
}

/**
 * Job-name dispatcher for the `email-sequence` queue.
 *
 * Two distinct job kinds land on this queue:
 *  - `'process-sequences'` — enqueued by the cron (cron.ts, every 15 min). It carries
 *    NO { enrollmentId, stepId }; it triggers a scan of all ACTIVE runs which in turn
 *    enqueues individual `'send-step'` jobs. Handled by runEmailSequenceJob().
 *  - `'send-step'` (and any ad-hoc job) — a single step send for one enrollment.
 *    Handled by processEmailStep().
 */
async function dispatchEmailSequenceJob(job: Job) {
  if (job.name === 'process-sequences') {
    return runEmailSequenceJob()
  }
  return processEmailStep(job as Job<EmailSequenceJobData>)
}

/**
 * Process one email sequence step for a single run (LOGIC-010).
 *
 * Idempotent + due-date + condition aware. The cron scan (cron.ts
 * runEmailSequenceJob) enqueues the run's CURRENT step every 15 min; this
 * handler is the single per-step sender and is the source of truth for
 * advancing the run:
 *
 *   1. Resolve the authoritative current step from run.currentStep (the passed
 *      stepId is only a hint). If the run is not ACTIVE, no-op.
 *   2. DEDUPE: if a SENT EmailSequenceEvent already exists for (run, step),
 *      do not resend — just make sure currentStep has advanced.
 *   3. DUE-DATE: a step only sends once startedAt/last-sent + dayOffset/hourOffset
 *      <= now. The first step's dayOffset is honored too. If not due, no-op
 *      (the next cron scan re-checks).
 *   4. CONDITIONS: evaluate the step's conditions; if unmet, record SKIPPED,
 *      advance currentStep, and re-enqueue the next step.
 *   5. SEND: send the email, then ATOMICALLY write a SENT EmailSequenceEvent and
 *      increment currentStep. When currentStep passes the last step, mark the
 *      run COMPLETED.
 */
export async function processEmailStep(job: Job<EmailSequenceJobData>) {
  const { enrollmentId, stepId } = job.data

  logger.info('Processing email sequence step', { enrollmentId, stepId, jobId: job.id })

  try {
    // 1. Load run + ordered steps (steps drive the currentStep index).
    const run = await prisma.emailSequenceRun.findUnique({
      where: { id: enrollmentId },
      include: {
        sequence: {
          include: { steps: { orderBy: { order: 'asc' } } },
        },
      },
    })

    if (!run) {
      throw new Error(`Enrollment ${enrollmentId} not found`)
    }

    if (run.status !== 'ACTIVE') {
      logger.warn('Enrollment not active, skipping', {
        enrollmentId,
        status: run.status,
      })
      return { skipped: true, reason: 'not-active' }
    }

    const steps = run.sequence.steps
    if (steps.length === 0) {
      logger.warn('Sequence has no steps; completing run', { enrollmentId })
      await prisma.emailSequenceRun.update({
        where: { id: enrollmentId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })
      return { completed: true }
    }

    // If currentStep is already past the last step, finalize.
    if (run.currentStep >= steps.length) {
      await prisma.emailSequenceRun.update({
        where: { id: enrollmentId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })
      logger.info('Email sequence completed (no remaining steps)', { enrollmentId })
      return { completed: true }
    }

    // Authoritative current step = run.currentStep index into ordered steps.
    const step = steps[run.currentStep]

    // 2. DEDUPE — never resend a step that already has a SENT event.
    const alreadySent = await prisma.emailSequenceEvent.findFirst({
      where: { runId: run.id, stepId: step.id, kind: 'SENT' },
      select: { id: true },
    })

    if (alreadySent) {
      logger.info('Step already sent — deduped', {
        enrollmentId,
        stepId: step.id,
        currentStep: run.currentStep,
      })
      // Ensure the run advances past an already-sent step (self-heal).
      await advanceRun(run.id, run.currentStep, steps.length)
      return { skipped: true, reason: 'already-sent' }
    }

    // 3. DUE-DATE — baseline is the previous step's SENT time, else startedAt.
    const lastSent = await prisma.emailSequenceEvent.findFirst({
      where: { runId: run.id, kind: 'SENT' },
      orderBy: { at: 'desc' },
      select: { at: true },
    })
    const baseline = lastSent?.at ?? run.startedAt
    const dueAt = computeDueAt(baseline, step.dayOffset, step.hourOffset)

    if (dueAt.getTime() > Date.now()) {
      logger.info('Step not due yet — holding', {
        enrollmentId,
        stepId: step.id,
        dueAt: dueAt.toISOString(),
      })
      return { skipped: true, reason: 'not-due', dueAt }
    }

    // 4. CONDITIONS — skip (advance) the step if conditions are unmet.
    const skip = await shouldSkipStep(step.conditions, run.candidateId)
    if (skip) {
      logger.info('Step conditions unmet — skipping step', {
        enrollmentId,
        stepId: step.id,
      })
      await prisma.emailSequenceEvent.create({
        data: { runId: run.id, stepId: step.id, kind: 'SKIPPED' },
      })
      const advanced = await advanceRun(run.id, run.currentStep, steps.length)
      if (!advanced.completed) {
        await emailSequenceQueue.add('send-step', {
          enrollmentId: run.id,
          stepId: steps[advanced.nextStep].id,
        })
      }
      return { skipped: true, reason: 'conditions' }
    }

    // Load candidate contact for the actual send.
    const candidate = await prisma.candidate.findUnique({
      where: { id: run.candidateId },
      include: { contacts: { where: { isPrimary: true }, take: 1 } },
    })

    if (!candidate || !candidate.contacts || candidate.contacts.length === 0) {
      throw new Error('Candidate or primary contact not found')
    }

    const contact = candidate.contacts[0]
    const recipientEmail = contact.email
    if (!recipientEmail) {
      throw new Error('No recipient email found')
    }

    const organization = await prisma.organization.findUnique({
      where: { id: run.sequence.orgId },
      select: { name: true },
    })

    const candidateName = contact.fullName || 'there'
    const companyName = organization?.name || 'JobSphere'

    let subject = step.subject.replace(/{{candidateName}}/g, candidateName)
    subject = subject.replace(/{{companyName}}/g, companyName)

    let bodyHtml = step.bodyTemplate.replace(/{{candidateName}}/g, candidateName)
    bodyHtml = bodyHtml.replace(/{{companyName}}/g, companyName)

    // Sequence emails are marketing-style → always include an unsubscribe footer.
    try {
      bodyHtml += unsubscribeFooterHtml(recipientEmail)
    } catch (err) {
      logger.warn('Could not append unsubscribe footer to sequence email', {
        error: err instanceof Error ? err.message : String(err),
      })
    }

    // 5. SEND.
    const sendResult = await sendEmail({
      to: recipientEmail,
      subject,
      html: bodyHtml,
    })

    // If the recipient is suppressed, sendEmail returns { suppressed: true }
    // (it does NOT throw). Record a SKIPPED event and advance so we don't retry.
    if (sendResult.suppressed) {
      logger.info('Recipient suppressed — recording skip and advancing', {
        enrollmentId,
        stepId: step.id,
      })
      await prisma.emailSequenceEvent.create({
        data: {
          runId: run.id,
          stepId: step.id,
          kind: 'SKIPPED',
          metadata: { reason: 'suppressed' },
        },
      })
      const advanced = await advanceRun(run.id, run.currentStep, steps.length)
      if (!advanced.completed) {
        await emailSequenceQueue.add('send-step', {
          enrollmentId: run.id,
          stepId: steps[advanced.nextStep].id,
        })
      }
      return { skipped: true, reason: 'suppressed' }
    }

    logger.info('Email sent successfully', {
      enrollmentId,
      stepId: step.id,
      recipient: recipientEmail,
    })

    // 6. Atomically write the SENT event AND advance currentStep. Done in a
    // transaction with a guard on the expected currentStep so a concurrent run
    // cannot double-advance / double-send.
    const isLastStep = run.currentStep + 1 >= steps.length
    await prisma.$transaction(async (tx) => {
      await tx.emailSequenceEvent.create({
        data: { runId: run.id, stepId: step.id, kind: 'SENT' },
      })
      await tx.emailSequenceRun.updateMany({
        where: { id: run.id, currentStep: run.currentStep },
        data: {
          currentStep: run.currentStep + 1,
          ...(isLastStep ? { status: 'COMPLETED', completedAt: new Date() } : {}),
        },
      })
    })

    if (isLastStep) {
      logger.info('Email sequence completed', { enrollmentId })
    } else {
      // Enqueue the next step; the worker re-checks due-date/conditions/dedupe.
      const nextStep = steps[run.currentStep + 1]
      await emailSequenceQueue.add('send-step', {
        enrollmentId: run.id,
        stepId: nextStep.id,
      })
    }

    return { success: true }
  } catch (error) {
    logger.error('Failed to process email step', {
      error,
      enrollmentId,
      stepId,
      jobId: job.id,
    })
    throw error
  }
}

/**
 * Advance a run's currentStep by one (guarded on the expected value to stay
 * idempotent), marking COMPLETED when the last step is passed.
 * Returns whether the run is now completed and, if not, the next step index.
 */
async function advanceRun(
  runId: string,
  expectedCurrentStep: number,
  totalSteps: number,
): Promise<{ completed: boolean; nextStep: number }> {
  const nextStep = expectedCurrentStep + 1
  const completed = nextStep >= totalSteps

  await prisma.emailSequenceRun.updateMany({
    where: { id: runId, currentStep: expectedCurrentStep },
    data: {
      currentStep: nextStep,
      ...(completed ? { status: 'COMPLETED', completedAt: new Date() } : {}),
    },
  })

  return { completed, nextStep }
}

/**
 * Create and start the worker
 */
export const emailSequenceWorker = new Worker('email-sequence', dispatchEmailSequenceJob, {
  connection,
  concurrency: WORKER_CONCURRENCY,
  limiter: {
    max: 100, // Max 100 jobs per window
    duration: 60000, // 1 minute
  },
})

// Worker event handlers
emailSequenceWorker.on('completed', (job) => {
  logger.info('Email sequence job completed', { jobId: job.id })
})

emailSequenceWorker.on('failed', (job, error) => {
  logger.error('Email sequence job failed', {
    jobId: job?.id,
    error,
    data: job?.data,
  })
})

emailSequenceWorker.on('error', (error) => {
  logger.error('Email sequence worker error', { error })
})

logger.info('Email sequence worker started', { concurrency: WORKER_CONCURRENCY })
