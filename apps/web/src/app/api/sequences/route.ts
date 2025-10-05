/**
 * Email Sequences API
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * GET /api/sequences
 * Zoznam sekvencií pre organizáciu
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgMember = await prisma.orgMember.findFirst({
      where: { userId: session.user.id },
    })

    if (!orgMember) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const sequences = await prisma.emailSequence.findMany({
      where: { orgId: orgMember.organizationId },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    })

    return NextResponse.json({ sequences })
  } catch (error) {
    console.error('Sequences GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch sequences' }, { status: 500 })
  }
}

/**
 * POST /api/sequences
 * Vytvorenie novej sekvencie
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgMember = await prisma.orgMember.findFirst({
      where: { userId: session.user.id },
    })

    if (!orgMember) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const { name, description, steps, active } = await request.json()

    const sequence = await prisma.emailSequence.create({
      data: {
        name,
        description,
        orgId: orgMember.organizationId,
        createdBy: session.user.id,
        active: active || false,
        steps: {
          create: steps.map((step: any, index: number) => ({
            order: step.order ?? index,
            dayOffset: step.dayOffset || 0,
            subject: step.subject,
            bodyTemplate: step.bodyTemplate || step.body || '',
          })),
        },
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    })

    return NextResponse.json({ sequence })
  } catch (error) {
    console.error('Sequence POST error:', error)
    return NextResponse.json({ error: 'Failed to create sequence' }, { status: 500 })
  }
}
