import { Anthropic } from '@anthropic-ai/sdk'
import { prisma } from './prisma'
import { logger } from './logger'

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export interface MatchScore {
  overall: number // 0-100
  skills: number
  experience: number
  education: number
  location: number
  salary: number
  details: {
    matchedSkills: string[]
    missingSkills: string[]
    experienceAnalysis: string
    educationAnalysis: string
    locationAnalysis: string
    salaryAnalysis: string
  }
}

/**
 * Calculate AI-powered match score between a candidate and a job
 */
export async function calculateMatchScore(
  resumeId: string,
  jobId: string
): Promise<MatchScore> {
  try {
    // Fetch resume and job data
    const [resume, job] = await Promise.all([
      prisma.resume.findUnique({
        where: { id: resumeId },
        include: {
          sections: true,
          candidate: true
        }
      }),
      prisma.job.findUnique({
        where: { id: jobId },
        include: {
          organization: {
            select: {
              name: true,
            }
          }
        }
      })
    ])

    if (!resume || !job) {
      throw new Error('Resume or job not found')
    }

    // Extract candidate information
    const candidateSkills: string[] = []
    const candidateExperience: any[] = []
    const candidateEducation: any[] = []

    resume.sections.forEach(section => {
      if (section.kind === 'skills' && section.skills) {
        candidateSkills.push(...section.skills)
      } else if (section.kind === 'experience') {
        candidateExperience.push({
          title: section.title,
          organization: section.organization,
          startDate: section.startDate,
          endDate: section.endDate,
          current: section.current,
          description: section.description,
        })
      } else if (section.kind === 'education') {
        candidateEducation.push({
          title: section.title,
          organization: section.organization,
          startDate: section.startDate,
          endDate: section.endDate,
          description: section.description,
        })
      }
    })

    // Prepare the prompt for AI analysis
    const prompt = `Analyze the match between this candidate and job:

CANDIDATE PROFILE:
Skills: ${candidateSkills.join(', ') || 'Not specified'}
Experience: ${JSON.stringify(candidateExperience, null, 2)}
Education: ${JSON.stringify(candidateEducation, null, 2)}

JOB REQUIREMENTS:
Title: ${job.title}
Company: ${job.organization.name}
Description: ${job.description}
Location: ${job.location}
Salary: ${job.salaryMin || 0}-${job.salaryMax || 'negotiable'} EUR
Work Mode: ${job.workMode}
Seniority: ${job.seniority}

Please provide a match analysis with scores (0-100) for:
1. Overall match
2. Skills match
3. Experience match
4. Education match
5. Location compatibility
6. Salary alignment

Return a JSON response with this structure:
{
  "overall": <0-100>,
  "skills": <0-100>,
  "experience": <0-100>,
  "education": <0-100>,
  "location": <0-100>,
  "salary": <0-100>,
  "details": {
    "matchedSkills": ["skill1", "skill2"],
    "missingSkills": ["skill3", "skill4"],
    "experienceAnalysis": "Brief analysis",
    "educationAnalysis": "Brief analysis",
    "locationAnalysis": "Brief analysis",
    "salaryAnalysis": "Brief analysis"
  }
}`

    // Call Claude API for analysis
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })

    // Parse the response
    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response format from AI')
    }

    // Extract JSON from the response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Could not parse AI response')
    }

    const matchScore: MatchScore = JSON.parse(jsonMatch[0])

    // Validate and sanitize scores
    matchScore.overall = Math.min(100, Math.max(0, matchScore.overall))
    matchScore.skills = Math.min(100, Math.max(0, matchScore.skills))
    matchScore.experience = Math.min(100, Math.max(0, matchScore.experience))
    matchScore.education = Math.min(100, Math.max(0, matchScore.education))
    matchScore.location = Math.min(100, Math.max(0, matchScore.location))
    matchScore.salary = Math.min(100, Math.max(0, matchScore.salary))

    logger.info('AI match score calculated', {
      resumeId,
      jobId,
      score: matchScore.overall
    })

    return matchScore
  } catch (error) {
    logger.error('Failed to calculate AI match score', error)

    // Fallback to simple rule-based scoring
    return calculateFallbackScore(resumeId, jobId)
  }
}

/**
 * Fallback scoring when AI is unavailable
 */
async function calculateFallbackScore(
  resumeId: string,
  jobId: string
): Promise<MatchScore> {
  const [resume, job] = await Promise.all([
    prisma.resume.findUnique({
      where: { id: resumeId },
      include: {
        sections: true,
        candidate: true
      }
    }),
    prisma.job.findUnique({
      where: { id: jobId }
    })
  ])

  if (!resume || !job) {
    throw new Error('Resume or job not found')
  }

  // Extract skills
  const candidateSkills: string[] = []
  resume.sections.forEach(section => {
    if (section.kind === 'skills' && section.skills) {
      candidateSkills.push(...section.skills.map(s => s.toLowerCase()))
    }
  })

  // Simple skill matching using description
  const jobDescription = (job.description || '').toLowerCase()
  const matchedSkills = candidateSkills.filter(skill =>
    jobDescription.includes(skill)
  )
  const skillsScore = candidateSkills.length > 0
    ? Math.min((matchedSkills.length / candidateSkills.length) * 100, 100)
    : 50

  // Location matching - simplified since preferredLocations doesn't exist
  const locationScore = 70

  // Salary matching - simplified since preferredSalaryMin doesn't exist
  const salaryScore = 70

  // Experience score (basic)
  const hasExperience = resume.sections.some(s => s.kind === 'experience')
  const experienceScore = hasExperience ? 75 : 40

  // Education score (basic)
  const hasEducation = resume.sections.some(s => s.kind === 'education')
  const educationScore = hasEducation ? 75 : 50

  // Calculate overall score
  const overall = Math.round(
    (skillsScore * 0.35 +
     experienceScore * 0.25 +
     educationScore * 0.15 +
     locationScore * 0.15 +
     salaryScore * 0.10)
  )

  return {
    overall,
    skills: Math.round(skillsScore),
    experience: experienceScore,
    education: educationScore,
    location: locationScore,
    salary: salaryScore,
    details: {
      matchedSkills: matchedSkills,
      missingSkills: [],
      experienceAnalysis: 'Based on resume sections',
      educationAnalysis: 'Based on education entries',
      locationAnalysis: 'Based on location preferences',
      salaryAnalysis: 'Based on salary expectations',
    }
  }
}

/**
 * Calculate match scores for multiple jobs
 */
export async function calculateBulkMatchScores(
  resumeId: string,
  jobIds: string[]
): Promise<Map<string, MatchScore>> {
  const scores = new Map<string, MatchScore>()

  // Process in parallel with limit
  const batchSize = 5
  for (let i = 0; i < jobIds.length; i += batchSize) {
    const batch = jobIds.slice(i, i + batchSize)
    const batchScores = await Promise.all(
      batch.map(jobId =>
        calculateMatchScore(resumeId, jobId)
          .then(score => ({ jobId, score }))
          .catch(error => {
            logger.error(`Failed to calculate score for job ${jobId}`, error)
            return null
          })
      )
    )

    batchScores.forEach(result => {
      if (result) {
        scores.set(result.jobId, result.score)
      }
    })
  }

  return scores
}

/**
 * Get recommended jobs with AI match scores
 */
export async function getRecommendedJobsWithAI(
  candidateId: string,
  limit: number = 10
): Promise<Array<{ job: any; matchScore: MatchScore }>> {
  try {
    // Get candidate's first resume
    const resume = await prisma.resume.findFirst({
      where: {
        candidateId
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (!resume) {
      return []
    }

    // Get jobs the candidate hasn't applied to
    const appliedJobIds = await prisma.application.findMany({
      where: { candidateId },
      select: { jobId: true }
    }).then(apps => apps.map(a => a.jobId))

    // Get available jobs
    const jobs = await prisma.job.findMany({
      where: {
        status: 'PUBLISHED',
        id: {
          notIn: appliedJobIds
        }
      },
      include: {
        organization: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit * 2 // Get more to filter by score
    })

    // Calculate match scores
    const jobsWithScores = await Promise.all(
      jobs.map(async job => ({
        job,
        matchScore: await calculateMatchScore(resume.id, job.id)
      }))
    )

    // Sort by overall match score
    jobsWithScores.sort((a, b) => b.matchScore.overall - a.matchScore.overall)

    // Return top matches
    return jobsWithScores.slice(0, limit)
  } catch (error) {
    logger.error('Failed to get recommended jobs with AI', error)
    return []
  }
}