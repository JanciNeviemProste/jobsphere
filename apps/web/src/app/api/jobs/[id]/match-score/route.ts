import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { errorResponse } from '@/lib/errors'
import { withRateLimit } from '@/lib/rate-limit'
import { requireAuth } from '@/lib/auth'
import { calculateMatchScore } from '@/lib/ai-matching'

export const runtime = 'nodejs'

export const GET = withRateLimit(
  async (req: Request, context?: { params?: Record<string, string> }) => {
    try {
      const params = context?.params
      if (!params?.id) {
        return NextResponse.json({ error: 'Missing job ID' }, { status: 400 })
      }

      logger.apiRequest('GET', `/api/jobs/${params.id}/match-score`)

      const session = await requireAuth()
      if (!session.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Get user's candidate and their first resume. Resolve via the canonical
      // Candidate.userId link (the previous `orgId: session.user.id` compared the
      // org column against a User id and always returned null).
      const candidate = await prisma.candidate.findFirst({
        where: { userId: session.user.id, deletedAt: null },
      })

      if (!candidate) {
        return NextResponse.json({ error: 'Candidate profile not found' }, { status: 404 })
      }

      const resume = await prisma.resume.findFirst({
        where: {
          candidateId: candidate.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      if (!resume) {
        return NextResponse.json(
          { error: 'No default resume found. Please upload a CV first.' },
          { status: 400 },
        )
      }

      // Check if job exists
      const job = await prisma.job.findUnique({
        where: {
          id: params.id,
          status: 'PUBLISHED',
        },
      })

      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }

      // Calculate match score
      const matchScore = await calculateMatchScore(resume.id, params.id)

      logger.info(`Match score calculated for job ${params.id}`, {
        userId: session.user.id,
        score: matchScore.overall,
      })

      return NextResponse.json({
        jobId: params.id,
        resumeId: resume.id,
        matchScore,
      })
    } catch (error) {
      logger.apiError('GET', `/api/jobs/[id]/match-score`, error)
      const errorData = errorResponse(error)
      return NextResponse.json({ error: errorData.error }, { status: errorData.statusCode })
    }
  },
  { preset: 'api', byUser: true },
)
