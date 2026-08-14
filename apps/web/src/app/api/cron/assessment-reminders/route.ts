/**
 * Assessment reminders, on a schedule.
 *
 * Daily: nudge candidates whose invite has been sitting untouched for two days.
 * The invite selection matches `runAssessmentReminderJob` exactly, so this path
 * and the queue path pick the same invites; the difference is that this one
 * actually sends, rather than enqueueing to a queue nobody drains.
 */

import { NextResponse } from 'next/server'
import { runAssessmentRemindersInline } from '@/lib/jobs/run-inline'
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
      const result = await runAssessmentRemindersInline()
      return NextResponse.json({ ok: true, ...result })
    } catch (error) {
      logger.error('Assessment reminder cron route failed', { error })
      return NextResponse.json(
        { ok: false, error: 'Assessment reminder run failed' },
        { status: 500 },
      )
    }
  },
  { preset: 'strict' },
)
