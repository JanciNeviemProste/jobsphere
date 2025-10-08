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

/**
 * Rate limit presets
 */
export const RateLimitPresets = {
  auth: { limit: 5, window: 60 }, // 5 requests per minute
  api: { limit: 100, window: 60 }, // 100 requests per minute
  public: { limit: 200, window: 60 }, // 200 requests per minute
  strict: { limit: 10, window: 900 }, // 10 requests per 15 minutes
  upload: { limit: 10, window: 300 }, // 10 uploads per 5 minutes
} as const

type RateLimitPreset = keyof typeof RateLimitPresets

/**
 * Higher-order function to wrap API routes with rate limiting
 */
export function withRateLimit<T extends Request = Request>(
  handler: (request: T, context?: { params?: Record<string, string> }) => Promise<Response>,
  options: {
    preset?: RateLimitPreset
    limit?: number
    window?: number
    byUser?: boolean
    strict?: boolean
  } = {}
) {
  return async function rateLimitedHandler(
    request: T,
    context?: { params?: Record<string, string> }
  ): Promise<Response> {
    try {
      // Get rate limit configuration
      const config = options.preset
        ? RateLimitPresets[options.preset]
        : { limit: options.limit || 100, window: options.window || 60 }

      // Determine identifier
      let identifier: string
      if (options.byUser) {
        // Extract user ID from auth session if available
        const authHeader = request.headers.get('authorization')
        if (authHeader?.startsWith('Bearer ')) {
          identifier = authHeader.substring(7)
        } else {
          identifier = getClientIp(request)
        }
      } else {
        identifier = getClientIp(request)
      }

      // Apply rate limit
      const result = options.strict
        ? await strictRateLimit(identifier, config.limit, config.window)
        : await rateLimit({
            identifier,
            limit: config.limit,
            window: config.window,
            prefix: options.byUser ? 'ratelimit:user' : 'ratelimit:ip',
          })

      // Add rate limit headers to response
      const response = await handler(request, context)

      return new Response(response.body, {
        ...response,
        headers: {
          ...response.headers,
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': String(result.remaining),
          'X-RateLimit-Reset': String(result.reset),
        },
      })
    } catch (error) {
      // If handler throws, check if it's rate limit exceeded
      if (!error) {
        return new Response('Too Many Requests', {
          status: 429,
          headers: {
            'Retry-After': String(options.window || 60),
          },
        })
      }
      throw error
    }
  }
}

/**
 * Rate limit middleware for Next.js API routes
 */
export async function rateLimitMiddleware(
  request: Request,
  options: {
    preset?: RateLimitPreset
    limit?: number
    window?: number
    byUser?: boolean
  } = {}
): Promise<RateLimitResult | Response> {
  const config = options.preset
    ? RateLimitPresets[options.preset]
    : { limit: options.limit || 100, window: options.window || 60 }

  const identifier = options.byUser
    ? request.headers.get('x-user-id') || getClientIp(request)
    : getClientIp(request)

  const result = await rateLimit({
    identifier,
    limit: config.limit,
    window: config.window,
    prefix: options.byUser ? 'ratelimit:user' : 'ratelimit:ip',
  })

  if (!result.success) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.reset),
        'Retry-After': String(config.window),
      },
    })
  }

  return result
}
