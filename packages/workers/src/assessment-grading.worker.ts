/**
 * Assessment Grading Worker
 * Automatické a AI grading pomocou Claude
 */

import { Queue, Worker, Job } from 'bullmq'
import { prisma } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export const gradingQueue = new Queue('assessment-grading', {
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
})

interface GradingJobData {
  attemptId: string
}

/**
 * Grade multiple choice question (automatic)
 */
function gradeMCQ(question: any, answer: any): { score: number; feedback: string } {
  const correctAnswer = question.correctAnswer
  const userAnswer = answer.answer

  if (userAnswer === correctAnswer) {
    return {
      score: question.points,
      feedback: 'Correct answer!',
    }
  } else {
    return {
      score: 0,
      feedback: `Incorrect. The correct answer was option ${correctAnswer + 1}.`,
    }
  }
}

/**
 * Grade code question using Claude
 */
async function gradeCode(
  question: any,
  answer: any
): Promise<{ score: number; feedback: string }> {
  const prompt = `You are an expert code reviewer and grader. Evaluate the following code submission.

Question:
${question.title}

${question.description || ''}

Language: ${question.language}

Student's Code:
\`\`\`${question.language}
${answer.answer}
\`\`\`

${question.testCases?.length > 0 ? `Expected Test Cases:\n${question.testCases.map((tc: any, idx: number) => `${idx + 1}. Input: ${tc.input}, Expected Output: ${tc.expectedOutput}`).join('\n')}` : ''}

Grade this code submission on a scale of 0 to ${question.points} points based on:
1. Correctness (40%) - Does it solve the problem correctly?
2. Code Quality (30%) - Is it well-structured, readable, and follows best practices?
3. Efficiency (20%) - Is the solution efficient in terms of time/space complexity?
4. Edge Cases (10%) - Does it handle edge cases?

Return ONLY valid JSON:
{
  "score": number (0 to ${question.points}),
  "feedback": "detailed feedback explaining the grade (2-3 sentences)",
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"]
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    const result = JSON.parse(content.text)

    return {
      score: Math.min(question.points, Math.max(0, result.score)),
      feedback: result.feedback,
    }
  } catch (error) {
    console.error('AI grading error:', error)
    return {
      score: 0,
      feedback: 'Error during automated grading. Manual review required.',
    }
  }
}

/**
 * Grade text answer using Claude
 */
async function gradeText(
  question: any,
  answer: any
): Promise<{ score: number; feedback: string }> {
  const prompt = `You are an expert evaluator. Grade the following text answer.

Question:
${question.title}

${question.description || ''}

Maximum Points: ${question.points}

Student's Answer:
${answer.answer}

Grade this answer based on:
1. Relevance (30%) - Does it address the question?
2. Completeness (30%) - Is the answer thorough?
3. Clarity (20%) - Is it well-written and clear?
4. Accuracy (20%) - Is the information correct?

Return ONLY valid JSON:
{
  "score": number (0 to ${question.points}),
  "feedback": "detailed feedback explaining the grade (2-3 sentences)"
}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type')
    }

    const result = JSON.parse(content.text)

    return {
      score: Math.min(question.points, Math.max(0, result.score)),
      feedback: result.feedback,
    }
  } catch (error) {
    console.error('AI grading error:', error)
    return {
      score: 0,
      feedback: 'Error during automated grading. Manual review required.',
    }
  }
}

/**
 * BullMQ Worker - processes grading jobs
 */
export const gradingWorker = new Worker<GradingJobData>(
  'assessment-grading',
  async (job: Job<GradingJobData>) => {
    const { attemptId } = job.data

    console.log(`[Grading] Starting grading for attempt ${attemptId}`)

    try {
      // Fetch attempt with all data
      const attempt = await prisma.attempt.findUnique({
        where: { id: attemptId },
        include: {
          assessment: {
            include: {
              questions: true,
            },
          },
          answers: true,
        },
      })

      if (!attempt) {
        throw new Error('Attempt not found')
      }

      let totalScore = 0
      const maxScore = attempt.assessment.questions.reduce(
        (sum, q) => sum + q.points,
        0
      )

      // Grade each answer
      for (const answer of attempt.answers) {
        const question = attempt.assessment.questions.find(
          (q) => q.id === answer.questionId
        )

        if (!question) continue

        let gradingResult: { score: number; feedback: string }

        if (question.type === 'MULTIPLE_CHOICE') {
          gradingResult = gradeMCQ(question, answer)
        } else if (question.type === 'CODE') {
          gradingResult = await gradeCode(question, answer)
        } else if (question.type === 'TEXT') {
          gradingResult = await gradeText(question, answer)
        } else {
          continue
        }

        // Update answer with score and feedback
        await prisma.answer.update({
          where: { id: answer.id },
          data: {
            score: gradingResult.score,
            feedback: gradingResult.feedback,
          },
        })

        totalScore += gradingResult.score
      }

      // Calculate percentage
      const scorePercent = maxScore > 0 ? (totalScore / maxScore) * 100 : 0
      const isPassed = scorePercent >= attempt.assessment.passingScore

      // Update attempt
      await prisma.attempt.update({
        where: { id: attemptId },
        data: {
          score: totalScore,
          maxScore,
          scorePercent: Math.round(scorePercent),
          isPassed,
          gradedAt: new Date(),
        },
      })

      console.log(
        `[Grading] Completed grading for attempt ${attemptId}: ${totalScore}/${maxScore} (${scorePercent.toFixed(1)}%)`
      )

      // TODO: Send email notification to candidate
    } catch (error) {
      console.error(`[Grading] Error grading attempt ${attemptId}:`, error)
      throw error
    }
  },
  {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    concurrency: 3, // Limit concurrent AI calls
  }
)

/**
 * Trigger grading for an attempt
 */
export async function gradeAttempt(attemptId: string) {
  await gradingQueue.add('grade', { attemptId })
}
