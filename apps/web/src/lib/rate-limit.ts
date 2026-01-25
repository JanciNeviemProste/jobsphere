/**
 * Rate Limiting using Vercel KV (Redis) with In-Memory Fallback
 * Sliding window rate limiter with fail-closed behavior
 */

import { Redis } from '@upstash/redis'
import { logger } from './logger'

let redis: Redis | null = null

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    })
  }
  return redis
}

/**
 * In-memory rate limiter fallback (when Redis fails)
 * Uses Map with sliding window algorithm
 */
interface InMemoryEntry {
  timestamps: number[]
  lastCleanup: number
}

const inMemoryStore = new Map<string, InMemoryEntry>()

// Circuit breaker state
let redisFailureCount = 0
let lastRedisFailure = 0
const CIRCUIT_BREAKER_THRESHOLD = 5
const CIRCUIT_BREAKER_TIMEOUT = 60000 // 1 minute

function isCircuitOpen(): boolean {
  const now = Date.now()
  if (redisFailureCount >= CIRCUIT_BREAKER_THRESHOLD) {
    if (now - lastRedisFailure < CIRCUIT_BREAKER_TIMEOUT) {
      return true
    }
    // Reset circuit breaker after timeout
    redisFailureCount = 0
  }
  return false
}

function recordRedisFailure() {
  redisFailureCount++
  lastRedisFailure = Date.now()
  if (redisFailureCount === CIRCUIT_BREAKER_THRESHOLD) {
    logger.warn('Rate Limit Circuit breaker OPEN', {
      redisFailureCount,
      threshold: CIRCUIT_BREAKER_THRESHOLD,
    })
  }
}

function recordRedisSuccess() {
  if (redisFailureCount > 0) {
    redisFailureCount = Math.max(0, redisFailureCount - 1)
  }
}

/**
 * In-memory rate limiter with sliding window
 * More conservative limits than Redis version (fail-closed)
 */
function rateLimitInMemory(identifier: string, limit: number, window: number): RateLimitResult {
  const now = Date.now()
  const windowStart = now - window * 1000

  // Get or create entry
  let entry = inMemoryStore.get(identifier)
  if (!entry) {
    entry = { timestamps: [], lastCleanup: now }
    inMemoryStore.set(identifier, entry)
  }

  // Clean old entries every 60 seconds to prevent memory leak
  if (now - entry.lastCleanup > 60000) {
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart)
    entry.lastCleanup = now
  } else {
    // Remove timestamps outside window
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart)
  }

  // Check if limit exceeded
  const count = entry.timestamps.length
  const success = count < limit

  if (success) {
    entry.timestamps.push(now)
  }

  const remaining = Math.max(0, limit - count - 1)
  const reset = now + window * 1000

  return {
    success,
    limit,
    remaining,
    reset,
  }
}

// Cleanup in-memory store every 5 minutes (only in runtime, not during build)
if (typeof window === 'undefined' && process.env.NEXT_PHASE !== 'phase-production-build') {
  setInterval(() => {
    const now = Date.now()
    const maxAge = 900000 // 15 minutes

    for (const [key, entry] of inMemoryStore.entries()) {
      if (now - entry.lastCleanup > maxAge) {
        inMemoryStore.delete(key)
      }
    }

    logger.info('Rate Limit in-memory store cleanup', {
      storeSize: inMemoryStore.size,
      maxAge,
    })
  }, 300000)
}

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
 * Falls back to in-memory limiter on Redis failure (fail-closed)
 */
export async function rateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const { identifier, limit, window, prefix = 'ratelimit' } = config

  const key = `${prefix}:${identifier}`
  const now = Date.now()
  const windowStart = now - window * 1000

  // Skip rate limiting in test environment
  if (process.env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMIT === 'true') {
    return {
      success: true,
      limit,
      remaining: limit,
      reset: now + window * 1000,
    }
  }

  // Check circuit breaker - use in-memory if Redis is down
  if (isCircuitOpen()) {
    logger.warn('Rate Limit Circuit breaker OPEN - using in-memory fallback', {
      identifier,
      requestedLimit: limit,
      conservativeLimit: Math.ceil(limit / 2),
    })
    // Use more conservative limit (50% of requested limit)
    return rateLimitInMemory(identifier, Math.ceil(limit / 2), window)
  }

  try {
    // Use Redis pipeline for atomic operations
    const pipeline = getRedis().pipeline()

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

    // Record successful Redis operation
    recordRedisSuccess()

    return {
      success,
      limit,
      remaining,
      reset,
    }
  } catch (error) {
    logger.error('Rate Limit Redis error - falling back to in-memory limiter', {
      error,
      identifier,
      requestedLimit: limit,
      conservativeLimit: Math.ceil(limit / 2),
    })

    // Record Redis failure for circuit breaker
    recordRedisFailure()

    // SECURITY: Fail-closed with in-memory fallback (more conservative limit)
    // Use 50% of requested limit to be extra cautious
    const conservativeLimit = Math.ceil(limit / 2)
    return rateLimitInMemory(identifier, conservativeLimit, window)
  }
}

/**
 * Rate limit by IP address
 */
export async function rateLimitByIp(
  ip: string,
  limit = 100,
  window = 60,
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
  window = 60,
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
  window = 60,
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
  window = 900, // 15 minutes
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
  } = {},
) {
  return async function rateLimitedHandler(
    request: T,
    context?: { params?: Record<string, string> },
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
  } = {},
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
