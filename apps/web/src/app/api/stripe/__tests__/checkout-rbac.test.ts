/**
 * AUTH-006 — billing is ORG_ADMIN-only.
 * A RECRUITER attempting Stripe checkout must be denied (403).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('stripe', () => ({
  default: class StripeMock {
    customers = { create: vi.fn() }
    checkout = { sessions: { create: vi.fn() } }
    constructor() {}
  },
}))

vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (h: any) => h }))
vi.mock('@/lib/csrf', () => ({ withCsrfProtection: (h: any) => h }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userOrgRole: { findFirst: vi.fn() },
    orgCustomer: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}))

import { POST } from '../checkout/route'
import { prisma } from '@/lib/prisma'

function req(plan = 'PROFESSIONAL') {
  return new Request('http://localhost:3000/api/stripe/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan }),
  })
}

describe('AUTH-006 stripe checkout role gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.mockResolvedValue({ user: { id: 'user-1', email: 'a@b.c' } })
  })

  it('denies a RECRUITER with 403', async () => {
    vi.mocked(prisma.userOrgRole.findFirst).mockResolvedValue({
      orgId: 'org-1',
      role: 'RECRUITER',
      organization: { name: 'Acme' },
    } as any)

    const res = await POST(req() as any)
    expect(res.status).toBe(403)
    // must not have reached Stripe customer creation
    expect(prisma.orgCustomer.findUnique).not.toHaveBeenCalled()
  })

  it('denies a HIRING_MANAGER with 403', async () => {
    vi.mocked(prisma.userOrgRole.findFirst).mockResolvedValue({
      orgId: 'org-1',
      role: 'HIRING_MANAGER',
      organization: { name: 'Acme' },
    } as any)

    const res = await POST(req() as any)
    expect(res.status).toBe(403)
  })
})
