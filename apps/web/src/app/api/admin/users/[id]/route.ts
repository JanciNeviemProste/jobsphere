/**
 * Admin User Detail API
 * Fetch detail and soft-delete a specific user.
 * All endpoints require isGlobalAdmin.
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { withCsrfProtection } from '@/lib/csrf'
import { withRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

async function requireGlobalAdmin() {
  const session = await auth()
  if (!session?.user?.isGlobalAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return session
}

/**
 * GET /api/admin/users/[id]
 * Returns full user detail including organizations, application count and last 10 audit logs.
 */
const getUserDetail = async (_req: Request, context?: { params?: Record<string, string> }) => {
  const params = context?.params as { id: string }
  if (!params?.id) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  }
  const authResult = await requireGlobalAdmin()
  if (authResult instanceof NextResponse) return authResult

  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        phone: true,
        locale: true,
        timezone: true,
        emailVerified: true,
        isGlobalAdmin: true,
        lockedUntil: true,
        failedAttempts: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
        updatedAt: true,
        organizations: {
          where: { deletedAt: null },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        _count: {
          select: { assignedApps: true },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            action: true,
            entityType: true,
            entityId: true,
            ipAddress: true,
            createdAt: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    logger.info('Admin: viewed user detail', { adminId: authResult.user.id, targetId: params.id })

    return NextResponse.json({ user })
  } catch (error) {
    logger.error('Admin GET /users/[id] failed', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Soft-deletes a user by setting deletedAt. Cannot delete yourself or another admin.
 */
export const DELETE = withCsrfProtection(
  withRateLimit(
    async (_req: Request, context?: { params?: Record<string, string> }) => {
      const params = context?.params as { id: string }
      if (!params?.id) {
        return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
      }
      const authResult = await requireGlobalAdmin()
      if (authResult instanceof NextResponse) return authResult

      try {
        if (params.id === authResult.user.id) {
          return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
        }

        const target = await prisma.user.findUnique({
          where: { id: params.id },
          select: { id: true, isGlobalAdmin: true, deletedAt: true },
        })

        if (!target || target.deletedAt !== null) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        if (target.isGlobalAdmin) {
          return NextResponse.json(
            { error: 'Cannot delete a global admin. Demote first.' },
            { status: 400 },
          )
        }

        await prisma.user.update({
          where: { id: params.id },
          data: { deletedAt: new Date() },
        })

        logger.info('Admin: soft-deleted user', {
          adminId: authResult.user.id,
          targetId: params.id,
        })

        return NextResponse.json({ success: true })
      } catch (error) {
        logger.error('Admin DELETE /users/[id] failed', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
    { preset: 'api' },
  ),
)

// Rate limiting was missing on this handler until the route wrapper contract
// test (tests/security/route-wrapper-contract.test.ts) enumerated the API surface.
export const GET = withRateLimit(getUserDetail, { preset: 'api', byUser: true })
