/**
 * SEC / PERF regression tests for the match-score cache worker.
 *
 * SECURITY: `processMatchScoreCaching` used to select the 100 most recently
 * created candidates ACROSS EVERY TENANT (`where: { resumes: { some: {} } }`),
 * compute match scores for them and write MatchScore rows tagged with the job's
 * orgId — cross-tenant rows in the scores table plus Anthropic spend burned on
 * other organizations' candidates. The candidate query MUST be scoped to the
 * job's own organization.
 *
 * PERF: the grading loop must run with bounded concurrency rather than one
 * sequential LLM round-trip per candidate, while keeping the cached/skipped/
 * failed counters and per-candidate error isolation intact.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// The worker module instantiates a BullMQ Worker at import time. Mock bullmq and
// the queue module so importing it is side-effect free (no Redis connection).
vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(() => ({ on: vi.fn() })),
  Job: class {},
}))
vi.mock('@/lib/queue', () => ({ connection: {} }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    job: { findUnique: vi.fn() },
    candidate: { findMany: vi.fn(), findUnique: vi.fn() },
    matchScore: { upsert: vi.fn() },
  },
}))

const { calculateMatchScore } = vi.hoisted(() => ({ calculateMatchScore: vi.fn() }))
vi.mock('@/lib/ai-matching', () => ({ calculateMatchScore }))

import {
  processMatchScoreCaching,
  processCandidateMatchScoreCaching,
} from '../match-score-cache.worker'
import { prisma } from '@/lib/prisma'

const JOB_ID = 'job-1'
const ORG_ID = 'org-1'
const OTHER_ORG_ID = 'org-2'

const score = {
  overall: 80,
  skills: 70,
  experience: 60,
  education: 50,
  location: 40,
  salary: 30,
  details: { matchedSkills: [], missingSkills: [] },
}

function workerJob(data: Record<string, unknown>) {
  return { id: 'w1', data, updateProgress: vi.fn() } as any
}

function makeCandidate(id: string) {
  return { id, orgId: ORG_ID, resumes: [{ id: `resume-${id}` }] }
}

describe('match-score-cache worker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    calculateMatchScore.mockResolvedValue(score)
    vi.mocked(prisma.matchScore.upsert).mockResolvedValue({} as any)
    vi.mocked(prisma.job.findUnique).mockResolvedValue({ id: JOB_ID, orgId: ORG_ID } as any)
    vi.mocked(prisma.candidate.findMany).mockResolvedValue([] as any)
  })

  describe('SECURITY: tenant scoping', () => {
    it('scopes the candidate query to the job orgId (no cross-tenant scoring)', async () => {
      await processMatchScoreCaching(workerJob({ jobId: JOB_ID }))

      expect(prisma.candidate.findMany).toHaveBeenCalledTimes(1)
      const args = vi.mocked(prisma.candidate.findMany).mock.calls[0][0] as any

      // The regression: without this the worker scored every tenant's candidates.
      expect(args.where.orgId).toBe(ORG_ID)
      expect(args.where).toMatchObject({ orgId: ORG_ID, resumes: { some: {} } })
    })

    it('uses the job’s own orgId, not a hardcoded or unrelated org', async () => {
      vi.mocked(prisma.job.findUnique).mockResolvedValue({
        id: JOB_ID,
        orgId: OTHER_ORG_ID,
      } as any)

      await processMatchScoreCaching(workerJob({ jobId: JOB_ID }))

      const args = vi.mocked(prisma.candidate.findMany).mock.calls[0][0] as any
      expect(args.where.orgId).toBe(OTHER_ORG_ID)
    })

    it('never scores candidates when the job does not exist', async () => {
      vi.mocked(prisma.job.findUnique).mockResolvedValue(null as any)

      await expect(processMatchScoreCaching(workerJob({ jobId: JOB_ID }))).rejects.toThrow(
        /not found/,
      )
      expect(prisma.candidate.findMany).not.toHaveBeenCalled()
      expect(calculateMatchScore).not.toHaveBeenCalled()
    })
  })

  describe('PERF: bounded concurrency + counters', () => {
    it('processes candidates concurrently but bounded, preserving counters', async () => {
      const candidates = Array.from({ length: 12 }, (_, i) => makeCandidate(`c${i}`))
      vi.mocked(prisma.candidate.findMany).mockResolvedValue(candidates as any)

      let inFlight = 0
      let maxInFlight = 0
      calculateMatchScore.mockImplementation(async () => {
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise((r) => setTimeout(r, 1))
        inFlight--
        return score
      })

      const result = await processMatchScoreCaching(workerJob({ jobId: JOB_ID }))

      expect(result).toEqual({ cached: 12, skipped: 0, failed: 0, total: 12 })
      // Not serial...
      expect(maxInFlight).toBeGreaterThan(1)
      // ...but still bounded.
      expect(maxInFlight).toBeLessThanOrEqual(5)
    })

    it('isolates per-candidate failures without aborting the batch', async () => {
      const candidates = [makeCandidate('c0'), makeCandidate('c1'), makeCandidate('c2')]
      vi.mocked(prisma.candidate.findMany).mockResolvedValue(candidates as any)

      calculateMatchScore.mockImplementation(async (resumeId: string) => {
        if (resumeId === 'resume-c1') throw new Error('anthropic boom')
        return score
      })

      const result = await processMatchScoreCaching(workerJob({ jobId: JOB_ID }))

      expect(result).toEqual({ cached: 2, skipped: 0, failed: 1, total: 3 })
    })

    it('counts candidates without a resume as skipped', async () => {
      vi.mocked(prisma.candidate.findMany).mockResolvedValue([
        makeCandidate('c0'),
        { id: 'c1', orgId: ORG_ID, resumes: [] },
      ] as any)

      const result = await processMatchScoreCaching(workerJob({ jobId: JOB_ID }))

      expect(result).toEqual({ cached: 1, skipped: 1, failed: 0, total: 2 })
    })
  })

  describe('per-candidate cache fill', () => {
    beforeEach(() => {
      vi.mocked(prisma.candidate.findUnique).mockResolvedValue({
        id: 'cand-1',
        orgId: ORG_ID,
        resumes: [{ id: 'resume-1' }],
      } as any)
    })

    it('skips jobs belonging to another organization', async () => {
      vi.mocked(prisma.job.findUnique).mockImplementation((async (args: any) =>
        args.where.id === 'job-same'
          ? { id: 'job-same', orgId: ORG_ID, status: 'PUBLISHED' }
          : { id: args.where.id, orgId: OTHER_ORG_ID, status: 'PUBLISHED' }) as any)

      const result = await processCandidateMatchScoreCaching(
        workerJob({ candidateId: 'cand-1', jobIds: ['job-same', 'job-cross'] }),
      )

      expect(result).toEqual({ cached: 1, skipped: 1, failed: 0, total: 2 })
      expect(calculateMatchScore).toHaveBeenCalledTimes(1)
      expect(calculateMatchScore).toHaveBeenCalledWith('resume-1', 'job-same')
    })

    it('runs bounded-concurrently over the job ids', async () => {
      vi.mocked(prisma.job.findUnique).mockImplementation((async (args: any) => ({
        id: args.where.id,
        orgId: ORG_ID,
        status: 'PUBLISHED',
      })) as any)

      let inFlight = 0
      let maxInFlight = 0
      calculateMatchScore.mockImplementation(async () => {
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise((r) => setTimeout(r, 1))
        inFlight--
        return score
      })

      const jobIds = Array.from({ length: 11 }, (_, i) => `job-${i}`)
      const result = await processCandidateMatchScoreCaching(
        workerJob({ candidateId: 'cand-1', jobIds }),
      )

      expect(result).toEqual({ cached: 11, skipped: 0, failed: 0, total: 11 })
      expect(maxInFlight).toBeGreaterThan(1)
      expect(maxInFlight).toBeLessThanOrEqual(5)
    })
  })
})
