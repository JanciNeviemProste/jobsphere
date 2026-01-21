import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { withCsrfProtection } from '@/lib/csrf'
import { z } from 'zod'

const updateRoleSchema = z.object({
  role: z.enum(['ORG_ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'AGENCY']),
})

async function patchHandler(request: Request, context?: { params?: Record<string, string> }) {
  const params = context?.params as { userId: string }
  if (!params?.userId) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  }

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
        { error: 'Forbidden - Only organization admins can update member roles' },
        { status: 403 },
      )
    }

    // Prevent user from changing their own role
    if (params.userId === session.user.id) {
      return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 })
    }

    const body = await request.json()
    const { role } = updateRoleSchema.parse(body)

    // Update the member's role
    const updated = await prisma.userOrgRole.update({
      where: {
        userId_orgId: {
          userId: params.userId,
          orgId: userOrgRole.orgId,
        },
      },
      data: { role },
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

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 },
      )
    }

    console.error('Error updating member role:', error)
    return NextResponse.json({ error: 'Failed to update member role' }, { status: 500 })
  }
}

async function deleteHandler(request: Request, context?: { params?: Record<string, string> }) {
  const params = context?.params as { userId: string }
  if (!params?.userId) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  }

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
        { error: 'Forbidden - Only organization admins can remove members' },
        { status: 403 },
      )
    }

    // Prevent user from removing themselves
    if (params.userId === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot remove yourself from the organization' },
        { status: 400 },
      )
    }

    // Check if member exists
    const member = await prisma.userOrgRole.findUnique({
      where: {
        userId_orgId: {
          userId: params.userId,
          orgId: userOrgRole.orgId,
        },
      },
    })

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Soft delete by setting deletedAt
    await prisma.userOrgRole.update({
      where: {
        userId_orgId: {
          userId: params.userId,
          orgId: userOrgRole.orgId,
        },
      },
      data: {
        deletedAt: new Date(),
      },
    })

    return NextResponse.json({ message: 'Member removed successfully' })
  } catch (error) {
    console.error('Error removing team member:', error)
    return NextResponse.json({ error: 'Failed to remove team member' }, { status: 500 })
  }
}

// Export handlers with CSRF protection
export const PATCH = withCsrfProtection(patchHandler)
export const DELETE = withCsrfProtection(deleteHandler)
