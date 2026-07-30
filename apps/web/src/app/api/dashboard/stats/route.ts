import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { errorResponse } from '@/lib/errors'
import { withRateLimit } from '@/lib/rate-limit'
import { requireAuth } from '@/lib/auth'

export const runtime = 'nodejs'

export const GET = withRateLimit(
  async (_req: Request) => {
    try {
      logger.apiRequest('GET', '/api/dashboard/stats')

      const session = await requireAuth()
      if (!session.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Fetch user, resume count, most recent resume skills and the application
      // stage histogram concurrently — these four queries are independent, so
      // Promise.all turns four serial round-trips to the DB into one.
      // Candidate is org-scoped (one per org per person); a user may have several.
      // Resolve everything via the canonical Candidate.userId link / relation filters.
      const userId = session.user.id
      const [user, resumeCount, firstResume, stageCounts] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true, avatar: true },
        }),
        prisma.resume.count({
          where: { candidate: { userId } },
        }),
        prisma.resume.findFirst({
          where: { candidate: { userId } },
          select: { skills: true },
          orderBy: { createdAt: 'desc' },
        }),
        // Counters come from a DB-side histogram instead of loading every
        // application row and filtering in JS.
        // `deletedAt: null` is explicit here on purpose: the soft-delete middleware
        // in lib/prisma.ts only patches findFirst/findMany/count, NOT groupBy, so
        // without it this would start counting soft-deleted applications.
        prisma.application.groupBy({
          by: ['stage'],
          where: { deletedAt: null, candidate: { userId } },
          _count: { _all: true },
        }),
      ])

      const countForStage = (stage: string) =>
        stageCounts.find((s) => s.stage === stage)?._count._all ?? 0

      const stats = {
        // Sum of every stage bucket — includes stages outside the canonical five,
        // exactly like the previous `applications.length`.
        total: stageCounts.reduce((sum, s) => sum + s._count._all, 0),
        pending: countForStage('NEW'),
        reviewing: countForStage('SCREENING') + countForStage('INTERVIEW'),
        accepted: countForStage('HIRED'),
        rejected: countForStage('REJECTED'),
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
      if (resumeCount > 0) {
        profileSteps.cvUploaded = true
        profileCompletion += 25
      }

      // Check skills (most recent resume across the user's candidates)
      const resume = firstResume

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
