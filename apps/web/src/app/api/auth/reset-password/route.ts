import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { errorResponse } from '@/lib/errors'
import { withRateLimit } from '@/lib/rate-limit'
import * as z from 'zod'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain uppercase, lowercase, number and special character'
    ),
})

export const POST = withRateLimit(
  async (req: Request) => {
    try {
      logger.apiRequest('POST', '/api/auth/reset-password')

      const body = await req.json()
      const { token, password } = resetPasswordSchema.parse(body)

      // Hash the token to compare with stored version
      const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex')

      // Find valid reset token
      const resetToken = await prisma.verificationToken.findFirst({
        where: {
          token: hashedToken,
          type: 'PASSWORD_RESET',
          expires: {
            gt: new Date(), // Token must not be expired
          },
        },
      })

      if (!resetToken) {
        return NextResponse.json(
          { error: 'Invalid or expired reset token' },
          { status: 400 }
        )
      }

      // Find user by email from the token identifier
      const user = await prisma.user.findUnique({
        where: { email: resetToken.identifier },
      })

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 12)

      // Update user password
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
        },
      })

      // Delete all reset tokens for this email
      await prisma.verificationToken.deleteMany({
        where: {
          identifier: resetToken.identifier,
          type: 'PASSWORD_RESET',
        },
      })

      logger.info('Password reset successful', { userId: user.id })

      // Send confirmation email
      try {
        const { sendEmail } = await import('@/lib/email')
        await sendEmail({
          to: user.email,
          subject: 'Password Changed Successfully - JobSphere',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Password Changed Successfully</h2>
              <p>Hi ${user.name || 'there'},</p>
              <p>Your password has been successfully changed.</p>
              <p>If you didn't make this change, please contact our support team immediately.</p>
              <p style="margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_URL}/login" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Sign In
                </a>
              </p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e5e5;">
              <p style="color: #666; font-size: 14px;">
                This email was sent from JobSphere. Please do not reply to this email.
              </p>
            </div>
          `,
          text: `
            Password Changed Successfully

            Hi ${user.name || 'there'},

            Your password has been successfully changed.

            If you didn't make this change, please contact our support team immediately.

            Sign in at: ${process.env.NEXT_PUBLIC_URL}/login
          `,
        })
      } catch (emailError) {
        logger.error('Failed to send password change confirmation email', emailError)
        // Don't fail the request if email fails
      }

      return NextResponse.json({
        success: true,
        message: 'Password has been reset successfully',
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid password format', issues: error.issues },
          { status: 400 }
        )
      }

      logger.apiError('POST', '/api/auth/reset-password', error)
      const errorData = errorResponse(error)
      return NextResponse.json(
        { error: errorData.error },
        { status: errorData.statusCode }
      )
    }
  },
  { preset: 'auth' } // More restrictive rate limiting for auth endpoints
)