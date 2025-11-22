import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { errorResponse } from '@/lib/errors'
import { withRateLimit } from '@/lib/rate-limit'

// Increment job view count
export const POST = withRateLimit(
  async (req: Request, context?: { params?: Record<string, string> }) => {
    try {
      const params = context?.params
      if (!params?.id) {
        return NextResponse.json({ error: 'Missing job ID' }, { status: 400 })
      }

      logger.apiRequest('POST', `/api/jobs/${params.id}/view`)

      // Increment view count atomically
      const job = await prisma.job.update({
        where: {
          id: params.id,
          status: 'ACTIVE'
        },
        data: {
          views: {
            increment: 1
          }
        },
        select: {
          id: true,
          views: true
        }
      })

      logger.info(`Job view incremented`, { jobId: params.id, views: job.views })

      return NextResponse.json({ views: job.views })
    } catch (error) {
      // If job not found, return 404 but don't log as error
      if ((error as any)?.code === 'P2025') {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }

      logger.apiError('POST', `/api/jobs/[id]/view`, error)
      const errorData = errorResponse(error)
      return NextResponse.json(
        { error: errorData.error },
        { status: errorData.statusCode }
      )
    }
  },
  { preset: 'public' } // Allow public access for view tracking
)
