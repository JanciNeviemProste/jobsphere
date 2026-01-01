/**
 * Cron Jobs for JobSphere
 * Scheduled tasks that run at specific intervals
 *
 * TODO: Install cron package to enable scheduled jobs
 * Run: yarn add cron @types/cron
 */

// import { CronJob } from 'cron' // TODO: Uncomment after installing cron package
import { prisma } from '@/lib/prisma'
import { addAssessmentReminderJob } from '@/lib/queue'
import { logger } from '@/lib/logger'

/**
 * Assessment Reminder Cron Job
 * Runs daily at 9 AM to send reminders for pending assessments
 *
 * NOTE: Disabled until cron package is installed
 */
export async function runAssessmentReminderJob() {
  // Manual trigger function (can be called from API endpoint or worker)
  const fn = async () => {
    logger.info('Starting assessment reminder cron job')

    try {
      // Find invites that need reminders
      // Criteria: sent 2+ days ago, status is PENDING or STARTED, not expired
      const twoDaysAgo = new Date()
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

      const invites = await prisma.assessmentInvite.findMany({
        where: {
          sentAt: {
            lte: twoDaysAgo
          },
          status: {
            in: ['PENDING', 'STARTED']
          },
          OR: [
            { expiresAt: null },
            { expiresAt: { gte: new Date() } }
          ]
        },
        select: {
          id: true,
          email: true,
          status: true,
          sentAt: true
        }
      })

      logger.info('Found assessment invites to remind', {
        count: invites.length,
        inviteIds: invites.map(i => i.id)
      })

      // Queue reminder jobs
      let queued = 0
      let failed = 0

      for (const invite of invites) {
        try {
          await addAssessmentReminderJob({ inviteId: invite.id })
          queued++
        } catch (error) {
          failed++
          logger.error('Failed to queue assessment reminder', {
            inviteId: invite.id,
            error
          })
        }
      }

      logger.info('Assessment reminder cron job completed', {
        total: invites.length,
        queued,
        failed
      })
    } catch (error) {
      logger.error('Assessment reminder cron job failed', { error })
    }
  }

  // Run immediately
  await fn()
}

/**
 * TODO: Implement with actual cron scheduler
 *
 * Option 1: Use 'cron' package (after installing)
 * Option 2: Use Vercel Cron Jobs (vercel.json)
 * Option 3: Use external scheduler (GitHub Actions, AWS EventBridge, etc.)
 * Option 4: Use BullMQ repeat jobs
 *
 * Example with BullMQ repeat:
 * await assessmentReminderQueue.add(
 *   'daily-reminder',
 *   {},
 *   { repeat: { cron: '0 9 * * *' } }
 * )
 */
