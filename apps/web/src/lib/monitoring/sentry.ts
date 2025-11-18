/**
 * Simplified Sentry Monitoring Wrapper
 * Basic error tracking without deprecated APIs
 */

import * as Sentry from '@sentry/nextjs'

/**
 * Capture exception with Sentry
 */
export function captureException(
  error: Error,
  context?: {
    tags?: Record<string, string>
    extra?: Record<string, unknown>
  }
): void {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureException(error, {
      tags: context?.tags,
      extra: context?.extra,
    })
  } else if (process.env.NODE_ENV === 'development') {
    console.error('[Sentry]', error, context)
  }
}

/**
 * Capture message with Sentry
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: {
    tags?: Record<string, string>
    extra?: Record<string, unknown>
  }
): void {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureMessage(message, {
      level,
      tags: context?.tags,
      extra: context?.extra,
    })
  } else if (process.env.NODE_ENV === 'development') {
    console.log(`[Sentry:${level}]`, message, context)
  }
}

/**
 * Set user context for Sentry
 */
export function setUserContext(user: {
  id?: string
  email?: string
  username?: string
}): void {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.setUser(user)
  }
}

/**
 * Clear user context
 */
export function clearUserContext(): void {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.setUser(null)
  }
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category?: string,
  data?: Record<string, unknown>
): void {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    })
  }
}
