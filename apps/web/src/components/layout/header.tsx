'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LanguageSwitcher } from './language-switcher'

export function Header() {
  const t = useTranslations()
  const pathname = usePathname()
  const locale = pathname.split('/')[1] || 'en'
  const { data: session, status } = useSession()

  const navItems = [
    { href: `/${locale}`, label: t('nav.home') },
    { href: `/${locale}/jobs`, label: t('nav.jobs') },
    { href: `/${locale}/freelancers`, label: 'Freelanceri' },
    { href: `/${locale}/gigs`, label: 'Zákazky' },
    { href: `/${locale}/for-employers`, label: t('nav.forEmployers') },
    { href: `/${locale}/pricing`, label: t('nav.pricing') },
  ]

  return (
    <header
      className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      role="banner"
      aria-label="Site header"
    >
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href={`/${locale}`} className="flex items-center" aria-label="JobSphere home">
            <Image
              src="/images/jobsphere_logo.png"
              alt="JobSphere"
              width={120}
              height={40}
              className="h-10 w-auto"
              priority
            />
          </Link>

          <nav
            className="hidden items-center gap-6 md:flex"
            role="navigation"
            aria-label="Main navigation"
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                aria-current={pathname === item.href ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4" role="navigation" aria-label="User actions">
          <LanguageSwitcher />
          {status === 'loading' ? (
            <Button variant="ghost" size="sm" disabled>
              {t('nav.loading')}
            </Button>
          ) : session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  {session.user.name || session.user.email || 'Account'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={session.user.orgId ? `/${locale}/employer` : `/${locale}/dashboard`}>
                    {t('nav.dashboard')}
                  </Link>
                </DropdownMenuItem>
                {session.user.orgId && (
                  <DropdownMenuItem asChild>
                    <Link href={`/${locale}/employer/settings`}>Nastavenia spoločnosti</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href={`/${locale}/dashboard/profile`}>{t('nav.profile')}</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: `/${locale}` })}>
                  {t('nav.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/${locale}/login`} aria-label="Log in to your account">
                  {t('nav.login')}
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href={`/${locale}/signup`} aria-label="Create a new account">
                  {t('nav.signup')}
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
