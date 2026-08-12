/**
 * Candidate tags — the organisation's label vocabulary.
 *
 * `Candidate.tags` is a String[] that is written nowhere and read in exactly one
 * place. That is what free-form tags decay into: nobody can rename one, nobody
 * can enumerate them, and two recruiters spell the same idea differently. These
 * are rows instead, unique per organisation.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/errors'
import { withCsrfProtection } from '@/lib/csrf'
import { withRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Expected a hex colour like #4F46E5')
    .optional(),
})

export const GET = withRateLimit(
  async (request: Request) => {
    try {
      const { orgId } = await requireAuth(request as NextRequest)

      const tags = await prisma.tag.findMany({
        where: { orgId },
        orderBy: { name: 'asc' },
        include: { _count: { select: { candidates: true } } },
      })

      return NextResponse.json({ tags })
    } catch (error) {
      return handleApiError(error)
    }
  },
  { preset: 'api', byUser: true },
)

export const POST = withCsrfProtection(
  withRateLimit(
    async (request: Request) => {
      try {
        const { orgId } = await requireAuth(request as NextRequest)
        const { name, color } = createTagSchema.parse(await request.json())

        const trimmed = name.trim()

        // The unique index would catch this, but a 409 with a sentence beats a
        // Prisma constraint error surfacing as a 500.
        const existing = await prisma.tag.findUnique({
          where: { orgId_name: { orgId, name: trimmed } },
        })
        if (existing) {
          return NextResponse.json({ error: 'That tag already exists' }, { status: 409 })
        }

        const tag = await prisma.tag.create({
          data: { orgId, name: trimmed, color: color ?? null },
        })

        logger.info('Tag created', { orgId, tagId: tag.id })

        return NextResponse.json({ tag }, { status: 201 })
      } catch (error) {
        return handleApiError(error)
      }
    },
    { preset: 'api', byUser: true },
  ),
)
