import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { errorResponse } from '@/lib/errors'
import { withRateLimit } from '@/lib/rate-limit'
import { requireAuth } from '@/lib/auth'
import { getRecommendedJobsWithAI, calculateMatchScore } from '@/lib/ai-matching'

export const runtime = 'nodejs'

export const GET = withRateLimit(
  async (req: Request) => {
    try {
      logger.apiRequest('GET', '/api/jobs/recommended')

      const session = await requireAuth()
      if (!session.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const url = new URL(req.url)
      const useAI = url.searchParams.get('ai') !== 'false'

      // If AI matching is enabled and API key is configured
      if (useAI && process.env.ANTHROPIC_API_KEY) {
        const recommendedJobs = await getRecommendedJobsWithAI(session.user.id, 5)

        const formattedJobs = recommendedJobs.map(({ job, matchScore }) => ({
          id: job.id,
          title: job.title,
          company: job.organization.name,
          companyLogo: job.organization.logo,
          location: job.city,
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
          type: job.employmentType,
          workMode: job.remote ? 'REMOTE' : job.hybrid ? 'HYBRID' : 'ONSITE',
          seniority: job.seniority,
          match: matchScore.overall,
          matchDetails: {
            skills: matchScore.skills,
            experience: matchScore.experience,
            education: matchScore.education,
            location: matchScore.location,
            salary: matchScore.salary,
            matchedSkills: matchScore.details.matchedSkills,
            missingSkills: matchScore.details.missingSkills,
          },
        }))

        return NextResponse.json(formattedJobs)
      }

      // Fallback to simple matching if AI is not available
      // Get user's candidate profile first. Resolve via the canonical
      // Candidate.userId link (the previous `orgId: session.user.id` compared the
      // org column against a User id and always returned null).
      const candidate = await prisma.candidate.findFirst({
        where: {
          userId: session.user.id,
          deletedAt: null,
        },
      })

      if (!candidate) {
        return NextResponse.json({ jobs: [], total: 0 })
      }

      // Get user's resume for matching
      const resume = await prisma.resume.findFirst({
        where: {
          candidateId: candidate.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      // Get user's applied job IDs to exclude
      const appliedJobIds = await prisma.application
        .findMany({
          where: { candidateId: candidate.id },
          select: { jobId: true },
        })
        .then((apps) => apps.map((a) => a.jobId))

      // Extract user skills from resume
      const userSkills: string[] = []
      if (resume?.skills) {
        userSkills.push(...resume.skills)
      }

      // Get recommended jobs
      let recommendedJobs = await prisma.job.findMany({
        where: {
          status: 'PUBLISHED',
          id: {
            notIn: appliedJobIds,
          },
        },
        include: {
          organization: {
            select: {
              name: true,
              logo: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
      })

      // Calculate basic match scores
      const jobsWithScores = recommendedJobs.map((job) => {
        let matchScore = 50 // Base score

        // Simple skill matching using description
        if (userSkills.length > 0 && job.description) {
          const jobDescription = job.description.toLowerCase()
          const matchingSkills = userSkills.filter((skill) =>
            jobDescription.includes(skill.toLowerCase()),
          )
          matchScore += Math.min(matchingSkills.length * 10, 30)
        }

        // Location and salary matching removed since user preference fields don't exist
        // These could be extended later with actual preference fields

        // Cap at 95%
        matchScore = Math.min(matchScore, 95)

        return {
          id: job.id,
          title: job.title,
          company: job.organization.name,
          companyLogo: job.organization.logo,
          location: job.city,
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
          type: job.employmentType,
          workMode: job.remote ? 'REMOTE' : job.hybrid ? 'HYBRID' : 'ONSITE',
          seniority: job.seniority,
          match: matchScore,
        }
      })

      // Sort by match score
      jobsWithScores.sort((a, b) => b.match - a.match)

      // Return top 5 recommendations
      return NextResponse.json(jobsWithScores.slice(0, 5))
    } catch (error) {
      logger.apiError('GET', '/api/jobs/recommended', error)
      const errorData = errorResponse(error)
      return NextResponse.json({ error: errorData.error }, { status: errorData.statusCode })
    }
  },
  { preset: 'api', byUser: true },
)
