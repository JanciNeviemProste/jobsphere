import { Job } from 'bullmq'
import { prisma } from '@jobsphere/db'
import { gradeAssessmentAnswer } from '@jobsphere/ai'

interface AssessmentGradingJobData {
  attemptId: string
}

export async function assessmentGradingWorker(job: Job<AssessmentGradingJobData>) {
  const { attemptId } = job.data

  console.log(`✍️  Grading assessment attempt ${attemptId}`)

  try {
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: {
          include: {
            question: true,
          },
        },
        invite: {
          include: {
            assessment: true,
          },
        },
      },
    })

    if (!attempt) {
      throw new Error('Attempt not found')
    }

    let totalScore = 0
    let totalPossible = 0
    const skillScores: Record<string, { score: number; total: number }> = {}

    // Grade each answer
    for (const answer of attempt.answers) {
      const question = answer.question
      let score = 0

      totalPossible += question.points

      // Auto-grading for MCQ and MULTI
      if (question.type === 'MCQ' || question.type === 'MULTI') {
        const selectedIndexes = answer.response as number[]
        const correct = question.correctIndexes

        if (question.type === 'MCQ') {
          // Single choice - all or nothing
          score = selectedIndexes[0] === correct[0] ? question.points : 0
        } else {
          // Multiple choice - partial credit
          const correctSelected = selectedIndexes.filter((i) => correct.includes(i)).length
          const incorrectSelected = selectedIndexes.filter((i) => !correct.includes(i)).length
          const missedCorrect = correct.filter((i) => !selectedIndexes.includes(i)).length

          score = Math.max(
            0,
            ((correctSelected - incorrectSelected) / correct.length) * question.points
          )
        }

        await prisma.answer.update({
          where: { id: answer.id },
          data: { autoScore: score, finalScore: score },
        })
      }

      // AI grading for FREE TEXT and LONG questions
      else if (question.type === 'SHORT' || question.type === 'LONG') {
        const answerText = answer.response as string

        const grading = await gradeAssessmentAnswer(
          question.text,
          answerText,
          question.rubric,
          question.points
        )

        score = grading.score

        await prisma.answer.update({
          where: { id: answer.id },
          data: {
            aiScore: grading.score,
            aiRationale: grading.rationale,
            finalScore: grading.score,
          },
        })
      }

      // CODE questions - basic validation
      else if (question.type === 'CODE') {
        // TODO: Run test cases against code
        // For now, requires manual grading
        score = 0
      }

      totalScore += score

      // Track per-skill scores
      if (question.skillTag) {
        if (!skillScores[question.skillTag]) {
          skillScores[question.skillTag] = { score: 0, total: 0 }
        }
        skillScores[question.skillTag].score += score
        skillScores[question.skillTag].total += question.points
      }
    }

    const percentage = (totalScore / totalPossible) * 100

    // Update attempt
    await prisma.attempt.update({
      where: { id: attemptId },
      data: {
        totalScore,
        percentage,
        status: 'GRADED',
        detail: {
          skillScores: Object.entries(skillScores).map(([skill, data]) => ({
            skill,
            score: data.score,
            total: data.total,
            percentage: (data.score / data.total) * 100,
          })),
        },
        feedback: generateFeedback(percentage, attempt.invite.assessment.passingScore),
      },
    })

    console.log(`✅ Graded attempt: ${totalScore}/${totalPossible} (${percentage.toFixed(1)}%)`)
    return { totalScore, percentage }
  } catch (error) {
    console.error(`❌ Failed to grade assessment:`, error)
    throw error
  }
}

function generateFeedback(percentage: number, passingScore?: number | null): string {
  const passed = passingScore ? percentage >= passingScore : true

  if (passed) {
    if (percentage >= 90) {
      return 'Excellent performance! You demonstrated exceptional understanding.'
    } else if (percentage >= 80) {
      return 'Great job! You showed strong knowledge and skills.'
    } else {
      return 'Good work! You met the requirements successfully.'
    }
  } else {
    return `Your score of ${percentage.toFixed(1)}% did not meet the passing threshold of ${passingScore}%. Please review the material and try again.`
  }
}