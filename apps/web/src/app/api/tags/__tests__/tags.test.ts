/**
 * Tags: the vocabulary, and attaching it to people.
 *
 * The interesting case is the join. A CandidateTag row carries no orgId of its
 * own, so if the attach endpoint checks only the candidate, a tag id from another
 * tenant can be pinned onto a local candidate and nothing downstream can tell.
 * Both sides are checked, and that is what most of these tests are about.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (handler: any) => handler }))
vi.mock('@/lib/csrf', () => ({ withCsrfProtection: (handler: any) => handler }))

const { requireAuth } = vi.hoisted(() => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/api-helpers', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  requireAuth,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tag: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    candidate: { findFirst: vi.fn() },
    candidateTag: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  },
}))

import { POST as createTag } from '../route'
import { PATCH as renameTag, DELETE as deleteTag } from '../[id]/route'
import { POST as attachTag, DELETE as detachTag } from '../../candidates/[id]/tags/route'
import { prisma } from '@/lib/prisma'

const ORG = 'org-1'
const TAG = { id: 'tag-1', orgId: ORG, name: 'Needs visa', color: null }

const json = (url: string, method: string, body?: unknown) =>
  new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

const tagsUrl = 'http://localhost:3000/api/tags'
const tagUrl = 'http://localhost:3000/api/tags/tag-1'
const candTagsUrl = 'http://localhost:3000/api/candidates/cand-1/tags'

const tagCtx = { params: { id: 'tag-1' } }
const candCtx = { params: { id: 'cand-1' } }

beforeEach(() => {
  vi.clearAllMocks()
  requireAuth.mockResolvedValue({ userId: 'user-1', orgId: ORG })
  ;(prisma.tag.findUnique as any).mockResolvedValue(null)
  ;(prisma.tag.findFirst as any).mockResolvedValue(TAG)
  ;(prisma.tag.create as any).mockResolvedValue(TAG)
  ;(prisma.tag.update as any).mockResolvedValue(TAG)
  ;(prisma.tag.delete as any).mockResolvedValue(TAG)
  ;(prisma.candidate.findFirst as any).mockResolvedValue({ id: 'cand-1', orgId: ORG })
  ;(prisma.candidateTag.upsert as any).mockResolvedValue({})
  ;(prisma.candidateTag.deleteMany as any).mockResolvedValue({ count: 1 })
})

describe('the vocabulary is per organisation', () => {
  it('creates a tag scoped to the caller org', async () => {
    const res = await createTag(json(tagsUrl, 'POST', { name: 'Needs visa' }))

    expect(res.status).toBe(201)
    expect(prisma.tag.create).toHaveBeenCalledWith({
      data: { orgId: ORG, name: 'Needs visa', color: null },
    })
  })

  it('trims the name, so " Senior " and "Senior" are one tag', async () => {
    await createTag(json(tagsUrl, 'POST', { name: '  Senior  ' }))
    expect((prisma.tag.create as any).mock.calls[0][0].data.name).toBe('Senior')
  })

  it('409s on a duplicate rather than letting the unique index 500', async () => {
    ;(prisma.tag.findUnique as any).mockResolvedValue(TAG)
    const res = await createTag(json(tagsUrl, 'POST', { name: 'Needs visa' }))

    expect(res.status).toBe(409)
    expect(prisma.tag.create).not.toHaveBeenCalled()
  })

  it('rejects a colour that is not a hex value', async () => {
    const res = await createTag(json(tagsUrl, 'POST', { name: 'X', color: 'red' }))
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(prisma.tag.create).not.toHaveBeenCalled()
  })

  it('renaming is why tags are rows — it updates one place', async () => {
    // With a String[] column, fixing a typo means touching every candidate that
    // carries it, and missing one leaves two tags forever.
    const res = await renameTag(json(tagUrl, 'PATCH', { name: 'Needs sponsorship' }), tagCtx)

    expect(res.status).toBe(200)
    expect(prisma.tag.update).toHaveBeenCalledWith({
      where: { id: 'tag-1' },
      data: { name: 'Needs sponsorship' },
    })
  })

  it('refuses a rename that collides with an existing tag', async () => {
    ;(prisma.tag.findUnique as any).mockResolvedValue({ id: 'tag-2', name: 'Taken' })
    const res = await renameTag(json(tagUrl, 'PATCH', { name: 'Taken' }), tagCtx)

    expect(res.status).toBe(409)
    expect(prisma.tag.update).not.toHaveBeenCalled()
  })

  it.each([
    ['PATCH', () => renameTag(json(tagUrl, 'PATCH', { name: 'x' }), tagCtx)],
    ['DELETE', () => deleteTag(json(tagUrl, 'DELETE'), tagCtx)],
  ] as const)("%s 404s for another org's tag", async (_m, invoke) => {
    ;(prisma.tag.findFirst as any).mockResolvedValue(null)
    const res = await invoke()

    expect(res.status).toBe(404)
    expect(prisma.tag.update).not.toHaveBeenCalled()
    expect(prisma.tag.delete).not.toHaveBeenCalled()
  })

  it('scopes every lookup by orgId', async () => {
    await renameTag(json(tagUrl, 'PATCH', { name: 'x' }), tagCtx)
    expect(prisma.tag.findFirst).toHaveBeenCalledWith({ where: { id: 'tag-1', orgId: ORG } })
  })
})

describe('attaching a tag checks BOTH sides against the org', () => {
  it('attaches when candidate and tag are both local', async () => {
    const res = await attachTag(json(candTagsUrl, 'POST', { tagId: 'tag-1' }), candCtx)

    expect(res.status).toBe(201)
    expect(prisma.candidateTag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { candidateId_tagId: { candidateId: 'cand-1', tagId: 'tag-1' } },
      }),
    )
  })

  it('refuses a tag id belonging to another organisation', async () => {
    // The join row carries no orgId, so nothing downstream could ever detect
    // this if the endpoint let it through.
    ;(prisma.tag.findFirst as any).mockResolvedValue(null)
    const res = await attachTag(json(candTagsUrl, 'POST', { tagId: 'foreign-tag' }), candCtx)

    expect(res.status).toBe(404)
    expect(prisma.candidateTag.upsert).not.toHaveBeenCalled()
  })

  it('refuses a candidate belonging to another organisation', async () => {
    ;(prisma.candidate.findFirst as any).mockResolvedValue(null)
    const res = await attachTag(json(candTagsUrl, 'POST', { tagId: 'tag-1' }), candCtx)

    expect(res.status).toBe(404)
    expect(prisma.candidateTag.upsert).not.toHaveBeenCalled()
  })

  it('is idempotent — tagging twice is a double-click, not an error', async () => {
    const first = await attachTag(json(candTagsUrl, 'POST', { tagId: 'tag-1' }), candCtx)
    const second = await attachTag(json(candTagsUrl, 'POST', { tagId: 'tag-1' }), candCtx)

    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
  })

  it('detaches by query parameter', async () => {
    const res = await detachTag(json(`${candTagsUrl}?tagId=tag-1`, 'DELETE'), candCtx)

    expect(res.status).toBe(200)
    expect(prisma.candidateTag.deleteMany).toHaveBeenCalledWith({
      where: { candidateId: 'cand-1', tagId: 'tag-1' },
    })
  })

  it('requires a tagId on detach', async () => {
    const res = await detachTag(json(candTagsUrl, 'DELETE'), candCtx)
    expect(res.status).toBe(400)
    expect(prisma.candidateTag.deleteMany).not.toHaveBeenCalled()
  })
})
