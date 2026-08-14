/**
 * The inline runners replace a worker process, so the properties worth pinning
 * are the ones a worker gave for free: one failing item must not abort the
 * batch, and finished work must stop being rescanned forever.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const { processEmailStep } = vi.hoisted(() => ({ processEmailStep: vi.fn() }))
vi.mock('@/workers/email-sequence.worker', () => ({ processEmailStep }))

const { processAssessmentReminder } = vi.hoisted(() => ({ processAssessmentReminder: vi.fn() }))
vi.mock('@/workers/assessment-reminder.worker', () => ({ processAssessmentReminder }))

const { generateCVEmbeddings, generateJobEmbedding } = vi.hoisted(() => ({
  generateCVEmbeddings: vi.fn(),
  generateJobEmbedding: vi.fn(),
}))
vi.mock('@/lib/embeddings', () => ({ generateCVEmbeddings, generateJobEmbedding }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    emailSequenceRun: { findMany: vi.fn(), update: vi.fn() },
    assessmentInvite: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}))

import {
  runEmailSequencesInline,
  runAssessmentRemindersInline,
  runEmbeddingBackfill,
} from '../run-inline'
import { prisma } from '@/lib/prisma'

const runWithSteps = (id: string, currentStep: number, stepIds: string[]) => ({
  id,
  currentStep,
  sequence: { steps: stepIds.map((sid) => ({ id: sid })) },
})

beforeEach(() => {
  vi.clearAllMocks()
  ;(prisma.emailSequenceRun.findMany as any).mockResolvedValue([])
  ;(prisma.emailSequenceRun.update as any).mockResolvedValue({})
  ;(prisma.assessmentInvite.findMany as any).mockResolvedValue([])
  ;(prisma.$queryRaw as any).mockResolvedValue([])
  processEmailStep.mockResolvedValue(undefined)
  processAssessmentReminder.mockResolvedValue(undefined)
  generateCVEmbeddings.mockResolvedValue(undefined)
  generateJobEmbedding.mockResolvedValue(undefined)
})

describe('email sequences', () => {
  it('processes the step the run is currently on', async () => {
    ;(prisma.emailSequenceRun.findMany as any).mockResolvedValue([
      runWithSteps('run-1', 1, ['step-a', 'step-b', 'step-c']),
    ])

    const result = await runEmailSequencesInline()

    expect(processEmailStep).toHaveBeenCalledWith(
      expect.objectContaining({ data: { enrollmentId: 'run-1', stepId: 'step-b' } }),
    )
    expect(result.processed).toBe(1)
  })

  it('passes the job name the dispatcher expects', async () => {
    // The worker dispatcher branches on name; 'daily-scan' would recurse into
    // the scan instead of sending the step.
    ;(prisma.emailSequenceRun.findMany as any).mockResolvedValue([
      runWithSteps('run-1', 0, ['step-a']),
    ])
    await runEmailSequencesInline()
    expect(processEmailStep.mock.calls[0][0].name).toBe('send-step')
  })

  it('completes a run that has passed its last step instead of rescanning it forever', async () => {
    ;(prisma.emailSequenceRun.findMany as any).mockResolvedValue([
      runWithSteps('run-done', 2, ['step-a', 'step-b']),
    ])

    await runEmailSequencesInline()

    expect(prisma.emailSequenceRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-done' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    )
    expect(processEmailStep).not.toHaveBeenCalled()
  })

  it('completes a run whose sequence has no steps at all', async () => {
    ;(prisma.emailSequenceRun.findMany as any).mockResolvedValue([runWithSteps('run-empty', 0, [])])
    await runEmailSequencesInline()
    expect(prisma.emailSequenceRun.update).toHaveBeenCalled()
  })

  it('keeps going when one run throws', async () => {
    // A worker would have failed just that job. Losing the rest of the batch to
    // one bad row is the regression this guards.
    ;(prisma.emailSequenceRun.findMany as any).mockResolvedValue([
      runWithSteps('run-1', 0, ['step-a']),
      runWithSteps('run-2', 0, ['step-b']),
      runWithSteps('run-3', 0, ['step-c']),
    ])
    processEmailStep.mockRejectedValueOnce(new Error('SMTP exploded'))

    const result = await runEmailSequencesInline()

    expect(processEmailStep).toHaveBeenCalledTimes(3)
    expect(result).toMatchObject({ processed: 2, failed: 1 })
  })

  it('reports an empty run rather than throwing', async () => {
    const result = await runEmailSequencesInline()
    expect(result).toMatchObject({ processed: 0, failed: 0, remaining: 0, deadlineHit: false })
  })
})

describe('assessment reminders', () => {
  it('only considers invites that are pending, stale and unexpired', async () => {
    await runAssessmentRemindersInline()

    const where = (prisma.assessmentInvite.findMany as any).mock.calls[0][0].where
    expect(where.status).toEqual({ in: ['PENDING', 'STARTED'] })
    expect(where.createdAt.lte).toBeInstanceOf(Date)
    // Never remind twice in the same two-day window.
    expect(where.OR).toEqual([{ remindedAt: null }, { remindedAt: { lte: expect.any(Date) } }])
  })

  it('sends one reminder per invite', async () => {
    ;(prisma.assessmentInvite.findMany as any).mockResolvedValue([{ id: 'inv-1' }, { id: 'inv-2' }])

    const result = await runAssessmentRemindersInline()

    expect(processAssessmentReminder).toHaveBeenCalledTimes(2)
    expect(processAssessmentReminder.mock.calls[0][0]).toMatchObject({
      name: 'send-reminder',
      data: { inviteId: 'inv-1' },
    })
    expect(result.processed).toBe(2)
  })

  it('keeps going when one reminder throws', async () => {
    ;(prisma.assessmentInvite.findMany as any).mockResolvedValue([{ id: 'a' }, { id: 'b' }])
    processAssessmentReminder.mockRejectedValueOnce(new Error('no email on file'))

    const result = await runAssessmentRemindersInline()

    expect(result).toMatchObject({ processed: 1, failed: 1 })
  })

  it('bounds the batch so one invocation cannot run away', async () => {
    await runAssessmentRemindersInline()
    expect((prisma.assessmentInvite.findMany as any).mock.calls[0][0].take).toBeGreaterThan(0)
  })
})

describe('embedding backfill', () => {
  const withTargets = (resumes: string[], jobs: string[]) => {
    ;(prisma.$queryRaw as any)
      .mockResolvedValueOnce(resumes.map((resumeId) => ({ resumeId })))
      .mockResolvedValueOnce(jobs.map((id) => ({ id })))
  }

  it('generates for both resumes and jobs', async () => {
    withTargets(['res-1'], ['job-1', 'job-2'])

    const result = await runEmbeddingBackfill()

    expect(generateCVEmbeddings).toHaveBeenCalledWith('res-1')
    expect(generateJobEmbedding).toHaveBeenCalledWith('job-1')
    expect(generateJobEmbedding).toHaveBeenCalledWith('job-2')
    expect(result.processed).toBe(3)
  })

  it('keeps going when one item throws', async () => {
    // Each item is a paid API call against untrusted text. One CV that blows up
    // must not park the backlog behind it until someone reads a log.
    withTargets(['res-1', 'res-2'], [])
    generateCVEmbeddings.mockRejectedValueOnce(new Error('bad input'))

    const result = await runEmbeddingBackfill()

    expect(generateCVEmbeddings).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({ processed: 1, failed: 1 })
  })

  it('does nothing when there is no backlog', async () => {
    const result = await runEmbeddingBackfill()

    expect(generateCVEmbeddings).not.toHaveBeenCalled()
    expect(generateJobEmbedding).not.toHaveBeenCalled()
    expect(result).toMatchObject({ processed: 0, failed: 0, remaining: 0 })
  })
})
