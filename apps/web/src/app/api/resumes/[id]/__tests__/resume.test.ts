/**
 * Resume GET endpoint — soft-delete guard tests.
 *
 * Covers:
 * - 404 when candidate.deletedAt is set (soft-deleted candidate)
 * - 200 with resume JSON when deletedAt is null and user has org membership
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/rate-limit', () => ({
  withRateLimit: (handler: any) => handler,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    resume: { findUnique: vi.fn() },
    userOrgRole: { findFirst: vi.fn() },
  },
}))

import { GET } from '../route'
import { prisma } from '@/lib/prisma'

function req() {
  return new Request('http://localhost:3000/api/resumes/resume-1')
}

const ctx = { params: { id: 'resume-1' } }

const baseResume = {
  id: 'resume-1',
  candidateId: 'cand-1',
  fileUrl: '/uploads/cvs/resume-1.pdf',
  candidate: {
    id: 'cand-1',
    orgId: 'org-1',
    deletedAt: null,
    contacts: [],
  },
}

describe('GET /api/resumes/[id] — soft-delete guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.mockResolvedValue({ user: { id: 'user-1' } })
    vi.mocked(prisma.userOrgRole.findFirst).mockResolvedValue({
      orgId: 'org-1',
      role: 'RECRUITER',
    } as any)
  })

  it('returns 404 when candidate.deletedAt is set (soft-deleted)', async () => {
    vi.mocked(prisma.resume.findUnique).mockResolvedValue({
      ...baseResume,
      candidate: {
        ...baseResume.candidate,
        deletedAt: new Date('2025-01-01T00:00:00Z'),
      },
    } as any)

    const res = await GET(req() as any, ctx as any)
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body).toEqual({ error: 'Resume not found' })
    // Must not reach org membership check
    expect(prisma.userOrgRole.findFirst).not.toHaveBeenCalled()
  })

  it('returns 200 with resume JSON when deletedAt is null and user has org membership', async () => {
    vi.mocked(prisma.resume.findUnique).mockResolvedValue(baseResume as any)

    const res = await GET(req() as any, ctx as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe('resume-1')
    expect(body.candidate.orgId).toBe('org-1')
  })

  it('returns 404 when resume does not exist at all', async () => {
    vi.mocked(prisma.resume.findUnique).mockResolvedValue(null)

    const res = await GET(req() as any, ctx as any)
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body).toEqual({ error: 'Resume not found' })
  })

  it('returns 401 when not authenticated', async () => {
    auth.mockResolvedValue(null)

    const res = await GET(req() as any, ctx as any)
    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not a member of the candidate org', async () => {
    vi.mocked(prisma.resume.findUnique).mockResolvedValue(baseResume as any)
    vi.mocked(prisma.userOrgRole.findFirst).mockResolvedValue(null)

    const res = await GET(req() as any, ctx as any)
    expect(res.status).toBe(403)
  })
})
