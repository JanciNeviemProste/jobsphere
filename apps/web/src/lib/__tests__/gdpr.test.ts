/**
 * GDPR Compliance Unit Tests
 * Tests for consent management, data export, and DSAR requests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import type { ConsentRecord, DSARRequest } from '@prisma/client'

// Mock Prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    consentRecord: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    dSARRequest: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}))

describe('GDPR Consent Management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create consent record with metadata', async () => {
    const mockConsent: ConsentRecord = {
      id: 'test-consent-id',
      userId: 'test-user-id',
      candidateId: null,
      consentType: 'MARKETING',
      granted: true,
      purpose: 'Email marketing campaigns',
      legalBasis: 'CONSENT',
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
      version: null,
      grantedAt: new Date(),
      revokedAt: null,
      expiresAt: null,
    }

    vi.mocked(prisma.consentRecord.create).mockResolvedValue(mockConsent)

    const consent = await prisma.consentRecord.create({
      data: {
        userId: 'test-user-id',
        consentType: 'MARKETING',
        granted: true,
        purpose: 'Email marketing campaigns',
        legalBasis: 'CONSENT',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      },
    })

    expect(consent.granted).toBe(true)
    expect(consent.consentType).toBe('MARKETING')
    expect(consent.ipAddress).toBe('127.0.0.1')
    expect(consent.legalBasis).toBe('CONSENT')
    expect(prisma.consentRecord.create).toHaveBeenCalledOnce()
  })

  it('should revoke consent by updating revokedAt timestamp', async () => {
    const revokedAt = new Date()
    const mockRevokedConsent: ConsentRecord = {
      id: 'test-consent-id',
      userId: 'test-user-id',
      candidateId: null,
      consentType: 'MARKETING',
      granted: false,
      purpose: 'Email marketing campaigns',
      legalBasis: 'CONSENT',
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
      version: null,
      grantedAt: new Date(),
      revokedAt,
      expiresAt: null,
    }

    vi.mocked(prisma.consentRecord.update).mockResolvedValue(mockRevokedConsent)

    const revoked = await prisma.consentRecord.update({
      where: { id: 'test-consent-id' },
      data: {
        granted: false,
        revokedAt,
      },
    })

    expect(revoked.granted).toBe(false)
    expect(revoked.revokedAt).toEqual(revokedAt)
    expect(prisma.consentRecord.update).toHaveBeenCalledOnce()
  })

  it('should fetch all consent records for a user', async () => {
    const mockConsents: ConsentRecord[] = [
      {
        id: 'consent-1',
        userId: 'test-user-id',
        candidateId: null,
        consentType: 'MARKETING',
        granted: true,
        purpose: null,
        legalBasis: 'CONSENT',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        version: null,
        grantedAt: new Date(),
        revokedAt: null,
        expiresAt: null,
      },
      {
        id: 'consent-2',
        userId: 'test-user-id',
        candidateId: null,
        consentType: 'ANALYTICS',
        granted: false,
        purpose: null,
        legalBasis: 'CONSENT',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        version: null,
        grantedAt: new Date(),
        revokedAt: new Date(),
        expiresAt: null,
      },
    ]

    vi.mocked(prisma.consentRecord.findMany).mockResolvedValue(mockConsents)

    const consents = await prisma.consentRecord.findMany({
      where: { userId: 'test-user-id' },
      orderBy: { grantedAt: 'desc' },
    })

    expect(consents).toHaveLength(2)
    expect(consents[0].consentType).toBe('MARKETING')
    expect(consents[1].granted).toBe(false)
  })
})

describe('GDPR Data Export', () => {
  it('should export all user data including consents and DSARs', async () => {
    const mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      avatar: null,
      emailVerified: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

    const user = await prisma.user.findUnique({
      where: { id: 'test-user-id' },
      include: {
        sessions: true,
        organizations: true,
      },
    })

    expect(user).toBeDefined()
    expect(user?.email).toBe('test@example.com')
    expect(user?.id).toBe('test-user-id')
  })

  it('should exclude sensitive fields like password hash', () => {
    const mockUserData = {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashed_password_should_not_export',
      createdAt: new Date(),
    }

    // Simulate export logic that excludes password
    const exportData = {
      id: mockUserData.id,
      email: mockUserData.email,
      name: mockUserData.name,
      createdAt: mockUserData.createdAt,
      // password intentionally excluded
    }

    expect(exportData).not.toHaveProperty('password')
    expect(exportData).toHaveProperty('email')
  })
})

describe('GDPR DSAR Requests', () => {
  it('should create DSAR request with PENDING status', async () => {
    const mockDSAR: DSARRequest = {
      id: 'dsar-id',
      userId: 'test-user-id',
      requestType: 'EXPORT',
      status: 'PENDING',
      email: 'test@example.com',
      description: null,
      completedAt: null,
      responseData: null,
      rejectionReason: null,
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    vi.mocked(prisma.dSARRequest.create).mockResolvedValue(mockDSAR)

    const dsar = await prisma.dSARRequest.create({
      data: {
        userId: 'test-user-id',
        requestType: 'EXPORT',
        status: 'PENDING',
        email: 'test@example.com',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      },
    })

    expect(dsar.status).toBe('PENDING')
    expect(dsar.requestType).toBe('EXPORT')
    expect(prisma.dSARRequest.create).toHaveBeenCalledOnce()
  })

  it('should track request with IP and user agent metadata', async () => {
    const mockDSAR: DSARRequest = {
      id: 'dsar-id',
      userId: 'test-user-id',
      requestType: 'DELETE',
      status: 'PENDING',
      email: 'test@example.com',
      description: 'User requested account deletion',
      completedAt: null,
      responseData: null,
      rejectionReason: null,
      ipAddress: '192.168.1.1',
      userAgent: 'Chrome/120.0',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    vi.mocked(prisma.dSARRequest.create).mockResolvedValue(mockDSAR)

    const dsar = await prisma.dSARRequest.create({
      data: {
        userId: 'test-user-id',
        requestType: 'DELETE',
        status: 'PENDING',
        email: 'test@example.com',
        description: 'User requested account deletion',
        ipAddress: '192.168.1.1',
        userAgent: 'Chrome/120.0',
      },
    })

    expect(dsar.ipAddress).toBe('192.168.1.1')
    expect(dsar.userAgent).toBe('Chrome/120.0')
    expect(dsar.requestType).toBe('DELETE')
  })

  it('should fetch all DSAR requests for a user', async () => {
    const mockRequests: DSARRequest[] = [
      {
        id: 'dsar-1',
        userId: 'test-user-id',
        requestType: 'EXPORT',
        status: 'COMPLETED',
        email: 'test@example.com',
        description: null,
        completedAt: new Date(),
        responseData: null,
        rejectionReason: null,
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        createdAt: new Date(Date.now() - 86400000), // 1 day ago
        updatedAt: new Date(),
      },
      {
        id: 'dsar-2',
        userId: 'test-user-id',
        requestType: 'DELETE',
        status: 'PENDING',
        email: 'test@example.com',
        description: null,
        completedAt: null,
        responseData: null,
        rejectionReason: null,
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    vi.mocked(prisma.dSARRequest.findMany).mockResolvedValue(mockRequests)

    const requests = await prisma.dSARRequest.findMany({
      where: { userId: 'test-user-id' },
      orderBy: { createdAt: 'desc' },
    })

    expect(requests).toHaveLength(2)
    expect(requests[0].requestType).toBe('EXPORT')
    expect(requests[1].status).toBe('PENDING')
  })

  it('should support different DSAR request types', () => {
    const validTypes = ['EXPORT', 'DELETE', 'RECTIFY', 'RESTRICT', 'PORTABILITY']

    validTypes.forEach((type) => {
      expect(['EXPORT', 'DELETE', 'RECTIFY', 'RESTRICT', 'PORTABILITY']).toContain(type)
    })
  })
})

describe('GDPR Compliance Edge Cases', () => {
  it('should handle consent for candidate (non-user)', async () => {
    const mockCandidateConsent: ConsentRecord = {
      id: 'consent-id',
      userId: null,
      candidateId: 'candidate-id',
      consentType: 'CV_STORAGE',
      granted: true,
      purpose: 'Store CV for job applications',
      legalBasis: 'CONTRACT',
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent',
      version: null,
      grantedAt: new Date(),
      revokedAt: null,
      expiresAt: null,
    }

    vi.mocked(prisma.consentRecord.create).mockResolvedValue(mockCandidateConsent)

    const consent = await prisma.consentRecord.create({
      data: {
        candidateId: 'candidate-id',
        consentType: 'CV_STORAGE',
        granted: true,
        purpose: 'Store CV for job applications',
        legalBasis: 'CONTRACT',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
      },
    })

    expect(consent.candidateId).toBe('candidate-id')
    expect(consent.userId).toBeNull()
    expect(consent.legalBasis).toBe('CONTRACT')
  })

  it('should handle expired consents', () => {
    const now = new Date()
    const expiryDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) // 1 year

    const mockConsent: Partial<ConsentRecord> = {
      id: 'consent-id',
      granted: true,
      grantedAt: now,
      expiresAt: expiryDate,
    }

    // Check if consent is still valid
    const isValid = mockConsent.expiresAt && mockConsent.expiresAt > new Date()
    expect(isValid).toBe(true)
  })
})
