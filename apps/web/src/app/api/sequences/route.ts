/**
 * Email Sequences API
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSequenceSchema } from '@/schemas'
import { validateRequest } from '@/lib/validation'
import { requireAuth } from '@/lib/api-helpers'
import { handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { withRateLimit } from '@/lib/rate-limit'
import { withCsrfProtection } from '@/lib/csrf'

export const runtime = 'nodejs'

/**
 * GET /api/sequences
 * Zoznam sekvencií pre organizáciu
 */
export const GET = withRateLimit(
  async function GET(request: Request) {
    try {
      const { orgId } = await requireAuth(request as NextRequest)

      // Sequences are bounded by tenancy (a few per org). The query previously had
      // no ordering at all, so row order was whatever Postgres returned; making it
      // deterministic is what lets `take` be a safe safety net.
      // `deletedAt: null` explicitly: EmailSequence is not one of the five models
      // the soft-delete middleware in lib/prisma.ts covers, so without this a
      // deleted sequence keeps appearing in the list and DELETE looks like a no-op.
      const sequences = await prisma.emailSequence.findMany({
        where: { orgId, deletedAt: null },
        include: {
          steps: {
            orderBy: { order: 'asc' },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: 200,
      })

      return NextResponse.json({ sequences })
    } catch (error) {
      return handleApiError(error)
    }
  },
  { preset: 'api' },
)

/**
 * POST /api/sequences
 * Vytvorenie novej sekvencie
 */
export const POST = withCsrfProtection(
  withRateLimit(
    async function POST(request: Request) {
      try {
        // Validate input FIRST
        const data = await validateRequest(request as NextRequest, createSequenceSchema)

        // Then authenticate
        const { userId, orgId } = await requireAuth(request as NextRequest)

        // Business logic
        const sequence = await prisma.emailSequence.create({
          data: {
            name: data.name,
            description: data.description,
            orgId,
            createdBy: userId,
            active: data.active,
            steps: {
              create: data.steps.map((step, index) => ({
                name: step.name || `Step ${index + 1}`,
                order: step.order ?? index,
                dayOffset: step.dayOffset,
                subject: step.subject,
                bodyTemplate: step.bodyTemplate,
                conditions: step.conditions ?? undefined,
                abGroup: step.abGroup ?? undefined,
              })),
            },
          },
          include: {
            steps: {
              orderBy: { order: 'asc' },
            },
          },
        })

        return NextResponse.json({ sequence }, { status: 201 })
      } catch (error) {
        return handleApiError(error)
      }
    },
    { preset: 'api', byUser: true },
  ),
)
