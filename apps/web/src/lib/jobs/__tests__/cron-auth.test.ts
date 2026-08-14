/**
 * The cron endpoints are public URLs guarding destructive work, so the failure
 * mode that matters is failing *open* — a misconfiguration that turns
 * /api/cron/retention into an anonymous data-deletion endpoint.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { requireCronAuth, CronAuthError } from '../cron-auth'

const SECRET = 'a-cron-secret-of-reasonable-length'
const original = process.env.CRON_SECRET

const withHeader = (value?: string) =>
  new Request('https://example.com/api/cron/retention', {
    headers: value ? { authorization: value } : {},
  })

beforeEach(() => {
  process.env.CRON_SECRET = SECRET
})

afterEach(() => {
  if (original === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = original
})

describe('requireCronAuth', () => {
  it('accepts the configured secret', () => {
    expect(() => requireCronAuth(withHeader(`Bearer ${SECRET}`))).not.toThrow()
  })

  it('denies every request when CRON_SECRET is unset', () => {
    // The whole point. "Unset means allow" would make one missing environment
    // variable enough to expose candidate erasure to the internet.
    delete process.env.CRON_SECRET
    expect(() => requireCronAuth(withHeader(`Bearer ${SECRET}`))).toThrow(CronAuthError)
    expect(() => requireCronAuth(withHeader())).toThrow(CronAuthError)
  })

  it.each([
    ['no header', undefined],
    ['empty bearer', 'Bearer '],
    ['wrong secret', 'Bearer not-the-secret-at-all-no-sir'],
    ['right secret, wrong scheme', `Basic ${SECRET}`],
    ['secret without scheme', SECRET],
    ['prefix of the secret', `Bearer ${SECRET.slice(0, 10)}`],
    ['secret plus suffix', `Bearer ${SECRET}x`],
  ])('rejects %s', (_label, header) => {
    expect(() => requireCronAuth(withHeader(header))).toThrow(CronAuthError)
  })

  it('does not throw a length error on mismatched lengths', () => {
    // timingSafeEqual throws on unequal buffer lengths; if that escaped instead
    // of being converted to a clean denial, the route would 500 rather than 401
    // and the length of the real secret would leak through the difference.
    let caught: unknown
    try {
      requireCronAuth(withHeader('Bearer short'))
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(CronAuthError)
  })
})
