/**
 * Rate Limit Middleware
 * Applies rate limiting to API routes
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../app/api/auth/[...nextauth]/route'
import {
  rateLimitByIp,
  rateLimitByUser,
  strictRateLimit,
  getClientIp,
} from '../lib/rate-limit'

/**
 * Apply rate limiting based on route
 */
export async function rateLimitMiddleware(
  request: NextRequest
): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname
  const ip = getClientIp(request)

  // Strict rate limiting for auth endpoints
  if (
    pathname.startsWith('/api/auth/signin') ||
    pathname.startsWith('/api/auth/signup') ||
    pathname.startsWith('/api/auth/forgot-password')
  ) {
    const result = await strictRateLimit(ip, 5, 900) // 5 requests per 15 minutes

    if (!result.success) {
      return createRateLimitResponse(result)
    }

    return null
  }

  // Check if user is authenticated
  const session = await getServerSession(authOptions)

  if (session?.user?.id) {
    // Rate limit by user ID (higher limits for authenticated users)
    const result = await rateLimitByUser(session.user.id, 500, 60) // 500/min

    if (!result.success) {
      return createRateLimitResponse(result)
    }
  } else {
    // Rate limit by IP for unauthenticated requests
    const result = await rateLimitByIp(ip, 100, 60) // 100/min

    if (!result.success) {
      return createRateLimitResponse(result)
    }
  }

  return null
}

/**
 * Create rate limit error response
 */
function createRateLimitResponse(result: {
  limit: number
  remaining: number
  reset: number
}): NextResponse {
  const resetDate = new Date(result.reset)

  return NextResponse.json(
    {
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      limit: result.limit,
      remaining: result.remaining,
      reset: resetDate.toISOString(),
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': resetDate.toUTCString(),
        'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString(),
      },
    }
  )
}
