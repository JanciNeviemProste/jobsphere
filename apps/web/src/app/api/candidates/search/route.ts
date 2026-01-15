/**
 * Candidate Search API
 * Find matching candidates for a job using semantic search
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { searchCandidates } from '@/lib/semantic-search'
import { z } from 'zod'

const searchSchema = z.object({
  jobId: z.string().min(1, 'Job ID is required'),
  limit: z.number().int().positive().max(100).optional().default(10),
  minSimilarity: z.number().min(0).max(1).optional().default(0.5),
  includeDetails: z.boolean().optional().default(true),
})

export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Parse and validate request body
    const body = await request.json()
    const validation = searchSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { jobId, limit, minSimilarity, includeDetails } = validation.data

    // 3. Get job with organization check
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { organization: true }
    })

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // 4. Verify user has access to this organization
    const userOrg = await prisma.userOrgRole.findFirst({
      where: {
        userId: session.user.id,
        orgId: job.orgId
      }
    })

    if (!userOrg) {
      return NextResponse.json(
        { error: 'Forbidden - not a member of this organization' },
        { status: 403 }
      )
    }

    // 5. Perform semantic search
    const matches = await searchCandidates({
      jobDescription: job.description + '\n\n' + (job.requirements || ''),
      organizationId: job.orgId,
      limit,
      minSimilarity,
      includeDetails
    })

    // 6. Filter out candidates who already applied
    const applicantIds = await prisma.application.findMany({
      where: { jobId: job.id },
      select: { candidateId: true }
    })
    const appliedCandidateIds = new Set(applicantIds.map(a => a.candidateId))

    const filteredMatches = matches.filter(
      match => !appliedCandidateIds.has(match.candidateId)
    )

    // 7. Get candidate contact info for top matches
    const matchesWithContacts = await Promise.all(
      filteredMatches.map(async (match) => {
        const contact = await prisma.candidateContact.findFirst({
          where: {
            candidateId: match.candidateId,
            isPrimary: true
          },
          select: {
            fullName: true,
            email: true,
            location: true,
            availableFrom: true
          }
        })

        return {
          ...match,
          contact: contact || undefined
        }
      })
    )

    return NextResponse.json({
      success: true,
      jobId: job.id,
      jobTitle: job.title,
      totalMatches: matchesWithContacts.length,
      matches: matchesWithContacts
    })

  } catch (error) {
    console.error('Candidate search error:', error)
    return NextResponse.json(
      { error: 'Failed to search candidates', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
