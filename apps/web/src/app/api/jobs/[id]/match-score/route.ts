import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { errorResponse } from '@/lib/errors'
import { withRateLimit } from '@/lib/rate-limit'
import { requireAuth } from '@/lib/auth'
import { calculateMatchScore } from '@/lib/ai-matching'

export const GET = withRateLimit(
  async (req: Request, { params }: { params: { id: string } }) => {
    try {
      logger.apiRequest('GET', `/api/jobs/${params.id}/match-score`)

      const session = await requireAuth()
      if (!session.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Get user's default resume
      const resume = await prisma.resume.findFirst({
        where: {
          candidateId: session.user.id,
          isDefault: true
        }
      })

      if (!resume) {
        return NextResponse.json(
          { error: 'No default resume found. Please upload a CV first.' },
          { status: 400 }
        )
      }

      // Check if job exists
      const job = await prisma.job.findUnique({
        where: {
          id: params.id,
          status: 'PUBLISHED'
        }
      })

      if (!job) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        )
      }

      // Calculate match score
      const matchScore = await calculateMatchScore(resume.id, params.id)

      logger.info(`Match score calculated for job ${params.id}`, {
        userId: session.user.id,
        score: matchScore.overall
      })

      return NextResponse.json({
        jobId: params.id,
        resumeId: resume.id,
        matchScore
      })
    } catch (error) {
      logger.apiError('GET', `/api/jobs/${params.id}/match-score`, error)
      const errorData = errorResponse(error)
      return NextResponse.json(
        { error: errorData.error },
        { status: errorData.statusCode }
      )
    }
  },
  { preset: 'api', byUser: true }
)