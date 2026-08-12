/**
 * Admin User Detail API
 * Fetch detail and soft-delete a specific user.
 * All endpoints require isGlobalAdmin.
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { createAuditLog, getRequestMetadata } from '@/lib/audit-log'
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
const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  locale: z.string().max(10).optional(),
})

/**
 * Edit a user's profile from the admin panel.
 *
 * There was no way to change anything about a user except banning, promoting and
 * deleting them — not even a typo in a name. `User.phone` has existed in the
 * schema with no editor anywhere.
 *
 * `email` is deliberately absent. It is the login identifier, it carries a
 * unique constraint, and changing it means handling the collision, invalidating
 * sessions and re-running verification — otherwise an admin fixing a typo
 * silently creates an account nobody can sign in to. That belongs in its own
 * change with its own tests, not smuggled into a profile PATCH.
 */
export const PATCH = withCsrfProtection(
  withRateLimit(
    async (req: Request, context?: { params?: Record<string, string> }) => {
      const params = context?.params
      if (!params?.id) {
        return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
      }

      const authResult = await requireGlobalAdmin()
      if (authResult instanceof NextResponse) return authResult

      try {
        const data = updateUserSchema.parse(await req.json())

        const target = await prisma.user.findUnique({
          where: { id: params.id },
          select: { id: true, name: true, phone: true, locale: true, deletedAt: true },
        })

        if (!target || target.deletedAt !== null) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const updated = await prisma.user.update({
          where: { id: params.id },
          data: {
            ...(data.name !== undefined && { name: data.name }),
            ...(data.phone !== undefined && { phone: data.phone }),
            ...(data.locale !== undefined && { locale: data.locale }),
          },
          select: { id: true, name: true, email: true, phone: true, locale: true },
        })

        logger.info('Admin: updated user profile', {
          adminId: authResult.user.id,
          targetId: params.id,
        })

        await createAuditLog({
          userId: authResult.user.id,
          action: 'USER_UPDATED',
          resource: 'USER',
          resourceId: params.id,
          previous: { name: target.name, phone: target.phone, locale: target.locale },
          metadata: { name: updated.name, phone: updated.phone, locale: updated.locale },
          ...getRequestMetadata(req),
        })

        return NextResponse.json({ user: updated })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: 'Invalid request', issues: error.issues },
            { status: 400 },
          )
        }
        logger.error('Admin PATCH /users/[id] failed', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
    { preset: 'api', byUser: true },
  ),
)

export const DELETE = withCsrfProtection(
  withRateLimit(
    async (req: Request, context?: { params?: Record<string, string> }) => {
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
          // sessionEpoch bumped as well. Without it a soft-deleted user keeps a
          // valid JWT until it expires on its own — `ban` on the sibling route
          // has always done this, so deleting an account was the weaker of the
          // two ways to lock someone out.
          data: { deletedAt: new Date(), sessionEpoch: { increment: 1 } },
        })

        logger.info('Admin: soft-deleted user', {
          adminId: authResult.user.id,
          targetId: params.id,
        })

        await createAuditLog({
          userId: authResult.user.id,
          action: 'USER_DELETED',
          resource: 'USER',
          resourceId: params.id,
          previous: { deletedAt: null },
          metadata: { softDelete: true, sessionsRevoked: true },
          ...getRequestMetadata(req),
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
