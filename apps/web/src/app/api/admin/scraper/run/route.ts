import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireGlobalAdmin } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/errors'
import { withCsrfProtection } from '@/lib/csrf'
import { withRateLimit } from '@/lib/rate-limit'
import { addScraperJob } from '@/lib/queue'

export const runtime = 'nodejs'

const runScraperSchema = z.object({
  source: z.string().max(50).optional(),
  url: z.string().url().max(500).optional(),
})

/**
 * POST /api/admin/scraper/run — superadmin manually enqueues a scrape pass.
 * The actual import is consent-gated + rate-limited inside the worker; this
 * endpoint only queues the job (no-op if Redis is not configured).
 */
export const POST = withCsrfProtection(
  withRateLimit(
    async (req: Request) => {
      try {
        const session = await requireGlobalAdmin()
        if (!session) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await req.json().catch(() => ({}))
        const data = runScraperSchema.parse(body ?? {})

        const job = await addScraperJob({ source: data.source, url: data.url })

        logger.info(`Admin queued scraper run by ${session.user.id}`, { queued: Boolean(job) })
        return NextResponse.json({
          queued: Boolean(job),
          message: job
            ? 'Scraper run queued'
            : 'Scraper not queued — background queue (REDIS_URL) is not configured',
        })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: 'Validation failed', issues: error.issues },
            { status: 400 },
          )
        }
        logger.error('Admin POST /scraper/run error:', error)
        return handleApiError(error)
      }
    },
    { preset: 'api' },
  ),
)
