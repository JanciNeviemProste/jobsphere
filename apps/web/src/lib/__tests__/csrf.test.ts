import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn() })),
}))

import { generateCsrfToken, verifyCsrfToken, withCsrfProtection } from '@/lib/csrf'

describe('csrf — token generate/verify', () => {
  it('verifies a freshly generated token (round-trip)', () => {
    expect(verifyCsrfToken(generateCsrfToken())).toBe(true)
  })

  it('rejects empty, non-string and malformed tokens', () => {
    expect(verifyCsrfToken('')).toBe(false)
    // @ts-expect-error — exercising the runtime guard
    expect(verifyCsrfToken(null)).toBe(false)
    expect(verifyCsrfToken('no-dot-here')).toBe(false)
    expect(verifyCsrfToken('a.b.c')).toBe(false)
  })

  it('rejects a token whose signature was tampered with', () => {
    const [value] = generateCsrfToken().split('.')
    expect(verifyCsrfToken(`${value}.deadbeef`)).toBe(false)
  })

  it('rejects a token whose value was tampered with (signature no longer matches)', () => {
    const [, sig] = generateCsrfToken().split('.')
    expect(verifyCsrfToken(`tampered-value.${sig}`)).toBe(false)
  })
})

describe('csrf — withCsrfProtection', () => {
  const handler = vi.fn(async () => new Response('ok', { status: 200 }))
  const origEnv = process.env.NODE_ENV

  afterEach(() => {
    process.env.NODE_ENV = origEnv
    handler.mockClear()
  })

  it('is pass-through in the test environment', async () => {
    process.env.NODE_ENV = 'test'
    const wrapped = withCsrfProtection(handler)
    const res = await wrapped(new Request('http://localhost/x', { method: 'POST' }))
    expect(res.status).toBe(200)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('rejects a cross-site request (no origin/referer) with 403 outside test env', async () => {
    process.env.NODE_ENV = 'production'
    const wrapped = withCsrfProtection(handler)
    const res = await wrapped(new Request('http://localhost/x', { method: 'POST' }))
    expect(res.status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
  })

  it('accepts a same-origin request (Sec-Fetch-Site) outside test env', async () => {
    process.env.NODE_ENV = 'production'
    const wrapped = withCsrfProtection(handler)
    // Node's Request strips forbidden headers (Sec-Fetch-*, Host), so use a
    // minimal request-like object to exercise the same-site acceptance path.
    const fakeReq = {
      headers: { get: (k: string) => (k === 'sec-fetch-site' ? 'same-origin' : null) },
    } as unknown as Request
    const res = await wrapped(fakeReq)
    expect(res.status).toBe(200)
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
