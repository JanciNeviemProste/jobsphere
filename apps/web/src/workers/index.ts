/**
 * Background Workers Entry Point
 * Starts all BullMQ workers for background job processing
 */

import { logger } from '@/lib/logger'
import { closeQueues } from '@/lib/queue'
import { initializeCronJobs } from '@/lib/cron'

// Workers are constructed here rather than on import. Constructing one opens a
// Redis connection, and these modules are also imported by serverless code paths
// (the /api/cron routes reuse their processors) which must not dial Redis just
// to pull a function out of the module.
import { createEmailSequenceWorker } from './email-sequence.worker'
import { createAssessmentGradingWorker } from './assessment-grading.worker'
import { createEmbeddingWorker } from './embedding.worker'
import { createAssessmentReminderWorker } from './assessment-reminder.worker'
import { createMatchScoreCacheWorker } from './match-score-cache.worker'
import { createRetentionWorker } from './retention.worker'
import { createScraperWorker } from './scraper.worker'

const workers = [
  createEmailSequenceWorker(),
  createAssessmentGradingWorker(),
  createEmbeddingWorker(),
  createAssessmentReminderWorker(),
  createMatchScoreCacheWorker(),
  createRetentionWorker(),
  createScraperWorker(),
]

logger.info('🚀 All workers started successfully', {
  workers: workers.map((w) => w.name),
  timestamp: new Date().toISOString(),
})

// Schedule cron repeatable jobs (assessment reminders, email sequences, retention).
// Done after workers are constructed so the queues/connection exist and the
// repeatable jobs are immediately picked up by the running workers.
void initializeCronJobs().catch((error) => {
  logger.error('Failed to initialize cron jobs on worker startup', { error })
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down workers gracefully...')

  for (const worker of workers) {
    await worker.close()
  }

  await closeQueues()
  logger.info('All workers shut down')
  process.exit(0)
})

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down workers gracefully...')

  for (const worker of workers) {
    await worker.close()
  }

  await closeQueues()
  logger.info('All workers shut down')
  process.exit(0)
})

// Keep process alive
process.stdin.resume()
