import { describe, it, expect, vi, beforeEach } from 'vitest'

// Rate-limit wrapper is pass-through in unit tests.
vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (h: unknown) => h }))
vi.mock('@/lib/logger', () => ({
  logger: { apiRequest: vi.fn(), apiError: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

const { requireAuth } = vi.hoisted(() => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireAuth }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userOrgRole: { findFirst: vi.fn() },
    candidate: { findFirst: vi.fn() },
    resume: { findMany: vi.fn() },
  },
}))

import { GET } from '../route'
import { prisma } from '@/lib/prisma'

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

describe('/api/user/cvs — tenant + owner scoping', () => {
  it('scopes candidate lookup to the calling user (orgId + userId)', async () => {
    asMock(requireAuth).mockResolvedValue({ user: { id: 'user-1' } })
    asMock(prisma.userOrgRole.findFirst).mockResolvedValue({ orgId: 'org-1' })
    asMock(prisma.candidate.findFirst).mockResolvedValue(null)

    const res = await GET(new Request('http://localhost/api/user/cvs'))

    expect(res.status).toBe(200)
    expect(prisma.candidate.findFirst).toHaveBeenCalledWith({
      where: { orgId: 'org-1', userId: 'user-1' },
    })
  })
})
