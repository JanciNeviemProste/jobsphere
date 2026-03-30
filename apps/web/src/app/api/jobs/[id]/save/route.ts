import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { errorResponse } from '@/lib/errors'
import { withRateLimit } from '@/lib/rate-limit'
import { auth } from '@/lib/auth'

export const runtime = 'nodejs'

// Save or unsave a job (toggle)
export const POST = withRateLimit(
  async (req: Request, context?: { params?: Record<string, string> }) => {
    try {
      const params = context?.params
      if (!params?.id) {
        return NextResponse.json({ error: 'Missing job ID' }, { status: 400 })
      }

      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      logger.apiRequest('POST', `/api/jobs/${params.id}/save`)

      // Check if job exists and is active
      const job = await prisma.job.findUnique({
        where: {
          id: params.id,
          status: 'PUBLISHED',
        },
      })

      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }

      // Check if already saved
      const existingSave = await prisma.savedJob.findUnique({
        where: {
          userId_jobId: {
            userId: session.user.id,
            jobId: params.id,
          },
        },
      })

      if (existingSave) {
        // Unsave the job
        await prisma.savedJob.delete({
          where: { id: existingSave.id },
        })

        logger.info('Job unsaved', { jobId: params.id, userId: session.user.id })
        return NextResponse.json({ saved: false, message: 'Job removed from favorites' })
      } else {
        // Save the job
        await prisma.savedJob.create({
          data: {
            jobId: params.id,
            userId: session.user.id,
          },
        })

        logger.info('Job saved', { jobId: params.id, userId: session.user.id })
        return NextResponse.json({ saved: true, message: 'Job added to favorites' })
      }
    } catch (error) {
      logger.apiError('POST', `/api/jobs/[id]/save`, error)
      const errorData = errorResponse(error)
      return NextResponse.json({ error: errorData.error }, { status: errorData.statusCode })
    }
  },
  { preset: 'api', byUser: true },
)

// Check if job is saved
export const GET = withRateLimit(
  async (req: Request, context?: { params?: Record<string, string> }) => {
    try {
      const params = context?.params
      if (!params?.id) {
        return NextResponse.json({ error: 'Missing job ID' }, { status: 400 })
      }

      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json({ saved: false })
      }

      const savedJob = await prisma.savedJob.findUnique({
        where: {
          userId_jobId: {
            userId: session.user.id,
            jobId: params.id,
          },
        },
      })

      return NextResponse.json({ saved: !!savedJob })
    } catch (error) {
      logger.apiError('GET', `/api/jobs/[id]/save`, error)
      return NextResponse.json({ saved: false })
    }
  },
  { preset: 'public' },
)
