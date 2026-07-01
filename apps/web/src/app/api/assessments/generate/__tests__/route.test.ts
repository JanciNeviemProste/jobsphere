import { describe, it, expect, vi, beforeEach } from 'vitest'

// Security wrappers are pass-through in unit tests.
vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (h: unknown) => h }))
vi.mock('@/lib/csrf', () => ({ withCsrfProtection: (h: unknown) => h }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))
vi.mock('@/lib/prisma', () => ({
  prisma: { userOrgRole: { findFirst: vi.fn() } },
}))
// `@jobsphere/ai` resolves to the built dist in tests, so we mock the boundary.
vi.mock('@jobsphere/ai', () => ({ generateAssessment: vi.fn() }))

import { POST } from '../route'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateAssessment } from '@jobsphere/ai'

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>

const req = (body: unknown) =>
  new Request('http://localhost/api/assessments/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })

const VALID_DRAFT = {
  name: 'React Skills',
  description: 'Assesses core React knowledge',
  sections: [
    {
      title: 'Fundamentals',
      questions: [
        {
          type: 'MCQ',
          text: 'What is a hook?',
          choices: ['a', 'b'],
          correctIndexes: [0],
          points: 10,
          skillTag: 'react',
        },
      ],
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.ANTHROPIC_API_KEY = 'test-key'
})

describe('POST /api/assessments/generate', () => {
  it('returns 401 when unauthenticated', async () => {
    asMock(auth).mockResolvedValue(null)
    const res = await POST(req({ jobTitle: 'Dev', jobDescription: 'Build things' }))
    expect(res.status).toBe(401)
    expect(generateAssessment).not.toHaveBeenCalled()
  })

  it('returns 403 when the caller lacks a recruiter-level org role', async () => {
    asMock(auth).mockResolvedValue({ user: { id: 'u1' } })
    asMock(prisma.userOrgRole.findFirst).mockResolvedValue(null)
    const res = await POST(req({ jobTitle: 'Dev', jobDescription: 'Build things' }))
    expect(res.status).toBe(403)
    expect(generateAssessment).not.toHaveBeenCalled()
  })

  it('returns a validated draft for an org member (happy path)', async () => {
    asMock(auth).mockResolvedValue({ user: { id: 'u1' } })
    asMock(prisma.userOrgRole.findFirst).mockResolvedValue({ role: 'RECRUITER' })
    asMock(generateAssessment).mockResolvedValue(VALID_DRAFT)

    const res = await POST(
      req({ jobTitle: 'React Developer', jobDescription: 'Build React apps and components.' }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.assessment.name).toBe('React Skills')
    expect(body.assessment.sections).toHaveLength(1)
    expect(generateAssessment).toHaveBeenCalledOnce()
  })
})
