'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  Users,
  Building2,
  Briefcase,
  CreditCard,
  Settings,
  LogOut,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

interface AdminSidebarProps {
  locale: string
  userName?: string
  userEmail?: string
}

export function AdminSidebar({ locale, userName, userEmail }: AdminSidebarProps) {
  const pathname = usePathname()

  const navItems: NavItem[] = [
    { label: 'Dashboard', href: `/${locale}/admin`, icon: LayoutDashboard },
    { label: 'Používatelia', href: `/${locale}/admin/users`, icon: Users },
    { label: 'Organizácie', href: `/${locale}/admin/organizations`, icon: Building2 },
    { label: 'Joby', href: `/${locale}/admin/jobs`, icon: Briefcase },
    { label: 'Predplatné', href: `/${locale}/admin/subscriptions`, icon: CreditCard },
    { label: 'Nastavenia', href: `/${locale}/admin/settings`, icon: Settings },
  ]

  const isActive = (href: string) => {
    // Exact match for dashboard root, prefix match for sub-pages
    if (href === `/${locale}/admin`) {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <aside className="flex h-screen w-[250px] flex-shrink-0 flex-col bg-slate-900 text-white">
      {/* Logo / Brand */}
      <div className="flex items-center gap-2 border-b border-slate-700 px-6 py-5">
        <Shield className="h-5 w-5 text-blue-400" />
        <span className="text-lg font-semibold tracking-tight">Admin Panel</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <Separator className="bg-slate-700" />

      {/* User info + logout */}
      <div className="space-y-3 px-4 py-4">
        <div className="flex items-center gap-3 px-1">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold uppercase">
            {userName ? userName.charAt(0) : 'A'}
          </div>
          <div className="min-w-0">
            {userName && <p className="truncate text-sm font-medium text-white">{userName}</p>}
            {userEmail && <p className="truncate text-xs text-slate-400">{userEmail}</p>}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 px-3 text-slate-300 hover:bg-slate-800 hover:text-white"
          onClick={() => signOut({ callbackUrl: `/${locale}/login` })}
        >
          <LogOut className="h-4 w-4" />
          Odhlásiť sa
        </Button>
      </div>
    </aside>
  )
}
