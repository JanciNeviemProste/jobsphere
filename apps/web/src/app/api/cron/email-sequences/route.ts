/**
 * Drip campaigns, on a schedule.
 *
 * Every 15 minutes: advance each active sequence run by one step. The step
 * processor enforces the due date, the skip conditions and send-deduplication
 * itself, so a run that is not due yet costs a cheap no-op rather than a
 * duplicate email — which is what makes a fixed tick safe here.
 */

import { NextResponse } from 'next/server'
import { runEmailSequencesInline } from '@/lib/jobs/run-inline'
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
      const result = await runEmailSequencesInline()
      return NextResponse.json({ ok: true, ...result })
    } catch (error) {
      logger.error('Email sequence cron route failed', { error })
      return NextResponse.json({ ok: false, error: 'Email sequence run failed' }, { status: 500 })
    }
  },
  { preset: 'strict' },
)
