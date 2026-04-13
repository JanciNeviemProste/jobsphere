'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { captureException } from '@/lib/monitoring/sentry'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('errorPage')

  useEffect(() => {
    captureException(error, {
      tags: {
        location: 'employer-job-edit-error',
        ...(error.digest && { digest: error.digest }),
      },
    })
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center">
      <div className="text-center">
        <h2 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
          {t('title')}
        </h2>
        <p className="mb-6 max-w-md text-gray-600 dark:text-gray-400">{t('description')}</p>
        <div className="flex justify-center gap-4">
          <button
            onClick={reset}
            className="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
          >
            {t('tryAgain')}
          </button>
          <a
            href="/"
            className="rounded-md bg-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            {t('goHome')}
          </a>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <details className="mx-auto mt-8 max-w-2xl text-left">
            <summary className="cursor-pointer text-sm text-gray-500">{t('errorDetails')}</summary>
            <pre className="mt-2 overflow-auto rounded bg-gray-100 p-4 text-xs dark:bg-gray-800">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
