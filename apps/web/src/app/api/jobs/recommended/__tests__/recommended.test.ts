/**
 * PERF-002 — GET /api/jobs/recommended must be a fast DB cache lookup, NEVER a
 * synchronous LLM fan-out. It previously called `calculateMatchScore()` (one
 * Anthropic completion + 2 queries) once per candidate job, so a single page view
 * cost ~20 LLM calls and ~40 queries.
 *
 * Locks in:
 *  1. no LLM / Anthropic call in the request path
 *  2. cached MatchScore rows are returned immediately
 *  3. cache misses are enqueued on the match-score-cache queue
 *  4. jobs without a cached score are still returned (section is never empty)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/rate-limit', () => ({
  withRateLimit: (handler: any) => handler,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), apiRequest: vi.fn(), apiError: vi.fn() },
}))

vi.mock('@/lib/errors', () => ({
  errorResponse: () => ({ error: 'Internal error', statusCode: 500 }),
}))

const { requireAuth } = vi.hoisted(() => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAuth }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    candidate: { findMany: vi.fn() },
    resume: { findFirst: vi.fn() },
    application: { findMany: vi.fn() },
    job: { findMany: vi.fn() },
    matchScore: { findMany: vi.fn() },
  },
}))

// The matching module owns the LLM call. The route must NEVER invoke it.
const { calculateMatchScore } = vi.hoisted(() => ({ calculateMatchScore: vi.fn() }))
vi.mock('@/lib/ai-matching', () => ({ calculateMatchScore }))

// Guard against any direct Anthropic usage sneaking back into the request path.
const { anthropicCreate } = vi.hoisted(() => ({ anthropicCreate: vi.fn() }))
vi.mock('@anthropic-ai/sdk', () => ({
  Anthropic: vi.fn().mockImplementation(() => ({ messages: { create: anthropicCreate } })),
}))

const { addCandidateMatchScoreCacheJob } = vi.hoisted(() => ({
  addCandidateMatchScoreCacheJob: vi.fn(),
}))
vi.mock('@/lib/queue', () => ({ addCandidateMatchScoreCacheJob }))

import { GET } from '../route'
import { prisma } from '@/lib/prisma'

const USER_ID = 'user-1'
const ORG_ID = 'org-1'
const CANDIDATE_ID = 'cand-1'

const oldDate = new Date('2020-01-01T00:00:00Z')

function req() {
  return new Request('http://localhost:3000/api/jobs/recommended')
}

function makeJob(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    orgId: ORG_ID,
    title: `Job ${id}`,
    description: 'react typescript',
    city: 'Bratislava',
    salaryMin: 1000,
    salaryMax: 2000,
    employmentType: 'FULL_TIME',
    seniority: 'MID',
    remote: false,
    hybrid: false,
    organization: { name: 'Acme', logo: null },
    ...overrides,
  }
}

describe('PERF-002 GET /api/jobs/recommended (cache-backed, no inline LLM)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAuth.mockResolvedValue({ user: { id: USER_ID } })
    addCandidateMatchScoreCacheJob.mockResolvedValue(null)

    vi.mocked(prisma.candidate.findMany).mockResolvedValue([
      { id: CANDIDATE_ID, orgId: ORG_ID },
    ] as any)
    vi.mocked(prisma.resume.findFirst).mockResolvedValue({
      id: 'resume-1',
      candidateId: CANDIDATE_ID,
      skills: ['React', 'TypeScript'],
      createdAt: oldDate,
      updatedAt: oldDate,
    } as any)
    vi.mocked(prisma.application.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.matchScore.findMany).mockResolvedValue([] as any)
  })

  it('returns cached scores WITHOUT calling the LLM, and enqueues only for misses', async () => {
    vi.mocked(prisma.job.findMany).mockResolvedValue([makeJob('job-1'), makeJob('job-2')] as any)
    vi.mocked(prisma.matchScore.findMany).mockResolvedValue([
      {
        jobId: 'job-1',
        candidateId: CANDIDATE_ID,
        score0to100: 88,
        bm25Score: 0.9,
        vectorScore: 0.8,
        llmScore: 0.7,
        evidence: { matchedSkills: ['React'], missingSkills: ['Go'] },
        updatedAt: new Date(), // fresh
      },
    ] as any)

    const res = await GET(req() as any)
    const body = await res.json()

    expect(res.status).toBe(200)

    // The LLM is NEVER invoked in the request path.
    expect(calculateMatchScore).not.toHaveBeenCalled()
    expect(anthropicCreate).not.toHaveBeenCalled()

    // Cached score is served straight from the DB.
    const scored = body.jobs.find((j: any) => j.id === 'job-1')
    expect(scored.match).toBe(88)
    expect(scored.matchPending).toBe(false)
    expect(scored.matchDetails).toEqual({
      skills: 90,
      experience: 80,
      education: 70,
      location: 0,
      salary: 0,
      matchedSkills: ['React'],
      missingSkills: ['Go'],
    })

    // The miss (job-2) is enqueued for async cache fill.
    expect(addCandidateMatchScoreCacheJob).toHaveBeenCalledTimes(1)
    expect(addCandidateMatchScoreCacheJob).toHaveBeenCalledWith({
      candidateId: CANDIDATE_ID,
      jobIds: ['job-2'],
    })
    expect(body.pending).toBe(true)
    expect(body.computing).toBe(1)
  })

  it('still returns jobs that have no cached score, flagged as pending', async () => {
    vi.mocked(prisma.job.findMany).mockResolvedValue([makeJob('job-2')] as any)

    const res = await GET(req() as any)
    const body = await res.json()

    expect(calculateMatchScore).not.toHaveBeenCalled()
    expect(body.jobs).toHaveLength(1)
    expect(body.jobs[0].id).toBe('job-2')
    // Local heuristic estimate only — no AI breakdown yet.
    expect(typeof body.jobs[0].match).toBe('number')
    expect(body.jobs[0].matchPending).toBe(true)
    expect(body.jobs[0].matchDetails).toBeUndefined()
    expect(body.pending).toBe(true)
  })

  it('does not enqueue when every job has a fresh cached score', async () => {
    vi.mocked(prisma.job.findMany).mockResolvedValue([makeJob('job-1')] as any)
    vi.mocked(prisma.matchScore.findMany).mockResolvedValue([
      {
        jobId: 'job-1',
        candidateId: CANDIDATE_ID,
        score0to100: 70,
        bm25Score: null,
        vectorScore: null,
        llmScore: null,
        evidence: {},
        updatedAt: new Date(),
      },
    ] as any)

    const res = await GET(req() as any)
    const body = await res.json()

    expect(calculateMatchScore).not.toHaveBeenCalled()
    expect(addCandidateMatchScoreCacheJob).not.toHaveBeenCalled()
    expect(body.pending).toBe(false)
    expect(body.computing).toBe(0)
  })

  it('treats a cached row older than the resume update as stale and re-queues it', async () => {
    vi.mocked(prisma.resume.findFirst).mockResolvedValue({
      id: 'resume-1',
      candidateId: CANDIDATE_ID,
      skills: [],
      createdAt: oldDate,
      updatedAt: new Date(), // resume updated AFTER the cached score
    } as any)
    vi.mocked(prisma.job.findMany).mockResolvedValue([makeJob('job-1')] as any)
    vi.mocked(prisma.matchScore.findMany).mockResolvedValue([
      {
        jobId: 'job-1',
        candidateId: CANDIDATE_ID,
        score0to100: 70,
        bm25Score: null,
        vectorScore: null,
        llmScore: null,
        evidence: {},
        updatedAt: oldDate,
      },
    ] as any)

    const res = await GET(req() as any)
    const body = await res.json()

    expect(calculateMatchScore).not.toHaveBeenCalled()
    expect(addCandidateMatchScoreCacheJob).toHaveBeenCalledWith({
      candidateId: CANDIDATE_ID,
      jobIds: ['job-1'],
    })
    expect(body.pending).toBe(true)
  })

  it('does not enqueue cache fills for jobs outside the candidate org', async () => {
    // The per-candidate worker refuses cross-org jobs, so enqueuing them would
    // leave `pending` stuck true forever.
    vi.mocked(prisma.job.findMany).mockResolvedValue([
      makeJob('job-other', { orgId: 'org-2' }),
    ] as any)

    const res = await GET(req() as any)
    const body = await res.json()

    expect(addCandidateMatchScoreCacheJob).not.toHaveBeenCalled()
    expect(body.jobs).toHaveLength(1)
    expect(body.pending).toBe(false)
  })

  it('returns an empty payload when the user has no candidate profile', async () => {
    vi.mocked(prisma.candidate.findMany).mockResolvedValue([] as any)

    const res = await GET(req() as any)
    const body = await res.json()

    expect(body).toEqual({ jobs: [], total: 0, pending: false, computing: 0 })
    expect(prisma.job.findMany).not.toHaveBeenCalled()
    expect(calculateMatchScore).not.toHaveBeenCalled()
  })

  it('scopes the cached-score lookup to the signed-in user’s own candidate rows', async () => {
    vi.mocked(prisma.job.findMany).mockResolvedValue([makeJob('job-1')] as any)

    await GET(req() as any)

    expect(vi.mocked(prisma.candidate.findMany).mock.calls[0][0]).toMatchObject({
      where: { userId: USER_ID },
    })
    expect(vi.mocked(prisma.matchScore.findMany).mock.calls[0][0]).toMatchObject({
      where: { candidateId: { in: [CANDIDATE_ID] } },
    })
  })
})
