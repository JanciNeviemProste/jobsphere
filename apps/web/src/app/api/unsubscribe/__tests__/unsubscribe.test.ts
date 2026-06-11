/**
 * LOGIC-011 — unsubscribe token + endpoint.
 *
 *  - A valid HMAC token upserts an EmailSuppressionList row (reason UNSUBSCRIBED).
 *  - An invalid/forged token is rejected (400) and writes nothing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/rate-limit', () => ({
  withRateLimit: (handler: any) => handler,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { emailSuppressionList: { upsert: vi.fn() } },
}))

import { GET } from '../route'
import { prisma } from '@/lib/prisma'
import { generateUnsubscribeToken, verifyUnsubscribeToken } from '@/lib/unsubscribe'

const EMAIL = 'user@example.com'

function req(url: string) {
  return { url } as any
}

describe('LOGIC-011 — unsubscribe token helper', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = '5e7d659701318fd16b0b45bc476cc37358b91a0a4c8ed625d811bec6abb3f1ec'
  })

  it('verifies its own token and rejects a forged one', () => {
    const token = generateUnsubscribeToken(EMAIL)
    expect(verifyUnsubscribeToken(EMAIL, token)).toBe(true)
    expect(verifyUnsubscribeToken(EMAIL, 'deadbeef')).toBe(false)
    expect(verifyUnsubscribeToken('other@example.com', token)).toBe(false)
  })

  it('is case/whitespace-insensitive for the email', () => {
    const token = generateUnsubscribeToken(EMAIL)
    expect(verifyUnsubscribeToken('  USER@Example.com ', token)).toBe(true)
  })
})

describe('LOGIC-011 — GET /api/unsubscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ENCRYPTION_KEY = '5e7d659701318fd16b0b45bc476cc37358b91a0a4c8ed625d811bec6abb3f1ec'
  })

  it('upserts a suppression row for a valid token', async () => {
    vi.mocked(prisma.emailSuppressionList.upsert).mockResolvedValue({} as any)
    const token = generateUnsubscribeToken(EMAIL)

    const res = await GET(
      req(`https://app.test/api/unsubscribe?email=${encodeURIComponent(EMAIL)}&token=${token}`),
    )

    expect(res.status).toBe(200)
    expect(prisma.emailSuppressionList.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: EMAIL },
        create: expect.objectContaining({ email: EMAIL, reason: 'UNSUBSCRIBED' }),
      }),
    )
  })

  it('rejects an invalid token without writing', async () => {
    const res = await GET(
      req(`https://app.test/api/unsubscribe?email=${encodeURIComponent(EMAIL)}&token=forged`),
    )

    expect(res.status).toBe(400)
    expect(prisma.emailSuppressionList.upsert).not.toHaveBeenCalled()
  })

  it('rejects when email or token is missing', async () => {
    const res = await GET(req('https://app.test/api/unsubscribe'))
    expect(res.status).toBe(400)
    expect(prisma.emailSuppressionList.upsert).not.toHaveBeenCalled()
  })
})
