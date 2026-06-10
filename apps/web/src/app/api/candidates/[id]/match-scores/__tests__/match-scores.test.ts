/**
 * PERF-001 — candidate match-scores endpoint must be a fast DB cache lookup,
 * NEVER a synchronous LLM call. Cache misses are enqueued for async fill.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/rate-limit', () => ({
  withRateLimit: (handler: any) => handler,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), apiRequest: vi.fn(), apiError: vi.fn() },
}))

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    candidate: { findUnique: vi.fn() },
    userOrgRole: { findFirst: vi.fn() },
    job: { findMany: vi.fn() },
    matchScore: { findMany: vi.fn() },
  },
}))

// The matching module owns the LLM call. The route must NEVER invoke these.
const { calculateMatchScore, calculateBulkMatchScores } = vi.hoisted(() => ({
  calculateMatchScore: vi.fn(),
  calculateBulkMatchScores: vi.fn(),
}))
vi.mock('@/lib/ai-matching', () => ({ calculateMatchScore, calculateBulkMatchScores }))

const { addCandidateMatchScoreCacheJob } = vi.hoisted(() => ({
  addCandidateMatchScoreCacheJob: vi.fn(),
}))
vi.mock('@/lib/queue', () => ({ addCandidateMatchScoreCacheJob }))

import { GET } from '../route'
import { prisma } from '@/lib/prisma'

function req() {
  return new Request('http://localhost:3000/api/candidates/cand-1/match-scores')
}
const ctx = { params: { id: 'cand-1' } }

const oldDate = new Date('2020-01-01T00:00:00Z')

describe('PERF-001 candidate match-scores cache endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.mockResolvedValue({ user: { id: 'user-1' } })
    addCandidateMatchScoreCacheJob.mockResolvedValue(null)

    vi.mocked(prisma.candidate.findUnique).mockResolvedValue({
      id: 'cand-1',
      orgId: 'org-1',
      resumes: [{ id: 'resume-1', createdAt: oldDate, updatedAt: oldDate }],
    } as any)
    vi.mocked(prisma.userOrgRole.findFirst).mockResolvedValue({
      orgId: 'org-1',
      role: 'RECRUITER',
    } as any)
  })

  it('returns cached scores WITHOUT calling the LLM, and enqueues only for misses', async () => {
    // Two published jobs; only job-1 has a fresh cached score → job-2 is a miss.
    vi.mocked(prisma.job.findMany).mockResolvedValue([
      { id: 'job-1', title: 'A' },
      { id: 'job-2', title: 'B' },
    ] as any)
    vi.mocked(prisma.matchScore.findMany).mockResolvedValue([
      {
        jobId: 'job-1',
        score0to100: 88,
        bm25Score: 0.9,
        vectorScore: 0.8,
        llmScore: 0.7,
        explanation: ['good'],
        updatedAt: new Date(), // fresh
      },
    ] as any)

    const res = await GET(req() as any, ctx as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    // Cached score is returned immediately.
    expect(body.scores).toHaveLength(1)
    expect(body.scores[0].jobId).toBe('job-1')
    expect(body.scores[0].matchScore).toBe(88)

    // The LLM matching functions are NEVER called in the request path.
    expect(calculateMatchScore).not.toHaveBeenCalled()
    expect(calculateBulkMatchScores).not.toHaveBeenCalled()

    // The miss (job-2) is enqueued for async cache fill.
    expect(addCandidateMatchScoreCacheJob).toHaveBeenCalledTimes(1)
    expect(addCandidateMatchScoreCacheJob).toHaveBeenCalledWith({
      candidateId: 'cand-1',
      jobIds: ['job-2'],
    })
    expect(body.pending).toBe(true)
    expect(body.computing).toBe(1)
  })

  it('does not enqueue when every job has a fresh cached score', async () => {
    vi.mocked(prisma.job.findMany).mockResolvedValue([{ id: 'job-1', title: 'A' }] as any)
    vi.mocked(prisma.matchScore.findMany).mockResolvedValue([
      {
        jobId: 'job-1',
        score0to100: 70,
        bm25Score: null,
        vectorScore: null,
        llmScore: null,
        explanation: [],
        updatedAt: new Date(),
      },
    ] as any)

    const res = await GET(req() as any, ctx as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(calculateMatchScore).not.toHaveBeenCalled()
    expect(addCandidateMatchScoreCacheJob).not.toHaveBeenCalled()
    expect(body.pending).toBe(false)
    expect(body.computing).toBe(0)
  })

  it('treats a cached row older than the resume update as stale and re-queues it', async () => {
    // Resume updated AFTER the cached score → stale → must be re-queued.
    vi.mocked(prisma.candidate.findUnique).mockResolvedValue({
      id: 'cand-1',
      orgId: 'org-1',
      resumes: [{ id: 'resume-1', createdAt: oldDate, updatedAt: new Date() }],
    } as any)
    vi.mocked(prisma.job.findMany).mockResolvedValue([{ id: 'job-1', title: 'A' }] as any)
    vi.mocked(prisma.matchScore.findMany).mockResolvedValue([
      {
        jobId: 'job-1',
        score0to100: 70,
        bm25Score: null,
        vectorScore: null,
        llmScore: null,
        explanation: [],
        updatedAt: oldDate, // older than the resume update → stale
      },
    ] as any)

    const res = await GET(req() as any, ctx as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(calculateMatchScore).not.toHaveBeenCalled()
    expect(addCandidateMatchScoreCacheJob).toHaveBeenCalledWith({
      candidateId: 'cand-1',
      jobIds: ['job-1'],
    })
    expect(body.pending).toBe(true)
  })

  it('denies a non-member with 403 and never queries the cache', async () => {
    vi.mocked(prisma.userOrgRole.findFirst).mockResolvedValue(null as any)

    const res = await GET(req() as any, ctx as any)
    expect(res.status).toBe(403)
    expect(prisma.matchScore.findMany).not.toHaveBeenCalled()
    expect(calculateMatchScore).not.toHaveBeenCalled()
  })
})
