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
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header - Always Visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          {/* Score Circle */}
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl border-2 ${getScoreColor(
              score
            )}`}
          >
            {score}%
          </div>

          {/* Score Label */}
          <div className="text-left">
            <p className="text-lg font-semibold text-gray-900">
              {getScoreLabel(score)}
            </p>
            <p className="text-sm text-gray-600">
              {evidence.matchingSkills.length} matching skills
            </p>
          </div>
        </div>

        {/* Expand Icon */}
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-gray-200 p-6 bg-gray-50 space-y-6">
          {/* AI Reasoning */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-primary" />
              AI Analysis
            </h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              {evidence.reasoning}
            </p>
          </div>

          {/* Score Breakdown */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Score Breakdown
            </h3>
            <div className="space-y-2">
              {/* BM25 (Keyword Matching) */}
              {bm25Score !== undefined && (
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Keyword Match</span>
                    <span className="font-medium text-gray-900">
                      {Math.round(bm25Score * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${bm25Score * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Vector (Semantic Similarity) */}
              {vectorScore !== undefined && (
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Semantic Match</span>
                    <span className="font-medium text-gray-900">
                      {Math.round(vectorScore * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full"
                      style={{ width: `${vectorScore * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* LLM Score */}
              {llmScore !== undefined && (
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">AI Reasoning</span>
                    <span className="font-medium text-gray-900">
                      {Math.round(llmScore * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
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
              <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Matching Skills ({evidence.matchingSkills.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {evidence.matchingSkills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium"
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
              <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                Missing Skills ({evidence.missingSkills.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {evidence.missingSkills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium"
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
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Relevant Experience
              </h3>
              <ul className="space-y-1">
                {evidence.relevantExperience.map((exp, idx) => (
                  <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>{exp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Additional Criteria */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Other Criteria
            </h3>
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
