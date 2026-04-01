/**
 * GDPR Consent API
 * Record and manage user consent
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limit'
import { withCsrfProtection } from '@/lib/csrf'

export const runtime = 'nodejs'

// Validation schema for GDPR consent
const consentSchema = z.object({
  purpose: z.enum(['MARKETING', 'ANALYTICS', 'COOKIES'], {
    errorMap: () => ({
      message: 'Invalid consent purpose. Must be MARKETING, ANALYTICS, or COOKIES.',
    }),
  }),
  granted: z.boolean({
    errorMap: () => ({ message: 'Granted must be a boolean value.' }),
  }),
  legalBasis: z.enum(['CONSENT', 'LEGITIMATE_INTEREST', 'CONTRACT']).optional(),
})

/**
 * GET /api/gdpr/consent
 * Get user's consent records
 */
export const GET = withRateLimit(
  async function GET(request: Request) {
    try {
      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Get user's consent records
      const consents = await prisma.consentRecord.findMany({
        where: { userId: session.user.id },
        orderBy: { grantedAt: 'desc' },
      })

      return NextResponse.json({ consents })
    } catch (error) {
      logger.error('Get consent error:', error)
      return NextResponse.json({ error: 'Failed to fetch consent records' }, { status: 500 })
    }
  },
  { preset: 'api' },
)

/**
 * POST /api/gdpr/consent
 * Record new consent
 */
export const POST = withCsrfProtection(
  withRateLimit(
    async function POST(request: Request) {
      try {
        const session = await auth()
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()

        // Validate request body with Zod schema
        const validationResult = consentSchema.safeParse(body)

        if (!validationResult.success) {
          return NextResponse.json(
            {
              error: 'Invalid consent data',
              details: validationResult.error.flatten().fieldErrors,
            },
            { status: 400 },
          )
        }

        const { purpose, granted, legalBasis } = validationResult.data

        // Create consent record with validated data
        const consent = await prisma.consentRecord.create({
          data: {
            userId: session.user.id,
            consentType: purpose,
            granted,
            purpose,
            legalBasis: legalBasis || 'CONSENT',
            ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
            userAgent: request.headers.get('user-agent') || 'unknown',
          },
        })

        return NextResponse.json({ consent }, { status: 201 })
      } catch (error) {
        logger.error('Record consent error:', error)
        return NextResponse.json({ error: 'Failed to record consent' }, { status: 500 })
      }
    },
    { preset: 'api', byUser: true },
  ),
)
