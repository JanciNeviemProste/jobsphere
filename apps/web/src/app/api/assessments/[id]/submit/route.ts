/**
 * Assessment Submission API
 * Saves candidate answers and triggers grading
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { addAssessmentGradingJob } from '@/lib/queue'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
          include: { questions: true }
        }
      },
    })

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
    }

    // Find candidate
    // TODO: Fix data model - Candidate doesn't have userId
    // @ts-ignore - Temporary workaround
    const orgId = (session.user as any).organizationId || 'default'
    const candidate = await prisma.candidate.findFirst({
      where: { orgId },
    })

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    // Find or get assessment invite
    const invite = await prisma.assessmentInvite.findFirst({
      where: {
        assessmentId: params.id,
        candidateId: candidate.id,
      },
    })

    if (!invite) {
      return NextResponse.json({ error: 'Assessment invite not found' }, { status: 404 })
    }

    // Create assessment attempt with responses
    const attempt = await prisma.attempt.create({
      data: {
        inviteId: invite.id,
        candidateId: candidate.id,
        startedAt: new Date(),
        submittedAt: new Date(),
        status: 'SUBMITTED',
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
      console.log('Assessment grading job queued', { attemptId: attempt.id })
    } catch (error) {
      console.error('Failed to queue grading job:', error)
      // Don't fail the submission if queueing fails
      // Assessment can be graded manually or by retry mechanism
    }

    return NextResponse.json({
      success: true,
      attemptId: attempt.id,
      message: 'Assessment submitted successfully. Grading in progress.',
    })
  } catch (error) {
    console.error('Assessment submission error:', error)
    return NextResponse.json(
      { error: 'Failed to submit assessment' },
      { status: 500 }
    )
  }
}
