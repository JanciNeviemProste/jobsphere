'use client'

import { useState } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function TestSentryPage() {
  const [result, setResult] = useState('')

  const testClientError = () => {
    try {
      throw new Error('Test client error from JobSphere')
    } catch (error) {
      Sentry.captureException(error, {
        tags: { test: 'client', source: 'test-page' },
        user: { email: 'test@jobsphere.com' },
        contexts: {
          test: {
            type: 'manual-test',
            timestamp: new Date().toISOString()
          }
        }
      })
      setResult('✓ Client error sent to Sentry')
    }
  }

  const testServerError = async () => {
    try {
      const response = await fetch('/api/test-sentry-error')
      const data = await response.json()
      setResult(data.error ? `✓ ${data.error}` : '✓ Server error triggered')
    } catch (error) {
      setResult('✗ Failed to trigger server error')
    }
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-3xl font-bold mb-2">Sentry Error Monitoring Test</h1>
          <p className="text-gray-600 mb-6">
            Use these buttons to test that Sentry is correctly capturing errors from both client and server.
          </p>

          <div className="space-y-4">
            <div>
              <button
                onClick={testClientError}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
              >
                Test Client-Side Error
              </button>
              <p className="text-sm text-gray-500 mt-1">
                Triggers an error in the browser and sends it to Sentry
              </p>
            </div>

            <div>
              <button
                onClick={testServerError}
                className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-colors"
              >
                Test Server-Side Error
              </button>
              <p className="text-sm text-gray-500 mt-1">
                Triggers an error on the API route and sends it to Sentry
              </p>
            </div>
          </div>

          {result && (
            <div className={`mt-6 p-4 rounded-md ${result.startsWith('✓') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              <p className="font-medium">{result}</p>
              {result.startsWith('✓') && (
                <p className="text-sm mt-2">
                  Check your Sentry dashboard at{' '}
                  <a
                    href="https://sentry.io/organizations/YOUR_ORG/issues/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    sentry.io
                  </a>
                  {' '}to see the captured error.
                </p>
              )}
            </div>
          )}

          <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <h2 className="font-semibold text-yellow-900 mb-2">⚠️ Important</h2>
            <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
              <li>This page should be deleted before production deployment</li>
              <li>Make sure NEXT_PUBLIC_SENTRY_DSN is configured in .env.local</li>
              <li>Errors may take a few seconds to appear in Sentry dashboard</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
