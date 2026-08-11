/**
 * In-app notifications.
 *
 * The `Notification` model has existed in the schema — with a `User.notifications`
 * relation and two indexes — and `prisma.notification` appeared nowhere in
 * apps/web/src. Not one write, not one read, no API, no UI. The settings screen
 * even offers an `inAppNotifications` preference that nothing has ever consumed.
 *
 * This is the write side. It is deliberately best-effort: a notification is a
 * courtesy, and failing to record one must never roll back the thing it is about.
 * The same reasoning the email paths already use.
 */

import { prisma } from './prisma'
import { logger } from './logger'

export type NotificationType =
  | 'APPLICATION_RECEIVED'
  | 'APPLICATION_STAGE_CHANGED'
  | 'INTERVIEW_SCHEDULED'
  | 'TASK_ASSIGNED'

export interface NotifyInput {
  userId: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, unknown>
}

/**
 * Records one notification. Never throws.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: (input.data ?? {}) as never,
      },
    })
  } catch (error) {
    logger.error('Failed to create notification', { error, type: input.type })
  }
}

/**
 * Notifies everyone in an organisation except the person who caused the event.
 *
 * Telling a recruiter about their own stage change is noise, and noise is how a
 * notification list becomes something people stop reading.
 */
export async function notifyOrg(
  orgId: string,
  input: Omit<NotifyInput, 'userId'> & { exceptUserId?: string },
): Promise<void> {
  try {
    const members = await prisma.userOrgRole.findMany({
      where: {
        orgId,
        ...(input.exceptUserId ? { userId: { not: input.exceptUserId } } : {}),
      },
      select: { userId: true },
    })

    if (members.length === 0) return

    await prisma.notification.createMany({
      data: members.map((member) => ({
        userId: member.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: (input.data ?? {}) as never,
      })),
    })
  } catch (error) {
    logger.error('Failed to create org notifications', { error, type: input.type })
  }
}
