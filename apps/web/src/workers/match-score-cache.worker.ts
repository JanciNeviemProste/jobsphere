/**
 * Match Score Caching Worker
 * Pre-calculates match scores for popular jobs to improve performance
 */

import { Worker, Job } from 'bullmq'
import { connection } from '@/lib/queue'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { calculateMatchScore } from '@/lib/ai-matching'
import type { MatchScore as MatchScoreResult } from '@/lib/ai-matching'

export interface MatchScoreCacheJobData {
  jobId: string
  candidateLimit?: number
}

export interface CandidateMatchScoreCacheJobData {
  candidateId: string
  jobIds: string[]
}

type AnyMatchScoreCacheJobData = MatchScoreCacheJobData | CandidateMatchScoreCacheJobData

/**
 * Upsert a single computed match score, keyed on (jobId, candidateId).
 * Shared by both the per-job and per-candidate cache processors.
 */
async function upsertMatchScore(params: {
  orgId: string
  jobId: string
  candidateId: string
  resumeId: string
  matchScore: MatchScoreResult
}) {
  const { orgId, jobId, candidateId, resumeId, matchScore } = params

  await prisma.matchScore.upsert({
    where: {
      jobId_candidateId: { jobId, candidateId },
    },
    create: {
      orgId,
      jobId,
      candidateId,
      resumeId,
      score0to100: matchScore.overall,
      bm25Score: matchScore.skills / 100, // Normalize to 0-1
      vectorScore: matchScore.experience / 100,
      llmScore: matchScore.education / 100,
      evidence: matchScore.details,
      explanation: [], // Add empty array for explanation field
      version: 'v1',
    },
    update: {
      resumeId,
      score0to100: matchScore.overall,
      bm25Score: matchScore.skills / 100,
      vectorScore: matchScore.experience / 100,
      llmScore: matchScore.education / 100,
      evidence: matchScore.details,
    },
  })
}

/**
 * Process match score caching
 */
async function processMatchScoreCaching(job: Job<MatchScoreCacheJobData>) {
  const { jobId, candidateLimit = 100 } = job.data

  logger.info('Starting match score caching', { jobId, candidateLimit, workerJobId: job.id })

  try {
    // Verify job exists
    const jobRecord = await prisma.job.findUnique({
      where: { id: jobId },
    })

    if (!jobRecord) {
      throw new Error(`Job ${jobId} not found`)
    }

    // Get top candidates with resumes (most recent first)
    const candidates = await prisma.candidate.findMany({
      where: {
        resumes: { some: {} },
      },
      include: {
        resumes: {
          select: { id: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: candidateLimit,
    })

    logger.info('Found candidates to process', {
      jobId,
      candidateCount: candidates.length,
      workerJobId: job.id,
    })

    let cached = 0
    let skipped = 0
    let failed = 0

    for (const candidate of candidates) {
      const resume = candidate.resumes[0]

      if (!resume) {
        skipped++
        continue
      }

      try {
        // Calculate match score
        const matchScore = await calculateMatchScore(resume.id, jobId)

        // Upsert into database
        await upsertMatchScore({
          orgId: jobRecord.orgId,
          jobId,
          candidateId: candidate.id,
          resumeId: resume.id,
          matchScore,
        })

        cached++

        // Update progress
        if (cached % 10 === 0) {
          await job.updateProgress((cached / candidates.length) * 100)
          logger.info('Match score caching progress', {
            jobId,
            cached,
            total: candidates.length,
            workerJobId: job.id,
          })
        }
      } catch (error) {
        failed++
        logger.error('Failed to cache match score', {
          candidateId: candidate.id,
          jobId,
          error,
          workerJobId: job.id,
        })
        // Continue with next candidate instead of failing the entire job
      }
    }

    logger.info('Match score caching completed', {
      jobId,
      cached,
      skipped,
      failed,
      total: candidates.length,
      workerJobId: job.id,
    })

    return { cached, skipped, failed, total: candidates.length }
  } catch (error) {
    logger.error('Match score caching job failed', {
      jobId,
      error,
      workerJobId: job.id,
    })
    throw error
  }
}

/**
 * Process per-candidate match score caching.
 *
 * Computes + upserts MatchScore rows for ONE candidate against a bounded set of
 * jobs. Enqueued by the candidate match-scores endpoint to fill cache misses
 * (and refresh stale entries) without ever calling the LLM in the request path.
 */
export async function processCandidateMatchScoreCaching(job: Job<CandidateMatchScoreCacheJobData>) {
  const { candidateId, jobIds } = job.data

  logger.info('Starting candidate match score caching', {
    candidateId,
    jobCount: jobIds?.length ?? 0,
    workerJobId: job.id,
  })

  if (!candidateId || !Array.isArray(jobIds) || jobIds.length === 0) {
    logger.warn('Candidate match score caching: nothing to do', {
      candidateId,
      workerJobId: job.id,
    })
    return { cached: 0, skipped: 0, failed: 0, total: 0 }
  }

  // Resolve the candidate's most recent resume once.
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      resumes: {
        select: { id: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  const resume = candidate?.resumes[0]
  if (!candidate || !resume) {
    logger.warn('Candidate match score caching: candidate has no resume', {
      candidateId,
      workerJobId: job.id,
    })
    return { cached: 0, skipped: jobIds.length, failed: 0, total: jobIds.length }
  }

  let cached = 0
  let skipped = 0
  let failed = 0

  for (const jobId of jobIds) {
    try {
      // Only compute for jobs that still belong to the candidate's org and are
      // published. Guards against stale enqueues / cross-org leakage.
      const jobRecord = await prisma.job.findUnique({
        where: { id: jobId },
        select: { id: true, orgId: true, status: true },
      })

      if (!jobRecord || jobRecord.orgId !== candidate.orgId || jobRecord.status !== 'PUBLISHED') {
        skipped++
        continue
      }

      const matchScore = await calculateMatchScore(resume.id, jobId)

      await upsertMatchScore({
        orgId: jobRecord.orgId,
        jobId,
        candidateId,
        resumeId: resume.id,
        matchScore,
      })

      cached++
    } catch (error) {
      failed++
      logger.error('Failed to cache candidate match score', {
        candidateId,
        jobId,
        error,
        workerJobId: job.id,
      })
      // Continue with next job instead of failing the whole batch.
    }
  }

  logger.info('Candidate match score caching completed', {
    candidateId,
    cached,
    skipped,
    failed,
    total: jobIds.length,
    workerJobId: job.id,
  })

  return { cached, skipped, failed, total: jobIds.length }
}

/**
 * Dispatch by job name so a single queue serves both the per-job
 * (popular-job warm-up) and per-candidate (endpoint cache fill) flows.
 */
async function processMatchScoreCacheJob(job: Job<AnyMatchScoreCacheJobData>) {
  if (job.name === 'cache-candidate-scores') {
    return processCandidateMatchScoreCaching(job as Job<CandidateMatchScoreCacheJobData>)
  }
  return processMatchScoreCaching(job as Job<MatchScoreCacheJobData>)
}

/**
 * Create and start the worker
 */
export const matchScoreCacheWorker = new Worker<AnyMatchScoreCacheJobData>(
  'match-score-cache',
  processMatchScoreCacheJob,
  {
    connection,
    concurrency: 1, // One job at a time to avoid overloading AI API
    limiter: {
      max: 10, // Max 10 jobs per minute
      duration: 60000,
    },
  },
)

// Worker event handlers
matchScoreCacheWorker.on('completed', (job) => {
  logger.info('Match score cache job completed', { jobId: job.id })
})

matchScoreCacheWorker.on('failed', (job, error) => {
  logger.error('Match score cache job failed', {
    jobId: job?.id,
    error,
    data: job?.data,
  })
})

matchScoreCacheWorker.on('error', (error) => {
  logger.error('Match score cache worker error', { error })
})

logger.info('Match score cache worker started')
