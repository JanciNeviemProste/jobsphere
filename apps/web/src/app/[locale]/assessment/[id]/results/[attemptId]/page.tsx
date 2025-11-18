'use client'

/**
 * Assessment Results Page
 * Zobrazuje výsledky po dokončení testu
 */

import { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, Clock, Award, Loader2 } from 'lucide-react'

interface Question {
  id: string
  type: string
  title: string
  points: number
}

interface Answer {
  id: string
  questionId: string
  answer: any
  score: number | null
  feedback: string | null
}

interface Attempt {
  id: string
  score: number | null
  maxScore: number
  scorePercent: number | null
  isPassed: boolean | null
  submittedAt: string
  gradedAt: string | null
  assessment: {
    title: string
    passingScore: number
    questions: Question[]
  }
  answers: Answer[]
}

export default function AssessmentResultsPage({
  params,
}: {
  params: { id: string; attemptId: string }
}) {
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadResults()

    // Poll for grading completion
    const interval = setInterval(() => {
      if (!attempt?.gradedAt) {
        loadResults()
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [params.attemptId])

  async function loadResults() {
    try {
      const response = await fetch(
        `/api/assessments/${params.id}/results/${params.attemptId}`
      )

      if (response.ok) {
        const data = await response.json()
        setAttempt(data.attempt)
      }
    } catch (error) {
      console.error('Failed to load results:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!attempt) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Results not found</p>
      </div>
    )
  }

  const isGraded = attempt.gradedAt !== null

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-6 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {attempt.assessment.title}
          </h1>
          <p className="text-gray-600">Assessment Results</p>

          {!isGraded ? (
            <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-lg font-medium text-blue-900">
                Grading in progress...
              </p>
              <p className="text-sm text-blue-700 mt-1">
                Our AI is evaluating your answers. This usually takes 1-2 minutes.
              </p>
            </div>
          ) : (
            <>
              {/* Score Circle */}
              <div className="mt-8 mb-6">
                <div
                  className={`w-40 h-40 rounded-full mx-auto flex items-center justify-center border-8 ${
                    attempt.isPassed
                      ? 'border-green-500 bg-green-50'
                      : 'border-red-500 bg-red-50'
                  }`}
                >
                  <div className="text-center">
                    <p className="text-5xl font-bold text-gray-900">
                      {attempt.scorePercent}%
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {attempt.score}/{attempt.maxScore} points
                    </p>
                  </div>
                </div>
              </div>

              {/* Pass/Fail Status */}
              {attempt.isPassed ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                  <div className="text-left">
                    <p className="font-semibold text-green-900">Congratulations!</p>
                    <p className="text-sm text-green-700">
                      You passed the assessment (required: {attempt.assessment.passingScore}%)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-center gap-3">
                  <XCircle className="h-6 w-6 text-red-600" />
                  <div className="text-left">
                    <p className="font-semibold text-red-900">Not Passed</p>
                    <p className="text-sm text-red-700">
                      Required passing score: {attempt.assessment.passingScore}%
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Questions & Answers */}
        {isGraded && (
          <div className="space-y-4">
            {attempt.assessment.questions.map((question, idx) => {
              const answer = attempt.answers.find(
                (a) => a.questionId === question.id
              )

              if (!answer) return null

              const scorePercent = question.points > 0
                ? ((answer.score || 0) / question.points) * 100
                : 0

              return (
                <div
                  key={question.id}
                  className="bg-white rounded-lg shadow-sm p-6 border-l-4"
                  style={{
                    borderLeftColor:
                      scorePercent >= 70
                        ? '#10b981'
                        : scorePercent >= 40
                        ? '#f59e0b'
                        : '#ef4444',
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Question {idx + 1}: {question.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Type: {question.type.replace('_', ' ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">
                        {answer.score}/{question.points}
                      </p>
                      <p className="text-sm text-gray-600">points</p>
                    </div>
                  </div>

                  {/* Your Answer */}
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Your Answer:
                    </p>
                    <div className="bg-gray-50 rounded-lg p-4">
                      {question.type === 'MULTIPLE_CHOICE' ? (
                        <p className="text-gray-900">Option {answer.answer + 1}</p>
                      ) : question.type === 'CODE' ? (
                        <pre className="text-sm font-mono text-gray-900 overflow-x-auto">
                          {answer.answer}
                        </pre>
                      ) : (
                        <p className="text-gray-900 whitespace-pre-wrap">
                          {answer.answer}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Feedback */}
                  {answer.feedback && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm font-medium text-blue-900 mb-1">
                        Feedback:
                      </p>
                      <p className="text-sm text-blue-800">{answer.feedback}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Metadata */}
        {isGraded && (
          <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Submitted</p>
                <p className="font-medium text-gray-900">
                  {new Date(attempt.submittedAt).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Graded</p>
                <p className="font-medium text-gray-900">
                  {new Date(attempt.gradedAt!).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
