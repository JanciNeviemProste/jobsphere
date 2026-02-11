'use client'

import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'

export default function NotFound() {
  const t = useTranslations('notFoundPage')
  const locale = useLocale()

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md text-center">
        <p className="mb-4 text-6xl font-bold text-blue-600">404</p>
        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{t('title')}</h1>
        <p className="mb-8 text-gray-600 dark:text-gray-400">{t('description')}</p>
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            {t('goHome')}
          </Link>
          <Link
            href={`/${locale}/jobs`}
            className="inline-flex items-center justify-center rounded-md bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            {t('browseJobs')}
          </Link>
        </div>
      </div>
    </div>
  )
}
