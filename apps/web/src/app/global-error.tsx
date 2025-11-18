'use client'

/**
 * Global Error Boundary
 * Catches errors at the root level and reports to Sentry
 */

import { useEffect } from 'react'
import { captureException } from '@/lib/monitoring/sentry'

export default function GlobalError({
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
        location: 'global-error',
        ...(error.digest && { digest: error.digest }),
      },
    })
  }, [error])

  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-md text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              500 - Niečo sa pokazilo
            </h1>
            <p className="text-gray-600 mb-8">
              Vyskytla sa neočakávaná chyba. Náš tím bol upozornený a pracuje na
              jej odstránení.
            </p>
            <div className="space-y-4">
              <button
                onClick={reset}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Skúsiť znova
              </button>
              <div>
                <a
                  href="/"
                  className="text-sm font-medium text-blue-600 hover:text-blue-500"
                >
                  Prejsť na domovskú stránku →
                </a>
              </div>
            </div>
            {error.digest && (
              <p className="mt-8 text-xs text-gray-500">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}