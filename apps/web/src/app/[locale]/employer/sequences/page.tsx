'use client'

/**
 * Email Sequences Builder
 * Vytváranie a správa automatických email sekvencií
 */

import { useState, useEffect } from 'react'
import { Plus, Mail, Clock, Trash2, Save } from 'lucide-react'

interface Step {
  id: string
  orderIndex: number
  subject: string
  bodyText: string
  delayMinutes: number
}

interface Sequence {
  id: string
  name: string
  description?: string
  steps: Step[]
  isActive: boolean
}

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [selectedSequence, setSelectedSequence] = useState<Sequence | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSequences()
  }, [])

  async function loadSequences() {
    try {
      const response = await fetch('/api/sequences')
      if (response.ok) {
        const data = await response.json()
        setSequences(data.sequences)
      }
    } catch (error) {
      console.error('Failed to load sequences:', error)
    } finally {
      setLoading(false)
    }
  }

  function createNewSequence() {
    const newSequence: Sequence = {
      id: `new-${Date.now()}`,
      name: 'New Sequence',
      description: '',
      steps: [
        {
          id: `step-${Date.now()}`,
          orderIndex: 0,
          subject: 'Welcome!',
          bodyText: 'Hi {{firstName}},\n\nThank you for applying!',
          delayMinutes: 0,
        },
      ],
      isActive: false,
    }
    setSelectedSequence(newSequence)
  }

  function addStep() {
    if (!selectedSequence) return

    const newStep: Step = {
      id: `step-${Date.now()}`,
      orderIndex: selectedSequence.steps.length,
      subject: 'Follow up',
      bodyText: 'Hi {{firstName}},\n\nJust checking in...',
      delayMinutes: 1440, // 24 hours
    }

    setSelectedSequence({
      ...selectedSequence,
      steps: [...selectedSequence.steps, newStep],
    })
  }

  function deleteStep(stepId: string) {
    if (!selectedSequence) return

    setSelectedSequence({
      ...selectedSequence,
      steps: selectedSequence.steps
        .filter((s) => s.id !== stepId)
        .map((s, idx) => ({ ...s, orderIndex: idx })),
    })
  }

  function updateStep(stepId: string, updates: Partial<Step>) {
    if (!selectedSequence) return

    setSelectedSequence({
      ...selectedSequence,
      steps: selectedSequence.steps.map((s) =>
        s.id === stepId ? { ...s, ...updates } : s
      ),
    })
  }

  async function saveSequence() {
    if (!selectedSequence) return

    try {
      const isNew = selectedSequence.id.startsWith('new-')

      const response = await fetch(
        isNew ? '/api/sequences' : `/api/sequences/${selectedSequence.id}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(selectedSequence),
        }
      )

      if (response.ok) {
        const saved = await response.json()
        alert('Sequence saved!')
        setSelectedSequence(saved.sequence)
        loadSequences()
      } else {
        alert('Failed to save sequence')
      }
    } catch (error) {
      console.error('Save error:', error)
      alert('Failed to save sequence')
    }
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Email Sequences</h1>
            <p className="text-gray-600 mt-1">
              Automate follow-ups and engagement
            </p>
          </div>
          <button
            onClick={createNewSequence}
            className="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-primary/90 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New Sequence
          </button>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Sequences List */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="font-semibold text-gray-900 mb-4">Your Sequences</h2>
            <div className="space-y-2">
              {sequences.map((seq) => (
                <button
                  key={seq.id}
                  onClick={() => setSelectedSequence(seq)}
                  className={`w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors ${
                    selectedSequence?.id === seq.id ? 'bg-primary/10' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{seq.name}</p>
                      <p className="text-sm text-gray-600">
                        {seq.steps.length} steps
                      </p>
                    </div>
                    {seq.isActive && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Sequence Editor */}
          {selectedSequence ? (
            <div className="col-span-2 bg-white rounded-lg shadow-sm p-6">
              {/* Header */}
              <div className="mb-6">
                <input
                  type="text"
                  value={selectedSequence.name}
                  onChange={(e) =>
                    setSelectedSequence({
                      ...selectedSequence,
                      name: e.target.value,
                    })
                  }
                  className="text-2xl font-bold text-gray-900 border-b-2 border-transparent hover:border-gray-300 focus:border-primary outline-none w-full mb-2"
                />
                <textarea
                  value={selectedSequence.description || ''}
                  onChange={(e) =>
                    setSelectedSequence({
                      ...selectedSequence,
                      description: e.target.value,
                    })
                  }
                  placeholder="Sequence description..."
                  className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  rows={2}
                />
              </div>

              {/* Steps */}
              <div className="space-y-6 mb-6">
                {selectedSequence.steps.map((step, idx) => (
                  <div
                    key={step.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                          {idx + 1}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock className="h-4 w-4" />
                          <input
                            type="number"
                            value={step.delayMinutes}
                            onChange={(e) =>
                              updateStep(step.id, {
                                delayMinutes: parseInt(e.target.value),
                              })
                            }
                            className="w-20 border border-gray-300 rounded px-2 py-1"
                          />
                          <span>minutes delay</span>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteStep(step.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Subject
                        </label>
                        <input
                          type="text"
                          value={step.subject}
                          onChange={(e) =>
                            updateStep(step.id, { subject: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Message
                        </label>
                        <textarea
                          value={step.bodyText}
                          onChange={(e) =>
                            updateStep(step.id, { bodyText: e.target.value })
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          rows={6}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Variables: {'{{firstName}}'}, {'{{lastName}}'}, {'{{jobTitle}}'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t">
                <button
                  onClick={addStep}
                  className="text-primary hover:text-primary/80 font-medium flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Step
                </button>
                <button
                  onClick={saveSequence}
                  className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-primary/90 flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save Sequence
                </button>
              </div>
            </div>
          ) : (
            <div className="col-span-2 bg-white rounded-lg shadow-sm p-12 text-center">
              <Mail className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Select a sequence to edit</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
