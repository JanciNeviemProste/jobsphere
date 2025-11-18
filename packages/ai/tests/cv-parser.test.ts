/**
 * CV Parser Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { anonymizeCv } from '../src/cv-parser'
import type { ExtractedCV } from '../src/types'

describe('CV Parser', () => {
  describe('anonymizeCv', () => {
    it('should redact personal information', () => {
      const cv: ExtractedCV = {
        personal: {
          fullName: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          location: 'New York, USA',
          linkedIn: 'linkedin.com/in/johndoe',
          github: 'github.com/johndoe',
        },
        summary: 'Software engineer with 5 years experience',
        experiences: [
          {
            title: 'Senior Developer',
            company: 'Tech Corp',
            location: 'San Francisco',
            startDate: '2020-01',
            endDate: '2023-12',
            current: false,
            description: 'Built web applications',
          },
        ],
        education: [
          {
            degree: 'Bachelor of Computer Science',
            institution: 'MIT',
            location: 'Cambridge',
            startDate: '2015-09',
            endDate: '2019-06',
          },
        ],
        skills: ['JavaScript', 'TypeScript', 'React'],
      }

      const anonymized = anonymizeCv(cv)

      expect(anonymized.personal?.fullName).toBe('REDACTED')
      expect(anonymized.personal?.email).toBe('REDACTED')
      expect(anonymized.personal?.phone).toBe('REDACTED')
      expect(anonymized.personal?.location).toBe('New York, USA') // Location preserved
      expect(anonymized.personal?.linkedIn).toBeUndefined()
      expect(anonymized.personal?.github).toBeUndefined()
    })

    it('should preserve non-PII data', () => {
      const cv: ExtractedCV = {
        experiences: [
          {
            title: 'Developer',
            company: 'Acme Inc',
          },
        ],
        education: [
          {
            degree: 'BSc',
            institution: 'University',
          },
        ],
        skills: ['Python', 'Django'],
      }

      const anonymized = anonymizeCv(cv)

      expect(anonymized.experiences[0].title).toBe('Developer')
      expect(anonymized.experiences[0].company).toBe('Acme Inc')
      expect(anonymized.skills).toEqual(['Python', 'Django'])
    })

    it('should handle missing personal data', () => {
      const cv: ExtractedCV = {
        experiences: [],
        education: [],
        skills: [],
      }

      const anonymized = anonymizeCv(cv)

      expect(anonymized.personal?.fullName).toBe('REDACTED')
      expect(anonymized.personal?.email).toBe('REDACTED')
    })
  })
})
