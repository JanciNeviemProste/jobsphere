'use client'

/**
 * Route-level Error Boundary
 * Handles errors in the app directory
 */

import { useEffect } from 'react'
import { captureException } from '@/lib/monitoring/sentry'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to Sentry
    captureException(error, {
      tags: {
        location: 'route-error',
        ...(error.digest && { digest: error.digest }),
      },
    })
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Ups! Niečo sa pokazilo
        </h2>
        <p className="text-gray-600 mb-6 max-w-md">
          Vyskytla sa chyba pri spracovaní vašej požiadavky. Skúste to prosím znova.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Skúsiť znova
          </button>
          <a
            href="/"
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
          >
            Domov
          </a>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-8 text-left max-w-2xl mx-auto">
            <summary className="cursor-pointer text-sm text-gray-500">
              Detaily chyby (viditeľné len vo vývoji)
            </summary>
            <pre className="mt-2 text-xs bg-gray-100 p-4 rounded overflow-auto">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}