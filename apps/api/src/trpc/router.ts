import { initTRPC, TRPCError } from '@trpc/server'
import { z } from 'zod'
import superjson from 'superjson'
import { Context, requireAuth, requireOrg, requireRole } from './context'
import { extractCV, computeMatchPercent, generateJobDescription } from '@jobsphere/ai'

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof z.ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const router = t.router
export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  requireAuth(ctx)
  return next({ ctx })
})

// ============ JOBS ROUTER ============
const jobsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        locale: z.string().optional(),
        region: z.string().optional(),
        employmentType: z.string().optional(),
        seniority: z.string().optional(),
        remote: z.boolean().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {
        status: 'PUBLISHED',
        deletedAt: null,
      }

      if (input.locale) where.locale = input.locale
      if (input.region) where.region = input.region
      if (input.employmentType) where.employmentType = input.employmentType
      if (input.seniority) where.seniority = input.seniority
      if (input.remote !== undefined) where.remote = input.remote

      if (input.search) {
        where.OR = [
          { title: { contains: input.search, mode: 'insensitive' } },
          { description: { contains: input.search, mode: 'insensitive' } },
        ]
      }

      const jobs = await ctx.prisma.job.findMany({
        where,
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { publishedAt: 'desc' },
        include: {
          organization: {
            select: { name: true, logo: true },
          },
        },
      })

      let nextCursor: string | undefined = undefined
      if (jobs.length > input.limit) {
        const nextItem = jobs.pop()
        nextCursor = nextItem?.id
      }

      return { jobs, nextCursor }
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.prisma.job.findUnique({
        where: { id: input.id },
        include: {
          organization: {
            select: { name: true, logo: true, website: true },
          },
          creator: {
            select: { name: true, avatar: true },
          },
        },
      })

      if (!job) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' })
      }

      return job
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(3),
        description: z.string(),
        requirements: z.string().optional(),
        responsibilities: z.string().optional(),
        benefits: z.string().optional(),
        city: z.string().optional(),
        region: z.string().optional(),
        remote: z.boolean().default(false),
        hybrid: z.boolean().default(false),
        employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'FREELANCE', 'INTERNSHIP']),
        seniority: z.enum(['ENTRY', 'MID', 'SENIOR', 'LEAD', 'PRINCIPAL', 'EXECUTIVE']).optional(),
        salaryMin: z.number().optional(),
        salaryMax: z.number().optional(),
        salaryCurrency: z.string().default('EUR'),
        locale: z.string().default('en'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx)
      requireRole(ctx, ['ORG_ADMIN', 'RECRUITER', 'HIRING_MANAGER'])

      // Check entitlement
      const entitlement = await ctx.prisma.entitlement.findUnique({
        where: { orgId_featureKey: { orgId, featureKey: 'job_slots' } },
      })

      if (entitlement && entitlement.remainingInt !== null && entitlement.remainingInt <= 0) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Job slots limit reached. Please upgrade your plan.',
        })
      }

      const job = await ctx.prisma.job.create({
        data: {
          ...input,
          orgId,
          createdBy: ctx.user!.id,
          slug: input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        },
      })

      // Decrement entitlement
      if (entitlement && entitlement.remainingInt !== null) {
        await ctx.prisma.entitlement.update({
          where: { id: entitlement.id },
          data: { remainingInt: { decrement: 1 } },
        })
      }

      // Create usage event
      await ctx.prisma.usageEvent.create({
        data: {
          orgId,
          featureKey: 'job_slots',
          delta: 1,
          entityType: 'JOB',
          entityId: job.id,
        },
      })

      return job
    }),

  generateDescription: protectedProcedure
    .input(
      z.object({
        title: z.string(),
        company: z.string(),
        location: z.string(),
        requirements: z.array(z.string()).optional(),
        responsibilities: z.array(z.string()).optional(),
        skills: z.array(z.string()).optional(),
        locale: z.string().default('en'),
      })
    )
    .mutation(async ({ input }) => {
      const description = await generateJobDescription(input, input.locale)
      return { description }
    }),
})

// ============ CANDIDATES ROUTER ============
const candidatesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        tags: z.array(z.string()).optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx)

      const where: any = { orgId, deletedAt: null }

      if (input.search) {
        where.contacts = {
          some: {
            OR: [
              { fullName: { contains: input.search, mode: 'insensitive' } },
              { email: { contains: input.search, mode: 'insensitive' } },
            ],
          },
        }
      }

      if (input.tags && input.tags.length > 0) {
        where.tags = { hasSome: input.tags }
      }

      const candidates = await ctx.prisma.candidate.findMany({
        where,
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: 'desc' },
        include: {
          contacts: { where: { isPrimary: true }, take: 1 },
          resumes: { take: 1, orderBy: { createdAt: 'desc' } },
          _count: { select: { applications: true } },
        },
      })

      let nextCursor: string | undefined = undefined
      if (candidates.length > input.limit) {
        const nextItem = candidates.pop()
        nextCursor = nextItem?.id
      }

      return { candidates, nextCursor }
    }),

  uploadCV: protectedProcedure
    .input(
      z.object({
        candidateId: z.string().optional(),
        file: z.object({
          filename: z.string(),
          mime: z.string(),
          size: z.number(),
          uri: z.string(),
        }),
        locale: z.string().default('en'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx)

      // Create or get candidate
      let candidateId = input.candidateId
      if (!candidateId) {
        const candidate = await ctx.prisma.candidate.create({
          data: { orgId, source: 'WEBSITE' },
        })
        candidateId = candidate.id
      }

      // Create document record
      const document = await ctx.prisma.candidateDocument.create({
        data: {
          candidateId,
          type: 'CV',
          filename: input.file.filename,
          uri: input.file.uri,
          mime: input.file.mime,
          size: input.file.size,
        },
      })

      // Queue for processing
      // TODO: Add to BullMQ queue for parsing

      return { candidateId, documentId: document.id }
    }),
})

// ============ APPLICATIONS ROUTER ============
const applicationsRouter = router({
  inbox: protectedProcedure
    .input(
      z.object({
        jobId: z.string(),
        stage: z.string().optional(),
        minMatchPercent: z.number().optional(),
        tags: z.array(z.string()).optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx)

      const where: any = {
        jobId: input.jobId,
        orgId,
        deletedAt: null,
      }

      if (input.stage) where.stage = input.stage
      if (input.tags && input.tags.length > 0) where.tags = { hasSome: input.tags }

      const applications = await ctx.prisma.application.findMany({
        where,
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: [{ isPriority: 'desc' }, { createdAt: 'desc' }],
        include: {
          candidate: {
            include: {
              contacts: { where: { isPrimary: true }, take: 1 },
              resumes: { take: 1, orderBy: { createdAt: 'desc' } },
            },
          },
          matchScores: {
            where: { jobId: input.jobId },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      let nextCursor: string | undefined = undefined
      if (applications.length > input.limit) {
        const nextItem = applications.pop()
        nextCursor = nextItem?.id
      }

      // Filter by match percent if specified
      let filteredApps = applications
      if (input.minMatchPercent !== undefined) {
        filteredApps = applications.filter(
          (app) => app.matchScores[0]?.score0to100 >= input.minMatchPercent!
        )
      }

      return { applications: filteredApps, nextCursor }
    }),

  updateStage: protectedProcedure
    .input(
      z.object({
        applicationId: z.string(),
        stage: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireOrg(ctx)

      const application = await ctx.prisma.application.update({
        where: { id: input.applicationId },
        data: {
          stage: input.stage,
          stageHistory: {
            push: {
              stage: input.stage,
              changedAt: new Date(),
              changedBy: ctx.user!.id,
              notes: input.notes,
            },
          },
        },
      })

      // Create activity
      await ctx.prisma.applicationActivity.create({
        data: {
          applicationId: input.applicationId,
          type: 'STAGE_CHANGE',
          description: `Stage changed to ${input.stage}`,
          performedBy: ctx.user!.id,
        },
      })

      return application
    }),

  computeMatch: protectedProcedure
    .input(
      z.object({
        jobId: z.string(),
        candidateId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx)

      // Get job and resume
      const job = await ctx.prisma.job.findUnique({
        where: { id: input.jobId },
      })

      const resume = await ctx.prisma.resume.findFirst({
        where: { candidateId: input.candidateId },
        orderBy: { createdAt: 'desc' },
      })

      if (!job || !resume) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Job or resume not found' })
      }

      // Compute match using AI
      const resumeText = JSON.stringify(resume)
      const match = await computeMatchPercent(
        {
          title: job.title,
          description: job.description,
          requirements: job.requirements || '',
          skills: resume.skills,
        },
        resumeText,
        job.locale
      )

      // Store match score
      const matchScore = await ctx.prisma.matchScore.upsert({
        where: {
          jobId_candidateId: {
            jobId: input.jobId,
            candidateId: input.candidateId,
          },
        },
        create: {
          orgId,
          jobId: input.jobId,
          candidateId: input.candidateId,
          resumeId: resume.id,
          score0to100: match.percent,
          evidence: match.evidence,
          explanation: match.evidence.strengths || [],
          version: '1.0.0',
        },
        update: {
          score0to100: match.percent,
          evidence: match.evidence,
          explanation: match.evidence.strengths || [],
        },
      })

      return matchScore
    }),
})

// ============ ASSESSMENTS ROUTER ============
const assessmentsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const orgId = requireOrg(ctx)

    const assessments = await ctx.prisma.assessment.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { invites: true, sections: true } },
      },
    })

    return assessments
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        locale: z.string().default('en'),
        durationMin: z.number().optional(),
        passingScore: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx)
      requireRole(ctx, ['ORG_ADMIN', 'RECRUITER', 'HIRING_MANAGER'])

      const assessment = await ctx.prisma.assessment.create({
        data: {
          ...input,
          orgId,
          createdBy: ctx.user!.id,
        },
      })

      return assessment
    }),

  invite: protectedProcedure
    .input(
      z.object({
        assessmentId: z.string(),
        candidateId: z.string(),
        jobId: z.string().optional(),
        expiresAt: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireOrg(ctx)

      // Generate unique token
      const token = Math.random().toString(36).substring(2, 15)

      const invite = await ctx.prisma.assessmentInvite.create({
        data: {
          ...input,
          token,
          status: 'PENDING',
        },
      })

      // TODO: Send email with invite link

      return invite
    }),
})

// ============ BILLING ROUTER ============
const billingRouter = router({
  getCurrentPlan: protectedProcedure.query(async ({ ctx }) => {
    const orgId = requireOrg(ctx)

    const subscription = await ctx.prisma.subscription.findFirst({
      where: { orgId, status: 'active' },
      include: {
        product: {
          include: {
            plans: {
              include: { features: true },
            },
          },
        },
      },
    })

    const entitlements = await ctx.prisma.entitlement.findMany({
      where: { orgId },
    })

    return { subscription, entitlements }
  }),

  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        planKey: z.enum(['starter', 'pro', 'enterprise']),
        currency: z.string().default('EUR'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = requireOrg(ctx)

      // TODO: Create Stripe checkout session
      const checkoutUrl = 'https://checkout.stripe.com/...' // Placeholder

      return { checkoutUrl }
    }),
})

// ============ ROOT ROUTER ============
export const appRouter = router({
  jobs: jobsRouter,
  candidates: candidatesRouter,
  applications: applicationsRouter,
  assessments: assessmentsRouter,
  billing: billingRouter,
})

export type AppRouter = typeof appRouter