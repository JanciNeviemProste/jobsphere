/**
 * AI Job Matching Tests
 * Tests for match score calculation algorithm
 *
 * Note: These tests exercise the fallback scoring path since the Anthropic
 * API is mocked to reject. The fallback uses rule-based scoring from
 * resume sections and job descriptions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateMatchScore } from '../ai-matching'

// Mock Prisma - ai-matching.ts imports from './prisma'
vi.mock('../prisma', () => ({
  prisma: {
    resume: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    job: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    application: {
      findMany: vi.fn(),
    },
  },
}))

// Mock Anthropic SDK so AI calls fail and trigger fallback scoring
vi.mock('@anthropic-ai/sdk', () => ({
  Anthropic: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockRejectedValue(new Error('API key not configured')),
    },
  })),
}))

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Helper to create mock resume with sections
function createMockResume(overrides: any = {}) {
  return {
    id: overrides.id || 'resume1',
    candidateId: overrides.candidateId || 'candidate1',
    sections: overrides.sections || [],
    candidate: overrides.candidate || { id: 'candidate1' },
    ...overrides,
  }
}

// Helper to create mock job
function createMockJob(overrides: any = {}) {
  return {
    id: overrides.id || 'job1',
    title: overrides.title || 'Developer',
    description: overrides.description || '',
    employmentType: overrides.employmentType || 'FULL_TIME',
    seniority: overrides.seniority || 'MID',
    city: overrides.city || null,
    region: overrides.region || null,
    remote: overrides.remote || false,
    hybrid: overrides.hybrid || false,
    salaryMin: overrides.salaryMin || null,
    salaryMax: overrides.salaryMax || null,
    orgId: overrides.orgId || 'org1',
    organization: overrides.organization || { name: 'Test Corp' },
    ...overrides,
  }
}

describe(
  'AI Job Matching',
  () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    describe('Match Score Calculation', () => {
      it('should return score 0-100', async () => {
        const { prisma } = await import('../prisma')

        vi.mocked(prisma.resume.findUnique).mockResolvedValue(
          createMockResume({
            id: 'resume1',
            sections: [{ kind: 'skills', text: 'JavaScript, TypeScript, React', bullets: [] }],
          }) as any,
        )

        vi.mocked(prisma.job.findUnique).mockResolvedValue(
          createMockJob({
            id: 'job1',
            title: 'Frontend Developer',
            description: 'Looking for a React and TypeScript developer',
          }) as any,
        )

        const score = await calculateMatchScore('resume1', 'job1')

        expect(score.overall).toBeGreaterThanOrEqual(0)
        expect(score.overall).toBeLessThanOrEqual(100)
      })

      it('should return score properties', async () => {
        const { prisma } = await import('../prisma')

        vi.mocked(prisma.resume.findUnique).mockResolvedValue(
          createMockResume({
            id: 'resume2',
            sections: [
              { kind: 'skills', text: 'Java, Spring, Microservices', bullets: [] },
              {
                kind: 'experience',
                title: 'Backend Dev',
                organization: 'Corp',
                startDate: '2020-01',
                endDate: null,
                current: true,
                text: '10 years Java',
                bullets: [],
              },
            ],
          }) as any,
        )

        vi.mocked(prisma.job.findUnique).mockResolvedValue(
          createMockJob({
            id: 'job2',
            title: 'Java Backend Engineer',
            description: 'Java, Spring Boot, 5+ years experience required',
          }) as any,
        )

        const score = await calculateMatchScore('resume2', 'job2')

        expect(score).toHaveProperty('skills')
        expect(score).toHaveProperty('experience')
        expect(score).toHaveProperty('education')
        expect(score).toHaveProperty('overall')
      })

      it('should score higher with skills match', async () => {
        const { prisma } = await import('../prisma')

        vi.mocked(prisma.resume.findUnique).mockResolvedValue(
          createMockResume({
            id: 'resume3',
            sections: [{ kind: 'skills', text: 'python, django, postgresql, docker', bullets: [] }],
          }) as any,
        )

        vi.mocked(prisma.job.findUnique).mockResolvedValue(
          createMockJob({
            id: 'job3',
            description: 'python, django, postgresql required',
          }) as any,
        )

        const score = await calculateMatchScore('resume3', 'job3')

        expect(score.skills).toBeGreaterThan(50)
      })

      it('should factor in experience presence', async () => {
        const { prisma } = await import('../prisma')

        vi.mocked(prisma.resume.findUnique).mockResolvedValue(
          createMockResume({
            id: 'resume4',
            sections: [
              { kind: 'skills', text: 'C++, Linux', bullets: [] },
              {
                kind: 'experience',
                title: 'C++ Dev',
                organization: 'Corp',
                startDate: '2017-01',
                endDate: null,
                current: true,
                text: '8 years software engineering',
                bullets: [],
              },
            ],
          }) as any,
        )

        vi.mocked(prisma.job.findUnique).mockResolvedValue(
          createMockJob({
            id: 'job4',
            title: 'Senior C++ Developer',
            description: '5+ years experience, C++, Linux',
            seniority: 'SENIOR',
          }) as any,
        )

        const score = await calculateMatchScore('resume4', 'job4')

        // With experience section present, experience score should be 75
        expect(score.experience).toBe(75)
      })

      it('should include education score', async () => {
        const { prisma } = await import('../prisma')

        vi.mocked(prisma.resume.findUnique).mockResolvedValue(
          createMockResume({
            id: 'resume5',
            sections: [
              {
                kind: 'education',
                title: 'PhD Computer Science',
                organization: 'MIT',
                startDate: '2010',
                endDate: '2015',
                text: 'PhD Computer Science, MIT',
                bullets: [],
              },
            ],
          }) as any,
        )

        vi.mocked(prisma.job.findUnique).mockResolvedValue(
          createMockJob({
            id: 'job5',
            description: 'MSc or PhD in Computer Science preferred',
          }) as any,
        )

        const score = await calculateMatchScore('resume5', 'job5')

        // With education section present, education score should be 75
        expect(score.education).toBe(75)
      })
    })

    describe('Match Details', () => {
      it('should return breakdown of scores', async () => {
        const { prisma } = await import('../prisma')

        vi.mocked(prisma.resume.findUnique).mockResolvedValue(
          createMockResume({
            id: 'resume11',
            sections: [{ kind: 'skills', text: 'python', bullets: [] }],
          }) as any,
        )

        vi.mocked(prisma.job.findUnique).mockResolvedValue(
          createMockJob({
            id: 'job11',
            description: 'python developer needed',
          }) as any,
        )

        const score = await calculateMatchScore('resume11', 'job11')

        expect(score).toHaveProperty('skills')
        expect(score).toHaveProperty('experience')
        expect(score).toHaveProperty('education')
        expect(score).toHaveProperty('overall')
        expect(score).toHaveProperty('details')
      })

      it('should have details object with matched skills', async () => {
        const { prisma } = await import('../prisma')

        vi.mocked(prisma.resume.findUnique).mockResolvedValue(
          createMockResume({
            id: 'resume12',
            sections: [{ kind: 'skills', text: 'go, kubernetes, aws', bullets: [] }],
          }) as any,
        )

        vi.mocked(prisma.job.findUnique).mockResolvedValue(
          createMockJob({
            id: 'job12',
            description: 'go, kubernetes developer',
          }) as any,
        )

        const score = await calculateMatchScore('resume12', 'job12')

        expect(score.details).toBeDefined()
        expect(score.details.matchedSkills).toBeDefined()
        expect(Array.isArray(score.details.matchedSkills)).toBe(true)
      })
    })

    describe('Edge Cases', () => {
      it('should handle missing resume data', async () => {
        const { prisma } = await import('../prisma')

        // Both findUnique calls return null - first for AI path, then for fallback
        vi.mocked(prisma.resume.findUnique).mockResolvedValue(null)

        await expect(calculateMatchScore('missing', 'job1')).rejects.toThrow()
      })

      it('should handle resume with no skills sections', async () => {
        const { prisma } = await import('../prisma')

        vi.mocked(prisma.resume.findUnique).mockResolvedValue(
          createMockResume({
            id: 'resume15',
            sections: [],
          }) as any,
        )

        vi.mocked(prisma.job.findUnique).mockResolvedValue(
          createMockJob({
            id: 'job15',
            description: 'any developer',
          }) as any,
        )

        const score = await calculateMatchScore('resume15', 'job15')

        expect(score.overall).toBeGreaterThanOrEqual(0)
      })

      it('should handle job with empty description', async () => {
        const { prisma } = await import('../prisma')

        vi.mocked(prisma.resume.findUnique).mockResolvedValue(
          createMockResume({
            id: 'resume16',
            sections: [{ kind: 'skills', text: 'art, design, photoshop', bullets: [] }],
          }) as any,
        )

        vi.mocked(prisma.job.findUnique).mockResolvedValue(
          createMockJob({
            id: 'job16',
            title: 'Senior Blockchain Developer',
            description: '',
          }) as any,
        )

        const score = await calculateMatchScore('resume16', 'job16')

        expect(score.overall).toBeGreaterThanOrEqual(0)
        expect(score.overall).toBeLessThanOrEqual(100)
      })
    })
  },
  { timeout: 10000 },
)
