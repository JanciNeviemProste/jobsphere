/**
 * Rate Limiting using Vercel KV (Redis)
 * Sliding window rate limiter
 */

import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

export interface RateLimitConfig {
  /**
   * Unique identifier (IP, userId, etc.)
   */
  identifier: string

  /**
   * Maximum requests allowed
   */
  limit: number

  /**
   * Window duration in seconds
   */
  window: number

  /**
   * Optional prefix for Redis key
   */
  prefix?: string
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

/**
 * Check rate limit using sliding window
 */
export async function rateLimit(
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { identifier, limit, window, prefix = 'ratelimit' } = config

  const key = `${prefix}:${identifier}`
  const now = Date.now()
  const windowStart = now - window * 1000

  try {
    // Use Redis pipeline for atomic operations
    const pipeline = redis.pipeline()

    // Remove old entries outside window
    pipeline.zremrangebyscore(key, 0, windowStart)

    // Count requests in current window
    pipeline.zcard(key)

    // Add current request
    pipeline.zadd(key, { score: now, member: `${now}:${Math.random()}` })

    // Set expiry on key
    pipeline.expire(key, window)

    const results = await pipeline.exec()

    // Get count (index 1 in results)
    const count = (results[1] as number) || 0

    const success = count < limit
    const remaining = Math.max(0, limit - count - 1)
    const reset = now + window * 1000

    return {
      success,
      limit,
      remaining,
      reset,
    }
  } catch (error) {
    console.error('Rate limit error:', error)

    // On error, allow request (fail open)
    return {
      success: true,
      limit,
      remaining: limit,
      reset: now + window * 1000,
    }
  }
}

/**
 * Rate limit by IP address
 */
export async function rateLimitByIp(
  ip: string,
  limit = 100,
  window = 60
): Promise<RateLimitResult> {
  return rateLimit({
    identifier: ip,
    limit,
    window,
    prefix: 'ratelimit:ip',
  })
}

/**
 * Rate limit by user ID
 */
export async function rateLimitByUser(
  userId: string,
  limit = 500,
  window = 60
): Promise<RateLimitResult> {
  return rateLimit({
    identifier: userId,
    limit,
    window,
    prefix: 'ratelimit:user',
  })
}

/**
 * Rate limit by API key
 */
export async function rateLimitByApiKey(
  apiKey: string,
  limit = 1000,
  window = 60
): Promise<RateLimitResult> {
  return rateLimit({
    identifier: apiKey,
    limit,
    window,
    prefix: 'ratelimit:apikey',
  })
}

/**
 * Strict rate limit for sensitive endpoints (login, signup)
 */
export async function strictRateLimit(
  identifier: string,
  limit = 5,
  window = 900 // 15 minutes
): Promise<RateLimitResult> {
  return rateLimit({
    identifier,
    limit,
    window,
    prefix: 'ratelimit:strict',
  })
}

/**
 * Get client IP from request
 */
export function getClientIp(request: Request): string {
  // Vercel forwards client IP in x-forwarded-for
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  // Fallback to x-real-ip
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Last resort
  return 'unknown'
}
