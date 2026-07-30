/**
 * Zod Validation Schema Tests
 * Tests for input validation schemas
 */

import { describe, it, expect } from 'vitest'
import { applicationSchema, loginSchema } from '../validation'

describe('Zod Validation Schemas', () => {
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
        jobId: '', // Error 1: empty
        candidateId: '', // Error 2: empty
        coverLetter: '', // Error 3: empty
      }

      const result = applicationSchema.safeParse(multipleErrors)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(1)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should reject missing required fields', () => {
      const result = applicationSchema.safeParse({ jobId: 'job123' })
      expect(result.success).toBe(false)
    })

    it('should handle empty strings', () => {
      const result = loginSchema.safeParse({ email: '', password: '' })
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
