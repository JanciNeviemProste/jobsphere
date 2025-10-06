import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { createAuditLog, queryAuditLogs, getRequestMetadata, logUserLogin, logDataAccess, logDataExport } from '../audit-log'
import { createMockAuditLog } from '../../../tests/helpers/factories'

vi.mock('@/lib/db')

describe('AuditLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createAuditLog', () => {
    it('should create audit log with all fields', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue(createMockAuditLog())

      await createAuditLog({
        userId: 'user-123',
        orgId: 'org-123',
        action: 'USER_LOGIN',
        resource: 'USER',
        resourceId: 'user-123',
        metadata: { ip: '1.2.3.4' },
        ipAddress: '1.2.3.4',
        userAgent: 'Mozilla/5.0'
      })

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          orgId: 'org-123',
          action: 'USER_LOGIN',
          entityType: 'USER',
          entityId: 'user-123',
          changes: { ip: '1.2.3.4' },
          ipAddress: '1.2.3.4',
          userAgent: 'Mozilla/5.0'
        }
      })
    })

    it('should use default entityId when resourceId is missing', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue(createMockAuditLog())

      await createAuditLog({
        action: 'USER_LOGIN',
        resource: 'USER',
      })

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityId: 'SYSTEM'
        })
      })
    })

    it('should not throw on database error', async () => {
      vi.mocked(prisma.auditLog.create).mockRejectedValue(new Error('DB error'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(createAuditLog({
        action: 'USER_LOGIN',
        resource: 'USER'
      })).resolves.not.toThrow()

      expect(consoleSpy).toHaveBeenCalledWith('Failed to create audit log:', expect.any(Error))
      consoleSpy.mockRestore()
    })
  })

  describe('queryAuditLogs', () => {
    it('should build correct where clause', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([])

      await queryAuditLogs({
        userId: 'user-123',
        orgId: 'org-123',
        action: 'USER_LOGIN',
        resource: 'USER',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
        limit: 50
      })

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          orgId: 'org-123',
          action: 'USER_LOGIN',
          entityType: 'USER',
          createdAt: {
            gte: new Date('2025-01-01'),
            lte: new Date('2025-01-31')
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      })
    })

    it('should use default limit of 100', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([])

      await queryAuditLogs({})

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        take: 100
      })
    })

    it('should handle partial filters', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([])

      await queryAuditLogs({
        userId: 'user-123',
        startDate: new Date('2025-01-01')
      })

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          createdAt: {
            gte: new Date('2025-01-01')
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      })
    })
  })

  describe('getRequestMetadata', () => {
    it('should extract headers correctly', () => {
      const request = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '1.2.3.4',
          'user-agent': 'Mozilla/5.0'
        }
      })

      const result = getRequestMetadata(request)

      expect(result).toEqual({
        ipAddress: '1.2.3.4',
        userAgent: 'Mozilla/5.0'
      })
    })

    it('should use defaults when headers missing', () => {
      const request = new Request('http://localhost')

      const result = getRequestMetadata(request)

      expect(result).toEqual({
        ipAddress: 'unknown',
        userAgent: 'unknown'
      })
    })
  })

  describe('logUserLogin', () => {
    it('should log user login with request metadata', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue(createMockAuditLog())

      const request = new Request('http://localhost', {
        headers: {
          'x-forwarded-for': '1.2.3.4',
          'user-agent': 'Chrome'
        }
      })

      await logUserLogin('user-123', request)

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          action: 'USER_LOGIN',
          entityType: 'USER',
          entityId: 'user-123',
          ipAddress: '1.2.3.4',
          userAgent: 'Chrome'
        })
      })
    })
  })

  describe('logDataAccess', () => {
    it('should log data access with all parameters', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue(createMockAuditLog())

      const request = new Request('http://localhost')

      await logDataAccess('user-123', 'org-123', 'CANDIDATE', 'candidate-456', request)

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          orgId: 'org-123',
          action: 'CANDIDATE_VIEWED',
          entityType: 'CANDIDATE',
          entityId: 'candidate-456'
        })
      })
    })
  })

  describe('logDataExport', () => {
    it('should log data export with metadata', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue(createMockAuditLog())

      const request = new Request('http://localhost')

      await logDataExport('user-123', 'org-123', 'GDPR_EXPORT', request)

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          orgId: 'org-123',
          action: 'DATA_EXPORTED',
          entityType: 'CANDIDATE',
          entityId: 'user-123',
          changes: { exportType: 'GDPR_EXPORT' }
        })
      })
    })

    it('should handle undefined orgId', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue(createMockAuditLog())

      const request = new Request('http://localhost')

      await logDataExport('user-123', undefined, 'GDPR_EXPORT', request)

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orgId: undefined
        })
      })
    })
  })
})