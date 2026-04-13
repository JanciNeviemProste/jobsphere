import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { errorResponse } from '@/lib/errors'
import { withRateLimit } from '@/lib/rate-limit'
import { withCsrfProtection } from '@/lib/csrf'
import { requireAuth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { checkEntitlement, consumeEntitlement } from '@/lib/entitlements'

export const runtime = 'nodejs'

// Define enums for job fields (as strings in database)
const WorkModeEnum = z.enum(['REMOTE', 'HYBRID', 'ONSITE'])
const JobTypeEnum = z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE', 'INTERNSHIP'])
const SeniorityLevelEnum = z.enum(['JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE'])

const jobSearchSchema = z.object({
  search: z.string().optional(),
  workMode: WorkModeEnum.optional(),
  jobType: JobTypeEnum.optional(),
  seniority: SeniorityLevelEnum.optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

// Validation schema for POST /api/jobs
const createJobSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().min(50, 'Description must be at least 50 characters').max(10000),
  requirements: z.string().max(10000).optional(),
  benefits: z.string().max(10000).optional(),
  department: z.string().max(100).optional(),
  keywords: z.string().max(500).optional(),
  location: z.string().min(2).max(100).optional(),
  region: z.string().max(100).optional(),
  workMode: z.enum(['REMOTE', 'HYBRID', 'ONSITE']),
  type: z
    .enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE', 'INTERNSHIP'])
    .default('FULL_TIME'),
  seniority: z.enum(['JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE']).default('MID'),
  salaryMin: z.number().int().min(0).optional(),
  salaryMax: z.number().int().min(0).optional(),
  salaryCurrency: z.string().max(10).default('EUR'),
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
        page: searchParams.get('page') || undefined,
        limit: searchParams.get('limit') || undefined,
      })

      const where = {
        status: 'PUBLISHED' as const,
        ...(params.search && {
          OR: [
            { title: { contains: params.search, mode: 'insensitive' as const } },
            { description: { contains: params.search, mode: 'insensitive' as const } },
            { organization: { name: { contains: params.search, mode: 'insensitive' as const } } },
          ],
        }),
        ...(params.workMode &&
          (params.workMode === 'REMOTE'
            ? { remote: true }
            : params.workMode === 'HYBRID'
              ? { hybrid: true }
              : { remote: false, hybrid: false })),
        ...(params.jobType && { employmentType: params.jobType }),
        ...(params.seniority && { seniority: params.seniority }),
      }

      const jobs = await prisma.job.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          city: true,
          region: true,
          remote: true,
          hybrid: true,
          employmentType: true,
          seniority: true,
          salaryMin: true,
          salaryMax: true,
          salaryCurrency: true,
          status: true,
          publishedAt: true,
          createdAt: true,
          organization: {
            select: {
              name: true,
              logo: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      })
      const total = await prisma.job.count({ where })

      // Transform to match client interface (workMode, type, location)
      const transformedJobs = jobs.map((job) => ({
        ...job,
        workMode: job.remote ? 'REMOTE' : job.hybrid ? 'HYBRID' : 'ONSITE',
        type: job.employmentType,
        location: job.city,
        description: job.description
          ? job.description
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
          : null,
      }))

      const duration = Date.now() - startTime
      logger.info(`Fetched ${jobs.length} jobs`, { duration })

      return NextResponse.json({
        data: transformedJobs,
        total,
        page: params.page,
        pageSize: params.limit,
        hasMore: params.page * params.limit < total,
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid query parameters', issues: error.issues },
          { status: 400 },
        )
      }

      logger.apiError('GET', '/api/jobs', error)
      const errorData = errorResponse(error)
      return NextResponse.json(errorData, { status: errorData.statusCode })
    }
  },
  { preset: 'public' }, // 200 requests per minute
)

export const POST = withCsrfProtection(
  withRateLimit(
    async (req: Request) => {
      try {
        logger.apiRequest('POST', '/api/jobs')

        // Authenticate
        const session = await requireAuth()

        if (!session.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Parse and validate request body with Zod
        const rawData = await req.json()
        const data = createJobSchema.parse(rawData)

        // Get user's organization
        const userWithOrg = await prisma.user.findUnique({
          where: { id: session.user.id },
          include: {
            organizations: {
              include: {
                organization: true,
              },
            },
          },
        })

        if (!userWithOrg?.organizations?.[0]?.organization) {
          return NextResponse.json(
            { error: 'You must belong to an organization to create jobs' },
            { status: 403 },
          )
        }

        const organizationId = userWithOrg.organizations[0].organization.id

        // Check MAX_JOBS entitlement before creating
        const canCreate = await checkEntitlement(organizationId, 'MAX_JOBS')
        if (!canCreate) {
          return NextResponse.json(
            { error: 'Job limit reached for your current plan' },
            { status: 403 },
          )
        }

        // Create the job
        const job = await prisma.job.create({
          data: {
            title: data.title,
            description: data.description,
            requirements: data.requirements || null,
            benefits: data.benefits || null,
            city: data.location || null,
            region: data.region || null,
            remote: data.workMode === 'REMOTE',
            hybrid: data.workMode === 'HYBRID',
            salaryMin: data.salaryMin ? Number(data.salaryMin) : null,
            salaryMax: data.salaryMax ? Number(data.salaryMax) : null,
            salaryCurrency: data.salaryCurrency,
            employmentType: data.type || 'FULL_TIME',
            seniority: data.seniority || 'MID',
            status: 'PUBLISHED',
            orgId: organizationId,
            createdBy: session.user.id,
          },
          include: {
            organization: {
              select: {
                name: true,
                logo: true,
              },
            },
          },
        })

        // Consume entitlement slot after successful creation
        await consumeEntitlement(organizationId, 'MAX_JOBS')

        logger.info('Job created', { jobId: job.id, organizationId })

        revalidatePath('/jobs')
        revalidatePath('/employer')

        return NextResponse.json(job, { status: 201 })
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: 'Validation failed', issues: error.issues },
            { status: 400 },
          )
        }

        logger.apiError('POST', '/api/jobs', error)
        const errorData = errorResponse(error)
        return NextResponse.json(errorData, { status: errorData.statusCode })
      }
    },
    { preset: 'api', byUser: true }, // 100 requests per minute
  ),
)
