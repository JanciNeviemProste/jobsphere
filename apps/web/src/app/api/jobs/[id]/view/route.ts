import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { errorResponse } from '@/lib/errors'
import { withRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// Increment job view count
export const POST = withRateLimit(
  async (req: Request, context?: { params?: Record<string, string> }) => {
    try {
      const params = context?.params
      if (!params?.id) {
        return NextResponse.json({ error: 'Missing job ID' }, { status: 400 })
      }

      logger.apiRequest('POST', `/api/jobs/${params.id}/view`)

      // Verify job exists and is active
      const job = await prisma.job.findUnique({
        where: {
          id: params.id,
          status: 'PUBLISHED',
        },
        select: {
          id: true,
        },
      })

      if (!job) {
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
)
