import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limit'
import { withCsrfProtection } from '@/lib/csrf'
import { createAuditLog } from '@/lib/audit-log'
import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'

export const runtime = 'nodejs'

const sendEmailSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(200),
  body: z.string().min(1, 'Body is required').max(10000),
})

export const POST = withCsrfProtection(
  withRateLimit(
    async (req: Request, context?: { params?: Record<string, string> }) => {
      try {
        const session = await auth()
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const params = context?.params
        if (!params?.id) {
          return NextResponse.json({ error: 'Missing application ID' }, { status: 400 })
        }

        const rawBody = await req.json()
        const { subject, body } = sendEmailSchema.parse(rawBody)

        // Get application with candidate contact
        const application = await prisma.application.findUnique({
          where: { id: params!.id },
          include: {
            job: {
              include: {
                organization: true,
              },
            },
            candidate: {
              include: {
                contacts: {
                  where: { isPrimary: true },
                  take: 1,
                },
              },
            },
          },
        })

        if (!application) {
          return NextResponse.json({ error: 'Application not found' }, { status: 404 })
        }

        // Verify user is member of organization
        const membership = await prisma.userOrgRole.findFirst({
          where: {
            userId: session.user.id,
            orgId: application.job.orgId,
          },
        })

        if (!membership) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const candidateEmail = application.candidate.contacts?.[0]?.email
        if (!candidateEmail) {
          return NextResponse.json({ error: 'No email found for candidate' }, { status: 400 })
        }

        const safeBody = DOMPurify.sanitize(body, {
          USE_PROFILES: { html: true },
          FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
          FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'onblur'],
          ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
        })

        // Send email
        await sendEmail({
          to: candidateEmail,
          subject,
          html: safeBody,
        })

        // Log activity
        await prisma.applicationActivity.create({
          data: {
            applicationId: params!.id,
            type: 'EMAIL_SENT',
            description: `Email sent: ${subject}`,
            performedBy: session.user.id,
            metadata: {
              subject,
              to: candidateEmail,
              sentBy: session.user.name || session.user.email,
            },
          },
        })

        await createAuditLog({
          userId: session.user.id,
          orgId: application.job.orgId,
          action: 'EMAIL_SENT',
          resource: 'EMAIL',
          resourceId: params!.id,
          metadata: {
            subject,
            to: candidateEmail,
          },
        })

        // Update last contact tracking
        await prisma.application.update({
          where: { id: params!.id },
          data: {
            lastContactAt: new Date(),
            lastContactType: 'EMAIL',
          },
        })

        return NextResponse.json({ success: true })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: 'Validation failed', issues: error.issues },
            { status: 400 },
          )
        }

        logger.error('Error sending email:', error)
        return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
      }
    },
    { preset: 'strict', byUser: true },
  ),
)
