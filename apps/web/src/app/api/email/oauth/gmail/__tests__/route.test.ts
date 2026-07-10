import { describe, it, expect, vi, beforeEach } from 'vitest'

// Security wrappers are pass-through in unit tests.
vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (h: unknown) => h }))
vi.mock('@/lib/csrf', () => ({ withCsrfProtection: (h: unknown) => h }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))

// Encryption is stubbed so we can assert tokens never hit the DB in plaintext.
vi.mock('@/lib/encryption', () => ({ encrypt: vi.fn((s: string) => `enc(${s})`) }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userOrgRole: { findFirst: vi.fn() },
    emailAccount: { upsert: vi.fn() },
  },
}))

import { POST } from '../route'
import { auth } from '@/lib/auth'
import { encrypt } from '@/lib/encryption'
import { prisma } from '@/lib/prisma'

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>

const makeReq = (body: unknown) => ({ json: async () => body }) as any

beforeEach(() => {
  vi.clearAllMocks()
})

describe('/api/email/oauth/gmail POST — auth boundary', () => {
  it('returns 401 when unauthenticated', async () => {
    asMock(auth).mockResolvedValue(null)
    const res = await POST(makeReq({ accessToken: 'a', email: 'x@y.com' }))
    expect(res.status).toBe(401)
    expect(prisma.emailAccount.upsert).not.toHaveBeenCalled()
  })
})

describe('/api/email/oauth/gmail POST — token encryption', () => {
  beforeEach(() => {
    asMock(auth).mockResolvedValue({ user: { id: 'u1' } })
    asMock(prisma.userOrgRole.findFirst).mockResolvedValue({ orgId: 'org-1' })
    asMock(prisma.emailAccount.upsert).mockResolvedValue({ id: 'acc-1', email: 'x@y.com' })
  })

  it('rejects an invalid payload with 400', async () => {
    const res = await POST(makeReq({ email: 'not-an-email' }))
    expect(res.status).toBe(400)
    expect(prisma.emailAccount.upsert).not.toHaveBeenCalled()
  })

  it('encrypts tokens and never persists the raw access_token', async () => {
    const res = await POST(
      makeReq({ accessToken: 'secret-access', refreshToken: 'secret-refresh', email: 'x@y.com' }),
    )
    expect(res.status).toBe(200)

    // encrypt() was invoked with the serialized token payload.
    expect(encrypt).toHaveBeenCalledOnce()
    expect(asMock(encrypt).mock.calls[0][0]).toContain('secret-access')

    // The value stored in oauthJson is the encrypted string, not a plaintext object.
    const upsertArg = asMock(prisma.emailAccount.upsert).mock.calls[0][0]
    expect(upsertArg.create.oauthJson).toBe(
      'enc({"access_token":"secret-access","refresh_token":"secret-refresh","expires_in":3600,"token_type":"Bearer"})',
    )
    expect(upsertArg.update.oauthJson).toBe(upsertArg.create.oauthJson)
    expect(typeof upsertArg.create.oauthJson).toBe('string')
  })
})
