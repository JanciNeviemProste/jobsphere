/**
 * Assessment Submission API
 * Saves candidate answers and triggers grading
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { addAssessmentGradingJob } from '@/lib/queue'
import { withCsrfProtection } from '@/lib/csrf'
import { withRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

export const POST = withCsrfProtection<NextRequest>(
  withRateLimit<NextRequest>(
    async (request: NextRequest, context?: { params?: Record<string, string> }) => {
      const params = context?.params as { id: string }
      if (!params?.id) {
        return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
      }
      try {
        const session = await auth()
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { answers } = await request.json()

        if (!answers || !Array.isArray(answers)) {
          return NextResponse.json({ error: 'Invalid answers' }, { status: 400 })
        }

        // Get assessment
        const assessment = await prisma.assessment.findUnique({
          where: { id: params.id },
          include: {
            sections: {
              include: { questions: true },
            },
          },
        })

        if (!assessment) {
          return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
        }

        // Find assessment invite for this assessment linked to the authenticated user
        const invite = await prisma.assessmentInvite.findFirst({
          where: {
            assessmentId: params.id,
            candidateId: session.user.id,
          },
          select: {
            id: true,
            candidateId: true,
          },
        })

        if (!invite) {
          return NextResponse.json({ error: 'Assessment invite not found' }, { status: 404 })
        }

        // Create assessment attempt with responses
        const attempt = await prisma.attempt.create({
          data: {
            inviteId: invite.id,
            candidateId: invite.candidateId,
            startedAt: new Date(),
            submittedAt: new Date(),
            answers: {
              create: answers.map((ans: any) => ({
                questionId: ans.questionId,
                response: ans.response || ans.answer || {}, // Support both field names, store as JSON
              })),
            },
          },
        })

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
