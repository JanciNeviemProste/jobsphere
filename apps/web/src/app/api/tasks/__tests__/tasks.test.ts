/**
 * Follow-up tasks.
 *
 * A task is readable by the whole organisation, so its optional anchors are a
 * tenant boundary rather than a convenience: an application id from another
 * company would leak that application's job title through the list endpoint,
 * which includes it.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (handler: any) => handler }))
vi.mock('@/lib/csrf', () => ({ withCsrfProtection: (handler: any) => handler }))

const { notify } = vi.hoisted(() => ({ notify: vi.fn() }))
vi.mock('@/lib/notifications', () => ({ notify, notifyOrg: vi.fn() }))

const { requireAuth } = vi.hoisted(() => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/api-helpers', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  requireAuth,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    task: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    application: { findFirst: vi.fn() },
    candidate: { findFirst: vi.fn() },
    userOrgRole: { findFirst: vi.fn() },
  },
}))

import { GET, POST } from '../route'
import { PATCH, DELETE } from '../[id]/route'
import { prisma } from '@/lib/prisma'

const ORG = 'org-1'
const ME = 'user-1'
const TASK = {
  id: 'task-1',
  orgId: ORG,
  title: 'Call back',
  status: 'OPEN',
  completedAt: null,
  assigneeId: ME,
}

const json = (url: string, method: string, body?: unknown) =>
  new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

const listUrl = 'http://localhost:3000/api/tasks'
const oneUrl = 'http://localhost:3000/api/tasks/task-1'
const ctx = { params: { id: 'task-1' } }

beforeEach(() => {
  vi.clearAllMocks()
  requireAuth.mockResolvedValue({ userId: ME, orgId: ORG })
  ;(prisma.task.findMany as any).mockResolvedValue([])
  ;(prisma.task.findFirst as any).mockResolvedValue(TASK)
  ;(prisma.task.create as any).mockResolvedValue({ ...TASK, assigneeId: ME })
  ;(prisma.task.update as any).mockResolvedValue(TASK)
  ;(prisma.task.delete as any).mockResolvedValue(TASK)
  ;(prisma.application.findFirst as any).mockResolvedValue({ id: 'app-1', orgId: ORG })
  ;(prisma.candidate.findFirst as any).mockResolvedValue({ id: 'cand-1', orgId: ORG })
  ;(prisma.userOrgRole.findFirst as any).mockResolvedValue({ userId: 'user-2', orgId: ORG })
})

describe('creating a task', () => {
  it('scopes it to the caller organisation', async () => {
    const res = await POST(json(listUrl, 'POST', { title: 'Call back' }))

    expect(res.status).toBe(201)
    expect((prisma.task.create as any).mock.calls[0][0].data.orgId).toBe(ORG)
  })

  it('assigns it to the creator when nobody is named', async () => {
    // An unassigned task belongs to nobody and gets done by nobody.
    await POST(json(listUrl, 'POST', { title: 'Call back' }))
    expect((prisma.task.create as any).mock.calls[0][0].data.assigneeId).toBe(ME)
  })

  it.each([
    ['application', { applicationId: 'foreign-app' }, 'application'],
    ['candidate', { candidateId: 'foreign-cand' }, 'candidate'],
  ])('refuses an %s from another organisation', async (_label, body, model) => {
    ;(prisma[model as 'application' | 'candidate'].findFirst as any).mockResolvedValue(null)
    const res = await POST(json(listUrl, 'POST', { title: 'x', ...body }))

    expect(res.status).toBe(404)
    expect(prisma.task.create).not.toHaveBeenCalled()
  })

  it('refuses an assignee who is not in the organisation', async () => {
    ;(prisma.userOrgRole.findFirst as any).mockResolvedValue(null)
    const res = await POST(json(listUrl, 'POST', { title: 'x', assigneeId: 'outsider' }))

    expect(res.status).toBe(400)
    expect(prisma.task.create).not.toHaveBeenCalled()
  })

  it('notifies the assignee when it lands on someone else', async () => {
    ;(prisma.task.create as any).mockResolvedValue({ ...TASK, assigneeId: 'user-2' })
    await POST(json(listUrl, 'POST', { title: 'Call back', assigneeId: 'user-2' }))

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-2', type: 'TASK_ASSIGNED' }),
    )
  })

  it('does not notify you about your own task', async () => {
    // Noise is how a notification list becomes something people stop reading.
    await POST(json(listUrl, 'POST', { title: 'Call back' }))
    expect(notify).not.toHaveBeenCalled()
  })
})

describe('listing', () => {
  it('is always org-scoped', async () => {
    await GET(new Request(listUrl))
    expect((prisma.task.findMany as any).mock.calls[0][0].where.orgId).toBe(ORG)
  })

  it('filters to my tasks on request', async () => {
    await GET(new Request(`${listUrl}?mine=true`))
    expect((prisma.task.findMany as any).mock.calls[0][0].where.assigneeId).toBe(ME)
  })

  it('ignores a status outside the known set instead of returning nothing', async () => {
    await GET(new Request(`${listUrl}?status=NONSENSE`))
    expect((prisma.task.findMany as any).mock.calls[0][0].where.status).toBeUndefined()
  })

  it('puts undated tasks last — a someday is not an overdue', async () => {
    await GET(new Request(listUrl))
    const orderBy = (prisma.task.findMany as any).mock.calls[0][0].orderBy
    expect(orderBy[0]).toEqual({ dueDate: { sort: 'asc', nulls: 'last' } })
  })
})

describe('completing and reopening', () => {
  it('stamps completedAt on DONE', async () => {
    await PATCH(json(oneUrl, 'PATCH', { status: 'DONE' }), ctx)
    const data = (prisma.task.update as any).mock.calls[0][0].data
    expect(data.status).toBe('DONE')
    expect(data.completedAt).toBeInstanceOf(Date)
  })

  it('clears completedAt on reopen', async () => {
    // A task back in OPEN that still shows when it was closed is the same quiet
    // lie as a rejection reason left on a candidate who is back in process.
    ;(prisma.task.findFirst as any).mockResolvedValue({
      ...TASK,
      status: 'DONE',
      completedAt: new Date(),
    })
    await PATCH(json(oneUrl, 'PATCH', { status: 'OPEN' }), ctx)

    expect((prisma.task.update as any).mock.calls[0][0].data.completedAt).toBeNull()
  })

  it('keeps the original completion time when DONE is re-sent', async () => {
    const first = new Date('2026-01-01')
    ;(prisma.task.findFirst as any).mockResolvedValue({
      ...TASK,
      status: 'DONE',
      completedAt: first,
    })
    await PATCH(json(oneUrl, 'PATCH', { status: 'DONE' }), ctx)

    expect((prisma.task.update as any).mock.calls[0][0].data.completedAt).toBe(first)
  })

  it('rejects an unknown status', async () => {
    const res = await PATCH(json(oneUrl, 'PATCH', { status: 'MAYBE' }), ctx)
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(prisma.task.update).not.toHaveBeenCalled()
  })
})

describe('tenant boundary on a single task', () => {
  it.each([
    ['PATCH', () => PATCH(json(oneUrl, 'PATCH', { title: 'x' }), ctx)],
    ['DELETE', () => DELETE(json(oneUrl, 'DELETE'), ctx)],
  ] as const)("%s 404s for another org's task and writes nothing", async (_m, invoke) => {
    ;(prisma.task.findFirst as any).mockResolvedValue(null)
    const res = await invoke()

    expect(res.status).toBe(404)
    expect(prisma.task.update).not.toHaveBeenCalled()
    expect(prisma.task.delete).not.toHaveBeenCalled()
  })
})
