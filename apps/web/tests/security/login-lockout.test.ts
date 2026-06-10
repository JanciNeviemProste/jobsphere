/**
 * QA-005 — Credentials login account lockout.
 *
 * Exercises the CredentialsProvider.authorize() logic in `@/lib/auth`:
 *   (a) a wrong password increments `failedAttempts`;
 *   (b) the 5th failed attempt sets `lockedUntil` (account locked);
 *   (c) while locked, a SUBSEQUENT login is rejected even with the CORRECT
 *       password (no bcrypt success path, no reset);
 *   (d) a successful login resets `failedAttempts`/`lockedUntil`.
 *
 * Prisma + bcryptjs are mocked so no DB / real hashing is required.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

// Mock bcryptjs so we control password-match outcomes deterministically.
vi.mock('bcryptjs', () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}))

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as bcryptjs from 'bcryptjs'

/**
 * Pull the real CredentialsProvider.authorize() out of the NextAuth config so
 * we test the production lockout code, not a re-implementation.
 */
function getAuthorize() {
  const credentials = (authOptions.providers as any[]).find((p) => p?.id === 'credentials')
  // In NextAuth v4 the top-level `provider.authorize` is a generated wrapper;
  // the original user-supplied function lives on `provider.options.authorize`.
  const authorize = credentials?.options?.authorize ?? credentials?.authorize
  if (typeof authorize !== 'function') {
    throw new Error('Could not locate CredentialsProvider.authorize on authOptions')
  }
  return authorize as (creds: { email: string; password: string }, req?: any) => Promise<any>
}

const EMAIL = 'user@test.com'

function makeUser(overrides: Record<string, any> = {}) {
  return {
    id: 'user-1',
    email: EMAIL,
    name: 'Test User',
    avatar: null,
    password: '$2a$12$hashedpasswordhashedpasswordhashedpasswordhashedpasswo',
    failedAttempts: 0,
    lockedUntil: null,
    emailVerified: new Date(),
    ...overrides,
  }
}

describe('QA-005 — login account lockout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.user.update).mockResolvedValue({} as any)
  })

  it('(a) increments failedAttempts on a wrong password', async () => {
    const authorize = getAuthorize()
    vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser({ failedAttempts: 1 }) as any)
    vi.mocked(bcryptjs.compare).mockResolvedValue(false as any)

    const result = await authorize({ email: EMAIL, password: 'wrong' })

    expect(result).toBeNull()
    // failedAttempts incremented 1 -> 2, and NOT yet locked (under threshold).
    expect(prisma.user.update).toHaveBeenCalledTimes(1)
    const arg = vi.mocked(prisma.user.update).mock.calls[0][0] as any
    expect(arg.where).toEqual({ id: 'user-1' })
    expect(arg.data.failedAttempts).toBe(2)
    expect(arg.data.lockedUntil).toBeUndefined()
  })

  it('(b) sets lockedUntil when the 5th attempt is reached', async () => {
    const authorize = getAuthorize()
    // Already 4 failures -> this 5th wrong attempt should lock.
    vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser({ failedAttempts: 4 }) as any)
    vi.mocked(bcryptjs.compare).mockResolvedValue(false as any)

    const before = Date.now()
    const result = await authorize({ email: EMAIL, password: 'wrong' })

    expect(result).toBeNull()
    expect(prisma.user.update).toHaveBeenCalledTimes(1)
    const arg = vi.mocked(prisma.user.update).mock.calls[0][0] as any
    expect(arg.data.failedAttempts).toBe(5)
    // Locked roughly 15 minutes into the future.
    expect(arg.data.lockedUntil).toBeInstanceOf(Date)
    const lockMs = (arg.data.lockedUntil as Date).getTime()
    expect(lockMs).toBeGreaterThan(before)
    expect(lockMs).toBeGreaterThanOrEqual(before + 14 * 60_000)
    expect(lockMs).toBeLessThanOrEqual(before + 16 * 60_000)
  })

  it('(c) rejects login while locked even with the CORRECT password', async () => {
    const authorize = getAuthorize()
    const future = new Date(Date.now() + 10 * 60_000) // lock active for 10 more min
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      makeUser({ failedAttempts: 5, lockedUntil: future }) as any,
    )
    // Even if the password WOULD match, the lock short-circuits before bcrypt.
    vi.mocked(bcryptjs.compare).mockResolvedValue(true as any)

    const result = await authorize({ email: EMAIL, password: 'correct-password' })

    expect(result).toBeNull()
    // Locked path returns before any password verification or DB mutation.
    expect(bcryptjs.compare).not.toHaveBeenCalled()
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('(d) resets failedAttempts/lockedUntil on a successful login', async () => {
    const authorize = getAuthorize()
    // Some prior failures, but NOT currently locked.
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      makeUser({ failedAttempts: 3, lockedUntil: null }) as any,
    )
    vi.mocked(bcryptjs.compare).mockResolvedValue(true as any)

    const result = await authorize({ email: EMAIL, password: 'correct-password' })

    expect(result).toMatchObject({ id: 'user-1', email: EMAIL })
    // Successful login resets the counter and clears any lock + stamps lastLoginAt.
    expect(prisma.user.update).toHaveBeenCalledTimes(1)
    const arg = vi.mocked(prisma.user.update).mock.calls[0][0] as any
    expect(arg.where).toEqual({ id: 'user-1' })
    expect(arg.data.failedAttempts).toBe(0)
    expect(arg.data.lockedUntil).toBeNull()
    expect(arg.data.lastLoginAt).toBeInstanceOf(Date)
  })

  it('(e) clears an EXPIRED lock then proceeds to verify the password', async () => {
    const authorize = getAuthorize()
    const past = new Date(Date.now() - 60_000) // lock expired 1 min ago
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      makeUser({ failedAttempts: 5, lockedUntil: past }) as any,
    )
    vi.mocked(bcryptjs.compare).mockResolvedValue(true as any)

    const result = await authorize({ email: EMAIL, password: 'correct-password' })

    expect(result).toMatchObject({ id: 'user-1' })
    // First update clears the expired lock; final update records the success reset.
    const resetCall = vi
      .mocked(prisma.user.update)
      .mock.calls.find((c: any) => c[0].data.failedAttempts === 0 && c[0].data.lockedUntil === null)
    expect(resetCall).toBeDefined()
    expect(bcryptjs.compare).toHaveBeenCalled()
  })
})
