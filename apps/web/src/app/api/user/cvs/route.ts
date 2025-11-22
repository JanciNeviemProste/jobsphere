import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { errorResponse } from '@/lib/errors'
import { withRateLimit } from '@/lib/rate-limit'
import { requireAuth } from '@/lib/auth'

export const GET = withRateLimit(
  async (req: Request) => {
    try {
      logger.apiRequest('GET', '/api/user/cvs')

      const session = await requireAuth()
      if (!session.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Fetch user's resumes
      const resumes = await prisma.resume.findMany({
        where: {
          candidateId: session.user.id,
        },
        select: {
          id: true,
          title: true,
          createdAt: true,
          isDefault: true,
          anonymized: false,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      // Format for frontend
      const cvs = resumes.map(resume => ({
        id: resume.id,
        title: resume.title || 'Untitled CV',
        uploadedAt: resume.createdAt.toLocaleDateString(),
        isDefault: resume.isDefault,
      }))

      return NextResponse.json(cvs)
    } catch (error) {
      logger.apiError('GET', '/api/user/cvs', error)
      const errorData = errorResponse(error)
      return NextResponse.json(
        { error: errorData.error },
        { status: errorData.statusCode }
      )
    }
  },
  { preset: 'api', byUser: true }
)