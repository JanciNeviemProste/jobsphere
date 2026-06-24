/**
 * Canonical identity resolver
 *
 * The app conflated `session.user.id` (a `User.id`) with `Candidate.id`. They are
 * different: a job-seeker is a `User`, and `Candidate` is an ORG-SCOPED record
 * (one row per person per organization). These helpers resolve the correct
 * `Candidate` for a given `User` inside a given organization, creating/linking
 * one when necessary, so candidate self-service flows ("my applications",
 * withdraw, assessment submit) work correctly.
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import type { Candidate, Prisma } from '@prisma/client'

/**
 * A minimal Prisma client surface that is satisfied by both the singleton
 * `prisma` client and a `$transaction` client (`Prisma.TransactionClient`).
 */
type PrismaClientLike = Pick<typeof prisma, 'candidate' | 'candidateContact' | 'user'>

/**
 * Find or create the `Candidate` that represents `userId` within `orgId`.
 *
 * Resolution order (idempotent):
 *   1. A Candidate already linked to this user (`userId`) in this org -> reuse.
 *   2. A Candidate in this org whose primary contact email matches the user's
 *      email (case-insensitive) but with `userId = null` (recruiter-imported)
 *      -> link it (set `userId`) rather than create a duplicate.
 *   3. Otherwise create a new Candidate (source `WEBSITE`) with a primary
 *      `CandidateContact` populated from the `User`.
 *
 * Pass `tx` to run inside an existing transaction.
 */
export async function getOrCreateCandidateForUser(
  userId: string,
  orgId: string,
  tx?: Prisma.TransactionClient,
): Promise<Candidate> {
  const db: PrismaClientLike = tx ?? prisma

  // 1. Already linked in this org.
  const linked = await db.candidate.findFirst({
    where: { userId, orgId, deletedAt: null },
  })
  if (linked) return linked

  // Load the user so we can match by email and populate the primary contact.
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true },
  })
  if (!user?.email) {
    throw new Error('Cannot resolve candidate: user has no email address')
  }

  // 2. Recruiter-imported candidate in this org with the same primary email but
  //    no linked user. Link it instead of creating a duplicate.
  const unlinked = await db.candidate.findFirst({
    where: {
      orgId,
      userId: null,
      deletedAt: null,
      contacts: {
        some: {
          isPrimary: true,
          email: { equals: user.email, mode: 'insensitive' },
        },
      },
    },
  })
  if (unlinked) {
    return db.candidate.update({
      where: { id: unlinked.id },
      data: { userId },
    })
  }

  // 3. Create a fresh Candidate with a primary contact from the User.
  return db.candidate.create({
    data: {
      orgId,
      userId,
      source: 'WEBSITE',
      contacts: {
        create: {
          fullName: user.name ?? null,
          email: user.email,
          phone: user.phone ?? null,
          isPrimary: true,
        },
      },
    },
  })
}

/**
 * Slug of the sentinel organization that owns every job-seeker's PERSONAL
 * candidate profile (their own CVs), independent of any employer. Employer
 * queries are always scoped to their own `orgId`, so this org and its candidates
 * are never visible to employers.
 */
export const PERSONAL_ORG_SLUG = '__personal_profiles__'

/**
 * Ensure the sentinel "personal profiles" organization exists and return its id.
 * Idempotent and race-safe (unique slug; falls back to a read on a create race).
 */
export async function ensurePersonalOrg(): Promise<string> {
  try {
    const org = await prisma.organization.upsert({
      where: { slug: PERSONAL_ORG_SLUG },
      update: {},
      create: { name: 'Personal Profiles', slug: PERSONAL_ORG_SLUG },
      select: { id: true },
    })
    return org.id
  } catch (err) {
    // Only a unique-violation (P2002) is the expected lost-create-race — the row
    // now exists, so read it. Anything else is a real failure; don't mask it.
    const code = (err as { code?: string } | null)?.code
    if (code !== 'P2002') {
      logger.error('ensurePersonalOrg failed (non-race)', { err })
      throw err
    }
    const org = await prisma.organization.findUniqueOrThrow({
      where: { slug: PERSONAL_ORG_SLUG },
      select: { id: true },
    })
    return org.id
  }
}

/**
 * Resolve (create/link) the PERSONAL `Candidate` that holds THIS user's own
 * profile and saved CVs — the "my CV in my profile" anchor, independent of any
 * employer organization. Job-seekers have no `UserOrgRole`, so this is where
 * their profile data lives (vs. the per-employer candidate copies created when
 * they apply to a job).
 */
export async function getPersonalCandidateForUser(
  userId: string,
  tx?: Prisma.TransactionClient,
): Promise<Candidate> {
  const orgId = await ensurePersonalOrg()
  return getOrCreateCandidateForUser(userId, orgId, tx)
}

/**
 * Return the ids of every `Candidate` linked to this user across all orgs.
 *
 * Prefer relation filters (`where: { candidate: { userId } }`) on related models
 * where possible; use this only when you genuinely need the id list.
 */
export async function getCandidateIdsForUser(userId: string): Promise<string[]> {
  const candidates = await prisma.candidate.findMany({
    where: { userId, deletedAt: null },
    select: { id: true },
  })
  return candidates.map((c) => c.id)
}
