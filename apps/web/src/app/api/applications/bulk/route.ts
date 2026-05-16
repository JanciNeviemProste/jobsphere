import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limit'
import { withCsrfProtection } from '@/lib/csrf'
import { createAuditLog } from '@/lib/audit-log'
import { ApplicationService } from '@/services/application.service'
import { APPLICATION_STAGES } from '@/lib/constants/application-stages'
import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'

export const runtime = 'nodejs'

const bulkSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('move-stage'),
    applicationIds: z.array(z.string().cuid()).min(1).max(200),
    stage: z.enum(APPLICATION_STAGES),
  }),
  z.object({
    action: z.literal('reject'),
    applicationIds: z.array(z.string().cuid()).min(1).max(200),
  }),
  z.object({
    action: z.literal('send-email'),
    applicationIds: z.array(z.string().cuid()).min(1).max(50),
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(10000),
  }),
])

export const POST = withCsrfProtection(
  withRateLimit(
    async (req: Request) => {
      try {
        const session = await auth()
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const rawBody = await req.json()
        const payload = bulkSchema.parse(rawBody)

        const membership = await prisma.userOrgRole.findFirst({
          where: { userId: session.user.id },
          select: { orgId: true },
        })

        if (!membership) {
          return NextResponse.json({ error: 'No organization found' }, { status: 403 })
        }

        const { orgId } = membership
        const ids = payload.applicationIds

        const permitted = await prisma.application.findMany({
          where: { id: { in: ids }, deletedAt: null, job: { orgId } },
          select: { id: true },
        })

        if (permitted.length !== ids.length) {
          return NextResponse.json(
            {
              error: 'Some applications do not belong to your organization',
              permittedCount: permitted.length,
              requestedCount: ids.length,
            },
            { status: 403 },
          )
        }

        const permittedIds = permitted.map((a) => a.id)

        if (payload.action === 'move-stage') {
          const count = await ApplicationService.bulkUpdateStatus(
            permittedIds,
            payload.stage,
            session.user.id,
          )

          await createAuditLog({
            userId: session.user.id,
            orgId,
            action: 'APPLICATION_BULK_UPDATE',
            resource: 'APPLICATION',
            resourceId: 'BULK',
            metadata: { applicationIds: permittedIds, stage: payload.stage, count },
          })

          return NextResponse.json({ ok: true, action: 'move-stage', processed: count })
        }

        if (payload.action === 'reject') {
          const count = await ApplicationService.bulkUpdateStatus(
            permittedIds,
            'REJECTED',
            session.user.id,
          )

          await createAuditLog({
            userId: session.user.id,
            orgId,
            action: 'APPLICATION_BULK_UPDATE',
            resource: 'APPLICATION',
            resourceId: 'BULK',
            metadata: { applicationIds: permittedIds, action: 'reject', count },
          })

          return NextResponse.json({ ok: true, action: 'reject', processed: count })
        }

        if (payload.action === 'send-email') {
          const applications = await prisma.application.findMany({
            where: { id: { in: permittedIds }, deletedAt: null },
            include: {
              job: { include: { organization: true } },
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

          const bulkStartTime = Date.now()

          const safeBody = DOMPurify.sanitize(payload.body, {
            USE_PROFILES: { html: true },
            FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
            FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus', 'onblur'],
            ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
          })

          const errors: { applicationId: string; candidateName: string; error: string }[] = []
          const successfulIds: string[] = []

          for (const application of applications) {
            const candidateName =
              application.candidate.contacts?.[0]?.fullName ||
              application.candidate.contacts?.[0]?.email ||
              application.id
            try {
              const candidateEmail = application.candidate.contacts?.[0]?.email
              if (!candidateEmail) {
                errors.push({
                  applicationId: application.id,
                  candidateName,
                  error: 'No email for candidate',
                })
                continue
              }

              await sendEmail({
                to: candidateEmail,
                subject: payload.subject,
                html: safeBody,
              })

              await prisma.applicationActivity.create({
                data: {
                  applicationId: application.id,
                  type: 'EMAIL_SENT',
                  description: `Email sent: ${payload.subject}`,
                  performedBy: session.user.id,
                  metadata: {
                    subject: payload.subject,
                    to: candidateEmail,
                    sentBy: session.user.name || session.user.email,
                    bulk: true,
                  },
                },
              })

              successfulIds.push(application.id)
            } catch (err) {
              logger.error('Bulk email failed for application', {
                applicationId: application.id,
                err,
              })
              errors.push({
                applicationId: application.id,
                candidateName,
                error: err instanceof Error ? err.message : 'Unknown error',
              })
            }
          }

          if (successfulIds.length > 0) {
            await prisma.application.updateMany({
              where: { id: { in: successfulIds } },
              data: { lastContactAt: new Date(), lastContactType: 'EMAIL' },
            })
          }

          const bulkElapsed = Date.now() - bulkStartTime
          if (bulkElapsed > 200_000) {
            logger.warn('Bulk email loop exceeded 200s — consider migrating to BullMQ queue', {
              elapsed: bulkElapsed,
              count: applications.length,
            })
          }

          const processed = successfulIds.length

          await createAuditLog({
            userId: session.user.id,
            orgId,
            action: 'EMAIL_SENT',
            resource: 'EMAIL',
            resourceId: 'BULK',
            metadata: {
              applicationIds: permittedIds,
              subject: payload.subject,
              sent: processed,
              failed: errors.length,
            },
          })

          return NextResponse.json({
            ok: true,
            action: 'send-email',
            processed,
            failed: errors.length,
            errors: errors.length > 0 ? errors : undefined,
          })
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: 'Validation failed', issues: error.issues },
            { status: 400 },
          )
        }
        logger.error('Bulk action error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
      }
    },
    { preset: 'strict', byUser: true },
  ),
)
