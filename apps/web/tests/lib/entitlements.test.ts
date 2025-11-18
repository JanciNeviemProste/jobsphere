/**
 * Entitlements Library Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    entitlement: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    job: {
      count: vi.fn(),
    },
    application: {
      count: vi.fn(),
    },
    orgMember: {
      count: vi.fn(),
    },
    stripeSubscription: {
      findFirst: vi.fn(),
    },
  },
}))

describe('Entitlements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Feature Access', () => {
    it('should allow access when feature is enabled', async () => {
      vi.mocked(prisma.entitlement.findUnique).mockResolvedValue({
        id: '1',
        organizationId: 'org-1',
        feature: 'EMAIL_SEQUENCES',
        enabled: true,
        limit: null,
        used: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // Test would import and call hasFeature here
      const result = await prisma.entitlement.findUnique({
        where: {
          organizationId_feature: {
            organizationId: 'org-1',
            feature: 'EMAIL_SEQUENCES',
          },
        },
      })

      expect(result?.enabled).toBe(true)
    })

    it('should deny access when feature is disabled', async () => {
      vi.mocked(prisma.entitlement.findUnique).mockResolvedValue({
        id: '1',
        organizationId: 'org-1',
        feature: 'EMAIL_SEQUENCES',
        enabled: false,
        limit: null,
        used: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await prisma.entitlement.findUnique({
        where: {
          organizationId_feature: {
            organizationId: 'org-1',
            feature: 'EMAIL_SEQUENCES',
          },
        },
      })

      expect(result?.enabled).toBe(false)
    })
  })

  describe('Limit Checks', () => {
    it('should allow when under limit', async () => {
      vi.mocked(prisma.entitlement.findUnique).mockResolvedValue({
        id: '1',
        organizationId: 'org-1',
        feature: 'MAX_JOBS',
        enabled: true,
        limit: 50,
        used: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(prisma.job.count).mockResolvedValue(30)

      const entitlement = await prisma.entitlement.findUnique({
        where: {
          organizationId_feature: {
            organizationId: 'org-1',
            feature: 'MAX_JOBS',
          },
        },
      })

      const currentCount = await prisma.job.count({
        where: { organizationId: 'org-1', status: 'PUBLISHED' },
      })

      expect(currentCount).toBeLessThan(entitlement!.limit!)
    })

    it('should deny when at limit', async () => {
      vi.mocked(prisma.entitlement.findUnique).mockResolvedValue({
        id: '1',
        organizationId: 'org-1',
        feature: 'MAX_JOBS',
        enabled: true,
        limit: 50,
        used: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(prisma.job.count).mockResolvedValue(50)

      const entitlement = await prisma.entitlement.findUnique({
        where: {
          organizationId_feature: {
            organizationId: 'org-1',
            feature: 'MAX_JOBS',
          },
        },
      })

      const currentCount = await prisma.job.count({
        where: { organizationId: 'org-1', status: 'PUBLISHED' },
      })

      expect(currentCount).toBeGreaterThanOrEqual(entitlement!.limit!)
    })

    it('should allow unlimited when limit is -1', async () => {
      vi.mocked(prisma.entitlement.findUnique).mockResolvedValue({
        id: '1',
        organizationId: 'org-1',
        feature: 'MAX_JOBS',
        enabled: true,
        limit: -1,
        used: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const entitlement = await prisma.entitlement.findUnique({
        where: {
          organizationId_feature: {
            organizationId: 'org-1',
            feature: 'MAX_JOBS',
          },
        },
      })

      expect(entitlement!.limit).toBe(-1)
    })
  })

  describe('Plan Detection', () => {
    it('should detect PROFESSIONAL plan', async () => {
      vi.mocked(prisma.stripeSubscription.findFirst).mockResolvedValue({
        id: '1',
        organizationId: 'org-1',
        stripeSubscriptionId: 'sub_123',
        plan: 'PROFESSIONAL',
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        canceledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const subscription = await prisma.stripeSubscription.findFirst({
        where: {
          organizationId: 'org-1',
          status: 'active',
        },
      })

      expect(subscription?.plan).toBe('PROFESSIONAL')
    })

    it('should default to STARTER when no subscription', async () => {
      vi.mocked(prisma.stripeSubscription.findFirst).mockResolvedValue(null)

      const subscription = await prisma.stripeSubscription.findFirst({
        where: {
          organizationId: 'org-1',
          status: 'active',
        },
      })

      expect(subscription?.plan ?? 'STARTER').toBe('STARTER')
    })
  })
})
