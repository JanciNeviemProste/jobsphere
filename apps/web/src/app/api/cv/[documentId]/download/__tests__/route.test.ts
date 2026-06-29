import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (h: unknown) => h }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))
vi.mock('@vercel/blob', () => ({ get: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    candidateDocument: { findFirst: vi.fn() },
    userOrgRole: { findFirst: vi.fn() },
  },
}))

import { GET } from '../route'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { get } from '@vercel/blob'

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>
const BLOB_URI = 'https://store123.blob.vercel-storage.com/cvs/c1/cv.pdf'

const doc = (overrides: Record<string, unknown> = {}) => ({
  id: 'doc1',
  uri: BLOB_URI,
  filename: 'cv.pdf',
  mime: 'application/pdf',
  size: 3,
  candidate: { orgId: 'org-A', userId: 'owner' },
  ...overrides,
})

const okStream = () =>
  new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array([1, 2, 3]))
      c.close()
    },
  })

const call = (documentId?: string) =>
  GET(new Request('http://localhost/api/cv/x/download'), {
    params: documentId ? { documentId } : {},
  })

beforeEach(() => vi.clearAllMocks())

describe('GET /api/cv/[documentId]/download — authz + private read', () => {
  it('401 when unauthenticated', async () => {
    asMock(auth).mockResolvedValue(null)
    expect((await call('doc1')).status).toBe(401)
    expect(get).not.toHaveBeenCalled()
  })

  it('403 when caller is neither the candidate nor an org member', async () => {
    asMock(auth).mockResolvedValue({ user: { id: 'intruder' } })
    asMock(prisma.candidateDocument.findFirst).mockResolvedValue(
      doc({ candidate: { orgId: 'org-A', userId: 'someone-else' } }),
    )
    asMock(prisma.userOrgRole.findFirst).mockResolvedValue(null)
    const res = await call('doc1')
    expect(res.status).toBe(403)
    expect(get).not.toHaveBeenCalled()
  })

  it('streams the file to the owner via the authenticated private get()', async () => {
    asMock(auth).mockResolvedValue({ user: { id: 'owner' } })
    asMock(prisma.candidateDocument.findFirst).mockResolvedValue(doc())
    asMock(get).mockResolvedValue({ statusCode: 200, stream: okStream() })

    const res = await call('doc1')

    expect(res.status).toBe(200)
    expect(get).toHaveBeenCalledWith(BLOB_URI, expect.objectContaining({ access: 'private' }))
    expect(res.headers.get('content-disposition')).toContain('cv.pdf')
    expect(res.headers.get('cache-control')).toBe('private, no-store')
  })

  it('falls back to public fetch for a legacy public blob (get returns null)', async () => {
    asMock(auth).mockResolvedValue({ user: { id: 'owner' } })
    asMock(prisma.candidateDocument.findFirst).mockResolvedValue(doc())
    asMock(get).mockResolvedValue(null)
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(okStream(), { status: 200 }))

    const res = await call('doc1')

    expect(res.status).toBe(200)
    expect(fetchSpy).toHaveBeenCalledWith(BLOB_URI)
    fetchSpy.mockRestore()
  })
})
