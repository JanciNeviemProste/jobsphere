/**
 * Accept / reject a gig proposal (company decision).
 * Accept → proposal ACCEPTED, gig → IN_PROGRESS, other pending proposals → REJECTED.
 */

export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { withRateLimit } from '@/lib/rate-limit'
import { withCsrfProtection } from '@/lib/csrf'
import { z } from 'zod'
import { logger } from '@/lib/logger'

const actionSchema = z.object({ action: z.enum(['ACCEPT', 'REJECT']) })

export const PATCH = withCsrfProtection(
  withRateLimit(
    async (request: Request, context?: { params?: Record<string, string> }) => {
      try {
        const gigId = context?.params?.id
        const proposalId = context?.params?.proposalId
        if (!gigId || !proposalId) {
          return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
        }

        const session = await auth()
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const gig = await prisma.gig.findUnique({ where: { id: gigId }, select: { orgId: true } })
        if (!gig) return NextResponse.json({ error: 'Gig not found' }, { status: 404 })

        // Only a member of the gig's organization may decide.
        const member = await prisma.userOrgRole.findFirst({
          where: { userId: session.user.id, orgId: gig.orgId, deletedAt: null },
          select: { orgId: true },
        })
        if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

        const parsed = actionSchema.safeParse(await request.json())
        if (!parsed.success) {
          return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
        }

        if (parsed.data.action === 'REJECT') {
          await prisma.gigProposal.update({
            where: { id: proposalId },
            data: { status: 'REJECTED' },
          })
          return NextResponse.json({ ok: true, status: 'REJECTED' })
        }

        // ACCEPT — atomically: accept this one, move gig to IN_PROGRESS, reject the rest.
        await prisma.$transaction([
          prisma.gigProposal.update({ where: { id: proposalId }, data: { status: 'ACCEPTED' } }),
          prisma.gigProposal.updateMany({
            where: { gigId, id: { not: proposalId }, status: 'PENDING' },
            data: { status: 'REJECTED' },
          }),
          prisma.gig.update({ where: { id: gigId }, data: { status: 'IN_PROGRESS' } }),
        ])
        return NextResponse.json({ ok: true, status: 'ACCEPTED' })
      } catch (error) {
        logger.error('Proposal decision error', { error })
        return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 })
      }
    },
    { preset: 'api' },
  ),
)
