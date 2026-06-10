/**
 * AUTH-006 — role gate on PII CSV export.
 * A HIRING_MANAGER / AGENCY member must be denied (403); RECRUITER/ORG_ADMIN allowed.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

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
    userOrgRole: { findFirst: vi.fn() },
    application: { findMany: vi.fn() },
  },
}))

import { GET } from '../route'
import { prisma } from '@/lib/prisma'

function req() {
  return new Request('http://localhost:3000/api/applications/export')
}

describe('AUTH-006 export role gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.mockResolvedValue({ user: { id: 'user-1', email: 'a@b.c' } })
  })

  it('denies a HIRING_MANAGER with 403', async () => {
    vi.mocked(prisma.userOrgRole.findFirst).mockResolvedValue({
      orgId: 'org-1',
      role: 'HIRING_MANAGER',
    } as any)

    const res = await GET(req() as any)
    expect(res.status).toBe(403)
    expect(prisma.application.findMany).not.toHaveBeenCalled()
  })

  it('denies an AGENCY with 403', async () => {
    vi.mocked(prisma.userOrgRole.findFirst).mockResolvedValue({
      orgId: 'org-1',
      role: 'AGENCY',
    } as any)

    const res = await GET(req() as any)
    expect(res.status).toBe(403)
  })

  it('allows a RECRUITER', async () => {
    vi.mocked(prisma.userOrgRole.findFirst).mockResolvedValue({
      orgId: 'org-1',
      role: 'RECRUITER',
    } as any)
    vi.mocked(prisma.application.findMany).mockResolvedValue([])

    const res = await GET(req() as any)
    expect(res.status).toBe(200)
    expect(prisma.application.findMany).toHaveBeenCalled()
  })
})
