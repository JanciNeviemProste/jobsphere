/**
 * LOGIC-010 — idempotent email sequence engine.
 *
 * Locks in the engine invariants:
 *  1. DEDUPE: a step that already has a SENT EmailSequenceEvent is NOT resent.
 *  2. After a successful send, a SENT event is written AND currentStep is
 *     incremented (atomically, via $transaction).
 *  3. The first step is held until its dayOffset is due (no immediate blast).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendEmail }))

vi.mock('@/lib/unsubscribe', () => ({
  unsubscribeFooterHtml: () => '<p>unsubscribe</p>',
}))

// The worker module instantiates a BullMQ Worker at import time and references
// the email-sequence queue. Mock both so importing the module is side-effect free.
const { queueAdd } = vi.hoisted(() => ({ queueAdd: vi.fn() }))
vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(() => ({ on: vi.fn() })),
  Job: class {},
}))
vi.mock('@/lib/queue', () => ({
  connection: {},
  emailSequenceQueue: { add: queueAdd },
}))

vi.mock('@/lib/cron', () => ({ runEmailSequenceJob: vi.fn() }))

// Shared prisma mock (worker imports from '@/lib/db' which re-exports prisma).
vi.mock('@/lib/db', () => ({
  prisma: {
    emailSequenceRun: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    emailSequenceEvent: { findFirst: vi.fn(), create: vi.fn() },
    candidate: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
    application: { findFirst: vi.fn() },
    emailMessage: { count: vi.fn() },
    emailEvent: { count: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { processEmailStep } from '../email-sequence.worker'
import { prisma } from '@/lib/db'

const RUN_ID = 'crun0000000000000000000001'
const STEP_ID = 'cstep0000000000000000000001'
const CAND_ID = 'ccand0000000000000000000001'

function makeRun(overrides: Record<string, any> = {}) {
  return {
    id: RUN_ID,
    candidateId: CAND_ID,
    status: 'ACTIVE',
    currentStep: 0,
    startedAt: new Date('2020-01-01T00:00:00Z'),
    sequence: {
      orgId: 'corg000000000000000000001',
      steps: [
        {
          id: STEP_ID,
          order: 0,
          dayOffset: 0,
          hourOffset: 0,
          subject: 'Hi {{candidateName}}',
          bodyTemplate: 'Hello from {{companyName}}',
          conditions: null,
        },
        {
          id: 'cstep0000000000000000000002',
          order: 1,
          dayOffset: 3,
          hourOffset: 0,
          subject: 'Follow up',
          bodyTemplate: 'Following up',
          conditions: null,
        },
      ],
    },
    ...overrides,
  }
}

function job(data: { enrollmentId: string; stepId: string }) {
  return { data, id: 'job-1' } as any
}

describe('LOGIC-010 — idempotent sequence engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendEmail.mockResolvedValue({ success: true })
    vi.mocked(prisma.candidate.findUnique).mockResolvedValue({
      id: CAND_ID,
      contacts: [{ email: 'cand@example.com', fullName: 'Cand', isPrimary: true }],
    } as any)
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ name: 'Acme' } as any)
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) =>
      cb({
        emailSequenceEvent: { create: vi.fn() },
        emailSequenceRun: { updateMany: vi.fn() },
      }),
    )
  })

  it('does NOT resend a step that already has a SENT event (dedupe)', async () => {
    vi.mocked(prisma.emailSequenceRun.findUnique).mockResolvedValue(makeRun() as any)
    // A SENT event already exists for (run, step).
    vi.mocked(prisma.emailSequenceEvent.findFirst).mockResolvedValueOnce({ id: 'evt-1' } as any)
    vi.mocked(prisma.emailSequenceRun.updateMany).mockResolvedValue({ count: 1 } as any)

    const res = await processEmailStep(job({ enrollmentId: RUN_ID, stepId: STEP_ID }))

    expect(sendEmail).not.toHaveBeenCalled()
    expect(res).toMatchObject({ skipped: true, reason: 'already-sent' })
  })

  it('sends a due first step, writes SENT event and increments currentStep', async () => {
    vi.mocked(prisma.emailSequenceRun.findUnique).mockResolvedValue(makeRun() as any)
    // No existing SENT event for this step; no prior SENT (baseline = startedAt).
    vi.mocked(prisma.emailSequenceEvent.findFirst).mockResolvedValue(null as any)

    const eventCreate = vi.fn()
    const runUpdateMany = vi.fn()
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) =>
      cb({
        emailSequenceEvent: { create: eventCreate },
        emailSequenceRun: { updateMany: runUpdateMany },
      }),
    )

    const res = await processEmailStep(job({ enrollmentId: RUN_ID, stepId: STEP_ID }))

    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'cand@example.com', subject: 'Hi Cand' }),
    )
    // SENT event written for this run+step.
    expect(eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ runId: RUN_ID, stepId: STEP_ID, kind: 'SENT' }),
      }),
    )
    // currentStep incremented from 0 -> 1, guarded on the expected value.
    expect(runUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: RUN_ID, currentStep: 0 },
        data: expect.objectContaining({ currentStep: 1 }),
      }),
    )
    expect(res).toMatchObject({ success: true })
  })

  it('holds the first step until its dayOffset is due (no immediate blast)', async () => {
    // dayOffset 5 from a startedAt of "now" → not due yet.
    const run = makeRun({
      startedAt: new Date(),
      sequence: {
        orgId: 'corg000000000000000000001',
        steps: [
          {
            id: STEP_ID,
            order: 0,
            dayOffset: 5,
            hourOffset: 0,
            subject: 'Hi',
            bodyTemplate: 'Body',
            conditions: null,
          },
        ],
      },
    })
    vi.mocked(prisma.emailSequenceRun.findUnique).mockResolvedValue(run as any)
    vi.mocked(prisma.emailSequenceEvent.findFirst).mockResolvedValue(null as any)

    const res = await processEmailStep(job({ enrollmentId: RUN_ID, stepId: STEP_ID }))

    expect(sendEmail).not.toHaveBeenCalled()
    expect(res).toMatchObject({ skipped: true, reason: 'not-due' })
  })
})
