import { Worker, Queue, QueueEvents } from 'bullmq'
import Redis from 'ioredis'
import { parseCvWorker } from './workers/parseCv'
import { embedChunksWorker } from './workers/embedChunks'
import { emailSyncWorker } from './workers/emailSync'
import { emailSequencesWorker } from './workers/emailSequences'
import { assessmentGradingWorker } from './workers/assessmentGrading'
import { stripeWebhooksWorker } from './workers/stripeWebhooks'
import { retentionWorker } from './workers/retention'

// Redis connection
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

// Worker configurations
const workerConfig = {
  connection,
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
}

// Create workers
const workers = [
  new Worker('parseCv', parseCvWorker, workerConfig),
  new Worker('embedChunks', embedChunksWorker, workerConfig),
  new Worker('emailSync', emailSyncWorker, workerConfig),
  new Worker('emailSequences', emailSequencesWorker, workerConfig),
  new Worker('assessmentGrading', assessmentGradingWorker, workerConfig),
  new Worker('stripeWebhooks', stripeWebhooksWorker, workerConfig),
  new Worker('retention', retentionWorker, { ...workerConfig, concurrency: 1 }), // Run serially
]

// Export queues for adding jobs
export const queues = {
  parseCv: new Queue('parseCv', { connection }),
  embedChunks: new Queue('embedChunks', { connection }),
  emailSync: new Queue('emailSync', { connection }),
  emailSequences: new Queue('emailSequences', { connection }),
  assessmentGrading: new Queue('assessmentGrading', { connection }),
  stripeWebhooks: new Queue('stripeWebhooks', { connection }),
  retention: new Queue('retention', { connection }),
}

// Event listeners
workers.forEach((worker) => {
  worker.on('completed', (job) => {
    console.log(`✅ [${worker.name}] Job ${job.id} completed`)
  })

  worker.on('failed', (job, err) => {
    console.error(`❌ [${worker.name}] Job ${job?.id} failed:`, err)
  })

  worker.on('error', (err) => {
    console.error(`🔥 [${worker.name}] Worker error:`, err)
  })
})

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down workers...')

  await Promise.all(workers.map((w) => w.close()))
  await Promise.all(Object.values(queues).map((q) => q.close()))
  await connection.quit()

  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

console.log('🚀 Workers started successfully')
console.log(`Running ${workers.length} workers with concurrency ${workerConfig.concurrency}`)
workers.forEach((w) => console.log(`  - ${w.name}`))