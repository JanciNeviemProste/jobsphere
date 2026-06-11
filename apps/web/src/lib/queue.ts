/**
 * BullMQ Queue Setup
 * Redis-backed job queue — lazy singletons so importing this module
 * does NOT create a Redis connection at module load (important for Vercel).
 */

import type { Queue as BullQueue, QueueOptions } from 'bullmq'
import type IORedisType from 'ioredis'
import { logger } from '@/lib/logger'

let _connection: IORedisType | null = null
const _queues = new Map<string, BullQueue>()

function hasRedis(): boolean {
  return Boolean(process.env.REDIS_URL)
}

export function getConnection(): IORedisType {
  if (_connection) return _connection

  // Lazy require — only loaded if queue API is actually used at runtime.
  const IORedis = require('ioredis').default || require('ioredis')
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

  _connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })

  _connection!.on('connect', () => logger.info('Redis connected successfully'))
  _connection!.on('error', (error: Error) => logger.error('Redis connection error', { error }))

  return _connection!
}

function buildQueueOptions(extra?: Partial<QueueOptions['defaultJobOptions']>): QueueOptions {
  return {
    connection: getConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
      ...extra,
    },
  }
}

function getOrCreateQueue(
  name: string,
  extra?: Partial<QueueOptions['defaultJobOptions']>,
): BullQueue {
  const existing = _queues.get(name)
  if (existing) return existing
  const { Queue } = require('bullmq') as typeof import('bullmq')
  const q = new Queue(name, buildQueueOptions(extra))
  _queues.set(name, q)
  return q
}

export const getEmailSequenceQueue = () => getOrCreateQueue('email-sequence', { attempts: 5 })
export const getEmbeddingQueue = () => getOrCreateQueue('embeddings', { priority: 2 })
export const getAssessmentQueue = () => getOrCreateQueue('assessments', { priority: 1 })
export const getMatchScoreCacheQueue = () => getOrCreateQueue('match-score-cache', { priority: 3 })
export const getAssessmentReminderQueue = () =>
  getOrCreateQueue('assessment-reminder', { priority: 2 })
export const getRetentionQueue = () => getOrCreateQueue('retention', { priority: 3 })

// Back-compat named exports used by workers. These are Proxies that lazy-instantiate
// on first property access (so merely importing the symbol is free).
function lazyProxy<T extends object>(factory: () => T): T {
  return new Proxy({} as T, {
    get(_t, prop) {
      const target = factory() as any
      const value = target[prop]
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

export const connection = lazyProxy(getConnection)
export const emailSequenceQueue = lazyProxy(getEmailSequenceQueue)
export const embeddingQueue = lazyProxy(getEmbeddingQueue)
export const assessmentQueue = lazyProxy(getAssessmentQueue)
export const matchScoreCacheQueue = lazyProxy(getMatchScoreCacheQueue)
export const assessmentReminderQueue = lazyProxy(getAssessmentReminderQueue)
export const retentionQueue = lazyProxy(getRetentionQueue)

export interface EmailSequenceJobData {
  enrollmentId: string
  stepId: string
}
export interface EmbeddingJobData {
  resumeId?: string
  jobId?: string
}
export interface AssessmentJobData {
  attemptId: string
}
export interface MatchScoreCacheJobData {
  jobId: string
  candidateLimit?: number
}
/**
 * Per-candidate cache fill: compute + upsert MatchScore for one candidate
 * against a bounded set of jobs. Used by the candidate match-scores endpoint
 * to refresh missing/stale cache entries without blocking the request.
 */
export interface CandidateMatchScoreCacheJobData {
  candidateId: string
  jobIds: string[]
}
export interface AssessmentReminderJobData {
  inviteId: string
}

/**
 * Guard: if Redis is not configured (e.g. Vercel without REDIS_URL), skip silently.
 * Returns null so callers can treat "no Redis" as "background job not scheduled".
 */
async function safeAdd<T>(
  queueFactory: () => BullQueue,
  jobName: string,
  data: T,
  opts?: Record<string, unknown>,
) {
  if (!hasRedis()) {
    logger.info('Queue job skipped — REDIS_URL not configured', { jobName })
    return null
  }
  try {
    const job = await queueFactory().add(jobName, data as any, opts as any)
    logger.info('Queue job added', { jobName, jobId: job.id })
    return job
  } catch (error) {
    logger.error('Failed to add queue job', { error, jobName, data })
    return null
  }
}

export const addEmailSequenceJob = (data: EmailSequenceJobData, delayMs?: number) =>
  safeAdd(getEmailSequenceQueue, 'send-step', data, {
    delay: delayMs,
    // Deterministic job id so concurrent re-enqueues of the SAME (run, step) —
    // the 15-min cron re-scan, the enroll kick, retries — dedupe in BullMQ and
    // can't run two jobs for one step at once → no double-send (F4). The SENT-event
    // check in the worker still guards sequential re-runs.
    jobId: `seq:${data.enrollmentId}:${data.stepId}`,
    // Remove a permanently-failed step job so its deterministic id is freed and the
    // next cron scan can re-enqueue/retry it — otherwise a hard-failed step would be
    // blocked by its own id until removeOnFail age (review F4 follow-up).
    removeOnFail: true,
  })

export const addEmbeddingJob = (data: EmbeddingJobData) =>
  safeAdd(getEmbeddingQueue, 'generate-embedding', data)

export const addAssessmentGradingJob = (data: AssessmentJobData) =>
  safeAdd(getAssessmentQueue, 'grade-assessment', data, { priority: 1 })

export const addMatchScoreCacheJob = (data: MatchScoreCacheJobData) =>
  safeAdd(getMatchScoreCacheQueue, 'cache-scores', data)

export const addCandidateMatchScoreCacheJob = (data: CandidateMatchScoreCacheJobData) =>
  safeAdd(getMatchScoreCacheQueue, 'cache-candidate-scores', data)

export const addAssessmentReminderJob = (data: AssessmentReminderJobData) =>
  safeAdd(getAssessmentReminderQueue, 'send-reminder', data)

export async function getQueueStats(queueName: string) {
  const queue =
    queueName === 'email-sequence'
      ? getEmailSequenceQueue()
      : queueName === 'embeddings'
        ? getEmbeddingQueue()
        : getAssessmentQueue()

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ])

  return {
    queue: queueName,
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  }
}

export async function closeQueues() {
  await Promise.all(Array.from(_queues.values()).map((q) => q.close()))
  if (_connection) await _connection.quit()
  _queues.clear()
  _connection = null
  logger.info('All queues closed')
}
