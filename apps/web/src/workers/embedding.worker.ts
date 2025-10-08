/**
 * Embedding Generation Worker
 * Generates vector embeddings for CVs and job descriptions
 */

import { Worker, Job } from 'bullmq'
import { connection, EmbeddingJobData } from '@/lib/queue'
import { logger } from '@/lib/logger'
import { generateCVEmbeddings, generateJobEmbedding } from '@/lib/embeddings'

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '3') // Lower concurrency for OpenAI API

/**
 * Process embedding generation
 */
async function processEmbeddingGeneration(job: Job<EmbeddingJobData>) {
  const { resumeId, jobId } = job.data

  logger.info('Processing embedding generation', { resumeId, targetJobId: jobId, workerJobId: job.id })

  try {
    if (resumeId) {
      // Generate embeddings for CV
      await generateCVEmbeddings(resumeId)
      logger.info('CV embeddings generated successfully', { resumeId })
      return { success: true, type: 'cv', resumeId }
    } else if (jobId) {
      // Generate embedding for job
      await generateJobEmbedding(jobId)
      logger.info('Job embedding generated successfully', { jobId })
      return { success: true, type: 'job', jobId }
    } else {
      throw new Error('Either resumeId or jobId must be provided')
    }
  } catch (error) {
    logger.error('Failed to generate embeddings', {
      error,
      resumeId,
      targetJobId: jobId,
      workerJobId: job.id,
    })
    throw error
  }
}

/**
 * Create and start the worker
 */
export const embeddingWorker = new Worker<EmbeddingJobData>(
  'embeddings',
  processEmbeddingGeneration,
  {
    connection,
    concurrency: WORKER_CONCURRENCY,
    limiter: {
      max: 50, // Max 50 jobs per minute (OpenAI rate limits)
      duration: 60000,
    },
  }
)

// Worker event handlers
embeddingWorker.on('completed', (job) => {
  logger.info('Embedding job completed', { jobId: job.id })
})

embeddingWorker.on('failed', (job, error) => {
  logger.error('Embedding job failed', {
    jobId: job?.id,
    error,
    data: job?.data,
  })
})

embeddingWorker.on('error', (error) => {
  logger.error('Embedding worker error', { error })
})

logger.info('Embedding worker started', { concurrency: WORKER_CONCURRENCY })
