/**
 * Assessment Submission API
 * Saves candidate answers and triggers grading
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { addAssessmentGradingJob } from '@/lib/queue'
import { withCsrfProtection } from '@/lib/csrf'
import { withRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const submitSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        response: z.union([z.string(), z.number(), z.array(z.string())]),
      }),
    )
    .min(1),
  // Optional invite token — lets an email-invited candidate (no account) submit.
  token: z.string().min(1).optional(),
  // Anti-cheat telemetry gathered client-side (focus-loss events, etc.).
  violations: z
    .object({
      count: z.number().int().min(0),
      events: z
        .array(z.object({ type: z.string().max(50), at: z.string().max(40) }))
        .max(200)
        .optional(),
    })
    .optional(),
})

export const runtime = 'nodejs'

export const POST = withCsrfProtection<NextRequest>(
  withRateLimit<NextRequest>(
    async (request: NextRequest, context?: { params?: Record<string, string> }) => {
      const params = context?.params as { id: string }
      if (!params?.id) {
        return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
      }
      try {
        const body = await request.json()
        const parseResult = submitSchema.safeParse(body)
        if (!parseResult.success) {
          return NextResponse.json(
            { error: 'Invalid answers', details: parseResult.error.flatten() },
            { status: 400 },
          )
        }
        const { answers, token, violations } = parseResult.data

        // Authorization mirrors the runner GET (bod 2): a submission is only
        // accepted from a valid invite — either the opaque token, or the
        // logged-in candidate who owns the invite (via Candidate.userId). The
        // invite must not already be completed/expired.
        const usable = {
          assessmentId: params.id,
          status: { notIn: ['COMPLETED', 'EXPIRED'] },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        }

        let invite: { id: string; candidateId: string } | null = null
        if (token) {
          invite = await prisma.assessmentInvite.findFirst({
            where: { ...usable, token },
            select: { id: true, candidateId: true },
          })
        } else {
          const session = await auth()
          if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
          }
          invite = await prisma.assessmentInvite.findFirst({
            where: { ...usable, candidate: { userId: session.user.id } },
            select: { id: true, candidateId: true },
          })
        }

        if (!invite) {
          return NextResponse.json(
            { error: 'No valid assessment invite for this assessment' },
            { status: 403 },
          )
        }

        // Persist anti-cheat telemetry (best-effort metadata) into attempt.detail.
        const detail = violations
          ? {
              antiCheat: {
                violations: violations.count,
                events: violations.events ?? [],
              },
            }
          : undefined

        // Create assessment attempt with responses. The unique inviteId guards
        // against a second submission for the same invite (handled as 409 below).
        let attempt
        try {
          attempt = await prisma.attempt.create({
            data: {
              inviteId: invite.id,
              candidateId: invite.candidateId,
              startedAt: new Date(),
              submittedAt: new Date(),
              status: 'SUBMITTED',
              ...(detail ? { detail } : {}),
              answers: {
                create: answers.map((ans) => ({
                  questionId: ans.questionId,
                  response: ans.response ?? {}, // Store as JSON
                })),
              },
            },
          })
        } catch (createError) {
          if ((createError as { code?: string })?.code === 'P2002') {
            return NextResponse.json(
              { error: 'This assessment has already been submitted' },
              { status: 409 },
            )
          }
          throw createError
        }

        // Mark the invite completed so it can't be re-opened or re-submitted.
        await prisma.assessmentInvite
          .update({ where: { id: invite.id }, data: { status: 'COMPLETED' } })
          .catch((err) => logger.error('Failed to mark invite completed', err))

        // Trigger automatic grading via BullMQ worker
        try {
          await addAssessmentGradingJob({ attemptId: attempt.id })
          logger.info('Assessment grading job queued', { attemptId: attempt.id })
        } catch (error) {
          logger.error('Failed to queue grading job', error)
          // Don't fail the submission if queueing fails
          // Assessment can be graded manually or by retry mechanism
        }

        return NextResponse.json({
          success: true,
          attemptId: attempt.id,
          message: 'Assessment submitted successfully. Grading in progress.',
        })
      } catch (error) {
        logger.error('Assessment submission error', error)
        return NextResponse.json({ error: 'Failed to submit assessment' }, { status: 500 })
      }
    },
    { preset: 'api', byUser: true }, // 100 requests per minute
  ),
)
