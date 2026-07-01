/**
 * PR2 L44 — HR match-score override endpoint.
 *
 * Invariants pinned here:
 *  - 401 without a session.
 *  - 403 when the caller is NOT a member of the application's org (IDOR guard).
 *  - 200 happy path writes the override (score + overrideBy = caller).
 *  - overrideScore=null clears the override (nulls the audit fields too).
 *  - Out-of-range score → 400, no write.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/csrf', () => ({
  withCsrfProtection: (handler: any) => handler,
}))

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
    application: { findUnique: vi.fn() },
    userOrgRole: { findFirst: vi.fn() },
    matchScore: { upsert: vi.fn() },
  },
}))

import { PATCH } from '../route'
import { prisma } from '@/lib/prisma'

const APP_ID = 'app-1'
const ctx = { params: { id: APP_ID } }

function req(body: unknown) {
  return { json: async () => body } as any
}

describe('PATCH /api/applications/[id]/match-score — HR override', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.mockResolvedValue({ user: { id: 'user-1' } })
    vi.mocked(prisma.application.findUnique).mockResolvedValue({
      jobId: 'job-1',
      candidateId: 'cand-1',
      job: { orgId: 'org-1' },
    } as any)
    vi.mocked(prisma.userOrgRole.findFirst).mockResolvedValue({ orgId: 'org-1' } as any)
  })

  it('returns 401 without a session and never writes', async () => {
    auth.mockResolvedValueOnce(null)

    const res = await PATCH(req({ overrideScore: 90 }), ctx as any)

    expect(res.status).toBe(401)
    expect(prisma.matchScore.upsert).not.toHaveBeenCalled()
  })

  it('returns 403 for a caller outside the application org (IDOR)', async () => {
    // Application belongs to another org; caller has no membership there.
    vi.mocked(prisma.application.findUnique).mockResolvedValueOnce({
      jobId: 'job-1',
      candidateId: 'cand-1',
      job: { orgId: 'org-owner' },
    } as any)
    vi.mocked(prisma.userOrgRole.findFirst).mockResolvedValueOnce(null as any)

    const res = await PATCH(req({ overrideScore: 90 }), ctx as any)

    expect(res.status).toBe(403)
    // Membership was checked against the application's own org.
    const membershipArg = vi.mocked(prisma.userOrgRole.findFirst).mock.calls[0][0] as any
    expect(membershipArg.where).toEqual({ userId: 'user-1', orgId: 'org-owner' })
    // No cross-org write happened.
    expect(prisma.matchScore.upsert).not.toHaveBeenCalled()
  })

  it('returns 404 when the application does not exist', async () => {
    vi.mocked(prisma.application.findUnique).mockResolvedValueOnce(null as any)

    const res = await PATCH(req({ overrideScore: 55 }), ctx as any)

    expect(res.status).toBe(404)
    expect(prisma.matchScore.upsert).not.toHaveBeenCalled()
  })

  it('writes the override on the happy path and returns the display score', async () => {
    vi.mocked(prisma.matchScore.upsert).mockResolvedValue({
      score0to100: 42,
      overrideScore: 90,
      overrideBy: 'user-1',
      overrideAt: new Date('2026-01-01T00:00:00Z'),
      overrideReason: 'strong culture fit',
    } as any)

    const res = await PATCH(
      req({ overrideScore: 90, overrideReason: 'strong culture fit' }),
      ctx as any,
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.overrideScore).toBe(90)
    // Displayed value prefers the override; the AI archive is preserved.
    expect(body.displayScore).toBe(90)
    expect(body.score0to100).toBe(42)

    expect(prisma.matchScore.upsert).toHaveBeenCalledTimes(1)
    const arg = vi.mocked(prisma.matchScore.upsert).mock.calls[0][0] as any
    expect(arg.where).toEqual({ jobId_candidateId: { jobId: 'job-1', candidateId: 'cand-1' } })
    expect(arg.update.overrideScore).toBe(90)
    expect(arg.update.overrideBy).toBe('user-1')
    expect(arg.update.overrideReason).toBe('strong culture fit')
    expect(arg.update.overrideAt).toBeInstanceOf(Date)
  })

  it('clears the override when overrideScore is null', async () => {
    vi.mocked(prisma.matchScore.upsert).mockResolvedValue({
      score0to100: 42,
      overrideScore: null,
      overrideBy: null,
      overrideAt: null,
      overrideReason: null,
    } as any)

    const res = await PATCH(req({ overrideScore: null }), ctx as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.overrideScore).toBeNull()
    // Falls back to the AI archive score.
    expect(body.displayScore).toBe(42)

    const arg = vi.mocked(prisma.matchScore.upsert).mock.calls[0][0] as any
    expect(arg.update).toEqual({
      overrideScore: null,
      overrideBy: null,
      overrideAt: null,
      overrideReason: null,
    })
  })

  it('rejects an out-of-range score with 400 and no write', async () => {
    const res = await PATCH(req({ overrideScore: 150 }), ctx as any)

    expect(res.status).toBe(400)
    expect(prisma.matchScore.upsert).not.toHaveBeenCalled()
  })
})
