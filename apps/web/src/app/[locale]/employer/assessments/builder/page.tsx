'use client'

/**
 * Assessment Builder
 * Tvorba testov pre kandidátov (MCQ, code, text)
 */

import { useState } from 'react'
import { Plus, Trash2, Save, Clock, GripVertical } from 'lucide-react'

type QuestionType = 'MULTIPLE_CHOICE' | 'CODE' | 'TEXT'

interface Question {
  id: string
  type: QuestionType
  orderIndex: number
  title: string
  description?: string
  points: number

  // MCQ specific
  options?: string[]
  correctAnswer?: number

  // Code specific
  language?: string
  starterCode?: string
  testCases?: Array<{ input: string; expectedOutput: string }>

  // Text specific
  maxWords?: number
}

interface Assessment {
  id?: string
  title: string
  description: string
  timeLimitMinutes: number
  passingScore: number
  questions: Question[]
}

export default function AssessmentBuilderPage() {
  const [assessment, setAssessment] = useState<Assessment>({
    title: 'New Assessment',
    description: '',
    timeLimitMinutes: 60,
    passingScore: 70,
    questions: [],
  })

  const [saving, setSaving] = useState(false)

  function addQuestion(type: QuestionType) {
    const newQuestion: Question = {
      id: `q-${Date.now()}`,
      type,
      orderIndex: assessment.questions.length,
      title: '',
      points: 10,
    }

    if (type === 'MULTIPLE_CHOICE') {
      newQuestion.options = ['Option 1', 'Option 2', 'Option 3', 'Option 4']
      newQuestion.correctAnswer = 0
    } else if (type === 'CODE') {
      newQuestion.language = 'javascript'
      newQuestion.starterCode = '// Write your solution here\nfunction solve() {\n  \n}'
      newQuestion.testCases = [{ input: '', expectedOutput: '' }]
    } else if (type === 'TEXT') {
      newQuestion.maxWords = 200
    }

    setAssessment({
      ...assessment,
      questions: [...assessment.questions, newQuestion],
    })
  }

  function updateQuestion(questionId: string, updates: Partial<Question>) {
    setAssessment({
      ...assessment,
      questions: assessment.questions.map((q) =>
        q.id === questionId ? { ...q, ...updates } : q
      ),
    })
  }

  function deleteQuestion(questionId: string) {
    setAssessment({
      ...assessment,
      questions: assessment.questions
        .filter((q) => q.id !== questionId)
        .map((q, idx) => ({ ...q, orderIndex: idx })),
    })
  }

  async function saveAssessment() {
    try {
      setSaving(true)

      const response = await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assessment),
      })

      if (response.ok) {
        const saved = await response.json()
        alert('Assessment saved!')
        setAssessment(saved.assessment)
      } else {
        alert('Failed to save assessment')
      }
    } catch (error) {
      console.error('Save error:', error)
      alert('Failed to save assessment')
    } finally {
      setSaving(false)
    }
  }

  const totalPoints = assessment.questions.reduce((sum, q) => sum + q.points, 0)

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="mb-4">
            <input
              type="text"
              value={assessment.title}
              onChange={(e) =>
                setAssessment({ ...assessment, title: e.target.value })
              }
              className="text-3xl font-bold text-gray-900 border-b-2 border-transparent hover:border-gray-300 focus:border-primary outline-none w-full"
              placeholder="Assessment Title"
            />
          </div>

          <textarea
            value={assessment.description}
            onChange={(e) =>
              setAssessment({ ...assessment, description: e.target.value })
            }
            placeholder="Assessment description..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-700 mb-4"
            rows={3}
          />

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time Limit (minutes)
              </label>
              <input
                type="number"
                value={assessment.timeLimitMinutes}
                onChange={(e) =>
                  setAssessment({
                    ...assessment,
                    timeLimitMinutes: parseInt(e.target.value),
                  })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Passing Score (%)
              </label>
              <input
                type="number"
                value={assessment.passingScore}
                onChange={(e) =>
                  setAssessment({
                    ...assessment,
                    passingScore: parseInt(e.target.value),
                  })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Points
              </label>
              <div className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 font-medium text-gray-900">
                {totalPoints}
              </div>
            </div>
          </div>
        </div>

        {/* Add Question Buttons */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Add Question
          </h3>
          <div className="flex gap-3">
            <button
              onClick={() => addQuestion('MULTIPLE_CHOICE')}
              className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <p className="font-medium text-gray-900">Multiple Choice</p>
              <p className="text-sm text-gray-600">Single correct answer</p>
            </button>

            <button
              onClick={() => addQuestion('CODE')}
              className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <p className="font-medium text-gray-900">Coding Challenge</p>
              <p className="text-sm text-gray-600">Write & run code</p>
            </button>

            <button
              onClick={() => addQuestion('TEXT')}
              className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <p className="font-medium text-gray-900">Text Answer</p>
              <p className="text-sm text-gray-600">Open-ended response</p>
            </button>
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-4 mb-6">
          {assessment.questions.map((question, idx) => (
            <div
              key={question.id}
              className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-primary"
            >
              {/* Question Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 flex-1">
                  <GripVertical className="h-5 w-5 text-gray-400" />
                  <div className="flex-1">
                    <input
                      type="text"
                      value={question.title}
                      onChange={(e) =>
                        updateQuestion(question.id, { title: e.target.value })
                      }
                      placeholder="Question title"
                      className="w-full text-lg font-medium text-gray-900 border-b border-transparent hover:border-gray-300 focus:border-primary outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Points:</label>
                    <input
                      type="number"
                      value={question.points}
                      onChange={(e) =>
                        updateQuestion(question.id, {
                          points: parseInt(e.target.value),
                        })
                      }
                      className="w-16 border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                  </div>
                  <button
                    onClick={() => deleteQuestion(question.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <textarea
                value={question.description || ''}
                onChange={(e) =>
                  updateQuestion(question.id, { description: e.target.value })
                }
                placeholder="Question description (optional)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 mb-4"
                rows={2}
              />

              {/* Type-Specific Fields */}
              {question.type === 'MULTIPLE_CHOICE' && (
                <div className="space-y-2">
                  {question.options?.map((option, optIdx) => (
                    <div key={optIdx} className="flex items-center gap-3">
                      <input
                        type="radio"
                        checked={question.correctAnswer === optIdx}
                        onChange={() =>
                          updateQuestion(question.id, { correctAnswer: optIdx })
                        }
                        className="w-4 h-4 text-primary"
                      />
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...(question.options || [])]
                          newOptions[optIdx] = e.target.value
                          updateQuestion(question.id, { options: newOptions })
                        }}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        placeholder={`Option ${optIdx + 1}`}
                      />
                    </div>
                  ))}
                </div>
              )}

              {question.type === 'CODE' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Language
                    </label>
                    <select
                      value={question.language}
                      onChange={(e) =>
                        updateQuestion(question.id, { language: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="javascript">JavaScript</option>
                      <option value="python">Python</option>
                      <option value="java">Java</option>
                      <option value="cpp">C++</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Starter Code
                    </label>
                    <textarea
                      value={question.starterCode}
                      onChange={(e) =>
                        updateQuestion(question.id, {
                          starterCode: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
                      rows={6}
                    />
                  </div>
                </div>
              )}

              {question.type === 'TEXT' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Words
                  </label>
                  <input
                    type="number"
                    value={question.maxWords}
                    onChange={(e) =>
                      updateQuestion(question.id, {
                        maxWords: parseInt(e.target.value),
                      })
                    }
                    className="w-32 border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={saveAssessment}
            disabled={saving}
            className="bg-primary text-white px-8 py-3 rounded-lg font-medium hover:bg-primary/90 disabled:bg-gray-300 flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Assessment'}
          </button>
        </div>
      </div>
    </div>
  )
}
