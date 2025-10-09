import { describe, it, expect, beforeEach, vi } from 'vitest'
import { JobService } from '../job.service'
import { prisma } from '@/lib/prisma'
import { checkEntitlement, consumeEntitlement } from '@/lib/entitlements'
import { createAuditLog } from '@/lib/audit-log'
import { AppError } from '@/lib/errors'
import { createMockJob, createMockOrganization } from '../../../tests/helpers/factories'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    job: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    application: {
      groupBy: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/entitlements', () => ({
  checkEntitlement: vi.fn(),
  consumeEntitlement: vi.fn(),
}))

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn(),
}))

describe('JobService', () => {
  const mockUserId = 'user-123'
  const mockOrgId = 'org-123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createJob', () => {
    it('should create a job successfully', async () => {
      const input = {
        title: 'Senior Developer',
        location: 'Prague',
        description: 'Great opportunity',
        salaryMin: 60000,
        salaryMax: 90000,
        workMode: 'HYBRID' as const,
        type: 'FULL_TIME' as const,
        seniority: 'SENIOR' as const,
        orgId: mockOrgId,
      }

      const mockJob = createMockJob(input)

      vi.mocked(checkEntitlement).mockResolvedValue(true)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          job: { create: vi.fn().mockResolvedValue(mockJob) },
        } as any)
      })

      const result = await JobService.createJob(input, mockUserId)

      expect(checkEntitlement).toHaveBeenCalledWith(mockOrgId, 'MAX_JOBS')
      expect(result).toEqual(mockJob)
    })

    it('should throw error when job limit reached', async () => {
      const input = {
        title: 'Developer',
        location: 'Prague',
        description: 'Job posting',
        orgId: mockOrgId,
      }

      vi.mocked(checkEntitlement).mockResolvedValue(false)

      await expect(JobService.createJob(input, mockUserId)).rejects.toThrow(
        'Job posting limit reached. Please upgrade your plan.'
      )
      await expect(JobService.createJob(input, mockUserId)).rejects.toThrow(AppError)
    })

    it('should apply default values when optional fields not provided', async () => {
      const input = {
        title: 'Developer',
        location: 'Prague',
        description: 'Job description',
        orgId: mockOrgId,
      }

      const mockJob = createMockJob({
        ...input,
        workMode: 'HYBRID',
        type: 'FULL_TIME',
        seniority: 'MEDIOR',
        status: 'ACTIVE',
      })

      let capturedData: any

      vi.mocked(checkEntitlement).mockResolvedValue(true)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          job: {
            create: vi.fn().mockImplementation((opts) => {
              capturedData = opts.data
              return mockJob
            }),
          },
        } as any)
      })

      await JobService.createJob(input, mockUserId)

      expect(capturedData.workMode).toBe('HYBRID')
      expect(capturedData.type).toBe('FULL_TIME')
      expect(capturedData.seniority).toBe('MEDIOR')
      expect(capturedData.status).toBe('ACTIVE')
    })

    it('should consume entitlement and create audit log', async () => {
      const input = {
        title: 'Developer',
        location: 'Prague',
        description: 'Job description',
        orgId: mockOrgId,
      }

      const mockJob = createMockJob(input)

      vi.mocked(checkEntitlement).mockResolvedValue(true)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          job: { create: vi.fn().mockResolvedValue(mockJob) },
        }
        return callback(tx as any)
      })

      await JobService.createJob(input, mockUserId)

      expect(consumeEntitlement).toHaveBeenCalledWith(
        mockOrgId,
        'MAX_JOBS',
        1,
        expect.anything()
      )
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          orgId: mockOrgId,
          action: 'CREATE',
          resource: 'JOB',
          resourceId: mockJob.id,
        })
      )
    })
  })

  describe('updateJob', () => {
    it('should update job successfully', async () => {
      const jobId = 'job-123'
      const existingJob = createMockJob({ id: jobId, orgId: mockOrgId })
      const updateInput = {
        title: 'Updated Title',
        salaryMin: 70000,
      }
      const updatedJob = { ...existingJob, ...updateInput }

      vi.mocked(prisma.job.findUnique).mockResolvedValue(existingJob)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          job: { update: vi.fn().mockResolvedValue(updatedJob) },
        } as any)
      })

      const result = await JobService.updateJob(jobId, updateInput, mockUserId)

      expect(prisma.job.findUnique).toHaveBeenCalledWith({
        where: { id: jobId },
      })
      expect(result).toEqual(updatedJob)
    })

    it('should throw error when job not found', async () => {
      const jobId = 'non-existent'

      vi.mocked(prisma.job.findUnique).mockResolvedValue(null)

      await expect(
        JobService.updateJob(jobId, { title: 'New Title' }, mockUserId)
      ).rejects.toThrow('Job not found')
      await expect(
        JobService.updateJob(jobId, { title: 'New Title' }, mockUserId)
      ).rejects.toThrow(AppError)
    })

    it('should create audit log for update', async () => {
      const jobId = 'job-123'
      const existingJob = createMockJob({ id: jobId, orgId: mockOrgId })
      const updateInput = { title: 'Updated Title' }

      vi.mocked(prisma.job.findUnique).mockResolvedValue(existingJob)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          job: { update: vi.fn().mockResolvedValue({ ...existingJob, ...updateInput }) },
        } as any)
      })

      await JobService.updateJob(jobId, updateInput, mockUserId)

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          orgId: mockOrgId,
          action: 'UPDATE',
          resource: 'JOB',
          resourceId: jobId,
          metadata: updateInput,
        })
      )
    })

    it('should update job status', async () => {
      const jobId = 'job-123'
      const existingJob = createMockJob({ id: jobId, status: 'ACTIVE' })
      const updateInput = { status: 'CLOSED' as const }

      let capturedData: any

      vi.mocked(prisma.job.findUnique).mockResolvedValue(existingJob)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          job: {
            update: vi.fn().mockImplementation((opts) => {
              capturedData = opts.data
              return { ...existingJob, status: 'CLOSED' }
            }),
          },
        } as any)
      })

      await JobService.updateJob(jobId, updateInput, mockUserId)

      expect(capturedData.status).toBe('CLOSED')
    })
  })

  describe('searchJobs', () => {
    it('should return jobs with default parameters', async () => {
      const mockJobs = [
        createMockJob({ status: 'ACTIVE' }),
        createMockJob({ status: 'ACTIVE' }),
      ]

      vi.mocked(prisma.job.findMany).mockResolvedValue(mockJobs as any)
      vi.mocked(prisma.job.count).mockResolvedValue(2)

      const result = await JobService.searchJobs({})

      expect(result).toEqual({ jobs: mockJobs, total: 2 })
      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'ACTIVE' },
          skip: 0,
          take: 50,
        })
      )
    })

    it('should filter by search term', async () => {
      const mockJobs = [createMockJob({ title: 'Senior TypeScript Developer' })]

      vi.mocked(prisma.job.findMany).mockResolvedValue(mockJobs as any)
      vi.mocked(prisma.job.count).mockResolvedValue(1)

      await JobService.searchJobs({ search: 'TypeScript' })

      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { title: { contains: 'TypeScript', mode: 'insensitive' } },
              { location: { contains: 'TypeScript', mode: 'insensitive' } },
              { description: { contains: 'TypeScript', mode: 'insensitive' } },
            ]),
          }),
        })
      )
    })

    it('should filter by work mode', async () => {
      const mockJobs = [createMockJob({ workMode: 'REMOTE' })]

      vi.mocked(prisma.job.findMany).mockResolvedValue(mockJobs as any)
      vi.mocked(prisma.job.count).mockResolvedValue(1)

      await JobService.searchJobs({ workMode: 'REMOTE' })

      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workMode: 'REMOTE',
          }),
        })
      )
    })

    it('should filter by job type and seniority', async () => {
      const mockJobs = [createMockJob({ type: 'CONTRACT', seniority: 'SENIOR' })]

      vi.mocked(prisma.job.findMany).mockResolvedValue(mockJobs as any)
      vi.mocked(prisma.job.count).mockResolvedValue(1)

      await JobService.searchJobs({ jobType: 'CONTRACT', seniority: 'SENIOR' })

      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'CONTRACT',
            seniority: 'SENIOR',
          }),
        })
      )
    })

    it('should filter by organization', async () => {
      const mockJobs = [createMockJob({ orgId: mockOrgId })]

      vi.mocked(prisma.job.findMany).mockResolvedValue(mockJobs as any)
      vi.mocked(prisma.job.count).mockResolvedValue(1)

      await JobService.searchJobs({ orgId: mockOrgId })

      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orgId: mockOrgId,
          }),
        })
      )
    })

    it('should support pagination', async () => {
      const mockJobs = [createMockJob()]

      vi.mocked(prisma.job.findMany).mockResolvedValue(mockJobs as any)
      vi.mocked(prisma.job.count).mockResolvedValue(100)

      await JobService.searchJobs({ limit: 10, offset: 20 })

      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      )
    })

    it('should include organization and application count', async () => {
      const mockOrg = createMockOrganization()
      const mockJobs = [
        {
          ...createMockJob(),
          organization: {
            id: mockOrg.id,
            name: mockOrg.name,
            logo: mockOrg.logo,
          },
          _count: { applications: 5 },
        },
      ]

      vi.mocked(prisma.job.findMany).mockResolvedValue(mockJobs as any)
      vi.mocked(prisma.job.count).mockResolvedValue(1)

      const result = await JobService.searchJobs({})

      expect(result.jobs[0]).toHaveProperty('organization')
      expect(result.jobs[0]).toHaveProperty('_count')
      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            organization: expect.any(Object),
            _count: expect.any(Object),
          }),
        })
      )
    })
  })

  describe('getJobById', () => {
    it('should return job with full details', async () => {
      const mockJob = createMockJob()

      vi.mocked(prisma.job.findUnique).mockResolvedValue(mockJob)

      const result = await JobService.getJobById('job-123')

      expect(result).toEqual(mockJob)
      expect(prisma.job.findUnique).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        include: {
          organization: true,
          applications: {
            include: {
              candidate: true,
            },
          },
        },
      })
    })

    it('should return null when job not found', async () => {
      vi.mocked(prisma.job.findUnique).mockResolvedValue(null)

      const result = await JobService.getJobById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('deleteJob', () => {
    it('should soft delete job by setting status to ARCHIVED', async () => {
      const jobId = 'job-123'
      const existingJob = createMockJob({ id: jobId, orgId: mockOrgId })
      const archivedJob = { ...existingJob, status: 'ARCHIVED' as const }

      vi.mocked(prisma.job.findUnique).mockResolvedValue(existingJob)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          job: { update: vi.fn().mockResolvedValue(archivedJob) },
        } as any)
      })

      const result = await JobService.deleteJob(jobId, mockUserId)

      expect(result.status).toBe('ARCHIVED')
      expect(prisma.job.findUnique).toHaveBeenCalledWith({
        where: { id: jobId },
      })
    })

    it('should throw error when job not found', async () => {
      vi.mocked(prisma.job.findUnique).mockResolvedValue(null)

      await expect(JobService.deleteJob('non-existent', mockUserId)).rejects.toThrow(
        'Job not found'
      )
      await expect(JobService.deleteJob('non-existent', mockUserId)).rejects.toThrow(AppError)
    })

    it('should create audit log for deletion', async () => {
      const jobId = 'job-123'
      const existingJob = createMockJob({ id: jobId, orgId: mockOrgId })

      vi.mocked(prisma.job.findUnique).mockResolvedValue(existingJob)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          job: { update: vi.fn().mockResolvedValue({ ...existingJob, status: 'ARCHIVED' }) },
        } as any)
      })

      await JobService.deleteJob(jobId, mockUserId)

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          orgId: mockOrgId,
          action: 'DELETE',
          resource: 'JOB',
          resourceId: jobId,
          metadata: { status: 'ARCHIVED' },
        })
      )
    })
  })

  describe('getJobStats', () => {
    it('should return correct statistics for job applications', async () => {
      const jobId = 'job-123'

      vi.mocked(prisma.application.groupBy).mockResolvedValue([
        { status: 'NEW', _count: { status: 5 } },
        { status: 'REVIEWING', _count: { status: 3 } },
        { status: 'SHORTLISTED', _count: { status: 2 } },
        { status: 'REJECTED', _count: { status: 4 } },
      ] as any)

      const result = await JobService.getJobStats(jobId)

      expect(result).toEqual({
        totalApplications: 14,
        newApplications: 5,
        inReview: 3,
        shortlisted: 2,
        rejected: 4,
      })
      expect(prisma.application.groupBy).toHaveBeenCalledWith({
        by: ['status'],
        where: { jobId },
        _count: { status: true },
      })
    })

    it('should return zeros when no applications exist', async () => {
      vi.mocked(prisma.application.groupBy).mockResolvedValue([])

      const result = await JobService.getJobStats('job-123')

      expect(result).toEqual({
        totalApplications: 0,
        newApplications: 0,
        inReview: 0,
        shortlisted: 0,
        rejected: 0,
      })
    })

    it('should handle partial application statuses', async () => {
      vi.mocked(prisma.application.groupBy).mockResolvedValue([
        { status: 'NEW', _count: { status: 10 } },
        { status: 'REJECTED', _count: { status: 2 } },
      ] as any)

      const result = await JobService.getJobStats('job-123')

      expect(result).toEqual({
        totalApplications: 12,
        newApplications: 10,
        inReview: 0,
        shortlisted: 0,
        rejected: 2,
      })
    })
  })
})
