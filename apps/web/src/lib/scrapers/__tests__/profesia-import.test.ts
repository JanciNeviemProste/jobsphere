/**
 * Profesia import pipeline (L65). fetch is fully mocked — NO live request is
 * ever made. Verifies:
 *  - consent gate: without a DATA_IMPORT consent, nothing is fetched/written;
 *  - happy path: dedup upsert keyed on (externalSource, externalId).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Set env BEFORE the module under test is imported so the fixed inter-request
// delay is 0ms in tests (module reads these at import time).
vi.hoisted(() => {
  process.env.SCRAPER_DELAY_MS = '0'
  process.env.SCRAPER_MAX_OFFERS = '5'
})

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    consentRecord: { findFirst: vi.fn() },
    organization: { upsert: vi.fn() },
    user: { upsert: vi.fn() },
    job: { upsert: vi.fn() },
  },
}))

import { processScrape } from '../profesia-import'
import { prisma } from '@/lib/prisma'

const LISTING_HTML = `<a href="/praca/acme/O1234567">Dev</a>`
const DETAIL_HTML = `
  <h1 itemprop="title">Senior Developer</h1>
  <span itemprop="hiringOrganization">Acme</span>
  <span itemprop="jobLocation">Bratislava</span>
  <div itemprop="description">Great role for a senior developer.</div>
`

function mockFetchOnce() {
  const fetchMock = vi.fn(async (url: string) => {
    const isDetail = /O\d+/.test(url)
    return {
      ok: true,
      text: async () => (isDetail ? DETAIL_HTML : LISTING_HTML),
    } as any
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('processScrape — consent gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips entirely when no DATA_IMPORT consent exists (no fetch, no upsert)', async () => {
    vi.mocked(prisma.consentRecord.findFirst).mockResolvedValue(null as any)
    const fetchMock = mockFetchOnce()

    const result = await processScrape({ data: {} })

    expect(result.skipped).toBe(true)
    expect(result.reason).toBe('no-consent')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(prisma.job.upsert).not.toHaveBeenCalled()
  })
})

describe('processScrape — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.consentRecord.findFirst).mockResolvedValue({ id: 'c-1' } as any)
    vi.mocked(prisma.organization.upsert).mockResolvedValue({ id: 'sys-org' } as any)
    vi.mocked(prisma.user.upsert).mockResolvedValue({ id: 'sys-user' } as any)
    vi.mocked(prisma.job.upsert).mockResolvedValue({} as any)
  })

  it('imports offers via a dedup upsert keyed on (externalSource, externalId)', async () => {
    const fetchMock = mockFetchOnce()

    const result = await processScrape({ data: { source: 'profesia.sk' } })

    expect(result.imported).toBe(1)
    expect(result.failed).toBe(0)
    // fetch was used (listing + 1 detail) — proves no live request path.
    expect(fetchMock).toHaveBeenCalledTimes(2)

    expect(prisma.job.upsert).toHaveBeenCalledTimes(1)
    const arg = vi.mocked(prisma.job.upsert).mock.calls[0][0] as any
    expect(arg.where.externalSource_externalId).toEqual({
      externalSource: 'profesia.sk',
      externalId: 'O1234567',
    })
    // System ownership on create.
    expect(arg.create.orgId).toBe('sys-org')
    expect(arg.create.createdBy).toBe('sys-user')
    expect(arg.create.externalSource).toBe('profesia.sk')
  })
})
