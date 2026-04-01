import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateBulkMatchScores } from '@/lib/ai-matching'
import { logger } from '@/lib/logger'
import { errorResponse } from '@/lib/errors'
import { withRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export const GET = withRateLimit(
  async (req: NextRequest, context?: { params?: Record<string, string> }) => {
    try {
      const candidateId = context?.params?.id
      if (!candidateId) {
        return NextResponse.json({ error: 'Candidate ID is required' }, { status: 400 })
      }

      logger.apiRequest('GET', `/api/candidates/${candidateId}/match-scores`)

      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Get candidate and verify access
      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
        include: {
          resumes: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      })

      if (!candidate) {
        return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
      }

      if (!candidate.resumes[0]) {
        return NextResponse.json({ error: 'No resume found for candidate' }, { status: 404 })
      }

      // Verify user has access to this candidate's organization
      const membership = await prisma.userOrgRole.findFirst({
        where: {
          userId: session.user.id,
          orgId: candidate.orgId,
        },
      })

      if (!membership) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }

      // Get all open jobs for the organization
      const jobs = await prisma.job.findMany({
        where: {
          orgId: candidate.orgId,
          status: 'PUBLISHED',
        },
        select: {
          id: true,
          title: true,
          city: true,
          salaryMin: true,
          salaryMax: true,
          remote: true,
          hybrid: true,
          employmentType: true,
          seniority: true,
        },
      })

      if (jobs.length === 0) {
        return NextResponse.json({ scores: [] })
      }

      // Calculate match scores using existing AI matching logic
      const scoresMap = await calculateBulkMatchScores(
        candidate.resumes[0].id,
        jobs.map((j) => j.id),
      )

      // Convert Map to array and enrich with job details
      const enrichedScores = Array.from(scoresMap.entries()).map(([jobId, score]) => {
        const job = jobs.find((j) => j.id === jobId)
        return {
          jobId,
          matchScore: score.overall,
          bm25Score: score.skills, // Using skills as a proxy for keyword matching
          vectorScore: (score.experience + score.education) / 2, // Composite score
          llmScore: score.overall, // Overall as LLM-like score
          explanation: `Skills: ${score.skills}%, Experience: ${score.experience}%, Education: ${score.education}%`,
          job: job || null,
        }
      })

      // Sort by match score descending
      enrichedScores.sort((a, b) => b.matchScore - a.matchScore)

      return NextResponse.json({ scores: enrichedScores })
    } catch (error) {
      const candidateId = context?.params?.id || 'unknown'
      logger.apiError('GET', `/api/candidates/${candidateId}/match-scores`, error)
      const errorData = errorResponse(error)
      return NextResponse.json({ error: errorData.error }, { status: errorData.statusCode })
    }
  },
  { preset: 'api', byUser: true },
)
