/**
 * Attach and detach tags on one candidate.
 *
 * Separate from /api/tags, which manages the vocabulary itself: creating the
 * label "Needs visa" and putting it on somebody are different acts with
 * different consequences, and collapsing them means every misspelling silently
 * becomes a new tag.
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

const attachSchema = z.object({ tagId: z.string().min(1) })

function candidateId(context?: { params?: Record<string, string> }): string | null {
  return context?.params?.id ?? null
}

/** The candidate, if it belongs to the caller's organisation. */
async function findOwnedCandidate(id: string, orgId: string) {
  return prisma.candidate.findFirst({ where: { id, orgId } })
}

export const GET = withRateLimit(
  async (request: Request, context?: { params?: Record<string, string> }) => {
    try {
      const id = candidateId(context)
      if (!id) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })

      const { orgId } = await requireAuth(request as NextRequest)

      const candidate = await findOwnedCandidate(id, orgId)
      if (!candidate) {
        return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
      }

      const links = await prisma.candidateTag.findMany({
        where: { candidateId: id },
        include: { tag: true },
      })

      return NextResponse.json({ tags: links.map((link) => link.tag) })
    } catch (error) {
      return handleApiError(error)
    }
  },
  { preset: 'api', byUser: true },
)

export const POST = withCsrfProtection(
  withRateLimit(
    async (request: Request, context?: { params?: Record<string, string> }) => {
      try {
        const id = candidateId(context)
        if (!id) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })

        const { orgId } = await requireAuth(request as NextRequest)
        const { tagId } = attachSchema.parse(await request.json())

        const candidate = await findOwnedCandidate(id, orgId)
        if (!candidate) {
          return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
        }

        // Both sides are checked against the caller's org. Without this a tag id
        // from another tenant could be pinned onto a local candidate — the join
        // row itself carries no orgId to catch it later.
        const tag = await prisma.tag.findFirst({ where: { id: tagId, orgId } })
        if (!tag) {
          return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
        }

        // Idempotent: tagging twice is a double-click, not an error.
        await prisma.candidateTag.upsert({
          where: { candidateId_tagId: { candidateId: id, tagId } },
          create: { candidateId: id, tagId },
          update: {},
        })

        logger.info('Candidate tagged', { candidateId: id, tagId })

        return NextResponse.json({ success: true }, { status: 201 })
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
        const id = candidateId(context)
        if (!id) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })

        const { orgId } = await requireAuth(request as NextRequest)
        const { searchParams } = new URL(request.url)
        const tagId = searchParams.get('tagId')
        if (!tagId) {
          return NextResponse.json({ error: 'tagId is required' }, { status: 400 })
        }

        const candidate = await findOwnedCandidate(id, orgId)
        if (!candidate) {
          return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
        }

        await prisma.candidateTag.deleteMany({ where: { candidateId: id, tagId } })

        logger.info('Candidate untagged', { candidateId: id, tagId })

        return NextResponse.json({ success: true })
      } catch (error) {
        return handleApiError(error)
      }
    },
    { preset: 'api', byUser: true },
  ),
)
