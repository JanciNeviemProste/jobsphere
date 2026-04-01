import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { errorResponse } from '@/lib/errors'
import { withRateLimit } from '@/lib/rate-limit'
import { requireAuth } from '@/lib/auth'

export const runtime = 'nodejs'

export const GET = withRateLimit(
  async (req: Request) => {
    try {
      logger.apiRequest('GET', '/api/dashboard/stats')

      const session = await requireAuth()
      if (!session.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Fetch user, candidate (with resume count and first resume skills),
      // and applications in parallel to avoid sequential N+1 queries
      const [user, candidate, applications] = await Promise.all([
        prisma.user.findUnique({
          where: { id: session.user.id },
        }),
        prisma.candidate.findFirst({
          where: { id: session.user.id },
          include: {
            _count: {
              select: {
                resumes: true,
              },
            },
            resumes: {
              select: { skills: true },
              take: 1,
            },
          },
        }),
        prisma.application.findMany({
          where: { candidateId: session.user.id },
          select: { stage: true },
        }),
      ])

      const stats = {
        total: applications.length,
        pending: applications.filter((a) => a.stage === 'NEW').length,
        reviewing: applications.filter((a) => a.stage === 'SCREENING' || a.stage === 'PHONE_SCREEN')
          .length,
        accepted: applications.filter((a) => a.stage === 'HIRED' || a.stage === 'OFFER').length,
        rejected: applications.filter((a) => a.stage === 'REJECTED').length,
      }

      // Calculate profile completion
      let profileCompletion = 0
      const profileSteps = {
        basicInfo: false,
        cvUploaded: false,
        skills: false,
        preferences: false,
      }

      // Check basic info (email always exists, check for name)
      if (user?.name) {
        profileSteps.basicInfo = true
        profileCompletion += 25
      }

      // Check CV uploaded
      if (candidate?._count.resumes && candidate._count.resumes > 0) {
        profileSteps.cvUploaded = true
        profileCompletion += 25
      }

      // Check skills (already fetched via include above)
      const resume = candidate?.resumes?.[0] ?? null

      if (resume?.skills && resume.skills.length > 0) {
        profileSteps.skills = true
        profileCompletion += 25
      }

      // Check preferences - for now, leave as not completed since these fields don't exist in schema
      // This could be extended later with actual preference fields
      profileSteps.preferences = false

      return NextResponse.json({
        user: {
          name: user?.name || 'User',
          email: user?.email || '',
          avatarUrl: user?.avatar,
        },
        stats,
        profileCompletion,
        profileSteps,
      })
    } catch (error) {
      logger.apiError('GET', '/api/dashboard/stats', error)
      const errorData = errorResponse(error)
      return NextResponse.json({ error: errorData.error }, { status: errorData.statusCode })
    }
  },
  { preset: 'api', byUser: true },
)
