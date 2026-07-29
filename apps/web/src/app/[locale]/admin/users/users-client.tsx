'use client'

/**
 * Admin Users Client Component
 * Handles search navigation, pagination and row-level actions (ban/unban/promote/demote).
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search,
  MoreHorizontal,
  Eye,
  ShieldCheck,
  ShieldOff,
  Ban,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Users,
} from 'lucide-react'

interface UserRow {
  id: string
  name: string | null
  email: string
  createdAt: Date | string
  emailVerified: Date | string | null
  isGlobalAdmin: boolean
  lockedUntil: Date | string | null
  failedAttempts: number
  _count: { organizations: number }
}

interface UsersClientProps {
  initialUsers: UserRow[]
  total: number
  page: number
  limit: number
  initialSearch: string
  locale: string
}

type Action = 'ban' | 'unban' | 'promote_admin' | 'demote_admin'

function isBanned(lockedUntil: Date | string | null): boolean {
  if (!lockedUntil) return false
  return new Date(lockedUntil) > new Date()
}

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('sk-SK', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

function UserStatusBadge({ user }: { user: UserRow }) {
  if (user.isGlobalAdmin) {
    return <Badge className="bg-blue-600 text-xs text-white">Admin</Badge>
  }
  if (isBanned(user.lockedUntil)) {
    return (
      <Badge variant="destructive" className="text-xs">
        Zablokovaný
      </Badge>
    )
  }
  return (
    <Badge
      variant="secondary"
      className="border-emerald-200 bg-emerald-50 text-xs text-emerald-700"
    >
      Aktívny
    </Badge>
  )
}

function UserInitials({ name, email }: { name: string | null; email: string }) {
  const display = name ?? email
  const initials = display
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
      {initials || '?'}
    </span>
  )
}

export function UsersClient({
  initialUsers,
  total,
  page,
  limit,
  initialSearch,
  locale,
}: UsersClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(initialSearch)
  const [actionPending, setActionPending] = useState<string | null>(null)
  const [users, setUsers] = useState<UserRow[]>(initialUsers)
  const [toast, setToast] = useState<{ message: string; ok: boolean } | null>(null)

  const totalPages = Math.ceil(total / limit)

  function navigate(newPage: number, newSearch?: string) {
    const s = newSearch ?? search
    const params = new URLSearchParams()
    if (s) params.set('search', s)
    if (newPage > 1) params.set('page', String(newPage))
    startTransition(() => {
      router.push(`/${locale}/admin/users${params.size ? `?${params.toString()}` : ''}`)
    })
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    navigate(1, search)
  }

  function showToast(message: string, ok: boolean) {
    setToast({ message, ok })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleAction(userId: string, action: Action) {
    setActionPending(userId + action)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      })
      const data: { user?: UserRow; error?: string } = await res.json()
      if (!res.ok) {
        showToast(data.error ?? 'Akcia zlyhala', false)
        return
      }
      if (data.user) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...data.user } : u)))
      }
      const labels: Record<Action, string> = {
        ban: 'Používateľ bol zablokovaný',
        unban: 'Blokácia bola zrušená',
        promote_admin: 'Používateľ bol povýšený na admina',
        demote_admin: 'Admin práva boli odobrané',
      }
      showToast(labels[action], true)
    } catch {
      showToast('Nepodarilo sa vykonať akciu', false)
    } finally {
      setActionPending(null)
    }
  }

  return (
    <div className="space-y-6 p-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all ${
            toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Users className="h-6 w-6" />
            Správa používateľov
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Celkom <strong>{total}</strong> používateľov
          </p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="flex max-w-sm gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Hľadať podľa mena alebo emailu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline" disabled={isPending}>
          Hľadať
        </Button>
      </form>

      {/* Table */}
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Používateľ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Registrácia
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Overený
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Org.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Stav
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Akcie
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isPending
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-6 py-4">
                            <Skeleton className="h-4 w-full" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : users.map((user) => {
                      const banned = isBanned(user.lockedUntil)
                      const isLoading = actionPending?.startsWith(user.id)
                      return (
                        <tr
                          key={user.id}
                          className={`transition-colors hover:bg-slate-50 ${isLoading ? 'opacity-60' : ''}`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <UserInitials name={user.name} email={user.email} />
                              <span className="max-w-[140px] truncate font-medium text-slate-900">
                                {user.name ?? <span className="italic text-slate-400">—</span>}
                              </span>
                            </div>
                          </td>
                          <td className="max-w-[200px] truncate px-6 py-4 text-slate-600">
                            {user.email}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-slate-500">
                            {formatDate(user.createdAt)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {user.emailVerified ? (
                              <CheckCircle className="mx-auto h-4 w-4 text-emerald-500" />
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center font-medium text-slate-600">
                            {user._count.organizations}
                          </td>
                          <td className="px-6 py-4">
                            <UserStatusBadge user={user} />
                          </td>
                          <td className="px-6 py-4 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  disabled={isLoading}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Akcie</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem asChild>
                                  <Link href={`/${locale}/admin/users/${user.id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Zobraziť detail
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {banned ? (
                                  <DropdownMenuItem
                                    onClick={() => handleAction(user.id, 'unban')}
                                    className="text-emerald-600 focus:text-emerald-600"
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Odblokovať
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => handleAction(user.id, 'ban')}
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <Ban className="mr-2 h-4 w-4" />
                                    Zablokovať
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                {user.isGlobalAdmin ? (
                                  <DropdownMenuItem
                                    onClick={() => handleAction(user.id, 'demote_admin')}
                                    className="text-amber-600 focus:text-amber-600"
                                  >
                                    <ShieldOff className="mr-2 h-4 w-4" />
                                    Odobrať admina
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => handleAction(user.id, 'promote_admin')}
                                  >
                                    <ShieldCheck className="mr-2 h-4 w-4" />
                                    Povýšiť na admina
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      )
                    })}
              </tbody>
            </table>

            {!isPending && users.length === 0 && (
              <div className="px-6 py-16 text-center text-sm text-slate-500">
                Žiadni používatelia nenájdení
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Strana {page} z {totalPages} &bull; {total} výsledkov
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isPending}
              onClick={() => navigate(page - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Predch.
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isPending}
              onClick={() => navigate(page + 1)}
            >
              Ďalší
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
