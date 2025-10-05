/**
 * CSRF Protection
 * Generate and validate CSRF tokens
 */

import { randomBytes, createHmac } from 'crypto'
import { cookies } from 'next/headers'

const CSRF_SECRET = process.env.CSRF_SECRET || 'fallback-secret-change-in-production'
const CSRF_COOKIE_NAME = 'jobsphere-csrf-token'
const CSRF_TOKEN_LENGTH = 32

/**
 * Generate CSRF token
 */
export function generateCsrfToken(): string {
  const token = randomBytes(CSRF_TOKEN_LENGTH).toString('hex')
  const signature = createHmac('sha256', CSRF_SECRET)
    .update(token)
    .digest('hex')

  return `${token}.${signature}`
}

/**
 * Verify CSRF token
 */
export function verifyCsrfToken(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false
  }

  const parts = token.split('.')
  if (parts.length !== 2) {
    return false
  }

  const [tokenValue, signature] = parts

  const expectedSignature = createHmac('sha256', CSRF_SECRET)
    .update(tokenValue)
    .digest('hex')

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(signature, expectedSignature)
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

/**
 * Get CSRF token from cookie or generate new one
 */
export async function getCsrfToken(): Promise<string> {
  const cookieStore = cookies()
  const existingToken = cookieStore.get(CSRF_COOKIE_NAME)?.value

  if (existingToken && verifyCsrfToken(existingToken)) {
    return existingToken
  }

  // Generate new token
  const newToken = generateCsrfToken()

  // Set cookie
  cookieStore.set(CSRF_COOKIE_NAME, newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  })

  return newToken
}

/**
 * Verify CSRF token from request
 */
export async function verifyCsrfFromRequest(
  headerToken: string | null
): Promise<boolean> {
  if (!headerToken) {
    return false
  }

  const cookieStore = cookies()
  const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value

  if (!cookieToken) {
    return false
  }

  // Both tokens must be valid and match
  return (
    verifyCsrfToken(headerToken) &&
    verifyCsrfToken(cookieToken) &&
    headerToken === cookieToken
  )
}
