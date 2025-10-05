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
  organizationId: string,
  feature: Feature
): Promise<boolean> {
  const entitlement = await prisma.entitlement.findUnique({
    where: {
      organizationId_feature: {
        organizationId,
        feature,
      },
    },
  })

  return entitlement?.enabled ?? false
}

/**
 * Get feature limit for organization
 */
export async function getFeatureLimit(
  organizationId: string,
  feature: Feature
): Promise<number> {
  const entitlement = await prisma.entitlement.findUnique({
    where: {
      organizationId_feature: {
        organizationId,
        feature,
      },
    },
  })

  return entitlement?.limit ?? 0
}

/**
 * Check if organization can create more items
 */
export async function canCreateJob(organizationId: string): Promise<boolean> {
  const limit = await getFeatureLimit(organizationId, 'MAX_JOBS')

  if (limit === -1) return true // unlimited

  const currentCount = await prisma.job.count({
    where: { organizationId, status: 'PUBLISHED' },
  })

  return currentCount < limit
}

export async function canAddCandidate(organizationId: string): Promise<boolean> {
  const limit = await getFeatureLimit(organizationId, 'MAX_CANDIDATES')

  if (limit === -1) return true

  const currentCount = await prisma.application.count({
    where: { job: { organizationId } },
  })

  return currentCount < limit
}

export async function canAddTeamMember(organizationId: string): Promise<boolean> {
  const limit = await getFeatureLimit(organizationId, 'MAX_TEAM_MEMBERS')

  if (limit === -1) return true

  const currentCount = await prisma.orgMember.count({
    where: { organizationId },
  })

  return currentCount < limit
}

/**
 * Get current plan for organization
 */
export async function getCurrentPlan(
  organizationId: string
): Promise<'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' | null> {
  const subscription = await prisma.stripeSubscription.findFirst({
    where: {
      organizationId,
      status: 'active',
    },
    orderBy: { currentPeriodEnd: 'desc' },
  })

  return subscription?.plan ?? 'STARTER'
}

/**
 * Get all entitlements for organization
 */
export async function getEntitlements(organizationId: string) {
  const entitlements = await prisma.entitlement.findMany({
    where: { organizationId },
  })

  const plan = await getCurrentPlan(organizationId)

  return {
    plan,
    features: entitlements.reduce(
      (acc, e) => {
        acc[e.feature] = {
          enabled: e.enabled,
          limit: e.limit,
          used: e.used || 0,
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
export async function requireFeature(organizationId: string, feature: Feature) {
  const enabled = await hasFeature(organizationId, feature)

  if (!enabled) {
    throw new Error(`Feature ${feature} not available on your plan. Please upgrade.`)
  }
}

/**
 * Increment usage for a feature
 */
export async function incrementUsage(organizationId: string, feature: Feature) {
  await prisma.entitlement.update({
    where: {
      organizationId_feature: {
        organizationId,
        feature,
      },
    },
    data: {
      used: {
        increment: 1,
      },
    },
  })
}
