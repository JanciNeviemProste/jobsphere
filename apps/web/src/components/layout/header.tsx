'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from './language-switcher'

export function Header() {
  const t = useTranslations()
  const pathname = usePathname()
  const locale = pathname.split('/')[1] || 'en'

  const navItems = [
    { href: `/${locale}`, label: t('nav.home') },
    { href: `/${locale}/jobs`, label: t('nav.jobs') },
    { href: `/${locale}/for-employers`, label: t('nav.forEmployers') },
    { href: `/${locale}/pricing`, label: t('nav.pricing') },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href={`/${locale}`} className="flex items-center space-x-2">
            <span className="text-2xl font-bold">
              Job<span className="text-primary">Sphere</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/${locale}/login`}>{t('nav.login')}</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href={`/${locale}/signup`}>{t('nav.signup')}</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
