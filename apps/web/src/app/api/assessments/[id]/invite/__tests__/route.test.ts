import { describe, it, expect, vi, beforeEach } from 'vitest'

// Security wrappers are pass-through in unit tests.
vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (h: unknown) => h }))
vi.mock('@/lib/csrf', () => ({ withCsrfProtection: (h: unknown) => h }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    assessment: { findUnique: vi.fn() },
    userOrgRole: { findFirst: vi.fn() },
    candidate: { findFirst: vi.fn() },
    job: { findFirst: vi.fn() },
  },
}))
vi.mock('@/lib/assessment-invite', () => ({ createOrGetAssessmentInvite: vi.fn() }))

import { POST } from '../route'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createOrGetAssessmentInvite } from '@/lib/assessment-invite'

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>

const CANDIDATE_ID = 'clxr0a1b2c3d4e5f6g7h8i9j0'
const ctx = { params: { id: 'a1' } }
const req = (body: unknown) =>
  new Request('http://localhost/api/assessments/a1/invite', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/assessments/[id]/invite', () => {
  it('returns 401 when unauthenticated', async () => {
    asMock(auth).mockResolvedValue(null)
    const res = await POST(req({ candidateId: CANDIDATE_ID }), ctx)
    expect(res.status).toBe(401)
    expect(createOrGetAssessmentInvite).not.toHaveBeenCalled()
  })

  it('returns 403 when the caller is not a member of the assessment org', async () => {
    asMock(auth).mockResolvedValue({ user: { id: 'u1' } })
    asMock(prisma.assessment.findUnique).mockResolvedValue({ id: 'a1', orgId: 'org-owner' })
    asMock(prisma.userOrgRole.findFirst).mockResolvedValue(null) // not a member
    const res = await POST(req({ candidateId: CANDIDATE_ID }), ctx)
    expect(res.status).toBe(403)
    expect(createOrGetAssessmentInvite).not.toHaveBeenCalled()
  })

  it('issues a token for a recruiter member of the org (happy path)', async () => {
    asMock(auth).mockResolvedValue({ user: { id: 'u1' } })
    asMock(prisma.assessment.findUnique).mockResolvedValue({ id: 'a1', orgId: 'org1' })
    asMock(prisma.userOrgRole.findFirst).mockResolvedValue({ role: 'RECRUITER' })
    asMock(prisma.candidate.findFirst).mockResolvedValue({ id: CANDIDATE_ID })
    asMock(createOrGetAssessmentInvite).mockResolvedValue({
      token: 'issued-token',
      status: 'SENT',
      created: true,
    })

    const res = await POST(req({ candidateId: CANDIDATE_ID }), ctx)
    expect([200, 201]).toContain(res.status)
    const body = await res.json()
    expect(body.token).toBe('issued-token')
    expect(createOrGetAssessmentInvite).toHaveBeenCalledWith(
      expect.objectContaining({ assessmentId: 'a1', candidateId: CANDIDATE_ID }),
    )
  })
})
