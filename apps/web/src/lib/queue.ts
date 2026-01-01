/**
 * BullMQ Queue Setup
 * Redis-backed job queue for background processing
 */

import { Queue, QueueOptions } from 'bullmq'
import IORedis from 'ioredis'
import { logger } from '@/lib/logger'

// Redis connection (uses REDIS_URL for consistency)
// Format: redis://[:password@]host[:port][/db]
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

// Create Redis connection from URL
export const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

connection.on('connect', () => {
  logger.info('Redis connected successfully')
})

connection.on('error', (error) => {
  logger.error('Redis connection error', { error })
})

// Default queue options
const defaultQueueOptions: QueueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep max 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
}

// Email Sequence Queue
export const emailSequenceQueue = new Queue('email-sequence', {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    attempts: 5, // Retry more times for emails
  },
})

// Embedding Generation Queue
export const embeddingQueue = new Queue('embeddings', {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    priority: 2, // Lower priority
  },
})

// Assessment Grading Queue
export const assessmentQueue = new Queue('assessments', {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    priority: 1, // High priority
  },
})

// Match Score Cache Queue
export const matchScoreCacheQueue = new Queue('match-score-cache', {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    priority: 3, // Lowest priority (background task)
  },
})

// Assessment Reminder Queue
export const assessmentReminderQueue = new Queue('assessment-reminder', {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    priority: 2, // Medium priority
  },
})

/**
 * Email Sequence Job Data
 */
export interface EmailSequenceJobData {
  enrollmentId: string
  stepId: string
}

/**
 * Embedding Job Data
 */
export interface EmbeddingJobData {
  resumeId?: string
  jobId?: string
}

/**
 * Assessment Grading Job Data
 */
export interface AssessmentJobData {
  attemptId: string
}

/**
 * Match Score Cache Job Data
 */
export interface MatchScoreCacheJobData {
  jobId: string
  candidateLimit?: number
}

/**
 * Assessment Reminder Job Data
 */
export interface AssessmentReminderJobData {
  inviteId: string
}

/**
 * Add email sequence job
 */
export async function addEmailSequenceJob(
  data: EmailSequenceJobData,
  delayMs?: number
) {
  try {
    const job = await emailSequenceQueue.add('send-step', data, {
      delay: delayMs,
    })
    logger.info('Email sequence job added', { jobId: job.id, data })
    return job
  } catch (error) {
    logger.error('Failed to add email sequence job', { error, data })
    throw error
  }
}

/**
 * Add embedding generation job
 */
export async function addEmbeddingJob(data: EmbeddingJobData) {
  try {
    const job = await embeddingQueue.add('generate-embedding', data)
    logger.info('Embedding job added', { jobId: job.id, data })
    return job
  } catch (error) {
    logger.error('Failed to add embedding job', { error, data })
    throw error
  }
}

/**
 * Add assessment grading job
 */
export async function addAssessmentGradingJob(data: AssessmentJobData) {
  try {
    const job = await assessmentQueue.add('grade-assessment', data, {
      priority: 1, // High priority
    })
    logger.info('Assessment grading job added', { jobId: job.id, data })
    return job
  } catch (error) {
    logger.error('Failed to add assessment grading job', { error, data })
    throw error
  }
}

/**
 * Add match score cache job
 */
export async function addMatchScoreCacheJob(data: MatchScoreCacheJobData) {
  try {
    const job = await matchScoreCacheQueue.add('cache-scores', data)
    logger.info('Match score cache job added', { jobId: job.id, data })
    return job
  } catch (error) {
    logger.error('Failed to add match score cache job', { error, data })
    throw error
  }
}

/**
 * Add assessment reminder job
 */
export async function addAssessmentReminderJob(data: AssessmentReminderJobData) {
  try {
    const job = await assessmentReminderQueue.add('send-reminder', data)
    logger.info('Assessment reminder job added', { jobId: job.id, data })
    return job
  } catch (error) {
    logger.error('Failed to add assessment reminder job', { error, data })
    throw error
  }
}

/**
 * Get queue stats
 */
export async function getQueueStats(queueName: string) {
  const queue =
    queueName === 'email-sequence'
      ? emailSequenceQueue
      : queueName === 'embeddings'
      ? embeddingQueue
      : assessmentQueue

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

/**
 * Close all queues (for graceful shutdown)
 */
export async function closeQueues() {
  await Promise.all([
    emailSequenceQueue.close(),
    embeddingQueue.close(),
    assessmentQueue.close(),
    matchScoreCacheQueue.close(),
    assessmentReminderQueue.close(),
    connection.quit(),
  ])
  logger.info('All queues closed')
}
