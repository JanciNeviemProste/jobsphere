import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { hash } from 'bcryptjs'
import { z } from 'zod'
import { requireGlobalAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { createAuditLog, getRequestMetadata } from '@/lib/audit-log'
import { handleApiError } from '@/lib/errors'
import { withCsrfProtection } from '@/lib/csrf'
import { withRateLimit } from '@/lib/rate-limit'
import { generateUniqueOrgSlug } from '@/lib/org-slug'
import { sendEmail, getInvitationEmail } from '@/lib/email'

export const runtime = 'nodejs'

const inviteOrgSchema = z.object({
  orgName: z.string().min(1, 'Organization name is required').max(200),
  adminEmail: z.string().email('A valid admin email is required'),
  industry: z.string().max(100).optional(),
})

/**
 * POST /api/admin/organizations/invite
 *
 * Superadmin-only: provision a brand-new company plus its first ORG_ADMIN and
 * email them a set-password invite link.
 *
 * The org + user + membership (+ set-password token for new users) are created
 * atomically in a single $transaction. The invite email is sent best-effort
 * AFTER the transaction commits, so a mail outage never rolls back a valid
 * provisioning (mirrors the members-route pattern) — the response carries an
 * `emailSent` flag so the UI can warn instead of silently reporting success.
 */
export const POST = withCsrfProtection(
  withRateLimit(
    async (req: Request) => {
      try {
        const session = await requireGlobalAdmin()
        if (!session) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await req.json()
        const { orgName, adminEmail, industry } = inviteOrgSchema.parse(body)
        const email = adminEmail.toLowerCase()

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

        // Provision org + admin user + membership atomically. `actionUrl` / the
        // email are computed here but only SENT after the txn commits.
        const result = await prisma.$transaction(async (tx) => {
          const slug = await generateUniqueOrgSlug(orgName, tx)

          const organization = await tx.organization.create({
            data: {
              name: orgName.trim(),
              slug,
              industry: industry || null,
            },
            select: { id: true, name: true, slug: true },
          })

          let user = await tx.user.findUnique({ where: { email } })
          const isNewUser = !user

          let actionUrl = `${appUrl}/login`
          if (!user) {
            // New account: store a password hash (real password chosen via the
            // set-password link) and issue a 7-day set-password token.
            const tempPassword = crypto.randomBytes(16).toString('hex')
            const hashedPassword = await hash(tempPassword, 12)

            user = await tx.user.create({
              data: {
                email,
                password: hashedPassword,
                name: email.split('@')[0],
              },
            })

            const inviteToken = crypto.randomUUID()
            await tx.verificationToken.create({
              data: {
                identifier: email,
                token: inviteToken,
                expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              },
            })
            actionUrl = `${appUrl}/reset-password?token=${inviteToken}`
          }

          await tx.userOrgRole.create({
            data: {
              userId: user.id,
              orgId: organization.id,
              role: 'ORG_ADMIN',
            },
          })

          return { organization, userEmail: user.email, isNewUser, actionUrl }
        })

        // Best-effort invite email (never fails the request).
        let emailSent = true
        try {
          const emailResult = await sendEmail({
            to: result.userEmail,
            subject: result.isNewUser
              ? `You're invited to join ${orgName} on JobSphere`
              : `You've been added to ${orgName}`,
            html: getInvitationEmail({
              isNewUser: result.isNewUser,
              orgName,
              role: 'ORG_ADMIN',
              actionUrl: result.actionUrl,
            }),
          })
          if (!emailResult.success) emailSent = false
        } catch (emailError) {
          emailSent = false
          logger.error('Failed to send org invitation email:', emailError)
        }

        logger.info(
          `Admin invited organization ${result.organization.id} (${orgName}) by ${session.user.id}`,
        )

        await createAuditLog({
          userId: session.user.id,
          orgId: result.organization.id,
          action: 'CREATE',
          resource: 'ORGANIZATION',
          resourceId: result.organization.id,
          metadata: { name: orgName, adminEmail, emailSent, viaInvite: true },
          ...getRequestMetadata(req),
        })

        return NextResponse.json(
          {
            organization: result.organization,
            emailSent,
            message: emailSent
              ? 'Organization created and invitation sent'
              : 'Organization created, but the invitation e-mail could not be sent — check the e-mail (Resend) configuration.',
          },
          { status: 201 },
        )
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: 'Validation failed', issues: error.issues },
            { status: 400 },
          )
        }
        logger.error('Admin POST /organizations/invite error:', error)
        return handleApiError(error)
      }
    },
    { preset: 'api' },
  ),
)
