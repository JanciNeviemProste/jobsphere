/**
 * Email Sequence Worker
 * Processes email sequence steps and sends emails to candidates
 */

import { Worker, Job } from 'bullmq'
import { connection, emailSequenceQueue, EmailSequenceJobData } from '@/lib/queue'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { sendEmail } from '@/lib/email'

const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5')

/**
 * Process email sequence step
 */
async function processEmailStep(job: Job<EmailSequenceJobData>) {
  const { enrollmentId, stepId } = job.data

  logger.info('Processing email sequence step', { enrollmentId, stepId, jobId: job.id })

  try {
    // 1. Get enrollment with sequence
    const enrollment = await prisma.emailSequenceRun.findUnique({
      where: { id: enrollmentId },
      include: {
        sequence: true,
      },
    })

    if (!enrollment) {
      throw new Error(`Enrollment ${enrollmentId} not found`)
    }

    // Get candidate with user details
    const candidate = await prisma.candidate.findUnique({
      where: { id: enrollment.candidateId },
      include: {
        user: true
      },
    })

    if (!candidate || !candidate.user) {
      throw new Error(`Candidate or user not found`)
    }

    const user = candidate.user

    if (enrollment.status !== 'ACTIVE') {
      logger.warn('Enrollment not active, skipping', { enrollmentId, status: enrollment.status })
      return
    }

    // 2. Get the step
    const step = await prisma.emailStep.findUnique({
      where: { id: stepId },
    })

    if (!step) {
      throw new Error(`Step ${stepId} not found`)
    }

    // 3. Get organization details for email
    const organization = await prisma.organization.findUnique({
      where: { id: enrollment.sequence.orgId },
      select: { name: true, logo: true },
    })

    // 4. Replace template variables
    const candidateName = user.name || 'there'
    const companyName = organization?.name || 'JobSphere'

    let subject = step.subject
    let bodyHtml = step.bodyTemplate

    // Simple template replacement
    subject = subject.replace(/{{candidateName}}/g, candidateName)
    subject = subject.replace(/{{companyName}}/g, companyName)

    bodyHtml = bodyHtml.replace(/{{candidateName}}/g, candidateName)
    bodyHtml = bodyHtml.replace(/{{companyName}}/g, companyName)

    // 5. Send email
    const recipientEmail = user.email

    if (!recipientEmail) {
      throw new Error('No recipient email found')
    }

    await sendEmail({
      to: recipientEmail,
      subject,
      html: bodyHtml,
    })

    logger.info('Email sent successfully', {
      enrollmentId,
      stepId,
      recipient: recipientEmail,
    })

    // 6. Schedule next step if exists
    const nextStep = await prisma.emailStep.findFirst({
      where: {
        sequenceId: enrollment.sequenceId,
        order: step.order + 1,
      },
    })

    if (nextStep) {
      // Calculate delay from dayOffset only
      const delayMs = nextStep.dayOffset * 24 * 60 * 60 * 1000

      await emailSequenceQueue.add(
        'send-step',
        {
          enrollmentId,
          stepId: nextStep.id,
        },
        {
          delay: delayMs,
        }
      )

      logger.info('Scheduled next email step', {
        enrollmentId,
        nextStepId: nextStep.id,
        delayMs,
      })
    } else {
      // No more steps, mark enrollment as completed
      await prisma.emailSequenceRun.update({
        where: { id: enrollmentId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })

      logger.info('Email sequence completed', { enrollmentId })
    }

    return { success: true }
  } catch (error) {
    logger.error('Failed to process email step', {
      error,
      enrollmentId,
      stepId,
      jobId: job.id,
    })
    throw error
  }
}

/**
 * Create and start the worker
 */
export const emailSequenceWorker = new Worker<EmailSequenceJobData>(
  'email-sequence',
  processEmailStep,
  {
    connection,
    concurrency: WORKER_CONCURRENCY,
    limiter: {
      max: 100, // Max 100 jobs per window
      duration: 60000, // 1 minute
    },
  }
)

// Worker event handlers
emailSequenceWorker.on('completed', (job) => {
  logger.info('Email sequence job completed', { jobId: job.id })
})

emailSequenceWorker.on('failed', (job, error) => {
  logger.error('Email sequence job failed', {
    jobId: job?.id,
    error,
    data: job?.data,
  })
})

emailSequenceWorker.on('error', (error) => {
  logger.error('Email sequence worker error', { error })
})

logger.info('Email sequence worker started', { concurrency: WORKER_CONCURRENCY })
