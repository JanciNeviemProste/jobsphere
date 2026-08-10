/**
 * `/api/sequences/[id]` — the route that did not exist.
 *
 * `sequences-client.tsx` has always PATCHed this path when saving an existing
 * sequence, so editing one returned 404 every time. Creating worked, which is
 * probably why it went unnoticed.
 *
 * The interesting half of these tests is not the 404s. It is that step
 * reconciliation must not destroy delivery history: `EmailSequenceEvent.stepId`
 * is a required FK, so the natural "delete all steps and recreate" would fail on
 * any sequence that has ever sent an email.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (handler: any) => handler }))
vi.mock('@/lib/csrf', () => ({ withCsrfProtection: (handler: any) => handler }))

const { requireAuth } = vi.hoisted(() => ({ requireAuth: vi.fn() }))
// Partial mock: lib/errors.ts imports UnauthorizedError from this module, so
// replacing it wholesale makes handleApiError throw on its own error branch.
vi.mock('@/lib/api-helpers', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  requireAuth,
}))

const tx = vi.hoisted(() => ({
  emailSequence: { update: vi.fn(), findUnique: vi.fn() },
  emailStep: { update: vi.fn(), create: vi.fn(), delete: vi.fn() },
  emailSequenceEvent: { count: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    emailSequence: { findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
  },
}))

import { GET, PATCH, DELETE } from '../[id]/route'
import { prisma } from '@/lib/prisma'

const ORG = 'org-1'
const ctx = { params: { id: 'seq-1' } }

const step = (order: number, id = `step-${order}`) => ({
  id,
  order,
  name: `Step ${order + 1}`,
  dayOffset: order,
  subject: `s${order}`,
  bodyTemplate: `b${order}`,
})

const SEQUENCE = {
  id: 'seq-1',
  orgId: ORG,
  name: 'Onboarding',
  active: true,
  steps: [step(0), step(1)],
}

const url = 'http://localhost:3000/api/sequences/seq-1'
const get = () => new Request(url)
const patch = (body: unknown) =>
  new Request(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
const del = () => new Request(url, { method: 'DELETE' })

const validSteps = [
  { order: 0, dayOffset: 0, subject: 'Hello', bodyTemplate: 'Hi there' },
  { order: 1, dayOffset: 3, subject: 'Follow up', bodyTemplate: 'Still interested?' },
]

beforeEach(() => {
  vi.clearAllMocks()
  requireAuth.mockResolvedValue({ userId: 'user-1', orgId: ORG })
  ;(prisma.emailSequence.findFirst as any).mockResolvedValue(SEQUENCE)
  ;(prisma.emailSequence.update as any).mockResolvedValue(SEQUENCE)
  tx.emailSequence.update.mockResolvedValue(SEQUENCE)
  tx.emailSequence.findUnique.mockResolvedValue(SEQUENCE)
  tx.emailStep.update.mockResolvedValue({})
  tx.emailStep.create.mockResolvedValue({})
  tx.emailStep.delete.mockResolvedValue({})
  tx.emailSequenceEvent.count.mockResolvedValue(0)
})

describe('the route exists and answers', () => {
  it('PATCH no longer 404s for an existing sequence', async () => {
    // The regression this file exists for.
    const res = await PATCH(patch({ name: 'Renamed' }), ctx)
    expect(res.status).toBe(200)
  })

  it.each([
    ['GET', (c: any) => GET(get(), c)],
    ['PATCH', (c: any) => PATCH(patch({ name: 'x' }), c)],
    ['DELETE', (c: any) => DELETE(del(), c)],
  ] as const)('%s rejects a request with no id in the segment', async (_m, invoke) => {
    const res = await invoke(undefined)
    expect(res.status).toBe(400)
    expect(prisma.emailSequence.findFirst).not.toHaveBeenCalled()
  })
})

describe('tenant boundary', () => {
  it.each([
    ['GET', () => GET(get(), ctx)],
    ['PATCH', () => PATCH(patch({ name: 'x' }), ctx)],
    ['DELETE', () => DELETE(del(), ctx)],
  ] as const)('%s scopes the lookup to the caller organisation', async (_m, invoke) => {
    await invoke()
    expect(prisma.emailSequence.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'seq-1', orgId: ORG }),
      }),
    )
  })

  it.each([
    ['GET', () => GET(get(), ctx)],
    ['PATCH', () => PATCH(patch({ name: 'x' }), ctx)],
    ['DELETE', () => DELETE(del(), ctx)],
  ] as const)(
    "%s 404s for another organisation's sequence and writes nothing",
    async (_m, invoke) => {
      ;(prisma.emailSequence.findFirst as any).mockResolvedValue(null)
      const res = await invoke()

      expect(res.status).toBe(404)
      expect(prisma.emailSequence.update).not.toHaveBeenCalled()
      expect(tx.emailSequence.update).not.toHaveBeenCalled()
    },
  )

  it('excludes soft-deleted sequences, which the middleware does not cover', async () => {
    // EmailSequence is not one of the five models lib/prisma.ts filters, so the
    // deletedAt condition has to be written out here.
    await GET(get(), ctx)
    const where = (prisma.emailSequence.findFirst as any).mock.calls[0][0].where
    expect(where.deletedAt).toBeNull()
  })
})

describe('step reconciliation keeps delivery history intact', () => {
  it('updates a matching order in place rather than recreating it', async () => {
    // Recreating would mint a new step id and orphan its EmailSequenceEvent rows.
    await PATCH(patch({ steps: validSteps }), ctx)

    expect(tx.emailStep.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'step-0' } }),
    )
    expect(tx.emailStep.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'step-1' } }),
    )
    expect(tx.emailStep.create).not.toHaveBeenCalled()
  })

  it('creates a step for an order that did not exist', async () => {
    await PATCH(
      patch({
        steps: [...validSteps, { order: 2, dayOffset: 7, subject: 'Last', bodyTemplate: 'bye' }],
      }),
      ctx,
    )

    expect(tx.emailStep.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ order: 2, sequenceId: 'seq-1' }),
      }),
    )
  })

  it('deletes a removed step when nothing references it', async () => {
    tx.emailSequenceEvent.count.mockResolvedValue(0)
    await PATCH(patch({ steps: [validSteps[0]] }), ctx)

    expect(tx.emailSequenceEvent.count).toHaveBeenCalledWith({ where: { stepId: 'step-1' } })
    expect(tx.emailStep.delete).toHaveBeenCalledWith({ where: { id: 'step-1' } })
  })

  it('deactivates instead of deleting when the step has already sent mail', async () => {
    // EmailSequenceEvent.stepId is a required FK: deleting here would either throw
    // or, with a cascade, erase the record of emails that genuinely went out.
    tx.emailSequenceEvent.count.mockResolvedValue(4)
    await PATCH(patch({ steps: [validSteps[0]] }), ctx)

    expect(tx.emailStep.delete).not.toHaveBeenCalled()
    expect(tx.emailStep.update).toHaveBeenCalledWith({
      where: { id: 'step-1' },
      data: { isActive: false },
    })
  })

  it('leaves steps alone when the payload does not mention them', async () => {
    await PATCH(patch({ name: 'Renamed only' }), ctx)

    expect(tx.emailStep.update).not.toHaveBeenCalled()
    expect(tx.emailStep.create).not.toHaveBeenCalled()
    expect(tx.emailStep.delete).not.toHaveBeenCalled()
  })

  it('reactivates a step whose order comes back', async () => {
    await PATCH(patch({ steps: validSteps }), ctx)
    const call = tx.emailStep.update.mock.calls.find((c: any) => c[0].where.id === 'step-1')
    expect(call![0].data.isActive).toBe(true)
  })
})

describe('partial update', () => {
  it.each([
    ['name', { name: 'Renamed' }],
    ['active', { active: false }],
    ['description', { description: 'why this exists' }],
  ])('applies %s without requiring the rest', async (field, body) => {
    const res = await PATCH(patch(body), ctx)
    expect(res.status).toBe(200)
    expect(tx.emailSequence.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining(body) }),
    )
  })

  it('rejects an invalid payload before touching the database', async () => {
    const res = await PATCH(patch({ name: '' }), ctx)
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(tx.emailSequence.update).not.toHaveBeenCalled()
  })
})

describe('DELETE is a soft delete', () => {
  it('stamps deletedAt and clears active rather than removing the row', async () => {
    // EmailSequenceRun and EmailSequenceEvent hold required references; a hard
    // delete would fail on the FK or destroy the campaign record. Clearing
    // `active` is what actually stops the worker sending more.
    const res = await DELETE(del(), ctx)

    expect(res.status).toBe(200)
    expect(prisma.emailSequence.update).toHaveBeenCalledWith({
      where: { id: 'seq-1' },
      data: { deletedAt: expect.any(Date), active: false },
    })
  })
})
