/**
 * Admin User Detail Page (Server Component)
 * Loads user data server-side, delegates mutations to UserDetailActions.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getFormatter } from 'next-intl/server'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { SHORT_DATE_TIME } from '@/lib/formats'
import { UserDetailActions } from './user-detail-actions'
import {
  ArrowLeft,
  Mail,
  Phone,
  Globe,
  Clock,
  ShieldCheck,
  Building2,
  CheckCircle,
  XCircle,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Detail používateľa | Admin',
}

interface PageProps {
  params: { locale: string; id: string }
}

function isBanned(lockedUntil: Date | string | null): boolean {
  if (!lockedUntil) return false
  return new Date(lockedUntil) > new Date()
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const session = await auth()
  const intl = await getFormatter()

  // '—' when absent, otherwise formatted in the active locale.
  const formatDateTime = (date: Date | string | null): string =>
    date ? intl.dateTime(new Date(date), SHORT_DATE_TIME) : '—'

  const user = await prisma.user.findUnique({
    where: { id: params.id, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      phone: true,
      locale: true,
      timezone: true,
      emailVerified: true,
      isGlobalAdmin: true,
      lockedUntil: true,
      failedAttempts: true,
      lastLoginAt: true,
      lastLoginIp: true,
      createdAt: true,
      updatedAt: true,
      organizations: {
        where: { deletedAt: null },
        include: {
          organization: {
            select: { id: true, name: true, slug: true },
          },
        },
      },
      _count: { select: { assignedApps: true } },
      auditLogs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          ipAddress: true,
          createdAt: true,
        },
      },
    },
  })

  if (!user) notFound()

  const banned = isBanned(user.lockedUntil)
  const isSelf = session?.user?.id === user.id

  const initials = (user.name ?? user.email)
    .split(/\s+/)
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div className="max-w-5xl space-y-6 p-8">
      {/* Back link */}
      <Link
        href={`/${params.locale}/admin/users`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Späť na zoznam
      </Link>

      {/* Header card */}
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            {/* Avatar */}
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-200 text-xl font-bold text-slate-700">
              {initials || '?'}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">
                  {user.name ?? <span className="italic text-slate-400">Bez mena</span>}
                </h1>
                {user.isGlobalAdmin && (
                  <Badge className="bg-blue-600 text-xs text-white">
                    <ShieldCheck className="mr-1 h-3 w-3" />
                    Admin
                  </Badge>
                )}
                {banned && (
                  <Badge variant="destructive" className="text-xs">
                    Zablokovaný
                  </Badge>
                )}
                {!user.isGlobalAdmin && !banned && (
                  <Badge
                    variant="secondary"
                    className="border-emerald-200 bg-emerald-50 text-xs text-emerald-700"
                  >
                    Aktívny
                  </Badge>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {user.email}
                </span>
                {user.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    {user.phone}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Globe className="h-4 w-4" />
                  {user.locale.toUpperCase()} / {user.timezone}
                </span>
              </div>
            </div>

            {/* Actions */}
            <UserDetailActions
              userId={user.id}
              isBanned={banned}
              isGlobalAdmin={user.isGlobalAdmin}
              isSelf={isSelf}
              locale={params.locale}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Personal info */}
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Osobné informácie
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow label="ID" value={user.id} mono />
            <InfoRow label="Meno" value={user.name ?? '—'} />
            <InfoRow label="Email" value={user.email} />
            <InfoRow
              label="Email overený"
              value={
                user.emailVerified ? (
                  <span className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle className="h-4 w-4" />
                    {formatDateTime(user.emailVerified)}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-500">
                    <XCircle className="h-4 w-4" />
                    Nie
                  </span>
                )
              }
            />
            <Separator />
            <InfoRow label="Posledné prihlásenie" value={formatDateTime(user.lastLoginAt)} />
            <InfoRow label="IP posledného prihlásenia" value={user.lastLoginIp ?? '—'} mono />
            <InfoRow label="Neúspešné pokusy" value={String(user.failedAttempts)} />
            {banned && (
              <InfoRow
                label="Zablokovaný do"
                value={formatDateTime(user.lockedUntil)}
                className="text-red-600"
              />
            )}
            <Separator />
            <InfoRow label="Registrovaný" value={formatDateTime(user.createdAt)} />
            <InfoRow label="Prihlášky" value={String(user._count.assignedApps)} />
          </CardContent>
        </Card>

        {/* Organizations */}
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Organizácie ({user.organizations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user.organizations.length === 0 ? (
              <p className="text-sm italic text-slate-400">Žiadne organizácie</p>
            ) : (
              <ul className="space-y-3">
                {user.organizations.map((membership) => (
                  <li
                    key={membership.orgId}
                    className="flex items-center justify-between rounded-lg border border-slate-100 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 shrink-0 text-slate-400" />
                      <div>
                        <p className="font-medium text-slate-800">{membership.organization.name}</p>
                        <p className="text-xs text-slate-400">{membership.organization.slug}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {membership.role}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Audit logs */}
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-slate-700">
            Posledná aktivita (audit log)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {user.auditLogs.length === 0 ? (
            <p className="px-6 py-6 text-sm italic text-slate-400">Žiadna zaznamenaná aktivita</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Akcia
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Entita
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      IP
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Čas
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {user.auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 font-mono text-xs text-slate-700">{log.action}</td>
                      <td className="px-6 py-3 text-xs text-slate-500">
                        {log.entityType ?? '—'}
                        {log.entityId ? (
                          <span className="ml-1 font-mono text-slate-400">
                            {log.entityId.slice(0, 8)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-slate-400">
                        {log.ipAddress ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDateTime(log.createdAt)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function InfoRow({
  label,
  value,
  mono = false,
  className = '',
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  className?: string
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className={`text-right text-slate-800 ${mono ? 'font-mono text-xs' : ''} ${className}`}>
        {value}
      </span>
    </div>
  )
}
