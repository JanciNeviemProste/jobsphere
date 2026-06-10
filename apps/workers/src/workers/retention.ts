import { Job } from 'bullmq'
import { prisma } from '@jobsphere/db'
import type { Prisma } from '@jobsphere/db'

interface RetentionJobData {
  dryRun?: boolean
}

/**
 * Hard-delete all PII rows for the given candidate ids in FK-safe order.
 *
 * Every child relation in the schema uses Prisma's default `onDelete: Restrict`,
 * so a parent cannot be removed while children reference it. We delete leaves
 * first, then walk up to the Candidate. Mirrors
 * `apps/web/src/services/gdpr.service.ts#eraseCandidatesPII` (kept in sync by
 * hand because the workers package cannot import the web `@/` alias).
 */
async function eraseCandidatesPII(
  tx: Prisma.TransactionClient,
  candidateIds: string[],
): Promise<void> {
  if (candidateIds.length === 0) return

  const inCandidates = { candidateId: { in: candidateIds } }

  const applications = await tx.application.findMany({
    where: inCandidates,
    select: { id: true },
  })
  const applicationIds = applications.map((a) => a.id)

  const resumes = await tx.resume.findMany({ where: inCandidates, select: { id: true } })
  const resumeIds = resumes.map((r) => r.id)

  const attempts = await tx.attempt.findMany({ where: inCandidates, select: { id: true } })
  const attemptIds = attempts.map((a) => a.id)

  const runs = await tx.emailSequenceRun.findMany({ where: inCandidates, select: { id: true } })
  const runIds = runs.map((r) => r.id)

  // Level 3: grandchildren / leaf rows
  if (applicationIds.length > 0) {
    await tx.applicationActivity.deleteMany({ where: { applicationId: { in: applicationIds } } })
  }
  if (resumeIds.length > 0) {
    await tx.resumeSection.deleteMany({ where: { resumeId: { in: resumeIds } } })
  }
  if (attemptIds.length > 0) {
    await tx.answer.deleteMany({ where: { attemptId: { in: attemptIds } } })
  }
  if (runIds.length > 0) {
    await tx.emailSequenceEvent.deleteMany({ where: { runId: { in: runIds } } })
  }

  // Level 2: rows referencing Candidate (ordered for inter-row FKs)
  await tx.matchScore.deleteMany({ where: inCandidates })
  await tx.attempt.deleteMany({ where: inCandidates })
  await tx.assessmentInvite.deleteMany({ where: inCandidates })
  await tx.emailSequenceRun.deleteMany({ where: inCandidates })
  await tx.application.deleteMany({ where: inCandidates })
  await tx.resume.deleteMany({ where: inCandidates }) // before CandidateDocument (sourceDocumentId)
  await tx.candidateDocument.deleteMany({ where: inCandidates })
  await tx.candidateContact.deleteMany({ where: inCandidates })
  await tx.consentRecord.deleteMany({ where: inCandidates })

  // Level 1: the Candidate rows themselves
  await tx.candidate.deleteMany({ where: { id: { in: candidateIds } } })
}

export async function retentionWorker(job: Job<RetentionJobData>) {
  const { dryRun = false } = job.data

  console.log(`🗑️  Running GDPR retention cleanup ${dryRun ? '(DRY RUN)' : ''}`)

  try {
    const retentionPeriodDays = 365 // Default 12 months
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionPeriodDays)

    let deletedCount = 0

    // 1. Soft-delete old candidates with no offer/hired application.
    const oldCandidates = await prisma.candidate.findMany({
      where: {
        createdAt: { lt: cutoffDate },
        deletedAt: null,
        applications: {
          none: {
            stage: { in: ['OFFER', 'HIRED'] }, // Keep candidates with offers/hired
          },
        },
      },
      select: { id: true },
    })

    console.log(`Found ${oldCandidates.length} old candidates for soft-deletion`)

    if (!dryRun && oldCandidates.length > 0) {
      const result = await prisma.candidate.updateMany({
        where: { id: { in: oldCandidates.map((c) => c.id) } },
        data: { deletedAt: new Date() },
      })
      deletedCount += result.count
    }

    // 2. Delete expired sessions (schema field is `expires`, not `expiresAt`).
    const expiredSessions = await prisma.session.deleteMany({
      where: { expires: { lt: new Date() } },
    })
    console.log(`Deleted ${expiredSessions.count} expired sessions`)
    deletedCount += expiredSessions.count

    // 3. Anonymize old audit logs (retain for compliance, strip PII).
    const oldAuditLogs = await prisma.auditLog.findMany({
      where: {
        createdAt: { lt: cutoffDate },
        OR: [{ ipAddress: { not: null } }, { userAgent: { not: null } }],
      },
      select: { id: true },
    })

    if (!dryRun && oldAuditLogs.length > 0) {
      await prisma.auditLog.updateMany({
        where: { id: { in: oldAuditLogs.map((l) => l.id) } },
        data: { ipAddress: '[REDACTED]', userAgent: '[REDACTED]' },
      })
      console.log(`Anonymized ${oldAuditLogs.length} old audit logs`)
    }

    // 4. Hard-delete candidates soft-deleted more than 30 days ago, in FK-safe
    //    order (the previous implementation called candidate.deleteMany directly
    //    and crashed on FK Restrict for contacts/applications/resumes/etc.).
    const hardDeleteCutoff = new Date()
    hardDeleteCutoff.setDate(hardDeleteCutoff.getDate() - 30)

    if (!dryRun) {
      const staleCandidates = await prisma.candidate.findMany({
        where: { deletedAt: { lt: hardDeleteCutoff } },
        select: { id: true },
      })

      if (staleCandidates.length > 0) {
        const ids = staleCandidates.map((c) => c.id)
        await prisma.$transaction(async (tx) => {
          await eraseCandidatesPII(tx, ids)
        })
        console.log(`Hard deleted ${ids.length} candidates (and dependent PII)`)
        deletedCount += ids.length
      }
    }

    // 5. Delete old processed provider/webhook events.
    if (!dryRun) {
      const oldEvents = await prisma.providerEvent.deleteMany({
        where: { createdAt: { lt: cutoffDate }, processed: true },
      })
      console.log(`Deleted ${oldEvents.count} old provider events`)
      deletedCount += oldEvents.count
    }

    // 6. Reset monthly quotas.
    const now = new Date()
    const resetNeeded = await prisma.entitlement.findMany({
      where: {
        resetAt: { lte: now },
        featureKey: { in: ['email_sends_per_month', 'assessments_per_month'] },
      },
    })

    if (!dryRun && resetNeeded.length > 0) {
      for (const entitlement of resetNeeded) {
        await prisma.entitlement.update({
          where: { id: entitlement.id },
          data: {
            remainingInt: entitlement.limitInt,
            resetAt: new Date(now.getFullYear(), now.getMonth() + 1, 1), // First day of next month
          },
        })
      }
      console.log(`Reset ${resetNeeded.length} monthly quotas`)
    }

    console.log(`✅ Retention cleanup completed: ${deletedCount} records processed`)
    return {
      deletedCount,
      dryRun,
      cutoffDate,
      quotasReset: resetNeeded.length,
    }
  } catch (error) {
    console.error(`❌ Failed to run retention cleanup:`, error)
    throw error
  }
}
