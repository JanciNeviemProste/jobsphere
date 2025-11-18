/**
 * CSRF Middleware
 * Validates CSRF tokens on state-changing requests
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyCsrfFromRequest } from '../lib/csrf'

const CSRF_HEADER = 'x-csrf-token'

/**
 * CSRF Middleware - validates tokens on POST/PUT/PATCH/DELETE
 */
export async function csrfMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const method = request.method

  // Only check CSRF on state-changing methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return null // Allow GET, HEAD, OPTIONS
  }

  // Skip CSRF for certain routes
  const pathname = request.nextUrl.pathname

  const exemptPaths = [
    '/api/auth/', // NextAuth handles its own CSRF
    '/api/stripe/webhook', // Stripe webhooks use signature verification
  ]

  if (exemptPaths.some((path) => pathname.startsWith(path))) {
    return null
  }

  // Get token from header
  const token = request.headers.get(CSRF_HEADER)

  // Verify token
  const isValid = await verifyCsrfFromRequest(token)

  if (!isValid) {
    return NextResponse.json(
      {
        error: 'Invalid CSRF token',
        code: 'CSRF_ERROR',
      },
      { status: 403 }
    )
  }

  // Token valid, continue
  return null
}
