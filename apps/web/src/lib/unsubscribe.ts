/**
 * Unsubscribe token + URL helpers (LOGIC-011).
 *
 * Tokens are a non-guessable HMAC-SHA256 of the recipient email, keyed by an
 * existing server secret (ENCRYPTION_KEY, falling back to NEXTAUTH_SECRET).
 * The same email always maps to the same token, so links are stable and the
 * unsubscribe endpoint can verify a link without persisting per-link state.
 */

import crypto from 'crypto'

/**
 * Resolve the secret used to key the unsubscribe HMAC. Reuses an existing
 * server secret so no new env var / schema change is required.
 */
function getUnsubscribeSecret(): string {
  const secret = process.env.ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('Unsubscribe secret not set (ENCRYPTION_KEY or NEXTAUTH_SECRET required)')
  }
  return secret
}

/**
 * Normalize an email for token derivation so casing/whitespace differences in a
 * link do not break verification.
 */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Generate the unsubscribe token for an email address.
 */
export function generateUnsubscribeToken(email: string): string {
  return crypto
    .createHmac('sha256', getUnsubscribeSecret())
    .update(normalizeEmail(email))
    .digest('hex')
}

/**
 * Constant-time verification of an unsubscribe token for an email address.
 */
export function verifyUnsubscribeToken(email: string, token: string): boolean {
  if (!email || !token) return false
  let expected: string
  try {
    expected = generateUnsubscribeToken(email)
  } catch {
    return false
  }

  const expectedBuf = Buffer.from(expected, 'hex')
  const providedBuf = Buffer.from(token, 'hex')
  if (expectedBuf.length !== providedBuf.length) return false
  return crypto.timingSafeEqual(expectedBuf, providedBuf)
}

/**
 * Build the absolute unsubscribe URL for an email address (includes a signed
 * token). Falls back to a relative URL if NEXT_PUBLIC_APP_URL is unset, and to
 * a tokenless link if no signing secret is configured (so footers never break
 * email delivery — the endpoint still rejects requests lacking a valid token).
 */
export function unsubscribeUrl(email: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || ''
  const params = new URLSearchParams({ email: normalizeEmail(email) })
  try {
    params.set('token', generateUnsubscribeToken(email))
  } catch {
    // No secret available (e.g. test/dev without ENCRYPTION_KEY) — omit token.
  }
  return `${base}/api/unsubscribe?${params.toString()}`
}

/**
 * Standard unsubscribe footer for marketing / sequence email HTML.
 */
export function unsubscribeFooterHtml(email: string): string {
  const url = unsubscribeUrl(email)
  return `<p style="font-size:12px;color:#999;text-align:center;margin-top:24px;">If you no longer wish to receive these emails, <a href="${url}" style="color:#999;">unsubscribe</a>.</p>`
}
