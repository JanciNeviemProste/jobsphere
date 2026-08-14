/**
 * Authorisation for the scheduled-job endpoints.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` on every scheduled
 * invocation. These routes are ordinary public URLs otherwise, and one of them
 * (`/api/cron/retention`) permanently erases candidate data under GDPR
 * Article 17 — so an unauthenticated caller hitting it is destructive, not
 * merely noisy.
 *
 * Two deliberate choices:
 *
 *  * **No secret means closed, not open.** A missing `CRON_SECRET` denies every
 *    request. The tempting alternative — "if it's unset, allow it, we're
 *    probably in development" — turns one forgotten environment variable into a
 *    public data-deletion endpoint, and it fails open exactly when someone is
 *    least likely to notice.
 *  * **Constant-time comparison.** `===` on secrets leaks their prefix through
 *    timing. The cost of doing it properly is one function call.
 */

import { timingSafeEqual } from 'crypto'
import { logger } from '@/lib/logger'

export class CronAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CronAuthError'
  }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  // timingSafeEqual throws on length mismatch, which would itself be a timing
  // signal; compare lengths first and still run the constant-time check.
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * Throws CronAuthError unless the request carries the configured cron secret.
 */
export function requireCronAuth(request: Request): void {
  const expected = process.env.CRON_SECRET

  if (!expected) {
    logger.error('Cron endpoint called but CRON_SECRET is not configured — denying')
    throw new CronAuthError('Cron secret not configured')
  }

  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''

  if (!token || !safeEqual(token, expected)) {
    throw new CronAuthError('Invalid cron credentials')
  }
}
