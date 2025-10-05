/**
 * Email Sequences API
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

/**
 * GET /api/sequences
 * Zoznam sekvencií pre organizáciu
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
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
      where: { organizationId: orgMember.organizationId },
      include: {
        steps: {
          orderBy: { orderIndex: 'asc' },
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
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgMember = await prisma.orgMember.findFirst({
      where: { userId: session.user.id },
    })

    if (!orgMember) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const { name, description, steps, isActive } = await request.json()

    const sequence = await prisma.emailSequence.create({
      data: {
        name,
        description,
        organizationId: orgMember.organizationId,
        isActive: isActive || false,
        steps: {
          create: steps.map((step: any) => ({
            orderIndex: step.orderIndex,
            subject: step.subject,
            bodyText: step.bodyText,
            bodyHtml: step.bodyHtml,
            delayMinutes: step.delayMinutes,
          })),
        },
      },
      include: {
        steps: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    })

    return NextResponse.json({ sequence })
  } catch (error) {
    console.error('Sequence POST error:', error)
    return NextResponse.json({ error: 'Failed to create sequence' }, { status: 500 })
  }
}
