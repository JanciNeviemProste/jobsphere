import { describe, it, expect, vi, beforeEach } from 'vitest'

// Security wrappers are pass-through in unit tests.
vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (h: unknown) => h }))
vi.mock('@/lib/csrf', () => ({ withCsrfProtection: (h: unknown) => h }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    userOrgRole: { findFirst: vi.fn() },
    organization: { findUnique: vi.fn() },
  },
}))

const createMock = vi.fn(async () => ({
  content: [{ type: 'text', text: 'Vygenerovaný firemný profil.' }],
}))
vi.mock('@anthropic-ai/sdk', () => ({
  Anthropic: vi.fn().mockImplementation(() => ({ messages: { create: createMock } })),
}))

import { POST } from '../route'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>

const req = (body?: unknown) =>
  new Request('http://localhost/api/organizations/org1/generate-profile', {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
    headers: { 'content-type': 'application/json' },
  })
const ctx = { params: { id: 'org1' } }

beforeEach(() => {
  vi.clearAllMocks()
  process.env.ANTHROPIC_API_KEY = 'test-key'
})

describe('/api/organizations/[id]/generate-profile', () => {
  it('returns 401 when unauthenticated', async () => {
    asMock(auth).mockResolvedValue(null)
    const res = await POST(req(), ctx)
    expect(res.status).toBe(401)
    expect(prisma.userOrgRole.findFirst).not.toHaveBeenCalled()
  })

  it('returns 403 when the caller is not a member of the org', async () => {
    asMock(auth).mockResolvedValue({ user: { id: 'u1' } })
    asMock(prisma.userOrgRole.findFirst).mockResolvedValue(null)
    const res = await POST(req(), ctx)
    expect(res.status).toBe(403)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('generates a draft description for a member', async () => {
    asMock(auth).mockResolvedValue({ user: { id: 'u1' } })
    asMock(prisma.userOrgRole.findFirst).mockResolvedValue({ id: 'role1' })
    asMock(prisma.organization.findUnique).mockResolvedValue({
      name: 'Acme',
      industry: 'Technology',
      description: null,
    })
    const res = await POST(req({ brandText: 'We build robots.' }), ctx)
    expect(res.status).toBe(200)
    expect((await res.json()).description).toBe('Vygenerovaný firemný profil.')
    expect(createMock).toHaveBeenCalledOnce()
  })
})
