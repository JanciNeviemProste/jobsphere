import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { withCsrfProtection } from '@/lib/csrf'
import { withRateLimit } from '@/lib/rate-limit'
import { sanitizeNote } from '@/lib/sanitize'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const runtime = 'nodejs'

const createInterviewSchema = z.object({
  type: z.enum(['VIDEO', 'ONSITE', 'PHONE']),
  scheduledAt: z.string().datetime(),
  durationMin: z
    .number()
    .int()
    .positive()
    .max(24 * 60)
    .optional(),
  branchId: z.string().optional(),
  meetingUrl: z.string().url().max(2000).optional(),
  location: z.string().trim().max(500).optional(),
  invitedUserIds: z.array(z.string()).max(50).optional(),
  notes: z.string().max(5000).optional(),
})

// Compose a single-line address snapshot from a Branch, so an ONSITE interview
// keeps a stable location even if the branch is later edited or deleted.
function branchAddressSnapshot(branch: {
  name: string
  street: string | null
  city: string | null
  region: string | null
  postalCode: string | null
  country: string | null
}): string {
  return [branch.name, branch.street, branch.postalCode, branch.city, branch.region, branch.country]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(', ')
}

// Load the application together with the caller's org membership. The org is
// resolved from the application (application.job.orgId), never from the request.
async function authorizeApplication(userId: string, applicationId: string) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: { select: { orgId: true, title: true } } },
  })
  if (!application) {
    return { ok: false as const, status: 404 as const, error: 'Application not found' }
  }
  const membership = await prisma.userOrgRole.findFirst({
    where: { userId, orgId: application.job.orgId },
  })
  if (!membership) {
    return { ok: false as const, status: 403 as const, error: 'Forbidden' }
  }
  return { ok: true as const, application, orgId: application.job.orgId }
}

export const GET = withRateLimit(
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

      const access = await authorizeApplication(session.user.id, params.id)
      if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status })
      }

      const interviews = await prisma.interview.findMany({
        where: { applicationId: params.id },
        orderBy: { scheduledAt: 'asc' },
      })

      return NextResponse.json({ interviews })
    } catch (error) {
      logger.error('Error fetching interviews:', error)
      return NextResponse.json({ error: 'Failed to fetch interviews' }, { status: 500 })
    }
  },
  { preset: 'api', byUser: true },
)

export const POST = withCsrfProtection(
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
        const data = createInterviewSchema.parse(body)

        const access = await authorizeApplication(session.user.id, params.id)
        if (!access.ok) {
          return NextResponse.json({ error: access.error }, { status: access.status })
        }
        const { orgId } = access

        // Resolve the on-site location. If a branch is chosen it must belong to
        // the caller's org (IDOR guard); its address is snapshotted into location.
        let location = data.location ?? null
        let branchId: string | null = null
        if (data.branchId) {
          const branch = await prisma.branch.findUnique({ where: { id: data.branchId } })
          if (!branch || branch.deletedAt || branch.orgId !== orgId) {
            return NextResponse.json({ error: 'Invalid branch' }, { status: 400 })
          }
          branchId = branch.id
          if (data.type === 'ONSITE' && !location) {
            location = branchAddressSnapshot(branch)
          }
        }

        const interview = await prisma.interview.create({
          data: {
            applicationId: params.id,
            orgId,
            type: data.type,
            scheduledAt: new Date(data.scheduledAt),
            durationMin: data.durationMin ?? null,
            location,
            branchId,
            meetingUrl: data.meetingUrl ?? null,
            createdBy: session.user.id,
            invitedUserIds: data.invitedUserIds ?? [],
            notes: data.notes ? sanitizeNote(data.notes) : null,
          },
        })

        // Move the application into INTERVIEW (idempotent) and log the activity so
        // the applicant timeline reflects the scheduled interview.
        if (access.application.stage !== 'INTERVIEW') {
          await prisma.application.update({
            where: { id: params.id },
            data: { stage: 'INTERVIEW' },
          })
        }
        await prisma.applicationActivity.create({
          data: {
            applicationId: params.id,
            type: 'INTERVIEW_SCHEDULED',
            description: `Interview scheduled (${data.type})`,
            performedBy: session.user.id,
            metadata: {
              interviewId: interview.id,
              type: data.type,
              scheduledAt: interview.scheduledAt.toISOString(),
              ...(location ? { location } : {}),
              ...(data.meetingUrl ? { meetingUrl: data.meetingUrl } : {}),
            },
          },
        })

        return NextResponse.json({ interview }, { status: 201 })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: 'Invalid request data', details: error.errors },
            { status: 400 },
          )
        }
        logger.error('Error creating interview:', error)
        return NextResponse.json({ error: 'Failed to create interview' }, { status: 500 })
      }
    },
    { preset: 'api', byUser: true },
  ),
)
