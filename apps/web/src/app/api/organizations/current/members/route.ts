import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { hash } from 'bcryptjs'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limit'
import { withCsrfProtection } from '@/lib/csrf'

export const runtime = 'nodejs'

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ORG_ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'AGENCY']),
})

export const GET = withRateLimit(
  async function GET(request: Request) {
    try {
      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Parse pagination params
      const { searchParams } = new URL(request.url)
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
      const limit = Math.min(
        100,
        Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50),
      )
      const skip = (page - 1) * limit

      // Get user's organization
      const userOrgRole = await prisma.userOrgRole.findFirst({
        where: { userId: session.user.id },
      })

      if (!userOrgRole) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
      }

      // Get paginated team members and total count in parallel
      const where = {
        orgId: userOrgRole.orgId,
        deletedAt: null,
      }

      const members = await prisma.userOrgRole.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip,
      })
      const total = await prisma.userOrgRole.count({ where })

      return NextResponse.json({
        members,
        currentUserRole: userOrgRole.role,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    } catch (error) {
      logger.error('Error fetching team members:', error)
      return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 })
    }
  },
  { preset: 'api' },
)

export const POST = withCsrfProtection(
  withRateLimit(
    async function POST(request: Request) {
      try {
        const session = await auth()
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get user's organization and verify admin role
        const userOrgRole = await prisma.userOrgRole.findFirst({
          where: {
            userId: session.user.id,
            role: 'ORG_ADMIN',
          },
        })

        if (!userOrgRole) {
          return NextResponse.json(
            { error: 'Forbidden - Only organization admins can invite members' },
            { status: 403 },
          )
        }

        const body = await request.json()
        const { email, role } = inviteMemberSchema.parse(body)

        // Check if user already exists
        let user = await prisma.user.findUnique({
          where: { email },
        })

        // If user doesn't exist, create a new user account
        if (!user) {
          // Generate a random temporary password
          const tempPassword = require('crypto').randomBytes(16).toString('hex')
          const hashedPassword = await hash(tempPassword, 12)

          user = await prisma.user.create({
            data: {
              email,
              password: hashedPassword,
              name: email.split('@')[0], // Use email prefix as default name
            },
          })

          // TODO: Send invitation email with temporary password or magic link
          // This would be implemented with your email service
        }

        // Check if user is already a member
        const existingMember = await prisma.userOrgRole.findUnique({
          where: {
            userId_orgId: {
              userId: user.id,
              orgId: userOrgRole.orgId,
            },
          },
        })

        if (existingMember) {
          return NextResponse.json(
            { error: 'User is already a member of this organization' },
            { status: 400 },
          )
        }

        // Create organization membership
        const newMember = await prisma.userOrgRole.create({
          data: {
            userId: user.id,
            orgId: userOrgRole.orgId,
            role,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        })

        // TODO: Send notification email to the invited user
        // You would implement this with your email service configured in the project

        return NextResponse.json({
          member: newMember,
          message: 'Member invited successfully',
        })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: 'Invalid request data', details: error.errors },
            { status: 400 },
          )
        }

        logger.error('Error inviting team member:', error)
        return NextResponse.json({ error: 'Failed to invite team member' }, { status: 500 })
      }
    },
    { preset: 'strict', byUser: true },
  ),
)
