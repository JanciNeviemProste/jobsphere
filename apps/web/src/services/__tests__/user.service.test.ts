import { describe, it, expect, beforeEach, vi } from 'vitest'
import { UserService } from '../user.service'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit-log'
import { AppError } from '@/lib/errors'
import { hash, compare } from 'bcryptjs'
import { createMockUser, createMockOrgMember } from '../../../tests/helpers/factories'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    orgMember: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    session: {
      deleteMany: vi.fn(),
    },
    verificationToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn(),
}))

vi.mock('bcryptjs', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}))

describe('UserService', () => {
  const mockUserId = 'user-123'
  const mockOrgId = 'org-123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createUser', () => {
    const createInput = {
      email: 'newuser@example.com',
      password: 'SecurePass123',
      name: 'John Doe',
    }

    it('should create user successfully', async () => {
      const mockUser = createMockUser({
        email: createInput.email,
        name: createInput.name,
        password: null,
      })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
      vi.mocked(hash).mockResolvedValue('hashedPassword123')
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          user: { create: vi.fn().mockResolvedValue(mockUser) },
        } as any)
      })

      const result = await UserService.createUser(createInput)

      expect(result.email).toBe(createInput.email)
      expect(result.name).toBe(createInput.name)
      expect(hash).toHaveBeenCalledWith(createInput.password, 12)
      expect(result).not.toHaveProperty('password')
    })

    it('should throw error when email already exists', async () => {
      const existingUser = createMockUser({ email: createInput.email })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser)

      await expect(UserService.createUser(createInput)).rejects.toThrow(
        'User with this email already exists'
      )
      await expect(UserService.createUser(createInput)).rejects.toThrow(AppError)
    })

    it('should throw error when password is too short', async () => {
      const weakPasswordInput = {
        ...createInput,
        password: '1234567', // Only 7 characters
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      await expect(UserService.createUser(weakPasswordInput)).rejects.toThrow(
        'Password must be at least 8 characters long'
      )
    })

    it('should add user to organization when organizationId provided', async () => {
      const inputWithOrg = {
        ...createInput,
        orgId: mockOrgId,
      }
      const mockUser = createMockUser({ email: createInput.email })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
      vi.mocked(hash).mockResolvedValue('hashedPassword123')
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          user: { create: vi.fn().mockResolvedValue(mockUser) },
          orgMember: { create: vi.fn().mockResolvedValue({}) },
        }
        return callback(tx as any)
      })

      await UserService.createUser(inputWithOrg)

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          orgId: mockOrgId,
          action: 'CREATE',
          resource: 'USER',
        })
      )
    })

    it('should create audit log for user creation', async () => {
      const mockUser = createMockUser({ email: createInput.email })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
      vi.mocked(hash).mockResolvedValue('hashedPassword123')
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          user: { create: vi.fn().mockResolvedValue(mockUser) },
        } as any)
      })

      await UserService.createUser(createInput)

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          action: 'CREATE',
          resource: 'USER',
          metadata: expect.objectContaining({
            email: createInput.email,
            name: createInput.name,
          }),
        })
      )
    })
  })

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      const existingUser = createMockUser({ id: mockUserId })
      const updateInput = { name: 'Updated Name', image: 'https://example.com/avatar.jpg' }
      const updatedUser = { ...existingUser, ...updateInput }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          user: { update: vi.fn().mockResolvedValue(updatedUser) },
        } as any)
      })

      const result = await UserService.updateUser(mockUserId, updateInput)

      expect(result.name).toBe('Updated Name')
      expect(result).not.toHaveProperty('password')
    })

    it('should throw error when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      await expect(
        UserService.updateUser(mockUserId, { name: 'New Name' })
      ).rejects.toThrow('User not found')
    })

    it('should throw error when new email already in use', async () => {
      const existingUser = createMockUser({ id: mockUserId, email: 'user@example.com' })
      const emailTaken = createMockUser({ email: 'taken@example.com' })

      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce(emailTaken)

      await expect(
        UserService.updateUser(mockUserId, { email: 'taken@example.com' })
      ).rejects.toThrow('Email already in use')
    })

    it('should allow updating to same email', async () => {
      const existingUser = createMockUser({ id: mockUserId, email: 'user@example.com' })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          user: { update: vi.fn().mockResolvedValue(existingUser) },
        } as any)
      })

      await UserService.updateUser(mockUserId, { email: 'user@example.com' })

      // Should not check for email uniqueness
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1)
    })

    it('should set emailVerified date when emailVerified is true', async () => {
      const existingUser = createMockUser({ id: mockUserId, emailVerified: null })

      let capturedData: any

      vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          user: {
            update: vi.fn().mockImplementation((opts) => {
              capturedData = opts.data
              return { ...existingUser, emailVerified: new Date() }
            }),
          },
        } as any)
      })

      await UserService.updateUser(mockUserId, { emailVerified: true })

      expect(capturedData.emailVerified).toBeInstanceOf(Date)
    })

    it('should create audit log for update', async () => {
      const existingUser = createMockUser({ id: mockUserId })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(existingUser)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          user: { update: vi.fn().mockResolvedValue(existingUser) },
        } as any)
      })

      await UserService.updateUser(mockUserId, { name: 'New Name' })

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          action: 'UPDATE',
          resource: 'USER',
        })
      )
    })
  })

  describe('changePassword', () => {
    const changePasswordInput = {
      currentPassword: 'OldPass123',
      newPassword: 'NewSecurePass456',
    }

    it('should change password successfully', async () => {
      const mockUser = createMockUser({ id: mockUserId, password: 'hashedOldPassword' })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(compare).mockResolvedValue(true)
      vi.mocked(hash).mockResolvedValue('hashedNewPassword')
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          user: { update: vi.fn().mockResolvedValue(mockUser) },
        } as any)
      })

      await UserService.changePassword(mockUserId, changePasswordInput)

      expect(compare).toHaveBeenCalledWith('OldPass123', 'hashedOldPassword')
      expect(hash).toHaveBeenCalledWith('NewSecurePass456', 12)
    })

    it('should throw error when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      await expect(
        UserService.changePassword(mockUserId, changePasswordInput)
      ).rejects.toThrow('User not found')
    })

    it('should throw error when current password is incorrect', async () => {
      const mockUser = createMockUser({ id: mockUserId, password: 'hashedPassword' })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(compare).mockResolvedValue(false)

      await expect(
        UserService.changePassword(mockUserId, changePasswordInput)
      ).rejects.toThrow('Current password is incorrect')
    })

    it('should throw error when new password is too short', async () => {
      const mockUser = createMockUser({ id: mockUserId, password: 'hashedPassword' })
      const weakPasswordInput = {
        currentPassword: 'OldPass123',
        newPassword: '1234567', // Only 7 characters
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(compare).mockResolvedValue(true)

      await expect(
        UserService.changePassword(mockUserId, weakPasswordInput)
      ).rejects.toThrow('New password must be at least 8 characters long')
    })

    it('should create audit log for password change', async () => {
      const mockUser = createMockUser({ id: mockUserId, password: 'hashedPassword' })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(compare).mockResolvedValue(true)
      vi.mocked(hash).mockResolvedValue('hashedNewPassword')
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        return callback({
          user: { update: vi.fn().mockResolvedValue(mockUser) },
        } as any)
      })

      await UserService.changePassword(mockUserId, changePasswordInput)

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          action: 'UPDATE',
          resource: 'USER',
          metadata: { password: 'CHANGED' },
        })
      )
    })
  })

  describe('searchUsers', () => {
    it('should return users with default parameters', async () => {
      const mockUsers = [createMockUser(), createMockUser()]

      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any)
      vi.mocked(prisma.user.count).mockResolvedValue(2)

      const result = await UserService.searchUsers({})

      expect(result).toEqual({ users: mockUsers, total: 2 })
    })

    it('should filter by search term', async () => {
      const mockUsers = [createMockUser({ name: 'John Doe', email: 'john@example.com' })]

      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any)
      vi.mocked(prisma.user.count).mockResolvedValue(1)

      await UserService.searchUsers({ search: 'John' })

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        })
      )
    })

    it('should filter by organizationId', async () => {
      const mockUsers = [createMockUser()]

      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any)
      vi.mocked(prisma.user.count).mockResolvedValue(1)

      await UserService.searchUsers({ orgId: mockOrgId })

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orgMembers: {
              some: { orgId: mockOrgId },
            },
          }),
        })
      )
    })

    it('should filter by emailVerified', async () => {
      const mockUsers = [createMockUser({ emailVerified: new Date() })]

      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any)
      vi.mocked(prisma.user.count).mockResolvedValue(1)

      await UserService.searchUsers({ emailVerified: true })

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            emailVerified: { not: null },
          }),
        })
      )
    })

    it('should support pagination', async () => {
      const mockUsers = [createMockUser()]

      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any)
      vi.mocked(prisma.user.count).mockResolvedValue(100)

      await UserService.searchUsers({ limit: 10, offset: 20 })

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      )
    })

    it('should not include password in results', async () => {
      const mockUsers = [createMockUser()]

      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers as any)
      vi.mocked(prisma.user.count).mockResolvedValue(1)

      await UserService.searchUsers({})

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.not.objectContaining({
            password: true,
          }),
        })
      )
    })
  })

  describe('getUserById', () => {
    it('should return user with full details', async () => {
      const mockUser = createMockUser({ id: mockUserId, password: null })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)

      const result = await UserService.getUserById(mockUserId)

      expect(result?.id).toBe(mockUserId)
      expect(result).not.toHaveProperty('password')
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId },
        include: {
          orgMembers: {
            include: {
              organization: true,
            },
          },
          sessions: {
            where: {
              expires: { gt: expect.any(Date) },
            },
            orderBy: { expires: 'desc' },
            take: 5,
          },
        },
      })
    })

    it('should return null when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const result = await UserService.getUserById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('deleteUser', () => {
    it('should delete user and related data', async () => {
      const mockUser = createMockUser({ id: mockUserId })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          session: { deleteMany: vi.fn() },
          orgMember: { deleteMany: vi.fn() },
          user: { delete: vi.fn() },
        }
        return callback(tx as any)
      })

      await UserService.deleteUser(mockUserId)

      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          action: 'DELETE',
          resource: 'USER',
          metadata: { email: mockUser.email },
        })
      )
    })

    it('should throw error when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      await expect(UserService.deleteUser('non-existent')).rejects.toThrow('User not found')
    })
  })

  describe('verifyEmail', () => {
    const token = 'verify-token-123'

    it('should verify email successfully', async () => {
      const mockToken = {
        token,
        identifier: 'user@example.com',
        expires: new Date(Date.now() + 3600000),
      }
      const mockUser = createMockUser({ email: 'user@example.com' })

      vi.mocked(prisma.verificationToken.findUnique).mockResolvedValue(mockToken)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          user: { update: vi.fn().mockResolvedValue({ ...mockUser, emailVerified: new Date() }) },
          verificationToken: { delete: vi.fn() },
        }
        return callback(tx as any)
      })

      const result = await UserService.verifyEmail(token)

      expect(result).not.toHaveProperty('password')
      expect(result.emailVerified).toBeInstanceOf(Date)
    })

    it('should throw error when token is invalid', async () => {
      vi.mocked(prisma.verificationToken.findUnique).mockResolvedValue(null)

      await expect(UserService.verifyEmail('invalid-token')).rejects.toThrow(
        'Invalid verification token'
      )
    })

    it('should throw error when token is expired', async () => {
      const expiredToken = {
        token,
        identifier: 'user@example.com',
        expires: new Date(Date.now() - 3600000), // Expired 1 hour ago
      }

      vi.mocked(prisma.verificationToken.findUnique).mockResolvedValue(expiredToken)

      await expect(UserService.verifyEmail(token)).rejects.toThrow(
        'Verification token has expired'
      )
    })
  })

  describe('createPasswordResetToken', () => {
    const email = 'user@example.com'

    it('should create reset token for existing user', async () => {
      const mockUser = createMockUser({ email })

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(prisma.verificationToken.create).mockResolvedValue({} as any)

      const result = await UserService.createPasswordResetToken(email)

      expect(result).toBeTruthy()
      expect(prisma.verificationToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            identifier: email,
            token: expect.any(String),
            expires: expect.any(Date),
          }),
        })
      )
    })

    it('should not reveal if user does not exist', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const result = await UserService.createPasswordResetToken('nonexistent@example.com')

      expect(result).toBe('TOKEN_SENT')
      expect(prisma.verificationToken.create).not.toHaveBeenCalled()
    })
  })

  describe('resetPassword', () => {
    const token = 'reset-token-123'
    const newPassword = 'NewSecurePassword456'

    it('should reset password successfully', async () => {
      const mockToken = {
        token,
        identifier: 'user@example.com',
        expires: new Date(Date.now() + 3600000),
      }

      vi.mocked(prisma.verificationToken.findUnique).mockResolvedValue(mockToken)
      vi.mocked(hash).mockResolvedValue('hashedNewPassword')
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        const tx = {
          user: { update: vi.fn() },
          verificationToken: { delete: vi.fn() },
        }
        return callback(tx as any)
      })

      await UserService.resetPassword(token, newPassword)

      expect(hash).toHaveBeenCalledWith(newPassword, 12)
    })

    it('should throw error when token is invalid', async () => {
      vi.mocked(prisma.verificationToken.findUnique).mockResolvedValue(null)

      await expect(UserService.resetPassword('invalid-token', newPassword)).rejects.toThrow(
        'Invalid reset token'
      )
    })

    it('should throw error when token is expired', async () => {
      const expiredToken = {
        token,
        identifier: 'user@example.com',
        expires: new Date(Date.now() - 3600000),
      }

      vi.mocked(prisma.verificationToken.findUnique).mockResolvedValue(expiredToken)

      await expect(UserService.resetPassword(token, newPassword)).rejects.toThrow(
        'Reset token has expired'
      )
    })

    it('should throw error when new password is too short', async () => {
      const mockToken = {
        token,
        identifier: 'user@example.com',
        expires: new Date(Date.now() + 3600000),
      }

      vi.mocked(prisma.verificationToken.findUnique).mockResolvedValue(mockToken)

      await expect(UserService.resetPassword(token, '1234567')).rejects.toThrow(
        'Password must be at least 8 characters long'
      )
    })
  })
})
