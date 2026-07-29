/**
 * GDPR Data Subject Access Request (DSAR) API
 * Export, delete, or rectify user data
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limit'
import { withCsrfProtection } from '@/lib/csrf'
import { GdprService } from '@/services/gdpr.service'

export const runtime = 'nodejs'

/**
 * POST /api/gdpr/dsar
 * Submit DSAR request
 */
export const POST = withCsrfProtection(
  withRateLimit(
    async (req: Request) => {
      try {
        const session = await auth()
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { type } = await req.json()

        const validTypes = ['EXPORT', 'DELETE']

        if (!validTypes.includes(type)) {
          return NextResponse.json({ error: 'Invalid request type' }, { status: 400 })
        }

        // Create DSAR request
        const dsarRequest = await prisma.dSARRequest.create({
          data: {
            userId: session.user.id,
            email: session.user.email || '',
            requestType: type,
            status: 'PENDING',
            ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
            userAgent: req.headers.get('user-agent') || 'unknown',
          },
        })

        // Execute the Right to Erasure (Art. 17) immediately for self-service
        // DELETE requests: the caller is authenticated as themselves, so identity
        // is already verified. This hard-deletes the user + all candidate PII.
        if (type === 'DELETE') {
          const userId = session.user.id
          const requesterEmail = session.user.email || dsarRequest.email
          const requesterName = session.user.name
          try {
            const result = await GdprService.eraseUserData(userId)

            // The user row is gone now, so the DSARRequest FK (onDelete SetNull)
            // detaches userId; re-mark this request as completed by its id.
            await prisma.dSARRequest.update({
              where: { id: dsarRequest.id },
              data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                responseData: {
                  candidateIds: result.candidateIds,
                  documentsDeleted: result.documentsDeleted,
                  blobsDeleted: result.blobsDeleted,
                  applicationsDeleted: result.applicationsDeleted,
                  resumesDeleted: result.resumesDeleted,
                },
              },
            })

            // Best-effort notifications (user account is deleted; email still valid).
            try {
              const { sendEmail } = await import('@/lib/email')
              const adminEmail =
                process.env.GDPR_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@jobsphere.com'
              await sendEmail({
                to: adminEmail,
                subject: 'GDPR DELETE Request Executed',
                html: `
                <h2>GDPR Right to Erasure executed</h2>
                <p><strong>User ID:</strong> ${userId}</p>
                <p><strong>Email:</strong> ${requesterEmail}</p>
                <p><strong>Request ID:</strong> ${dsarRequest.id}</p>
                <p>All personal data has been deleted.</p>
                <hr />
                <p style="color: #666; font-size: 12px;">JobSphere ATS - GDPR Compliance</p>
              `,
              })
              if (requesterEmail) {
                await sendEmail({
                  to: requesterEmail,
                  subject: 'Your data has been deleted - JobSphere',
                  html: `
                  <h2>Account deleted</h2>
                  <p>Hi ${requesterName || 'there'},</p>
                  <p>Your GDPR erasure request has been completed and all of your
                  personal data has been removed from JobSphere.</p>
                  <hr />
                  <p style="color: #666; font-size: 12px;">JobSphere ATS - GDPR Compliance</p>
                `,
                })
              }
            } catch (emailError) {
              logger.error('Failed to send DSAR completion notification', emailError)
            }

            return NextResponse.json({
              success: true,
              request: { id: dsarRequest.id, status: 'COMPLETED', requestType: 'DELETE' },
              message: 'Your account and all associated data have been permanently deleted.',
            })
          } catch (eraseError) {
            logger.error('DSAR erasure execution failed', eraseError)
            // Leave the DSARRequest PENDING so an admin can process it manually.
            return NextResponse.json(
              {
                success: false,
                request: dsarRequest,
                error:
                  'Your deletion request was recorded but could not be completed automatically. It will be processed manually within 30 days.',
              },
              { status: 500 },
            )
          }
        }

        // Send email notifications
        try {
          const { sendEmail } = await import('@/lib/email')
          const adminEmail =
            process.env.GDPR_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@jobsphere.com'

          // Notify admin
          await sendEmail({
            to: adminEmail,
            subject: `New GDPR ${type} Request`,
            html: `
            <h2>New GDPR Data Subject Access Request</h2>
            <p><strong>Request Type:</strong> ${type}</p>
            <p><strong>User:</strong> ${session.user.name || 'Unknown'} (${session.user.email || 'N/A'})</p>
            <p><strong>User ID:</strong> ${session.user.id}</p>
            <p><strong>Request ID:</strong> ${dsarRequest.id}</p>
            <p><strong>Status:</strong> PENDING</p>
            <p>This request must be processed within 30 days according to GDPR requirements.</p>
            <hr />
            <p style="color: #666; font-size: 12px;">JobSphere ATS - GDPR Compliance</p>
          `,
          })

          // Notify user
          if (session.user.email) {
            await sendEmail({
              to: session.user.email,
              subject: `Your GDPR ${type} Request - JobSphere`,
              html: `
              <h2>Request Received</h2>
              <p>Hi ${session.user.name || 'there'},</p>
              <p>We have received your GDPR ${type} request.</p>
              <p><strong>Request ID:</strong> ${dsarRequest.id}</p>
              <p>Your request will be processed within 30 days as required by GDPR regulations.</p>
              <p>You will receive an email notification once your request has been completed.</p>
              <hr />
              <p style="color: #666; font-size: 12px;">JobSphere ATS - GDPR Compliance</p>
            `,
            })
          }
        } catch (emailError) {
          logger.error('Failed to send DSAR notification', emailError)
          // Don't fail the request if email fails
        }

        return NextResponse.json({
          success: true,
          request: dsarRequest,
          message: 'Your request has been submitted and will be processed within 30 days.',
        })
      } catch (error) {
        logger.error('DSAR request error', error)
        return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 })
      }
    },
    { preset: 'strict' },
  ),
)

/**
 * GET /api/gdpr/dsar
 * Get user's DSAR requests
 */
export const GET = withRateLimit(
  async (_req: Request) => {
    try {
      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Get user's DSAR requests.
      // Deliberately unbounded: truncating a data subject's own request history
      // would undermine GDPR completeness. Growth is bounded by the user's own
      // request activity and the query is scoped to a single userId.
      const requests = await prisma.dSARRequest.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
      })

      return NextResponse.json({ requests })
    } catch (error) {
      logger.error('Get DSAR error', error)
      return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 })
    }
  },
  { preset: 'api' },
)
