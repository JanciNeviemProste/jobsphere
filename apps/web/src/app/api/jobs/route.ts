import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { errorResponse } from '@/lib/errors'
import { withRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

// Define enums for job fields (as strings in database)
const WorkModeEnum = z.enum(['REMOTE', 'HYBRID', 'ONSITE'])
const JobTypeEnum = z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT'])
const SeniorityLevelEnum = z.enum(['JUNIOR', 'MEDIOR', 'SENIOR', 'LEAD'])

const jobSearchSchema = z.object({
  search: z.string().optional(),
  workMode: WorkModeEnum.optional(),
  jobType: JobTypeEnum.optional(),
  seniority: SeniorityLevelEnum.optional(),
})

export const GET = withRateLimit(
  async (req: Request) => {
    const startTime = Date.now()
    try {
      logger.apiRequest('GET', '/api/jobs')

      const { searchParams } = new URL(req.url)

      // Parse and validate query params
      const params = jobSearchSchema.parse({
        search: searchParams.get('search') || undefined,
        workMode: searchParams.get('workMode') || undefined,
        jobType: searchParams.get('jobType') || undefined,
        seniority: searchParams.get('seniority') || undefined,
      })

      const jobs = await prisma.job.findMany({
        where: {
          status: 'PUBLISHED',
          ...(params.search && {
            OR: [
              { title: { contains: params.search, mode: 'insensitive' } },
              { description: { contains: params.search, mode: 'insensitive' } },
              { organization: { name: { contains: params.search, mode: 'insensitive' } } },
            ],
          }),
          ...(params.workMode && { workMode: params.workMode }),
          ...(params.jobType && { type: params.jobType }),
          ...(params.seniority && { seniority: params.seniority }),
        },
        include: {
          organization: {
            select: {
              name: true,
              logo: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50,
      })

      const duration = Date.now() - startTime
      logger.info(`Fetched ${jobs.length} jobs`, { duration })

      return NextResponse.json(jobs)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid query parameters', issues: error.issues },
          { status: 400 }
        )
      }

      logger.apiError('GET', '/api/jobs', error)
      const errorData = errorResponse(error)
      return NextResponse.json(
        { error: errorData.error },
        { status: errorData.statusCode }
      )
    }
  },
  { preset: 'public' } // 200 requests per minute
)

export const POST = withRateLimit(
  async (req: Request) => {
    try {
      logger.apiRequest('POST', '/api/jobs')

      const { requireAuth } = await import('@/lib/auth')

      // Authenticate
      const session = await requireAuth()

      if (!session.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const data = await req.json()

      // Get user's organization
      const userWithOrg = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          orgMembers: {
            include: {
              organization: true
            }
          }
        }
      })

      if (!userWithOrg?.orgMembers?.[0]?.organization) {
        return NextResponse.json(
          { error: 'You must belong to an organization to create jobs' },
          { status: 403 }
        )
      }

      const organizationId = userWithOrg.orgMembers[0].organization.id

      // Create the job
      const job = await prisma.job.create({
        data: {
          title: data.title,
          description: data.description,
          location: data.location,
          salaryMin: data.salaryMin ? Number(data.salaryMin) : null,
          salaryMax: data.salaryMax ? Number(data.salaryMax) : null,
          workMode: data.workMode || 'ONSITE',
          type: data.type || 'FULL_TIME',
          seniority: data.seniority || 'MEDIOR',
          status: 'ACTIVE',
          orgId: organizationId,
        },
        include: {
          organization: {
            select: {
              name: true,
              logo: true,
            }
          }
        }
      })

      logger.info('Job created', { jobId: job.id, organizationId })

      return NextResponse.json(job, { status: 201 })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', issues: error.issues },
          { status: 400 }
        )
      }

      logger.apiError('POST', '/api/jobs', error)
      const errorData = errorResponse(error)
      return NextResponse.json(
        errorData,
        { status: errorData.statusCode }
      )
    }
  },
  { preset: 'api', byUser: true } // 100 requests per minute
)
