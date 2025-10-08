/**
 * GDPR Consent API
 * Record and manage user consent
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * GET /api/gdpr/consent
 * Get user's consent records
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // TODO: ConsentRecord model not yet implemented in schema
    // @ts-ignore
    const consents = await prisma.consentRecord.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ consents })
  } catch (error) {
    console.error('Get consent error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch consent records' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/gdpr/consent
 * Record new consent
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { purpose, granted } = await request.json()

    if (!purpose || typeof granted !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid consent data' },
        { status: 400 }
      )
    }

    // Valid consent purposes
    const validPurposes = [
      'MARKETING',
      'ANALYTICS',
      'COOKIES',
    ]

    if (!validPurposes.includes(purpose)) {
      return NextResponse.json(
        { error: 'Invalid consent purpose' },
        { status: 400 }
      )
    }

    // Create consent record
    // TODO: ConsentRecord model not yet implemented in schema
    // @ts-ignore
    const consent = await prisma.consentRecord.create({
      data: {
        userId: session.user.id,
        purpose,
        granted,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    })

    return NextResponse.json({ consent })
  } catch (error) {
    console.error('Record consent error:', error)
    return NextResponse.json(
      { error: 'Failed to record consent' },
      { status: 500 }
    )
  }
}
