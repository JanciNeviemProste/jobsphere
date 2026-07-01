import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { withCsrfProtection } from '@/lib/csrf'
import { withRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const runtime = 'nodejs'

// HR manual override of the match score (L44).
// The override REPLACES the value shown in the UI; the AI archive stays in
// `score0to100`. Sending `overrideScore: null` clears the override and the UI
// falls back to the AI score again.
const overrideSchema = z.object({
  overrideScore: z.number().int().min(0).max(100).nullable(),
  overrideReason: z.string().max(500).optional(),
})

export const PATCH = withCsrfProtection(
  withRateLimit(
    async (req: Request, context?: { params?: Record<string, string> }) => {
      const params = context?.params as { id: string }
      if (!params?.id) {
        return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
      }

      try {
        const session = await auth()
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json().catch(() => null)
        const parsed = overrideSchema.safeParse(body)
        if (!parsed.success) {
          return NextResponse.json(
            { error: 'Invalid request body', details: parsed.error.flatten() },
            { status: 400 },
          )
        }
        const { overrideScore, overrideReason } = parsed.data

        // Resolve the application and its owning org for the IDOR guard.
        const application = await prisma.application.findUnique({
          where: { id: params.id },
          select: {
            jobId: true,
            candidateId: true,
            job: { select: { orgId: true } },
          },
        })

        if (!application) {
          return NextResponse.json({ error: 'Application not found' }, { status: 404 })
        }

        // IDOR guard: only a member of the application's org may write the override.
        const membership = await prisma.userOrgRole.findFirst({
          where: {
            userId: session.user.id,
            orgId: application.job.orgId,
          },
        })

        if (!membership) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const isClearing = overrideScore === null
        const now = new Date()

        const overrideFields = {
          overrideScore,
          overrideBy: isClearing ? null : session.user.id,
          overrideAt: isClearing ? null : now,
          overrideReason: isClearing ? null : (overrideReason ?? null),
        }

        const updated = await prisma.matchScore.upsert({
          where: {
            jobId_candidateId: {
              jobId: application.jobId,
              candidateId: application.candidateId,
            },
          },
          update: overrideFields,
          create: {
            orgId: application.job.orgId,
            jobId: application.jobId,
            candidateId: application.candidateId,
            // No AI archive yet — keep the AI baseline at 0 so the displayed
            // value comes purely from the HR override.
            score0to100: 0,
            evidence: {},
            explanation: [],
            version: 'manual-override',
            ...overrideFields,
          },
          select: {
            score0to100: true,
            overrideScore: true,
            overrideBy: true,
            overrideAt: true,
            overrideReason: true,
          },
        })

        return NextResponse.json({
          score0to100: updated.score0to100,
          overrideScore: updated.overrideScore,
          // Convenience: the value the UI should render.
          displayScore: updated.overrideScore ?? updated.score0to100,
          overrideBy: updated.overrideBy,
          overrideAt: updated.overrideAt,
          overrideReason: updated.overrideReason,
        })
      } catch (error) {
        logger.error('Error updating match score override', error)
        return NextResponse.json({ error: 'Failed to update match score' }, { status: 500 })
      }
    },
    { preset: 'api', byUser: true },
  ),
)
