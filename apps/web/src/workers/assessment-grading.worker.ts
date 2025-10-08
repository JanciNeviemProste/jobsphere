/**
 * Assessment Grading Worker
 * Automatically grades assessment attempts using Claude AI
 */

import { Worker, Job } from 'bullmq'
import { connection, AssessmentJobData } from '@/lib/queue'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import Anthropic from '@anthropic-ai/sdk'

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5')

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

/**
 * Grade a coding question using Claude
 */
async function gradeCodeWithClaude(
  prompt: string,
  answer: string,
  testCases: any[]
): Promise<{ score: number; feedback: string }> {
  const systemPrompt = `You are an expert programming instructor grading a coding challenge.

Evaluate the provided code against these criteria:
1. Correctness - Does it solve the problem?
2. Code quality - Is it readable and well-structured?
3. Efficiency - Is the solution optimal?
4. Test coverage - Does it pass all test cases?

Test Cases:
${JSON.stringify(testCases, null, 2)}

Return your evaluation in JSON format:
{
  "score": <0-100>,
  "feedback": "<detailed feedback>",
  "passedTests": <number of tests passed>,
  "totalTests": <total tests>
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Problem: ${prompt}\n\nCandidate's Solution:\n\`\`\`\n${answer}\n\`\`\`\n\nPlease evaluate this solution.`,
        },
      ],
    })

    const content = response.content[0]
    if (content.type === 'text') {
      const result = JSON.parse(content.text)
      return {
        score: result.score / 100, // Convert to 0-1 scale
        feedback: result.feedback,
      }
    }

    throw new Error('Unexpected response format')
  } catch (error) {
    logger.error('Claude grading failed', { error })
    return {
      score: 0,
      feedback: 'Failed to grade automatically. Manual review required.',
    }
  }
}

/**
 * Process assessment grading
 */
async function processAssessmentGrading(job: Job<AssessmentJobData>) {
  const { attemptId } = job.data

  logger.info('Processing assessment grading', { attemptId, jobId: job.id })

  try {
    // 1. Get attempt with responses
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        invite: {
          include: {
            assessment: {
              select: { id: true, name: true, orgId: true },
            },
          },
        },
        answers: {
          include: {
            question: true,
          },
        },
        candidate: {
          include: {
            contacts: {
              where: { isPrimary: true },
              take: 1
            }
          },
        },
      },
    })

    if (!attempt) {
      throw new Error(`Assessment attempt ${attemptId} not found`)
    }

    if (attempt.status === 'GRADED') {
      logger.warn('Attempt already graded', { attemptId })
      return
    }

    let totalScore = 0
    let maxScore = 0
    const gradingDetails: any[] = []

    // 2. Grade each response
    for (const response of attempt.answers) {
      const question = response.question

      if (!question) {
        logger.warn('Question not found for response', { responseId: response.id })
        continue
      }

      const questionPoints = question.points || 1
      maxScore += questionPoints

      let earnedPoints = 0
      let feedback = ''

      // Grade based on question type
      // response.response is JSON, extract answer value
      const answerValue = typeof response.response === 'object' && response.response !== null
        ? (response.response as any).answer || (response.response as any).value || JSON.stringify(response.response)
        : String(response.response)

      switch (question.type) {
        case 'MULTIPLE_CHOICE':
          // Simple comparison - check if answer matches correct choice
          const correctChoice = question.choices[question.correctIndexes[0]]
          if (answerValue === correctChoice) {
            earnedPoints = questionPoints
            feedback = 'Correct answer'
          } else {
            feedback = `Incorrect. Correct answer: ${correctChoice}`
          }
          break

        case 'CODING':
          // Grade with Claude AI
          const gradingResult = await gradeCodeWithClaude(
            question.text || '',
            answerValue,
            (question.testCases as any[]) || []
          )

          earnedPoints = gradingResult.score * questionPoints
          feedback = gradingResult.feedback
          break

        case 'FREE_TEXT':
          // Store for manual review
          feedback = 'Pending manual review'
          earnedPoints = 0
          break

        default:
          feedback = 'Unknown question type'
      }

      totalScore += earnedPoints

      gradingDetails.push({
        questionId: question.id,
        questionTitle: question.text,
        earnedPoints,
        maxPoints: questionPoints,
        feedback,
      })

      // Update response with AI scoring
      await prisma.answer.update({
        where: { id: response.id },
        data: {
          aiScore: earnedPoints,
          aiRationale: feedback,
          finalScore: earnedPoints,
        },
      })
    }

    // 3. Calculate final score
    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0

    // 4. Update attempt
    await prisma.attempt.update({
      where: { id: attemptId },
      data: {
        totalScore,
        percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal
        status: 'GRADED',
        submittedAt: new Date(),
      },
    })

    logger.info('Assessment graded successfully', {
      attemptId,
      totalScore,
      maxScore,
      percentage,
    })

    // 5. Send notification email to candidate
    const candidateEmail = attempt.candidate?.contacts?.[0]?.email
    if (candidateEmail) {
      const { sendEmail } = await import('@/lib/email')

      const candidateName = attempt.candidate.contacts?.[0]?.fullName || 'there'
      const assessmentTitle = attempt.invite.assessment.name
      const passed = percentage >= 70 // 70% passing threshold

      await sendEmail({
        to: candidateEmail,
        subject: `Assessment Results - ${assessmentTitle}`,
        html: `
          <h2>Assessment Completed</h2>
          <p>Hi ${candidateName},</p>
          <p>Your assessment <strong>${assessmentTitle}</strong> has been graded.</p>

          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Your Results</h3>
            <p><strong>Score:</strong> ${totalScore.toFixed(1)} / ${maxScore}</p>
            <p><strong>Percentage:</strong> ${percentage.toFixed(1)}%</p>
            <p><strong>Status:</strong> ${passed ? '✅ Passed' : '❌ Did not pass'}</p>
          </div>

          ${
            passed
              ? '<p>Congratulations! You have successfully passed this assessment.</p>'
              : '<p>Unfortunately, you did not meet the passing threshold of 70%. You may be able to retake this assessment.</p>'
          }

          <hr />
          <p style="color: #666; font-size: 12px;">JobSphere ATS - Modern recruitment platform</p>
        `,
      })

      logger.info('Assessment results email sent', { attemptId, email: candidateEmail })
    }

    return { success: true, totalScore, maxScore, percentage }
  } catch (error) {
    logger.error('Failed to grade assessment', {
      error,
      attemptId,
      jobId: job.id,
    })
    throw error
  }
}

/**
 * Create and start the worker
 */
export const assessmentGradingWorker = new Worker<AssessmentJobData>(
  'assessments',
  processAssessmentGrading,
  {
    connection,
    concurrency: WORKER_CONCURRENCY,
  }
)

// Worker event handlers
assessmentGradingWorker.on('completed', (job) => {
  logger.info('Assessment grading job completed', { jobId: job.id })
})

assessmentGradingWorker.on('failed', (job, error) => {
  logger.error('Assessment grading job failed', {
    jobId: job?.id,
    error,
    data: job?.data,
  })
})

assessmentGradingWorker.on('error', (error) => {
  logger.error('Assessment grading worker error', { error })
})

logger.info('Assessment grading worker started', { concurrency: WORKER_CONCURRENCY })
