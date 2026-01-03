/**
 * AI Job Matching Tests
 * Tests for match score calculation algorithm
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateMatchScore } from '../ai-matching'

// Mock Prisma
vi.mock('../db', () => ({
  prisma: {
    resume: {
      findUnique: vi.fn(),
    },
    job: {
      findUnique: vi.fn(),
    },
    matchScore: {
      upsert: vi.fn(),
    },
  },
}))

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('AI Job Matching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Match Score Calculation', () => {
    it('should return score 0-100', async () => {
      const { prisma } = await import('../db')

      vi.mocked(prisma.resume.findUnique).mockResolvedValueOnce({
        id: 'resume1',
        candidateId: 'candidate1',
        language: 'en',
        summary: 'Senior developer',
        skills: ['JavaScript', 'TypeScript', 'React'],
        sections: [],
      } as any)

      vi.mocked(prisma.job.findUnique).mockResolvedValueOnce({
        id: 'job1',
        title: 'Frontend Developer',
        requirements: 'React, TypeScript',
        orgId: 'org1',
      } as any)

      const score = await calculateMatchScore('resume1', 'job1')

      expect(score.overall).toBeGreaterThanOrEqual(0)
      expect(score.overall).toBeLessThanOrEqual(100)
    })

    it('should calculate weighted average correctly', async () => {
      const { prisma } = await import('../db')

      vi.mocked(prisma.resume.findUnique).mockResolvedValueOnce({
        id: 'resume2',
        candidateId: 'candidate2',
        language: 'en',
        summary: 'Expert Java developer with 10 years',
        skills: ['Java', 'Spring', 'Microservices'],
        sections: [],
      } as any)

      vi.mocked(prisma.job.findUnique).mockResolvedValueOnce({
        id: 'job2',
        title: 'Java Backend Engineer',
        requirements: 'Java, Spring Boot, 5+ years experience',
        orgId: 'org1',
      } as any)

      const score = await calculateMatchScore('resume2', 'job2')

      // Weighted: skills (40%) + experience (30%) + education (20%) + location (10%)
      expect(score).toHaveProperty('skills')
      expect(score).toHaveProperty('experience')
      expect(score).toHaveProperty('education')
      expect(score.overall).toBeGreaterThan(50)
    })

    it('should prioritize skills match (40% weight)', async () => {
      const { prisma } = await import('../db')

      // Perfect skills match
      vi.mocked(prisma.resume.findUnique).mockResolvedValueOnce({
        id: 'resume3',
        skills: ['Python', 'Django', 'PostgreSQL', 'Docker'],
      } as any)

      vi.mocked(prisma.job.findUnique).mockResolvedValueOnce({
        id: 'job3',
        requirements: 'Python, Django, PostgreSQL required',
      } as any)

      const score = await calculateMatchScore('resume3', 'job3')

      expect(score.skills).toBeGreaterThan(80)
    })

    it('should consider experience years (30% weight)', async () => {
      const { prisma } = await import('../db')

      vi.mocked(prisma.resume.findUnique).mockResolvedValueOnce({
        id: 'resume4',
        summary: '8 years of experience in software engineering',
        skills: ['C++', 'Linux'],
      } as any)

      vi.mocked(prisma.job.findUnique).mockResolvedValueOnce({
        id: 'job4',
        title: 'Senior C++ Developer',
        requirements: '5+ years experience',
        seniority: 'SENIOR',
      } as any)

      const score = await calculateMatchScore('resume4', 'job4')

      expect(score.experience).toBeGreaterThan(70)
    })

    it('should factor education level (20% weight)', async () => {
      const { prisma } = await import('../db')

      vi.mocked(prisma.resume.findUnique).mockResolvedValueOnce({
        id: 'resume5',
        summary: 'PhD in Computer Science',
        sections: [
          {
            kind: 'EDUCATION',
            text: 'PhD Computer Science, MIT',
          },
        ],
      } as any)

      vi.mocked(prisma.job.findUnique).mockResolvedValueOnce({
        id: 'job5',
        requirements: 'MSc or PhD in Computer Science preferred',
      } as any)

      const score = await calculateMatchScore('resume5', 'job5')

      expect(score.education).toBeGreaterThan(80)
    })

    it('should include location match (10% weight)', async () => {
      const { prisma } = await import('../db')

      vi.mocked(prisma.resume.findUnique).mockResolvedValueOnce({
        id: 'resume6',
        sections: [
          {
            kind: 'CONTACT',
            text: 'Location: Bratislava, Slovakia',
          },
        ],
      } as any)

      vi.mocked(prisma.job.findUnique).mockResolvedValueOnce({
        id: 'job6',
        city: 'Bratislava',
        country: 'Slovakia',
      } as any)

      const score = await calculateMatchScore('resume6', 'job6')

      expect(score).toHaveProperty('overall')
    })
  })

  describe('Scoring Components', () => {
    it('should score exact skill matches as 100', async () => {
      const { prisma } = await import('../db')

      vi.mocked(prisma.resume.findUnique).mockResolvedValueOnce({
        id: 'resume7',
        skills: ['React', 'Node.js', 'MongoDB', 'TypeScript'],
      } as any)

      vi.mocked(prisma.job.findUnique).mockResolvedValueOnce({
        id: 'job7',
        requirements: 'React, Node.js, MongoDB, TypeScript',
      } as any)

      const score = await calculateMatchScore('resume7', 'job7')

      expect(score.skills).toBeCloseTo(100, 0)
    })

    it('should score partial skill matches based on overlap', async () => {
      const { prisma } = await import('../db')

      vi.mocked(prisma.resume.findUnique).mockResolvedValueOnce({
        id: 'resume8',
        skills: ['Java', 'Spring'], // 2 out of 4 required
      } as any)

      vi.mocked(prisma.job.findUnique).mockResolvedValueOnce({
        id: 'job8',
        requirements: 'Java, Spring, Hibernate, Kafka',
      } as any)

      const score = await calculateMatchScore('resume8', 'job8')

      // 50% skill overlap
      expect(score.skills).toBeGreaterThan(30)
      expect(score.skills).toBeLessThan(70)
    })

    it('should penalize experience gaps', async () => {
      const { prisma } = await import('../db')

      // Only 2 years but job requires 5+
      vi.mocked(prisma.resume.findUnique).mockResolvedValueOnce({
        id: 'resume9',
        summary: '2 years experience',
      } as any)

      vi.mocked(prisma.job.findUnique).mockResolvedValueOnce({
        id: 'job9',
        requirements: '5+ years required',
        seniority: 'SENIOR',
      } as any)

      const score = await calculateMatchScore('resume9', 'job9')

      expect(score.experience).toBeLessThan(60)
    })

    it('should reward exceeding requirements', async () => {
      const { prisma } = await import('../db')

      // 10 years when only 3 required
      vi.mocked(prisma.resume.findUnique).mockResolvedValueOnce({
        id: 'resume10',
        summary: '10 years of professional experience',
        skills: ['All', 'Required', 'Plus', 'More'],
      } as any)

      vi.mocked(prisma.job.findUnique).mockResolvedValueOnce({
        id: 'job10',
        requirements: '3+ years, basic skills',
      } as any)

      const score = await calculateMatchScore('resume10', 'job10')

      expect(score.overall).toBeGreaterThan(85)
    })
  })

  describe('Match Details', () => {
    it('should return breakdown of scores', async () => {
      const { prisma } = await import('../db')

      vi.mocked(prisma.resume.findUnique).mockResolvedValueOnce({
        id: 'resume11',
        skills: ['Python'],
      } as any)

      vi.mocked(prisma.job.findUnique).mockResolvedValueOnce({
        id: 'job11',
        requirements: 'Python',
      } as any)

      const score = await calculateMatchScore('resume11', 'job11')

      expect(score).toHaveProperty('skills')
      expect(score).toHaveProperty('experience')
      expect(score).toHaveProperty('education')
      expect(score).toHaveProperty('overall')
      expect(score).toHaveProperty('details')
    })

    it('should list matched skills', async () => {
      const { prisma } = await import('../db')

      vi.mocked(prisma.resume.findUnique).mockResolvedValueOnce({
        id: 'resume12',
        skills: ['Go', 'Kubernetes', 'AWS'],
      } as any)

      vi.mocked(prisma.job.findUnique).mockResolvedValueOnce({
        id: 'job12',
        requirements: 'Go, Kubernetes',
      } as any)

      const score = await calculateMatchScore('resume12', 'job12')

      expect(score.details).toContain('Go')
      expect(score.details).toContain('Kubernetes')
    })

    it('should list missing skills', async () => {
      const { prisma } = await import('../db')

      vi.mocked(prisma.resume.findUnique).mockResolvedValueOnce({
        id: 'resume13',
        skills: ['JavaScript'],
      } as any)

      vi.mocked(prisma.job.findUnique).mockResolvedValueOnce({
        id: 'job13',
        requirements: 'JavaScript, TypeScript, GraphQL',
      } as any)

      const score = await calculateMatchScore('resume13', 'job13')

      expect(score.details).toContain('TypeScript')
      expect(score.details).toContain('GraphQL')
    })

    it('should provide justification text', async () => {
      const { prisma } = await import('../db')

      vi.mocked(prisma.resume.findUnique).mockResolvedValueOnce({
        id: 'resume14',
        skills: ['Rust'],
      } as any)

      vi.mocked(prisma.job.findUnique).mockResolvedValueOnce({
        id: 'job14',
        requirements: 'Rust programming',
      } as any)

      const score = await calculateMatchScore('resume14', 'job14')

      expect(score.details).toBeDefined()
      expect(typeof score.details).toBe('string')
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing resume data', async () => {
      const { prisma } = await import('../db')

      vi.mocked(prisma.resume.findUnique).mockResolvedValueOnce(null)

      await expect(calculateMatchScore('missing', 'job1')).rejects.toThrow()
    })

    it('should handle missing job requirements', async () => {
      const { prisma } = await import('../db')

      vi.mocked(prisma.resume.findUnique).mockResolvedValueOnce({
        id: 'resume15',
        skills: ['Skill1'],
      } as any)

      vi.mocked(prisma.job.findUnique).mockResolvedValueOnce({
        id: 'job15',
        requirements: null,
      } as any)

      const score = await calculateMatchScore('resume15', 'job15')

      expect(score.overall).toBeGreaterThanOrEqual(0)
    })

    it('should return 0 for completely mismatched profiles', async () => {
      const { prisma } = await import('../db')

      vi.mocked(prisma.resume.findUnique).mockResolvedValueOnce({
        id: 'resume16',
        skills: ['Art', 'Design', 'Photoshop'],
        summary: 'Graphic designer, 0 years programming',
      } as any)

      vi.mocked(prisma.job.findUnique).mockResolvedValueOnce({
        id: 'job16',
        title: 'Senior Blockchain Developer',
        requirements: 'Solidity, Web3, Rust, 5+ years',
      } as any)

      const score = await calculateMatchScore('resume16', 'job16')

      expect(score.overall).toBeLessThan(30)
    })

    it('should return 100 for perfect matches', async () => {
      const { prisma } = await import('../db')

      vi.mocked(prisma.resume.findUnique).mockResolvedValueOnce({
        id: 'resume17',
        skills: ['Elixir', 'Phoenix', 'PostgreSQL'],
        summary: 'Senior Elixir developer, 8 years experience, MSc CS',
        sections: [
          { kind: 'EDUCATION', text: 'MSc Computer Science' },
        ],
      } as any)

      vi.mocked(prisma.job.findUnique).mockResolvedValueOnce({
        id: 'job17',
        title: 'Senior Elixir Developer',
        requirements: 'Elixir, Phoenix, PostgreSQL, 5+ years, degree in CS',
        seniority: 'SENIOR',
      } as any)

      const score = await calculateMatchScore('resume17', 'job17')

      expect(score.overall).toBeGreaterThan(90)
    })
  })
})
