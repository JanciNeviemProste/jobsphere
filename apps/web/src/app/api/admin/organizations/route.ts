import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/errors'

export const runtime = 'nodejs'

async function requireGlobalAdmin() {
  const session = await auth()
  if (!session?.user?.isGlobalAdmin) {
    return null
  }
  return session
}

export async function GET() {
  try {
    const session = await requireGlobalAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const orgs = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        industry: true,
        createdAt: true,
        deletedAt: true,
        _count: {
          select: {
            users: true,
            jobs: true,
            subscriptions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({ organizations: orgs })
  } catch (error) {
    logger.error('Admin GET /organizations error:', error)
    return handleApiError(error)
  }
}

const patchSchema = z.object({
  orgId: z.string().min(1),
  action: z.enum(['suspend', 'activate']),
})

export async function PATCH(req: Request) {
  try {
    const session = await requireGlobalAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { orgId, action } = patchSchema.parse(body)

    const org = await prisma.organization.findUnique({ where: { id: orgId } })
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: { deletedAt: action === 'suspend' ? new Date() : null },
      select: { id: true, name: true, deletedAt: true },
    })

    logger.info(`Admin ${action} organization ${orgId} by ${session.user.id}`)
    return NextResponse.json({ organization: updated })
  } catch (error) {
    logger.error('Admin PATCH /organizations error:', error)
    return handleApiError(error)
  }
}
