'use client'

/**
 * CV Edit Page
 * Review and edit AI-parsed CV data
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Loader2, CheckCircle2 } from 'lucide-react'

interface CVData {
  id: string
  personal?: {
    fullName?: string
    email?: string
    phone?: string
    location?: string
  }
  summary?: string
  experiences: Array<{
    title: string
    company: string
    location?: string
    startDate?: string
    endDate?: string
    current?: boolean
    description?: string
  }>
  education: Array<{
    degree: string
    institution: string
    location?: string
    startDate?: string
    endDate?: string
  }>
  skills: string[]
}

export default function CVEditPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [cvData, setCvData] = useState<CVData | null>(null)

  // Load CV data
  useEffect(() => {
    async function loadCV() {
      try {
        const response = await fetch(`/api/cv/${params.id}`)
        if (!response.ok) throw new Error('Failed to load CV')

        const data = await response.json()
        setCvData(data)
      } catch (error) {
        console.error('Load CV error:', error)
      } finally {
        setLoading(false)
      }
    }

    loadCV()
  }, [params.id])

  const handleSave = async () => {
    if (!cvData) return

    try {
      setSaving(true)
      setSaved(false)

      const response = await fetch(`/api/cv/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cvData),
      })

      if (!response.ok) throw new Error('Failed to save CV')

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (error) {
      console.error('Save CV error:', error)
      alert('Failed to save CV')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!cvData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">CV not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Edit Your CV</h1>
              <p className="text-gray-600 mt-1">
                Review and edit the AI-extracted information
              </p>
            </div>
            <div className="flex gap-3">
              {saved && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-medium">Saved!</span>
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Personal Information
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={cvData.personal?.fullName || ''}
                onChange={(e) =>
                  setCvData({
                    ...cvData,
                    personal: { ...cvData.personal, fullName: e.target.value },
                  })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={cvData.personal?.email || ''}
                onChange={(e) =>
                  setCvData({
                    ...cvData,
                    personal: { ...cvData.personal, email: e.target.value },
                  })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={cvData.personal?.phone || ''}
                onChange={(e) =>
                  setCvData({
                    ...cvData,
                    personal: { ...cvData.personal, phone: e.target.value },
                  })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                value={cvData.personal?.location || ''}
                onChange={(e) =>
                  setCvData({
                    ...cvData,
                    personal: { ...cvData.personal, location: e.target.value },
                  })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Professional Summary
          </h2>
          <textarea
            value={cvData.summary || ''}
            onChange={(e) => setCvData({ ...cvData, summary: e.target.value })}
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Brief professional summary..."
          />
        </div>

        {/* Experiences */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Work Experience
          </h2>
          <div className="space-y-6">
            {cvData.experiences.map((exp, idx) => (
              <div key={idx} className="border-b border-gray-200 pb-6 last:border-0">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Job Title
                    </label>
                    <input
                      type="text"
                      value={exp.title}
                      onChange={(e) => {
                        const updated = [...cvData.experiences]
                        updated[idx].title = e.target.value
                        setCvData({ ...cvData, experiences: updated })
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company
                    </label>
                    <input
                      type="text"
                      value={exp.company}
                      onChange={(e) => {
                        const updated = [...cvData.experiences]
                        updated[idx].company = e.target.value
                        setCvData({ ...cvData, experiences: updated })
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={exp.description || ''}
                    onChange={(e) => {
                      const updated = [...cvData.experiences]
                      updated[idx].description = e.target.value
                      setCvData({ ...cvData, experiences: updated })
                    }}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Skills */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Skills</h2>
          <div className="flex flex-wrap gap-2">
            {cvData.skills.map((skill, idx) => (
              <span
                key={idx}
                className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
