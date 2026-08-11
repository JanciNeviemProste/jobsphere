import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/jobs/route'
import {
  createTestRequest,
  createRecruiterSession,
  createOrgAdminSession,
  createCandidateSession,
  parseResponse,
} from '../../helpers/api-client'
import { prisma, TEST_IDS } from '../../helpers/test-db'

/**
 * Integration tests for POST /api/jobs
 * Tests job creation with authentication and authorization
 */

// Mock NextAuth using vi.hoisted for proper hoisting
const { mockAuthFn } = vi.hoisted(() => ({
  mockAuthFn: vi.fn(),
}))

// Partial mock. lib/errors.ts reaches UnauthorizedError through @/lib/auth, so
// replacing the module wholesale makes handleApiError throw while handling an
// error — which is every validation and auth path in these files.
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  auth: mockAuthFn,
  requireAuth: vi.fn(async () => {
    const session = await mockAuthFn()
    if (!session?.user?.id) {
      throw new Error('You must be logged in to access this resource')
    }
    return session
  }),
}))

describe('POST /api/jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentication', () => {
    it('should reject unauthenticated requests', async () => {
      // Arrange
      mockAuthFn.mockResolvedValue(null)

      const request = createTestRequest('POST', {
        title: 'Test Job',
        description: 'A'.repeat(100),
        type: 'FULL_TIME',
        workMode: 'ONSITE',
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(401)

      // Verify no job was created
      const jobs = await prisma.job.findMany({
        where: { title: 'Test Job' },
      })
      expect(jobs).toHaveLength(0)
    })

    it('should reject candidate users', async () => {
      // Arrange
      mockAuthFn.mockResolvedValue(createCandidateSession())

      const request = createTestRequest('POST', {
        title: 'Test Job',
        description: 'A'.repeat(100),
        type: 'FULL_TIME',
        workMode: 'ONSITE',
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(403)
      const data = await parseResponse(response)
      expect(data.error).toContain('organization')
    })
  })

  describe('Authorization', () => {
    it('should allow org admin to create job', async () => {
      // Arrange
      mockAuthFn.mockResolvedValue(createOrgAdminSession())

      const request = createTestRequest('POST', {
        title: 'Software Engineer',
        description:
          'We are looking for a talented software engineer to join our team. Must have 3+ years of experience.',
        type: 'FULL_TIME',
        workMode: 'ONSITE',
        seniority: 'MID',
        salaryMin: 50000,
        salaryMax: 80000,
        locale: 'en',
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)
      expect(data.job).toBeDefined()
      expect(data.job.title).toBe('Software Engineer')
      expect(data.job.orgId).toBe(TEST_IDS.org)

      // Verify job was created in database
      const job = await prisma.job.findUnique({
        where: { id: data.job.id },
      })
      expect(job).toBeTruthy()
      expect(job?.createdBy).toBe(TEST_IDS.admin)
    })

    it('should allow recruiter to create job', async () => {
      // Arrange
      mockAuthFn.mockResolvedValue(createRecruiterSession())

      const request = createTestRequest('POST', {
        title: 'Frontend Developer',
        description: 'React and TypeScript expert needed for exciting projects.',
        type: 'FULL_TIME',
        workMode: 'ONSITE',
        seniority: 'SENIOR',
        locale: 'en',
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)
      expect(data.job.title).toBe('Frontend Developer')
      expect(data.job.createdBy).toBe(TEST_IDS.recruiter)
    })

    it('should reject user from different organization', async () => {
      // Arrange - user from different org
      mockAuthFn.mockResolvedValue(
        createRecruiterSession({
          orgId: 'different-org-id',
          orgName: 'Different Organization',
        }),
      )

      const request = createTestRequest('POST', {
        title: 'Test Job',
        description: 'A'.repeat(100),
        type: 'FULL_TIME',
        workMode: 'ONSITE',
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(403)
    })
  })

  describe('Validation', () => {
    beforeEach(() => {
      mockAuthFn.mockResolvedValue(createRecruiterSession())
    })

    it('should reject missing required fields', async () => {
      // Arrange
      const request = createTestRequest('POST', {
        // Missing title, description, type, workMode
        seniority: 'SENIOR',
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBeTruthy()
    })

    it('should reject description shorter than 50 characters', async () => {
      // Arrange
      const request = createTestRequest('POST', {
        title: 'Test Job',
        description: 'Too short', // Less than 50 chars
        type: 'FULL_TIME',
        workMode: 'ONSITE',
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toContain('description')
    })

    it('should reject invalid employment type', async () => {
      // Arrange
      const request = createTestRequest('POST', {
        title: 'Test Job',
        description: 'A'.repeat(100),
        type: 'INVALID_TYPE',
        workMode: 'ONSITE',
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBeTruthy()
    })

    it('should reject invalid salary range', async () => {
      // Arrange - salaryMin > salaryMax
      const request = createTestRequest('POST', {
        title: 'Test Job',
        description: 'A'.repeat(100),
        type: 'FULL_TIME',
        workMode: 'ONSITE',
        salaryMin: 100000,
        salaryMax: 50000, // Lower than min
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toContain('salary')
    })
  })

  describe('Job Creation', () => {
    beforeEach(() => {
      mockAuthFn.mockResolvedValue(createRecruiterSession())
    })

    it('should create job with all fields', async () => {
      // Arrange
      const jobData = {
        title: 'Full Stack Developer',
        description:
          'Looking for a full stack developer with experience in React and Node.js. The ideal candidate has 5+ years of experience.',
        requirements: 'React, Node.js, TypeScript, PostgreSQL',
        responsibilities: 'Build features, review code, mentor juniors',
        benefits: 'Health insurance, remote work, learning budget',
        type: 'FULL_TIME',
        workMode: 'REMOTE',
        seniority: 'SENIOR',
        location: 'Bratislava',
        region: 'BA',
        salaryMin: 60000,
        salaryMax: 90000,
        salaryCurrency: 'EUR',
        salaryPeriod: 'YEAR',
        locale: 'en',
        status: 'PUBLISHED',
      }

      const request = createTestRequest('POST', jobData)

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)
      expect(data.job).toMatchObject({
        title: jobData.title,
        description: jobData.description,
        employmentType: jobData.type,
        seniority: jobData.seniority,
        city: jobData.location,
        region: jobData.region,
        remote: true,
        hybrid: false,
        salaryMin: jobData.salaryMin,
        salaryMax: jobData.salaryMax,
      })

      // Verify in database
      const job = await prisma.job.findUnique({
        where: { id: data.job.id },
      })
      expect(job).toBeTruthy()
      expect(job?.requirements).toBe(jobData.requirements)
      expect(job?.benefits).toBe(jobData.benefits)
    })

    it('should default status to DRAFT', async () => {
      // Arrange
      const request = createTestRequest('POST', {
        title: 'Draft Job',
        description: 'A'.repeat(100),
        type: 'FULL_TIME',
        workMode: 'ONSITE',
        // status not specified
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)
      expect(data.job.status).toBe('DRAFT')

      const job = await prisma.job.findUnique({
        where: { id: data.job.id },
      })
      expect(job?.status).toBe('DRAFT')
      expect(job?.publishedAt).toBeNull()
    })

    it('should set publishedAt when status is PUBLISHED', async () => {
      // Arrange
      const request = createTestRequest('POST', {
        title: 'Published Job',
        description: 'A'.repeat(100),
        type: 'FULL_TIME',
        workMode: 'ONSITE',
        status: 'PUBLISHED',
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)

      const job = await prisma.job.findUnique({
        where: { id: data.job.id },
      })
      expect(job?.status).toBe('PUBLISHED')
      expect(job?.publishedAt).toBeTruthy()
      expect(new Date(job!.publishedAt!).getTime()).toBeLessThanOrEqual(Date.now())
    })

    it('should generate slug from title', async () => {
      // Arrange
      const request = createTestRequest('POST', {
        title: 'Senior Software Engineer',
        description: 'A'.repeat(100),
        type: 'FULL_TIME',
        workMode: 'ONSITE',
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)

      const job = await prisma.job.findUnique({
        where: { id: data.job.id },
      })
      expect(job?.slug).toBeTruthy()
      expect(job?.slug).toContain('senior-software-engineer')
    })

    it('should handle multiple jobs with same title', async () => {
      // Arrange - create first job
      const jobData = {
        title: 'Software Engineer',
        description: 'A'.repeat(100),
        type: 'FULL_TIME',
        workMode: 'ONSITE',
      }

      const firstRequest = createTestRequest('POST', jobData)
      const firstResponse = await POST(firstRequest)
      const firstData = await parseResponse(firstResponse)

      // Act - create second job with same title
      const secondRequest = createTestRequest('POST', jobData)
      const secondResponse = await POST(secondRequest)
      const secondData = await parseResponse(secondResponse)

      // Assert
      expect(firstResponse.status).toBe(201)
      expect(secondResponse.status).toBe(201)
      expect(firstData.job.id).not.toBe(secondData.job.id)

      // Verify both jobs exist in database
      const jobs = await prisma.job.findMany({
        where: {
          title: 'Software Engineer',
          orgId: TEST_IDS.org,
        },
      })
      expect(jobs).toHaveLength(2)
    })
  })

  describe('Localization', () => {
    beforeEach(() => {
      mockAuthFn.mockResolvedValue(createRecruiterSession())
    })

    it('should create job in different locale', async () => {
      // Arrange
      const request = createTestRequest('POST', {
        title: 'Softwarový inžinier',
        description:
          'Hľadáme skúseného softwarového inžiniera s minimálne 3 rokmi praxe v oblasti vývoja webových aplikácií.',
        type: 'FULL_TIME',
        workMode: 'ONSITE',
        locale: 'sk',
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)
      expect(data.job.locale).toBe('sk')

      const job = await prisma.job.findUnique({
        where: { id: data.job.id },
      })
      expect(job?.locale).toBe('sk')
    })
  })
})
