/**
 * PR3 — Interview scheduling endpoint.
 *
 * Invariants pinned here:
 *  - 401 without a session (never writes).
 *  - 403 when the caller is NOT a member of the application's org (IDOR guard);
 *    orgId is taken from the application, never the request.
 *  - 200 happy path for a VIDEO interview (meetingUrl persisted).
 *  - 200 happy path for an ONSITE interview: the chosen branch's address is
 *    snapshotted into `location`.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/csrf', () => ({ withCsrfProtection: (handler: any) => handler }))
vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (handler: any) => handler }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), apiRequest: vi.fn(), apiError: vi.fn() },
}))
vi.mock('@/lib/sanitize', () => ({ sanitizeNote: (s: string) => s }))

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    application: { findUnique: vi.fn(), update: vi.fn() },
    userOrgRole: { findFirst: vi.fn() },
    branch: { findUnique: vi.fn() },
    interview: { create: vi.fn() },
    applicationActivity: { create: vi.fn() },
  },
}))

import { POST } from '../route'
import { prisma } from '@/lib/prisma'

const APP_ID = 'app-1'
const ctx = { params: { id: APP_ID } }

function req(body: unknown) {
  return { json: async () => body } as any
}

const validVideoBody = {
  type: 'VIDEO',
  scheduledAt: '2026-08-01T10:00:00.000Z',
  durationMin: 45,
  meetingUrl: 'https://meet.example.com/abc',
}

describe('POST /api/applications/[id]/interviews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.mockResolvedValue({ user: { id: 'user-1' } })
    // Application belongs to org-1; caller is a member of org-1.
    vi.mocked(prisma.application.findUnique).mockResolvedValue({
      id: APP_ID,
      stage: 'SCREENING',
      job: { orgId: 'org-1', title: 'Engineer' },
    } as any)
    vi.mocked(prisma.userOrgRole.findFirst).mockResolvedValue({ orgId: 'org-1' } as any)
    vi.mocked(prisma.interview.create).mockResolvedValue({
      id: 'int-1',
      scheduledAt: new Date('2026-08-01T10:00:00.000Z'),
    } as any)
    vi.mocked(prisma.application.update).mockResolvedValue({} as any)
    vi.mocked(prisma.applicationActivity.create).mockResolvedValue({} as any)
  })

  it('returns 401 without a session and never writes', async () => {
    auth.mockResolvedValueOnce(null)

    const res = await POST(req(validVideoBody), ctx as any)

    expect(res.status).toBe(401)
    expect(prisma.interview.create).not.toHaveBeenCalled()
  })

  it('returns 403 for a caller outside the application org (IDOR)', async () => {
    vi.mocked(prisma.application.findUnique).mockResolvedValueOnce({
      id: APP_ID,
      stage: 'NEW',
      job: { orgId: 'org-owner', title: 'Engineer' },
    } as any)
    vi.mocked(prisma.userOrgRole.findFirst).mockResolvedValueOnce(null as any)

    const res = await POST(req(validVideoBody), ctx as any)

    expect(res.status).toBe(403)
    // Membership was checked against the application's own org.
    const membershipArg = vi.mocked(prisma.userOrgRole.findFirst).mock.calls[0][0] as any
    expect(membershipArg.where).toEqual({ userId: 'user-1', orgId: 'org-owner' })
    expect(prisma.interview.create).not.toHaveBeenCalled()
  })

  it('creates a VIDEO interview and moves the application to INTERVIEW', async () => {
    const res = await POST(req(validVideoBody), ctx as any)

    expect(res.status).toBe(201)
    expect(prisma.interview.create).toHaveBeenCalledTimes(1)
    const arg = vi.mocked(prisma.interview.create).mock.calls[0][0] as any
    expect(arg.data.applicationId).toBe(APP_ID)
    // orgId comes from the application, not the request body.
    expect(arg.data.orgId).toBe('org-1')
    expect(arg.data.type).toBe('VIDEO')
    expect(arg.data.meetingUrl).toBe('https://meet.example.com/abc')
    expect(arg.data.createdBy).toBe('user-1')
    expect(arg.data.scheduledAt).toBeInstanceOf(Date)

    // Stage advanced + timeline activity written.
    expect(prisma.application.update).toHaveBeenCalledWith({
      where: { id: APP_ID },
      data: { stage: 'INTERVIEW' },
    })
    expect(prisma.applicationActivity.create).toHaveBeenCalledTimes(1)
  })

  it('snapshots the branch address into location for an ONSITE interview', async () => {
    vi.mocked(prisma.branch.findUnique).mockResolvedValue({
      id: 'branch-1',
      orgId: 'org-1',
      deletedAt: null,
      name: 'Bratislava HQ',
      street: 'Hlavná 1',
      city: 'Bratislava',
      region: null,
      postalCode: '811 01',
      country: 'Slovensko',
    } as any)

    const res = await POST(
      req({ type: 'ONSITE', scheduledAt: '2026-08-01T09:00:00.000Z', branchId: 'branch-1' }),
      ctx as any,
    )

    expect(res.status).toBe(201)
    const arg = vi.mocked(prisma.interview.create).mock.calls[0][0] as any
    expect(arg.data.branchId).toBe('branch-1')
    expect(arg.data.location).toBe('Bratislava HQ, Hlavná 1, 811 01, Bratislava, Slovensko')
  })

  it('rejects an ONSITE interview whose branch belongs to another org', async () => {
    vi.mocked(prisma.branch.findUnique).mockResolvedValue({
      id: 'branch-x',
      orgId: 'org-other',
      deletedAt: null,
      name: 'Other',
    } as any)

    const res = await POST(
      req({ type: 'ONSITE', scheduledAt: '2026-08-01T09:00:00.000Z', branchId: 'branch-x' }),
      ctx as any,
    )

    expect(res.status).toBe(400)
    expect(prisma.interview.create).not.toHaveBeenCalled()
  })
})
