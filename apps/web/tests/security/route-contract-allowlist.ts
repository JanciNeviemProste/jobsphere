/**
 * Documented exemptions from the route wrapper contract.
 *
 * Every entry needs a `reason` that survives code review. The contract test fails
 * on entries that are no longer needed, so this list can only shrink unless
 * someone deliberately grows it — an unused exemption is as much a bug as a
 * missing wrapper, because it hides the moment a route gets fixed.
 *
 * `exempt` names which rule is waived:
 *   'csrf'      — mutating method without withCsrfProtection
 *   'rateLimit' — handler without withRateLimit
 *   'auth'      — handler with no auth guard in its body
 */

import type { HttpMethod } from './route-contract-analyzer'

export type ContractRule = 'csrf' | 'rateLimit' | 'auth'

export interface Exemption {
  route: string
  method: HttpMethod
  exempt: ContractRule[]
  reason: string
}

export const ALLOWLIST: Exemption[] = [
  // ---------------------------------------------------------------- NextAuth
  {
    route: '/api/auth/[...nextauth]',
    method: 'GET',
    exempt: ['rateLimit', 'auth'],
    reason:
      'NextAuth catch-all. It IS the authentication system, so it cannot sit behind an auth guard, ' +
      'and the handler is constructed by NextAuth() rather than declared here.',
  },
  {
    route: '/api/auth/[...nextauth]',
    method: 'POST',
    exempt: ['csrf', 'rateLimit', 'auth'],
    reason:
      'NextAuth ships its own CSRF token flow (next-auth.csrf-token cookie); wrapping it would ' +
      'double-validate. Login throttling is handled by the account-lockout logic in lib/auth.ts.',
  },

  // ------------------------------------------------------ pre-session auth flows
  // These four run before a session (and therefore before a CSRF cookie) exists.
  // The double-submit token cannot be issued yet, so rate limiting plus single-use
  // tokens are the real defence. All four already carry the strict rate-limit preset.
  {
    route: '/api/auth/signup',
    method: 'POST',
    exempt: ['csrf', 'auth'],
    reason: 'Account creation: no session and no CSRF cookie exist yet. Rate limited.',
  },
  {
    route: '/api/auth/forgot-password',
    method: 'POST',
    exempt: ['csrf', 'auth'],
    reason: 'Anonymous by design. Rate limited; response is uniform to avoid user enumeration.',
  },
  {
    route: '/api/auth/reset-password',
    method: 'POST',
    exempt: ['csrf', 'auth'],
    reason: 'Authorises via a single-use emailed token, not a session. Rate limited.',
  },
  {
    route: '/api/auth/verify-email',
    method: 'POST',
    exempt: ['csrf', 'auth'],
    reason: 'Authorises via a single-use emailed token, not a session. Rate limited.',
  },

  // ------------------------------------------------------------- signed webhooks
  {
    route: '/api/stripe/webhook',
    method: 'POST',
    exempt: ['csrf', 'auth'],
    reason:
      'Stripe signs every delivery; the handler verifies it with STRIPE_WEBHOOK_SECRET. A CSRF ' +
      'token is meaningless for a server-to-server caller that has no browser session.',
  },
  {
    route: '/api/webhooks/email',
    method: 'POST',
    exempt: ['csrf', 'auth'],
    reason: 'Email provider webhook authenticated by HMAC signature, not by session.',
  },

  // -------------------------------------------------------------- OAuth callbacks
  // The provider redirects the browser here with no session and no same-origin
  // referer. Replay/forgery protection is the HMAC-signed `state` parameter, which
  // both callbacks verify with timingSafeEqual and expire after 5 minutes.
  {
    route: '/api/email/oauth/gmail/callback',
    method: 'GET',
    exempt: ['auth'],
    reason:
      'Arrives from Google, not from an authenticated page. Identity comes from the HMAC-signed ' +
      '`state` payload (verified with timingSafeEqual, 5 min expiry), not from a session.',
  },
  {
    route: '/api/email/oauth/microsoft/callback',
    method: 'GET',
    exempt: ['auth'],
    reason: 'Same as the Gmail callback: identity comes from the HMAC-signed `state` parameter.',
  },

  // ---------------------------------------------------------------- public reads
  {
    route: '/api/health',
    method: 'GET',
    exempt: ['auth'],
    reason: 'Liveness probe for external uptime monitoring; returns no tenant data.',
  },
  {
    route: '/api/health/db',
    method: 'GET',
    exempt: ['auth'],
    reason: 'Dependency probe. Detail is gated behind HEALTH_CHECK_SECRET inside the handler.',
  },
  {
    route: '/api/health/redis',
    method: 'GET',
    exempt: ['auth'],
    reason: 'Dependency probe. Detail is gated behind HEALTH_CHECK_SECRET inside the handler.',
  },
  {
    route: '/api/unsubscribe',
    method: 'GET',
    exempt: ['auth'],
    reason:
      'Reached from an email link by a recipient who may have no account. Authorised by a signed ' +
      'unsubscribe token; CAN-SPAM/GDPR require it to work without a login.',
  },
  {
    route: '/api/analytics/web-vitals',
    method: 'GET',
    exempt: ['auth'],
    reason: 'Aggregate performance metrics, no personal data.',
  },
  {
    route: '/api/analytics/web-vitals',
    method: 'POST',
    exempt: ['csrf', 'auth'],
    reason:
      'Browser beacon fired via navigator.sendBeacon, which cannot attach custom headers, so a ' +
      'double-submit CSRF token is impossible. Rate limiting stays mandatory.',
  },
  {
    route: '/api/jobs/[id]/view',
    method: 'POST',
    exempt: ['auth'],
    reason: 'View counter on public job pages; anonymous visitors must be counted.',
  },
]

/** Index for O(1) lookup: `${method} ${route}` -> exempted rules. */
export const ALLOWLIST_INDEX = new Map<string, Exemption>(
  ALLOWLIST.map((e) => [`${e.method} ${e.route}`, e]),
)

export const allowlistKey = (method: string, route: string) => `${method} ${route}`
