/**
 * Match Score Caching Worker
 * Pre-calculates match scores for popular jobs to improve performance
 */

import { Worker, Job } from 'bullmq'
import { connection } from '@/lib/queue'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { calculateMatchScore } from '@/lib/ai-matching'

export interface MatchScoreCacheJobData {
  jobId: string
  candidateLimit?: number
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
      where: { id: jobId }
    })

    if (!jobRecord) {
      throw new Error(`Job ${jobId} not found`)
    }

    // Get top candidates with resumes (most recent first)
    const candidates = await prisma.candidate.findMany({
      where: {
        resumes: { some: {} }
      },
      include: {
        resumes: {
          select: { id: true },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: candidateLimit
    })

    logger.info('Found candidates to process', {
      jobId,
      candidateCount: candidates.length,
      workerJobId: job.id
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
        await prisma.matchScore.upsert({
          where: {
            jobId_candidateId: {
              jobId,
              candidateId: candidate.id
            }
          },
          create: {
            orgId: jobRecord.orgId,
            jobId,
            candidateId: candidate.id,
            resumeId: resume.id,
            score0to100: matchScore.overall,
            bm25Score: matchScore.skills / 100, // Normalize to 0-1
            vectorScore: matchScore.experience / 100,
            llmScore: matchScore.education / 100,
            evidence: matchScore.details,
            explanation: [], // Add empty array for explanation field
            version: 'v1'
          },
          update: {
            resumeId: resume.id,
            score0to100: matchScore.overall,
            bm25Score: matchScore.skills / 100,
            vectorScore: matchScore.experience / 100,
            llmScore: matchScore.education / 100,
            evidence: matchScore.details
          }
        })

        cached++

        // Update progress
        if (cached % 10 === 0) {
          await job.updateProgress((cached / candidates.length) * 100)
          logger.info('Match score caching progress', {
            jobId,
            cached,
            total: candidates.length,
            workerJobId: job.id
          })
        }
      } catch (error) {
        failed++
        logger.error('Failed to cache match score', {
          candidateId: candidate.id,
          jobId,
          error,
          workerJobId: job.id
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
      workerJobId: job.id
    })

    return { cached, skipped, failed, total: candidates.length }
  } catch (error) {
    logger.error('Match score caching job failed', {
      jobId,
      error,
      workerJobId: job.id
    })
    throw error
  }
}

/**
 * Create and start the worker
 */
export const matchScoreCacheWorker = new Worker<MatchScoreCacheJobData>(
  'match-score-cache',
  processMatchScoreCaching,
  {
    connection,
    concurrency: 1, // One job at a time to avoid overloading AI API
    limiter: {
      max: 10, // Max 10 jobs per minute
      duration: 60000
    }
  }
)

// Worker event handlers
matchScoreCacheWorker.on('completed', (job) => {
  logger.info('Match score cache job completed', { jobId: job.id })
})

matchScoreCacheWorker.on('failed', (job, error) => {
  logger.error('Match score cache job failed', {
    jobId: job?.id,
    error,
    data: job?.data
  })
})

matchScoreCacheWorker.on('error', (error) => {
  logger.error('Match score cache worker error', { error })
})

logger.info('Match score cache worker started')
