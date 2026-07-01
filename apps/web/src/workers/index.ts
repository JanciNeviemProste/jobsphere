/**
 * Background Workers Entry Point
 * Starts all BullMQ workers for background job processing
 */

import { logger } from '@/lib/logger'
import { closeQueues } from '@/lib/queue'
import { initializeCronJobs } from '@/lib/cron'

// Import all workers (they self-register)
import { emailSequenceWorker } from './email-sequence.worker'
import { assessmentGradingWorker } from './assessment-grading.worker'
import { embeddingWorker } from './embedding.worker'
import { assessmentReminderWorker } from './assessment-reminder.worker'
import { matchScoreCacheWorker } from './match-score-cache.worker'
import { retentionWorker } from './retention.worker'
import { scraperWorker } from './scraper.worker'

const workers = [
  emailSequenceWorker,
  assessmentGradingWorker,
  embeddingWorker,
  assessmentReminderWorker,
  matchScoreCacheWorker,
  retentionWorker,
  scraperWorker,
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
