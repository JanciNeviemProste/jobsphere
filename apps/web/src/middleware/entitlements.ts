/**
 * Entitlements Middleware
 * API route protection based on subscription features
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '../lib/db'
import { hasFeature, canCreateJob, canAddCandidate, Feature } from '../lib/entitlements'

/**
 * Middleware to check feature access
 */
export async function requireFeatureMiddleware(
  request: NextRequest,
  feature: Feature
): Promise<{ allowed: boolean; error?: string; organizationId?: string }> {
  // Get session
  const session = await auth()

  if (!session?.user?.id) {
    return { allowed: false, error: 'Unauthorized' }
  }

  // Get organization
  const orgMember = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
  })

  if (!orgMember) {
    return { allowed: false, error: 'No organization found' }
  }

  // Check feature access
  const enabled = await hasFeature(orgMember.organizationId, feature)

  if (!enabled) {
    return {
      allowed: false,
      error: `Feature ${feature} is not available on your plan. Please upgrade.`,
      organizationId: orgMember.organizationId,
    }
  }

  return { allowed: true, organizationId: orgMember.organizationId }
}

/**
 * Check if can create job
 */
export async function canCreateJobMiddleware(
  request: NextRequest
): Promise<{ allowed: boolean; error?: string }> {
  const session = await auth()

  if (!session?.user?.id) {
    return { allowed: false, error: 'Unauthorized' }
  }

  const orgMember = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
  })

  if (!orgMember) {
    return { allowed: false, error: 'No organization' }
  }

  const canCreate = await canCreateJob(orgMember.organizationId)

  if (!canCreate) {
    return {
      allowed: false,
      error: 'Job limit reached for your plan. Please upgrade or archive old jobs.',
    }
  }

  return { allowed: true }
}

/**
 * Check if can add candidate
 */
export async function canAddCandidateMiddleware(
  request: NextRequest
): Promise<{ allowed: boolean; error?: string }> {
  const session = await auth()

  if (!session?.user?.id) {
    return { allowed: false, error: 'Unauthorized' }
  }

  const orgMember = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
  })

  if (!orgMember) {
    return { allowed: false, error: 'No organization' }
  }

  const canAdd = await canAddCandidate(orgMember.organizationId)

  if (!canAdd) {
    return {
      allowed: false,
      error: 'Candidate limit reached. Please upgrade your plan.',
    }
  }

  return { allowed: true }
}

/**
 * Helper to create entitlement error response
 */
export function createEntitlementError(message: string, plan?: string) {
  return NextResponse.json(
    {
      error: message,
      code: 'ENTITLEMENT_ERROR',
      currentPlan: plan,
      upgradeUrl: '/pricing',
    },
    { status: 403 }
  )
}
