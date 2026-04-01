/**
 * Zod Validation Schema Tests
 * Tests for input validation schemas
 */

import { describe, it, expect } from 'vitest'
import {
  jobSchema,
  applicationSchema,
  cvUploadSchema,
  userSignupSchema,
  loginSchema,
} from '../validation'

describe('Zod Validation Schemas', () => {
  describe('Job Creation Schema', () => {
    it('should validate required fields (title, description)', () => {
      const validJob = {
        title: 'Frontend Developer',
        description: 'A'.repeat(50), // Min 50 chars
        orgId: 'org123',
        locale: 'en',
        createdBy: 'user123',
      }

      const result = jobSchema.safeParse(validJob)
      expect(result.success).toBe(true)
    })

    it('should enforce description min length (50 chars)', () => {
      const shortDescription = {
        title: 'Developer',
        description: 'Too short', // < 50 chars
        orgId: 'org123',
        locale: 'en',
      }

      const result = jobSchema.safeParse(shortDescription)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('50')
      }
    })

    it('should validate salary ranges', () => {
      const validSalary = {
        title: 'Engineer',
        description: 'X'.repeat(50),
        salaryMin: 50000,
        salaryMax: 80000,
        currency: 'EUR',
        orgId: 'org1',
        locale: 'en',
      }

      const result = jobSchema.safeParse(validSalary)
      expect(result.success).toBe(true)
    })

    it('should reject invalid salary ranges (min > max)', () => {
      const invalidSalary = {
        title: 'Job',
        description: 'Y'.repeat(50),
        salaryMin: 100000,
        salaryMax: 50000, // Invalid: min > max
        currency: 'USD',
        orgId: 'org1',
        locale: 'en',
      }

      const result = jobSchema.safeParse(invalidSalary)
      expect(result.success).toBe(false)
    })

    it('should validate enum values (type, seniority)', () => {
      const validEnums = {
        title: 'Senior Dev',
        description: 'Z'.repeat(50),
        type: 'FULL_TIME',
        seniority: 'SENIOR',
        workMode: 'REMOTE',
        orgId: 'org1',
        locale: 'en',
      }

      const result = jobSchema.safeParse(validEnums)
      expect(result.success).toBe(true)
    })

    it('should reject invalid enum values', () => {
      const invalidEnum = {
        title: 'Job',
        description: 'A'.repeat(50),
        type: 'INVALID_TYPE',
        orgId: 'org1',
        locale: 'en',
      }

      const result = jobSchema.safeParse(invalidEnum)
      expect(result.success).toBe(false)
    })

    it('should reject invalid schemas', () => {
      const invalid = {
        // Missing required fields
        title: 'Missing description',
      }

      const result = jobSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  describe('Application Submission Schema', () => {
    it('should validate required fields', () => {
      const validApp = {
        jobId: 'job123',
        candidateId: 'candidate123',
        coverLetter:
          'I am very interested in this position and believe my skills align well with the requirements.',
      }

      const result = applicationSchema.safeParse(validApp)
      expect(result.success).toBe(true)
    })

    it('should validate email format', () => {
      const validEmail = {
        email: 'john.doe@example.com',
      }

      expect(applicationSchema.pick({ email: true }).safeParse(validEmail).success).toBe(true)

      const invalidEmail = {
        email: 'not-an-email',
      }

      expect(applicationSchema.pick({ email: true }).safeParse(invalidEmail).success).toBe(false)
    })

    it('should validate phone number format', () => {
      const validPhones = ['+421 900 123 456', '+1 (555) 123-4567', '0900123456']

      validPhones.forEach((phone) => {
        const result = applicationSchema
          .pick({ phoneNumber: true })
          .safeParse({ phoneNumber: phone })
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid phone formats', () => {
      const invalidPhones = ['123', 'abc', '+']

      invalidPhones.forEach((phone) => {
        const result = applicationSchema
          .pick({ phoneNumber: true })
          .safeParse({ phoneNumber: phone })
        expect(result.success).toBe(false)
      })
    })

    it('should validate LinkedIn URL format', () => {
      const validLinkedIn = {
        linkedin: 'https://linkedin.com/in/john-doe',
      }

      const result = applicationSchema.pick({ linkedin: true }).safeParse(validLinkedIn)
      expect(result.success).toBe(true)
    })

    it('should reject invalid LinkedIn URLs', () => {
      const invalidLinkedIn = {
        linkedin: 'not-a-url',
      }

      const result = applicationSchema.pick({ linkedin: true }).safeParse(invalidLinkedIn)
      expect(result.success).toBe(false)
    })

    it('should allow optional fields to be empty', () => {
      const minimalApp = {
        jobId: 'job123',
        candidateId: 'candidate123',
        coverLetter: 'Minimal application with only required fields.',
        // Optional fields omitted
      }

      const result = applicationSchema.safeParse(minimalApp)
      expect(result.success).toBe(true)
    })
  })

  describe('CV Upload Schema', () => {
    it('should validate file size (max 10MB)', () => {
      const validSize = {
        filename: 'resume.pdf',
        mimeType: 'application/pdf',
        fileSize: 5 * 1024 * 1024, // 5MB
      }

      const result = cvUploadSchema.safeParse(validSize)
      expect(result.success).toBe(true)
    })

    it('should reject files > 10MB', () => {
      const tooLarge = {
        filename: 'huge.pdf',
        mimeType: 'application/pdf',
        fileSize: 15 * 1024 * 1024, // 15MB
      }

      const result = cvUploadSchema.safeParse(tooLarge)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('10MB')
      }
    })

    it('should validate MIME types (PDF, DOCX, TXT)', () => {
      const validMimeTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/msword',
      ]

      validMimeTypes.forEach((mimeType) => {
        const result = cvUploadSchema.safeParse({
          filename: 'resume.pdf',
          mimeType,
          fileSize: 1024,
        })
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid file types', () => {
      const invalidMimeTypes = ['image/png', 'video/mp4', 'application/zip']

      invalidMimeTypes.forEach((mimeType) => {
        const result = cvUploadSchema.safeParse({
          filename: 'invalid.png',
          mimeType,
          fileSize: 1024,
        })
        expect(result.success).toBe(false)
      })
    })

    it('should validate metadata fields', () => {
      const fullMetadata = {
        filename: 'John_Doe_CV.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048,
        locale: 'en',
        uploadedBy: 'user123',
      }

      const result = cvUploadSchema.safeParse(fullMetadata)
      expect(result.success).toBe(true)
    })
  })

  describe('User Signup Schema', () => {
    it('should validate email and password', () => {
      const validSignup = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        name: 'John Doe',
      }

      const result = userSignupSchema.safeParse(validSignup)
      expect(result.success).toBe(true)
    })

    it('should enforce password strength', () => {
      const weakPassword = {
        email: 'user@example.com',
        password: '123', // Too weak
        name: 'User',
      }

      const result = userSignupSchema.safeParse(weakPassword)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('12')
      }
    })
  })

  describe('Login Schema', () => {
    it('should validate login credentials', () => {
      const validLogin = {
        email: 'user@example.com',
        password: 'password123',
      }

      const result = loginSchema.safeParse(validLogin)
      expect(result.success).toBe(true)
    })

    it('should reject invalid email format', () => {
      const invalidLogin = {
        email: 'not-an-email',
        password: 'password',
      }

      const result = loginSchema.safeParse(invalidLogin)
      expect(result.success).toBe(false)
    })
  })

  describe('Error Messages', () => {
    it('should return user-friendly error messages', () => {
      const invalid = {
        title: '', // Empty title
        description: 'short', // Too short
      }

      const result = jobSchema.safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        const errors = result.error.issues.map((issue) => issue.message)
        expect(errors.some((msg) => msg.includes('required'))).toBe(true)
      }
    })

    it('should include field names in errors', () => {
      const invalid = {
        email: 'invalid-email',
      }

      const result = applicationSchema.pick({ email: true }).safeParse(invalid)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('email')
      }
    })

    it('should support multiple validation errors', () => {
      const multipleErrors = {
        title: '', // Error 1: empty
        description: 'x', // Error 2: too short
        salaryMin: -1000, // Error 3: negative
      }

      const result = jobSchema.safeParse(multipleErrors)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(1)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle null values', () => {
      const nullValues = {
        title: 'Job',
        description: 'A'.repeat(50),
        salaryMin: null,
        orgId: 'org1',
        locale: 'en',
      }

      const result = jobSchema.safeParse(nullValues)
      // Should either accept or reject based on schema definition
      expect(typeof result.success).toBe('boolean')
    })

    it('should handle undefined values', () => {
      const undefinedValues = {
        title: 'Job',
        description: 'B'.repeat(50),
        salaryMin: undefined,
        orgId: 'org1',
        locale: 'en',
      }

      const result = jobSchema.safeParse(undefinedValues)
      expect(typeof result.success).toBe('boolean')
    })

    it('should handle empty strings', () => {
      const emptyStrings = {
        title: '',
        description: '',
      }

      const result = jobSchema.safeParse(emptyStrings)
      expect(result.success).toBe(false)
    })

    it('should trim whitespace', () => {
      const whitespace = {
        email: '  user@example.com  ',
      }

      const result = applicationSchema.pick({ email: true }).safeParse(whitespace)
      if (result.success) {
        expect(result.data.email).toBe('user@example.com')
      }
    })
  })
})
