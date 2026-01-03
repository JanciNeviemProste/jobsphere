import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'

/**
 * Test route for Sentry server-side error tracking
 * This route should be deleted before production deployment
 */
export async function GET() {
  try {
    // Simulate a server error
    throw new Error('Test server error from JobSphere API')
  } catch (error) {
    // Capture the error in Sentry with additional context
    Sentry.captureException(error, {
      tags: {
        test: 'server',
        source: 'test-api',
        method: 'GET'
      },
      contexts: {
        test: {
          type: 'manual-test',
          timestamp: new Date().toISOString(),
          endpoint: '/api/test-sentry-error'
        }
      }
    })

    return NextResponse.json(
      {
        error: 'Test error sent to Sentry',
        message: 'Check your Sentry dashboard to verify the error was captured'
      },
      { status: 500 }
    )
  }
}

export async function POST() {
  return GET()
}
