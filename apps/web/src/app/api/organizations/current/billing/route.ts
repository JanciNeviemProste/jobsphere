import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const userOrgRole = await prisma.userOrgRole.findFirst({
      where: { userId: session.user.id },
    })

    if (!userOrgRole) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        orgId: userOrgRole.orgId,
        status: {
          in: ['active', 'trialing', 'past_due'],
        },
      },
      include: {
        product: {
          select: {
            name: true,
            description: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Get invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        orgId: userOrgRole.orgId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10, // Limit to last 10 invoices
    })

    return NextResponse.json({
      subscription,
      invoices,
    })
  } catch (error) {
    logger.error('Error fetching billing data:', error)
    return NextResponse.json({ error: 'Failed to fetch billing data' }, { status: 500 })
  }
}
