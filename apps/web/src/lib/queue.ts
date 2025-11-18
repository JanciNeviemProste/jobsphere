/**
 * BullMQ Queue Setup
 * Redis-backed job queue for background processing
 */

import { Queue, QueueOptions } from 'bullmq'
import IORedis from 'ioredis'
import { logger } from '@/lib/logger'

// Redis connection config
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
}

// Create Redis connection
export const connection = new IORedis(redisConfig)

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
    connection.quit(),
  ])
  logger.info('All queues closed')
}
