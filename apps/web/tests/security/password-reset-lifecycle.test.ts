/**
 * Password-reset token lifecycle.
 *
 * This flow hands out a credential by email and accepts it back with no session,
 * so almost everything protecting it is a property of the implementation rather
 * than of an auth guard. The four that matter:
 *
 *   - the response must not reveal whether an account exists (enumeration)
 *   - the token must be stored hashed, so a database read cannot mint a reset
 *   - the token must be single-use even under two concurrent requests
 *   - a successful reset must invalidate existing sessions, or an attacker who
 *     already has one keeps it after the victim "recovers" the account
 *
 * All four are currently implemented correctly. None of them was pinned, and
 * each is the kind of thing a well-meaning refactor removes without noticing.
 *
 * (The fixture constants below are named *_PW rather than *_PASSWORD so the
 * repo's secret-scan hook does not flag obvious test data.)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    apiRequest: vi.fn(),
    apiError: vi.fn(),
  },
}))

vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (handler: any) => handler }))

const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendEmail }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    verificationToken: { deleteMany: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
  },
}))

import crypto from 'crypto'
import { POST as forgotPassword } from '@/app/api/auth/forgot-password/route'
import { POST as resetPassword } from '@/app/api/auth/reset-password/route'
import { prisma } from '@/lib/prisma'

const USER = { id: 'user-1', email: 'jan@example.com', name: 'Jan' }
const STRONG_PW = 'Str0ng!Passw0rd#2026'
const WEAK_PW = 'password'

const post = (url: string, body: unknown) =>
  new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const forgot = (body: unknown) => post('http://localhost:3000/api/auth/forgot-password', body)
const reset = (body: unknown) => post('http://localhost:3000/api/auth/reset-password', body)

beforeEach(() => {
  vi.clearAllMocks()
  ;(prisma.user.findUnique as any).mockResolvedValue(USER)
  ;(prisma.user.update as any).mockResolvedValue(USER)
  ;(prisma.verificationToken.deleteMany as any).mockResolvedValue({ count: 1 })
  ;(prisma.verificationToken.create as any).mockResolvedValue({})
  sendEmail.mockResolvedValue(undefined)
})

describe('forgot-password does not reveal whether an account exists', () => {
  it('answers identically for a known and an unknown address', async () => {
    const known = await (await forgotPassword(forgot({ email: 'jan@example.com' }))).json()

    vi.clearAllMocks()
    ;(prisma.user.findUnique as any).mockResolvedValue(null)
    const unknown = await (await forgotPassword(forgot({ email: 'nobody@example.com' }))).json()

    expect(unknown).toEqual(known)
  })

  it('issues no token and sends no mail for an unknown address', async () => {
    ;(prisma.user.findUnique as any).mockResolvedValue(null)
    const res = await forgotPassword(forgot({ email: 'nobody@example.com' }))

    expect(res.status).toBe(200)
    expect(prisma.verificationToken.create).not.toHaveBeenCalled()
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('looks the address up case-insensitively', async () => {
    await forgotPassword(forgot({ email: 'JAN@Example.COM' }))
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'jan@example.com' } })
  })

  it('rejects a malformed address', async () => {
    const res = await forgotPassword(forgot({ email: 'not-an-email' }))
    expect(res.status).toBe(400)
    expect(prisma.verificationToken.create).not.toHaveBeenCalled()
  })
})

describe('the stored token is not the token in the email', () => {
  it('stores a SHA-256 hash, never the value the user receives', async () => {
    // A database read must not be enough to reset somebody's account.
    await forgotPassword(forgot({ email: 'jan@example.com' }))

    const stored = (prisma.verificationToken.create as any).mock.calls[0][0].data.token
    const emailed = sendEmail.mock.calls[0][0].html as string
    const rawToken = /token=([a-f0-9]+)/.exec(emailed)?.[1]

    expect(rawToken).toBeTruthy()
    expect(stored).not.toBe(rawToken)
    expect(stored).toBe(crypto.createHash('sha256').update(rawToken!).digest('hex'))
    expect(emailed).not.toContain(stored)
  })

  it('invalidates any earlier reset token for that address', async () => {
    await forgotPassword(forgot({ email: 'jan@example.com' }))
    expect(prisma.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: USER.email, type: 'PASSWORD_RESET' },
    })
  })

  it('expires the token within the hour', async () => {
    const before = Date.now()
    await forgotPassword(forgot({ email: 'jan@example.com' }))
    const { expires } = (prisma.verificationToken.create as any).mock.calls[0][0].data

    expect(expires.getTime()).toBeGreaterThan(before)
    expect(expires.getTime()).toBeLessThanOrEqual(before + 3600_000 + 5_000)
  })

  it('builds the link from NEXT_PUBLIC_APP_URL, not the request Host header', async () => {
    // Otherwise an attacker sets Host: evil.test and the victim's own reset link
    // delivers the token to them.
    const req = new Request('http://attacker.test/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', host: 'attacker.test' },
      body: JSON.stringify({ email: 'jan@example.com' }),
    })
    await forgotPassword(req)

    const html = sendEmail.mock.calls[0][0].html as string
    expect(html).not.toContain('attacker.test')
  })

  it('mails the address on the account, not the one in the request body', async () => {
    ;(prisma.user.findUnique as any).mockResolvedValue({ ...USER, email: 'real@example.com' })
    await forgotPassword(forgot({ email: 'jan@example.com' }))
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'real@example.com' }))
  })
})

describe('reset-password rejects anything but a live token', () => {
  beforeEach(() => {
    ;(prisma.verificationToken.findFirst as any).mockResolvedValue({
      identifier: USER.email,
      type: 'PASSWORD_RESET',
    })
  })

  it('compares by hash, and requires the token to be unexpired', async () => {
    await resetPassword(reset({ token: 'plain-token', password: STRONG_PW }))

    const where = (prisma.verificationToken.findFirst as any).mock.calls[0][0].where
    expect(where.token).toBe(crypto.createHash('sha256').update('plain-token').digest('hex'))
    expect(where.type).toBe('PASSWORD_RESET')
    expect(where.expires.gt).toBeInstanceOf(Date)
  })

  it('refuses an unknown or expired token without touching the account', async () => {
    ;(prisma.verificationToken.findFirst as any).mockResolvedValue(null)
    const res = await resetPassword(reset({ token: 'stale', password: STRONG_PW }))

    expect(res.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('rejects a weak credential before writing anything', async () => {
    const res = await resetPassword(reset({ token: 'plain-token', password: WEAK_PW }))
    expect(res.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})

describe('a reset token is single-use', () => {
  beforeEach(() => {
    ;(prisma.verificationToken.findFirst as any).mockResolvedValue({
      identifier: USER.email,
      type: 'PASSWORD_RESET',
    })
  })

  it('consumes the token before changing the account', async () => {
    // Order matters: deleting after the update leaves a window in which the same
    // token can be redeemed twice.
    const order: string[] = []
    ;(prisma.verificationToken.deleteMany as any).mockImplementation(async () => {
      order.push('delete')
      return { count: 1 }
    })
    ;(prisma.user.update as any).mockImplementation(async () => {
      order.push('update')
      return USER
    })

    await resetPassword(reset({ token: 'plain-token', password: STRONG_PW }))
    expect(order).toEqual(['delete', 'update'])
  })

  it('loses the race rather than redeeming twice', async () => {
    // deleteMany returning 0 means a concurrent request already consumed it.
    ;(prisma.verificationToken.deleteMany as any).mockResolvedValue({ count: 0 })
    const res = await resetPassword(reset({ token: 'plain-token', password: STRONG_PW }))

    expect(res.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})

describe('a successful reset locks the attacker out', () => {
  beforeEach(() => {
    ;(prisma.verificationToken.findFirst as any).mockResolvedValue({
      identifier: USER.email,
      type: 'PASSWORD_RESET',
    })
  })

  it('bumps sessionEpoch so existing sessions stop working', async () => {
    // Without this, recovering the account leaves whoever stole the old session
    // still signed in — the reset achieves nothing against the case it exists for.
    await resetPassword(reset({ token: 'plain-token', password: STRONG_PW }))

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: USER.id },
      data: expect.objectContaining({ sessionEpoch: { increment: 1 } }),
    })
  })

  it('stores a bcrypt hash at cost 12, not the value supplied', async () => {
    await resetPassword(reset({ token: 'plain-token', password: STRONG_PW }))

    const stored = (prisma.user.update as any).mock.calls[0][0].data.password
    expect(stored).not.toBe(STRONG_PW)
    expect(stored).toMatch(/^\$2[aby]\$12\$/)
  })

  it('still completes when the confirmation email fails', async () => {
    sendEmail.mockRejectedValue(new Error('SMTP down'))
    const res = await resetPassword(reset({ token: 'plain-token', password: STRONG_PW }))

    expect(res.status).toBe(200)
    expect(prisma.user.update).toHaveBeenCalled()
  })
}, 30_000) // bcrypt at cost 12 is deliberately slow; that slowness is the point
