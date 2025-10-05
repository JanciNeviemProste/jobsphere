/**
 * Assessment Submission API
 * Saves candidate answers and triggers grading
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

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
    const candidate = await prisma.candidate.findUnique({
      where: { userId: session.user.id },
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

    // Create attempt
    const attempt = await prisma.attempt.create({
      data: {
        inviteId: invite.id,
        startedAt: new Date(),
        submittedAt: new Date(),
        answers: {
          create: answers.map((ans: any) => ({
            questionId: ans.questionId,
            response: ans.response || ans.answer, // Support both field names
          })),
        },
      },
    })

    // TODO: Trigger grading worker via BullMQ or API call
    // For now, grading will be done manually or via cron job

    return NextResponse.json({
      success: true,
      attemptId: attempt.id,
    })
  } catch (error) {
    console.error('Assessment submission error:', error)
    return NextResponse.json(
      { error: 'Failed to submit assessment' },
      { status: 500 }
    )
  }
}
