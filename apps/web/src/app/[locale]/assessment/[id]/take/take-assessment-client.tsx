'use client'

/**
 * Assessment Runner
 * Candidate view — timed assessment with various question types.
 *
 * Talks to `GET /api/assessments/:id` (which sanitizes questions server-side —
 * no correct answers are ever sent here) and `POST /api/assessments/:id/submit`.
 * An `?token=` in the URL (email-invited candidates) is forwarded to both calls.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Clock, ChevronLeft, ChevronRight, AlertCircle, ShieldAlert } from 'lucide-react'
import { logger } from '@/lib/logger'

// Question types mirror the Prisma `Question.type` values.
type QuestionType = 'MCQ' | 'MULTI_SELECT' | 'SHORT_TEXT' | 'LONG_TEXT' | 'CODE'

interface Question {
  id: string
  type: QuestionType
  text: string
  hint?: string | null
  points: number
  choices?: string[]
  language?: string | null
  starterCode?: string | null
  order: number
  isRequired: boolean
}

interface Assessment {
  id: string
  name: string
  durationMin: number | null
  questions: Question[]
}

// Anti-cheat thresholds: warn the candidate, then hard auto-submit.
const VIOLATION_WARN_THRESHOLD = 3
const VIOLATION_AUTOSUBMIT_THRESHOLD = 5

type AnswerValue = string | string[]

export default function TakeAssessmentClient({ params }: { params: { id: string } }) {
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [answers, setAnswers] = useState<Map<string, AnswerValue>>(new Map())
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  // Tracks the last minute boundary at which we announced remaining time to
  // screen readers (polite live region fires at whole-minute intervals only).
  const [announcedMinute, setAnnouncedMinute] = useState<number | null>(null)
  // Re-render trigger + persistent store for anti-cheat focus-loss events.
  const [violationCount, setViolationCount] = useState(0)

  const timerRef = useRef<NodeJS.Timeout>()
  const submittingRef = useRef(false)
  const violationsRef = useRef<{ count: number; events: { type: string; at: string }[] }>({
    count: 0,
    events: [],
  })

  // Invite token from the URL (?token=...) — forwarded to load + submit so an
  // email-invited candidate without an account can take the test.
  const [token] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('token')
  })

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current) return
    submittingRef.current = true

    try {
      setSubmitting(true)
      if (timerRef.current) clearInterval(timerRef.current)

      const answerArray = Array.from(answers.entries()).map(([questionId, response]) => ({
        questionId,
        response,
      }))

      const response = await fetch(`/api/assessments/${params.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: answerArray,
          ...(token ? { token } : {}),
          violations: {
            count: violationsRef.current.count,
            events: violationsRef.current.events,
          },
        }),
      })

      if (response.ok) {
        const result = await response.json()
        window.location.href = `/assessment/${params.id}/results/${result.attemptId}`
      } else {
        submittingRef.current = false
        setSubmitting(false)
        alert('Failed to submit assessment')
      }
    } catch (error) {
      logger.error('Submit error', error)
      submittingRef.current = false
      setSubmitting(false)
      alert('Failed to submit assessment')
    }
  }, [answers, params.id, token])

  useEffect(() => {
    async function loadAssessment() {
      try {
        const qs = token ? `?token=${encodeURIComponent(token)}` : ''
        const response = await fetch(`/api/assessments/${params.id}${qs}`)
        if (response.ok) {
          const data = await response.json()
          const a = data.assessment
          // Flatten sections into a single ordered question list for the
          // one-question-per-page runner UI.
          const questions: Question[] = (a.sections ?? []).flatMap(
            (s: { questions: Question[] }) => s.questions ?? [],
          )
          setAssessment({
            id: a.id,
            name: a.name,
            durationMin: a.durationMin ?? null,
            questions,
          })
        } else {
          alert('Failed to load assessment')
        }
      } catch (error) {
        logger.error('Load error', error)
        alert('Failed to load assessment')
      } finally {
        setLoading(false)
      }
    }
    loadAssessment()
  }, [params.id, token])

  // Timer — only when the assessment has a duration.
  useEffect(() => {
    if (!assessment || !assessment.durationMin) return

    setTimeRemaining(assessment.durationMin * 60)

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          handleSubmit()
          return 0
        }
        const next = prev - 1
        const nextMinute = Math.floor(next / 60)
        setAnnouncedMinute((prevAnnounced) =>
          prevAnnounced !== nextMinute ? nextMinute : prevAnnounced,
        )
        return next
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [assessment, handleSubmit])

  // Anti-cheat (MVP, no camera): request fullscreen and count focus-loss events.
  useEffect(() => {
    if (!assessment) return

    // Best-effort fullscreen — browsers may reject without a user gesture.
    try {
      document.documentElement.requestFullscreen?.().catch(() => {})
    } catch {
      /* ignore */
    }

    const recordViolation = (type: string) => {
      if (submittingRef.current) return
      const store = violationsRef.current
      store.count += 1
      store.events.push({ type, at: new Date().toISOString() })
      setViolationCount(store.count)
      if (store.count >= VIOLATION_AUTOSUBMIT_THRESHOLD) {
        handleSubmit()
      }
    }

    const onVisibility = () => {
      if (document.hidden) recordViolation('visibility_hidden')
    }
    const onBlur = () => recordViolation('window_blur')

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
    }
  }, [assessment, handleSubmit])

  function setAnswer(questionId: string, value: AnswerValue) {
    setAnswers((prev) => {
      const next = new Map(prev)
      next.set(questionId, value)
      return next
    })
  }

  function toggleMultiSelect(questionId: string, choice: string) {
    setAnswers((prev) => {
      const next = new Map(prev)
      const current = (next.get(questionId) as string[] | undefined) ?? []
      next.set(
        questionId,
        current.includes(choice) ? current.filter((c) => c !== choice) : [...current, choice],
      )
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-600">Loading assessment...</p>
      </div>
    )
  }

  if (!assessment || assessment.questions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
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

  const mcqValue = (answers.get(currentQuestion.id) as string | undefined) ?? ''
  const multiValue = (answers.get(currentQuestion.id) as string[] | undefined) ?? []
  const textValue = (answers.get(currentQuestion.id) as string | undefined) ?? ''

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-white shadow-sm">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{assessment.name}</h1>
              <p className="text-sm text-gray-600">
                Question {currentQuestionIndex + 1} of {assessment.questions.length}
              </p>
            </div>

            {assessment.durationMin ? (
              <div
                role="timer"
                aria-label={`Time remaining: ${formatTime(timeRemaining)}`}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 font-mono font-bold ${
                  timeRemaining < 300 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-900'
                }`}
              >
                <Clock className="h-5 w-5" aria-hidden="true" />
                <span aria-hidden="true">{formatTime(timeRemaining)}</span>
                <span className="sr-only" aria-live="polite" aria-atomic="true">
                  {announcedMinute !== null
                    ? `${announcedMinute} minute${announcedMinute !== 1 ? 's' : ''} remaining`
                    : ''}
                </span>
              </div>
            ) : null}
          </div>

          {/* Progress Bar */}
          <div className="mt-4 h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Anti-cheat warning */}
      {violationCount >= VIOLATION_WARN_THRESHOLD && (
        <div className="mx-auto max-w-5xl px-6 pt-4">
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4"
          >
            <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-600" aria-hidden="true" />
            <div>
              <p className="font-medium text-amber-800">Leaving the assessment is being recorded</p>
              <p className="text-sm text-amber-700">
                We detected that you switched away from the test ({violationCount} times). Repeated
                switching may auto-submit your assessment.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Question */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 rounded-lg bg-white p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="mb-2 text-2xl font-bold text-gray-900">{currentQuestion.text}</h2>
            {currentQuestion.hint && <p className="text-gray-600">{currentQuestion.hint}</p>}
            <p className="mt-2 text-sm text-gray-500">{currentQuestion.points} points</p>
          </div>

          {/* MCQ — single choice (value is the choice text) */}
          {currentQuestion.type === 'MCQ' && (
            <div className="space-y-3">
              {currentQuestion.choices?.map((option, idx) => (
                <label
                  key={idx}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-gray-200 p-4 transition-colors hover:border-primary"
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    checked={mcqValue === option}
                    onChange={() => setAnswer(currentQuestion.id, option)}
                    className="h-5 w-5 text-primary"
                  />
                  <span className="text-gray-900">{option}</span>
                </label>
              ))}
            </div>
          )}

          {/* MULTI_SELECT — multiple choices (value is an array of choice texts) */}
          {currentQuestion.type === 'MULTI_SELECT' && (
            <div className="space-y-3">
              {currentQuestion.choices?.map((option, idx) => (
                <label
                  key={idx}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-gray-200 p-4 transition-colors hover:border-primary"
                >
                  <input
                    type="checkbox"
                    checked={multiValue.includes(option)}
                    onChange={() => toggleMultiSelect(currentQuestion.id, option)}
                    className="h-5 w-5 text-primary"
                  />
                  <span className="text-gray-900">{option}</span>
                </label>
              ))}
            </div>
          )}

          {/* CODE */}
          {currentQuestion.type === 'CODE' && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Language: {currentQuestion.language ?? 'n/a'}
                </span>
              </div>
              <textarea
                value={textValue || currentQuestion.starterCode || ''}
                onChange={(e) => setAnswer(currentQuestion.id, e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 font-mono text-sm"
                rows={20}
                placeholder="Write your code here..."
              />
            </div>
          )}

          {/* SHORT_TEXT */}
          {currentQuestion.type === 'SHORT_TEXT' && (
            <input
              type="text"
              value={textValue}
              onChange={(e) => setAnswer(currentQuestion.id, e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3"
              placeholder="Type your answer here..."
            />
          )}

          {/* LONG_TEXT */}
          {currentQuestion.type === 'LONG_TEXT' && (
            <textarea
              value={textValue}
              onChange={(e) => setAnswer(currentQuestion.id, e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3"
              rows={12}
              placeholder="Type your answer here..."
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
            disabled={currentQuestionIndex === 0}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>

          {currentQuestionIndex === assessment.questions.length - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-lg bg-green-600 px-8 py-3 font-medium text-white hover:bg-green-700 disabled:bg-gray-300"
            >
              {submitting ? 'Submitting...' : 'Submit Assessment'}
            </button>
          ) : (
            <button
              onClick={() =>
                setCurrentQuestionIndex(
                  Math.min(assessment.questions.length - 1, currentQuestionIndex + 1),
                )
              }
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-white hover:bg-primary/90"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Time warning */}
        {assessment.durationMin && timeRemaining < 300 && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" aria-hidden="true" />
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
