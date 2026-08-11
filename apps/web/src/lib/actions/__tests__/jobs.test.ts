/**
 * Server actions are a second door onto the same mutations as /api/jobs.
 *
 * They cannot be wrapped in withCsrfProtection/withRateLimit — Next invokes them
 * directly — so the authorisation inside the function body is the entire defence.
 * Until this suite existed there was none to speak of: all three actions accepted
 * any organisation member, while PATCH/DELETE /api/jobs/[id] required
 * ORG_ADMIN or RECRUITER. An AGENCY member could close or delete another team's
 * posting through the action after being refused by the API.
 *
 * The tests assert the negative case the hard way: on refusal, no write may reach
 * Prisma. Asserting only on the thrown error would pass even if the action deleted
 * the row first and threw afterwards.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth }))

const { addEmbeddingJob, addMatchScoreCacheJob } = vi.hoisted(() => ({
  addEmbeddingJob: vi.fn().mockResolvedValue(undefined),
  addMatchScoreCacheJob: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/queue', () => ({ addEmbeddingJob, addMatchScoreCacheJob }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    job: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    userOrgRole: { findFirst: vi.fn() },
  },
}))

import { createJob, updateJobStatus, deleteJob } from '../jobs'
import { prisma } from '@/lib/prisma'

const SESSION = { user: { id: 'user-1' } }
const JOB = { id: 'job-1', orgId: 'org-1', title: 'Dev' }

const newJobInput = {
  title: 'Dev',
  location: 'Bratislava',
  workMode: 'REMOTE',
  type: 'FULL_TIME',
  seniority: 'MEDIOR',
  description: 'desc',
  orgId: 'org-1',
}

/** No write of any kind may have been issued. */
function expectNoWrites() {
  expect(prisma.job.create).not.toHaveBeenCalled()
  expect(prisma.job.update).not.toHaveBeenCalled()
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.mockResolvedValue(SESSION)
  ;(prisma.job.findFirst as any).mockResolvedValue(JOB)
  ;(prisma.job.create as any).mockResolvedValue(JOB)
  ;(prisma.job.update as any).mockResolvedValue({ ...JOB, status: 'PAUSED' })
})

describe.each([
  ['createJob', () => createJob(newJobInput)],
  ['updateJobStatus', () => updateJobStatus('job-1', 'PAUSED')],
  ['deleteJob', () => deleteJob('job-1')],
] as const)('%s — authorisation', (_name, invoke) => {
  it('rejects an anonymous caller and writes nothing', async () => {
    auth.mockResolvedValue(null)
    await expect(invoke()).rejects.toThrow()
    expectNoWrites()
  })

  it('rejects a caller with no membership in the organisation', async () => {
    ;(prisma.userOrgRole.findFirst as any).mockResolvedValue(null)
    await expect(invoke()).rejects.toThrow()
    expectNoWrites()
  })

  it.each(['AGENCY', 'HIRING_MANAGER'])(
    'rejects a %s member — the API refuses them too',
    async (role) => {
      ;(prisma.userOrgRole.findFirst as any).mockResolvedValue({
        userId: 'user-1',
        orgId: 'org-1',
        role,
      })
      await expect(invoke()).rejects.toThrow('Forbidden')
      expectNoWrites()
    },
  )

  it.each(['ORG_ADMIN', 'RECRUITER'])('allows a %s member', async (role) => {
    ;(prisma.userOrgRole.findFirst as any).mockResolvedValue({
      userId: 'user-1',
      orgId: 'org-1',
      role,
    })
    await expect(invoke()).resolves.toBeDefined()
  })
})

describe('updateJobStatus — input validation', () => {
  beforeEach(() => {
    ;(prisma.userOrgRole.findFirst as any).mockResolvedValue({ role: 'ORG_ADMIN' })
  })

  it('rejects a status outside the allowed set before touching the database', async () => {
    await expect(updateJobStatus('job-1', 'DELETED_BY_ME')).rejects.toThrow('Invalid status value')
    expect(prisma.job.findFirst).not.toHaveBeenCalled()
    expectNoWrites()
  })

  it.each(['DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED'])('accepts %s', async (status) => {
    await expect(updateJobStatus('job-1', status)).resolves.toBeDefined()
  })
})

describe('soft-deleted jobs stay deleted', () => {
  beforeEach(() => {
    ;(prisma.userOrgRole.findFirst as any).mockResolvedValue({ role: 'ORG_ADMIN' })
  })

  // The lookup must go through findFirst, which the soft-delete middleware in
  // lib/prisma.ts augments with `deletedAt: null`. findUnique is NOT covered by
  // that middleware, so using it here would return a deleted row and let
  // updateJobStatus resurrect it by setting the status back to PUBLISHED.
  it.each([
    ['updateJobStatus', () => updateJobStatus('job-1', 'PUBLISHED')],
    ['deleteJob', () => deleteJob('job-1')],
  ] as const)('%s looks the job up via findFirst, not findUnique', async (_n, invoke) => {
    await invoke()
    expect(prisma.job.findFirst).toHaveBeenCalled()
    expect(prisma.job.findUnique).not.toHaveBeenCalled()
  })

  it.each([
    ['updateJobStatus', () => updateJobStatus('job-1', 'PUBLISHED')],
    ['deleteJob', () => deleteJob('job-1')],
  ] as const)('%s refuses when the job is already gone', async (_n, invoke) => {
    ;(prisma.job.findFirst as any).mockResolvedValue(null)
    await expect(invoke()).rejects.toThrow('Job not found')
    expectNoWrites()
  })
})

describe('deleteJob is a soft delete', () => {
  it('stamps deletedAt and CLOSED rather than removing the row', async () => {
    ;(prisma.userOrgRole.findFirst as any).mockResolvedValue({ role: 'ORG_ADMIN' })
    await deleteJob('job-1')

    expect(prisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({ status: 'CLOSED', deletedAt: expect.any(Date) }),
      }),
    )
  })
})

describe('createJob', () => {
  beforeEach(() => {
    ;(prisma.userOrgRole.findFirst as any).mockResolvedValue({ role: 'RECRUITER' })
  })

  it('scopes the new job to the requested organisation', async () => {
    await createJob(newJobInput)
    expect(prisma.job.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: 'org-1', createdBy: 'user-1' }),
      }),
    )
  })

  it('still returns the job when the background queues are down', async () => {
    // Embeddings and match-score caching are explicitly nice-to-have; a Redis
    // outage must not stop an employer from publishing a position.
    addEmbeddingJob.mockRejectedValueOnce(new Error('redis down'))
    addMatchScoreCacheJob.mockRejectedValueOnce(new Error('redis down'))
    await expect(createJob(newJobInput)).resolves.toBeDefined()
  })
})
