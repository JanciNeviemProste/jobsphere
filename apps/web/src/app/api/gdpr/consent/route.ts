/**
 * GDPR Consent API
 * Record and manage user consent
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

/**
 * GET /api/gdpr/consent
 * Get user's consent records
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { consentType, granted, version } = await request.json()

    if (!consentType || typeof granted !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid consent data' },
        { status: 400 }
      )
    }

    // Valid consent types
    const validTypes = [
      'TERMS_OF_SERVICE',
      'PRIVACY_POLICY',
      'MARKETING_EMAILS',
      'DATA_PROCESSING',
      'COOKIES',
    ]

    if (!validTypes.includes(consentType)) {
      return NextResponse.json(
        { error: 'Invalid consent type' },
        { status: 400 }
      )
    }

    // Create consent record
    const consent = await prisma.consentRecord.create({
      data: {
        userId: session.user.id,
        consentType,
        granted,
        version: version || '1.0',
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
