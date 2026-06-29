import { describe, it, expect, vi, beforeEach } from 'vitest'

// Security wrappers are pass-through in unit tests (CSRF already bypasses in NODE_ENV=test).
vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (h: unknown) => h }))
vi.mock('@/lib/csrf', () => ({ withCsrfProtection: (h: unknown) => h }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))
vi.mock('@/lib/identity', () => ({ getPersonalCandidateForUser: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    resume: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

import { GET, POST, DELETE } from '../route'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPersonalCandidateForUser } from '@/lib/identity'

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>
const PERSONAL = { id: 'personal-cand-1' }

const req = (url: string, body?: unknown) =>
  new Request(url, {
    method: body ? 'POST' : 'GET',
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  })

beforeEach(() => {
  vi.clearAllMocks()
  asMock(getPersonalCandidateForUser).mockResolvedValue(PERSONAL)
})

describe('/api/cv/profile — auth boundary', () => {
  it('GET returns 401 when unauthenticated', async () => {
    asMock(auth).mockResolvedValue(null)
    const res = await GET(req('http://localhost/api/cv/profile'), undefined)
    expect(res.status).toBe(401)
    expect(prisma.resume.findMany).not.toHaveBeenCalled()
  })

  it('POST returns 401 when unauthenticated', async () => {
    asMock(auth).mockResolvedValue(null)
    const res = await POST(
      req('http://localhost/api/cv/profile', { personalInfo: { fullName: 'X' } }),
    )
    expect(res.status).toBe(401)
    expect(prisma.resume.create).not.toHaveBeenCalled()
  })

  it('DELETE returns 401 when unauthenticated', async () => {
    asMock(auth).mockResolvedValue(null)
    const res = await DELETE(req('http://localhost/api/cv/profile?id=r1'))
    expect(res.status).toBe(401)
    expect(prisma.resume.updateMany).not.toHaveBeenCalled()
  })
})

describe('/api/cv/profile — input validation', () => {
  beforeEach(() => asMock(auth).mockResolvedValue({ user: { id: 'u1' } }))

  it('POST returns 400 on malformed body (Zod)', async () => {
    const res = await POST(req('http://localhost/api/cv/profile', { experiences: 'not-an-array' }))
    expect(res.status).toBe(400)
    expect(prisma.resume.create).not.toHaveBeenCalled()
  })

  it('POST returns 400 on an empty CV', async () => {
    const res = await POST(req('http://localhost/api/cv/profile', {}))
    expect(res.status).toBe(400)
    expect(prisma.resume.create).not.toHaveBeenCalled()
  })
})

describe('/api/cv/profile — ownership / IDOR isolation', () => {
  beforeEach(() => asMock(auth).mockResolvedValue({ user: { id: 'u1' } }))

  it("POST stores the CV on the caller's OWN personal candidate", async () => {
    asMock(prisma.resume.create).mockResolvedValue({ id: 'r-new' })
    const res = await POST(
      req('http://localhost/api/cv/profile', { personalInfo: { fullName: 'Ján Staš' } }),
    )
    expect(res.status).toBe(201)
    expect(prisma.resume.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ candidateId: PERSONAL.id }) }),
    )
  })

  it("DELETE is scoped to the caller's candidate and 404s a foreign CV id", async () => {
    // updateMany matched nothing → the id is not on the caller's personal candidate.
    asMock(prisma.resume.updateMany).mockResolvedValue({ count: 0 })
    const res = await DELETE(req('http://localhost/api/cv/profile?id=foreign-cv'))
    expect(res.status).toBe(404)
    expect(prisma.resume.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'foreign-cv', candidateId: PERSONAL.id }),
      }),
    )
  })

  it("GET ?id scopes the lookup to the caller's candidate and 404s a foreign CV", async () => {
    asMock(prisma.resume.findFirst).mockResolvedValue(null)
    const res = await GET(req('http://localhost/api/cv/profile?id=foreign-cv'), undefined)
    expect(res.status).toBe(404)
    expect(prisma.resume.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'foreign-cv', candidateId: PERSONAL.id }),
      }),
    )
  })
})
