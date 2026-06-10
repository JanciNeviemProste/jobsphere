import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sendStatusChangeEmail } from '@/lib/email'
import { withCsrfProtection } from '@/lib/csrf'
import { withRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { APPLICATION_STAGES } from '@/lib/constants/application-stages'

export const runtime = 'nodejs'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const application = await prisma.application.findUnique({
      where: {
        id: params.id,
      },
      include: {
        job: {
          include: {
            organization: {
              select: {
                name: true,
                logo: true,
              },
            },
          },
        },
        candidate: true,
        activities: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    })

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // Check authorization - only candidate or employer can view.
    // Candidate ownership is via Candidate.userId, not candidateId == user.id.
    const isCandidate = application.candidate?.userId === session.user.id
    const isEmployer = await prisma.userOrgRole.findFirst({
      where: {
        userId: session.user.id,
        orgId: application.job.orgId,
      },
    })

    if (!isCandidate && !isEmployer) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(application)
  } catch (error) {
    logger.error('Error fetching application', error)
    return NextResponse.json({ error: 'Failed to fetch application' }, { status: 500 })
  }
}

export const PATCH = withCsrfProtection(
  withRateLimit(
    async (req: Request, context?: { params?: Record<string, string> }) => {
      const params = context?.params as { id: string }
      if (!params?.id) {
        return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
      }
      try {
        const session = await auth()
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const stageEnum = z.enum(APPLICATION_STAGES)
        const updateSchema = z.object({
          status: stageEnum.optional(),
          stage: stageEnum.optional(),
          notes: z.string().max(5000).optional(),
        })
        const parsed = updateSchema.parse(body)
        const status = parsed.stage ?? parsed.status
        const { notes } = parsed

        const application = await prisma.application.findUnique({
          where: { id: params.id },
          include: { job: true },
        })

        if (!application) {
          return NextResponse.json({ error: 'Application not found' }, { status: 404 })
        }

        // Only employer can update status
        const isEmployer = await prisma.userOrgRole.findFirst({
          where: {
            userId: session.user.id,
            orgId: application.job.orgId,
          },
        })

        if (!isEmployer) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Update application
        const updatedApplication = await prisma.application.update({
          where: { id: params.id },
          data: {
            ...(status && { stage: status }),
            ...(notes && { notes }),
          },
        })

        // Create activity for stage change
        if (status && status !== application.stage) {
          const statusDescriptions: Record<string, string> = {
            SCREENING: 'Application is now under review',
            PHONE_SCREEN: 'Phone screen scheduled',
            INTERVIEW: 'Interview has been scheduled',
            OFFER: 'Offer extended',
            HIRED: 'Application has been accepted',
            REJECTED: 'Application has been rejected',
          }

          await prisma.applicationActivity.create({
            data: {
              applicationId: application.id,
              type: 'STAGE_CHANGED',
              description: statusDescriptions[status] || `Application stage changed to ${status}`,
              performedBy: session.user.id,
              metadata: {
                previousStage: application.stage,
                newStage: status,
                notes,
              },
            },
          })

          // Send email notification for HIRED or REJECTED status
          if (status === 'HIRED' || status === 'REJECTED') {
            // Send email asynchronously - don't wait for it
            const candidateEmail =
              (application as any).candidate?.email || (application as any).email
            if (candidateEmail) {
              sendStatusChangeEmail({
                candidateName: (application as any).candidate?.name || 'Candidate',
                jobTitle: (application as any).job?.title || 'the position',
                newStatus: status,
                recipientEmail: candidateEmail,
              }).catch((error) => {
                logger.error('Failed to send status change email', error)
              })
            }
          }
        }

        return NextResponse.json(updatedApplication)
      } catch (error) {
        logger.error('Error updating application', error)
        return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
      }
    },
    { preset: 'api', byUser: true }, // 100 requests per minute
  ),
)

export const DELETE = withCsrfProtection(
  withRateLimit(
    async (req: Request, context?: { params?: Record<string, string> }) => {
      const params = context?.params as { id: string }
      if (!params?.id) {
        return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
      }
      try {
        const session = await auth()
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const application = await prisma.application.findUnique({
          where: { id: params.id },
          include: { candidate: { select: { userId: true } } },
        })

        if (!application) {
          return NextResponse.json({ error: 'Application not found' }, { status: 404 })
        }

        // Only the candidate who owns this application (via Candidate.userId) can withdraw it
        if (application.candidate.userId !== session.user.id) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Delete application (cascade will delete activities)
        await prisma.application.delete({
          where: { id: params.id },
        })

        return NextResponse.json({ success: true })
      } catch (error) {
        logger.error('Error deleting application', error)
        return NextResponse.json({ error: 'Failed to delete application' }, { status: 500 })
      }
    },
    { preset: 'api', byUser: true }, // 100 requests per minute
  ),
)
