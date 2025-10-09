/**
 * Job Service
 * Centralized business logic for job management
 */

import { prisma } from '@/lib/prisma'
import {
  Job,
  Prisma,
  PrismaClient
} from '@prisma/client'
import { createAuditLog } from '@/lib/audit-log'
import { checkEntitlement, consumeEntitlement } from '@/lib/entitlements'
import { AppError } from '@/lib/errors'

// Define types for enum-like string fields
type WorkMode = 'REMOTE' | 'HYBRID' | 'ONSITE'
type JobType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT'
type SeniorityLevel = 'JUNIOR' | 'MEDIOR' | 'SENIOR' | 'LEAD'
type JobStatus = 'ACTIVE' | 'CLOSED' | 'DRAFT' | 'ARCHIVED'

export interface CreateJobInput {
  title: string
  location: string
  description: string
  salaryMin?: number
  salaryMax?: number
  workMode?: WorkMode
  type?: JobType
  seniority?: SeniorityLevel
  orgId: string
}

export interface UpdateJobInput extends Partial<CreateJobInput> {
  status?: JobStatus
}

export interface JobSearchParams {
  search?: string
  workMode?: WorkMode
  jobType?: JobType
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
  static async createJob(
    input: CreateJobInput,
    userId: string
  ): Promise<Job> {
    // Check entitlement
    const canCreate = await checkEntitlement(
      input.orgId,
      'MAX_JOBS'
    )

    if (!canCreate) {
      throw new AppError(
        'Job posting limit reached. Please upgrade your plan.',
        403
      )
    }

    const job = await prisma.$transaction(async (tx) => {
      // Create job
      const newJob = await tx.job.create({
        data: {
          title: input.title,
          location: input.location,
          description: input.description,
          ...(input.salaryMin !== undefined && { salaryMin: input.salaryMin }),
          ...(input.salaryMax !== undefined && { salaryMax: input.salaryMax }),
          workMode: input.workMode ?? 'HYBRID',
          type: input.type ?? 'FULL_TIME',
          seniority: input.seniority ?? 'MEDIOR',
          status: 'ACTIVE',
          orgId: input.orgId,
        },
      })

      // Consume entitlement
      await consumeEntitlement(
        input.orgId,
        'MAX_JOBS',
        1,
        tx as unknown as PrismaClient
      )

      // Create audit log
      await createAuditLog({
        userId,
        orgId: input.orgId,
        action: 'CREATE',
        resource: 'JOB',
        resourceId: newJob.id,
        metadata: {
          title: input.title,
          location: input.location,
        },
      })

      return newJob
    })

    return job
  }

  /**
   * Update an existing job
   */
  static async updateJob(
    jobId: string,
    input: UpdateJobInput,
    userId: string
  ): Promise<Job> {
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
          ...(input.location && { location: input.location }),
          ...(input.description && { description: input.description }),
          ...(input.salaryMin !== undefined && { salaryMin: input.salaryMin }),
          ...(input.salaryMax !== undefined && { salaryMax: input.salaryMax }),
          ...(input.workMode && { workMode: input.workMode }),
          ...(input.type && { type: input.type }),
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
      workMode,
      jobType,
      seniority,
      orgId,
      status = 'ACTIVE',
      limit = 50,
      offset = 0,
    } = params

    const where: Prisma.JobWhereInput = {
      status,
      ...(orgId && { orgId }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { location: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(workMode && { workMode }),
      ...(jobType && { type: jobType }),
      ...(seniority && { seniority }),
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
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
      }),
      prisma.job.count({ where }),
    ])

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
            candidate: true,
          },
        },
      },
    })
  }

  /**
   * Delete a job (soft delete by changing status)
   */
  static async deleteJob(
    jobId: string,
    userId: string
  ): Promise<Job> {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    })

    if (!job) {
      throw new AppError('Job not found', 404)
    }

    const deletedJob = await prisma.$transaction(async (tx) => {
      const updated = await tx.job.update({
        where: { id: jobId },
        data: { status: 'ARCHIVED' },
      })

      await createAuditLog({
        userId,
        orgId: job.orgId,
        action: 'DELETE',
        resource: 'JOB',
        resourceId: jobId,
        metadata: { status: 'ARCHIVED' },
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
    inReview: number
    shortlisted: number
    rejected: number
  }> {
    const stats = await prisma.application.groupBy({
      by: ['status'],
      where: { jobId },
      _count: { status: true },
    })

    const result = {
      totalApplications: 0,
      newApplications: 0,
      inReview: 0,
      shortlisted: 0,
      rejected: 0,
    }

    stats.forEach((stat) => {
      result.totalApplications += stat._count.status
      switch (stat.status) {
        case 'NEW':
          result.newApplications = stat._count.status
          break
        case 'REVIEWING':
          result.inReview = stat._count.status
          break
        case 'SHORTLISTED':
          result.shortlisted = stat._count.status
          break
        case 'REJECTED':
          result.rejected = stat._count.status
          break
      }
    })

    return result
  }
}