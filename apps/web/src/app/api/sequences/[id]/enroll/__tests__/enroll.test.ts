/**
 * LOGIC-012 — enroll route validation + idempotency.
 *
 *  - A cuid candidateId is ACCEPTED (no 400 from .uuid() validation).
 *  - A duplicate enroll (existing ACTIVE run) is idempotent: it returns the
 *    existing run and does NOT create a second ACTIVE run.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/rate-limit', () => ({
  withRateLimit: (handler: any) => handler,
}))

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth }))

const { addEmailSequenceJob } = vi.hoisted(() => ({ addEmailSequenceJob: vi.fn() }))
vi.mock('@/lib/queue', () => ({ addEmailSequenceJob }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userOrgRole: { findMany: vi.fn() },
    emailSequence: { findFirst: vi.fn() },
    candidate: { findUnique: vi.fn() },
    emailSequenceRun: { findFirst: vi.fn(), create: vi.fn() },
  },
}))

import { POST } from '../route'
import { prisma } from '@/lib/prisma'

const ORG_ID = 'corg000000000000000000001'
const SEQ_ID = 'cseq000000000000000000001'
// cuid-shaped (leading 'c', 25 chars) — NOT a UUID.
const CAND_ID = 'cjld2cjxh0000qzrmn831i7rn'
const RUN_ID = 'crun000000000000000000001'

function req(body: unknown) {
  return { json: async () => body, headers: { get: () => null } } as any
}

describe('LOGIC-012 — enroll route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.mockResolvedValue({ user: { id: 'user-1' } })
    vi.mocked(prisma.userOrgRole.findMany).mockResolvedValue([{ orgId: ORG_ID }] as any)
    vi.mocked(prisma.emailSequence.findFirst).mockResolvedValue({
      id: SEQ_ID,
      orgId: ORG_ID,
      active: true,
      steps: [{ id: 'cstep000000000000000000001', order: 0 }],
    } as any)
    vi.mocked(prisma.candidate.findUnique).mockResolvedValue({ orgId: ORG_ID } as any)
  })

  it('accepts a cuid candidateId and enrolls (no 400)', async () => {
    vi.mocked(prisma.emailSequenceRun.findFirst).mockResolvedValue(null as any)
    vi.mocked(prisma.emailSequenceRun.create).mockResolvedValue({ id: RUN_ID } as any)

    const res = await POST(req({ candidateId: CAND_ID }), { params: { id: SEQ_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toMatchObject({ success: true, runId: RUN_ID })
    expect(prisma.emailSequenceRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sequenceId: SEQ_ID, candidateId: CAND_ID, currentStep: 0 }),
      }),
    )
  })

  it('is idempotent on duplicate enroll (existing ACTIVE run)', async () => {
    vi.mocked(prisma.emailSequenceRun.findFirst).mockResolvedValue({
      id: RUN_ID,
      status: 'ACTIVE',
    } as any)

    const res = await POST(req({ candidateId: CAND_ID }), { params: { id: SEQ_ID } })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toMatchObject({ success: true, runId: RUN_ID, alreadyEnrolled: true })
    // No second ACTIVE run created.
    expect(prisma.emailSequenceRun.create).not.toHaveBeenCalled()
  })

  it('rejects a non-cuid candidateId with 400', async () => {
    const res = await POST(req({ candidateId: 'not-a-cuid' }), { params: { id: SEQ_ID } })
    expect(res.status).toBe(400)
    expect(prisma.emailSequenceRun.create).not.toHaveBeenCalled()
  })
})
