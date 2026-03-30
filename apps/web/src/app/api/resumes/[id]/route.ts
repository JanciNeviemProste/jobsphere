/**
 * Resume Details API
 * Fetches resume details including candidate contact info
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export const GET = withRateLimit(
  async (req: Request, context?: { params?: Record<string, string> }) => {
    try {
      const session = await auth()

      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const resumeId = context?.params?.id
      if (!resumeId) {
        return NextResponse.json({ error: 'Missing resume ID' }, { status: 400 })
      }

      // Fetch resume with candidate contact info
      const resume = await prisma.resume.findUnique({
        where: { id: resumeId },
        include: {
          candidate: {
            include: {
              contacts: {
                where: { isPrimary: true },
                take: 1,
              },
            },
          },
        },
      })

      if (!resume) {
        return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
      }

      // Verify user has access via organization membership
      const membership = await prisma.userOrgRole.findFirst({
        where: { userId: session.user.id, orgId: resume.candidate.orgId },
      })
      if (!membership) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }

      return NextResponse.json(resume)
    } catch (error) {
      logger.error('Error fetching resume:', error)
      return NextResponse.json({ error: 'Failed to fetch resume' }, { status: 500 })
    }
  },
  { preset: 'api' },
)
