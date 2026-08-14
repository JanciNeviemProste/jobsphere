/**
 * Profesia Scraper Worker (L65)
 * Consumes the 'scraper' queue (repeatable `scan-profesia` cron job + manual
 * admin triggers) and runs the consent-gated, rate-limited Profesia import.
 *
 * The heavy lifting (fetch, parse, dedup upsert, consent gate, robots
 * politeness) lives in lib/scrapers/profesia-import.ts so it is unit-testable
 * without a Redis connection.
 */

import { Worker, Job } from 'bullmq'
import { connection, ScraperJobData } from '@/lib/queue'
import { logger } from '@/lib/logger'
import { processScrape } from '@/lib/scrapers/profesia-import'

/**
 * Single-concurrency + a low per-minute limiter: the import itself already
 * spaces individual HTTP requests, and this caps how often a run can start.
 */
export function createScraperWorker() {
  const worker = new Worker<ScraperJobData>(
    'scraper',
    async (job: Job<ScraperJobData>) => processScrape(job),
    {
      connection,
      concurrency: 1,
      limiter: {
        max: 2, // at most 2 scrape runs per minute
        duration: 60000,
      },
    },
  )

  worker.on('completed', (job) => {
    logger.info('Scraper job completed', { jobId: job.id })
  })

  worker.on('failed', (job, error) => {
    logger.error('Scraper job failed', { jobId: job?.id, error, data: job?.data })
  })

  worker.on('error', (error) => {
    logger.error('Scraper worker error', { error })
  })

  logger.info('Scraper worker started')
  return worker
}
