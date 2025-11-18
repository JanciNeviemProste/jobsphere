/**
 * Sentry Edge Configuration
 * This file configures the initialization of Sentry for Edge runtime (middleware)
 */

import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn: SENTRY_DSN,

  // Environment
  environment: process.env.NODE_ENV,

  // Performance Monitoring (lower rate for edge)
  tracesSampleRate: 0.05,

  // Debug
  debug: false,

  // Filtering
  beforeSend(event) {
    // Add edge context
    if (event.contexts) {
      event.contexts.runtime = {
        name: 'edge',
      }
    }

    return event
  },
})