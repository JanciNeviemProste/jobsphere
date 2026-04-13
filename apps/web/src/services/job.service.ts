/**
 * Job Service
 * Centralized business logic for job management
 */

import { prisma } from '@/lib/prisma'
import { Job, Prisma, PrismaClient } from '@prisma/client'
import { createAuditLog } from '@/lib/audit-log'
import { checkEntitlement, consumeEntitlement } from '@/lib/entitlements'
import { AppError } from '@/lib/errors'

// Define types for enum-like string fields (matches Prisma schema)
type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'TEMPORARY' | 'INTERNSHIP'
type SeniorityLevel = 'ENTRY' | 'MID' | 'SENIOR' | 'LEAD' | 'EXECUTIVE'
type JobStatus = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'CLOSED'

export interface CreateJobInput {
  title: string
  description: string
  city?: string
  region?: string
  remote?: boolean
  hybrid?: boolean
  salaryMin?: number
  salaryMax?: number
  employmentType?: EmploymentType
  seniority?: SeniorityLevel
  orgId: string
  createdBy: string
}

export interface UpdateJobInput extends Partial<CreateJobInput> {
  status?: JobStatus
}

export interface JobSearchParams {
  search?: string
  remote?: boolean
  hybrid?: boolean
  employmentType?: EmploymentType
  seniority?: SeniorityLevel
  orgId?: string
  status?: JobStatus
  limit?: number
  offset?: number
}

export class JobService {
  /**
   * Create a new job posting
   */
  static async createJob(input: CreateJobInput): Promise<Job> {
    // Check entitlement
    const canCreate = await checkEntitlement(input.orgId, 'MAX_JOBS')

    if (!canCreate) {
      throw new AppError('Job posting limit reached. Please upgrade your plan.', 403)
    }

    const job = await prisma.$transaction(async (tx) => {
      // Create job
      const newJob = await tx.job.create({
        data: {
          title: input.title,
          description: input.description,
          ...(input.city && { city: input.city }),
          ...(input.region && { region: input.region }),
          remote: input.remote ?? false,
          hybrid: input.hybrid ?? false,
          ...(input.salaryMin !== undefined && { salaryMin: input.salaryMin }),
          ...(input.salaryMax !== undefined && { salaryMax: input.salaryMax }),
          employmentType: input.employmentType ?? 'FULL_TIME',
          seniority: input.seniority ?? 'MID',
          status: 'DRAFT',
          orgId: input.orgId,
          createdBy: input.createdBy,
        },
      })

      // Consume entitlement
      await consumeEntitlement(input.orgId, 'MAX_JOBS', 1, tx as unknown as PrismaClient)

      // Create audit log
      await createAuditLog({
        userId: input.createdBy,
        orgId: input.orgId,
        action: 'CREATE',
        resource: 'JOB',
        resourceId: newJob.id,
        metadata: {
          title: input.title,
          city: input.city,
        },
      })

      return newJob
    })

    return job
  }

  /**
   * Update an existing job
   */
  static async updateJob(jobId: string, input: UpdateJobInput, userId: string): Promise<Job> {
    const existingJob = await prisma.job.findUnique({
      where: { id: jobId },
    })

    if (!existingJob) {
      throw new AppError('Job not found', 404)
    }

    const updatedJob = await prisma.$transaction(async (tx) => {
      const job = await tx.job.update({
        where: { id: jobId },
        data: {
          ...(input.title && { title: input.title }),
          ...(input.description && { description: input.description }),
          ...(input.city && { city: input.city }),
          ...(input.region && { region: input.region }),
          ...(input.remote !== undefined && { remote: input.remote }),
          ...(input.hybrid !== undefined && { hybrid: input.hybrid }),
          ...(input.salaryMin !== undefined && { salaryMin: input.salaryMin }),
          ...(input.salaryMax !== undefined && { salaryMax: input.salaryMax }),
          ...(input.employmentType && { employmentType: input.employmentType }),
          ...(input.seniority && { seniority: input.seniority }),
          ...(input.status && { status: input.status }),
        },
      })

      // Create audit log
      await createAuditLog({
        userId,
        orgId: existingJob.orgId,
        action: 'UPDATE',
        resource: 'JOB',
        resourceId: jobId,
        metadata: input as Prisma.InputJsonValue,
      })

      return job
    })

    return updatedJob
  }

  /**
   * Search and filter jobs
   */
  static async searchJobs(params: JobSearchParams): Promise<{
    jobs: Job[]
    total: number
  }> {
    const {
      search,
      remote,
      hybrid,
      employmentType,
      seniority,
      orgId,
      status = 'PUBLISHED',
      limit = 50,
      offset = 0,
    } = params

    const where: Prisma.JobWhereInput = {
      status,
      ...(orgId && { orgId }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { city: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(remote !== undefined && { remote }),
      ...(hybrid !== undefined && { hybrid }),
      ...(employmentType && { employmentType }),
      ...(seniority && { seniority }),
    }

    const jobs = await prisma.job.findMany({
      where,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    })
    const total = await prisma.job.count({ where })

    return { jobs, total }
  }

  /**
   * Get job by ID with full details
   */
  static async getJobById(jobId: string): Promise<Job | null> {
    return prisma.job.findUnique({
      where: { id: jobId },
      include: {
        organization: true,
        applications: {
          include: {
            candidate: {
              include: {
                contacts: true,
              },
            },
          },
        },
      },
    })
  }

  /**
   * Delete a job (soft delete by changing status)
   */
  static async deleteJob(jobId: string, userId: string): Promise<Job> {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    })

    if (!job) {
      throw new AppError('Job not found', 404)
    }

    const deletedJob = await prisma.$transaction(async (tx) => {
      const updated = await tx.job.update({
        where: { id: jobId },
        data: { status: 'CLOSED' },
      })

      await createAuditLog({
        userId,
        orgId: job.orgId,
        action: 'DELETE',
        resource: 'JOB',
        resourceId: jobId,
        metadata: { status: 'CLOSED' },
      })

      return updated
    })

    return deletedJob
  }

  /**
   * Get job statistics
   */
  static async getJobStats(jobId: string): Promise<{
    totalApplications: number
    newApplications: number
    screening: number
    interview: number
    rejected: number
  }> {
    const stats = await prisma.application.groupBy({
      by: ['stage'],
      where: { jobId },
      _count: { stage: true },
    })

    const result = {
      totalApplications: 0,
      newApplications: 0,
      screening: 0,
      interview: 0,
      rejected: 0,
    }

    stats.forEach((stat) => {
      result.totalApplications += stat._count.stage
      switch (stat.stage) {
        case 'NEW':
          result.newApplications = stat._count.stage
          break
        case 'SCREENING':
          result.screening = stat._count.stage
          break
        case 'INTERVIEW':
          result.interview = stat._count.stage
          break
        case 'REJECTED':
          result.rejected = stat._count.stage
          break
      }
    })

    return result
  }
}
