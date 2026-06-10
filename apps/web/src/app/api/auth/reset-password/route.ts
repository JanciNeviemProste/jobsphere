import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { errorResponse } from '@/lib/errors'
import { withRateLimit } from '@/lib/rate-limit'
import { strongPasswordSchema } from '@/lib/validation'
import * as z from 'zod'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

export const runtime = 'nodejs'

const resetPasswordSchema = z.object({
  token: z.string(),
  password: strongPasswordSchema,
})

export const POST = withRateLimit(
  async (req: Request) => {
    try {
      logger.apiRequest('POST', '/api/auth/reset-password')

      const body = await req.json()
      const { token, password } = resetPasswordSchema.parse(body)

      // Hash the token to compare with stored version
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

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
        return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 })
      }

      // Find user by email from the token identifier
      const user = await prisma.user.findUnique({
        where: { email: resetToken.identifier },
      })

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      // Delete token FIRST to prevent race-condition double-use
      const deleted = await prisma.verificationToken.deleteMany({
        where: {
          token: hashedToken,
          type: 'PASSWORD_RESET',
        },
      })

      // If nothing was deleted, another concurrent request already consumed it
      if (deleted.count === 0) {
        return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 })
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 12)

      // Update user password and bump sessionEpoch (AUTH-001) to revoke any
      // active sessions on a successful password reset.
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          sessionEpoch: { increment: 1 },
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
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
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

            Sign in at: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login
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
          { status: 400 },
        )
      }

      logger.apiError('POST', '/api/auth/reset-password', error)
      const errorData = errorResponse(error)
      return NextResponse.json({ error: errorData.error }, { status: errorData.statusCode })
    }
  },
  { preset: 'strict' }, // Strict rate limiting for sensitive password reset
)
