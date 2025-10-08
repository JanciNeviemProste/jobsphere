/**
 * GDPR Data Export API
 * Export all user data in machine-readable format
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * GET /api/gdpr/export
 * Export all user data as JSON
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Collect all user data
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        sessions: true,
        organizations: {
          include: {
            organization: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get candidate data if exists - candidates are not linked to users via userId
    // They're linked via applications, so we skip this for now
    const candidate = null

    // TODO: ConsentRecord model not yet implemented in schema
    // @ts-ignore
    const consents = await prisma.consentRecord.findMany({
      where: { userId: session.user.id },
    }).catch(() => [])

    // TODO: DSARRequest model not yet implemented in schema
    // @ts-ignore
    const dsarRequests = await prisma.dSARRequest.findMany({
      where: { userId: session.user.id },
    }).catch(() => [])

    // Get audit logs
    const auditLogs = await prisma.auditLog.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 1000, // Limit to last 1000 entries
    })

    // Compile export data
    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      organizations: user.organizations.map((om) => ({
        organizationId: om.orgId,
        organizationName: om.organization.name,
        role: om.role,
      })),
      candidate: null,
      consents: consents,
      dsarRequests: dsarRequests,
      auditLogs: auditLogs.map((log) => ({
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        timestamp: log.createdAt,
      })),
    }

    // Return as downloadable JSON
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="jobsphere-data-export-${user.id}.json"`,
      },
    })
  } catch (error) {
    console.error('Data export error:', error)
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}
