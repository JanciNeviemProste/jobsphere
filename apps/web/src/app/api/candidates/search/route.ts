/**
 * Candidate Search API
 * Find matching candidates for a job using semantic search
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { searchCandidates } from '@/lib/semantic-search'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const searchSchema = z.object({
  jobId: z.string().min(1, 'Job ID is required'),
  limit: z.number().int().positive().max(100).optional().default(10),
  minSimilarity: z.number().min(0).max(1).optional().default(0.5),
  includeDetails: z.boolean().optional().default(true),
})

export const POST = withRateLimit(
  async (req: Request) => {
    try {
      // 1. Verify authentication
      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // 2. Parse and validate request body
      const body = await req.json()
      const validation = searchSchema.safeParse(body)

      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid request', details: validation.error.format() },
          { status: 400 },
        )
      }

      const { jobId, limit, minSimilarity, includeDetails } = validation.data

      // 3. Get job with organization check
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: { organization: true },
      })

      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }

      // 4. Verify user has access to this organization
      const userOrg = await prisma.userOrgRole.findFirst({
        where: {
          userId: session.user.id,
          orgId: job.orgId,
        },
      })

      if (!userOrg) {
        return NextResponse.json(
          { error: 'Forbidden - not a member of this organization' },
          { status: 403 },
        )
      }

      // 5. Perform semantic search
      const matches = await searchCandidates({
        jobDescription: job.description + '\n\n' + (job.requirements || ''),
        organizationId: job.orgId,
        limit,
        minSimilarity,
        includeDetails,
      })

      // 6. Filter out candidates who already applied.
      // The set is only ever probed with ids from `matches`, so narrow the query to
      // those ids instead of loading every Application row for the job (a popular
      // job can have thousands). `matches` is capped by `limit` (<= 100), which also
      // bounds this lookup. Behaviour is identical: probes outside the narrowed set
      // could never have hit the old set either.
      const matchCandidateIds = matches.map((m) => m.candidateId)
      const applicantIds = matchCandidateIds.length
        ? await prisma.application.findMany({
            where: { jobId: job.id, candidateId: { in: matchCandidateIds } },
            select: { candidateId: true },
          })
        : []
      const appliedCandidateIds = new Set(applicantIds.map((a) => a.candidateId))

      const filteredMatches = matches.filter((match) => !appliedCandidateIds.has(match.candidateId))

      // 7. Get candidate contact info for top matches (single query to avoid N+1)
      const contacts = await prisma.candidateContact.findMany({
        where: {
          candidateId: { in: filteredMatches.map((m) => m.candidateId) },
          isPrimary: true,
        },
        select: {
          candidateId: true,
          fullName: true,
          email: true,
          location: true,
          availableFrom: true,
        },
      })

      // Create a map for O(1) lookup
      const contactMap = new Map(contacts.map((c) => [c.candidateId, c]))

      // Attach contacts to matches
      const matchesWithContacts = filteredMatches.map((match) => ({
        ...match,
        contact: contactMap.get(match.candidateId) || undefined,
      }))

      return NextResponse.json({
        success: true,
        jobId: job.id,
        jobTitle: job.title,
        totalMatches: matchesWithContacts.length,
        matches: matchesWithContacts,
      })
    } catch (error) {
      logger.error('Candidate search error:', error)
      return NextResponse.json({ error: 'Failed to search candidates' }, { status: 500 })
    }
  },
  { preset: 'api' },
)
