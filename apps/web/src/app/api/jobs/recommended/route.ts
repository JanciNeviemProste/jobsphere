/**
 * GET /api/jobs/recommended — job recommendations for the signed-in job seeker.
 *
 * PERF-002: this endpoint used to call `getRecommendedJobsWithAI()`, which fanned
 * out one Anthropic completion (+2 DB reads) per candidate job — ~20 LLM calls and
 * ~40 queries for a single page view. It now serves scores from the cached
 * `MatchScore` table and enqueues cache fills for misses, mirroring
 * `/api/candidates/[id]/match-scores`. No LLM call ever happens in this request.
 *
 * Jobs without a cached AI score are still returned (so the section is never
 * empty) with a cheap, purely local skills-overlap estimate, and the response
 * reports `pending` / `computing` so the client knows real scores are on the way.
 */

import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { errorResponse } from '@/lib/errors'
import { withRateLimit } from '@/lib/rate-limit'
import { requireAuth } from '@/lib/auth'
import { addCandidateMatchScoreCacheJob } from '@/lib/queue'

export const runtime = 'nodejs'

// How many recommendations we return to the client.
const RESULT_LIMIT = 5
// How many published jobs we consider before ranking.
const JOB_POOL = 10
// Cap on cache-fill jobs enqueued per request, to bound worker load.
const MAX_ENQUEUE = 10
// A cached score older than this is considered stale and re-queued.
const CACHE_TTL_DAYS = 7

/** Safely pull a string[] out of the free-form `MatchScore.evidence` JSON. */
function evidenceStrings(evidence: Prisma.JsonValue, key: string): string[] {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return []
  const value = (evidence as Record<string, unknown>)[key]
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

/**
 * Cheap, purely local estimate used while the real AI score is still being
 * computed. No network, no extra queries — same rule as the previous non-AI path.
 */
function heuristicScore(userSkills: string[], description: string | null): number {
  let score = 50 // Base score
  if (userSkills.length > 0 && description) {
    const haystack = description.toLowerCase()
    const matching = userSkills.filter((skill) => haystack.includes(skill.toLowerCase()))
    score += Math.min(matching.length * 10, 30)
  }
  return Math.min(score, 95)
}

export const GET = withRateLimit(
  async () => {
    try {
      logger.apiRequest('GET', '/api/jobs/recommended')

      const session = await requireAuth()
      if (!session.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // A job seeker can own several Candidate rows (one personal profile plus a
      // per-employer copy for each org they applied to — see lib/identity.ts).
      // Collect them all: cached scores may hang off any of them.
      // `deletedAt: null` is injected by the soft-delete middleware in lib/prisma.ts.
      const candidates = await prisma.candidate.findMany({
        where: { userId: session.user.id },
        select: { id: true, orgId: true },
        orderBy: { createdAt: 'asc' },
      })

      if (candidates.length === 0) {
        return NextResponse.json({ jobs: [], total: 0, pending: false, computing: 0 })
      }

      const candidateIds = candidates.map((c) => c.id)

      // Latest resume across all of the user's candidate rows + the jobs they
      // already applied to. Independent reads → run them together.
      const [resume, appliedApplications] = await Promise.all([
        prisma.resume.findFirst({
          where: { candidateId: { in: candidateIds } },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            candidateId: true,
            skills: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.application.findMany({
          where: { candidateId: { in: candidateIds } },
          select: { jobId: true },
        }),
      ])

      const appliedJobIds = appliedApplications.map((a) => a.jobId)
      const userSkills = resume?.skills ?? []

      const jobs = await prisma.job.findMany({
        where: {
          status: 'PUBLISHED',
          id: { notIn: appliedJobIds },
        },
        select: {
          id: true,
          orgId: true,
          title: true,
          description: true,
          city: true,
          salaryMin: true,
          salaryMax: true,
          employmentType: true,
          seniority: true,
          remote: true,
          hybrid: true,
          organization: { select: { name: true, logo: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: JOB_POOL,
      })

      if (jobs.length === 0) {
        return NextResponse.json({ jobs: [], total: 0, pending: false, computing: 0 })
      }

      const jobIds = jobs.map((j) => j.id)

      // Cache read — the expensive scoring is NEVER computed inline.
      const cachedScores = await prisma.matchScore.findMany({
        where: {
          candidateId: { in: candidateIds },
          jobId: { in: jobIds },
        },
        select: {
          jobId: true,
          candidateId: true,
          score0to100: true,
          bm25Score: true,
          vectorScore: true,
          llmScore: true,
          evidence: true,
          updatedAt: true,
        },
        orderBy: { score0to100: 'desc' },
      })

      // Stale = older than the resume it was derived from, or older than the TTL.
      const ttlCutoff = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000)
      const resumeUpdatedAt = resume ? (resume.updatedAt ?? resume.createdAt) : null

      const freshByJobId = new Map<string, (typeof cachedScores)[number]>()
      for (const row of cachedScores) {
        const isStale =
          row.updatedAt < ttlCutoff || (resumeUpdatedAt !== null && row.updatedAt < resumeUpdatedAt)
        if (!isStale && !freshByJobId.has(row.jobId)) {
          freshByJobId.set(row.jobId, row)
        }
      }

      // Bounded async enqueue for misses/stale rows. The per-candidate worker only
      // computes jobs inside the candidate's own org (cross-tenant guard), so only
      // enqueue those — otherwise `pending` would never clear.
      const scoringCandidate =
        candidates.find((c) => c.id === resume?.candidateId) ?? candidates[0] ?? null

      const enqueueableJobIds =
        resume && scoringCandidate
          ? jobs
              .filter((j) => !freshByJobId.has(j.id) && j.orgId === scoringCandidate.orgId)
              .map((j) => j.id)
          : []
      const toEnqueue = enqueueableJobIds.slice(0, MAX_ENQUEUE)

      if (toEnqueue.length > 0 && scoringCandidate) {
        // Fire-and-forget: cache fill is best-effort. safeAdd no-ops without Redis.
        addCandidateMatchScoreCacheJob({
          candidateId: scoringCandidate.id,
          jobIds: toEnqueue,
        }).catch((err) => {
          logger.error('Failed to enqueue recommended-jobs match score cache job', {
            error: err,
            candidateId: scoringCandidate.id,
          })
        })
      }

      // Fast return: cached AI scores where available, local estimate otherwise.
      const jobsWithScores = jobs.map((job) => {
        const cached = freshByJobId.get(job.id)

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
          match: cached ? cached.score0to100 : heuristicScore(userSkills, job.description),
          // `true` while this job is still waiting on its AI score.
          matchPending: !cached,
          ...(cached
            ? {
                matchDetails: {
                  skills: Math.round((cached.bm25Score ?? 0) * 100),
                  experience: Math.round((cached.vectorScore ?? 0) * 100),
                  education: Math.round((cached.llmScore ?? 0) * 100),
                  location: 0,
                  salary: 0,
                  matchedSkills: evidenceStrings(cached.evidence, 'matchedSkills'),
                  missingSkills: evidenceStrings(cached.evidence, 'missingSkills'),
                },
              }
            : {}),
        }
      })

      jobsWithScores.sort((a, b) => b.match - a.match)
      const top = jobsWithScores.slice(0, RESULT_LIMIT)

      return NextResponse.json({
        jobs: top,
        total: top.length,
        // The client can refetch while the worker fills the cache.
        pending: toEnqueue.length > 0,
        computing: toEnqueue.length,
      })
    } catch (error) {
      logger.apiError('GET', '/api/jobs/recommended', error)
      const errorData = errorResponse(error)
      return NextResponse.json({ error: errorData.error }, { status: errorData.statusCode })
    }
  },
  { preset: 'api', byUser: true },
)
