import { Job } from 'bullmq'
import { prisma } from '@jobsphere/db'

interface RetentionJobData {
  dryRun?: boolean
}

export async function retentionWorker(job: Job<RetentionJobData>) {
  const { dryRun = false } = job.data

  console.log(`🗑️  Running GDPR retention cleanup ${dryRun ? '(DRY RUN)' : ''}`)

  try {
    const retentionPeriodDays = 365 // Default 12 months
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionPeriodDays)

    let deletedCount = 0

    // Soft delete old candidates
    const oldCandidates = await prisma.candidate.findMany({
      where: {
        createdAt: { lt: cutoffDate },
        deletedAt: null,
        applications: {
          none: {
            stage: {
              in: ['OFFER', 'HIRED'], // Keep candidates with offers/hired
            },
          },
        },
      },
      select: { id: true },
    })

    console.log(`Found ${oldCandidates.length} old candidates for deletion`)

    if (!dryRun) {
      const result = await prisma.candidate.updateMany({
        where: {
          id: { in: oldCandidates.map((c) => c.id) },
        },
        data: {
          deletedAt: new Date(),
        },
      })

      deletedCount += result.count
    }

    // Delete old sessions
    const expiredSessions = await prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    })

    console.log(`Deleted ${expiredSessions.count} expired sessions`)
    deletedCount += expiredSessions.count

    // Anonymize old audit logs (keep for compliance but remove PII)
    const oldAuditLogs = await prisma.auditLog.findMany({
      where: {
        createdAt: { lt: cutoffDate },
        ipAddress: { not: null },
      },
      select: { id: true },
    })

    if (!dryRun && oldAuditLogs.length > 0) {
      await prisma.auditLog.updateMany({
        where: {
          id: { in: oldAuditLogs.map((l) => l.id) },
        },
        data: {
          ipAddress: '[REDACTED]',
          userAgent: '[REDACTED]',
        },
      })

      console.log(`Anonymized ${oldAuditLogs.length} old audit logs`)
    }

    // Hard delete soft-deleted records older than 30 days
    const hardDeleteCutoff = new Date()
    hardDeleteCutoff.setDate(hardDeleteCutoff.getDate() - 30)

    if (!dryRun) {
      const hardDeletedCandidates = await prisma.candidate.deleteMany({
        where: {
          deletedAt: { lt: hardDeleteCutoff },
        },
      })

      console.log(`Hard deleted ${hardDeletedCandidates.count} candidates`)
      deletedCount += hardDeletedCandidates.count

      const hardDeletedJobs = await prisma.job.deleteMany({
        where: {
          deletedAt: { lt: hardDeleteCutoff },
        },
      })

      console.log(`Hard deleted ${hardDeletedJobs.count} jobs`)
      deletedCount += hardDeletedJobs.count
    }

    // Delete old provider events (processed webhook events)
    if (!dryRun) {
      const oldEvents = await prisma.providerEvent.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
          processed: true,
        },
      })

      console.log(`Deleted ${oldEvents.count} old provider events`)
      deletedCount += oldEvents.count
    }

    // Reset monthly quotas
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