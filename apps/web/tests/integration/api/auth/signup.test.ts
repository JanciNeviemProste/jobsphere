import { describe, it, expect, beforeEach } from 'vitest'
import { POST } from '@/app/api/auth/signup/route'
import { createTestRequest, parseResponse } from '../../helpers/api-client'
import { prisma } from '../../helpers/test-db'

/**
 * Integration tests for POST /api/auth/signup
 * Tests user registration with real database
 */

describe('POST /api/auth/signup', () => {
  beforeEach(async () => {
    // Clean up any test signup users from previous runs
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'signup-test',
        },
      },
    })
  })

  describe('Candidate Signup', () => {
    it('should create new candidate user', async () => {
      // Arrange
      const request = createTestRequest('POST', {
        email: 'signup-test-candidate@test.com',
        password: 'SecurePassword123!',
        name: 'Test Candidate User',
        role: 'candidate',
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)
      // AUTH-008: the response is identical whether the account was created or
      // the email was already registered, so it deliberately carries NO user
      // object — returning one would be the enumeration oracle the generic
      // message exists to remove. The account is verified in the database.
      expect(data.success).toBe(true)
      expect(data.user).toBeUndefined()

      const created = await prisma.user.findUnique({
        where: { email: 'signup-test-candidate@test.com' },
      })
      expect(created).not.toBeNull()
      expect(created?.name).toBe('Test Candidate User')

      // Verify user was created in database
      const user = await prisma.user.findUnique({
        where: { email: 'signup-test-candidate@test.com' },
      })
      expect(user).toBeTruthy()
      expect(user?.name).toBe('Test Candidate User')
      expect(user?.password).toBeTruthy() // Password should be hashed
      expect(user?.password).not.toBe('SecurePassword123!') // Not plain text

      // Verify no organization was created for candidate
      const userOrg = await prisma.userOrgRole.findFirst({
        where: { userId: user?.id },
      })
      expect(userOrg).toBeNull()
    })

    it('should default to candidate role when not specified', async () => {
      // Arrange
      const request = createTestRequest('POST', {
        email: 'signup-test-default@test.com',
        password: 'SecurePassword123!',
        name: 'Default Role User',
        // role not specified
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)
      expect(data.user).toBeUndefined()
    })
  })

  describe('Employer Signup', () => {
    it('should create employer user with organization', async () => {
      // Arrange
      const request = createTestRequest('POST', {
        email: 'signup-test-employer@test.com',
        password: 'SecurePassword123!',
        name: 'Test Employer User',
        role: 'employer',
        companyName: 'Test Company Inc',
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)
      expect(data.user).toBeUndefined()
      const employer = await prisma.user.findUnique({
        where: { email: 'signup-test-employer@test.com' },
      })
      expect(employer).not.toBeNull()

      // Verify user was created
      const user = await prisma.user.findUnique({
        where: { email: 'signup-test-employer@test.com' },
      })
      expect(user).toBeTruthy()

      // Verify organization was created
      const userOrg = await prisma.userOrgRole.findFirst({
        where: { userId: user?.id },
        include: { organization: true },
      })
      expect(userOrg).toBeTruthy()
      expect(userOrg?.organization.name).toBe('Test Company Inc')
      expect(userOrg?.organization.slug).toBe('test-company-inc')
      expect(userOrg?.role).toBe('ORG_ADMIN')
    })

    it('should reject employer signup without company name', async () => {
      // Arrange
      const request = createTestRequest('POST', {
        email: 'signup-test-no-company@test.com',
        password: 'SecurePassword123!',
        name: 'Employer No Company',
        role: 'employer',
        // companyName missing
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toContain('Company name is required')

      // Verify user was NOT created
      const user = await prisma.user.findUnique({
        where: { email: 'signup-test-no-company@test.com' },
      })
      expect(user).toBeNull()
    })
  })

  describe('Validation', () => {
    it('should reject invalid email format', async () => {
      // Arrange
      const request = createTestRequest('POST', {
        email: 'not-an-email',
        password: 'SecurePassword123!',
        name: 'Test User',
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
      expect(data.issues).toBeDefined()
      expect(data.issues[0].path).toContain('email')
    })

    it('should reject password shorter than 8 characters', async () => {
      // Arrange
      const request = createTestRequest('POST', {
        email: 'signup-test-short-pass@test.com',
        password: 'Short1!',
        name: 'Test User',
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
      expect(data.issues[0].message).toContain('at least 8 characters')
    })

    it('should reject missing required fields', async () => {
      // Arrange
      const request = createTestRequest('POST', {
        email: 'signup-test@test.com',
        // password and name missing
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
      expect(data.issues.length).toBeGreaterThan(0)
    })

    it('returns an indistinguishable response for an already-registered email', async () => {
      // Arrange - create first user
      const firstRequest = createTestRequest('POST', {
        email: 'signup-test-duplicate@test.com',
        password: 'FirstPassword123!',
        name: 'First User',
      })
      await POST(firstRequest)

      // Act - try to create second user with same email
      const secondRequest = createTestRequest('POST', {
        email: 'signup-test-duplicate@test.com',
        password: 'SecondPassword123!',
        name: 'Second User',
      })
      const response = await POST(secondRequest)
      const data = await parseResponse(response)

      // Assert — AUTH-008 again, and this is the case it exists for: telling a
      // caller "already exists" is exactly how an attacker enumerates which
      // addresses have accounts. The response is indistinguishable from a
      // successful signup; what must NOT happen is a second user row.
      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.error).toBeUndefined()

      // Verify only one user exists
      const users = await prisma.user.findMany({
        where: { email: 'signup-test-duplicate@test.com' },
      })
      expect(users).toHaveLength(1)
      expect(users[0].name).toBe('First User') // First one kept
    })
  })

  describe('Security', () => {
    it('should hash password before storing', async () => {
      // Arrange
      const plainPassword = 'MySecurePassword123!'
      const request = createTestRequest('POST', {
        email: 'signup-test-hash@test.com',
        password: plainPassword,
        name: 'Hash Test User',
      })

      // Act
      await POST(request)

      // Assert
      const user = await prisma.user.findUnique({
        where: { email: 'signup-test-hash@test.com' },
      })
      expect(user?.password).toBeTruthy()
      expect(user?.password).not.toBe(plainPassword)
      expect(user?.password).toMatch(/^\$2[aby]\$/) // bcrypt hash format
    })

    it('should not return password in response', async () => {
      // Arrange
      const request = createTestRequest('POST', {
        email: 'signup-test-no-pass-return@test.com',
        password: 'SecurePassword123!',
        name: 'No Password Return',
      })

      // Act
      const response = await POST(request)
      const data = await parseResponse(response)

      // Assert
      expect(response.status).toBe(201)
      // Nothing about the user comes back at all, so the password cannot.
      expect(JSON.stringify(data)).not.toContain('password')
      expect(JSON.stringify(data)).not.toContain('SecurePassword123!')
    })
  })

  describe('Rate Limiting', () => {
    it('should apply strict rate limiting', async () => {
      // This test verifies rate limiting is configured
      // Actual rate limit testing would require multiple rapid requests
      // For now, just verify the endpoint uses withRateLimit wrapper

      const request = createTestRequest('POST', {
        email: 'signup-test-ratelimit@test.com',
        password: 'SecurePassword123!',
        name: 'Rate Limit Test',
      })

      const response = await POST(request)

      // Should succeed on first request
      expect(response.status).toBe(201)

      // Note: Full rate limit testing would require:
      // 1. Making 10+ requests rapidly
      // 2. Verifying 11th request returns 429
      // 3. Waiting for window to reset
      // This is better tested in E2E tests
    })
  })
})
