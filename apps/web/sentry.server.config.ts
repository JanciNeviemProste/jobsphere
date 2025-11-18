/**
 * Sentry Server Configuration
 * This file configures the initialization of Sentry for the server-side
 */

import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn: SENTRY_DSN,

  // Environment
  environment: process.env.NODE_ENV,

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Debug
  debug: process.env.NODE_ENV === 'development',

  // Filtering
  beforeSend(event, hint) {
    // Add server context
    if (event.contexts) {
      event.contexts.runtime = {
        name: 'node',
        version: process.version,
      }
    }

    // Filter sensitive data
    if (event.request) {
      // Remove headers
      if (event.request.headers) {
        delete event.request.headers['authorization']
        delete event.request.headers['cookie']
        delete event.request.headers['x-api-key']
      }

      // Sanitize data
      if (event.request.data) {
        event.request.data = sanitizeData(event.request.data)
      }
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Sentry Server Event]', event)
    }

    return event
  },
})

/**
 * Sanitize sensitive data from request bodies
 */
function sanitizeData(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) {
    return data
  }

  const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization']
  const sanitized = { ...data } as Record<string, unknown>

  for (const key in sanitized) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeData(sanitized[key])
    }
  }

  return sanitized
}