import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { errorResponse } from '@/lib/errors'
import { withRateLimit } from '@/lib/rate-limit'
import { UserService } from '@/services/user.service'
import * as z from 'zod'

export const runtime = 'nodejs'

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
})

/**
 * POST /api/auth/verify-email
 * Consumes an email-verification token (AUTH-009) and marks the account verified.
 */
export const POST = withRateLimit(
  async (req: Request) => {
    try {
      logger.apiRequest('POST', '/api/auth/verify-email')

      const body = await req.json()
      const { token } = verifyEmailSchema.parse(body)

      await UserService.verifyEmail(token)

      return NextResponse.json({
        success: true,
        message: 'Email verified successfully. You can now sign in.',
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request', issues: error.issues },
          { status: 400 },
        )
      }

      logger.apiError('POST', '/api/auth/verify-email', error)
      const errorData = errorResponse(error)
      return NextResponse.json({ error: errorData.error }, { status: errorData.statusCode })
    }
  },
  { preset: 'strict' }, // 10 requests per 15 minutes
)
