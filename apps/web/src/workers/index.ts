/**
 * Background Workers Entry Point
 * Starts all BullMQ workers for background job processing
 */

import { logger } from '@/lib/logger'
import { closeQueues } from '@/lib/queue'

// Import all workers (they self-register)
import { emailSequenceWorker } from './email-sequence.worker'
import { assessmentGradingWorker } from './assessment-grading.worker'
import { embeddingWorker } from './embedding.worker'

const workers = [emailSequenceWorker, assessmentGradingWorker, embeddingWorker]

logger.info('🚀 All workers started successfully', {
  workers: workers.map(w => w.name),
  timestamp: new Date().toISOString(),
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
