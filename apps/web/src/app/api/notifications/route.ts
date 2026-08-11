/**
 * The read side of in-app notifications.
 *
 * Pairs with lib/notifications.ts. Both exist because the `Notification` model
 * has been in the schema since the beginning with no code touching it at all —
 * the settings screen offers an `inAppNotifications` preference that nothing has
 * ever consumed.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { handleApiError } from '@/lib/errors'
import { withCsrfProtection } from '@/lib/csrf'
import { withRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const markReadSchema = z.object({
  /** Omit to mark everything read — the "clear all" the bell menu needs. */
  ids: z.array(z.string()).max(200).optional(),
})

export const GET = withRateLimit(
  async (request: Request) => {
    try {
      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { searchParams } = new URL(request.url)
      const unreadOnly = searchParams.get('unread') === 'true'

      const [notifications, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where: {
            userId: session.user.id,
            ...(unreadOnly ? { readAt: null } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        prisma.notification.count({
          where: { userId: session.user.id, readAt: null },
        }),
      ])

      return NextResponse.json({ notifications, unreadCount })
    } catch (error) {
      return handleApiError(error)
    }
  },
  { preset: 'api', byUser: true },
)

/**
 * Marks notifications read.
 *
 * Scoped on userId in the where clause rather than checking ownership first: a
 * caller who sends someone else's ids updates nothing, instead of getting a 403
 * that confirms those ids exist.
 */
export const PATCH = withCsrfProtection(
  withRateLimit(
    async (request: Request) => {
      try {
        const session = await auth()
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { ids } = markReadSchema.parse(await request.json().catch(() => ({})))

        const result = await prisma.notification.updateMany({
          where: {
            userId: session.user.id,
            readAt: null,
            ...(ids ? { id: { in: ids } } : {}),
          },
          data: { readAt: new Date() },
        })

        return NextResponse.json({ updated: result.count })
      } catch (error) {
        return handleApiError(error)
      }
    },
    { preset: 'api', byUser: true },
  ),
)
