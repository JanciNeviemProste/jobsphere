/**
 * Email Sequences API
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSequenceSchema } from '@/schemas'
import { validateRequest } from '@/lib/validation'
import { requireAuth } from '@/lib/api-helpers'
import { handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/db'
import { withRateLimit } from '@/lib/rate-limit'
import { withCsrfProtection } from '@/lib/csrf'

/**
 * GET /api/sequences
 * Zoznam sekvencií pre organizáciu
 */
export const GET = withRateLimit(
  async function GET(request: Request) {
    try {
      const { orgId } = await requireAuth(request as NextRequest)

      const sequences = await prisma.emailSequence.findMany({
        where: { orgId },
        include: {
          steps: {
            orderBy: { order: 'asc' },
          },
        },
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
