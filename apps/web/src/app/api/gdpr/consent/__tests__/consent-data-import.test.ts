/**
 * Consent DATA_IMPORT (L64). Verifies the new purpose is accepted by both the
 * shared schema and the route Zod validation → the scraper import can be gated
 * on a recorded DATA_IMPORT consent.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { consentSchema } from '@/schemas/gdpr.schema'

describe('gdpr consent schema — DATA_IMPORT', () => {
  it('accepts DATA_IMPORT as a valid purpose', () => {
    expect(consentSchema.safeParse({ purpose: 'DATA_IMPORT', granted: true }).success).toBe(true)
  })

  it('still rejects an unknown purpose', () => {
    expect(consentSchema.safeParse({ purpose: 'NONSENSE', granted: true }).success).toBe(false)
  })
})

// --- Route-level check ------------------------------------------------------
vi.mock('@/lib/csrf', () => ({ withCsrfProtection: (handler: any) => handler }))
vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (handler: any) => handler }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth }))

vi.mock('@/lib/prisma', () => ({
  prisma: { consentRecord: { create: vi.fn() } },
}))

import { POST } from '../route'
import { prisma } from '@/lib/prisma'

function req(body: unknown) {
  return {
    json: async () => body,
    headers: { get: () => null },
  } as any
}

describe('POST /api/gdpr/consent — DATA_IMPORT', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.mockResolvedValue({ user: { id: 'u-1' } })
    vi.mocked(prisma.consentRecord.create).mockResolvedValue({ id: 'c-1' } as any)
  })

  it('records a DATA_IMPORT consent (201)', async () => {
    const res = await POST(req({ purpose: 'DATA_IMPORT', granted: true }))
    expect(res.status).toBe(201)
    const arg = vi.mocked(prisma.consentRecord.create).mock.calls[0][0] as any
    expect(arg.data.consentType).toBe('DATA_IMPORT')
    expect(arg.data.purpose).toBe('DATA_IMPORT')
  })
})
