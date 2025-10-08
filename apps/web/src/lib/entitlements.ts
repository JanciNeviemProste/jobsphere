/**
 * Entitlements Library
 * Feature gates and usage limits based on subscription
 */

import { prisma } from './db'

export type Feature =
  | 'MAX_JOBS'
  | 'MAX_CANDIDATES'
  | 'MAX_TEAM_MEMBERS'
  | 'EMAIL_SEQUENCES'
  | 'ASSESSMENTS'
  | 'AI_MATCHING'
  | 'CUSTOM_BRANDING'
  | 'API_ACCESS'

/**
 * Check if organization has access to a feature
 */
export async function hasFeature(
  orgId: string,
  feature: Feature
): Promise<boolean> {
  const entitlement = await prisma.entitlement.findUnique({
    where: {
      orgId_featureKey: {
        orgId,
        featureKey: feature,
      },
    },
  })

  // For boolean features, limitInt > 0 means enabled
  return (entitlement?.limitInt ?? 0) > 0
}

/**
 * Get feature limit for organization
 */
export async function getFeatureLimit(
  orgId: string,
  feature: Feature
): Promise<number | null> {
  const entitlement = await prisma.entitlement.findUnique({
    where: {
      orgId_featureKey: {
        orgId,
        featureKey: feature,
      },
    },
  })

  // If no entitlement found, return 0
  if (!entitlement) return 0

  // Preserve null for unlimited limits
  return entitlement.limitInt
}

/**
 * Check if organization can create more items
 */
export async function canCreateJob(orgId: string): Promise<boolean> {
  const limit = await getFeatureLimit(orgId, 'MAX_JOBS')

  if (limit === null) return true // unlimited

  const currentCount = await prisma.job.count({
    where: { organizationId: orgId, status: 'PUBLISHED' },
  })

  return currentCount < limit
}

export async function canAddCandidate(orgId: string): Promise<boolean> {
  const limit = await getFeatureLimit(orgId, 'MAX_CANDIDATES')

  if (limit === null) return true

  const currentCount = await prisma.application.count({
    where: { job: { organizationId: orgId } },
  })

  return currentCount < limit
}

export async function canAddTeamMember(orgId: string): Promise<boolean> {
  const limit = await getFeatureLimit(orgId, 'MAX_TEAM_MEMBERS')

  if (limit === null) return true

  const currentCount = await prisma.orgMember.count({
    where: { organizationId: orgId },
  })

  return currentCount < limit
}

/**
 * Get current plan for organization
 */
export async function getCurrentPlan(
  orgId: string
): Promise<'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' | null> {
  const customer = await prisma.orgCustomer.findUnique({
    where: { orgId },
    include: {
      subscriptions: {
        where: { status: 'ACTIVE' },
        orderBy: { currentPeriodEnd: 'desc' },
        take: 1,
      },
    },
  })

  const planKey = customer?.subscriptions[0]?.planKey
  return (planKey as 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE') ?? 'STARTER'
}

/**
 * Get all entitlements for organization
 */
export async function getEntitlements(orgId: string) {
  const entitlements = await prisma.entitlement.findMany({
    where: { orgId },
  })

  const plan = await getCurrentPlan(orgId)

  return {
    plan,
    features: entitlements.reduce(
      (acc, e) => {
        acc[e.featureKey] = {
          enabled: (e.limitInt ?? 0) > 0,
          limit: e.limitInt,
          used: e.limitInt !== null && e.remainingInt !== null
            ? e.limitInt - e.remainingInt
            : 0,
        }
        return acc
      },
      {} as Record<string, { enabled: boolean; limit: number | null; used: number }>
    ),
  }
}

/**
 * Middleware helper - throws if feature not enabled
 */
export async function requireFeature(orgId: string, feature: Feature) {
  const enabled = await hasFeature(orgId, feature)

  if (!enabled) {
    throw new Error(`Feature ${feature} not available on your plan. Please upgrade.`)
  }
}

/**
 * Increment usage for a feature
 */
export async function incrementUsage(orgId: string, feature: Feature) {
  await prisma.entitlement.update({
    where: {
      orgId_featureKey: {
        orgId,
        featureKey: feature,
      },
    },
    data: {
      remainingInt: {
        decrement: 1,
      },
    },
  })
}

/**
 * Check if organization has entitlement capacity for a feature
 * Returns true if organization can use/create more of the feature
 */
export async function checkEntitlement(
  orgId: string,
  feature: Feature
): Promise<boolean> {
  const entitlement = await prisma.entitlement.findUnique({
    where: {
      orgId_featureKey: {
        orgId,
        featureKey: feature,
      },
    },
  })

  // If no entitlement exists, default to starter plan limits
  if (!entitlement) {
    return true // Or false depending on your default policy
  }

  // Check if there's remaining capacity
  const remaining = entitlement.remainingInt ?? 0
  const limit = entitlement.limitInt ?? 0

  // If limit is 0, it might mean unlimited (depending on your logic)
  // Or it might mean no access
  if (limit === 0) {
    return false
  }

  return remaining > 0
}

/**
 * Consume entitlement capacity (decrement remaining count)
 * @param orgId Organization ID
 * @param feature Feature to consume
 * @param amount Amount to consume (default: 1)
 * @param tx Optional Prisma transaction client
 */
export async function consumeEntitlement(
  orgId: string,
  feature: Feature,
  amount: number = 1,
  tx?: typeof prisma
): Promise<void> {
  const client = tx ?? prisma

  await client.entitlement.update({
    where: {
      orgId_featureKey: {
        orgId,
        featureKey: feature,
      },
    },
    data: {
      remainingInt: {
        decrement: amount,
      },
    },
  })
}
