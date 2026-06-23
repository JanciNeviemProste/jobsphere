/**
 * Org member invitation — email delivery regression pins.
 *
 * Locks in the fix for the gap where invited members were never emailed:
 *  1. A brand-new invitee gets a set-password (reset-password) token persisted
 *     and a single invite email whose body links to /reset-password?token=.
 *  2. An existing user added to the org gets the notification-variant email.
 *  3. Email is best-effort: if sendEmail rejects, the POST still returns 200.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// CSRF is skipped automatically when NODE_ENV === 'test', but mock it as a
// pass-through to be explicit and independent of env timing.
vi.mock('@/lib/csrf', () => ({
  withCsrfProtection: (handler: any) => handler,
}))

vi.mock('@/lib/rate-limit', () => ({
  withRateLimit: (handler: any) => handler,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), apiRequest: vi.fn(), apiError: vi.fn() },
}))

// bcrypt hash is slow + irrelevant here — stub it.
vi.mock('bcryptjs', () => ({ hash: vi.fn().mockResolvedValue('hashed') }))

const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn() }))
vi.mock('@/lib/email', () => ({
  sendEmail,
  // The route imports getInvitationEmail; keep a real-ish builder so the
  // assertion on the rendered html (the /reset-password link) is meaningful.
  getInvitationEmail: ({ actionUrl }: { actionUrl: string }) => `<a href="${actionUrl}">join</a>`,
}))

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    userOrgRole: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    verificationToken: { create: vi.fn() },
  },
}))

import { POST } from '../route'
import { prisma } from '@/lib/prisma'

const ORG_ID = 'org-abc'

function req(body: unknown) {
  return {
    json: async () => body,
  } as any
}

describe('POST /api/organizations/current/members — invite emails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.mockResolvedValue({ user: { id: 'admin-1', email: 'admin@b.c', name: 'Admin' } })
    // Caller is an ORG_ADMIN; org name resolved via include.
    vi.mocked(prisma.userOrgRole.findFirst).mockResolvedValue({
      orgId: ORG_ID,
      organization: { name: 'Acme Inc' },
    } as any)
    // Not yet a member of this org.
    vi.mocked(prisma.userOrgRole.findUnique).mockResolvedValue(null as any)
    vi.mocked(prisma.userOrgRole.create).mockResolvedValue({
      id: 'role-1',
      user: { id: 'u-1', name: 'New', email: 'new@example.com', avatar: null },
    } as any)
    vi.mocked(prisma.verificationToken.create).mockResolvedValue({} as any)
    sendEmail.mockResolvedValue({ success: true })
  })

  it('(a) brand-new invitee: persists a token and emails a /reset-password link', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as any)
    vi.mocked(prisma.user.create).mockResolvedValue({ id: 'u-1', email: 'new@example.com' } as any)

    const res = await POST(req({ email: 'new@example.com', role: 'RECRUITER' }))

    expect(res.status).toBe(200)

    // A set-password token was persisted for this email.
    expect(prisma.verificationToken.create).toHaveBeenCalledTimes(1)
    const tokenArg = vi.mocked(prisma.verificationToken.create).mock.calls[0][0] as any
    expect(tokenArg.data.identifier).toBe('new@example.com')
    expect(typeof tokenArg.data.token).toBe('string')
    expect(tokenArg.data.expires).toBeInstanceOf(Date)

    // Exactly one email, whose html contains the set-password link.
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const emailArg = sendEmail.mock.calls[0][0]
    expect(emailArg.to).toBe('new@example.com')
    expect(emailArg.html).toContain(`/reset-password?token=${tokenArg.data.token}`)
  })

  it('(b) existing user: sends the notification-variant email (no new token)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u-1',
      email: 'existing@example.com',
    } as any)

    const res = await POST(req({ email: 'existing@example.com', role: 'HIRING_MANAGER' }))

    expect(res.status).toBe(200)

    // No set-password token for an already-registered user.
    expect(prisma.verificationToken.create).not.toHaveBeenCalled()
    expect(prisma.user.create).not.toHaveBeenCalled()

    // Notification email points at /login (the existing-user variant).
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const emailArg = sendEmail.mock.calls[0][0]
    expect(emailArg.to).toBe('existing@example.com')
    expect(emailArg.html).toContain('/login')
  })

  it('(c) email failure is best-effort: POST still returns 200', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as any)
    vi.mocked(prisma.user.create).mockResolvedValue({ id: 'u-1', email: 'new@example.com' } as any)
    sendEmail.mockRejectedValue(new Error('SMTP down'))

    const res = await POST(req({ email: 'new@example.com', role: 'RECRUITER' }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ message: 'Member invited successfully' })
  })
})
