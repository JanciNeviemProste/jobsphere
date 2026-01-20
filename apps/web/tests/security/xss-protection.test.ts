/**
 * XSS (Cross-Site Scripting) Protection Security Tests
 *
 * Comprehensive security tests to verify XSS prevention across all API endpoints.
 * Tests both API responses AND database storage to ensure no malicious scripts
 * can be injected at any layer.
 *
 * Test Coverage:
 * - Script tag injection
 * - Event handler injection (onerror, onclick, onload)
 * - HTML entity encoding
 * - Malformed URLs (javascript:, data:)
 * - XSS in query parameters
 * - Reflected XSS prevention
 * - Stored XSS prevention
 *
 * @see OWASP XSS Prevention Cheat Sheet
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { POST as JobsPOST, GET as JobsGET } from '@/app/api/jobs/route'
import { POST as ApplicationsPOST } from '@/app/api/applications/route'
import { PATCH as OrgPATCH } from '@/app/api/organizations/[id]/route'
import {
  createTestRequest,
  createRecruiterSession,
  createOrgAdminSession,
  createCandidateSession,
  parseResponse,
} from '../integration/helpers/api-client'
import { prisma, TEST_IDS, cleanupDynamicData } from '../integration/helpers/test-db'

/**
 * XSS Attack Payloads
 * Based on OWASP XSS Filter Evasion Cheat Sheet
 */
const XSS_PAYLOADS = {
  // Basic script injection
  basicScript: '<script>alert("xss")</script>',
  scriptWithSrc: '<script src="https://evil.com/xss.js"></script>',

  // Event handlers
  imgOnerror: '<img src=x onerror=alert(1)>',
  imgOnload: '<img src="valid.jpg" onload=alert(1)>',
  svgOnload: '<svg onload=alert(1)>',
  divOnclick: '<div onclick=alert(1)>Click</div>',
  inputOnfocus: '<input onfocus=alert(1) autofocus>',
  bodyOnload: '<body onload=alert(1)>',

  // JavaScript protocol URLs
  jsProtocol: 'javascript:alert(1)',
  jsProtocolInLink: '<a href="javascript:alert(1)">click</a>',

  // Data URIs
  dataUri: 'data:text/html,<script>alert(1)</script>',
  dataUriBase64: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',

  // Special characters
  htmlEntities: '&lt;script&gt;alert("xss")&lt;/script&gt;',
  angleBrackets: '< > & " \' /',

  // Case variations
  upperCase: '<SCRIPT>alert(1)</SCRIPT>',
  mixedCase: '<ScRiPt>alert(1)</sCrIpT>',

  // Polyglot payloads
  polyglot: 'jaVasCript:/*-/*`/*\\`/*\'/*"/**/(/* */onerror=alert(1) )//%0D%0A%0d%0a//',

  // HTML5 event handlers
  detailsOntoggle: '<details open ontoggle=alert(1)>',
  videoOncanplay: '<video oncanplay=alert(1)><source>',
}

// Mock NextAuth using vi.hoisted for proper hoisting
const { mockAuthFn } = vi.hoisted(() => ({
  mockAuthFn: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  auth: mockAuthFn,
  requireAuth: vi.fn(async () => {
    const session = await mockAuthFn()
    if (!session?.user?.id) {
      throw new Error('You must be logged in to access this resource')
    }
    return session
  }),
}))

describe('XSS Protection Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await cleanupDynamicData()
  })

  describe('1. Script Tag Injection', () => {
    it('should sanitize script tags in job title', async () => {
      // Arrange
      mockAuthFn.mockResolvedValue(createRecruiterSession())

      const xssPayload = XSS_PAYLOADS.basicScript
      const request = createTestRequest('POST', {
        title: xssPayload,
        description: 'A'.repeat(100),
        employmentType: 'FULL_TIME',
        workMode: 'REMOTE',
        type: 'FULL_TIME',
        seniority: 'MEDIOR',
      })

      // Act
      const response = await JobsPOST(request)
      const data = await parseResponse(response)

      // Assert - response doesn't contain raw script tag
      expect(response.status).toBe(201)
      expect(data.title).not.toContain('<script>')
      expect(data.title).not.toContain('alert')

      // Verify database storage is safe
      const job = await prisma.job.findUnique({
        where: { id: data.id },
      })
      expect(job?.title).not.toContain('<script>')
      expect(job?.title).not.toMatch(/<script[^>]*>/i)
    })

    it('should sanitize script tags in job description', async () => {
      // Arrange
      mockAuthFn.mockResolvedValue(createRecruiterSession())

      const maliciousDescription = `
        This is a great job opportunity!
        ${XSS_PAYLOADS.basicScript}
        ${XSS_PAYLOADS.scriptWithSrc}
        Please apply today!
      `

      const request = createTestRequest('POST', {
        title: 'Senior Developer',
        description: maliciousDescription,
        employmentType: 'FULL_TIME',
        workMode: 'REMOTE',
        type: 'FULL_TIME',
        seniority: 'SENIOR',
      })

      // Act
      const response = await JobsPOST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)
      expect(data.description).not.toMatch(/<script[^>]*>/i)
      expect(data.description).not.toContain('src="https://evil.com')

      // Verify database
      const job = await prisma.job.findUnique({
        where: { id: data.id },
      })
      expect(job?.description).not.toMatch(/<script[^>]*>/i)
    })

    it('should sanitize script tags in cover letter field', async () => {
      // Arrange - create a job first
      mockAuthFn.mockResolvedValue(createRecruiterSession())

      const jobRequest = createTestRequest('POST', {
        title: 'Test Job',
        description: 'A'.repeat(100),
        employmentType: 'FULL_TIME',
        workMode: 'REMOTE',
        type: 'FULL_TIME',
        seniority: 'MEDIOR',
      })

      const jobResponse = await JobsPOST(jobRequest)
      const jobData = await parseResponse(jobResponse)

      // Switch to candidate session
      mockAuthFn.mockResolvedValue(createCandidateSession())

      const maliciousCoverLetter = `
        Dear Hiring Manager,
        ${XSS_PAYLOADS.basicScript}
        I am very interested in this position.
        ${XSS_PAYLOADS.upperCase}
        Best regards
      `

      const appRequest = createTestRequest('POST', {
        jobId: jobData.id,
        coverLetter: maliciousCoverLetter,
      })

      // Act
      const response = await ApplicationsPOST(appRequest)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)
      expect(data.coverLetter).not.toMatch(/<script[^>]*>/i)
      expect(data.coverLetter).not.toContain('alert')

      // Verify database
      const application = await prisma.application.findUnique({
        where: { id: data.id },
      })
      expect(application?.coverLetter).not.toMatch(/<script[^>]*>/i)
    })
  })

  describe('2. Event Handler Injection', () => {
    it('should sanitize img onerror in job title', async () => {
      // Arrange
      mockAuthFn.mockResolvedValue(createRecruiterSession())

      const request = createTestRequest('POST', {
        title: XSS_PAYLOADS.imgOnerror,
        description: 'A'.repeat(100),
        employmentType: 'FULL_TIME',
        workMode: 'REMOTE',
        type: 'FULL_TIME',
        seniority: 'MEDIOR',
      })

      // Act
      const response = await JobsPOST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)
      expect(data.title).not.toMatch(/onerror/i)
      expect(data.title).not.toContain('alert')

      // Verify database
      const job = await prisma.job.findUnique({
        where: { id: data.id },
      })
      expect(job?.title).not.toMatch(/onerror/i)
    })

    it('should sanitize onclick, onload, onerror handlers in job description', async () => {
      // Arrange
      mockAuthFn.mockResolvedValue(createRecruiterSession())

      const maliciousDescription = `
        Job Requirements:
        ${XSS_PAYLOADS.imgOnerror}
        ${XSS_PAYLOADS.divOnclick}
        ${XSS_PAYLOADS.imgOnload}
        ${XSS_PAYLOADS.svgOnload}
        ${XSS_PAYLOADS.inputOnfocus}
        ${XSS_PAYLOADS.bodyOnload}
        ${XSS_PAYLOADS.detailsOntoggle}
        Apply now!
      `

      const request = createTestRequest('POST', {
        title: 'Developer Position',
        description: maliciousDescription,
        employmentType: 'FULL_TIME',
        workMode: 'REMOTE',
        type: 'FULL_TIME',
        seniority: 'MEDIOR',
      })

      // Act
      const response = await JobsPOST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)
      expect(data.description).not.toMatch(/onerror/i)
      expect(data.description).not.toMatch(/onclick/i)
      expect(data.description).not.toMatch(/onload/i)
      expect(data.description).not.toMatch(/onfocus/i)
      expect(data.description).not.toMatch(/ontoggle/i)

      // Verify database
      const job = await prisma.job.findUnique({
        where: { id: data.id },
      })
      expect(job?.description).not.toMatch(/on\w+=/i) // No event handlers
    })

    it('should sanitize event handlers in organization name', async () => {
      // Arrange
      mockAuthFn.mockResolvedValue(createOrgAdminSession())

      // Create test org
      const org = await prisma.organization.create({
        data: {
          name: 'Test Org',
          slug: `test-org-${Date.now()}`,
        },
      })

      // Add admin membership
      await prisma.userOrgRole.create({
        data: {
          userId: TEST_IDS.admin,
          orgId: org.id,
          role: 'ORG_ADMIN',
        },
      })

      const request = createTestRequest('PATCH', {
        name: `Evil Corp ${XSS_PAYLOADS.imgOnerror}`,
      })

      // Act
      const response = await OrgPATCH(request, { params: { id: org.id } })
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(200)
      expect(data.name).not.toMatch(/onerror/i)

      // Verify database
      const updated = await prisma.organization.findUnique({
        where: { id: org.id },
      })
      expect(updated?.name).not.toMatch(/onerror/i)

      // Cleanup
      await prisma.userOrgRole.deleteMany({ where: { orgId: org.id } })
      await prisma.organization.delete({ where: { id: org.id } })
    })
  })

  describe('3. HTML Entity Encoding', () => {
    it('should properly handle special characters in job title', async () => {
      // Arrange
      mockAuthFn.mockResolvedValue(createRecruiterSession())

      const specialChars = XSS_PAYLOADS.angleBrackets
      const request = createTestRequest('POST', {
        title: `Developer ${specialChars} Position`,
        description: 'A'.repeat(100),
        employmentType: 'FULL_TIME',
        workMode: 'REMOTE',
        type: 'FULL_TIME',
        seniority: 'MEDIOR',
      })

      // Act
      const response = await JobsPOST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)

      // Special chars should be safely encoded or escaped
      const job = await prisma.job.findUnique({
        where: { id: data.id },
      })
      expect(job?.title).toBeDefined()

      // Should not create executable HTML
      expect(job?.title).not.toMatch(/<[^>]+>/i)
    })

    it('should verify proper escaping in rendered content', async () => {
      // Arrange
      mockAuthFn.mockResolvedValue(createRecruiterSession())

      const htmlEntities = XSS_PAYLOADS.htmlEntities
      const request = createTestRequest('POST', {
        title: 'Test Job',
        description: `Description with entities: ${htmlEntities}`,
        employmentType: 'FULL_TIME',
        workMode: 'REMOTE',
        type: 'FULL_TIME',
        seniority: 'MEDIOR',
      })

      // Act
      const response = await JobsPOST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)

      // HTML entities should not be decoded into executable script
      expect(data.description).not.toContain('<script>')

      const job = await prisma.job.findUnique({
        where: { id: data.id },
      })
      expect(job?.description).not.toMatch(/<script[^>]*>/i)
    })
  })

  describe('4. Malformed URLs', () => {
    it('should block javascript: protocol in LinkedIn URL field', async () => {
      // Arrange - create candidate with malicious LinkedIn URL
      const candidate = await prisma.candidate.create({
        data: {
          orgId: TEST_IDS.org,
          source: 'MANUAL',
        },
      })

      const maliciousContact = await prisma.candidateContact.create({
        data: {
          candidateId: candidate.id,
          fullName: 'Test Candidate',
          email: 'test@example.com',
          linkedIn: XSS_PAYLOADS.jsProtocol,
        },
      })

      // Assert - verify storage doesn't contain javascript: protocol
      const stored = await prisma.candidateContact.findUnique({
        where: { id: maliciousContact.id },
      })

      // The middleware should have removed the dangerous linkedIn field
      // So either the field is null/undefined, or it doesn't contain javascript:
      if (stored?.linkedIn) {
        expect(stored.linkedIn).not.toMatch(/javascript:/i)
        expect(stored.linkedIn).not.toContain('alert')
      } else {
        // Field was removed/nullified by middleware (expected behavior)
        expect(stored?.linkedIn).toBeNull()
      }

      // Cleanup - check if record exists before deleting
      if (stored) {
        await prisma.candidateContact.delete({ where: { id: maliciousContact.id } })
      }
      await prisma.candidate.delete({ where: { id: candidate.id } })
    })

    it('should block data: URIs in website field', async () => {
      // Arrange
      mockAuthFn.mockResolvedValue(createOrgAdminSession())

      const org = await prisma.organization.create({
        data: {
          name: 'Test Org',
          slug: `test-org-${Date.now()}`,
        },
      })

      await prisma.userOrgRole.create({
        data: {
          userId: TEST_IDS.admin,
          orgId: org.id,
          role: 'ORG_ADMIN',
        },
      })

      const request = createTestRequest('PATCH', {
        website: XSS_PAYLOADS.dataUri,
      })

      // Act
      const response = await OrgPATCH(request, { params: { id: org.id } })

      // Assert - should either reject or sanitize
      if (response.status === 200) {
        const data = await parseResponse(response)
        expect(data.website).not.toMatch(/data:text\/html/i)
        expect(data.website).not.toContain('script')
      } else {
        // Validation rejected it - that's also acceptable
        expect(response.status).toBe(400)
      }

      // Cleanup
      await prisma.userOrgRole.deleteMany({ where: { orgId: org.id } })
      await prisma.organization.delete({ where: { id: org.id } })
    })
  })

  describe('5. XSS in Query Parameters', () => {
    it('should sanitize XSS payload in search query parameter', async () => {
      // Arrange
      const xssSearch = XSS_PAYLOADS.basicScript
      const url = `http://localhost:3000/api/jobs?search=${encodeURIComponent(xssSearch)}`
      const request = createTestRequest('GET', undefined, {}, url)

      // Act
      const response = await JobsGET(request)

      // Assert - should not crash and should not reflect raw script
      expect(response.status).toBeLessThan(500)

      if (response.status === 200) {
        const data = await parseResponse(response)
        const responseStr = JSON.stringify(data)
        expect(responseStr).not.toContain('<script>')
        expect(responseStr).not.toMatch(/<script[^>]*>/i)
      }
    })

    it('should verify query params are sanitized before database queries', async () => {
      // Arrange - create a job with normal content
      mockAuthFn.mockResolvedValue(createRecruiterSession())

      const jobRequest = createTestRequest('POST', {
        title: 'Normal Job Title',
        description: 'A'.repeat(100),
        employmentType: 'FULL_TIME',
        workMode: 'REMOTE',
        type: 'FULL_TIME',
        seniority: 'MEDIOR',
      })

      await JobsPOST(jobRequest)

      // Try to search with XSS payload
      const xssPayloads = [
        XSS_PAYLOADS.basicScript,
        XSS_PAYLOADS.imgOnerror,
        XSS_PAYLOADS.jsProtocol,
        XSS_PAYLOADS.polyglot,
      ]

      for (const payload of xssPayloads) {
        const url = `http://localhost:3000/api/jobs?search=${encodeURIComponent(payload)}`
        const request = createTestRequest('GET', undefined, {}, url)

        // Act
        const response = await JobsGET(request)

        // Assert - should handle safely without SQL injection or XSS
        expect(response.status).toBeLessThan(500)

        if (response.status === 200) {
          const data = await parseResponse(response)
          const responseStr = JSON.stringify(data)

          // Response should not contain unescaped XSS payloads
          expect(responseStr).not.toMatch(/<script[^>]*>/i)
          expect(responseStr).not.toMatch(/onerror\s*=/i)
          expect(responseStr).not.toMatch(/javascript:/i)
        }
      }
    })
  })

  describe('6. Reflected XSS Prevention', () => {
    it('should not reflect unsanitized user input in error messages', async () => {
      // Arrange
      mockAuthFn.mockResolvedValue(createRecruiterSession())

      const maliciousTitle = XSS_PAYLOADS.basicScript
      const request = createTestRequest('POST', {
        title: maliciousTitle,
        // Missing required fields to trigger validation error
        employmentType: 'FULL_TIME',
      })

      // Act
      const response = await JobsPOST(request)

      // Assert
      if (response.status === 400) {
        const data = await parseResponse(response)
        const errorStr = JSON.stringify(data)

        // Error message should not reflect raw XSS payload
        expect(errorStr).not.toContain('<script>')
        expect(errorStr).not.toMatch(/<script[^>]*>/i)
      }
    })

    it('should sanitize error responses for invalid data', async () => {
      // Arrange
      mockAuthFn.mockResolvedValue(createRecruiterSession())

      const maliciousData = {
        title: XSS_PAYLOADS.imgOnerror,
        description: XSS_PAYLOADS.divOnclick,
        employmentType: XSS_PAYLOADS.jsProtocol, // Invalid enum value with XSS
        workMode: 'REMOTE',
        type: 'FULL_TIME',
        seniority: 'MEDIOR',
      }

      const request = createTestRequest('POST', maliciousData)

      // Act
      const response = await JobsPOST(request)

      // Assert
      const data = await parseResponse(response)
      const responseStr = JSON.stringify(data)

      // Should not reflect XSS payloads in error response
      expect(responseStr).not.toMatch(/<script[^>]*>/i)
      expect(responseStr).not.toMatch(/onerror/i)
      expect(responseStr).not.toMatch(/onclick/i)
      expect(responseStr).not.toMatch(/javascript:/i)
    })
  })

  describe('7. Stored XSS Prevention', () => {
    it('should sanitize job data when created and retrieved', async () => {
      // Arrange - Create job with XSS payload
      mockAuthFn.mockResolvedValue(createRecruiterSession())

      const xssTitle = `Senior Developer ${XSS_PAYLOADS.basicScript}`
      const xssDescription = `
        Great opportunity!
        ${XSS_PAYLOADS.imgOnerror}
        ${XSS_PAYLOADS.divOnclick}
      `

      const createRequest = createTestRequest('POST', {
        title: xssTitle,
        description: xssDescription,
        employmentType: 'FULL_TIME',
        workMode: 'REMOTE',
        type: 'FULL_TIME',
        seniority: 'SENIOR',
      })

      // Act - Create job
      const createResponse = await JobsPOST(createRequest)
      const createData = await parseResponse(createResponse)

      expect(createResponse.status).toBe(201)

      // Retrieve job via API
      const getRequest = createTestRequest('GET', undefined, {}, 'http://localhost:3000/api/jobs')
      const getResponse = await JobsGET(getRequest)
      const jobs = await parseResponse(getResponse)

      // Assert - Find our job
      const retrievedJob = Array.isArray(jobs)
        ? jobs.find((j: any) => j.id === createData.id)
        : null

      if (retrievedJob) {
        // Retrieved data should not contain XSS
        expect(retrievedJob.title).not.toMatch(/<script[^>]*>/i)
        expect(retrievedJob.description).not.toMatch(/onerror/i)
        expect(retrievedJob.description).not.toMatch(/onclick/i)
      }

      // Verify database storage
      const dbJob = await prisma.job.findUnique({
        where: { id: createData.id },
      })

      expect(dbJob?.title).not.toMatch(/<script[^>]*>/i)
      expect(dbJob?.description).not.toMatch(/<script[^>]*>/i)
      expect(dbJob?.description).not.toMatch(/onerror/i)
    })

    it('should sanitize cover letter on creation and display', async () => {
      // Arrange - Create job
      mockAuthFn.mockResolvedValue(createRecruiterSession())

      const jobRequest = createTestRequest('POST', {
        title: 'Test Job',
        description: 'A'.repeat(100),
        employmentType: 'FULL_TIME',
        workMode: 'REMOTE',
        type: 'FULL_TIME',
        seniority: 'MEDIOR',
      })

      const jobResponse = await JobsPOST(jobRequest)
      const job = await parseResponse(jobResponse)

      // Switch to candidate and apply with malicious cover letter
      mockAuthFn.mockResolvedValue(createCandidateSession())

      const xssCoverLetter = `
        Dear Hiring Manager,

        ${XSS_PAYLOADS.basicScript}
        ${XSS_PAYLOADS.imgOnerror}
        ${XSS_PAYLOADS.svgOnload}

        I am very interested in this position.

        ${XSS_PAYLOADS.jsProtocolInLink}

        Best regards
      `

      const appRequest = createTestRequest('POST', {
        jobId: job.id,
        coverLetter: xssCoverLetter,
      })

      // Act
      const appResponse = await ApplicationsPOST(appRequest)
      const application = await parseResponse(appResponse)

      // Assert
      expect(appResponse.status).toBe(201)
      expect(application.coverLetter).not.toMatch(/<script[^>]*>/i)
      expect(application.coverLetter).not.toMatch(/onerror/i)
      expect(application.coverLetter).not.toMatch(/onload/i)
      expect(application.coverLetter).not.toMatch(/javascript:/i)

      // Verify database storage
      const dbApplication = await prisma.application.findUnique({
        where: { id: application.id },
      })

      expect(dbApplication?.coverLetter).not.toMatch(/<script[^>]*>/i)
      expect(dbApplication?.coverLetter).not.toMatch(/on\w+=/i)
      expect(dbApplication?.coverLetter).not.toMatch(/javascript:/i)
    })
  })

  describe('8. Additional XSS Attack Vectors', () => {
    it('should handle case variation attacks', async () => {
      // Arrange
      mockAuthFn.mockResolvedValue(createRecruiterSession())

      const caseVariations = [
        XSS_PAYLOADS.upperCase,
        XSS_PAYLOADS.mixedCase,
        '<ScRiPt>alert(1)</ScRiPt>',
        '<IMG SRC=x ONERROR=alert(1)>',
      ]

      for (const payload of caseVariations) {
        const request = createTestRequest('POST', {
          title: payload,
          description: 'A'.repeat(100),
          employmentType: 'FULL_TIME',
          workMode: 'REMOTE',
          type: 'FULL_TIME',
          seniority: 'MEDIOR',
        })

        // Act
        const response = await JobsPOST(request)
        const data = await parseResponse(response)

        // Assert
        expect(response.status).toBe(201)
        expect(data.title).not.toMatch(/<script[^>]*>/i)
        expect(data.title).not.toMatch(/onerror/i)

        const job = await prisma.job.findUnique({
          where: { id: data.id },
        })
        expect(job?.title).not.toMatch(/<script[^>]*>/i)
      }
    })

    it('should prevent polyglot XSS attacks', async () => {
      // Arrange
      mockAuthFn.mockResolvedValue(createRecruiterSession())

      const request = createTestRequest('POST', {
        title: 'Test Job',
        description: XSS_PAYLOADS.polyglot,
        employmentType: 'FULL_TIME',
        workMode: 'REMOTE',
        type: 'FULL_TIME',
        seniority: 'MEDIOR',
      })

      // Act
      const response = await JobsPOST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)
      expect(data.description).not.toMatch(/javascript:/i)
      expect(data.description).not.toMatch(/onerror/i)
      expect(data.description).not.toContain('alert')

      const job = await prisma.job.findUnique({
        where: { id: data.id },
      })
      expect(job?.description).not.toMatch(/javascript:/i)
      expect(job?.description).not.toMatch(/onerror/i)
    })

    it('should handle SVG-based XSS attacks', async () => {
      // Arrange
      mockAuthFn.mockResolvedValue(createRecruiterSession())

      const svgXss = `
        <svg xmlns="http://www.w3.org/2000/svg">
          <script>alert(1)</script>
        </svg>
        ${XSS_PAYLOADS.svgOnload}
      `

      const request = createTestRequest('POST', {
        title: 'Test Job',
        description: svgXss,
        employmentType: 'FULL_TIME',
        workMode: 'REMOTE',
        type: 'FULL_TIME',
        seniority: 'MEDIOR',
      })

      // Act
      const response = await JobsPOST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)

      // SVG scripts should be sanitized
      if (data.description.includes('<svg')) {
        expect(data.description).not.toMatch(/<script[^>]*>/i)
        expect(data.description).not.toMatch(/onload/i)
      }

      const job = await prisma.job.findUnique({
        where: { id: data.id },
      })

      if (job?.description.includes('<svg')) {
        expect(job.description).not.toMatch(/<script[^>]*>/i)
      }
    })

    it('should prevent XSS in combined fields attack', async () => {
      // Arrange - Split attack across multiple fields
      mockAuthFn.mockResolvedValue(createRecruiterSession())

      const request = createTestRequest('POST', {
        title: '<script>alert',
        description: '("xss")</script>',
        employmentType: 'FULL_TIME',
        workMode: 'REMOTE',
        type: 'FULL_TIME',
        seniority: 'MEDIOR',
      })

      // Act
      const response = await JobsPOST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)

      // When combined, should not create executable script
      const combined = (data.title || '') + (data.description || '')
      expect(combined).not.toMatch(/<script[^>]*>.*<\/script>/i)

      const job = await prisma.job.findUnique({
        where: { id: data.id },
      })

      const dbCombined = (job?.title || '') + (job?.description || '')
      expect(dbCombined).not.toMatch(/<script[^>]*>.*<\/script>/i)
    })
  })

  describe('9. Context-Specific XSS Tests', () => {
    it('should sanitize organization description with HTML content', async () => {
      // Arrange
      mockAuthFn.mockResolvedValue(createOrgAdminSession())

      const org = await prisma.organization.create({
        data: {
          name: 'Test Org',
          slug: `test-org-${Date.now()}`,
        },
      })

      await prisma.userOrgRole.create({
        data: {
          userId: TEST_IDS.admin,
          orgId: org.id,
          role: 'ORG_ADMIN',
        },
      })

      const maliciousDescription = `
        We are a leading company.
        ${XSS_PAYLOADS.basicScript}
        ${XSS_PAYLOADS.imgOnerror}
        Join our team!
      `

      const request = createTestRequest('PATCH', {
        description: maliciousDescription,
      })

      // Act
      const response = await OrgPATCH(request, { params: { id: org.id } })
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(200)
      expect(data.description).not.toMatch(/<script[^>]*>/i)
      expect(data.description).not.toMatch(/onerror/i)

      // Verify database
      const updated = await prisma.organization.findUnique({
        where: { id: org.id },
      })
      expect(updated?.description).not.toMatch(/<script[^>]*>/i)

      // Cleanup
      await prisma.userOrgRole.deleteMany({ where: { orgId: org.id } })
      await prisma.organization.delete({ where: { id: org.id } })
    })

    it('should validate URL fields to prevent XSS', async () => {
      // Arrange
      mockAuthFn.mockResolvedValue(createOrgAdminSession())

      const org = await prisma.organization.create({
        data: {
          name: 'Test Org',
          slug: `test-org-${Date.now()}`,
        },
      })

      await prisma.userOrgRole.create({
        data: {
          userId: TEST_IDS.admin,
          orgId: org.id,
          role: 'ORG_ADMIN',
        },
      })

      const maliciousUrls = [
        XSS_PAYLOADS.jsProtocol,
        XSS_PAYLOADS.dataUri,
        `javascript:void(eval('${XSS_PAYLOADS.basicScript}'))`,
      ]

      for (const url of maliciousUrls) {
        const request = createTestRequest('PATCH', {
          website: url,
        })

        // Act
        const response = await OrgPATCH(request, { params: { id: org.id } })

        // Assert - should either reject or sanitize
        if (response.status === 200) {
          const data = await parseResponse(response)

          // If accepted, must not contain dangerous protocols
          if (data.website) {
            expect(data.website).not.toMatch(/javascript:/i)
            expect(data.website).not.toMatch(/data:/i)
            expect(data.website).not.toContain('eval')
          }
        } else {
          // Validation rejected - acceptable
          expect(response.status).toBe(400)
        }
      }

      // Cleanup
      await prisma.userOrgRole.deleteMany({ where: { orgId: org.id } })
      await prisma.organization.delete({ where: { id: org.id } })
    })
  })
})
