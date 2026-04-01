/**
 * Generate human-readable match explanations from evidence
 */

export function explainMatch(
  evidence: {
    matchedSkills?: string[]
    strengths?: string[]
    recommendation?: string
    gaps?: string[]
  },
  locale: string = 'en',
): string[] {
  const explanations: string[] = []

  if (evidence.matchedSkills && evidence.matchedSkills.length > 0) {
    explanations.push(`Matched skills: ${evidence.matchedSkills.join(', ')}`)
  }

  if (evidence.strengths && evidence.strengths.length > 0) {
    explanations.push(...evidence.strengths)
  }

  if (evidence.gaps && evidence.gaps.length > 0) {
    explanations.push(...evidence.gaps)
  }

  if (evidence.recommendation) {
    const rec = evidence.recommendation.toLowerCase()
    if (rec === 'hire') {
      explanations.push('Strong candidate - recommend for interview')
    } else if (rec === 'maybe') {
      explanations.push('Potential fit - worth considering')
    } else if (rec === 'no') {
      explanations.push('Not a good fit for this role')
    }
  }

  return explanations
}
