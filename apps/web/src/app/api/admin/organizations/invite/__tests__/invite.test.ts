/**
 * Superadmin: invite a brand-new company by e-mail (POST /api/admin/organizations/invite).
 * Pins the authz guard (403), the atomic provisioning (org + user + set-password
 * token + ORG_ADMIN membership), and best-effort email (emailSent flag).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn(),
  getRequestMetadata: () => ({ ipAddress: '127.0.0.1', userAgent: 'vitest' }),
}))

vi.mock('@/lib/csrf', () => ({ withCsrfProtection: (handler: any) => handler }))
vi.mock('@/lib/rate-limit', () => ({ withRateLimit: (handler: any) => handler }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('bcryptjs', () => ({ hash: vi.fn().mockResolvedValue('hashed') }))

const { requireGlobalAdmin } = vi.hoisted(() => ({ requireGlobalAdmin: vi.fn() }))
// Partial mock: lib/errors.ts reaches UnauthorizedError through this module, so
// replacing it wholesale breaks handleApiError on its own error branch.
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  requireGlobalAdmin,
}))

const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn() }))
vi.mock('@/lib/email', () => ({
  sendEmail,
  getInvitationEmail: ({ actionUrl }: { actionUrl: string }) => `<a href="${actionUrl}">join</a>`,
}))

// A per-test tx mock is injected by the $transaction mock below.
const tx = {
  organization: { findUnique: vi.fn(), create: vi.fn() },
  user: { findUnique: vi.fn(), create: vi.fn() },
  verificationToken: { create: vi.fn() },
  // upsert, not create: inviting someone already in the org now adjusts
  // their role rather than violating the composite unique key.
  userOrgRole: { upsert: vi.fn() },
}
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(async (cb: any) => cb(tx)),
  },
}))

import { POST } from '../route'

function req(body: unknown) {
  return { json: async () => body } as any
}

describe('POST /api/admin/organizations/invite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tx.organization.findUnique.mockResolvedValue(null) // slug free
    tx.organization.create.mockResolvedValue({ id: 'org-1', name: 'Acme', slug: 'acme' })
    tx.user.findUnique.mockResolvedValue(null) // brand-new user
    tx.user.create.mockResolvedValue({ id: 'u-1', email: 'admin@acme.io' })
    tx.verificationToken.create.mockResolvedValue({})
    tx.userOrgRole.upsert.mockResolvedValue({})
    sendEmail.mockResolvedValue({ success: true })
  })

  it('returns 403 when caller is not a global admin', async () => {
    requireGlobalAdmin.mockResolvedValue(null)
    const res = await POST(req({ orgName: 'Acme', adminEmail: 'admin@acme.io' }))
    expect(res.status).toBe(403)
    expect(tx.organization.create).not.toHaveBeenCalled()
  })

  it('provisions org + user + token + ORG_ADMIN membership and emails a set-password link', async () => {
    requireGlobalAdmin.mockResolvedValue({ user: { id: 'admin-1', isGlobalAdmin: true } })

    const res = await POST(req({ orgName: 'Acme', adminEmail: 'Admin@Acme.io', industry: 'Tech' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.emailSent).toBe(true)

    expect(tx.organization.create).toHaveBeenCalledTimes(1)
    expect(tx.user.create).toHaveBeenCalledTimes(1)
    expect(tx.verificationToken.create).toHaveBeenCalledTimes(1)

    // Membership is ORG_ADMIN for the new company.
    const roleArg = tx.userOrgRole.upsert.mock.calls[0][0] as any
    expect(roleArg.create.role).toBe('ORG_ADMIN')
    expect(roleArg.create.orgId).toBe('org-1')

    // Email is lowercased and the invite links to /reset-password?token=.
    const tokenArg = tx.verificationToken.create.mock.calls[0][0] as any
    expect(tokenArg.data.identifier).toBe('admin@acme.io')
    const emailArg = sendEmail.mock.calls[0][0]
    expect(emailArg.to).toBe('admin@acme.io')
    expect(emailArg.html).toContain(`/reset-password?token=${tokenArg.data.token}`)
  })

  it('is best-effort on email: still 201 but flags emailSent=false when send fails', async () => {
    requireGlobalAdmin.mockResolvedValue({ user: { id: 'admin-1', isGlobalAdmin: true } })
    sendEmail.mockRejectedValue(new Error('SMTP down'))

    const res = await POST(req({ orgName: 'Acme', adminEmail: 'admin@acme.io' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.emailSent).toBe(false)
    expect(body.message).toMatch(/could not be sent/i)
  })

  it('existing user: no set-password token, notification email to /login', async () => {
    requireGlobalAdmin.mockResolvedValue({ user: { id: 'admin-1', isGlobalAdmin: true } })
    tx.user.findUnique.mockResolvedValue({ id: 'u-9', email: 'admin@acme.io' })

    const res = await POST(req({ orgName: 'Acme', adminEmail: 'admin@acme.io' }))
    expect(res.status).toBe(201)

    expect(tx.user.create).not.toHaveBeenCalled()
    expect(tx.verificationToken.create).not.toHaveBeenCalled()
    const emailArg = sendEmail.mock.calls[0][0]
    expect(emailArg.html).toContain('/login')
  })
})
