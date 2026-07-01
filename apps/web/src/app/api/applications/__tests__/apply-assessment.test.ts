import { describe, it, expect, vi, beforeEach } from 'vitest'

// Security wrappers are pass-through in unit tests.
vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (h: unknown) => h }))
vi.mock('@/lib/csrf', () => ({ withCsrfProtection: (h: unknown) => h }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))
vi.mock('@/lib/identity', () => ({
  getOrCreateCandidateForUser: vi.fn(),
  getPersonalCandidateForUser: vi.fn(),
}))
vi.mock('@/lib/assessment-invite', () => ({ createOrGetAssessmentInvite: vi.fn() }))
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(),
  getApplicationReceivedEmail: vi.fn(() => '<html></html>'),
  getNewApplicationEmail: vi.fn(() => '<html></html>'),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    job: { findUnique: vi.fn() },
    application: { findFirst: vi.fn(), create: vi.fn() },
    applicationActivity: { create: vi.fn() },
    userOrgRole: { findFirst: vi.fn() },
  },
}))

import { POST } from '../route'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getOrCreateCandidateForUser } from '@/lib/identity'
import { createOrGetAssessmentInvite } from '@/lib/assessment-invite'

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>

const JOB_ID = 'clxjob000000000000000000a'
const req = (body: unknown) =>
  new Request('http://localhost/api/applications', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })

beforeEach(() => {
  vi.clearAllMocks()
  asMock(auth).mockResolvedValue({ user: { id: 'u1', email: 'a@b.co', name: 'Applicant' } })
  asMock(getOrCreateCandidateForUser).mockResolvedValue({ id: 'cand1' })
  asMock(prisma.application.findFirst).mockResolvedValue(null)
  asMock(prisma.application.create).mockResolvedValue({
    id: 'app1',
    job: { title: 'Dev', orgId: 'org1', organization: { name: 'Acme' } },
  })
  asMock(prisma.applicationActivity.create).mockResolvedValue({})
  asMock(prisma.userOrgRole.findFirst).mockResolvedValue(null) // skip employer email
})

describe('POST /api/applications — assessment on apply (L52/L54)', () => {
  it('mints an assessment invite and returns its token when the job requires one', async () => {
    asMock(prisma.job.findUnique).mockResolvedValue({
      orgId: 'org1',
      status: 'PUBLISHED',
      requiresAssessment: true,
      assessmentId: 'assess1',
    })
    asMock(createOrGetAssessmentInvite).mockResolvedValue({
      token: 'apply-token',
      status: 'SENT',
      created: true,
    })

    const res = await POST(req({ jobId: JOB_ID, coverLetter: 'x'.repeat(60) }))
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.assessmentInvite).toEqual({ assessmentId: 'assess1', token: 'apply-token' })
    expect(createOrGetAssessmentInvite).toHaveBeenCalledWith(
      expect.objectContaining({ assessmentId: 'assess1', candidateId: 'cand1', jobId: JOB_ID }),
    )
  })

  it('does not create an invite when the job does not require an assessment', async () => {
    asMock(prisma.job.findUnique).mockResolvedValue({
      orgId: 'org1',
      status: 'PUBLISHED',
      requiresAssessment: false,
      assessmentId: null,
    })

    const res = await POST(req({ jobId: JOB_ID, coverLetter: 'x'.repeat(60) }))
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.assessmentInvite).toBeUndefined()
    expect(createOrGetAssessmentInvite).not.toHaveBeenCalled()
  })
})
