/**
 * Data Retention Worker (GDPR storage limitation)
 * Consumes the daily repeatable `run-retention` job enqueued by the cron and
 * runs the FK-safe retention enforcement (hard-erase expired soft-deleted
 * candidates + anonymize old audit logs) via runRetentionJob().
 */

import { Worker, Job } from 'bullmq'
import { connection } from '@/lib/queue'
import { logger } from '@/lib/logger'
import { runRetentionJob } from '@/lib/cron'

/**
 * Process retention job. The cron enqueues `'run-retention'`; any job on this
 * queue triggers a full retention sweep (runRetentionJob is itself crash-safe).
 */
async function processRetention(job: Job) {
  logger.info('Processing retention job', { jobName: job.name, workerJobId: job.id })
  return runRetentionJob()
}

/**
 * Create and start the worker
 */
export const retentionWorker = new Worker('retention', processRetention, {
  connection,
  concurrency: 1, // Retention is a heavy, single-threaded sweep
})

// Worker event handlers
retentionWorker.on('completed', (job) => {
  logger.info('Retention job completed', { jobId: job.id })
})

retentionWorker.on('failed', (job, error) => {
  logger.error('Retention job failed', {
    jobId: job?.id,
    error,
    data: job?.data,
  })
})

retentionWorker.on('error', (error) => {
  logger.error('Retention worker error', { error })
})

logger.info('Retention worker started')
