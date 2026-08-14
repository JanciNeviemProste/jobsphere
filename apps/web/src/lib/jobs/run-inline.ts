/**
 * Scheduled work, executed inline instead of through a queue.
 *
 * Why this exists: the app deploys to Vercel, which is serverless and cannot
 * host a long-lived BullMQ worker. `REDIS_URL` is configured, so the app has
 * been happily *enqueueing* jobs — and nothing has ever consumed them. Email
 * sequences never sent, assessment reminders never fired, and GDPR retention
 * never ran. That last one is a legal exposure, not a backlog.
 *
 * These functions do what a worker would do, driven by Vercel Cron. They call
 * the very same processors the workers call (see `JobLike`), so there is one
 * implementation of the actual work, not two that drift.
 *
 * ## The two constraints that shape everything here
 *
 * 1. **A serverless invocation is not allowed to run forever.** Every loop is
 *    bounded by both a item cap and a wall-clock deadline, and stops cleanly
 *    when either is hit. Unfinished work is simply picked up by the next tick —
 *    which is why the return value reports `remaining`, so a permanently
 *    growing backlog is visible rather than silent.
 * 2. **One bad row must not sink the batch.** Each item is caught individually.
 *    A candidate whose email bounces should not prevent the other 200 from
 *    being processed, and — more importantly — should not stop retention.
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { inlineJob } from '@/lib/jobs/job-like'
import { processEmailStep } from '@/workers/email-sequence.worker'
import { processAssessmentReminder } from '@/workers/assessment-reminder.worker'
import { generateCVEmbeddings, generateJobEmbedding } from '@/lib/embeddings'

/**
 * How long a cron invocation may spend on its batch loop.
 *
 * Vercel's ceiling is 300s. Stopping at 240 leaves room for the work already in
 * flight to finish and for the response to be written, so the run ends on our
 * terms with a reportable count instead of being killed mid-item.
 */
const DEADLINE_MS = 240_000

/** Upper bound on items per invocation, independent of the clock. */
const MAX_EMAIL_STEPS = 200
const MAX_REMINDERS = 200

/**
 * Embeddings are deliberately a much smaller batch than the others: each one is
 * a paid call to an embedding API, and this runs hourly. A backlog draining at
 * 25+25 an hour is fine; a backlog that bills for thousands of calls in one
 * invocation because nobody bounded it is not.
 */
const MAX_EMBEDDING_RESUMES = 25
const MAX_EMBEDDING_JOBS = 25

export interface InlineRunResult {
  processed: number
  failed: number
  /** Items that matched but were not reached this run. Should trend to 0. */
  remaining: number
  /** True when the run stopped on the clock rather than finishing the batch. */
  deadlineHit: boolean
}

function makeDeadline(budgetMs = DEADLINE_MS) {
  const startedAt = Date.now()
  return () => Date.now() - startedAt > budgetMs
}

/**
 * Advance every active email sequence run by one step.
 *
 * Mirrors `runEmailSequenceJob` in lib/cron.ts, except it *processes* each step
 * rather than enqueueing it. `processEmailStep` is idempotent and enforces the
 * due date, the skip conditions and send-deduplication itself, so calling it on
 * every tick for a run that is not due yet is a no-op rather than a duplicate
 * email.
 */
export async function runEmailSequencesInline(): Promise<InlineRunResult> {
  const isPastDeadline = makeDeadline()

  const activeRuns = await prisma.emailSequenceRun.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      currentStep: true,
      sequence: { select: { steps: { orderBy: { order: 'asc' }, select: { id: true } } } },
    },
    take: MAX_EMAIL_STEPS,
  })

  let processed = 0
  let failed = 0
  let index = 0

  for (const run of activeRuns) {
    if (isPastDeadline()) break
    index++

    try {
      const steps = run.sequence.steps

      // Nothing left to send: close the run so it stops showing up in every
      // future scan. Left ACTIVE it would be re-examined forever.
      if (steps.length === 0 || run.currentStep >= steps.length) {
        await prisma.emailSequenceRun.update({
          where: { id: run.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        })
        processed++
        continue
      }

      await processEmailStep(
        inlineJob('send-step', { enrollmentId: run.id, stepId: steps[run.currentStep].id }),
      )
      processed++
    } catch (error) {
      failed++
      logger.error('Inline email sequence step failed', { runId: run.id, error })
    }
  }

  const result: InlineRunResult = {
    processed,
    failed,
    remaining: Math.max(0, activeRuns.length - index),
    deadlineHit: index < activeRuns.length,
  }

  logger.info('Inline email sequence run complete', result)
  return result
}

/**
 * Send reminders for assessment invites that have gone quiet.
 *
 * The selection criteria are lifted from `runAssessmentReminderJob` so the two
 * paths pick the same invites: created at least two days ago, still PENDING or
 * STARTED, not reminded within the last two days, and not expired.
 */
export async function runAssessmentRemindersInline(): Promise<InlineRunResult> {
  const isPastDeadline = makeDeadline()

  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
  const now = new Date()

  const invites = await prisma.assessmentInvite.findMany({
    where: {
      createdAt: { lte: twoDaysAgo },
      status: { in: ['PENDING', 'STARTED'] },
      OR: [{ remindedAt: null }, { remindedAt: { lte: twoDaysAgo } }],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }],
    },
    select: { id: true },
    take: MAX_REMINDERS,
  })

  let processed = 0
  let failed = 0
  let index = 0

  for (const invite of invites) {
    if (isPastDeadline()) break
    index++

    try {
      await processAssessmentReminder(inlineJob('send-reminder', { inviteId: invite.id }))
      processed++
    } catch (error) {
      failed++
      logger.error('Inline assessment reminder failed', { inviteId: invite.id, error })
    }
  }

  const result: InlineRunResult = {
    processed,
    failed,
    remaining: Math.max(0, invites.length - index),
    deadlineHit: index < invites.length,
  }

  logger.info('Inline assessment reminder run complete', result)
  return result
}

/**
 * Generate the embeddings that were never generated.
 *
 * Unlike the other two, this work is event-driven: uploading a CV or publishing
 * a job enqueues an embedding job. With no worker consuming that queue, every CV
 * and job since the app went live is missing its vector — which does not throw
 * anything, it just quietly makes semantic search blind to them.
 *
 * The `IS NULL` filters have to be raw SQL: `embedding` and `embeddingVector`
 * are pgvector columns, which Prisma maps as `Unsupported(...)` and therefore
 * cannot appear in a `where`.
 */
export async function runEmbeddingBackfill(): Promise<InlineRunResult> {
  const isPastDeadline = makeDeadline()

  const [resumeRows, jobRows] = await Promise.all([
    prisma.$queryRaw<Array<{ resumeId: string }>>`
      SELECT DISTINCT "resumeId"
      FROM "ResumeSection"
      WHERE "embeddingVector" IS NULL
      LIMIT ${MAX_EMBEDDING_RESUMES}
    `,
    prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Job"
      WHERE "embedding" IS NULL
        AND "deletedAt" IS NULL
      LIMIT ${MAX_EMBEDDING_JOBS}
    `,
  ])

  const targets: Array<{ kind: 'resume' | 'job'; id: string }> = [
    ...resumeRows.map((r) => ({ kind: 'resume' as const, id: r.resumeId })),
    ...jobRows.map((j) => ({ kind: 'job' as const, id: j.id })),
  ]

  let processed = 0
  let failed = 0
  let index = 0

  for (const target of targets) {
    if (isPastDeadline()) break
    index++

    try {
      if (target.kind === 'resume') await generateCVEmbeddings(target.id)
      else await generateJobEmbedding(target.id)
      processed++
    } catch (error) {
      // A single unparseable CV must not stall the backfill behind it forever.
      failed++
      logger.error('Inline embedding generation failed', { ...target, error })
    }
  }

  const result: InlineRunResult = {
    processed,
    failed,
    remaining: Math.max(0, targets.length - index),
    deadlineHit: index < targets.length,
  }

  logger.info('Inline embedding backfill complete', result)
  return result
}
