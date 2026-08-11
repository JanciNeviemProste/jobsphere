/**
 * Update or remove a single task.
 *
 * Completing one stamps `completedAt`, and reopening clears it — a task marked
 * DONE that still shows the date it was closed the first time is the same class
 * of quiet lie as a rejection reason left on a candidate who is back in process.
 */

import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/errors'
import { withCsrfProtection } from '@/lib/csrf'
import { withRateLimit } from '@/lib/rate-limit'
import { TASK_STATUSES } from '../route'

export const runtime = 'nodejs'

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  status: z.enum(TASK_STATUSES).optional(),
  assigneeId: z.string().optional().nullable(),
})

function taskId(context?: { params?: Record<string, string> }): string | null {
  return context?.params?.id ?? null
}

export const PATCH = withCsrfProtection(
  withRateLimit(
    async (request: Request, context?: { params?: Record<string, string> }) => {
      try {
        const id = taskId(context)
        if (!id) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })

        const { orgId } = await requireAuth(request as NextRequest)
        const data = updateTaskSchema.parse(await request.json())

        const task = await prisma.task.findFirst({ where: { id, orgId } })
        if (!task) {
          return NextResponse.json({ error: 'Task not found' }, { status: 404 })
        }

        if (data.assigneeId) {
          const member = await prisma.userOrgRole.findFirst({
            where: { userId: data.assigneeId, orgId },
          })
          if (!member) {
            return NextResponse.json(
              { error: 'That user is not a member of this organization' },
              { status: 400 },
            )
          }
        }

        const updated = await prisma.task.update({
          where: { id },
          data: {
            ...(data.title !== undefined && { title: data.title.trim() }),
            ...(data.description !== undefined && { description: data.description }),
            ...(data.dueDate !== undefined && {
              dueDate: data.dueDate ? new Date(data.dueDate) : null,
            }),
            ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId }),
            ...(data.status !== undefined && {
              status: data.status,
              completedAt: data.status === 'DONE' ? (task.completedAt ?? new Date()) : null,
            }),
          },
          include: { assignee: { select: { id: true, name: true, email: true } } },
        })

        logger.info('Task updated', { orgId, taskId: id })

        return NextResponse.json({ task: updated })
      } catch (error) {
        return handleApiError(error)
      }
    },
    { preset: 'api', byUser: true },
  ),
)

export const DELETE = withCsrfProtection(
  withRateLimit(
    async (request: Request, context?: { params?: Record<string, string> }) => {
      try {
        const id = taskId(context)
        if (!id) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })

        const { orgId } = await requireAuth(request as NextRequest)

        const task = await prisma.task.findFirst({ where: { id, orgId } })
        if (!task) {
          return NextResponse.json({ error: 'Task not found' }, { status: 404 })
        }

        // Hard delete. A task is a note-to-self about the future, not a record of
        // something that happened — CANCELED exists for "we decided not to", and
        // delete is for "this should never have been here".
        await prisma.task.delete({ where: { id } })

        logger.info('Task deleted', { orgId, taskId: id })

        return NextResponse.json({ success: true })
      } catch (error) {
        return handleApiError(error)
      }
    },
    { preset: 'api', byUser: true },
  ),
)
