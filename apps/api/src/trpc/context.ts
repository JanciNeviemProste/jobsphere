import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma, setRLSContext } from '@jobsphere/db'
import type { User, UserOrgRole } from '@jobsphere/db'

export interface Context {
  req: FastifyRequest
  reply: FastifyReply
  user: User | null
  orgId: string | null
  role: string | null
  prisma: typeof prisma
}

export async function createContext({
  req,
  res,
}: {
  req: FastifyRequest
  res: FastifyReply
}): Promise<Context> {
  // Extract user from JWT token
  let user: User | null = null
  let orgId: string | null = null
  let role: string | null = null

  try {
    // Verify JWT token
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (token) {
      const decoded = await req.server.jwt.verify<{ userId: string; orgId?: string }>(token)

      // Fetch user from database
      user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          organizations: {
            where: { deletedAt: null },
            include: {
              organization: true
            }
          }
        }
      })

      // Get current organization context
      orgId = decoded.orgId || req.headers['x-org-id'] as string || null

      if (orgId && user) {
        // Get user role in this organization
        const userOrgRole = await prisma.userOrgRole.findUnique({
          where: {
            userId_orgId: {
              userId: user.id,
              orgId: orgId
            }
          }
        })

        role = userOrgRole?.role || null
      }

      // Set RLS context for this session
      if (user && orgId && role) {
        await setRLSContext(user.id, orgId, role)
      }
    }
  } catch (error) {
    // Invalid or expired token - continue with null user
    console.error('Auth error:', error)
  }

  return {
    req,
    reply: res,
    user,
    orgId,
    role,
    prisma,
  }
}

// Helper to ensure user is authenticated
export function requireAuth(ctx: Context) {
  if (!ctx.user) {
    throw new Error('Unauthorized - Please login')
  }
  return ctx.user
}

// Helper to ensure user has organization context
export function requireOrg(ctx: Context) {
  requireAuth(ctx)
  if (!ctx.orgId) {
    throw new Error('Organization context required')
  }
  return ctx.orgId
}

// Helper to check if user has specific role
export function requireRole(ctx: Context, allowedRoles: string[]) {
  requireAuth(ctx)
  requireOrg(ctx)

  if (!ctx.role || !allowedRoles.includes(ctx.role)) {
    throw new Error(`Forbidden - Required role: ${allowedRoles.join(' or ')}`)
  }

  return ctx.role
}