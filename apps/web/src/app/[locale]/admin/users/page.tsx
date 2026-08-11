/**
 * Admin Users Page (Server Component)
 * Loads initial data server-side, delegates interactions to UsersClient.
 */

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { prisma } from '@/lib/prisma'
import { UsersClient } from './users-client'

interface PageProps {
  params: { locale: string }
  searchParams: { search?: string; page?: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: 'admin' })
  return { title: t('users.metaTitle') }
}

export default async function AdminUsersPage({ params, searchParams }: PageProps) {
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const limit = 20
  const search = searchParams.search?.trim() ?? ''

  const whereClause = {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        emailVerified: true,
        isGlobalAdmin: true,
        lockedUntil: true,
        failedAttempts: true,
        _count: { select: { organizations: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where: whereClause }),
  ])

  return (
    <UsersClient
      initialUsers={users}
      total={total}
      page={page}
      limit={limit}
      initialSearch={search}
      locale={params.locale}
    />
  )
}
