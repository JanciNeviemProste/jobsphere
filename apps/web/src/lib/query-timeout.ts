/**
 * Query Timeout Management
 * Utilities for handling long-running queries safely
 */

import { prisma } from '@/lib/prisma'
import { logger } from './logger'

/**
 * Default timeout for all queries (10 seconds)
 * Set via database migration and DATABASE_URL
 */
export const DEFAULT_QUERY_TIMEOUT_MS = 10000

/**
 * Execute query with custom timeout
 * Use this for operations that legitimately need more time
 *
 * @param timeoutMs Timeout in milliseconds
 * @param queryFn Query function to execute
 * @returns Query result
 *
 * @example
 * const results = await withQueryTimeout(30000, async () => {
 *   return await prisma.candidate.findMany({
 *     include: { resumes: { include: { sections: true } } }
 *   })
 * })
 */
export async function withQueryTimeout<T>(
  timeoutMs: number,
  queryFn: () => Promise<T>,
): Promise<T> {
  try {
    // Set local timeout for this transaction only
    await prisma.$executeRaw`SET LOCAL statement_timeout = ${timeoutMs};`

    // Execute query
    const result = await queryFn()

    // Reset to default
    await prisma.$executeRaw`SET LOCAL statement_timeout = ${DEFAULT_QUERY_TIMEOUT_MS};`

    return result
  } catch (error) {
    // Reset timeout even on error
    await prisma.$executeRaw`SET LOCAL statement_timeout = ${DEFAULT_QUERY_TIMEOUT_MS};`
    throw error
  }
}

/**
 * Execute query without timeout (USE WITH EXTREME CAUTION)
 * Only for administrative operations or migrations
 *
 * @param queryFn Query function to execute
 * @returns Query result
 *
 * @example
 * // Only for admin operations
 * const result = await withoutQueryTimeout(async () => {
 *   return await prisma.$executeRaw`VACUUM ANALYZE;`
 * })
 */
export async function withoutQueryTimeout<T>(queryFn: () => Promise<T>): Promise<T> {
  try {
    // Disable timeout
    await prisma.$executeRaw`SET LOCAL statement_timeout = 0;`

    const result = await queryFn()

    // Reset to default
    await prisma.$executeRaw`SET LOCAL statement_timeout = ${DEFAULT_QUERY_TIMEOUT_MS};`

    return result
  } catch (error) {
    await prisma.$executeRaw`SET LOCAL statement_timeout = ${DEFAULT_QUERY_TIMEOUT_MS};`
    throw error
  }
}

/**
 * Query timeout presets for common operations
 */
export const QueryTimeoutPresets = {
  /** Fast queries (1-2 seconds) - list views, simple lookups */
  FAST: 2000,

  /** Normal queries (5-10 seconds) - detail views, filtered lists */
  NORMAL: 10000,

  /** Slow queries (30 seconds) - complex aggregations, reports */
  SLOW: 30000,

  /** Very slow queries (60 seconds) - exports, large data processing */
  VERY_SLOW: 60000,

  /** No timeout - admin operations only */
  NONE: 0,
} as const

/**
 * Check if error is a query timeout error
 * @param error Error object
 * @returns True if timeout error
 */
export function isQueryTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('statement timeout') ||
      error.message.includes('Query timeout') ||
      error.message.includes('canceling statement due to statement timeout')
    )
  }
  return false
}

/**
 * Handle query timeout gracefully
 * @param error Error object
 * @param fallbackValue Fallback value to return
 * @returns Fallback value if timeout, otherwise throws
 */
export function handleQueryTimeout<T>(error: unknown, fallbackValue: T): T {
  if (isQueryTimeoutError(error)) {
    logger.warn('Query timeout exceeded, returning fallback value')
    return fallbackValue
  }
  throw error
}

/**
 * Retry query with exponential backoff on timeout
 * @param queryFn Query function
 * @param maxRetries Maximum retry attempts
 * @param baseTimeoutMs Base timeout (increases exponentially)
 * @returns Query result
 */
export async function retryQueryOnTimeout<T>(
  queryFn: () => Promise<T>,
  maxRetries: number = 3,
  baseTimeoutMs: number = DEFAULT_QUERY_TIMEOUT_MS,
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const timeoutMs = baseTimeoutMs * Math.pow(2, attempt) // Exponential backoff
      return await withQueryTimeout(timeoutMs, queryFn)
    } catch (error) {
      lastError = error

      if (!isQueryTimeoutError(error)) {
        // Not a timeout, throw immediately
        throw error
      }

      if (attempt < maxRetries - 1) {
        logger.warn(`Query timeout (attempt ${attempt + 1}/${maxRetries}), retrying...`)
        // Wait before retry (100ms * 2^attempt)
        await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, attempt)))
      }
    }
  }

  throw lastError
}

/**
 * Example usage patterns
 */

// Fast query (list view)
// const jobs = await prisma.job.findMany({ take: 20 })

// Normal query with filter (default 10s timeout applies)
// const applications = await prisma.application.findMany({
//   where: { status: 'PENDING' },
//   include: { candidate: true }
// })

// Slow query with custom timeout
// const report = await withQueryTimeout(30000, async () => {
//   return await prisma.$queryRaw`
//     SELECT DATE(created_at), COUNT(*)
//     FROM "Application"
//     GROUP BY DATE(created_at)
//     ORDER BY DATE(created_at) DESC
//   `
// })

// Admin operation without timeout
// await withoutQueryTimeout(async () => {
//   await prisma.$executeRaw`VACUUM ANALYZE "Application";`
// })

// Graceful fallback on timeout
// try {
//   const data = await complexQuery()
// } catch (error) {
//   const fallback = handleQueryTimeout(error, [])
//   return fallback
// }
