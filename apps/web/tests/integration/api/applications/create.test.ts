import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST, GET } from '@/app/api/applications/route'
import { auth } from '@/lib/auth'
import { createTestRequest, createCandidateSession, parseResponse } from '../../helpers/api-client'
import { prisma, TEST_IDS, createTestJob, cleanupDynamicData } from '../../helpers/test-db'

/**
 * Integration tests for POST /api/applications
 * Tests job application submission with real database
 */

// Mock NextAuth
// Partial mock. lib/errors.ts reaches UnauthorizedError through @/lib/auth, so
// replacing the module wholesale makes handleApiError throw while handling an
// error — which is every validation and auth path in these files.
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  auth: vi.fn(),
}))

// Mock email functionality to avoid sending real emails
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  getApplicationReceivedEmail: vi.fn().mockReturnValue('<p>Application received</p>'),
  getNewApplicationEmail: vi.fn().mockReturnValue('<p>New application</p>'),
}))

describe('POST /api/applications', () => {
  let testJob: any
  let candidateId: string

  beforeEach(async () => {
    vi.clearAllMocks()
    await cleanupDynamicData()

    // Create a test job for applications
    testJob = await createTestJob({
      title: 'Software Engineer Position',
      description:
        'Looking for a talented software engineer with 3+ years of experience in web development.',
      status: 'PUBLISHED',
    })

    candidateId = TEST_IDS.candidate
  })

  describe('Authentication', () => {
    it('should reject unauthenticated requests', async () => {
      // Arrange
      vi.mocked(auth).mockResolvedValue(null)

      const request = createTestRequest('POST', {
        jobId: testJob.id,
        coverLetter: 'I am very interested in this position.',
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(401)
      expect(data.error).toContain('Unauthorized')

      // Verify no application was created
      const applications = await prisma.application.findMany({
        where: { jobId: testJob.id },
      })
      expect(applications).toHaveLength(0)
    })

    it('should allow authenticated candidate to apply', async () => {
      // Arrange
      vi.mocked(auth).mockResolvedValue(
        createCandidateSession({
          id: candidateId,
          email: 'candidate@test.com',
        }),
      )

      const request = createTestRequest('POST', {
        jobId: testJob.id,
        coverLetter:
          'I am excited about this opportunity and believe my skills align well with the requirements.',
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)
      expect(data.jobId).toBe(testJob.id)
      expect(data.candidateId).toBe(candidateId)
    })
  })

  describe('Validation', () => {
    beforeEach(() => {
      vi.mocked(auth).mockResolvedValue(
        createCandidateSession({
          id: candidateId,
        }),
      )
    })

    it('should reject application without jobId', async () => {
      // Arrange
      const request = createTestRequest('POST', {
        // jobId missing
        coverLetter: 'I am interested in this position.',
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toContain('required')
    })

    it('should reject application without cover letter', async () => {
      // Arrange
      const request = createTestRequest('POST', {
        jobId: testJob.id,
        // coverLetter missing
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toContain('required')
    })

    it('should reject application to non-existent job', async () => {
      // Arrange
      const request = createTestRequest('POST', {
        jobId: 'non-existent-job-id',
        coverLetter: 'I am interested in this position.',
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(404)
      expect(data.error).toContain('not found')
    })

    it('should reject duplicate application to same job', async () => {
      // Arrange - create first application
      const firstRequest = createTestRequest('POST', {
        jobId: testJob.id,
        coverLetter: 'First application',
      })
      await POST(firstRequest)

      // Act - try to apply again
      const secondRequest = createTestRequest('POST', {
        jobId: testJob.id,
        coverLetter: 'Second application',
      })
      const response = await POST(secondRequest)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(409)
      expect(data.error).toContain('already applied')

      // Verify only one application exists
      const applications = await prisma.application.findMany({
        where: {
          jobId: testJob.id,
          candidateId: candidateId,
        },
      })
      expect(applications).toHaveLength(1)
    })
  })

  describe('Application Creation', () => {
    beforeEach(() => {
      vi.mocked(auth).mockResolvedValue(
        createCandidateSession({
          id: candidateId,
          email: 'candidate@test.com',
          name: 'Test Candidate',
        }),
      )
    })

    it('should create application with all required fields', async () => {
      // Arrange
      const request = createTestRequest('POST', {
        jobId: testJob.id,
        coverLetter:
          'I am very excited about this opportunity. My background in software development aligns perfectly with your requirements.',
        expectedSalary: 70000,
        availableFrom: '2024-02-01',
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)
      expect(data.id).toBeDefined()
      expect(data.jobId).toBe(testJob.id)
      expect(data.candidateId).toBe(candidateId)
      expect(data.orgId).toBe(TEST_IDS.org)
      expect(data.coverLetter).toBeDefined()
      expect(data.stage).toBe('NEW')

      // Verify in database
      const application = await prisma.application.findUnique({
        where: { id: data.id },
      })
      expect(application).toBeTruthy()
      expect(application?.coverLetter).toContain('excited about this opportunity')
    })

    it('should set default stage to NEW', async () => {
      // Arrange
      const request = createTestRequest('POST', {
        jobId: testJob.id,
        coverLetter: 'I am interested in this position.',
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)

      const application = await prisma.application.findUnique({
        where: { id: data.id },
      })
      expect(application?.stage).toBe('NEW')
    })

    it('should associate application with correct organization', async () => {
      // Arrange
      const request = createTestRequest('POST', {
        jobId: testJob.id,
        coverLetter: 'I am interested in this position.',
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)
      expect(data.orgId).toBe(TEST_IDS.org)

      const application = await prisma.application.findUnique({
        where: { id: data.id },
      })
      expect(application?.orgId).toBe(testJob.orgId)
    })

    it('should include job details in response', async () => {
      // Arrange
      const request = createTestRequest('POST', {
        jobId: testJob.id,
        coverLetter: 'I am interested in this position.',
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)
      expect(data.job).toBeDefined()
      expect(data.job.id).toBe(testJob.id)
      expect(data.job.title).toBe('Software Engineer Position')
      expect(data.job.organization).toBeDefined()
    })

    it('should create application activity record', async () => {
      // Arrange
      const request = createTestRequest('POST', {
        jobId: testJob.id,
        coverLetter: 'I am interested in this position.',
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)

      const activity = await prisma.applicationActivity.findFirst({
        where: { applicationId: data.id },
      })
      expect(activity).toBeTruthy()
      expect(activity?.type).toBe('APPLIED')
      expect(activity?.description).toContain('successfully submitted')
      expect(activity?.performedBy).toBe(candidateId)
    })
  })

  describe('Email Notifications', () => {
    beforeEach(() => {
      vi.mocked(auth).mockResolvedValue(
        createCandidateSession({
          id: candidateId,
          email: 'candidate@test.com',
          name: 'Test Candidate',
        }),
      )
    })

    it('should send email to candidate upon successful application', async () => {
      // Arrange
      const { sendEmail, getApplicationReceivedEmail } = await import('@/lib/email')

      const request = createTestRequest('POST', {
        jobId: testJob.id,
        coverLetter: 'I am interested in this position.',
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(201)
      expect(sendEmail).toHaveBeenCalled()
      expect(getApplicationReceivedEmail).toHaveBeenCalledWith(
        'Test Candidate',
        expect.any(String),
        expect.any(String),
      )
    })

    it('should send email to employer about new application', async () => {
      // Arrange
      const { sendEmail, getNewApplicationEmail } = await import('@/lib/email')

      const request = createTestRequest('POST', {
        jobId: testJob.id,
        coverLetter: 'I am interested in this position.',
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(201)
      expect(sendEmail).toHaveBeenCalled()
      expect(getNewApplicationEmail).toHaveBeenCalled()
    })

    it('should not fail application if email sending fails', async () => {
      // Arrange
      const { sendEmail } = await import('@/lib/email')
      vi.mocked(sendEmail).mockRejectedValueOnce(new Error('Email service down'))

      const request = createTestRequest('POST', {
        jobId: testJob.id,
        coverLetter: 'I am interested in this position.',
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert - application should still succeed
      expect(response.status).toBe(201)
      expect(data.id).toBeDefined()

      // Verify application was created despite email failure
      const application = await prisma.application.findUnique({
        where: { id: data.id },
      })
      expect(application).toBeTruthy()
    })
  })

  describe('GET /api/applications', () => {
    let candidateApp1: any
    let candidateApp2: any

    beforeEach(async () => {
      vi.mocked(auth).mockResolvedValue(
        createCandidateSession({
          id: candidateId,
        }),
      )

      // Create test applications
      const job1 = await createTestJob({ title: 'Job 1' })
      const job2 = await createTestJob({ title: 'Job 2' })

      candidateApp1 = await prisma.application.create({
        data: {
          jobId: job1.id,
          candidateId: candidateId,
          orgId: TEST_IDS.org,
          coverLetter: 'Application 1',
          stage: 'NEW',
        },
      })

      candidateApp2 = await prisma.application.create({
        data: {
          jobId: job2.id,
          candidateId: candidateId,
          orgId: TEST_IDS.org,
          coverLetter: 'Application 2',
          stage: 'INTERVIEWING',
        },
      })
    })

    it('should return all applications for authenticated candidate', async () => {
      // Arrange
      const request = createTestRequest(
        'GET',
        undefined,
        undefined,
        'http://localhost:3000/api/applications',
      )

      // Act
      const response = await GET(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBeGreaterThanOrEqual(2)

      const appIds = data.map((app: any) => app.id)
      expect(appIds).toContain(candidateApp1.id)
      expect(appIds).toContain(candidateApp2.id)
    })

    it('should filter applications by stage', async () => {
      // Arrange
      const request = createTestRequest(
        'GET',
        undefined,
        undefined,
        'http://localhost:3000/api/applications?stage=INTERVIEWING',
      )

      // Act
      const response = await GET(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)

      const interviewingApps = data.filter((app: any) => app.stage === 'INTERVIEWING')
      expect(interviewingApps.length).toBeGreaterThan(0)
      expect(data.every((app: any) => app.stage === 'INTERVIEWING')).toBe(true)
    })

    it('should filter applications by jobId', async () => {
      // Arrange
      const job = await createTestJob({ title: 'Specific Job' })
      await prisma.application.create({
        data: {
          jobId: job.id,
          candidateId: candidateId,
          orgId: TEST_IDS.org,
          coverLetter: 'Specific application',
          stage: 'NEW',
        },
      })

      const request = createTestRequest(
        'GET',
        undefined,
        undefined,
        `http://localhost:3000/api/applications?jobId=${job.id}`,
      )

      // Act
      const response = await GET(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
      expect(data.every((app: any) => app.jobId === job.id)).toBe(true)
    })

    it('should include job and organization details', async () => {
      // Arrange
      const request = createTestRequest(
        'GET',
        undefined,
        undefined,
        'http://localhost:3000/api/applications',
      )

      // Act
      const response = await GET(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(200)
      expect(data.length).toBeGreaterThan(0)

      const firstApp = data[0]
      expect(firstApp.job).toBeDefined()
      expect(firstApp.job.title).toBeDefined()
      expect(firstApp.job.organization).toBeDefined()
      expect(firstApp.job.organization.name).toBeDefined()
    })

    it('should order applications by most recent first', async () => {
      // Arrange
      const request = createTestRequest(
        'GET',
        undefined,
        undefined,
        'http://localhost:3000/api/applications',
      )

      // Act
      const response = await GET(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(200)
      expect(data.length).toBeGreaterThan(1)

      // Check that dates are in descending order
      for (let i = 0; i < data.length - 1; i++) {
        const current = new Date(data[i].createdAt)
        const next = new Date(data[i + 1].createdAt)
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime())
      }
    })

    it('should only return applications for authenticated user', async () => {
      // Arrange - create application for different candidate
      const otherCandidate = await prisma.user.create({
        data: {
          email: 'other-candidate@test.com',
          name: 'Other Candidate',
          password: 'hashed',
          locale: 'en',
        },
      })

      const otherJob = await createTestJob()
      await prisma.application.create({
        data: {
          jobId: otherJob.id,
          candidateId: otherCandidate.id,
          orgId: TEST_IDS.org,
          coverLetter: 'Other application',
          stage: 'NEW',
        },
      })

      const request = createTestRequest(
        'GET',
        undefined,
        undefined,
        'http://localhost:3000/api/applications',
      )

      // Act
      const response = await GET(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(200)
      expect(data.every((app: any) => app.candidateId === candidateId)).toBe(true)
      expect(data.some((app: any) => app.candidateId === otherCandidate.id)).toBe(false)
    })

    it('should reject unauthenticated GET requests', async () => {
      // Arrange
      vi.mocked(auth).mockResolvedValue(null)

      const request = createTestRequest(
        'GET',
        undefined,
        undefined,
        'http://localhost:3000/api/applications',
      )

      // Act
      const response = await GET(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(401)
      expect(data.error).toContain('Unauthorized')
    })
  })

  describe('Edge Cases', () => {
    beforeEach(() => {
      vi.mocked(auth).mockResolvedValue(
        createCandidateSession({
          id: candidateId,
          email: 'candidate@test.com',
        }),
      )
    })

    it('should handle very long cover letters', async () => {
      // Arrange
      const longCoverLetter = 'A'.repeat(5000) // 5000 character cover letter

      const request = createTestRequest('POST', {
        jobId: testJob.id,
        coverLetter: longCoverLetter,
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)

      const application = await prisma.application.findUnique({
        where: { id: data.id },
      })
      expect(application?.coverLetter?.length).toBe(5000)
    })

    it('should handle special characters in cover letter', async () => {
      // Arrange
      const specialCharsCoverLetter =
        'I love coding! 🚀 My skills include: C++, C#, & Node.js. Email: test@example.com'

      const request = createTestRequest('POST', {
        jobId: testJob.id,
        coverLetter: specialCharsCoverLetter,
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)

      const application = await prisma.application.findUnique({
        where: { id: data.id },
      })
      expect(application?.coverLetter).toBe(specialCharsCoverLetter)
    })

    it('should handle application when user has no email', async () => {
      // Arrange
      vi.mocked(auth).mockResolvedValue(
        createCandidateSession({
          id: candidateId,
          email: undefined, // No email
        }),
      )

      const request = createTestRequest('POST', {
        jobId: testJob.id,
        coverLetter: 'I am interested in this position.',
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert - application should still be created
      expect(response.status).toBe(201)
      expect(data.id).toBeDefined()
    })
  })
})
