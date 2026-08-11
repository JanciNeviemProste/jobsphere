/**
 * Follow-ups: something to do, someone who owns it, a date it is due.
 *
 * There was no model and no field anywhere to record "call her back on Thursday",
 * so that lived in people's heads or in a notebook. The consequence is not
 * untidiness — it is that the product could not remind anyone, and a colleague
 * picking up a candidate could not see what was already promised.
 */

import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { notify } from '@/lib/notifications'
import { handleApiError } from '@/lib/errors'
import { withCsrfProtection } from '@/lib/csrf'
import { withRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export const TASK_STATUSES = ['OPEN', 'DONE', 'CANCELED'] as const

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  dueDate: z.string().datetime().optional(),
  assigneeId: z.string().optional(),
  applicationId: z.string().optional(),
  candidateId: z.string().optional(),
})

export const GET = withRateLimit(
  async (request: Request) => {
    try {
      const { userId, orgId } = await requireAuth(request as NextRequest)
      const { searchParams } = new URL(request.url)

      const status = searchParams.get('status')
      const mine = searchParams.get('mine') === 'true'
      const applicationId = searchParams.get('applicationId') ?? undefined
      const candidateId = searchParams.get('candidateId') ?? undefined

      const tasks = await prisma.task.findMany({
        where: {
          orgId,
          ...(status && (TASK_STATUSES as readonly string[]).includes(status) ? { status } : {}),
          ...(mine ? { assigneeId: userId } : {}),
          ...(applicationId ? { applicationId } : {}),
          ...(candidateId ? { candidateId } : {}),
        },
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          application: { select: { id: true, job: { select: { title: true } } } },
        },
        // Soonest first, and tasks with no date last rather than first —
        // `nulls: 'last'` because an undated task is a someday, not an overdue.
        orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
        take: 200,
      })

      return NextResponse.json({ tasks })
    } catch (error) {
      return handleApiError(error)
    }
  },
  { preset: 'api', byUser: true },
)

export const POST = withCsrfProtection(
  withRateLimit(
    async (request: Request) => {
      try {
        const { userId, orgId } = await requireAuth(request as NextRequest)
        const data = createTaskSchema.parse(await request.json())

        // Every anchor is checked against the caller's org. A task is readable by
        // the whole organisation, so an application id from another tenant would
        // leak that application's job title through the list endpoint above.
        if (data.applicationId) {
          const application = await prisma.application.findFirst({
            where: { id: data.applicationId, orgId },
          })
          if (!application) {
            return NextResponse.json({ error: 'Application not found' }, { status: 404 })
          }
        }
        if (data.candidateId) {
          const candidate = await prisma.candidate.findFirst({
            where: { id: data.candidateId, orgId },
          })
          if (!candidate) {
            return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
          }
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

        const task = await prisma.task.create({
          data: {
            orgId,
            title: data.title.trim(),
            description: data.description ?? null,
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
            // Unassigned tasks tend to belong to nobody, so the creator owns it
            // unless someone else is named.
            assigneeId: data.assigneeId ?? userId,
            createdBy: userId,
            applicationId: data.applicationId ?? null,
            candidateId: data.candidateId ?? null,
          },
          include: { assignee: { select: { id: true, name: true, email: true } } },
        })

        // Only when it lands on somebody else — telling you about the task you
        // just wrote yourself is exactly the noise that makes people stop
        // reading the list.
        if (task.assigneeId && task.assigneeId !== userId) {
          await notify({
            userId: task.assigneeId,
            type: 'TASK_ASSIGNED',
            title: 'Task assigned to you',
            body: task.title,
            data: { taskId: task.id, dueDate: task.dueDate?.toISOString() ?? null },
          })
        }

        logger.info('Task created', { orgId, taskId: task.id })

        return NextResponse.json({ task }, { status: 201 })
      } catch (error) {
        return handleApiError(error)
      }
    },
    { preset: 'api', byUser: true },
  ),
)
