'use client'

/**
 * Assessment Runner
 * Candidate view - timed assessment with various question types
 */

import { useState, useEffect, useRef } from 'react'
import { Clock, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'

interface Question {
  id: string
  type: 'MULTIPLE_CHOICE' | 'CODE' | 'TEXT'
  title: string
  description?: string
  points: number
  options?: string[]
  language?: string
  starterCode?: string
  maxWords?: number
}

interface Assessment {
  id: string
  title: string
  description: string
  timeLimitMinutes: number
  questions: Question[]
}

interface Answer {
  questionId: string
  answer: any
}

export default function TakeAssessmentPage({
  params,
}: {
  params: { id: string }
}) {
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [answers, setAnswers] = useState<Map<string, any>>(new Map())
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const timerRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    loadAssessment()
  }, [params.id])

  useEffect(() => {
    if (!assessment) return

    // Start timer
    setTimeRemaining(assessment.timeLimitMinutes * 60)

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          handleSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [assessment])

  async function loadAssessment() {
    try {
      const response = await fetch(`/api/assessments/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setAssessment(data.assessment)
      } else {
        alert('Failed to load assessment')
      }
    } catch (error) {
      console.error('Load error:', error)
      alert('Failed to load assessment')
    } finally {
      setLoading(false)
    }
  }

  function updateAnswer(questionId: string, value: any) {
    setAnswers(new Map(answers.set(questionId, value)))
  }

  async function handleSubmit() {
    if (submitting) return

    try {
      setSubmitting(true)

      if (timerRef.current) clearInterval(timerRef.current)

      // Convert Map to array
      const answerArray = Array.from(answers.entries()).map(
        ([questionId, answer]) => ({
          questionId,
          answer,
        })
      )

      const response = await fetch(`/api/assessments/${params.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answerArray }),
      })

      if (response.ok) {
        const result = await response.json()
        // Redirect to results page
        window.location.href = `/assessment/${params.id}/results/${result.attemptId}`
      } else {
        alert('Failed to submit assessment')
      }
    } catch (error) {
      console.error('Submit error:', error)
      alert('Failed to submit assessment')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading assessment...</p>
      </div>
    )
  }

  if (!assessment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Assessment not found</p>
      </div>
    )
  }

  const currentQuestion = assessment.questions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / assessment.questions.length) * 100

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {assessment.title}
              </h1>
              <p className="text-sm text-gray-600">
                Question {currentQuestionIndex + 1} of {assessment.questions.length}
              </p>
            </div>

            {/* Timer */}
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono font-bold ${
                timeRemaining < 300
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <Clock className="h-5 w-5" />
              {formatTime(timeRemaining)}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow-sm p-8 mb-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {currentQuestion.title}
            </h2>
            {currentQuestion.description && (
              <p className="text-gray-600">{currentQuestion.description}</p>
            )}
            <p className="text-sm text-gray-500 mt-2">
              {currentQuestion.points} points
            </p>
          </div>

          {/* Answer Input */}
          {currentQuestion.type === 'MULTIPLE_CHOICE' && (
            <div className="space-y-3">
              {currentQuestion.options?.map((option, idx) => (
                <label
                  key={idx}
                  className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-primary cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    checked={answers.get(currentQuestion.id) === idx}
                    onChange={() => updateAnswer(currentQuestion.id, idx)}
                    className="w-5 h-5 text-primary"
                  />
                  <span className="text-gray-900">{option}</span>
                </label>
              ))}
            </div>
          )}

          {currentQuestion.type === 'CODE' && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Language: {currentQuestion.language}
                </span>
              </div>
              <textarea
                value={answers.get(currentQuestion.id) || currentQuestion.starterCode || ''}
                onChange={(e) => updateAnswer(currentQuestion.id, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 font-mono text-sm"
                rows={20}
                placeholder="Write your code here..."
              />
            </div>
          )}

          {currentQuestion.type === 'TEXT' && (
            <div>
              <textarea
                value={answers.get(currentQuestion.id) || ''}
                onChange={(e) => updateAnswer(currentQuestion.id, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3"
                rows={12}
                placeholder="Type your answer here..."
              />
              {currentQuestion.maxWords && (
                <p className="text-sm text-gray-500 mt-2">
                  Max {currentQuestion.maxWords} words (current:{' '}
                  {(answers.get(currentQuestion.id) || '').split(/\s+/).filter(Boolean).length})
                </p>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
            disabled={currentQuestionIndex === 0}
            className="flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>

          {currentQuestionIndex === assessment.questions.length - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-8 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300"
            >
              {submitting ? 'Submitting...' : 'Submit Assessment'}
            </button>
          ) : (
            <button
              onClick={() =>
                setCurrentQuestionIndex(
                  Math.min(assessment.questions.length - 1, currentQuestionIndex + 1)
                )
              }
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Warning */}
        {timeRemaining < 300 && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">Time is running out!</p>
              <p className="text-sm text-red-700">
                Your assessment will auto-submit when the timer reaches 0:00
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
