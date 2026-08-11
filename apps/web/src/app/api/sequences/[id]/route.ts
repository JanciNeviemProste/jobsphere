/**
 * Single email sequence — read, update, delete.
 *
 * This file did not exist. `sequences-client.tsx` has always sent
 * `PATCH /api/sequences/{id}` when saving an existing sequence, so editing one
 * returned 404 every single time; only creating a new one worked.
 *
 * Two constraints shape the update logic, and both come from the schema rather
 * than from taste:
 *
 *  1. `EmailSequenceEvent.stepId` is a REQUIRED foreign key to `EmailStep`. The
 *     obvious implementation — delete every step and recreate from the payload —
 *     therefore fails outright for any sequence that has ever sent an email, and
 *     if it were made to succeed it would erase the delivery history.
 *  2. `emailStepSchema` carries no id. Steps are identified by `order`, which is
 *     their natural key within a sequence and is what the client sends.
 *
 * So steps are reconciled by `order`: matched ones are updated in place, keeping
 * their id and their events; new orders are created; orders that disappeared are
 * deleted only when nothing references them, and otherwise deactivated.
 */

import { NextRequest, NextResponse } from 'next/server'
import { updateSequenceSchema } from '@/schemas'
import { validateRequest } from '@/lib/validation'
import { requireAuth } from '@/lib/api-helpers'
import { handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limit'
import { withCsrfProtection } from '@/lib/csrf'

export const runtime = 'nodejs'

const sequenceWithSteps = {
  steps: { orderBy: { order: 'asc' } },
} as const

/** Resolves the sequence id from the dynamic segment. */
function sequenceId(context?: { params?: Record<string, string> }): string | null {
  return context?.params?.id ?? null
}

/**
 * Loads a sequence and asserts it belongs to the caller's organisation.
 *
 * EmailSequence is not covered by the soft-delete middleware in lib/prisma.ts
 * (which only handles Job, Organization, User, Candidate and Application), so
 * `deletedAt` has to be excluded by hand here — otherwise a deleted sequence
 * stays fully editable through this route.
 */
async function findOwnedSequence(id: string, orgId: string) {
  return prisma.emailSequence.findFirst({
    where: { id, orgId, deletedAt: null },
    include: sequenceWithSteps,
  })
}

export const GET = withRateLimit(
  async (request: Request, context?: { params?: Record<string, string> }) => {
    try {
      const id = sequenceId(context)
      if (!id) {
        return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
      }

      const { orgId } = await requireAuth(request as NextRequest)
      const sequence = await findOwnedSequence(id, orgId)

      if (!sequence) {
        return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })
      }

      return NextResponse.json({ sequence })
    } catch (error) {
      return handleApiError(error)
    }
  },
  { preset: 'api', byUser: true },
)

export const PATCH = withCsrfProtection(
  withRateLimit(
    async (request: Request, context?: { params?: Record<string, string> }) => {
      try {
        const id = sequenceId(context)
        if (!id) {
          return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
        }

        const data = await validateRequest(request as NextRequest, updateSequenceSchema)
        const { orgId } = await requireAuth(request as NextRequest)

        const existing = await findOwnedSequence(id, orgId)
        if (!existing) {
          return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })
        }

        const updated = await prisma.$transaction(async (tx) => {
          await tx.emailSequence.update({
            where: { id },
            data: {
              ...(data.name !== undefined && { name: data.name }),
              ...(data.description !== undefined && { description: data.description }),
              ...(data.active !== undefined && { active: data.active }),
            },
          })

          if (data.steps) {
            const incoming = data.steps.map((step, index) => ({
              ...step,
              order: step.order ?? index,
            }))
            const incomingOrders = new Set(incoming.map((s) => s.order))
            const byOrder = new Map(existing.steps.map((s) => [s.order, s]))

            for (const step of incoming) {
              const match = byOrder.get(step.order)
              const fields = {
                name: step.name || `Step ${step.order + 1}`,
                dayOffset: step.dayOffset,
                subject: step.subject,
                bodyTemplate: step.bodyTemplate,
                conditions: step.conditions ?? undefined,
                abGroup: step.abGroup ?? undefined,
              }

              if (match) {
                // Update in place: the id survives, so does everything in
                // EmailSequenceEvent that points at it.
                await tx.emailStep.update({
                  where: { id: match.id },
                  data: { ...fields, isActive: true },
                })
              } else {
                await tx.emailStep.create({
                  data: { ...fields, order: step.order, sequenceId: id },
                })
              }
            }

            // Steps the editor removed.
            for (const step of existing.steps) {
              if (incomingOrders.has(step.order)) continue

              const events = await tx.emailSequenceEvent.count({ where: { stepId: step.id } })
              if (events === 0) {
                await tx.emailStep.delete({ where: { id: step.id } })
              } else {
                // Deleting would break the required FK on its events. Deactivating
                // takes it out of the sequence while keeping the record of what was
                // sent — which is the honest outcome, since those emails did go out.
                await tx.emailStep.update({ where: { id: step.id }, data: { isActive: false } })
              }
            }
          }

          return tx.emailSequence.findUnique({ where: { id }, include: sequenceWithSteps })
        })

        logger.info('Email sequence updated', { sequenceId: id, orgId })

        return NextResponse.json({ sequence: updated })
      } catch (error) {
        return handleApiError(error)
      }
    },
    { preset: 'api', byUser: true },
  ),
)

/**
 * Soft delete. EmailSequenceRun and EmailSequenceEvent both hold required
 * references to the sequence and its steps, so a hard delete would either fail on
 * the foreign key or destroy the record of campaigns that really ran.
 */
export const DELETE = withCsrfProtection(
  withRateLimit(
    async (request: Request, context?: { params?: Record<string, string> }) => {
      try {
        const id = sequenceId(context)
        if (!id) {
          return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
        }

        const { orgId } = await requireAuth(request as NextRequest)

        const existing = await findOwnedSequence(id, orgId)
        if (!existing) {
          return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })
        }

        // `active: false` as well as `deletedAt`: the sequence worker selects on
        // `active`, so clearing it is what actually stops further sends.
        await prisma.emailSequence.update({
          where: { id },
          data: { deletedAt: new Date(), active: false },
        })

        logger.info('Email sequence deleted', { sequenceId: id, orgId })

        return NextResponse.json({ success: true })
      } catch (error) {
        return handleApiError(error)
      }
    },
    { preset: 'api', byUser: true },
  ),
)
