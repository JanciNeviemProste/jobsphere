import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { hash } from 'bcryptjs'
import { logger } from '@/lib/logger'

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ORG_ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'AGENCY']),
})

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const userOrgRole = await prisma.userOrgRole.findFirst({
      where: { userId: session.user.id },
    })

    if (!userOrgRole) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get all team members
    const members = await prisma.userOrgRole.findMany({
      where: {
        orgId: userOrgRole.orgId,
        deletedAt: null,
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
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      members,
      currentUserRole: userOrgRole.role,
    })
  } catch (error) {
    logger.error('Error fetching team members:', error)
    return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 })
  }
}

export async function POST(request: Request) {
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
      const tempPassword =
        Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8)
      const hashedPassword = await hash(tempPassword, 10)

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
}
