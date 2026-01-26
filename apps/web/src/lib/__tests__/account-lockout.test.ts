/**
 * Account Lockout Tests
 * Verifies that accounts are locked after 5 failed login attempts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock BEFORE any imports - use factory function properly
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    userOrgRole: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('bcryptjs', () => ({
  compare: vi.fn(),
}))

// NOW import after mocks are set up
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as bcryptjs from 'bcryptjs'

describe('Account Lockout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should allow login with correct credentials', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      password: 'hashed-password',
      name: 'Test User',
      avatar: null,
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
    }

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
    vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any)
    vi.mocked(bcryptjs.compare).mockResolvedValue(true as never)

    const credentialsProvider = authOptions.providers.find((p) => p.id === 'credentials') as any

    const result = await credentialsProvider.authorize({
      email: 'test@example.com',
      password: 'correct-password',
    })

    expect(result).toEqual({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      image: null,
    })

    // Should reset failed attempts and update lastLoginAt
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
        lastLoginAt: expect.any(Date),
      },
    })
  })

  it('should increment failedAttempts on wrong password', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      password: 'hashed-password',
      failedAttempts: 2,
      lockedUntil: null,
    }

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
    vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any)
    vi.mocked(bcryptjs.compare).mockResolvedValue(false as never)

    const credentialsProvider = authOptions.providers.find((p) => p.id === 'credentials') as any

    const result = await credentialsProvider.authorize({
      email: 'test@example.com',
      password: 'wrong-password',
    })

    expect(result).toBeNull()

    // Should increment failedAttempts to 3
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        failedAttempts: 3,
      },
    })
  })

  it('should lock account after 5 failed attempts', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      password: 'hashed-password',
      failedAttempts: 4, // 4th attempt already failed
      lockedUntil: null,
    }

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
    vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any)
    vi.mocked(bcryptjs.compare).mockResolvedValue(false as never)

    const credentialsProvider = authOptions.providers.find((p) => p.id === 'credentials') as any

    const result = await credentialsProvider.authorize({
      email: 'test@example.com',
      password: 'wrong-password',
    })

    expect(result).toBeNull()

    // Should lock account for 15 minutes
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        failedAttempts: 5,
        lockedUntil: expect.any(Date),
      },
    })

    // Verify lock duration is 15 minutes
    const updateCall = vi.mocked(prisma.user.update).mock.calls[0][0]
    const lockedUntil = updateCall.data.lockedUntil as Date
    const expectedUnlock = new Date(Date.now() + 15 * 60000)

    // Allow 1 second tolerance for test execution time
    expect(lockedUntil.getTime()).toBeGreaterThanOrEqual(expectedUnlock.getTime() - 1000)
    expect(lockedUntil.getTime()).toBeLessThanOrEqual(expectedUnlock.getTime() + 1000)
  })

  it('should prevent login when account is locked', async () => {
    const lockedUntil = new Date(Date.now() + 10 * 60000) // Locked for 10 more minutes
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      password: 'hashed-password',
      failedAttempts: 5,
      lockedUntil,
    }

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
    vi.mocked(bcryptjs.compare).mockResolvedValue(true as never)

    const credentialsProvider = authOptions.providers.find((p) => p.id === 'credentials') as any

    const result = await credentialsProvider.authorize({
      email: 'test@example.com',
      password: 'correct-password',
    })

    expect(result).toBeNull()

    // Should NOT update failedAttempts (account is locked)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('should unlock account after lockout period expires', async () => {
    const expiredLock = new Date(Date.now() - 1000) // Lock expired 1 second ago
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      password: 'hashed-password',
      name: 'Test User',
      avatar: null,
      failedAttempts: 5,
      lockedUntil: expiredLock,
    }

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
    vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any)
    vi.mocked(bcryptjs.compare).mockResolvedValue(true as never)

    const credentialsProvider = authOptions.providers.find((p) => p.id === 'credentials') as any

    const result = await credentialsProvider.authorize({
      email: 'test@example.com',
      password: 'correct-password',
    })

    expect(result).toEqual({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      image: null,
    })

    // Should have called update twice:
    // 1. Reset expired lock
    // 2. Successful login reset
    expect(prisma.user.update).toHaveBeenCalledTimes(2)

    // First call: Reset expired lock
    expect(prisma.user.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'user-1' },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
      },
    })

    // Second call: Successful login
    expect(prisma.user.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'user-1' },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
        lastLoginAt: expect.any(Date),
      },
    })
  })

  it('should handle multiple failed attempts correctly', async () => {
    // Simulate 3 failed attempts
    for (let attempt = 0; attempt < 3; attempt++) {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed-password',
        failedAttempts: attempt,
        lockedUntil: null,
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any)
      vi.mocked(bcryptjs.compare).mockResolvedValue(false as never)

      const credentialsProvider = authOptions.providers.find((p) => p.id === 'credentials') as any

      const result = await credentialsProvider.authorize({
        email: 'test@example.com',
        password: 'wrong-password',
      })

      expect(result).toBeNull()

      // Should increment failedAttempts
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          failedAttempts: attempt + 1,
        },
      })

      vi.clearAllMocks()
    }
  })

  it('should return null for non-existent user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const credentialsProvider = authOptions.providers.find((p) => p.id === 'credentials') as any

    const result = await credentialsProvider.authorize({
      email: 'nonexistent@example.com',
      password: 'password',
    })

    expect(result).toBeNull()
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('should return null for user without password (OAuth users)', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'oauth@example.com',
      password: null, // OAuth user with no password
      failedAttempts: 0,
      lockedUntil: null,
    }

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

    const credentialsProvider = authOptions.providers.find((p) => p.id === 'credentials') as any

    const result = await credentialsProvider.authorize({
      email: 'oauth@example.com',
      password: 'password',
    })

    expect(result).toBeNull()
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})
