/**
 * User Service
 * Centralized business logic for user management
 */

import { prisma } from '@/lib/prisma'
import { User, Prisma } from '@prisma/client'
import { hash, compare } from 'bcryptjs'
import { createAuditLog } from '@/lib/audit-log'
import { AppError } from '@/lib/errors'
import crypto from 'crypto'
import { logger } from '@/lib/logger'

export interface CreateUserInput {
  email: string
  password: string
  name: string
  orgId?: string
}

export interface UpdateUserInput {
  email?: string
  name?: string
  avatar?: string
  emailVerified?: boolean
}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
}

export interface UserSearchParams {
  search?: string
  orgId?: string
  emailVerified?: boolean
  limit?: number
  offset?: number
}

export class UserService {
  /**
   * Create a new user
   */
  static async createUser(input: CreateUserInput): Promise<User> {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    })

    if (existingUser) {
      throw new AppError('User with this email already exists', 400)
    }

    // Validate password strength
    if (input.password.length < 12) {
      throw new AppError('Password must be at least 12 characters long', 400)
    }

    // Hash password
    const hashedPassword = await hash(input.password, 12)

    const user = await prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          email: input.email,
          password: hashedPassword,
          name: input.name,
        },
      })

      // If orgId provided, add to organization
      if (input.orgId) {
        await tx.userOrgRole.create({
          data: {
            userId: newUser.id,
            orgId: input.orgId,
            role: 'RECRUITER',
          },
        })
      }

      // Create audit log
      await createAuditLog({
        userId: newUser.id,
        orgId: input.orgId || 'SYSTEM',
        action: 'CREATE',
        resource: 'USER',
        resourceId: newUser.id,
        metadata: {
          email: input.email,
          name: input.name,
        },
      })

      return newUser
    })

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user
    return userWithoutPassword as User
  }

  /**
   * Update user profile
   */
  static async updateUser(userId: string, input: UpdateUserInput): Promise<User> {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!existingUser) {
      throw new AppError('User not found', 404)
    }

    // If email is being changed, check uniqueness
    if (input.email && input.email !== existingUser.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email: input.email },
      })

      if (emailTaken) {
        throw new AppError('Email already in use', 400)
      }
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          ...(input.email && { email: input.email }),
          ...(input.name && { name: input.name }),
          ...(input.avatar !== undefined && { avatar: input.avatar }),
          ...(input.emailVerified !== undefined && {
            emailVerified: input.emailVerified ? new Date() : null,
          }),
        },
      })

      // Create audit log
      await createAuditLog({
        userId,
        orgId: 'SYSTEM',
        action: 'UPDATE',
        resource: 'USER',
        resourceId: userId,
        metadata: input as Prisma.InputJsonValue,
      })

      return user
    })

    const { password: _, ...userWithoutPassword } = updatedUser
    return userWithoutPassword as User
  }

  /**
   * Change user password
   */
  static async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new AppError('User not found', 404)
    }

    // Verify current password
    const isValidPassword = await compare(input.currentPassword, user.password!)

    if (!isValidPassword) {
      throw new AppError('Current password is incorrect', 400)
    }

    // Validate new password
    if (input.newPassword.length < 8) {
      throw new AppError('New password must be at least 8 characters long', 400)
    }

    // Hash new password
    const hashedPassword = await hash(input.newPassword, 12)

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      })

      await createAuditLog({
        userId,
        orgId: 'SYSTEM',
        action: 'UPDATE',
        resource: 'USER',
        resourceId: userId,
        metadata: { password: 'CHANGED' },
      })
    })
  }

  /**
   * Search users
   */
  static async searchUsers(params: UserSearchParams): Promise<{
    users: User[]
    total: number
  }> {
    const { search, orgId, emailVerified, limit = 50, offset = 0 } = params

    const where: Prisma.UserWhereInput = {
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(orgId && {
        orgMembers: {
          some: { orgId },
        },
      }),
      ...(emailVerified !== undefined && {
        emailVerified: emailVerified ? { not: null } : null,
      }),
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        emailVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    })
    const total = await prisma.user.count({ where })

    return { users: users as unknown as User[], total }
  }

  /**
   * Get user by ID with full details
   */
  static async getUserById(userId: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        orgMembers: {
          include: {
            organization: true,
          },
        },
        sessions: {
          where: {
            expires: { gt: new Date() },
          },
          orderBy: { expires: 'desc' },
          take: 5,
        },
      } as any,
    })

    if (!user) return null

    const { password: _, ...userWithoutPassword } = user
    return userWithoutPassword as unknown as User
  }

  /**
   * Delete user account
   */
  static async deleteUser(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new AppError('User not found', 404)
    }

    await prisma.$transaction(async (tx) => {
      // Delete all user sessions
      await tx.session.deleteMany({
        where: { userId },
      })

      // Delete org memberships
      await tx.userOrgRole.deleteMany({
        where: { userId },
      })

      // Delete user
      await tx.user.delete({
        where: { id: userId },
      })

      await createAuditLog({
        userId,
        orgId: 'SYSTEM',
        action: 'DELETE',
        resource: 'USER',
        resourceId: userId,
        metadata: { email: user.email },
      })
    })
  }

  /**
   * Create an email-verification token and email the verification link.
   * (AUTH-009) The raw token is sent in the email; only a SHA-256 hash is
   * persisted so a DB read cannot be replayed as a valid link.
   *
   * No-ops silently when the email does not belong to a real account so callers
   * can stay generic (AUTH-008, no user enumeration).
   */
  static async createEmailVerificationToken(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase()

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, name: true, emailVerified: true },
    })

    // Don't reveal whether the account exists or is already verified
    if (!user || user.emailVerified) {
      return
    }

    const rawToken = crypto.randomBytes(32).toString('hex')
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expires = new Date(Date.now() + 3600000) // 1 hour

    // Replace any outstanding verification tokens for this email
    await prisma.verificationToken.deleteMany({
      where: { identifier: user.email, type: 'EMAIL_VERIFICATION' },
    })

    await prisma.verificationToken.create({
      data: {
        identifier: user.email,
        token: hashedToken,
        type: 'EMAIL_VERIFICATION',
        expires,
      },
    })

    try {
      const { sendEmail } = await import('@/lib/email')
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const verifyUrl = `${appUrl}/verify-email?token=${rawToken}`

      await sendEmail({
        to: user.email,
        subject: 'Verify Your Email - JobSphere',
        html: `
          <h2>Verify your email</h2>
          <p>Hi ${user.name || 'there'},</p>
          <p>Thanks for signing up. Please confirm your email address to activate your account:</p>
          <p><a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
          <p>Or paste this link into your browser:</p>
          <p style="word-break: break-all; color: #4F46E5;">${verifyUrl}</p>
          <p>This link will expire in 1 hour. If you didn't create an account, you can ignore this email.</p>
          <hr />
          <p style="color: #666; font-size: 12px;">JobSphere ATS - Modern recruitment platform</p>
        `,
      })
    } catch (emailError) {
      logger.error('Failed to send verification email:', emailError)
      // Don't fail the caller if the email provider hiccups
    }
  }

  /**
   * Verify email with token.
   * Accepts the raw token from the verification link and matches it against the
   * stored SHA-256 hash. The legacy plaintext-token shape is still supported for
   * backwards compatibility with previously issued tokens.
   */
  static async verifyEmail(token: string): Promise<User> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    // Prefer the hashed (current) token; fall back to a legacy plaintext token
    const verificationToken =
      (await prisma.verificationToken.findUnique({ where: { token: hashedToken } })) ??
      (await prisma.verificationToken.findUnique({ where: { token } }))

    if (!verificationToken) {
      throw new AppError('Invalid verification token', 400)
    }

    if (verificationToken.expires < new Date()) {
      throw new AppError('Verification token has expired', 400)
    }

    const user = await prisma.$transaction(async (tx) => {
      // Update user
      const updatedUser = await tx.user.update({
        where: { email: verificationToken.identifier },
        data: { emailVerified: new Date() },
      })

      // Delete token
      await tx.verificationToken.delete({
        where: { token: verificationToken.token },
      })

      return updatedUser
    })

    const { password: _, ...userWithoutPassword } = user
    return userWithoutPassword as User
  }

  /**
   * Create password reset token
   */
  static async createPasswordResetToken(email: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      // Don't reveal if user exists
      return 'TOKEN_SENT'
    }

    // Generate secure token
    const token = crypto.randomUUID()
    const expires = new Date(Date.now() + 3600000) // 1 hour

    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires,
      },
    })

    // Send password reset email
    try {
      const { sendEmail } = await import('@/lib/email')
      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`

      await sendEmail({
        to: email,
        subject: 'Reset Your Password - JobSphere',
        html: `
          <h2>Password Reset Request</h2>
          <p>Hi ${user.name || 'there'},</p>
          <p>We received a request to reset your password. Click the link below to create a new password:</p>
          <p><a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0070f3; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <hr />
          <p style="color: #666; font-size: 12px;">JobSphere ATS - Modern recruitment platform</p>
        `,
      })
    } catch (emailError) {
      logger.error('Failed to send password reset email:', emailError)
      // Don't fail the request if email fails
    }

    return token
  }

  /**
   * Reset password with token
   */
  static async resetPassword(token: string, newPassword: string): Promise<void> {
    const resetToken = await prisma.verificationToken.findUnique({
      where: { token },
    })

    if (!resetToken) {
      throw new AppError('Invalid reset token', 400)
    }

    if (resetToken.expires < new Date()) {
      throw new AppError('Reset token has expired', 400)
    }

    if (newPassword.length < 12) {
      throw new AppError('Password must be at least 12 characters long', 400)
    }

    const hashedPassword = await hash(newPassword, 12)

    await prisma.$transaction(async (tx) => {
      // Update password and bump sessionEpoch (AUTH-001) so any active sessions
      // (e.g. an attacker who knew the old password) are revoked on reset.
      await tx.user.update({
        where: { email: resetToken.identifier },
        data: { password: hashedPassword, sessionEpoch: { increment: 1 } },
      })

      // Delete token
      await tx.verificationToken.delete({
        where: { token },
      })
    })
  }
}
