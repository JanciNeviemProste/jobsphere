import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  extractCvFromText,
  anonymizeCv,
  gradeAssessmentAnswer,
  explainMatch,
  type ExtractedCV,
} from '../src'

// Shared mock for Anthropic messages.create
const mockAnthropicCreate = vi.fn()

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: mockAnthropicCreate,
    },
  })),
}))

// Mock OpenAI (used by OpenRouter)
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  })),
}))

describe('AI Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Ensure ANTHROPIC_API_KEY is set for tests that check it
    process.env.ANTHROPIC_API_KEY = 'test-api-key'
  })

  describe('extractCvFromText', () => {
    it('should extract structured data from CV text', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              personal: {
                fullName: 'John Doe',
                email: 'john@example.com',
                phone: '+1234567890',
                location: 'Bratislava, Slovakia',
              },
              summary: 'Experienced software developer',
              experiences: [
                {
                  title: 'Senior Developer',
                  company: 'Tech Corp',
                  location: 'Bratislava',
                  startDate: '2020-01',
                  endDate: null,
                  current: true,
                  description: 'Building scalable applications',
                  achievements: ['Improved performance by 50%'],
                },
              ],
              education: [
                {
                  degree: 'Bachelor',
                  institution: 'Slovak University',
                  location: 'Bratislava',
                  startDate: '2015-09',
                  endDate: '2019-06',
                },
              ],
              skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
              languages: [
                {
                  name: 'English',
                  level: 'FLUENT',
                },
                {
                  name: 'Slovak',
                  level: 'NATIVE',
                },
              ],
              certifications: [],
              projects: [],
            }),
          },
        ],
      })

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

      const result = await extractCvFromText(rawText, {
        apiKey: 'test-api-key',
        locale: 'en',
      })

      expect(result).toBeDefined()
      expect(result.personal?.fullName).toBe('John Doe')
      expect(result.personal?.email).toBe('john@example.com')
      expect(result.experiences).toHaveLength(1)
      expect(result.experiences[0]?.title).toBe('Senior Developer')
      expect(result.skills).toContain('JavaScript')
      expect(result.languages).toHaveLength(2)
    })

    it('should handle missing optional fields', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [
          {
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
          },
        ],
      })

      const result = await extractCvFromText('Minimal CV', {
        apiKey: 'test-api-key',
        locale: 'en',
      })

      expect(result).toBeDefined()
      expect(result.experiences).toHaveLength(0)
      expect(result.skills).toHaveLength(1)
    })
  })

  describe('anonymizeCv', () => {
    it('should remove PII from CV', () => {
      const cv: ExtractedCV = {
        personal: {
          fullName: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          location: 'Bratislava, Slovakia',
        },
        summary: 'Experienced developer',
        experiences: [
          {
            title: 'Developer',
            company: 'Tech Corp',
            location: 'Bratislava',
            current: true,
            description: 'Building apps',
            achievements: [],
          },
        ],
        education: [
          {
            degree: 'Bachelor',
            institution: 'Slovak University',
          },
        ],
        skills: ['JavaScript'],
        languages: [],
        certifications: [],
        projects: [],
      }

      const anonymized = anonymizeCv(cv)

      expect(anonymized.personal?.fullName).toBe('REDACTED')
      expect(anonymized.personal?.email).toBe('REDACTED')
      expect(anonymized.personal?.phone).toBe('REDACTED')
      // Location is preserved in the source implementation
      expect(anonymized.personal?.location).toBe('Bratislava, Slovakia')
      // Company is preserved in the source implementation
      expect(anonymized.experiences[0]?.company).toBe('Tech Corp')
      // Institution is preserved in the source implementation
      expect(anonymized.education[0]?.institution).toBe('Slovak University')
    })
  })

  describe('gradeAssessmentAnswer', () => {
    it('should grade answer with AI', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              score: 8,
              rationale: 'Good answer with clear explanation',
            }),
          },
        ],
      })

      const question = 'Explain the difference between var and let in JavaScript'
      const answer = 'var is function-scoped while let is block-scoped'

      const result = await gradeAssessmentAnswer(question, answer, null, 10)

      expect(result.score).toBe(8)
      expect(result.rationale).toBeDefined()
    })

    it('should return 0 for incorrect answer', async () => {
      mockAnthropicCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              score: 0,
              rationale: 'Answer is incorrect',
            }),
          },
        ],
      })

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

      expect(explanations).toHaveLength(5)
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
