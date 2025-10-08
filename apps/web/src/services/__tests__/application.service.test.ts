import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ApplicationService } from '../application.service'
import { prisma } from '@/lib/prisma'
import { checkEntitlement, consumeEntitlement } from '@/lib/entitlements'
import { createAuditLog } from '@/lib/audit-log'
import { AppError } from '@/lib/errors'
import {
  createMockApplication,
  createMockJob,
  createMockCandidate,
  createMockOrganization,
} from '../../../tests/helpers/factories'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    application: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    job: {
      findUnique: vi.fn(),
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

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(),
}))

describe('ApplicationService', () => {
  const mockUserId = 'user-123'
  const mockJobId = 'job-123'
  const mockCandidateId = 'candidate-123'
  const mockOrgId = 'org-123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createApplication', () => {
    const createInput = {
      jobId: mockJobId,
      candidateId: mockCandidateId,
      email: 'candidate@example.com',
      firstName: 'John',
      lastName: 'Doe',
      cvUrl: 'https://example.com/cv.pdf',
      coverLetter: 'I am interested in this position',
    }

    it('should create application successfully', async () => {
      const mockJob = createMockJob({ id: mockJobId, organizationId: mockOrgId, status: 'ACTIVE' })
      const mockApplication = createMockApplication({ ...createInput, status: 'PENDING' })

      vi.mocked(prisma.application.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.job.findUnique).mockResolvedValue({
        ...mockJob,
        organization: createMockOrganization({ id: mockOrgId }),
      } as any)
      vi.mocked(checkEntitlement).mockResolvedValue(true)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          application: { create: vi.fn().mockResolvedValue(mockApplication) },
        } as any)
      })

      const result = await ApplicationService.createApplication(createInput)

      expect(result).toEqual(mockApplication)
      expect(prisma.application.findFirst).toHaveBeenCalledWith({
        where: {
          jobId: mockJobId,
          candidateId: mockCandidateId,
        },
      })
    })

    it('should throw error if already applied', async () => {
      const existingApplication = createMockApplication({
        jobId: mockJobId,
        candidateId: mockCandidateId,
      })

      vi.mocked(prisma.application.findFirst).mockResolvedValue(existingApplication)

      await expect(ApplicationService.createApplication(createInput)).rejects.toThrow(
        'You have already applied for this position'
      )
      await expect(ApplicationService.createApplication(createInput)).rejects.toThrow(AppError)
    })

    it('should throw error if job not found', async () => {
      vi.mocked(prisma.application.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.job.findUnique).mockResolvedValue(null)

      await expect(ApplicationService.createApplication(createInput)).rejects.toThrow(
        'Job not found'
      )
      await expect(ApplicationService.createApplication(createInput)).rejects.toThrow(AppError)
    })

    it('should throw error if job is not active', async () => {
      const mockJob = createMockJob({ id: mockJobId, status: 'CLOSED' })

      vi.mocked(prisma.application.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.job.findUnique).mockResolvedValue(mockJob as any)

      await expect(ApplicationService.createApplication(createInput)).rejects.toThrow(
        'This position is no longer accepting applications'
      )
    })

    it('should throw error when candidate limit reached', async () => {
      const mockJob = createMockJob({ id: mockJobId, organizationId: mockOrgId, status: 'ACTIVE' })

      vi.mocked(prisma.application.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.job.findUnique).mockResolvedValue({
        ...mockJob,
        organization: createMockOrganization({ id: mockOrgId }),
      } as any)
      vi.mocked(checkEntitlement).mockResolvedValue(false)

      await expect(ApplicationService.createApplication(createInput)).rejects.toThrow(
        'Candidate limit reached for this organization'
      )
    })

    it('should consume entitlement and create audit log', async () => {
      const mockJob = createMockJob({ id: mockJobId, organizationId: mockOrgId, status: 'ACTIVE' })
      const mockApplication = createMockApplication(createInput)

      vi.mocked(prisma.application.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.job.findUnique).mockResolvedValue({
        ...mockJob,
        organization: createMockOrganization({ id: mockOrgId }),
      } as any)
      vi.mocked(checkEntitlement).mockResolvedValue(true)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          application: { create: vi.fn().mockResolvedValue(mockApplication) },
        } as any)
      })

      await ApplicationService.createApplication(createInput)

      expect(consumeEntitlement).toHaveBeenCalledWith(
        mockOrgId,
        'MAX_CANDIDATES',
        1,
        expect.anything()
      )
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'SYSTEM',
          orgId: mockOrgId,
          action: 'CREATE',
          resource: 'APPLICATION',
        })
      )
    })
  })

  describe('updateApplicationStatus', () => {
    const applicationId = 'app-123'

    it('should update application status successfully', async () => {
      const existingApplication = createMockApplication({
        id: applicationId,
        status: 'PENDING',
      })
      const mockJob = createMockJob({ organizationId: mockOrgId })
      const updateInput = { status: 'REVIEWING' as const }

      vi.mocked(prisma.application.findUnique).mockResolvedValue({
        ...existingApplication,
        job: mockJob,
      } as any)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          application: {
            update: vi.fn().mockResolvedValue({
              ...existingApplication,
              status: 'REVIEWING',
            }),
          },
        } as any)
      })

      const result = await ApplicationService.updateApplicationStatus(
        applicationId,
        updateInput,
        mockUserId
      )

      expect(result.status).toBe('REVIEWING')
    })

    it('should throw error when application not found', async () => {
      vi.mocked(prisma.application.findUnique).mockResolvedValue(null)

      await expect(
        ApplicationService.updateApplicationStatus(
          applicationId,
          { status: 'REVIEWING' },
          mockUserId
        )
      ).rejects.toThrow('Application not found')
    })

    it('should update notes', async () => {
      const existingApplication = createMockApplication({ id: applicationId })
      const mockJob = createMockJob({ organizationId: mockOrgId })
      const updateInput = { notes: 'Strong candidate' }

      let capturedData: any

      vi.mocked(prisma.application.findUnique).mockResolvedValue({
        ...existingApplication,
        job: mockJob,
      } as any)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          application: {
            update: vi.fn().mockImplementation((opts) => {
              capturedData = opts.data
              return { ...existingApplication, notes: 'Strong candidate' }
            }),
          },
        } as any)
      })

      await ApplicationService.updateApplicationStatus(applicationId, updateInput, mockUserId)

      expect(capturedData.notes).toBe('Strong candidate')
    })

    it('should create audit log for update', async () => {
      const existingApplication = createMockApplication({ id: applicationId })
      const mockJob = createMockJob({ organizationId: mockOrgId })

      vi.mocked(prisma.application.findUnique).mockResolvedValue({
        ...existingApplication,
        job: mockJob,
      } as any)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          application: { update: vi.fn().mockResolvedValue(existingApplication) },
        } as any)
      })

      await ApplicationService.updateApplicationStatus(
        applicationId,
        { status: 'ACCEPTED' },
        mockUserId
      )

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          orgId: mockOrgId,
          action: 'UPDATE',
          resource: 'APPLICATION',
          resourceId: applicationId,
        })
      )
    })
  })

  describe('bulkUpdateStatus', () => {
    it('should update multiple applications successfully', async () => {
      const applicationIds = ['app-1', 'app-2', 'app-3']
      const mockJob = createMockJob({ organizationId: mockOrgId })
      const applications = applicationIds.map((id) =>
        createMockApplication({ id, job: mockJob })
      )

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          application: {
            findMany: vi.fn().mockResolvedValue(
              applications.map((app) => ({ ...app, job: mockJob }))
            ),
            updateMany: vi.fn().mockResolvedValue({ count: 3 }),
          },
        } as any)
      })

      const result = await ApplicationService.bulkUpdateStatus(
        applicationIds,
        'REJECTED',
        mockUserId
      )

      expect(result).toBe(3)
    })

    it('should throw error when no applications found', async () => {
      const applicationIds = ['app-1', 'app-2']

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          application: {
            findMany: vi.fn().mockResolvedValue([]),
            updateMany: vi.fn(),
          },
        } as any)
      })

      await expect(
        ApplicationService.bulkUpdateStatus(applicationIds, 'REJECTED', mockUserId)
      ).rejects.toThrow('No applications found')
    })

    it('should create audit log for bulk update', async () => {
      const applicationIds = ['app-1', 'app-2']
      const mockJob = createMockJob({ organizationId: mockOrgId })

      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          application: {
            findMany: vi.fn().mockResolvedValue([
              { ...createMockApplication({ id: 'app-1' }), job: mockJob },
            ]),
            updateMany: vi.fn().mockResolvedValue({ count: 2 }),
          },
        } as any)
      })

      await ApplicationService.bulkUpdateStatus(applicationIds, 'ACCEPTED', mockUserId)

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          orgId: mockOrgId,
          action: 'BULK_UPDATE',
          resource: 'APPLICATION',
          metadata: expect.objectContaining({
            applicationIds,
            status: 'ACCEPTED',
            count: 2,
          }),
        })
      )
    })
  })

  describe('searchApplications', () => {
    it('should return applications with default parameters', async () => {
      const mockApplications = [createMockApplication(), createMockApplication()]

      vi.mocked(prisma.application.findMany).mockResolvedValue(mockApplications as any)
      vi.mocked(prisma.application.count).mockResolvedValue(2)

      const result = await ApplicationService.searchApplications({})

      expect(result).toEqual({ applications: mockApplications, total: 2 })
      expect(prisma.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 50,
        })
      )
    })

    it('should filter by jobId', async () => {
      const mockApplications = [createMockApplication({ jobId: mockJobId })]

      vi.mocked(prisma.application.findMany).mockResolvedValue(mockApplications as any)
      vi.mocked(prisma.application.count).mockResolvedValue(1)

      await ApplicationService.searchApplications({ jobId: mockJobId })

      expect(prisma.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            jobId: mockJobId,
          }),
        })
      )
    })

    it('should filter by candidateId', async () => {
      const mockApplications = [createMockApplication({ candidateId: mockCandidateId })]

      vi.mocked(prisma.application.findMany).mockResolvedValue(mockApplications as any)
      vi.mocked(prisma.application.count).mockResolvedValue(1)

      await ApplicationService.searchApplications({ candidateId: mockCandidateId })

      expect(prisma.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            candidateId: mockCandidateId,
          }),
        })
      )
    })

    it('should filter by status', async () => {
      const mockApplications = [createMockApplication({ status: 'REVIEWING' })]

      vi.mocked(prisma.application.findMany).mockResolvedValue(mockApplications as any)
      vi.mocked(prisma.application.count).mockResolvedValue(1)

      await ApplicationService.searchApplications({ status: 'REVIEWING' })

      expect(prisma.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'REVIEWING',
          }),
        })
      )
    })

    it('should filter by search term', async () => {
      const mockApplications = [createMockApplication()]

      vi.mocked(prisma.application.findMany).mockResolvedValue(mockApplications as any)
      vi.mocked(prisma.application.count).mockResolvedValue(1)

      await ApplicationService.searchApplications({ search: 'John' })

      expect(prisma.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        })
      )
    })

    it('should support pagination', async () => {
      const mockApplications = [createMockApplication()]

      vi.mocked(prisma.application.findMany).mockResolvedValue(mockApplications as any)
      vi.mocked(prisma.application.count).mockResolvedValue(100)

      await ApplicationService.searchApplications({ limit: 10, offset: 20 })

      expect(prisma.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      )
    })

    it('should include candidate and job details', async () => {
      const mockCandidate = createMockCandidate()
      const mockJob = createMockJob()
      const mockOrg = createMockOrganization()
      const mockApplications = [
        {
          ...createMockApplication(),
          candidate: mockCandidate,
          job: { ...mockJob, organization: mockOrg },
        },
      ]

      vi.mocked(prisma.application.findMany).mockResolvedValue(mockApplications as any)
      vi.mocked(prisma.application.count).mockResolvedValue(1)

      const result = await ApplicationService.searchApplications({})

      expect(result.applications[0]).toHaveProperty('candidate')
      expect(result.applications[0]).toHaveProperty('job')
      expect(prisma.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            candidate: true,
            job: expect.any(Object),
          }),
        })
      )
    })
  })

  describe('getApplicationById', () => {
    it('should return application with full details', async () => {
      const mockApplication = createMockApplication()

      vi.mocked(prisma.application.findUnique).mockResolvedValue(mockApplication)

      const result = await ApplicationService.getApplicationById('app-123')

      expect(result).toEqual(mockApplication)
      expect(prisma.application.findUnique).toHaveBeenCalledWith({
        where: { id: 'app-123' },
        include: {
          candidate: true,
          job: {
            include: {
              organization: true,
            },
          },
          events: true,
        },
      })
    })

    it('should return null when application not found', async () => {
      vi.mocked(prisma.application.findUnique).mockResolvedValue(null)

      const result = await ApplicationService.getApplicationById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('deleteApplication', () => {
    it('should soft delete application by setting status to WITHDRAWN', async () => {
      const applicationId = 'app-123'
      const mockJob = createMockJob({ organizationId: mockOrgId })
      const existingApplication = createMockApplication({ id: applicationId })

      vi.mocked(prisma.application.findUnique).mockResolvedValue({
        ...existingApplication,
        job: mockJob,
      } as any)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          application: {
            update: vi.fn().mockResolvedValue({ ...existingApplication, status: 'WITHDRAWN' }),
          },
        } as any)
      })

      const result = await ApplicationService.deleteApplication(applicationId, mockUserId)

      expect(result.status).toBe('WITHDRAWN')
    })

    it('should throw error when application not found', async () => {
      vi.mocked(prisma.application.findUnique).mockResolvedValue(null)

      await expect(
        ApplicationService.deleteApplication('non-existent', mockUserId)
      ).rejects.toThrow('Application not found')
    })

    it('should create audit log for deletion', async () => {
      const applicationId = 'app-123'
      const mockJob = createMockJob({ organizationId: mockOrgId })
      const existingApplication = createMockApplication({ id: applicationId })

      vi.mocked(prisma.application.findUnique).mockResolvedValue({
        ...existingApplication,
        job: mockJob,
      } as any)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          application: { update: vi.fn().mockResolvedValue(existingApplication) },
        } as any)
      })

      await ApplicationService.deleteApplication(applicationId, mockUserId)

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          orgId: mockOrgId,
          action: 'DELETE',
          resource: 'APPLICATION',
          resourceId: applicationId,
          metadata: { status: 'WITHDRAWN' },
        })
      )
    })
  })

  describe('getApplicationStats', () => {
    it('should return correct statistics', async () => {
      vi.mocked(prisma.application.groupBy).mockResolvedValue([
        { status: 'PENDING', _count: { status: 5 } },
        { status: 'REVIEWING', _count: { status: 3 } },
        { status: 'ACCEPTED', _count: { status: 2 } },
      ] as any)
      vi.mocked(prisma.application.count)
        .mockResolvedValueOnce(2) // todayCount
        .mockResolvedValueOnce(8) // weekCount

      const result = await ApplicationService.getApplicationStats(mockJobId)

      expect(result).toEqual({
        total: 10,
        byStatus: {
          PENDING: 5,
          REVIEWING: 3,
          ACCEPTED: 2,
        },
        todayCount: 2,
        weekCount: 8,
      })
    })

    it('should return zeros when no applications exist', async () => {
      vi.mocked(prisma.application.groupBy).mockResolvedValue([])
      vi.mocked(prisma.application.count).mockResolvedValue(0)

      const result = await ApplicationService.getApplicationStats(mockJobId)

      expect(result).toEqual({
        total: 0,
        byStatus: {},
        todayCount: 0,
        weekCount: 0,
      })
    })
  })
})
