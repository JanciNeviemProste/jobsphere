/**
 * Email Sequences API
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSequenceSchema } from '@/schemas'
import { validateRequest } from '@/lib/validation'
import { requireAuth } from '@/lib/api-helpers'
import { handleApiError } from '@/lib/errors'
import { prisma } from '@/lib/db'

/**
 * GET /api/sequences
 * Zoznam sekvencií pre organizáciu
 */
export async function GET(request: NextRequest) {
  try {
    const { orgId } = await requireAuth(request)

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
}

/**
 * POST /api/sequences
 * Vytvorenie novej sekvencie
 */
export async function POST(request: NextRequest) {
  try {
    // Validate input FIRST
    const data = await validateRequest(request, createSequenceSchema)

    // Then authenticate
    const { userId, orgId } = await requireAuth(request)

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
            name: `Step ${index + 1}`,
            order: step.order ?? index,
            dayOffset: step.dayOffset,
            hourOffset: 0,
            subject: step.subject,
            bodyTemplate: step.bodyTemplate,
            conditions: step.conditions ?? undefined,
            abGroup: step.abVariant ?? undefined,
            abPercent: undefined,
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
}
