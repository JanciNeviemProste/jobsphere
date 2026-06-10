import { NextRequest, NextResponse } from 'next/server'
import { auth, UnauthorizedError } from './auth'
import { prisma } from './prisma'

export { UnauthorizedError }

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export interface AuthContext {
  userId: string
  orgId: string
  role: string
  email: string
}

/**
 * Require authentication and organization membership.
 * The request argument is accepted for call-site ergonomics but unused — auth
 * comes from the NextAuth session — so it is optional.
 */
export async function requireOrgAuth(request?: NextRequest): Promise<AuthContext> {
  const session = await auth()

  if (!session?.user?.id) {
    throw new UnauthorizedError()
  }

  const orgMember = await prisma.userOrgRole.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
  })

  if (!orgMember) {
    throw new ForbiddenError('No organization membership found')
  }

  return {
    userId: session.user.id,
    orgId: orgMember.orgId,
    role: orgMember.role,
    email: session.user.email!,
  }
}

/**
 * Require authentication and organization membership.
 * @deprecated prefer {@link requireOrgAuth}; kept for backwards compatibility.
 */
export const requireAuth = requireOrgAuth

/**
 * Require the caller to hold one of the allowed org roles (AUTH-006).
 * Throws ForbiddenError (403) when authenticated but under-privileged.
 *
 * Roles: ORG_ADMIN, RECRUITER, HIRING_MANAGER, AGENCY
 */
export async function requireRole(
  allowedRoles: string[],
  request?: NextRequest,
): Promise<AuthContext> {
  const ctx = await requireOrgAuth(request)

  if (!allowedRoles.includes(ctx.role)) {
    throw new ForbiddenError(`Role ${ctx.role} not allowed`)
  }

  return ctx
}

/**
 * Optional auth (returns null if not authenticated)
 */
export async function optionalAuth(request: NextRequest): Promise<AuthContext | null> {
  try {
    return await requireAuth(request)
  } catch {
    return null
  }
}
