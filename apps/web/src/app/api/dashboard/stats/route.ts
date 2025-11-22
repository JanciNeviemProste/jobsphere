import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { errorResponse } from '@/lib/errors'
import { withRateLimit } from '@/lib/rate-limit'
import { requireAuth } from '@/lib/auth'

export const GET = withRateLimit(
  async (req: Request) => {
    try {
      logger.apiRequest('GET', '/api/dashboard/stats')

      const session = await requireAuth()
      if (!session.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Get user profile with resume count
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          _count: {
            select: {
              resumes: true
            }
          }
        }
      })

      // Get application statistics
      const applications = await prisma.application.findMany({
        where: { candidateId: session.user.id },
        select: { status: true }
      })

      const stats = {
        total: applications.length,
        pending: applications.filter(a => a.status === 'PENDING').length,
        reviewing: applications.filter(a => a.status === 'REVIEWING').length,
        accepted: applications.filter(a => a.status === 'ACCEPTED').length,
        rejected: applications.filter(a => a.status === 'REJECTED').length,
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
      if (user?._count.resumes && user._count.resumes > 0) {
        profileSteps.cvUploaded = true
        profileCompletion += 25
      }

      // Check skills (stored in resume or user preferences)
      const resume = await prisma.resume.findFirst({
        where: { candidateId: session.user.id },
        select: {
          sections: {
            where: { kind: 'skills' },
            take: 1
          }
        }
      })

      if (resume?.sections.length > 0) {
        profileSteps.skills = true
        profileCompletion += 25
      }

      // Check preferences (stored in user profile)
      if (user?.preferredLocations || user?.preferredSalaryMin) {
        profileSteps.preferences = true
        profileCompletion += 25
      }

      return NextResponse.json({
        user: {
          name: user?.name || 'User',
          email: user?.email || '',
          avatarUrl: user?.avatarUrl
        },
        stats,
        profileCompletion,
        profileSteps
      })
    } catch (error) {
      logger.apiError('GET', '/api/dashboard/stats', error)
      const errorData = errorResponse(error)
      return NextResponse.json(
        { error: errorData.error },
        { status: errorData.statusCode }
      )
    }
  },
  { preset: 'api', byUser: true }
)