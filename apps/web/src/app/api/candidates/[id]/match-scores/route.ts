import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { addCandidateMatchScoreCacheJob } from '@/lib/queue'
import { logger } from '@/lib/logger'
import { errorResponse } from '@/lib/errors'
import { withRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// Return at most this many cached scores (top matches, by score desc).
const MAX_RESULTS = 50
// Cap how many cache-fill jobs we enqueue per request to bound worker load.
const MAX_ENQUEUE = 25
// A cached score older than this is considered stale and re-queued.
const CACHE_TTL_DAYS = 7

export const GET = withRateLimit(
  async (req: NextRequest, context?: { params?: Record<string, string> }) => {
    try {
      const candidateId = context?.params?.id
      if (!candidateId) {
        return NextResponse.json({ error: 'Candidate ID is required' }, { status: 400 })
      }

      logger.apiRequest('GET', `/api/candidates/${candidateId}/match-scores`)

      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Get candidate and verify access
      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
        include: {
          resumes: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      })

      if (!candidate) {
        return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
      }

      const latestResume = candidate.resumes[0]
      if (!latestResume) {
        return NextResponse.json({ error: 'No resume found for candidate' }, { status: 404 })
      }

      // Verify user has access to this candidate's organization
      const membership = await prisma.userOrgRole.findFirst({
        where: {
          userId: session.user.id,
          orgId: candidate.orgId,
        },
      })

      if (!membership) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }

      // All published jobs for the org. We only need IDs + display fields here;
      // the expensive scoring is read from the MatchScore cache (never computed inline).
      const jobs = await prisma.job.findMany({
        where: {
          orgId: candidate.orgId,
          status: 'PUBLISHED',
        },
        select: {
          id: true,
          title: true,
          city: true,
          salaryMin: true,
          salaryMax: true,
          remote: true,
          hybrid: true,
          employmentType: true,
          seniority: true,
        },
      })

      if (jobs.length === 0) {
        return NextResponse.json({ scores: [], pending: false, computing: 0 })
      }

      const jobIds = jobs.map((j) => j.id)
      const jobById = new Map(jobs.map((j) => [j.id, j]))

      // 1) Cache read: existing MatchScore rows for this candidate, top N by score.
      const cachedScores = await prisma.matchScore.findMany({
        where: {
          candidateId,
          jobId: { in: jobIds },
        },
        select: {
          jobId: true,
          score0to100: true,
          bm25Score: true,
          vectorScore: true,
          llmScore: true,
          explanation: true,
          updatedAt: true,
        },
        orderBy: { score0to100: 'desc' },
        take: MAX_RESULTS,
      })

      // 2) Determine cache misses + stale entries so we can refresh them async.
      // Stale = cached row older than the candidate's latest resume update, or
      // older than CACHE_TTL_DAYS.
      const ttlCutoff = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000)
      const resumeUpdatedAt = latestResume.updatedAt ?? latestResume.createdAt

      const freshByJobId = new Map<string, (typeof cachedScores)[number]>()
      for (const row of cachedScores) {
        const isStale = row.updatedAt < ttlCutoff || row.updatedAt < resumeUpdatedAt
        if (!isStale) {
          freshByJobId.set(row.jobId, row)
        }
      }

      const jobIdsNeedingRefresh = jobIds.filter((id) => !freshByJobId.has(id))
      const toEnqueue = jobIdsNeedingRefresh.slice(0, MAX_ENQUEUE)

      // 3) Bounded async enqueue — NEVER compute the LLM score in this request.
      if (toEnqueue.length > 0) {
        // Fire-and-forget: cache fill is best-effort. safeAdd no-ops without Redis.
        addCandidateMatchScoreCacheJob({ candidateId, jobIds: toEnqueue }).catch((err) => {
          logger.error('Failed to enqueue candidate match score cache job', {
            error: err,
            candidateId,
          })
        })
      }

      // 4) Fast return: cached scores enriched with job details.
      const enrichedScores = cachedScores.map((row) => {
        const job = jobById.get(row.jobId) ?? null
        return {
          jobId: row.jobId,
          matchScore: row.score0to100,
          bm25Score: row.bm25Score,
          vectorScore: row.vectorScore,
          llmScore: row.llmScore,
          explanation: row.explanation,
          job,
        }
      })

      return NextResponse.json({
        scores: enrichedScores,
        // The client can poll while the worker fills the cache.
        pending: jobIdsNeedingRefresh.length > 0,
        computing: toEnqueue.length,
      })
    } catch (error) {
      const candidateId = context?.params?.id || 'unknown'
      logger.apiError('GET', `/api/candidates/${candidateId}/match-scores`, error)
      const errorData = errorResponse(error)
      return NextResponse.json({ error: errorData.error }, { status: errorData.statusCode })
    }
  },
  { preset: 'api', byUser: true },
)
