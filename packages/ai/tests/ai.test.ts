import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  extractCV,
  computeMatchPercent,
  summarizeCV,
  anonymizeCV,
  gradeAssessmentAnswer,
  explainMatch,
  type ExtractedCV,
} from '../src'

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}))

describe('AI Layer', () => {
  describe('extractCV', () => {
    it('should extract structured data from CV text', async () => {
      // Mock response from Claude
      const mockResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            personal: {
              name: 'John Doe',
              email: 'john@example.com',
              phone: '+1234567890',
              location: 'Bratislava, Slovakia',
              summary: 'Experienced software developer',
            },
            experiences: [{
              title: 'Senior Developer',
              company: 'Tech Corp',
              location: 'Bratislava',
              startDate: '2020-01',
              endDate: null,
              current: true,
              description: 'Building scalable applications',
              achievements: ['Improved performance by 50%'],
            }],
            education: [{
              degree: 'Bachelor',
              field: 'Computer Science',
              institution: 'Slovak University',
              location: 'Bratislava',
              startDate: '2015-09',
              endDate: '2019-06',
            }],
            skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
            languages: [{
              language: 'English',
              proficiency: 'Fluent',
            }, {
              language: 'Slovak',
              proficiency: 'Native',
            }],
            certifications: [],
            projects: [],
          }),
        }],
      }

      const Anthropic = await import('@anthropic-ai/sdk')
      const mockCreate = Anthropic.default.prototype.messages.create as any
      mockCreate.mockResolvedValue(mockResponse)

      const rawText = `
        John Doe
        john@example.com
        +1234567890
        Bratislava, Slovakia

        Senior Developer at Tech Corp (2020 - Present)
        - Building scalable applications
        - Improved performance by 50%

        Education:
        Bachelor in Computer Science, Slovak University (2015-2019)

        Skills: JavaScript, TypeScript, React, Node.js
        Languages: English (Fluent), Slovak (Native)
      `

      const result = await extractCV(rawText, 'en')

      expect(result).toBeDefined()
      expect(result.personal?.name).toBe('John Doe')
      expect(result.personal?.email).toBe('john@example.com')
      expect(result.experiences).toHaveLength(1)
      expect(result.experiences[0]?.title).toBe('Senior Developer')
      expect(result.skills).toContain('JavaScript')
      expect(result.languages).toHaveLength(2)
    })

    it('should handle missing optional fields', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            personal: {},
            experiences: [],
            education: [],
            skills: ['Python'],
            languages: [],
            certifications: [],
            projects: [],
          }),
        }],
      }

      const Anthropic = await import('@anthropic-ai/sdk')
      const mockCreate = Anthropic.default.prototype.messages.create as any
      mockCreate.mockResolvedValue(mockResponse)

      const result = await extractCV('Minimal CV', 'en')

      expect(result).toBeDefined()
      expect(result.experiences).toHaveLength(0)
      expect(result.skills).toHaveLength(1)
    })
  })

  describe('computeMatchPercent', () => {
    it('should compute match score between job and resume', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            score: 85,
            breakdown: {
              skills: 90,
              experience: 85,
              education: 80,
              location: 85,
            },
            matchedSkills: ['JavaScript', 'React', 'Node.js'],
            missingSkills: ['Python'],
            strengths: ['Strong frontend skills', '5 years of relevant experience'],
            gaps: ['No Python experience'],
            recommendation: 'hire',
          }),
        }],
      }

      const Anthropic = await import('@anthropic-ai/sdk')
      const mockCreate = Anthropic.default.prototype.messages.create as any
      mockCreate.mockResolvedValue(mockResponse)

      const job = {
        title: 'Senior Full Stack Developer',
        description: 'We are looking for an experienced developer',
        requirements: 'JavaScript, React, Node.js, Python',
        skills: ['JavaScript', 'React', 'Node.js', 'Python'],
      }

      const resumeText = 'Experienced developer with JavaScript, React, and Node.js'

      const result = await computeMatchPercent(job, resumeText, 'en')

      expect(result.percent).toBe(85)
      expect(result.evidence.matchedSkills).toContain('JavaScript')
      expect(result.evidence.recommendation).toBe('hire')
    })

    it('should return 0 for no match', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            score: 0,
            breakdown: { skills: 0, experience: 0, education: 0, location: 0 },
            matchedSkills: [],
            missingSkills: ['JavaScript', 'React'],
            strengths: [],
            gaps: ['No relevant experience'],
            recommendation: 'no',
          }),
        }],
      }

      const Anthropic = await import('@anthropic-ai/sdk')
      const mockCreate = Anthropic.default.prototype.messages.create as any
      mockCreate.mockResolvedValue(mockResponse)

      const job = {
        title: 'Developer',
        description: 'JavaScript developer',
        requirements: 'JavaScript, React',
        skills: ['JavaScript', 'React'],
      }

      const result = await computeMatchPercent(job, 'Marketing professional', 'en')

      expect(result.percent).toBe(0)
    })

    it('should clamp score between 0-100', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            score: 150, // Invalid score
            breakdown: {},
            matchedSkills: [],
            missingSkills: [],
            strengths: [],
            gaps: [],
            recommendation: 'hire',
          }),
        }],
      }

      const Anthropic = await import('@anthropic-ai/sdk')
      const mockCreate = Anthropic.default.prototype.messages.create as any
      mockCreate.mockResolvedValue(mockResponse)

      const job = {
        title: 'Developer',
        description: 'Test',
        requirements: 'Test',
      }

      const result = await computeMatchPercent(job, 'Test', 'en')

      expect(result.percent).toBeLessThanOrEqual(100)
      expect(result.percent).toBeGreaterThanOrEqual(0)
    })
  })

  describe('anonymizeCV', () => {
    it('should remove PII from CV', async () => {
      const cv: ExtractedCV = {
        personal: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          location: 'Bratislava, Slovakia',
          summary: 'Experienced developer',
        },
        experiences: [{
          title: 'Developer',
          company: 'Tech Corp',
          location: 'Bratislava',
          current: true,
          description: 'Building apps',
          achievements: [],
        }],
        education: [{
          degree: 'Bachelor',
          field: 'CS',
          institution: 'Slovak University',
        }],
        skills: ['JavaScript'],
        languages: [],
        certifications: [],
        projects: [],
      }

      const anonymized = await anonymizeCV(cv)

      expect(anonymized.personal?.name).toBe('[REDACTED]')
      expect(anonymized.personal?.email).toBe('[REDACTED]')
      expect(anonymized.personal?.phone).toBe('[REDACTED]')
      expect(anonymized.personal?.location).toBe('Slovakia') // Keep country only
      expect(anonymized.experiences[0]?.company).toContain('[Company in')
      expect(anonymized.education[0]?.institution).toBe('[University]')
    })
  })

  describe('gradeAssessmentAnswer', () => {
    it('should grade answer with AI', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            score: 8,
            rationale: 'Good answer with clear explanation',
          }),
        }],
      }

      const Anthropic = await import('@anthropic-ai/sdk')
      const mockCreate = Anthropic.default.prototype.messages.create as any
      mockCreate.mockResolvedValue(mockResponse)

      const question = 'Explain the difference between var and let in JavaScript'
      const answer = 'var is function-scoped while let is block-scoped'

      const result = await gradeAssessmentAnswer(question, answer, null, 10)

      expect(result.score).toBe(8)
      expect(result.rationale).toBeDefined()
    })

    it('should return 0 for incorrect answer', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            score: 0,
            rationale: 'Answer is incorrect',
          }),
        }],
      }

      const Anthropic = await import('@anthropic-ai/sdk')
      const mockCreate = Anthropic.default.prototype.messages.create as any
      mockCreate.mockResolvedValue(mockResponse)

      const question = 'What is 2+2?'
      const answer = '5'

      const result = await gradeAssessmentAnswer(question, answer, null, 10)

      expect(result.score).toBe(0)
    })
  })

  describe('explainMatch', () => {
    it('should generate human-readable explanations', () => {
      const evidence = {
        matchedSkills: ['JavaScript', 'React'],
        strengths: ['5 years experience', 'Strong portfolio'],
        recommendation: 'hire',
        gaps: ['No Python experience'],
      }

      const explanations = explainMatch(evidence, 'en')

      expect(explanations).toHaveLength(4)
      expect(explanations[0]).toContain('Matched skills')
      expect(explanations).toContain('5 years experience')
      expect(explanations).toContain('Strong candidate - recommend for interview')
    })

    it('should handle minimal evidence', () => {
      const evidence = {
        recommendation: 'maybe',
      }

      const explanations = explainMatch(evidence, 'en')

      expect(explanations).toHaveLength(1)
      expect(explanations[0]).toBe('Potential fit - worth considering')
    })
  })
})