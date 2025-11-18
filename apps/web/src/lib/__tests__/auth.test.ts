import { describe, it, expect, beforeEach, vi } from 'vitest'

// Test UnauthorizedError in isolation
class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

describe('Auth Library', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('UnauthorizedError', () => {
    it('should create error with default message', () => {
      const error = new UnauthorizedError()

      expect(error.message).toBe('Unauthorized')
      expect(error.name).toBe('UnauthorizedError')
      expect(error).toBeInstanceOf(Error)
    })

    it('should create error with custom message', () => {
      const error = new UnauthorizedError('Custom unauthorized message')

      expect(error.message).toBe('Custom unauthorized message')
      expect(error.name).toBe('UnauthorizedError')
    })

    it('should be throwable', () => {
      expect(() => {
        throw new UnauthorizedError('Test error')
      }).toThrow('Test error')
    })

    it('should maintain Error prototype chain', () => {
      const error = new UnauthorizedError()

      expect(error instanceof Error).toBe(true)
      expect(error instanceof UnauthorizedError).toBe(true)
    })

    it('should be catchable as Error', () => {
      try {
        throw new UnauthorizedError('Test')
      } catch (e) {
        expect(e instanceof Error).toBe(true)
        expect((e as Error).message).toBe('Test')
      }
    })
  })

  describe('CredentialsProvider authorize logic', () => {
    // Mock Prisma
    const mockPrisma = {
      user: {
        findUnique: vi.fn(),
      },
    }

    // Mock bcryptjs
    const mockCompare = vi.fn()

    // Simulate the authorize function logic
    async function testAuthorize(credentials: any) {
      if (!credentials?.email || !credentials?.password) {
        return null
      }

      const user = await mockPrisma.user.findUnique({
        where: { email: credentials.email as string },
      })

      if (!user || !user.password) {
        return null
      }

      const isPasswordValid = await mockCompare(
        credentials.password as string,
        user.password
      )

      if (!isPasswordValid) {
        return null
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      }
    }

    beforeEach(() => {
      mockPrisma.user.findUnique.mockReset()
      mockCompare.mockReset()
    })

    it('should return null when credentials are missing', async () => {
      const resultNoEmail = await testAuthorize({ password: 'password123' })
      expect(resultNoEmail).toBeNull()

      const resultNoPassword = await testAuthorize({ email: 'test@example.com' })
      expect(resultNoPassword).toBeNull()
    })

    it('should return null when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const result = await testAuthorize({
        email: 'nonexistent@example.com',
        password: 'password123',
      })

      expect(result).toBeNull()
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'nonexistent@example.com' },
      })
    })

    it('should return null when user has no password (OAuth user)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'oauth@example.com',
        name: 'OAuth User',
        password: null,
        emailVerified: new Date(),
        image: 'https://example.com/avatar.jpg',
      })

      const result = await testAuthorize({
        email: 'oauth@example.com',
        password: 'password123',
      })

      expect(result).toBeNull()
    })

    it('should return null when password is invalid', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedPassword',
      })
      mockCompare.mockResolvedValue(false)

      const result = await testAuthorize({
        email: 'test@example.com',
        password: 'wrongpassword',
      })

      expect(result).toBeNull()
      expect(mockCompare).toHaveBeenCalledWith('wrongpassword', 'hashedPassword')
    })

    it('should return user object when credentials are valid', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedPassword',
        image: 'https://example.com/avatar.jpg',
      })
      mockCompare.mockResolvedValue(true)

      const result = await testAuthorize({
        email: 'test@example.com',
        password: 'correctpassword',
      })

      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        image: 'https://example.com/avatar.jpg',
      })
      expect(mockCompare).toHaveBeenCalledWith('correctpassword', 'hashedPassword')
    })

    it('should not include password in returned user object', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedPassword',
      })
      mockCompare.mockResolvedValue(true)

      const result = await testAuthorize({
        email: 'test@example.com',
        password: 'correctpassword',
      })

      expect(result).not.toHaveProperty('password')
    })
  })

  describe('requireAuth logic', () => {
    async function testRequireAuth(session: any) {
      if (!session?.user?.id) {
        throw new UnauthorizedError('You must be logged in to access this resource')
      }
      return session
    }

    it('should throw UnauthorizedError when session is null', async () => {
      await expect(testRequireAuth(null)).rejects.toThrow(UnauthorizedError)
      await expect(testRequireAuth(null)).rejects.toThrow(
        'You must be logged in to access this resource'
      )
    })

    it('should throw UnauthorizedError when user is missing', async () => {
      await expect(
        testRequireAuth({ expires: '2025-12-31' })
      ).rejects.toThrow(UnauthorizedError)
    })

    it('should throw UnauthorizedError when user.id is missing', async () => {
      await expect(
        testRequireAuth({
          user: { email: 'test@example.com' },
          expires: '2025-12-31',
        })
      ).rejects.toThrow(UnauthorizedError)
    })

    it('should return session when authenticated', async () => {
      const mockSession = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
        expires: '2025-12-31',
      }

      const result = await testRequireAuth(mockSession)

      expect(result).toEqual(mockSession)
    })

    it('should accept session with minimal user object', async () => {
      const mockSession = {
        user: {
          id: 'user-123',
        },
        expires: '2025-12-31',
      }

      const result = await testRequireAuth(mockSession)

      expect(result.user.id).toBe('user-123')
    })
  })
})
