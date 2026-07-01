/**
 * PR3 — Branch CRUD endpoints (org-scoped).
 *
 * Invariants pinned here:
 *  - POST 401 without a session.
 *  - POST 200 happy (org taken from the caller's membership, not the request).
 *  - POST isPrimary exclusivity: creating a primary branch demotes the others.
 *  - PATCH/DELETE 401, 403 cross-org (IDOR guard), 200 happy.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/csrf', () => ({ withCsrfProtection: (handler: any) => handler }))
vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (handler: any) => handler }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), apiRequest: vi.fn(), apiError: vi.fn() },
}))

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth }))

// Build the prisma mock via vi.hoisted so $transaction can invoke the callback
// with the same mock object as `tx` (branch.create/update/updateMany).
const { prismaMock } = vi.hoisted(() => {
  const p: any = {
    userOrgRole: { findFirst: vi.fn() },
    branch: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  }
  p.$transaction = vi.fn(async (fn: any) => fn(p))
  return { prismaMock: p }
})
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

import { POST } from '../route'
import { PATCH, DELETE } from '../[branchId]/route'
import { prisma } from '@/lib/prisma'

function req(body: unknown) {
  return { json: async () => body } as any
}

describe('POST /api/organizations/current/branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.mockResolvedValue({ user: { id: 'user-1' } })
    vi.mocked(prisma.userOrgRole.findFirst).mockResolvedValue({ orgId: 'org-1' } as any)
    vi.mocked(prisma.branch.create).mockResolvedValue({ id: 'branch-1', isPrimary: false } as any)
    vi.mocked(prisma.branch.updateMany).mockResolvedValue({ count: 0 } as any)
  })

  it('returns 401 without a session and never writes', async () => {
    auth.mockResolvedValueOnce(null)

    const res = await POST(req({ name: 'HQ' }))

    expect(res.status).toBe(401)
    expect(prisma.branch.create).not.toHaveBeenCalled()
  })

  it('creates a branch scoped to the caller org', async () => {
    const res = await POST(req({ name: 'HQ', city: 'Bratislava' }))

    expect(res.status).toBe(201)
    const arg = vi.mocked(prisma.branch.create).mock.calls[0][0] as any
    expect(arg.data.orgId).toBe('org-1')
    expect(arg.data.name).toBe('HQ')
    // A non-primary create must not demote existing branches.
    expect(prisma.branch.updateMany).not.toHaveBeenCalled()
  })

  it('demotes other primaries when creating a primary branch (exclusivity)', async () => {
    const res = await POST(req({ name: 'HQ', isPrimary: true }))

    expect(res.status).toBe(201)
    expect(prisma.branch.updateMany).toHaveBeenCalledTimes(1)
    const arg = vi.mocked(prisma.branch.updateMany).mock.calls[0][0] as any
    expect(arg.where).toMatchObject({ orgId: 'org-1', isPrimary: true, deletedAt: null })
    expect(arg.data).toEqual({ isPrimary: false })
  })

  it('rejects a missing name with 400', async () => {
    const res = await POST(req({ city: 'Bratislava' }))
    expect(res.status).toBe(400)
    expect(prisma.branch.create).not.toHaveBeenCalled()
  })
})

describe('PATCH/DELETE /api/organizations/current/branches/[branchId]', () => {
  const ctx = { params: { branchId: 'branch-1' } }

  beforeEach(() => {
    vi.clearAllMocks()
    auth.mockResolvedValue({ user: { id: 'user-1' } })
    vi.mocked(prisma.userOrgRole.findFirst).mockResolvedValue({ orgId: 'org-1' } as any)
    vi.mocked(prisma.branch.findUnique).mockResolvedValue({
      id: 'branch-1',
      orgId: 'org-1',
      deletedAt: null,
    } as any)
    vi.mocked(prisma.branch.update).mockResolvedValue({ id: 'branch-1' } as any)
    vi.mocked(prisma.branch.updateMany).mockResolvedValue({ count: 0 } as any)
  })

  it('PATCH returns 401 without a session', async () => {
    auth.mockResolvedValueOnce(null)
    const res = await PATCH(req({ name: 'New' }), ctx as any)
    expect(res.status).toBe(401)
    expect(prisma.branch.update).not.toHaveBeenCalled()
  })

  it('PATCH returns 403 for a branch owned by another org (IDOR)', async () => {
    vi.mocked(prisma.branch.findUnique).mockResolvedValueOnce({
      id: 'branch-1',
      orgId: 'org-other',
      deletedAt: null,
    } as any)

    const res = await PATCH(req({ name: 'New' }), ctx as any)

    expect(res.status).toBe(403)
    expect(prisma.branch.update).not.toHaveBeenCalled()
  })

  it('PATCH updates the branch on the happy path', async () => {
    const res = await PATCH(req({ name: 'Renamed' }), ctx as any)

    expect(res.status).toBe(200)
    const arg = vi.mocked(prisma.branch.update).mock.calls[0][0] as any
    expect(arg.where).toEqual({ id: 'branch-1' })
    expect(arg.data.name).toBe('Renamed')
  })

  it('PATCH isPrimary demotes sibling primaries (exclusivity)', async () => {
    const res = await PATCH(req({ isPrimary: true }), ctx as any)

    expect(res.status).toBe(200)
    expect(prisma.branch.updateMany).toHaveBeenCalledTimes(1)
    const arg = vi.mocked(prisma.branch.updateMany).mock.calls[0][0] as any
    expect(arg.where).toMatchObject({
      orgId: 'org-1',
      isPrimary: true,
      deletedAt: null,
      id: { not: 'branch-1' },
    })
  })

  it('DELETE soft-deletes on the happy path', async () => {
    const res = await DELETE(req({}), ctx as any)

    expect(res.status).toBe(200)
    const arg = vi.mocked(prisma.branch.update).mock.calls[0][0] as any
    expect(arg.where).toEqual({ id: 'branch-1' })
    expect(arg.data.deletedAt).toBeInstanceOf(Date)
  })

  it('DELETE returns 403 for a branch owned by another org (IDOR)', async () => {
    vi.mocked(prisma.branch.findUnique).mockResolvedValueOnce({
      id: 'branch-1',
      orgId: 'org-other',
      deletedAt: null,
    } as any)

    const res = await DELETE(req({}), ctx as any)

    expect(res.status).toBe(403)
    expect(prisma.branch.update).not.toHaveBeenCalled()
  })
})
