/**
 * Assessment Submission API
 * Saves candidate answers and triggers grading
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../../auth/[...nextauth]/route'
import { prisma } from '@/lib/db'
import { gradeAttempt } from '@/workers/assessment-grading.worker'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
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
      include: { questions: true },
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

    // Create attempt
    const attempt = await prisma.attempt.create({
      data: {
        assessmentId: params.id,
        candidateId: candidate.id,
        inviteId: invite?.id,
        startedAt: new Date(),
        submittedAt: new Date(),
        answers: {
          create: answers.map((ans: any) => ({
            questionId: ans.questionId,
            answer: ans.answer,
          })),
        },
      },
    })

    // Trigger grading worker
    await gradeAttempt(attempt.id)

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
