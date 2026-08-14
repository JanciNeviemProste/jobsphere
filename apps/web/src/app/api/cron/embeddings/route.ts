/**
 * Embedding backfill, on a schedule.
 *
 * Hourly, in small batches. Every CV and job posted since launch is missing its
 * vector, because generation was enqueued to a queue with no consumer — and a
 * missing embedding throws nothing, it just makes semantic search silently blind
 * to that record.
 *
 * Each item is a paid API call, so the batch is deliberately small (25 + 25).
 * The response reports `remaining`, which is how you can tell whether the
 * backlog is draining or growing.
 */

import { NextResponse } from 'next/server'
import { runEmbeddingBackfill } from '@/lib/jobs/run-inline'
import { requireCronAuth, CronAuthError } from '@/lib/jobs/cron-auth'
import { withRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 300

export const GET = withRateLimit(
  async (request: Request) => {
    try {
      requireCronAuth(request)
    } catch (error) {
      if (error instanceof CronAuthError) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      throw error
    }

    try {
      const result = await runEmbeddingBackfill()
      return NextResponse.json({ ok: true, ...result })
    } catch (error) {
      logger.error('Embedding backfill cron route failed', { error })
      return NextResponse.json({ ok: false, error: 'Embedding backfill failed' }, { status: 500 })
    }
  },
  { preset: 'strict' },
)
