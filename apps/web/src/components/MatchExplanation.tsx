'use client'

/**
 * Match Explanation Component
 * Zobrazuje detail match score s vysvetlením
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

interface MatchExplanationProps {
  score: number // 0-100
  bm25Score?: number // 0-1
  vectorScore?: number // 0-1
  llmScore?: number // 0-1
  evidence: {
    matchingSkills: string[]
    missingSkills: string[]
    relevantExperience: string[]
    educationMatch: boolean
    locationMatch: boolean
    salaryMatch: boolean
    yearsOfExperience?: number
    reasoning: string
  }
}

export function MatchExplanation({
  score,
  bm25Score,
  vectorScore,
  llmScore,
  evidence,
}: MatchExplanationProps) {
  const [expanded, setExpanded] = useState(false)

  // Determine color based on score
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200'
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    return 'text-red-600 bg-red-50 border-red-200'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent Match'
    if (score >= 60) return 'Good Match'
    if (score >= 40) return 'Potential Match'
    return 'Weak Match'
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      {/* Header - Always Visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse match details' : 'Expand match details'}
        className="flex w-full items-center justify-between p-4 transition-colors hover:bg-gray-50"
      >
        <div className="flex items-center gap-4">
          {/* Score Circle */}
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-full border-2 text-xl font-bold ${getScoreColor(
              score,
            )}`}
          >
            {score}%
          </div>

          {/* Score Label */}
          <div className="text-left">
            <p className="text-lg font-semibold text-gray-900">{getScoreLabel(score)}</p>
            <p className="text-sm text-gray-600">
              {evidence.matchingSkills.length} matching skills
            </p>
          </div>
        </div>

        {/* Expand Icon */}
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-gray-400" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" aria-hidden="true" />
        )}
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="space-y-6 border-t border-gray-200 bg-gray-50 p-6">
          {/* AI Reasoning */}
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <AlertCircle className="h-4 w-4 text-primary" />
              AI Analysis
            </h3>
            <p className="text-sm leading-relaxed text-gray-700">{evidence.reasoning}</p>
          </div>

          {/* Score Breakdown */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Score Breakdown</h3>
            <div className="space-y-2">
              {/* BM25 (Keyword Matching) */}
              {bm25Score !== undefined && (
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-gray-600">Keyword Match</span>
                    <span className="font-medium text-gray-900">
                      {Math.round(bm25Score * 100)}%
                    </span>
                  </div>
                  <div
                    className="h-2 w-full rounded-full bg-gray-200"
                    role="progressbar"
                    aria-valuenow={Math.round(bm25Score * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Keyword match score"
                  >
                    <div
                      className="h-2 rounded-full bg-blue-600"
                      style={{ width: `${bm25Score * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Vector (Semantic Similarity) */}
              {vectorScore !== undefined && (
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-gray-600">Semantic Match</span>
                    <span className="font-medium text-gray-900">
                      {Math.round(vectorScore * 100)}%
                    </span>
                  </div>
                  <div
                    className="h-2 w-full rounded-full bg-gray-200"
                    role="progressbar"
                    aria-valuenow={Math.round(vectorScore * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Semantic match score"
                  >
                    <div
                      className="h-2 rounded-full bg-purple-600"
                      style={{ width: `${vectorScore * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* LLM Score */}
              {llmScore !== undefined && (
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-gray-600">AI Reasoning</span>
                    <span className="font-medium text-gray-900">{Math.round(llmScore * 100)}%</span>
                  </div>
                  <div
                    className="h-2 w-full rounded-full bg-gray-200"
                    role="progressbar"
                    aria-valuenow={Math.round(llmScore * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="AI reasoning score"
                  >
                    <div
                      className="h-2 rounded-full bg-green-600"
                      style={{ width: `${llmScore * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Matching Skills */}
          {evidence.matchingSkills.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Matching Skills ({evidence.matchingSkills.length})
              </h3>
              <div className="flex flex-wrap gap-2" role="list" aria-label="Matching skills">
                {evidence.matchingSkills.map((skill, idx) => (
                  <span
                    key={idx}
                    role="listitem"
                    className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Missing Skills */}
          {evidence.missingSkills.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <XCircle className="h-4 w-4 text-red-600" />
                Missing Skills ({evidence.missingSkills.length})
              </h3>
              <div className="flex flex-wrap gap-2" role="list" aria-label="Missing skills">
                {evidence.missingSkills.map((skill, idx) => (
                  <span
                    key={idx}
                    role="listitem"
                    className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Relevant Experience */}
          {evidence.relevantExperience.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Relevant Experience</h3>
              <ul className="space-y-1">
                {evidence.relevantExperience.map((exp, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-1 text-primary">•</span>
                    <span>{exp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Additional Criteria */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Other Criteria</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                {evidence.educationMatch ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm text-gray-700">
                  Education: {evidence.educationMatch ? 'Match' : 'No Match'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {evidence.locationMatch ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm text-gray-700">
                  Location: {evidence.locationMatch ? 'Match' : 'No Match'}
                </span>
              </div>

              {evidence.yearsOfExperience !== undefined && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-gray-700">
                    {evidence.yearsOfExperience} years experience
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
