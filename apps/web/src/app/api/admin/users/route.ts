/**
 * Admin Users API
 * List, search, paginate and manage user status.
 * All endpoints require isGlobalAdmin.
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import * as z from 'zod'
import { withCsrfProtection } from '@/lib/csrf'
import { withRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// Far-future date used as a "banned" sentinel
const BAN_DATE = new Date('2099-01-01T00:00:00.000Z')

async function requireGlobalAdmin() {
  const session = await auth()
  if (!session?.user?.isGlobalAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return session
}

const listQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const patchBodySchema = z.object({
  userId: z.string().min(1),
  action: z.enum(['ban', 'unban', 'promote_admin', 'demote_admin']),
})

/**
 * GET /api/admin/users
 * Returns paginated list of users with org count, searchable by name/email.
 */
const listUsers = async (req: Request) => {
  const authResult = await requireGlobalAdmin()
  if (authResult instanceof NextResponse) return authResult

  try {
    const { searchParams } = new URL(req.url)

    const params = listQuerySchema.parse({
      search: searchParams.get('search') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })

    const skip = (params.page - 1) * params.limit

    const whereClause = {
      deletedAt: null,
      ...(params.search
        ? {
            OR: [
              { email: { contains: params.search, mode: 'insensitive' as const } },
              { name: { contains: params.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          emailVerified: true,
          isGlobalAdmin: true,
          lockedUntil: true,
          failedAttempts: true,
          _count: {
            select: { organizations: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: params.limit,
      }),
      prisma.user.count({ where: whereClause }),
    ])

    logger.info('Admin: listed users', { adminId: authResult.user.id, total, page: params.page })

    return NextResponse.json({ users, total, page: params.page, limit: params.limit })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', issues: error.issues },
        { status: 400 },
      )
    }
    logger.error('Admin GET /users failed', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/users
 * Change user status: ban, unban, promote_admin, demote_admin.
 */
export const PATCH = withCsrfProtection(
  withRateLimit(
    async (req: Request) => {
      const authResult = await requireGlobalAdmin()
      if (authResult instanceof NextResponse) return authResult

      try {
        const body: unknown = await req.json()
        const { userId, action } = patchBodySchema.parse(body)

        // Prevent admins from acting on themselves for sensitive operations
        if (userId === authResult.user.id && (action === 'demote_admin' || action === 'ban')) {
          return NextResponse.json(
            { error: 'You cannot perform this action on your own account' },
            { status: 400 },
          )
        }

        const target = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, deletedAt: true },
        })

        if (!target || target.deletedAt !== null) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        let updateData: Record<string, unknown>

        switch (action) {
          case 'ban':
            // AUTH-001: bump sessionEpoch to immediately revoke the banned user's active JWTs
            updateData = { lockedUntil: BAN_DATE, sessionEpoch: { increment: 1 } }
            break
          case 'unban':
            updateData = { lockedUntil: null, failedAttempts: 0 }
            break
          case 'promote_admin':
            updateData = { isGlobalAdmin: true }
            break
          case 'demote_admin':
            // AUTH-001: revoke active sessions so the demoted admin loses elevated access now
            updateData = { isGlobalAdmin: false, sessionEpoch: { increment: 1 } }
            break
        }

        const updated = await prisma.user.update({
          where: { id: userId },
          data: updateData,
          select: {
            id: true,
            name: true,
            email: true,
            isGlobalAdmin: true,
            lockedUntil: true,
            failedAttempts: true,
          },
        })

        logger.info('Admin: user action applied', { adminId: authResult.user.id, userId, action })

        return NextResponse.json({ user: updated })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: 'Invalid request body', issues: error.issues },
            { status: 400 },
          )
        }
        logger.error('Admin PATCH /users failed', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
    { preset: 'api' },
  ),
)

// Rate limiting was missing on this handler until the route wrapper contract
// test (tests/security/route-wrapper-contract.test.ts) enumerated the API surface.
export const GET = withRateLimit(listUsers, { preset: 'api', byUser: true })
