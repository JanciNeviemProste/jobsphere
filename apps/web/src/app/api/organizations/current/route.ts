import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { withRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const GET = withRateLimit(
  async () => {
    try {
      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Get user's organization
      const userOrgRole = await prisma.userOrgRole.findFirst({
        where: { userId: session.user.id },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              logo: true,
              website: true,
              description: true,
              industry: true,
              size: true,
              slug: true,
            },
          },
        },
      })

      if (!userOrgRole) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
      }

      return NextResponse.json(userOrgRole.organization)
    } catch (error) {
      logger.error('Error fetching organization:', error)
      return NextResponse.json({ error: 'Failed to fetch organization' }, { status: 500 })
    }
  },
  { preset: 'api', byUser: true },
)
