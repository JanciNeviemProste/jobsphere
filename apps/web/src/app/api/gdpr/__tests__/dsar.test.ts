/**
 * GDPR DSAR endpoint.
 *
 * A DELETE request here is irreversible and self-service: it hard-erases the
 * user and every candidate row linked to them, with no admin in the loop. The
 * properties that matter are therefore about honesty of the record rather than
 * about who may call it —
 *
 *   - a failed erasure must NOT be reported as completed, or the 30-day clock
 *     stops on a request nobody will ever process
 *   - a failed notification email must NOT undo a successful erasure
 *
 * Both are easy to get backwards, and neither is visible from the status code
 * alone.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (handler: any) => handler }))
vi.mock('@/lib/csrf', () => ({ withCsrfProtection: (handler: any) => handler }))

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth }))

const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendEmail }))

const { eraseUserData } = vi.hoisted(() => ({ eraseUserData: vi.fn() }))
vi.mock('@/services/gdpr.service', () => ({ GdprService: { eraseUserData } }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dSARRequest: { create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  },
}))

import { POST, GET } from '../dsar/route'
import { prisma } from '@/lib/prisma'

const SESSION = { user: { id: 'user-1', email: 'jan@example.com', name: 'Jan' } }

const post = (body: unknown) =>
  new Request('http://localhost:3000/api/gdpr/dsar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'user-agent': 'vitest' },
    body: JSON.stringify(body),
  })

beforeEach(() => {
  vi.clearAllMocks()
  auth.mockResolvedValue(SESSION)
  ;(prisma.dSARRequest.create as any).mockResolvedValue({
    id: 'dsar-1',
    userId: 'user-1',
    email: 'jan@example.com',
    requestType: 'EXPORT',
    status: 'PENDING',
  })
  ;(prisma.dSARRequest.update as any).mockResolvedValue({ id: 'dsar-1', status: 'COMPLETED' })
  ;(prisma.dSARRequest.findMany as any).mockResolvedValue([])
  eraseUserData.mockResolvedValue({
    candidateIds: ['cand-1'],
    documentsDeleted: 2,
    blobsDeleted: 2,
    applicationsDeleted: 1,
    resumesDeleted: 1,
  })
  sendEmail.mockResolvedValue(undefined)
})

describe('POST — access and validation', () => {
  it('refuses an anonymous caller and records nothing', async () => {
    auth.mockResolvedValue(null)
    const res = await POST(post({ type: 'EXPORT' }))
    expect(res.status).toBe(401)
    expect(prisma.dSARRequest.create).not.toHaveBeenCalled()
    expect(eraseUserData).not.toHaveBeenCalled()
  })

  it.each(['RECTIFY', 'delete', '', null, 'DROP TABLE'])(
    'rejects %s as a request type without erasing anything',
    async (type) => {
      const res = await POST(post({ type }))
      expect(res.status).toBe(400)
      expect(prisma.dSARRequest.create).not.toHaveBeenCalled()
      expect(eraseUserData).not.toHaveBeenCalled()
    },
  )

  it('records the request against the authenticated user, not a client-supplied id', async () => {
    await POST(post({ type: 'EXPORT', userId: 'someone-else' }))
    expect(prisma.dSARRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1', email: 'jan@example.com' }),
      }),
    )
  })

  it('captures the request origin for the audit trail', async () => {
    await POST(post({ type: 'EXPORT' }))
    const data = (prisma.dSARRequest.create as any).mock.calls[0][0].data
    expect(data).toHaveProperty('ipAddress')
    expect(data.userAgent).toBe('vitest')
  })
})

describe('POST EXPORT — recorded, not executed', () => {
  it('leaves the request PENDING for manual processing', async () => {
    const res = await POST(post({ type: 'EXPORT' }))
    expect(res.status).toBe(200)
    expect(eraseUserData).not.toHaveBeenCalled()
    await expect(res.json()).resolves.toMatchObject({ success: true })
  })

  it('tells the user about the 30-day statutory window', async () => {
    const res = await POST(post({ type: 'EXPORT' }))
    const body = await res.json()
    expect(body.message).toMatch(/30 days/)
  })

  it('still succeeds when notification email is down', async () => {
    // The request is already recorded at this point; failing it would lose the
    // record and restart the user's clock.
    sendEmail.mockRejectedValue(new Error('SMTP down'))
    const res = await POST(post({ type: 'EXPORT' }))
    expect(res.status).toBe(200)
  })
})

describe('POST DELETE — Art. 17 erasure', () => {
  it('erases the authenticated user and marks the request completed', async () => {
    const res = await POST(post({ type: 'DELETE' }))
    expect(res.status).toBe(200)
    expect(eraseUserData).toHaveBeenCalledWith('user-1')
    expect(prisma.dSARRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'dsar-1' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    )
  })

  it('records what was erased, for proof of compliance', async () => {
    await POST(post({ type: 'DELETE' }))
    const data = (prisma.dSARRequest.update as any).mock.calls[0][0].data
    expect(data.responseData).toMatchObject({
      candidateIds: ['cand-1'],
      documentsDeleted: 2,
      blobsDeleted: 2,
    })
    expect(data.completedAt).toBeInstanceOf(Date)
  })

  it('does NOT report success when the erasure failed', async () => {
    // The critical one. Marking a failed erasure COMPLETED stops the 30-day
    // clock on a request that nobody will ever pick up, and the user has been
    // told their data is gone when it is not.
    eraseUserData.mockRejectedValue(new Error('FK constraint'))
    const res = await POST(post({ type: 'DELETE' }))

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.message).toBeUndefined()
    expect(prisma.dSARRequest.update).not.toHaveBeenCalled()
  })

  it('leaves a failed request PENDING so an admin can finish it', async () => {
    eraseUserData.mockRejectedValue(new Error('FK constraint'))
    const res = await POST(post({ type: 'DELETE' }))
    const body = await res.json()
    expect(body.request.status).toBe('PENDING')
    expect(body.error).toMatch(/30 days/)
  })

  it('does not undo a successful erasure because an email bounced', async () => {
    sendEmail.mockRejectedValue(new Error('mailbox full'))
    const res = await POST(post({ type: 'DELETE' }))
    expect(res.status).toBe(200)
    expect(prisma.dSARRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }),
    )
  })

  it('notifies the GDPR admin as well as the user', async () => {
    await POST(post({ type: 'DELETE' }))
    const recipients = sendEmail.mock.calls.map((c) => c[0].to)
    expect(recipients).toContain('jan@example.com')
    expect(recipients.length).toBeGreaterThanOrEqual(2)
  })
})

describe('GET — a data subject sees only their own requests', () => {
  it('refuses an anonymous caller', async () => {
    auth.mockResolvedValue(null)
    const res = await GET(new Request('http://localhost:3000/api/gdpr/dsar'))
    expect(res.status).toBe(401)
    expect(prisma.dSARRequest.findMany).not.toHaveBeenCalled()
  })

  it('scopes the query to the session user', async () => {
    await GET(new Request('http://localhost:3000/api/gdpr/dsar'))
    expect(prisma.dSARRequest.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
    })
  })

  it('is deliberately unpaginated — truncating a subject own history is a compliance gap', async () => {
    await GET(new Request('http://localhost:3000/api/gdpr/dsar'))
    const arg = (prisma.dSARRequest.findMany as any).mock.calls[0][0]
    expect(arg.take).toBeUndefined()
  })
})
