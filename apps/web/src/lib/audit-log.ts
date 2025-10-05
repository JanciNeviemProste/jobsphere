/**
 * Audit Logging
 * Track security-relevant actions for compliance
 */

import { prisma } from './db'

export type AuditAction =
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'PASSWORD_CHANGED'
  | 'EMAIL_CHANGED'
  | 'JOB_CREATED'
  | 'JOB_UPDATED'
  | 'JOB_DELETED'
  | 'CANDIDATE_VIEWED'
  | 'CANDIDATE_EXPORTED'
  | 'APPLICATION_CREATED'
  | 'APPLICATION_STATUS_CHANGED'
  | 'ASSESSMENT_CREATED'
  | 'ASSESSMENT_SUBMITTED'
  | 'EMAIL_SENT'
  | 'SUBSCRIPTION_CREATED'
  | 'SUBSCRIPTION_CANCELED'
  | 'DATA_EXPORTED'
  | 'CONSENT_GRANTED'
  | 'CONSENT_REVOKED'
  | 'DSAR_REQUESTED'

export type AuditResource =
  | 'USER'
  | 'JOB'
  | 'CANDIDATE'
  | 'APPLICATION'
  | 'ASSESSMENT'
  | 'EMAIL'
  | 'SUBSCRIPTION'
  | 'CONSENT'
  | 'DSAR'

export interface AuditLogEntry {
  userId?: string
  organizationId?: string
  action: AuditAction
  resource: AuditResource
  resourceId?: string
  metadata?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

/**
 * Create audit log entry
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        organizationId: entry.organizationId,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        metadata: entry.metadata || {},
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    })
  } catch (error) {
    // Log error but don't fail the main operation
    console.error('Failed to create audit log:', error)
  }
}

/**
 * Helper to extract request metadata
 */
export function getRequestMetadata(request: Request): {
  ipAddress: string
  userAgent: string
} {
  return {
    ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  }
}

/**
 * Log user authentication
 */
export async function logUserLogin(
  userId: string,
  request: Request
): Promise<void> {
  const { ipAddress, userAgent } = getRequestMetadata(request)

  await createAuditLog({
    userId,
    action: 'USER_LOGIN',
    resource: 'USER',
    resourceId: userId,
    ipAddress,
    userAgent,
  })
}

/**
 * Log data access (GDPR compliance)
 */
export async function logDataAccess(
  userId: string,
  organizationId: string,
  resourceType: AuditResource,
  resourceId: string,
  request: Request
): Promise<void> {
  const { ipAddress, userAgent } = getRequestMetadata(request)

  await createAuditLog({
    userId,
    organizationId,
    action: 'CANDIDATE_VIEWED',
    resource: resourceType,
    resourceId,
    ipAddress,
    userAgent,
  })
}

/**
 * Log data export (GDPR compliance)
 */
export async function logDataExport(
  userId: string,
  organizationId: string | undefined,
  exportType: string,
  request: Request
): Promise<void> {
  const { ipAddress, userAgent } = getRequestMetadata(request)

  await createAuditLog({
    userId,
    organizationId,
    action: 'DATA_EXPORTED',
    resource: 'CANDIDATE',
    metadata: { exportType },
    ipAddress,
    userAgent,
  })
}

/**
 * Log sensitive action
 */
export async function logSensitiveAction(
  userId: string,
  action: AuditAction,
  resource: AuditResource,
  resourceId: string,
  request: Request,
  metadata?: Record<string, any>
): Promise<void> {
  const { ipAddress, userAgent } = getRequestMetadata(request)

  await createAuditLog({
    userId,
    action,
    resource,
    resourceId,
    metadata,
    ipAddress,
    userAgent,
  })
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(filters: {
  userId?: string
  organizationId?: string
  action?: AuditAction
  resource?: AuditResource
  startDate?: Date
  endDate?: Date
  limit?: number
}) {
  const where: any = {}

  if (filters.userId) where.userId = filters.userId
  if (filters.organizationId) where.organizationId = filters.organizationId
  if (filters.action) where.action = filters.action
  if (filters.resource) where.resource = filters.resource

  if (filters.startDate || filters.endDate) {
    where.createdAt = {}
    if (filters.startDate) where.createdAt.gte = filters.startDate
    if (filters.endDate) where.createdAt.lte = filters.endDate
  }

  return prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters.limit || 100,
  })
}
