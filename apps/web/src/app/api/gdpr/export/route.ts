/**
 * GDPR Data Export API (Art. 15 — Right of Access)
 * Export ALL of a user's personal data in machine-readable form, including the
 * candidate-side PII (profiles, contacts, resumes, applications, documents) that
 * is linked to the user via the canonical identity resolver.
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limit'
import { getCandidateIdsForUser } from '@/lib/identity'

export const runtime = 'nodejs'

/**
 * GET /api/gdpr/export
 * Export all user data as JSON
 */
export const GET = withRateLimit(
  async (_req: Request) => {
    try {
      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Collect user data (select only safe fields - NEVER password or totpSecret)
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          phone: true,
          locale: true,
          timezone: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
          // SECURITY: Explicitly exclude sensitive fields (password, totpSecret, sessions, accounts)
          organizations: {
            select: {
              orgId: true,
              role: true,
              organization: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      })

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      // Resolve the candidate rows linked to this user across all orgs (canonical
      // identity resolver — do NOT treat session.user.id as a Candidate id).
      const candidateIds = await getCandidateIdsForUser(session.user.id)

      const candidates =
        candidateIds.length > 0
          ? await prisma.candidate.findMany({
              where: { id: { in: candidateIds } },
              select: {
                id: true,
                orgId: true,
                source: true,
                tags: true,
                createdAt: true,
                updatedAt: true,
                organization: { select: { name: true } },
                contacts: {
                  select: {
                    fullName: true,
                    email: true,
                    phone: true,
                    linkedIn: true,
                    github: true,
                    portfolio: true,
                    location: true,
                    city: true,
                    country: true,
                    primaryLocale: true,
                    availableFrom: true,
                    salaryExpectation: true,
                    isPrimary: true,
                  },
                },
                resumes: {
                  where: { deletedAt: null },
                  select: {
                    id: true,
                    language: true,
                    summary: true,
                    yearsOfExperience: true,
                    personalInfo: true,
                    experiences: true,
                    education: true,
                    skills: true,
                    languages: true,
                    certifications: true,
                    projects: true,
                    createdAt: true,
                  },
                },
                documents: {
                  where: { deletedAt: null },
                  select: {
                    id: true,
                    type: true,
                    filename: true,
                    mime: true,
                    size: true,
                    createdAt: true,
                    // SECURITY: never expose the raw blob `uri`; expose the
                    // authenticated download path instead.
                  },
                },
                applications: {
                  where: { deletedAt: null },
                  select: {
                    id: true,
                    stage: true,
                    source: true,
                    coverLetter: true,
                    createdAt: true,
                    updatedAt: true,
                    job: { select: { title: true } },
                  },
                },
              },
            })
          : []

      // Shape candidate data for export, replacing raw blob URIs with the
      // authenticated download endpoint.
      const candidateExport = candidates.map((c) => ({
        id: c.id,
        organizationId: c.orgId,
        organizationName: c.organization?.name ?? null,
        source: c.source,
        tags: c.tags,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        contacts: c.contacts,
        resumes: c.resumes,
        documents: c.documents.map((d) => ({
          id: d.id,
          type: d.type,
          filename: d.filename,
          mime: d.mime,
          size: d.size,
          createdAt: d.createdAt,
          downloadUrl: `/api/cv/${d.id}/download`,
        })),
        applications: c.applications.map((a) => ({
          id: a.id,
          jobTitle: a.job?.title ?? null,
          stage: a.stage,
          source: a.source,
          coverLetter: a.coverLetter,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
        })),
      }))

      // Get consent records (both user-linked and candidate-linked)
      const consents = await prisma.consentRecord.findMany({
        where: {
          OR: [
            { userId: session.user.id },
            ...(candidateIds.length > 0 ? [{ candidateId: { in: candidateIds } }] : []),
          ],
        },
      })

      // Get DSAR requests (Data Subject Access Requests)
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
          avatar: user.avatar,
          phone: user.phone,
          locale: user.locale,
          timezone: user.timezone,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        organizations: user.organizations.map((om) => ({
          organizationId: om.orgId,
          organizationName: om.organization.name,
          role: om.role,
        })),
        candidates: candidateExport,
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
      logger.error('Data export error:', error)
      return NextResponse.json({ error: 'Failed to export data' }, { status: 500 })
    }
  },
  { preset: 'api' },
)
