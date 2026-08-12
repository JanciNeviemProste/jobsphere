/**
 * Rename, recolour or delete a tag.
 *
 * Renaming is the whole reason tags are rows rather than strings: with a
 * String[] column, fixing "Senoir" means touching every candidate that carries
 * it, and missing one leaves two tags that look like a typo of each other
 * forever.
 */

import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/errors'
import { withCsrfProtection } from '@/lib/csrf'
import { withRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
})

function tagId(context?: { params?: Record<string, string> }): string | null {
  return context?.params?.id ?? null
}

export const PATCH = withCsrfProtection(
  withRateLimit(
    async (request: Request, context?: { params?: Record<string, string> }) => {
      try {
        const id = tagId(context)
        if (!id) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })

        const { orgId } = await requireAuth(request as NextRequest)
        const data = updateTagSchema.parse(await request.json())

        const tag = await prisma.tag.findFirst({ where: { id, orgId } })
        if (!tag) {
          return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
        }

        if (data.name && data.name.trim() !== tag.name) {
          const clash = await prisma.tag.findUnique({
            where: { orgId_name: { orgId, name: data.name.trim() } },
          })
          if (clash) {
            return NextResponse.json(
              { error: 'Another tag already has that name' },
              { status: 409 },
            )
          }
        }

        const updated = await prisma.tag.update({
          where: { id },
          data: {
            ...(data.name !== undefined && { name: data.name.trim() }),
            ...(data.color !== undefined && { color: data.color }),
          },
        })

        logger.info('Tag updated', { orgId, tagId: id })

        return NextResponse.json({ tag: updated })
      } catch (error) {
        return handleApiError(error)
      }
    },
    { preset: 'api', byUser: true },
  ),
)

export const DELETE = withCsrfProtection(
  withRateLimit(
    async (request: Request, context?: { params?: Record<string, string> }) => {
      try {
        const id = tagId(context)
        if (!id) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })

        const { orgId } = await requireAuth(request as NextRequest)

        const tag = await prisma.tag.findFirst({ where: { id, orgId } })
        if (!tag) {
          return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
        }

        // A hard delete, and the CandidateTag rows go with it via onDelete:
        // Cascade. Unlike an application or an interview, a tag records no event
        // — it is a label someone chose, and removing it from the vocabulary is
        // the whole intent. There is nothing to preserve.
        await prisma.tag.delete({ where: { id } })

        logger.info('Tag deleted', { orgId, tagId: id })

        return NextResponse.json({ success: true })
      } catch (error) {
        return handleApiError(error)
      }
    },
    { preset: 'api', byUser: true },
  ),
)
