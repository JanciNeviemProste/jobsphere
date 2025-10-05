/**
 * GDPR Data Export API
 * Export all user data in machine-readable format
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

/**
 * GET /api/gdpr/export
 * Export all user data as JSON
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Collect all user data
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        accounts: true,
        sessions: true,
        orgMembers: {
          include: {
            organization: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get candidate data if exists
    const candidate = await prisma.candidate.findUnique({
      where: { userId: session.user.id },
      include: {
        resumes: {
          include: {
            sections: true,
          },
        },
        applications: {
          include: {
            job: true,
          },
        },
        documents: true,
      },
    })

    // Get consent records
    const consents = await prisma.consentRecord.findMany({
      where: { userId: session.user.id },
    })

    // Get DSAR requests
    const dsarRequests = await prisma.dSARRequest.findMany({
      where: { userId: session.user.id },
    })

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
        image: user.image,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      accounts: user.accounts.map((acc) => ({
        provider: acc.provider,
        providerAccountId: acc.providerAccountId,
        type: acc.type,
      })),
      organizations: user.orgMembers.map((om) => ({
        organizationId: om.organizationId,
        organizationName: om.organization.name,
        role: om.role,
        joinedAt: om.createdAt,
      })),
      candidate: candidate
        ? {
            id: candidate.id,
            locale: candidate.locale,
            resumes: candidate.resumes,
            applications: candidate.applications.map((app) => ({
              id: app.id,
              jobId: app.jobId,
              jobTitle: app.job.title,
              status: app.status,
              appliedAt: app.createdAt,
            })),
            documents: candidate.documents,
          }
        : null,
      consents: consents,
      dsarRequests: dsarRequests,
      auditLogs: auditLogs.map((log) => ({
        action: log.action,
        resource: log.resource,
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
