import { describe, it, expect, beforeEach, vi } from 'vitest'
import { hasFeature, canCreateJob, getFeatureLimit, canAddCandidate, canAddTeamMember, getCurrentPlan } from '../entitlements'
import { createMockEntitlement, createMockOrgCustomer } from '../../../tests/helpers/factories'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    entitlement: {
      findUnique: vi.fn(),
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
    orgCustomer: {
      findUnique: vi.fn(),
    },
  },
}))

describe('Entitlements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('hasFeature', () => {
    it('should return true when limitInt > 0', async () => {
      const mockEntitlement = createMockEntitlement({
        featureKey: 'AI_MATCHING',
        limitInt: 1
      })

      vi.mocked(prisma.entitlement.findUnique).mockResolvedValue(mockEntitlement as any)

      const result = await hasFeature('org-123', 'AI_MATCHING')

      expect(result).toBe(true)
      expect(prisma.entitlement.findUnique).toHaveBeenCalledWith({
        where: {
          orgId_featureKey: {
            orgId: 'org-123',
            featureKey: 'AI_MATCHING'
          }
        }
      })
    })

    it('should return false when limitInt is 0', async () => {
      const mockEntitlement = createMockEntitlement({ limitInt: 0 })
      vi.mocked(prisma.entitlement.findUnique).mockResolvedValue(mockEntitlement as any)

      const result = await hasFeature('org-123', 'AI_MATCHING')

      expect(result).toBe(false)
    })

    it('should return false when entitlement not found', async () => {
      vi.mocked(prisma.entitlement.findUnique).mockResolvedValue(null)

      const result = await hasFeature('org-123', 'AI_MATCHING')

      expect(result).toBe(false)
    })
  })

  describe('canCreateJob', () => {
    it('should return true when under limit', async () => {
      vi.mocked(prisma.entitlement.findUnique).mockResolvedValue(
        createMockEntitlement({ featureKey: 'MAX_JOBS', limitInt: 5 }) as any
      )
      vi.mocked(prisma.job.count).mockResolvedValue(3 as any)

      const result = await canCreateJob('org-123')

      expect(result).toBe(true)
      expect(prisma.job.count).toHaveBeenCalledWith({
        where: { orgId: 'org-123', status: 'PUBLISHED' }
      })
    })

    it('should return false when at limit', async () => {
      vi.mocked(prisma.entitlement.findUnique).mockResolvedValue(
        createMockEntitlement({ featureKey: 'MAX_JOBS', limitInt: 5 }) as any
      )
      vi.mocked(prisma.job.count).mockResolvedValue(5 as any)

      const result = await canCreateJob('org-123')

      expect(result).toBe(false)
    })

    it('should return true for unlimited (null)', async () => {
      vi.mocked(prisma.entitlement.findUnique).mockResolvedValue(
        createMockEntitlement({ featureKey: 'MAX_JOBS', limitInt: null }) as any
      )

      const result = await canCreateJob('org-123')

      expect(result).toBe(true)
      expect(prisma.job.count).not.toHaveBeenCalled()
    })
  })

  describe('getFeatureLimit', () => {
    it('should return limitInt when entitlement exists', async () => {
      vi.mocked(prisma.entitlement.findUnique).mockResolvedValue(
        createMockEntitlement({ limitInt: 10 }) as any
      )

      const result = await getFeatureLimit('org-123', 'MAX_JOBS')

      expect(result).toBe(10)
    })

    it('should return 0 when entitlement not found', async () => {
      vi.mocked(prisma.entitlement.findUnique).mockResolvedValue(null)

      const result = await getFeatureLimit('org-123', 'MAX_JOBS')

      expect(result).toBe(0)
    })

    it('should return null for unlimited', async () => {
      vi.mocked(prisma.entitlement.findUnique).mockResolvedValue(
        createMockEntitlement({ limitInt: null }) as any
      )

      const result = await getFeatureLimit('org-123', 'MAX_JOBS')

      expect(result).toBe(null)
    })
  })

  describe('canAddCandidate', () => {
    it('should return true when under limit', async () => {
      vi.mocked(prisma.entitlement.findUnique).mockResolvedValue(
        createMockEntitlement({ featureKey: 'MAX_CANDIDATES', limitInt: 100 }) as any
      )
      vi.mocked(prisma.application.count).mockResolvedValue(50 as any)

      const result = await canAddCandidate('org-123')

      expect(result).toBe(true)
      expect(prisma.application.count).toHaveBeenCalledWith({
        where: { job: { orgId: 'org-123' } }
      })
    })

    it('should return false when at limit', async () => {
      vi.mocked(prisma.entitlement.findUnique).mockResolvedValue(
        createMockEntitlement({ featureKey: 'MAX_CANDIDATES', limitInt: 100 }) as any
      )
      vi.mocked(prisma.application.count).mockResolvedValue(100 as any)

      const result = await canAddCandidate('org-123')

      expect(result).toBe(false)
    })
  })

  describe('canAddTeamMember', () => {
    it('should return true when under limit', async () => {
      vi.mocked(prisma.entitlement.findUnique).mockResolvedValue(
        createMockEntitlement({ featureKey: 'MAX_TEAM_MEMBERS', limitInt: 10 }) as any
      )
      vi.mocked(prisma.orgMember.count).mockResolvedValue(5 as any)

      const result = await canAddTeamMember('org-123')

      expect(result).toBe(true)
      expect(prisma.orgMember.count).toHaveBeenCalledWith({
        where: { orgId: 'org-123' }
      })
    })
  })

  describe('getCurrentPlan', () => {
    it('should return plan from active subscription', async () => {
      vi.mocked(prisma.orgCustomer.findUnique).mockResolvedValue({
        id: '123',
        orgId: 'org-123',
        stripeCustomerId: 'cus_123',
        stripePaymentMethod: null,
        vatId: null,
        taxExempt: false,
        address: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        subscriptions: [{
          id: 'sub-123',
          customerId: '123',
          stripeSubId: 'sub_123',
          productId: 'price_123',
          planKey: 'PROFESSIONAL',
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(),
          cancelAtPeriodEnd: false,
          canceledAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }]
      } as any)

      const result = await getCurrentPlan('org-123')

      expect(result).toBe('PROFESSIONAL')
    })

    it('should return STARTER when no subscription', async () => {
      vi.mocked(prisma.orgCustomer.findUnique).mockResolvedValue(null)

      const result = await getCurrentPlan('org-123')

      expect(result).toBe('STARTER')
    })
  })
})