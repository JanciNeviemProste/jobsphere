/**
 * Assessment invite helpers
 *
 * A single place to mint / resolve AssessmentInvite rows so the recruiter invite
 * endpoint and the auto-invite on apply (requiresAssessment) behave identically.
 *
 * SECURITY: this only ever issues an opaque access token. It never touches (let
 * alone returns) the secret answer fields (correctIndexes / rubric / testCases).
 */

import { randomBytes } from 'crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'

/** How long a freshly minted invite stays valid. */
const INVITE_TTL_DAYS = 14

/** Cryptographically-random, URL-safe-enough opaque invite token. */
export function generateInviteToken(): string {
  return randomBytes(32).toString('hex')
}

type PrismaLike = Prisma.TransactionClient | typeof prisma

/**
 * Idempotently obtain an AssessmentInvite for (assessmentId, candidateId).
 *
 * The `@@unique([assessmentId, candidateId])` constraint means a second call for
 * the same pair returns the *existing* invite (and its token) instead of creating
 * a duplicate — so re-applying or re-inviting is safe. Returns `created` so the
 * caller can pick an appropriate status code.
 */
export async function createOrGetAssessmentInvite(
  params: { assessmentId: string; candidateId: string; jobId?: string | null },
  tx?: Prisma.TransactionClient,
): Promise<{ token: string; status: string; created: boolean }> {
  const db: PrismaLike = tx ?? prisma
  const where = {
    assessmentId_candidateId: {
      assessmentId: params.assessmentId,
      candidateId: params.candidateId,
    },
  }

  const existing = await db.assessmentInvite.findUnique({
    where,
    select: { token: true, status: true },
  })
  if (existing) {
    return { token: existing.token, status: existing.status, created: false }
  }

  const token = generateInviteToken()
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)

  try {
    const invite = await db.assessmentInvite.create({
      data: {
        assessmentId: params.assessmentId,
        candidateId: params.candidateId,
        jobId: params.jobId ?? null,
        token,
        status: 'SENT',
        expiresAt,
      },
      select: { token: true, status: true },
    })
    return { token: invite.token, status: invite.status, created: true }
  } catch (error) {
    // Concurrent create for the same (assessment, candidate) pair — resolve to the
    // row that won the race rather than surfacing a unique-constraint error.
    if ((error as { code?: string })?.code === 'P2002') {
      const again = await db.assessmentInvite.findUnique({
        where,
        select: { token: true, status: true },
      })
      if (again) {
        return { token: again.token, status: again.status, created: false }
      }
    }
    throw error
  }
}
