import { NextRequest, NextResponse } from 'next/server'
import { auth } from './auth'
import { prisma } from './db'

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

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
 * Require authentication and organization membership
 */
export async function requireAuth(request: NextRequest): Promise<AuthContext> {
  const session = await auth()

  if (!session?.user?.id) {
    throw new UnauthorizedError()
  }

  const orgMember = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
    include: { organization: true }
  })

  if (!orgMember) {
    throw new ForbiddenError('No organization membership found')
  }

  return {
    userId: session.user.id,
    orgId: orgMember.organizationId,
    role: orgMember.role,
    email: session.user.email!,
  }
}

/**
 * Require specific role
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: string[]
): Promise<AuthContext> {
  const ctx = await requireAuth(request)

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