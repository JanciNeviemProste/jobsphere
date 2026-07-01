/**
 * AUTH-001 — Session revocation via sessionEpoch.
 *
 * Exercises the NextAuth jwt/session callbacks wired in `authOptions`:
 *  - at sign-in the token pins the user's current sessionEpoch
 *  - on refresh, a DB epoch that no longer matches marks the token invalid
 *  - the session callback strips the user id for an invalid token (logged out)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// --- prisma: only the lookups the callbacks perform ---
vi.mock('@/lib/prisma', () => ({
  prisma: {
    // PR7 dual-role: sign-in now loads ALL memberships (findMany) and may persist activeOrgId.
    userOrgRole: { findFirst: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

// --- logger: silence ---
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// NextAuth default export pulls in ESM-only internals during import; the named
// `authOptions` export is a plain object so importing it is safe.
import { authOptions } from '../auth'
import { prisma } from '@/lib/prisma'

const jwt = authOptions.callbacks!.jwt!
const session = authOptions.callbacks!.session!

function callJwt(args: any) {
  return jwt(args) as Promise<any>
}
function callSession(args: any) {
  return session(args) as Promise<any>
}

describe('AUTH-001 session epoch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pins sessionEpoch on sign-in', async () => {
    vi.mocked(prisma.userOrgRole.findMany).mockResolvedValue([
      { orgId: 'org-1', role: 'RECRUITER', organization: { name: 'Acme' } },
    ] as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      isGlobalAdmin: false,
      sessionEpoch: 3,
      activeOrgId: null,
      freelancerProfile: null,
      candidates: [],
    } as any)

    const token = await callJwt({ token: {}, user: { id: 'user-1' } })

    expect(token.sessionEpoch).toBe(3)
    expect(token.invalid).toBe(false)
    expect(token.id).toBe('user-1')
  })

  it('keeps the token valid when the DB epoch still matches', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ sessionEpoch: 3 } as any)

    const token = await callJwt({
      token: { id: 'user-1', sessionEpoch: 3, epochCheckedAt: 0 },
    })

    expect(token.invalid).toBeFalsy()
  })

  it('invalidates the token when the DB epoch was bumped (ban/demote/reset)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ sessionEpoch: 4 } as any)

    const token = await callJwt({
      token: { id: 'user-1', sessionEpoch: 3, epochCheckedAt: 0 },
    })

    expect(token.invalid).toBe(true)
  })

  it('invalidates the token when the user no longer exists (deleted)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const token = await callJwt({
      token: { id: 'user-1', sessionEpoch: 3, epochCheckedAt: 0 },
    })

    expect(token.invalid).toBe(true)
  })

  it('throttles the DB epoch check (no query within the interval)', async () => {
    const token = await callJwt({
      token: { id: 'user-1', sessionEpoch: 3, epochCheckedAt: Date.now() },
    })

    expect(prisma.user.findUnique).not.toHaveBeenCalled()
    expect(token.invalid).toBeFalsy()
  })

  it('session callback strips user.id for an invalid token', async () => {
    const result = await callSession({
      session: { user: { id: 'user-1', email: 'a@b.c' } },
      token: { id: 'user-1', invalid: true },
    })

    expect(result.user.id).toBeUndefined()
  })

  it('session callback populates the user for a valid token', async () => {
    const result = await callSession({
      session: { user: { id: '', email: 'a@b.c' } },
      token: {
        id: 'user-1',
        role: 'RECRUITER',
        orgId: 'org-1',
        orgName: 'Acme',
        isGlobalAdmin: false,
        invalid: false,
      },
    })

    expect(result.user.id).toBe('user-1')
    expect(result.user.role).toBe('RECRUITER')
  })
})
