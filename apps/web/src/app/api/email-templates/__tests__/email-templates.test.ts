/**
 * Email templates and the notification model that had never been used.
 *
 * Both are about the same failure: a schema that promises something the code
 * never delivered. Notification has sat in the schema with two indexes and a
 * User relation since the beginning, and `prisma.notification` appeared nowhere
 * in the application.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (handler: any) => handler }))
vi.mock('@/lib/csrf', () => ({ withCsrfProtection: (handler: any) => handler }))

const { requireAuth } = vi.hoisted(() => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/api-helpers', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  requireAuth,
}))

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }))
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  auth,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    emailTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    notification: { findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
  },
}))

import { GET as listTemplates, POST as createTemplate } from '../route'
import { DELETE as deleteTemplate } from '../[id]/route'
import { GET as listNotifications, PATCH as markRead } from '../../notifications/route'
import { prisma } from '@/lib/prisma'

const ORG = 'org-1'
const ME = 'user-1'
const TEMPLATE = { id: 'tpl-1', orgId: ORG, name: 'Polite no', deletedAt: null }

const json = (url: string, method: string, body?: unknown) =>
  new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

const url = 'http://localhost:3000/api/email-templates'
const oneUrl = 'http://localhost:3000/api/email-templates/tpl-1'
const notifUrl = 'http://localhost:3000/api/notifications'
const ctx = { params: { id: 'tpl-1' } }

const validTemplate = { name: 'Polite no', subject: 'Your application', body: 'Thanks for...' }

beforeEach(() => {
  vi.clearAllMocks()
  requireAuth.mockResolvedValue({ userId: ME, orgId: ORG })
  auth.mockResolvedValue({ user: { id: ME } })
  ;(prisma.emailTemplate.findMany as any).mockResolvedValue([])
  ;(prisma.emailTemplate.findUnique as any).mockResolvedValue(null)
  ;(prisma.emailTemplate.findFirst as any).mockResolvedValue(TEMPLATE)
  ;(prisma.emailTemplate.create as any).mockResolvedValue(TEMPLATE)
  ;(prisma.emailTemplate.update as any).mockResolvedValue(TEMPLATE)
  ;(prisma.notification.findMany as any).mockResolvedValue([])
  ;(prisma.notification.count as any).mockResolvedValue(3)
  ;(prisma.notification.updateMany as any).mockResolvedValue({ count: 2 })
})

describe('email templates', () => {
  it('creates one scoped to the caller organisation', async () => {
    const res = await createTemplate(json(url, 'POST', validTemplate))

    expect(res.status).toBe(201)
    const data = (prisma.emailTemplate.create as any).mock.calls[0][0].data
    expect(data.orgId).toBe(ORG)
    expect(data.createdBy).toBe(ME)
    expect(data.category).toBe('GENERAL')
  })

  it('rejects an unknown category', async () => {
    const res = await createTemplate(json(url, 'POST', { ...validTemplate, category: 'SHOUTING' }))
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(prisma.emailTemplate.create).not.toHaveBeenCalled()
  })

  it('409s on a duplicate name', async () => {
    ;(prisma.emailTemplate.findUnique as any).mockResolvedValue(TEMPLATE)
    const res = await createTemplate(json(url, 'POST', validTemplate))

    expect(res.status).toBe(409)
    expect(prisma.emailTemplate.create).not.toHaveBeenCalled()
  })

  it('explains itself when a SOFT-DELETED template holds the name', async () => {
    // The unique index does not know about deletedAt, so this would otherwise
    // surface as a constraint violation and a 500.
    ;(prisma.emailTemplate.findUnique as any).mockResolvedValue({
      ...TEMPLATE,
      deletedAt: new Date(),
    })
    const res = await createTemplate(json(url, 'POST', validTemplate))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toMatch(/deleted/i)
  })

  it('hides deleted templates from the list', async () => {
    await listTemplates(new Request(url))
    const where = (prisma.emailTemplate.findMany as any).mock.calls[0][0].where
    expect(where.orgId).toBe(ORG)
    expect(where.deletedAt).toBeNull()
  })

  it('delete is soft, because nothing records which messages came from it', async () => {
    const res = await deleteTemplate(json(oneUrl, 'DELETE'), ctx)

    expect(res.status).toBe(200)
    expect((prisma.emailTemplate.update as any).mock.calls[0][0].data.deletedAt).toBeInstanceOf(
      Date,
    )
  })

  it("404s for another org's template", async () => {
    ;(prisma.emailTemplate.findFirst as any).mockResolvedValue(null)
    const res = await deleteTemplate(json(oneUrl, 'DELETE'), ctx)

    expect(res.status).toBe(404)
    expect(prisma.emailTemplate.update).not.toHaveBeenCalled()
  })
})

describe('notifications', () => {
  it('refuses an anonymous caller', async () => {
    auth.mockResolvedValue(null)
    const res = await listNotifications(new Request(notifUrl))

    expect(res.status).toBe(401)
    expect(prisma.notification.findMany).not.toHaveBeenCalled()
  })

  it('returns only my own, with an unread count', async () => {
    const res = await listNotifications(new Request(notifUrl))
    const body = await res.json()

    expect((prisma.notification.findMany as any).mock.calls[0][0].where.userId).toBe(ME)
    expect(body.unreadCount).toBe(3)
  })

  it('can filter to unread', async () => {
    await listNotifications(new Request(`${notifUrl}?unread=true`))
    expect((prisma.notification.findMany as any).mock.calls[0][0].where.readAt).toBeNull()
  })

  it('marks everything read when no ids are given', async () => {
    const res = await markRead(json(notifUrl, 'PATCH', {}))

    expect(res.status).toBe(200)
    const where = (prisma.notification.updateMany as any).mock.calls[0][0].where
    expect(where.userId).toBe(ME)
    expect(where.id).toBeUndefined()
  })

  it("cannot mark someone else's notification read", async () => {
    // Scoped in the where clause rather than checked first: a caller sending
    // foreign ids updates nothing, instead of getting a 403 that confirms those
    // ids exist.
    await markRead(json(notifUrl, 'PATCH', { ids: ['someone-elses'] }))

    const where = (prisma.notification.updateMany as any).mock.calls[0][0].where
    expect(where.userId).toBe(ME)
    expect(where.id).toEqual({ in: ['someone-elses'] })
  })

  it('tolerates an empty body — the bell menu sends none', async () => {
    const res = await markRead(new Request(notifUrl, { method: 'PATCH' }))
    expect(res.status).toBe(200)
  })
})
