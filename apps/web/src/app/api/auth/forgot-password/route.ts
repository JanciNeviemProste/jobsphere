import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { errorResponse } from '@/lib/errors'
import { withRateLimit } from '@/lib/rate-limit'
import * as z from 'zod'
import crypto from 'crypto'
import { sendEmail } from '@/lib/email'

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export const POST = withRateLimit(
  async (req: Request) => {
    try {
      logger.apiRequest('POST', '/api/auth/forgot-password')

      const body = await req.json()
      const { email } = forgotPasswordSchema.parse(body)

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      })

      // Always return success even if user doesn't exist (security best practice)
      if (!user) {
        logger.info('Password reset requested for non-existent email', { email })
        return NextResponse.json({
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent.',
        })
      }

      // Generate secure reset token
      const resetToken = crypto.randomBytes(32).toString('hex')
      const resetTokenExpiry = new Date(Date.now() + 3600000) // 1 hour from now

      // Hash the token before storing
      const hashedToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex')

      // Store the hashed token in database
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: hashedToken,
          expiresAt: resetTokenExpiry,
        },
      })

      // Get the app URL from environment or request
      const { headers } = req
      const host = headers.get('host') || 'localhost:3000'
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
      const resetUrl = `${protocol}://${host}/en/reset-password?token=${resetToken}`

      // Send email with reset link
      try {
        await sendEmail({
          to: user.email,
          subject: 'Reset Your Password - JobSphere',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Password Reset Request</h2>
              <p>Hi ${user.name || 'there'},</p>
              <p>We received a request to reset your password. Click the link below to create a new password:</p>
              <p style="margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Reset Password
                </a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #4F46E5;">${resetUrl}</p>
              <p>This link will expire in 1 hour.</p>
              <p>If you didn't request this password reset, you can safely ignore this email.</p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e5e5;">
              <p style="color: #666; font-size: 14px;">
                This email was sent from JobSphere. Please do not reply to this email.
              </p>
            </div>
          `,
          text: `
            Password Reset Request

            Hi ${user.name || 'there'},

            We received a request to reset your password. Visit the link below to create a new password:

            ${resetUrl}

            This link will expire in 1 hour.

            If you didn't request this password reset, you can safely ignore this email.
          `,
        })

        logger.info('Password reset email sent', { userId: user.id })
      } catch (emailError) {
        logger.error('Failed to send password reset email', emailError)
        // Still return success to not reveal if email exists
      }

      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid email address' },
          { status: 400 }
        )
      }

      logger.apiError('POST', '/api/auth/forgot-password', error)
      const errorData = errorResponse(error)
      return NextResponse.json(
        { error: errorData.error },
        { status: errorData.statusCode }
      )
    }
  },
  { preset: 'auth' } // More restrictive rate limiting for auth endpoints
)