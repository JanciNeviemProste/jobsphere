/**
 * GDPR Data Subject Access Request (DSAR) API
 * Export, delete, or rectify user data
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

/**
 * POST /api/gdpr/dsar
 * Submit DSAR request
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { requestType, description } = await request.json()

    const validTypes = ['ACCESS', 'DELETION', 'RECTIFICATION', 'PORTABILITY']

    if (!validTypes.includes(requestType)) {
      return NextResponse.json(
        { error: 'Invalid request type' },
        { status: 400 }
      )
    }

    // Create DSAR request
    const dsarRequest = await prisma.dSARRequest.create({
      data: {
        userId: session.user.id,
        requestType,
        description: description || '',
        status: 'PENDING',
      },
    })

    // TODO: Send email notification to admin
    // TODO: Add to processing queue

    return NextResponse.json({
      success: true,
      request: dsarRequest,
      message: 'Your request has been submitted and will be processed within 30 days.',
    })
  } catch (error) {
    console.error('DSAR request error:', error)
    return NextResponse.json(
      { error: 'Failed to submit request' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/gdpr/dsar
 * Get user's DSAR requests
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const requests = await prisma.dSARRequest.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Get DSAR error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    )
  }
}
