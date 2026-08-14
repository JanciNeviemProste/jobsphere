/**
 * GDPR retention, on a schedule.
 *
 * This is the one that matters most. `runRetentionJob` hard-erases candidates
 * that were soft-deleted past the retention window (Article 17) and strips PII
 * from audit logs older than the audit window (Article 5(1)(e)). It was wired to
 * a BullMQ repeatable job that no process has ever consumed, because Vercel is
 * serverless and cannot host a worker — so the erasures were scheduled, logged
 * as scheduled, and never happened.
 *
 * `runRetentionJob` needs no queue: it reads and writes the database directly.
 * Calling it from a cron route is not a workaround, it is the whole job.
 */

import { NextResponse } from 'next/server'
import { runRetentionJob } from '@/lib/cron'
import { requireCronAuth, CronAuthError } from '@/lib/jobs/cron-auth'
import { withRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

// Erasing a batch of candidates and everything cascading from them is the
// longest-running thing this app does on a timer.
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
      const result = await runRetentionJob()
      return NextResponse.json({ ok: true, ...result })
    } catch (error) {
      // runRetentionJob swallows per-phase failures and returns counts, so
      // reaching here means something outside both phases broke.
      logger.error('Retention cron route failed', { error })
      return NextResponse.json({ ok: false, error: 'Retention run failed' }, { status: 500 })
    }
  },
  { preset: 'strict' },
)
