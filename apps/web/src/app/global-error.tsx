'use client'

/**
 * Global Error Boundary
 * Catches errors at the root level and reports to Sentry.
 * Cannot use next-intl (outside provider), so uses inline translations.
 */

import { useEffect } from 'react'
import { captureException } from '@/lib/monitoring/sentry'

const translations = {
  en: {
    title: '500 - Something went wrong',
    description: 'An unexpected error occurred. Our team has been notified.',
    tryAgain: 'Try again',
    goHome: 'Go to homepage',
  },
  de: {
    title: '500 - Etwas ist schiefgelaufen',
    description: 'Ein unerwarteter Fehler ist aufgetreten. Unser Team wurde benachrichtigt.',
    tryAgain: 'Erneut versuchen',
    goHome: 'Zur Startseite',
  },
  cs: {
    title: '500 - Něco se pokazilo',
    description: 'Došlo k neočekávané chybě. Náš tým byl upozorněn.',
    tryAgain: 'Zkusit znovu',
    goHome: 'Na úvodní stránku',
  },
  sk: {
    title: '500 - Niečo sa pokazilo',
    description: 'Vyskytla sa neočakávaná chyba. Náš tím bol upozornený.',
    tryAgain: 'Skúsiť znova',
    goHome: 'Na domovskú stránku',
  },
  pl: {
    title: '500 - Coś poszło nie tak',
    description: 'Wystąpił nieoczekiwany błąd. Nasz zespół został powiadomiony.',
    tryAgain: 'Spróbuj ponownie',
    goHome: 'Strona główna',
  },
} as const

type Locale = keyof typeof translations

function getLocale(): Locale {
  if (typeof window !== 'undefined') {
    const match = window.location.pathname.match(/^\/(en|de|cs|sk|pl)/)
    if (match) return match[1] as Locale
  }
  return 'en'
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = translations[getLocale()]

  useEffect(() => {
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
            <h1 className="mb-4 text-4xl font-bold text-gray-900">{t.title}</h1>
            <p className="mb-8 text-gray-600">{t.description}</p>
            <div className="space-y-4">
              <button
                onClick={reset}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                {t.tryAgain}
              </button>
              <div>
                <a href="/" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                  {t.goHome} →
                </a>
              </div>
            </div>
            {error.digest && <p className="mt-8 text-xs text-gray-500">Error ID: {error.digest}</p>}
          </div>
        </div>
      </body>
    </html>
  )
}
