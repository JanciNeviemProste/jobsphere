/**
 * Assessment Runner API (GET)
 *
 * Serves the assessment to a candidate taking it. Two hard rules:
 *
 *  1. NEVER leak the correct answers. The DB `select` below is an explicit
 *     allow-list — `correctIndexes`, `rubric` and `testCases` are never even
 *     fetched, let alone returned. `sanitizeQuestion` re-asserts that allow-list
 *     as defence-in-depth so broadening the select can't silently leak secrets.
 *  2. Only serve to a holder of a valid AssessmentInvite — either an unexpired,
 *     non-completed `?token=`, OR a logged-in candidate who owns such an invite
 *     (resolved via Candidate.userId). No invite ⇒ no assessment.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { withRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

// Fields safe to expose to the test-taker. Anything that reveals the correct
// answer (correctIndexes / rubric / testCases) is intentionally excluded.
const SAFE_QUESTION_SELECT = {
  id: true,
  type: true,
  text: true,
  hint: true,
  choices: true,
  language: true,
  starterCode: true,
  points: true,
  order: true,
  isRequired: true,
} as const

type SafeQuestion = {
  id: string
  type: string
  text: string
  hint: string | null
  choices: string[]
  language: string | null
  starterCode: string | null
  points: number
  order: number
  isRequired: boolean
}

function sanitizeQuestion(q: SafeQuestion): SafeQuestion {
  return {
    id: q.id,
    type: q.type,
    text: q.text,
    hint: q.hint ?? null,
    choices: q.choices ?? [],
    language: q.language ?? null,
    starterCode: q.starterCode ?? null,
    points: q.points,
    order: q.order,
    isRequired: q.isRequired,
  }
}

export const GET = withRateLimit(
  async (request: Request, context?: { params?: Record<string, string> }) => {
    const params = context?.params
    if (!params?.id) {
      return NextResponse.json({ error: 'Missing assessment ID' }, { status: 400 })
    }

    try {
      const token = new URL(request.url).searchParams.get('token')

      // A usable invite is one that is not completed/expired by status and whose
      // expiry (if any) is still in the future.
      const now = new Date()
      const usable = {
        assessmentId: params.id,
        status: { notIn: ['COMPLETED', 'EXPIRED'] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      }

      let invite: { id: string } | null = null
      if (token) {
        // Token path: no login required (email-invited candidate without account).
        invite = await prisma.assessmentInvite.findFirst({
          where: { ...usable, token },
          select: { id: true },
        })
      } else {
        // Session path: must be logged in AND own an invite for this assessment.
        const session = await auth()
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        invite = await prisma.assessmentInvite.findFirst({
          where: { ...usable, candidate: { userId: session.user.id } },
          select: { id: true },
        })
      }

      if (!invite) {
        return NextResponse.json(
          { error: 'No valid assessment invite for this assessment' },
          { status: 403 },
        )
      }

      const assessment = await prisma.assessment.findUnique({
        where: { id: params.id },
        select: {
          id: true,
          name: true,
          durationMin: true,
          sections: {
            orderBy: { order: 'asc' },
            select: {
              title: true,
              questions: {
                orderBy: { order: 'asc' },
                select: SAFE_QUESTION_SELECT,
              },
            },
          },
        },
      })

      if (!assessment) {
        return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
      }

      return NextResponse.json({
        assessment: {
          id: assessment.id,
          name: assessment.name,
          durationMin: assessment.durationMin,
          sections: assessment.sections.map((section) => ({
            title: section.title,
            questions: section.questions.map(sanitizeQuestion),
          })),
        },
      })
    } catch (error) {
      logger.error('Failed to load assessment for runner', error)
      return NextResponse.json({ error: 'Failed to load assessment' }, { status: 500 })
    }
  },
  { preset: 'api' },
)
