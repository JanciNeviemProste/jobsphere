import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { withCsrfProtection } from '@/lib/csrf'
import { withRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const stageEnum = z
  .enum(['NEW', 'SCREENING', 'PHONE_SCREEN', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'])
  .optional()
const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export const runtime = 'nodejs'

export const GET = withRateLimit(
  async (req: Request) => {
    try {
      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { searchParams } = new URL(req.url)
      const stageRaw = searchParams.get('stage') || undefined
      const jobId = searchParams.get('jobId')
      const validatedStage = stageEnum.parse(stageRaw)
      const { page, limit } = paginationSchema.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit'),
      })

      // Resolve Candidate records linked to this user by email across all orgs
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { email: true },
      })
      if (!user?.email) {
        return NextResponse.json({ data: [], total: 0, page, pageSize: limit, hasMore: false })
      }

      const contacts = await prisma.candidateContact.findMany({
        where: { email: user.email },
        select: { candidateId: true },
      })
      const candidateIds = contacts.map((c) => c.candidateId)

      const where = {
        candidateId: { in: candidateIds },
        ...(validatedStage && { stage: validatedStage }),
        ...(jobId && { jobId }),
      }

      const applications = await prisma.application.findMany({
        where,
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
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      })
      const total = await prisma.application.count({ where })

      return NextResponse.json({
        data: applications,
        total,
        page,
        pageSize: limit,
        hasMore: page * limit < total,
      })
    } catch (error) {
      logger.error('Error fetching applications', error)
      return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 })
    }
  },
  { preset: 'api', byUser: true },
)

export const POST = withCsrfProtection(
  withRateLimit(
    async (req: Request) => {
      try {
        const session = await auth()
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { jobId, coverLetter, expectedSalary, availableFrom } = body

        // Validation
        if (!jobId || !coverLetter) {
          return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Get job to fetch orgId and verify it's published
        const job = await prisma.job.findUnique({
          where: { id: jobId },
          select: { orgId: true, status: true },
        })

        if (!job) {
          return NextResponse.json({ error: 'Job not found' }, { status: 404 })
        }

        // Only allow applications to published jobs
        if (job.status !== 'PUBLISHED') {
          return NextResponse.json(
            { error: 'This job is not currently accepting applications' },
            { status: 400 },
          )
        }

        // Find or create a Candidate record for this user within the job's org.
        // Matching is done by the user's email via CandidateContact.
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { email: true, name: true },
        })
        if (!user?.email) {
          return NextResponse.json(
            { error: 'User account is missing an email address' },
            { status: 400 },
          )
        }

        const candidateId = await prisma.$transaction(async (tx) => {
          const existingContact = await tx.candidateContact.findFirst({
            where: {
              email: user.email,
              candidate: { orgId: job.orgId, deletedAt: null },
            },
            select: { candidateId: true },
          })

          if (existingContact?.candidateId) return existingContact.candidateId

          const created = await tx.candidate.create({
            data: {
              orgId: job.orgId,
              source: 'WEBSITE',
              contacts: {
                create: {
                  fullName: user.name || session.user.name || null,
                  email: user.email,
                  isPrimary: true,
                },
              },
            },
            select: { id: true },
          })
          return created.id
        })

        // Check if already applied
        const existingApplication = await prisma.application.findFirst({
          where: { jobId, candidateId },
        })

        if (existingApplication) {
          return NextResponse.json(
            { error: 'You have already applied to this job' },
            { status: 409 },
          )
        }

        // Create application
        const application = await prisma.application.create({
          data: {
            jobId,
            candidateId,
            orgId: job.orgId,
            coverLetter,
            stage: 'NEW',
          },
          include: {
            job: {
              include: {
                organization: true,
              },
            },
          },
        })

        // Create application activity
        await prisma.applicationActivity.create({
          data: {
            applicationId: application.id,
            type: 'APPLIED',
            description: 'Your application has been successfully submitted',
            performedBy: session.user.id,
          },
        })

        // Send email notifications
        try {
          const { sendEmail, getApplicationReceivedEmail, getNewApplicationEmail } = await import(
            '@/lib/email'
          )

          // Email to candidate
          if (session.user.email) {
            await sendEmail({
              to: session.user.email,
              subject: `Application Received - ${application.job.title}`,
              html: getApplicationReceivedEmail(
                session.user.name || 'Candidate',
                application.job.title,
                application.job.organization.name,
              ),
            })
          }

          // Email to employer (get org admin email)
          const orgAdmin = await prisma.userOrgRole.findFirst({
            where: {
              orgId: application.job.orgId,
              role: 'ORG_ADMIN',
            },
            include: {
              user: true,
            },
          })

          if (orgAdmin?.user.email) {
            await sendEmail({
              to: orgAdmin.user.email,
              subject: `New Application - ${application.job.title}`,
              html: getNewApplicationEmail(
                orgAdmin.user.name || 'Employer',
                session.user.name || 'Unknown Candidate',
                application.job.title,
                application.id,
              ),
            })
          }
        } catch (emailError) {
          logger.error('Failed to send email notifications', emailError)
          // Don't fail the request if email fails
        }

        return NextResponse.json(application, { status: 201 })
      } catch (error: any) {
        logger.error('Error creating application', error)

        // Handle unique constraint violation (race condition)
        if (error.code === 'P2002') {
          return NextResponse.json(
            { error: 'You have already applied to this job' },
            { status: 409 },
          )
        }

        return NextResponse.json({ error: 'Failed to create application' }, { status: 500 })
      }
    },
    { preset: 'api', byUser: true }, // 100 requests per minute
  ),
)
