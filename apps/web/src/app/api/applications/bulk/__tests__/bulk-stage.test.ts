/**
 * QA-004 — Bulk move-stage regression pins.
 *
 * Two invariants this test locks in:
 *  1. The pipeline move writes to `Application.stage` (NOT the legacy `status`
 *     column — a past regression wrote `status` and silently no-op'd the board).
 *  2. The whole flow is org-scoped: the route only operates on applications
 *     whose job belongs to the caller's org, so a cross-org bulk edit is
 *     rejected (403) and never reaches a write.
 *
 * The route delegates the actual `updateMany` to
 * `ApplicationService.bulkUpdateStatus`, which runs inside a prisma
 * `$transaction`. We drive the real service (not a mock) so the assertion on
 * `tx.application.updateMany({ data: { stage } })` is meaningful, and we capture
 * the route-level org-scoped `findMany` to prove cross-org IDs are blocked.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// CSRF is skipped automatically when NODE_ENV === 'test' (vitest sets this),
// but mock it as a pass-through to be explicit and independent of env timing.
vi.mock('@/lib/csrf', () => ({
  withCsrfProtection: (handler: any) => handler,
}))

vi.mock('@/lib/rate-limit', () => ({
  withRateLimit: (handler: any) => handler,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), apiRequest: vi.fn(), apiError: vi.fn() },
}))

vi.mock('@/lib/email', () => ({ sendEmail: vi.fn() }))

vi.mock('@/lib/audit-log', () => ({ createAuditLog: vi.fn() }))

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth }))

// Single shared prisma mock used by BOTH the route and the service.
vi.mock('@/lib/prisma', () => ({
  prisma: {
    userOrgRole: { findFirst: vi.fn() },
    application: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

import { POST } from '../route'
import { prisma } from '@/lib/prisma'

const ORG_ID = 'org-abc'
// zod `.cuid()` requires a cuid-shaped string (leading `c`, 25 chars).
const APP_1 = 'cjld2cjxh0000qzrmn831i7rn'
const APP_2 = 'cjld2cyuq0000t3rmniod1foy'

function req(body: unknown) {
  return {
    json: async () => body,
  } as any
}

describe('QA-004 — bulk move-stage writes Application.stage, org-scoped', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.mockResolvedValue({ user: { id: 'user-1', email: 'r@b.c', name: 'R' } })
    vi.mocked(prisma.userOrgRole.findFirst).mockResolvedValue({ orgId: ORG_ID } as any)
  })

  it('moves applications via tx.application.updateMany with data.stage (NOT status)', async () => {
    // Route-level permission check: both ids resolve to the caller's org.
    vi.mocked(prisma.application.findMany).mockResolvedValue([{ id: APP_1 }, { id: APP_2 }] as any)

    // Capture the write the SERVICE makes inside the transaction.
    const txUpdateMany = vi.fn().mockResolvedValue({ count: 2 })
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) =>
      cb({
        application: {
          findMany: vi.fn().mockResolvedValue([{ id: APP_1, job: { orgId: ORG_ID } }]),
          updateMany: txUpdateMany,
        },
      }),
    )

    const res = await POST(
      req({ action: 'move-stage', applicationIds: [APP_1, APP_2], stage: 'INTERVIEW' }),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ ok: true, action: 'move-stage', processed: 2 })

    // (1) The write targets `stage`, NOT the legacy `status` column.
    expect(txUpdateMany).toHaveBeenCalledTimes(1)
    const writeArg = txUpdateMany.mock.calls[0][0]
    expect(writeArg.data).toEqual({ stage: 'INTERVIEW' })
    expect(writeArg.data).not.toHaveProperty('status')
    expect(writeArg.data.stage).toBe('INTERVIEW')

    // (2) The write only touches the permitted (org-resolved) ids.
    expect(writeArg.where).toMatchObject({ id: { in: [APP_1, APP_2] } })
  })

  it('org-scopes the permission lookup so cross-org ids cannot be edited', async () => {
    // Only ONE id resolves under the caller's org -> the where clause is org-scoped.
    vi.mocked(prisma.application.findMany).mockResolvedValue([{ id: APP_1 }] as any)

    const res = await POST(
      req({ action: 'move-stage', applicationIds: [APP_1, APP_2], stage: 'INTERVIEW' }),
    )

    // The route refuses the whole batch when any id is outside the org.
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/do not belong to your organization/i)

    // The permission query is org-scoped: it filters by job.orgId == caller's org.
    const permissionCall = vi.mocked(prisma.application.findMany).mock.calls[0][0] as any
    expect(permissionCall.where.job).toEqual({ orgId: ORG_ID })
    expect(permissionCall.where.id).toEqual({ in: [APP_1, APP_2] })
    expect(permissionCall.where.deletedAt).toBeNull()

    // No write happened on the rejection path.
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.application.updateMany).not.toHaveBeenCalled()
  })

  it('rejects with 403 when the caller has no organization (no write)', async () => {
    vi.mocked(prisma.userOrgRole.findFirst).mockResolvedValue(null as any)

    const res = await POST(req({ action: 'move-stage', applicationIds: [APP_1], stage: 'HIRED' }))

    expect(res.status).toBe(403)
    expect(prisma.application.findMany).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
