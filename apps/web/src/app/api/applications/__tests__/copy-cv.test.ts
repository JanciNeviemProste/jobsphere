import { describe, it, expect, vi, beforeEach } from 'vitest'

// Pass-through security wrappers so importing the route module is side-effect free.
vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (h: unknown) => h }))
vi.mock('@/lib/csrf', () => ({ withCsrfProtection: (h: unknown) => h }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))
vi.mock('@/lib/identity', () => ({
  getPersonalCandidateForUser: vi.fn(),
  getOrCreateCandidateForUser: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: { resume: { findFirst: vi.fn() }, $transaction: vi.fn() },
}))

import { copyProfileCvToCandidate } from '../route'
import { prisma } from '@/lib/prisma'
import { getPersonalCandidateForUser } from '@/lib/identity'

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  asMock(getPersonalCandidateForUser).mockResolvedValue({ id: 'personal-1' })
})

describe('copyProfileCvToCandidate — IDOR isolation', () => {
  it("refuses to copy a cvId that is NOT the caller's CV (and copies nothing)", async () => {
    // findFirst is scoped to the caller's personal candidate → foreign cvId returns null.
    asMock(prisma.resume.findFirst).mockResolvedValue(null)

    const ok = await copyProfileCvToCandidate('user-A', 'employer-cand-1', 'cv-of-user-B')

    expect(ok).toBe(false)
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.resume.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'cv-of-user-B', candidateId: 'personal-1' }),
      }),
    )
  })

  it('copies the CV when it belongs to the caller, normalizing builder→employer shape', async () => {
    asMock(prisma.resume.findFirst).mockResolvedValue({
      id: 'cv1',
      candidateId: 'personal-1',
      sourceDocument: null,
      language: 'sk',
      summary: null,
      yearsOfExperience: null,
      personalInfo: {},
      languages: [],
      skills: ['JS'],
      experiences: [
        { position: 'Dev', company: 'ACME', period: '2020-2022', current: false, description: 'x' },
      ],
      education: [{ school: 'Uni', degree: 'BSc', field: 'CS', year: '2020' }],
    })
    const tx = { candidateDocument: { create: vi.fn() }, resume: { create: vi.fn() } }
    asMock(prisma.$transaction).mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx))

    const ok = await copyProfileCvToCandidate('user-A', 'employer-cand-1', 'cv1')

    expect(ok).toBe(true)
    expect(tx.resume.create).toHaveBeenCalledTimes(1)
    const data = (tx.resume.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data
    expect(data.candidateId).toBe('employer-cand-1')
    expect(data.experiences[0]).toMatchObject({
      title: 'Dev',
      company: 'ACME',
      startDate: '2020-2022',
      endDate: '',
    })
    expect(data.education[0]).toMatchObject({
      institution: 'Uni',
      degree: 'BSc',
      field: 'CS',
      endDate: '2020',
    })
  })

  it('is best-effort: returns false (never throws) when the DB lookup fails', async () => {
    asMock(prisma.resume.findFirst).mockRejectedValue(new Error('db down'))
    await expect(copyProfileCvToCandidate('user-A', 'employer-cand-1', 'cv1')).resolves.toBe(false)
  })
})
