import { describe, it, expect, vi, beforeEach } from 'vitest'

// Wrappers are pass-through in the unit test (CSRF already bypasses in NODE_ENV=test).
vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (h: unknown) => h }))
vi.mock('@/lib/csrf', () => ({ withCsrfProtection: (h: unknown) => h }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    gig: { findUnique: vi.fn(), update: vi.fn() },
    userOrgRole: { findFirst: vi.fn() },
    gigProposal: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { PATCH } from '../route'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const patch = (body: unknown, params: { id: string; proposalId: string }) =>
  PATCH(
    new Request('http://localhost/api/gigs/x/proposals/y', {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
    { params },
  )

beforeEach(() => {
  vi.clearAllMocks()
})

describe('gig proposal PATCH — cross-gig IDOR guard', () => {
  it("404s and mutates nothing when the proposal is not in the caller's gig", async () => {
    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'u1' } })
    ;(prisma.gig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ orgId: 'org-A' })
    ;(prisma.userOrgRole.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      orgId: 'org-A',
    })
    // proposal belongs to a DIFFERENT gig → scoped lookup returns null
    ;(prisma.gigProposal.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const res = await patch({ action: 'REJECT' }, { id: 'gig-A', proposalId: 'prop-foreign' })

    expect(res.status).toBe(404)
    expect(prisma.gigProposal.update).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects a proposal that belongs to the gig', async () => {
    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'u1' } })
    ;(prisma.gig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ orgId: 'org-A' })
    ;(prisma.userOrgRole.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      orgId: 'org-A',
    })
    ;(prisma.gigProposal.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'prop-1' })
    ;(prisma.gigProposal.update as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const res = await patch({ action: 'REJECT' }, { id: 'gig-A', proposalId: 'prop-1' })

    expect(res.status).toBe(200)
    expect(prisma.gigProposal.update).toHaveBeenCalledWith({
      where: { id: 'prop-1' },
      data: { status: 'REJECTED' },
    })
  })

  it('forbids a caller who is not a member of the gig org (no proposal lookup)', async () => {
    ;(auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'u2' } })
    ;(prisma.gig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ orgId: 'org-A' })
    ;(prisma.userOrgRole.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const res = await patch({ action: 'ACCEPT' }, { id: 'gig-A', proposalId: 'prop-1' })

    expect(res.status).toBe(403)
    expect(prisma.gigProposal.findFirst).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
