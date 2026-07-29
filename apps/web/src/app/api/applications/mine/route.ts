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
      logger.apiRequest('GET', '/api/applications/mine')

      const session = await requireAuth()
      if (!session.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Fetch user's applications with job and organization details.
      // Applications are owned via Candidate.userId (NOT candidateId == user.id).
      const applications = await prisma.application.findMany({
        where: {
          candidate: { userId: session.user.id },
        },
        include: {
          job: {
            include: {
              organization: {
                select: {
                  name: true,
                  logo: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 20, // Limit to recent 20 applications for dashboard
      })

      // Format applications for frontend
      const formattedApplications = applications.map((app) => ({
        id: app.id,
        jobTitle: app.job.title,
        company: app.job.organization.name,
        companyLogo: app.job.organization.logo,
        status: app.stage,
        appliedAt: app.createdAt.toISOString(),
        location: app.job.city,
        jobId: app.job.id,
      }))

      return NextResponse.json(formattedApplications)
    } catch (error) {
      logger.apiError('GET', '/api/applications/mine', error)
      const errorData = errorResponse(error)
      return NextResponse.json({ error: errorData.error }, { status: errorData.statusCode })
    }
  },
  { preset: 'api', byUser: true },
)
