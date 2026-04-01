'use client'

const translations = {
  en: {
    title: '404 - Page not found',
    description: 'The page you are looking for does not exist or has been moved.',
    goHome: 'Go to homepage',
    browseJobs: 'Browse jobs',
  },
  de: {
    title: '404 - Seite nicht gefunden',
    description: 'Die gesuchte Seite existiert nicht oder wurde verschoben.',
    goHome: 'Zur Startseite',
    browseJobs: 'Jobs durchsuchen',
  },
  cs: {
    title: '404 - Stránka nenalezena',
    description: 'Stránka, kterou hledáte, neexistuje nebo byla přesunuta.',
    goHome: 'Na úvodní stránku',
    browseJobs: 'Procházet nabídky',
  },
  sk: {
    title: '404 - Stránka nenájdená',
    description: 'Stránka, ktorú hľadáte, neexistuje alebo bola presunutá.',
    goHome: 'Na domovskú stránku',
    browseJobs: 'Prehľadávať ponuky',
  },
  pl: {
    title: '404 - Strona nie znaleziona',
    description: 'Strona, której szukasz, nie istnieje lub została przeniesiona.',
    goHome: 'Strona główna',
    browseJobs: 'Przeglądaj oferty',
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

export default function NotFound() {
  const locale = getLocale()
  const t = translations[locale]

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md text-center">
        <p className="mb-4 text-6xl font-bold text-blue-600">404</p>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">{t.title}</h1>
        <p className="mb-8 text-gray-600">{t.description}</p>
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <a
            href={`/${locale}`}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
          >
            {t.goHome}
          </a>
          <a
            href={`/${locale}/jobs`}
            className="inline-flex items-center justify-center rounded-md bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-200"
          >
            {t.browseJobs}
          </a>
        </div>
      </div>
    </div>
  )
}
