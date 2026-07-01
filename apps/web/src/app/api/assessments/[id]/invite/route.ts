/**
 * Assessment Invite API (POST)
 *
 * A recruiter who is a member of the assessment's organization mints an invite
 * for a candidate (optionally tied to a job). Returns only the opaque token.
 *
 * Org-scoping: the caller must belong to the assessment's org with a
 * recruiter-level role, and the candidate (and job, if given) must live in the
 * SAME org — this closes cross-tenant invite IDOR.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { withCsrfProtection } from '@/lib/csrf'
import { withRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { createOrGetAssessmentInvite } from '@/lib/assessment-invite'

export const runtime = 'nodejs'

const INVITE_ROLES = ['ORG_ADMIN', 'RECRUITER', 'HIRING_MANAGER']

const inviteSchema = z.object({
  candidateId: z.string().cuid(),
  jobId: z.string().cuid().optional(),
})

export const POST = withCsrfProtection<Request>(
  withRateLimit<Request>(
    async (request: Request, context?: { params?: Record<string, string> }) => {
      const params = context?.params
      if (!params?.id) {
        return NextResponse.json({ error: 'Missing assessment ID' }, { status: 400 })
      }

      try {
        const session = await auth()
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json().catch(() => ({}))
        const parsed = inviteSchema.safeParse(body)
        if (!parsed.success) {
          return NextResponse.json(
            { error: 'Invalid invite data', details: parsed.error.flatten().fieldErrors },
            { status: 400 },
          )
        }
        const { candidateId, jobId } = parsed.data

        // Load the assessment to resolve its org.
        const assessment = await prisma.assessment.findUnique({
          where: { id: params.id },
          select: { id: true, orgId: true },
        })
        if (!assessment) {
          return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
        }

        // Caller must be a recruiter-level member of the assessment's org.
        const membership = await prisma.userOrgRole.findFirst({
          where: { userId: session.user.id, orgId: assessment.orgId },
          select: { role: true },
        })
        if (!membership || !INVITE_ROLES.includes(membership.role)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Candidate must belong to the same org (prevents cross-tenant invite).
        const candidate = await prisma.candidate.findFirst({
          where: { id: candidateId, orgId: assessment.orgId, deletedAt: null },
          select: { id: true },
        })
        if (!candidate) {
          return NextResponse.json(
            { error: 'Candidate not found in this organization' },
            { status: 404 },
          )
        }

        // If a job is given it must also belong to the same org.
        if (jobId) {
          const job = await prisma.job.findFirst({
            where: { id: jobId, orgId: assessment.orgId },
            select: { id: true },
          })
          if (!job) {
            return NextResponse.json(
              { error: 'Job not found in this organization' },
              { status: 404 },
            )
          }
        }

        const { token, created } = await createOrGetAssessmentInvite({
          assessmentId: assessment.id,
          candidateId,
          jobId: jobId ?? null,
        })

        logger.info('Assessment invite issued', {
          assessmentId: assessment.id,
          candidateId,
          created,
        })

        return NextResponse.json({ token }, { status: created ? 201 : 200 })
      } catch (error) {
        logger.error('Failed to create assessment invite', error)
        return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
      }
    },
    { preset: 'api', byUser: true },
  ),
)
