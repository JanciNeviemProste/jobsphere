import { describe, it, expect, vi, beforeEach } from 'vitest'

// Security wrappers are pass-through in unit tests.
vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (h: unknown) => h }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    assessmentInvite: { findFirst: vi.fn() },
    assessment: { findUnique: vi.fn() },
  },
}))

import { GET } from '../route'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>

const ctx = { params: { id: 'a1' } }
const req = (query = '') => new Request(`http://localhost/api/assessments/a1${query}`)

// The mock deliberately returns the SECRET answer fields to prove the route
// strips them — in production the DB `select` never even fetches these.
const ASSESSMENT_WITH_SECRETS = {
  id: 'a1',
  name: 'JS Test',
  durationMin: 30,
  sections: [
    {
      title: 'Section 1',
      questions: [
        {
          id: 'q1',
          type: 'MCQ',
          text: 'What is 2 + 2?',
          hint: null,
          choices: ['3', '4', '5'],
          language: null,
          starterCode: null,
          points: 10,
          order: 0,
          isRequired: true,
          // secrets that must NEVER reach the candidate:
          correctIndexes: [1],
          rubric: { criteria: 'exact match' },
          testCases: [{ input: '2,2', output: '4' }],
        },
      ],
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/assessments/[id] (runner)', () => {
  it('returns 401 without a token and without a session', async () => {
    asMock(auth).mockResolvedValue(null)
    const res = await GET(req(), ctx)
    expect(res.status).toBe(401)
    // Session path bails before touching invite/assessment lookups.
    expect(prisma.assessment.findUnique).not.toHaveBeenCalled()
  })

  it('returns 403 when the token does not match a valid invite', async () => {
    asMock(prisma.assessmentInvite.findFirst).mockResolvedValue(null)
    const res = await GET(req('?token=bad-token'), ctx)
    expect(res.status).toBe(403)
    expect(prisma.assessment.findUnique).not.toHaveBeenCalled()
  })

  it('returns 200 with a valid token and NEVER leaks correct answers', async () => {
    asMock(prisma.assessmentInvite.findFirst).mockResolvedValue({ id: 'inv1' })
    asMock(prisma.assessment.findUnique).mockResolvedValue(ASSESSMENT_WITH_SECRETS)

    const res = await GET(req('?token=good-token'), ctx)
    expect(res.status).toBe(200)

    const body = await res.json()
    const question = body.assessment.sections[0].questions[0]

    // Sanity: the safe, candidate-facing fields survived.
    expect(question.text).toBe('What is 2 + 2?')
    expect(question.choices).toEqual(['3', '4', '5'])
    expect(question.points).toBe(10)

    // The critical assertion: no secret answer fields anywhere in the payload.
    expect(question).not.toHaveProperty('correctIndexes')
    expect(question).not.toHaveProperty('rubric')
    expect(question).not.toHaveProperty('testCases')
    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain('correctIndexes')
    expect(serialized).not.toContain('rubric')
    expect(serialized).not.toContain('testCases')
  })
})
