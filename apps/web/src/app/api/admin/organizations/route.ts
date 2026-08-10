import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireGlobalAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { createAuditLog, getRequestMetadata } from '@/lib/audit-log'
import { handleApiError } from '@/lib/errors'
import { withCsrfProtection } from '@/lib/csrf'
import { withRateLimit } from '@/lib/rate-limit'
import { generateUniqueOrgSlug } from '@/lib/org-slug'

export const runtime = 'nodejs'

async function listOrganizations() {
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

export const PATCH = withCsrfProtection(
  withRateLimit(
    async (req: Request) => {
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

        await createAuditLog({
          userId: session.user.id,
          orgId,
          action: action === 'suspend' ? 'SUSPEND' : 'ACTIVATE',
          resource: 'ORGANIZATION',
          resourceId: orgId,
          previous: { deletedAt: action === 'suspend' ? null : 'set' },
          metadata: { deletedAt: updated.deletedAt?.toISOString() ?? null },
          ...getRequestMetadata(req),
        })
        return NextResponse.json({ organization: updated })
      } catch (error) {
        logger.error('Admin PATCH /organizations error:', error)
        return handleApiError(error)
      }
    },
    { preset: 'api' },
  ),
)

const createOrgSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  slug: z
    .string()
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers and hyphens')
    .optional(),
  industry: z.string().max(100).optional(),
  size: z.string().max(50).optional(),
  website: z.string().url('Website must be a valid URL').max(300).optional(),
})

export const POST = withCsrfProtection(
  withRateLimit(
    async (req: Request) => {
      try {
        const session = await requireGlobalAdmin()
        if (!session) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await req.json()
        const data = createOrgSchema.parse(body)

        // Prefer an explicit slug when supplied, otherwise derive one from name.
        // Either way run it through the uniqueness probe so we never violate the
        // Organization.slug unique constraint.
        const slug = await generateUniqueOrgSlug(data.slug || data.name)

        const org = await prisma.organization.create({
          data: {
            name: data.name.trim(),
            slug,
            industry: data.industry || null,
            size: data.size || null,
            website: data.website || null,
          },
          select: { id: true, name: true, slug: true, industry: true, createdAt: true },
        })

        logger.info(`Admin created organization ${org.id} by ${session.user.id}`)

        await createAuditLog({
          userId: session.user.id,
          orgId: org.id,
          action: 'CREATE',
          resource: 'ORGANIZATION',
          resourceId: org.id,
          metadata: { name: org.name, slug: org.slug },
          ...getRequestMetadata(req),
        })
        return NextResponse.json({ organization: org }, { status: 201 })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: 'Validation failed', issues: error.issues },
            { status: 400 },
          )
        }
        logger.error('Admin POST /organizations error:', error)
        return handleApiError(error)
      }
    },
    { preset: 'api' },
  ),
)

// Rate limiting was missing on this handler until the route wrapper contract
// test (tests/security/route-wrapper-contract.test.ts) enumerated the API surface.
export const GET = withRateLimit(listOrganizations, { preset: 'api', byUser: true })
