/**
 * GDPR Art. 15 export.
 *
 * Two ways this endpoint can be wrong, and they pull in opposite directions:
 * it can return too little (an incomplete export is a compliance failure) or too
 * much (a password hash or a raw blob URI in a file the user downloads and then
 * forwards to whoever asked for it).
 *
 * The dangerous field list is asserted against the serialised body rather than
 * the select clause, because that is what actually leaves the building.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (handler: any) => handler }))

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth }))

const { getCandidateIdsForUser } = vi.hoisted(() => ({ getCandidateIdsForUser: vi.fn() }))
vi.mock('@/lib/identity', () => ({ getCandidateIdsForUser }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    candidate: { findMany: vi.fn() },
    consentRecord: { findMany: vi.fn() },
    dSARRequest: { findMany: vi.fn() },
    auditLog: { findMany: vi.fn() },
  },
}))

import { GET } from '../export/route'
import { prisma } from '@/lib/prisma'

const req = () => new Request('http://localhost:3000/api/gdpr/export')

const USER = {
  id: 'user-1',
  email: 'jan@example.com',
  name: 'Jan',
  avatar: null,
  phone: null,
  locale: 'sk',
  timezone: 'Europe/Bratislava',
  emailVerified: new Date('2026-01-01'),
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  organizations: [{ orgId: 'org-1', role: 'RECRUITER', organization: { name: 'TechCorp' } }],
}

const CANDIDATE = {
  id: 'cand-1',
  orgId: 'org-1',
  source: 'DIRECT',
  tags: [],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  organization: { name: 'TechCorp' },
  contacts: [{ fullName: 'Jan', email: 'jan@example.com' }],
  resumes: [],
  documents: [
    {
      id: 'doc-1',
      type: 'CV',
      filename: 'cv.pdf',
      mime: 'application/pdf',
      size: 1234,
      createdAt: new Date(),
    },
  ],
  applications: [
    {
      id: 'app-1',
      stage: 'NEW',
      source: 'WEB',
      coverLetter: 'hi',
      createdAt: new Date(),
      updatedAt: new Date(),
      job: { title: 'Dev' },
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.mockResolvedValue({ user: { id: 'user-1' } })
  ;(prisma.user.findUnique as any).mockResolvedValue(USER)
  getCandidateIdsForUser.mockResolvedValue(['cand-1'])
  ;(prisma.candidate.findMany as any).mockResolvedValue([CANDIDATE])
  ;(prisma.consentRecord.findMany as any).mockResolvedValue([])
  ;(prisma.dSARRequest.findMany as any).mockResolvedValue([])
  ;(prisma.auditLog.findMany as any).mockResolvedValue([])
})

async function exportBody() {
  const res = await GET(req())
  expect(res.status).toBe(200)
  return JSON.parse(await res.text())
}

describe('access', () => {
  it('refuses an anonymous caller and reads nothing', async () => {
    auth.mockResolvedValue(null)
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
    expect(getCandidateIdsForUser).not.toHaveBeenCalled()
  })

  it('404s when the session points at a user that no longer exists', async () => {
    ;(prisma.user.findUnique as any).mockResolvedValue(null)
    const res = await GET(req())
    expect(res.status).toBe(404)
  })

  it('only ever reads the caller own rows', async () => {
    await exportBody()
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } }),
    )
    expect(prisma.dSARRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    )
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    )
  })
})

describe('what must never appear in the export', () => {
  it.each(['password', 'totpSecret', 'passwordHash', 'sessions', 'accounts'])(
    'omits %s',
    async (field) => {
      const body = await exportBody()
      expect(JSON.stringify(body)).not.toContain(`"${field}"`)
    },
  )

  it('exposes an authenticated download path instead of the raw blob URI', async () => {
    // The export file is downloaded and often forwarded. A blob `uri` in it is a
    // credential-free direct link to the CV; the download route authorises.
    const body = await exportBody()
    const doc = body.candidates[0].documents[0]
    expect(doc.downloadUrl).toBe('/api/cv/doc-1/download')
    expect(doc).not.toHaveProperty('uri')
    expect(JSON.stringify(body)).not.toContain('blob.vercel-storage.com')
  })
})

describe('completeness', () => {
  it('resolves candidates through the identity resolver, not the session id', async () => {
    // A Candidate is org-scoped and its id is not the user id. Treating
    // session.user.id as a candidateId silently exports nothing.
    await exportBody()
    expect(getCandidateIdsForUser).toHaveBeenCalledWith('user-1')
    expect(prisma.candidate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['cand-1'] } } }),
    )
  })

  it('includes every section Art. 15 needs', async () => {
    const body = await exportBody()
    for (const key of [
      'user',
      'organizations',
      'candidates',
      'consents',
      'dsarRequests',
      'auditLogs',
    ]) {
      expect(body, `missing ${key}`).toHaveProperty(key)
    }
    expect(body.candidates[0].applications[0].jobTitle).toBe('Dev')
  })

  it('skips the candidate query entirely when the user has no candidate rows', async () => {
    getCandidateIdsForUser.mockResolvedValue([])
    const body = await exportBody()
    expect(prisma.candidate.findMany).not.toHaveBeenCalled()
    expect(body.candidates).toEqual([])
  })

  it('collects consents linked to the user AND to their candidate rows', async () => {
    await exportBody()
    const arg = (prisma.consentRecord.findMany as any).mock.calls[0][0]
    expect(arg.where.OR).toEqual([{ userId: 'user-1' }, { candidateId: { in: ['cand-1'] } }])
  })
})

describe('delivery', () => {
  it('is served as a downloadable JSON file named after the user', async () => {
    const res = await GET(req())
    expect(res.headers.get('Content-Type')).toBe('application/json')
    expect(res.headers.get('Content-Disposition')).toContain('jobsphere-data-export-user-1.json')
  })

  it('does not leak internals when a query fails', async () => {
    ;(prisma.candidate.findMany as any).mockRejectedValue(
      new Error('relation "Candidate" does not exist'),
    )
    const res = await GET(req())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to export data')
    expect(JSON.stringify(body)).not.toContain('relation')
  })
})
