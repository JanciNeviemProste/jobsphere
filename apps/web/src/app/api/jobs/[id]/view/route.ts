import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { errorResponse } from '@/lib/errors'
import { withRateLimit } from '@/lib/rate-limit'
import { withCsrfProtection } from '@/lib/csrf'

export const runtime = 'nodejs'

// Increment job view count
export const POST = withCsrfProtection(
  withRateLimit(
    async (req: Request, context?: { params?: Record<string, string> }) => {
      try {
        const params = context?.params
        if (!params?.id) {
          return NextResponse.json({ error: 'Missing job ID' }, { status: 400 })
        }

        logger.apiRequest('POST', `/api/jobs/${params.id}/view`)

        // Atomically increment the view counter for the published job. updateMany lets us
        // scope by status + soft-delete and tells us via `count` whether a row matched
        // (no throw when the job doesn't exist / isn't public).
        const result = await prisma.job.updateMany({
          where: {
            id: params.id,
            status: 'PUBLISHED',
            deletedAt: null,
          },
          data: {
            viewCount: { increment: 1 },
          },
        })

        if (result.count === 0) {
          return NextResponse.json({ error: 'Job not found' }, { status: 404 })
        }

        logger.info(`Job view tracked`, { jobId: params.id })

        return NextResponse.json({ success: true })
      } catch (error) {
        // If job not found, return 404 but don't log as error
        if ((error as any)?.code === 'P2025') {
          return NextResponse.json({ error: 'Job not found' }, { status: 404 })
        }

        logger.apiError('POST', `/api/jobs/[id]/view`, error)
        const errorData = errorResponse(error)
        return NextResponse.json({ error: errorData.error }, { status: errorData.statusCode })
      }
    },
    { preset: 'public' }, // Allow public access for view tracking
  ),
)
