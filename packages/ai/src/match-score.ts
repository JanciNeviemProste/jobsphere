/**
 * Hybrid Match Score Algorithm
 * Kombinuje BM25 (keyword), Vector Similarity (semantic), a LLM Reasoning
 */

import Anthropic from '@anthropic-ai/sdk'
import type { ExtractedCV, MatchScore, MatchEvidence } from './types'

/**
 * BM25 Parameters
 */
const BM25_K1 = 1.2 // Term saturation parameter
const BM25_B = 0.75 // Length normalization

/**
 * Hybrid Scoring Weights
 */
const WEIGHTS = {
  bm25: 0.3, // Keyword matching
  vector: 0.4, // Semantic similarity
  llm: 0.3, // LLM reasoning
}

/**
 * Job Requirements (pre BM25/vector matching)
 */
export interface JobRequirements {
  title: string
  description: string
  requiredSkills: string[]
  niceToHaveSkills?: string[]
  minimumYearsOfExperience?: number
  requiredEducationLevel?: string
  location?: string
  salaryMin?: number
  salaryMax?: number
}

/**
 * BM25 Score: Keyword-based relevance
 */
function calculateBM25Score(
  cv: ExtractedCV,
  job: JobRequirements
): { score: number; matchingSkills: string[]; missingSkills: string[] } {
  // Combine all CV text
  const cvText = [
    cv.summary || '',
    ...cv.experiences.map((e) => `${e.title} ${e.company} ${e.description}`),
    ...cv.skills,
  ]
    .join(' ')
    .toLowerCase()

  const jobKeywords = [
    ...job.requiredSkills.map((s) => s.toLowerCase()),
    ...(job.niceToHaveSkills?.map((s) => s.toLowerCase()) || []),
  ]

  const matchingSkills: string[] = []
  const missingSkills: string[] = []

  // Simple keyword matching
  for (const skill of job.requiredSkills) {
    const skillLower = skill.toLowerCase()
    if (cvText.includes(skillLower)) {
      matchingSkills.push(skill)
    } else {
      missingSkills.push(skill)
    }
  }

  // Score based on match percentage
  const score = matchingSkills.length / Math.max(job.requiredSkills.length, 1)

  return { score, matchingSkills, missingSkills }
}

/**
 * Vector Similarity: Cosine similarity medzi CV a Job embeddings
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vector dimensions must match')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * LLM Score: Claude analyzuje match s vysvetlením
 */
async function calculateLLMScore(
  cv: ExtractedCV,
  job: JobRequirements,
  config: { apiKey: string }
): Promise<{ score: number; reasoning: string }> {
  const anthropic = new Anthropic({ apiKey: config.apiKey })

  const cvSummary = JSON.stringify(
    {
      summary: cv.summary,
      experiences: cv.experiences.slice(0, 3), // Top 3 experiences
      skills: cv.skills.slice(0, 15), // Top 15 skills
      education: cv.education.slice(0, 2),
    },
    null,
    2
  )

  const jobSummary = JSON.stringify(job, null, 2)

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514', // Rýchlejší model pre matching
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are an expert recruiter. Analyze how well this candidate matches the job requirements.

Job Requirements:
${jobSummary}

Candidate CV:
${cvSummary}

Provide:
1. A match score from 0-100 (0 = no match, 100 = perfect match)
2. 2-3 sentence reasoning explaining the score

Consider:
- Skill overlap (required vs nice-to-have)
- Years of experience
- Education level
- Relevant industry experience
- Career progression

Return ONLY valid JSON:
{
  "score": number,
  "reasoning": "string"
}`,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response from Claude')
  }

  return JSON.parse(content.text)
}

/**
 * MAIN: Calculate hybrid match score
 */
export async function calculateMatchScore(
  cv: ExtractedCV,
  job: JobRequirements,
  cvEmbedding: number[],
  jobEmbedding: number[],
  config: { apiKey: string }
): Promise<MatchScore> {
  // 1. BM25 Score (keyword matching)
  const bm25Result = calculateBM25Score(cv, job)
  const bm25Score = bm25Result.score

  // 2. Vector Score (semantic similarity)
  const vectorScore = cosineSimilarity(cvEmbedding, jobEmbedding)

  // 3. LLM Score (reasoning)
  const llmResult = await calculateLLMScore(cv, job, config)
  const llmScore = llmResult.score / 100 // Normalize to 0-1

  // 4. Weighted final score (0-100)
  const finalScore = Math.round(
    (bm25Score * WEIGHTS.bm25 +
      vectorScore * WEIGHTS.vector +
      llmScore * WEIGHTS.llm) *
      100
  )

  // 5. Additional evidence
  const yearsOfExperience = calculateYearsOfExperience(cv.experiences)
  const educationMatch = checkEducationMatch(cv, job)
  const locationMatch = cv.personal?.location === job.location
  const salaryMatch =
    job.salaryMin && job.salaryMax
      ? true // TODO: Extract salary from CV
      : false

  const evidence: MatchEvidence = {
    matchingSkills: bm25Result.matchingSkills,
    missingSkills: bm25Result.missingSkills,
    relevantExperience: cv.experiences.slice(0, 3).map((e) => e.title),
    educationMatch,
    locationMatch,
    salaryMatch,
    yearsOfExperience,
    reasoning: llmResult.reasoning,
  }

  return {
    score0to100: finalScore,
    bm25Score,
    vectorScore,
    llmScore,
    evidence,
    version: '1.0.0',
  }
}

/**
 * Helper: Calculate total years of experience
 */
function calculateYearsOfExperience(
  experiences: ExtractedCV['experiences']
): number {
  let totalMonths = 0

  for (const exp of experiences) {
    if (!exp.startDate) continue

    const start = new Date(exp.startDate)
    const end = exp.current ? new Date() : new Date(exp.endDate || new Date())

    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth())

    totalMonths += months
  }

  return Math.round(totalMonths / 12)
}

/**
 * Helper: Check if education matches requirements
 */
function checkEducationMatch(
  cv: ExtractedCV,
  job: JobRequirements
): boolean {
  if (!job.requiredEducationLevel) return true

  const educationLevels = [
    'high school',
    'associate',
    'bachelor',
    'master',
    'phd',
  ]

  const requiredLevel = educationLevels.indexOf(
    job.requiredEducationLevel.toLowerCase()
  )
  if (requiredLevel === -1) return false

  for (const edu of cv.education) {
    const candidateLevel = educationLevels.findIndex((level) =>
      edu.degree.toLowerCase().includes(level)
    )
    if (candidateLevel >= requiredLevel) return true
  }

  return false
}

/**
 * Batch matching: Match multiple CVs to a single job
 */
export async function matchCandidatesToJob(
  candidates: Array<{
    cv: ExtractedCV
    cvEmbedding: number[]
  }>,
  job: JobRequirements,
  jobEmbedding: number[],
  config: { apiKey: string }
): Promise<MatchScore[]> {
  const results: MatchScore[] = []

  // Process in parallel with rate limiting (10 concurrent)
  const batchSize = 10
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize)

    const promises = batch.map((candidate) =>
      calculateMatchScore(
        candidate.cv,
        job,
        candidate.cvEmbedding,
        jobEmbedding,
        config
      )
    )

    const batchResults = await Promise.all(promises)
    results.push(...batchResults)
  }

  return results
}
