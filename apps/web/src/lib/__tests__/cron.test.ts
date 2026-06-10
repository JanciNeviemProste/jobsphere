/**
 * Cron / Retention Unit Tests
 *
 * Verifies that:
 *  - initializeCronJobs() schedules the expected repeatable patterns on the
 *    correct queues (assessment reminders, email sequences, retention).
 *  - runRetentionJob() hard-erases soft-deleted candidates past the retention
 *    cutoff (reusing GdprService.eraseCandidatesPII) and anonymizes old audit logs.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// --- Mocks ------------------------------------------------------------------
// NOTE: vi.mock factories are hoisted above imports, so any value they reference
// must be created with vi.hoisted (which is hoisted too).

const { eraseCandidatesPII, assessmentReminderQueue, emailSequenceQueue, retentionQueue } =
  vi.hoisted(() => {
    const makeQueueMock = () => ({
      add: vi.fn().mockResolvedValue({ id: 'job-id' }),
      getRepeatableJobs: vi.fn().mockResolvedValue([]),
      removeRepeatableByKey: vi.fn().mockResolvedValue(undefined),
    })
    return {
      eraseCandidatesPII: vi.fn(),
      assessmentReminderQueue: makeQueueMock(),
      emailSequenceQueue: makeQueueMock(),
      retentionQueue: makeQueueMock(),
    }
  })

vi.mock('@/services/gdpr.service', () => ({
  eraseCandidatesPII,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    candidate: { findMany: vi.fn() },
    auditLog: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/queue', () => ({
  assessmentReminderQueue,
  emailSequenceQueue,
  retentionQueue,
  addAssessmentReminderJob: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { initializeCronJobs, runRetentionJob } from '@/lib/cron'

describe('initializeCronJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    assessmentReminderQueue.getRepeatableJobs.mockResolvedValue([])
    emailSequenceQueue.getRepeatableJobs.mockResolvedValue([])
    retentionQueue.getRepeatableJobs.mockResolvedValue([])
  })

  it('schedules the expected repeatable jobs on the correct queues', async () => {
    await initializeCronJobs()

    // Assessment reminders: daily 9 AM UTC
    expect(assessmentReminderQueue.add).toHaveBeenCalledWith(
      'daily-scan',
      expect.any(Object),
      expect.objectContaining({
        repeat: expect.objectContaining({ pattern: '0 9 * * *', tz: 'UTC' }),
      }),
    )

    // Email sequences: every 15 minutes, job name MUST match the worker dispatcher.
    expect(emailSequenceQueue.add).toHaveBeenCalledWith(
      'process-sequences',
      expect.any(Object),
      expect.objectContaining({
        repeat: expect.objectContaining({ pattern: '*/15 * * * *' }),
      }),
    )

    // Retention: daily 3 AM UTC
    expect(retentionQueue.add).toHaveBeenCalledWith(
      'run-retention',
      expect.any(Object),
      expect.objectContaining({
        repeat: expect.objectContaining({ pattern: '0 3 * * *', tz: 'UTC' }),
      }),
    )
  })
})

describe('runRetentionJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // $transaction runs the provided callback against a tx client.
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn({} as any))
  })

  it('hard-erases expired soft-deleted candidates via eraseCandidatesPII', async () => {
    vi.mocked(prisma.candidate.findMany).mockResolvedValue([{ id: 'c1' }, { id: 'c2' }] as any)
    vi.mocked(prisma.auditLog.updateMany).mockResolvedValue({ count: 0 } as any)

    const result = await runRetentionJob()

    // Candidates were queried with a deletedAt cutoff in the past.
    expect(prisma.candidate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: expect.objectContaining({ not: null }),
        }),
      }),
    )

    // The erasure reused GdprService.eraseCandidatesPII with the candidate ids.
    expect(eraseCandidatesPII).toHaveBeenCalledWith(expect.anything(), ['c1', 'c2'])
    expect(result.candidatesErased).toBe(2)
  })

  it('skips candidate erasure when none are past the retention window', async () => {
    vi.mocked(prisma.candidate.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.auditLog.updateMany).mockResolvedValue({ count: 7 } as any)

    const result = await runRetentionJob()

    expect(eraseCandidatesPII).not.toHaveBeenCalled()
    expect(result.candidatesErased).toBe(0)
    expect(result.auditLogsAnonymized).toBe(7)
  })

  it('anonymizes old audit logs by nulling PII fields', async () => {
    vi.mocked(prisma.candidate.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.auditLog.updateMany).mockResolvedValue({ count: 3 } as any)

    await runRetentionJob()

    expect(prisma.auditLog.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: null, ipAddress: null, userAgent: null },
      }),
    )
  })

  it('is crash-safe: an audit phase failure does not throw', async () => {
    vi.mocked(prisma.candidate.findMany).mockResolvedValue([] as any)
    vi.mocked(prisma.auditLog.updateMany).mockRejectedValue(new Error('db down'))

    await expect(runRetentionJob()).resolves.toEqual(
      expect.objectContaining({ candidatesErased: 0, auditLogsAnonymized: 0 }),
    )
  })
})
