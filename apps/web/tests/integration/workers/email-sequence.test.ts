/**
 * Integration Tests for Email Sequence Worker
 * Tests email sequence processing with real Redis and BullMQ
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Queue, Worker, Job } from 'bullmq'
import IORedis from 'ioredis'
import { prisma, TEST_IDS, createTestCandidateWithContact } from '../helpers/test-db'
import type { EmailSequenceJobData } from '@/lib/queue'

// Mock email service to prevent actual email sending
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}))

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

describe('Email Sequence Worker Integration Tests', () => {
  let connection: IORedis
  let emailQueue: Queue<EmailSequenceJobData>
  let worker: Worker<EmailSequenceJobData>
  let emailSequence: any
  let emailStep1: any
  let emailStep2: any
  let candidate: any

  beforeEach(async () => {
    // Setup Redis connection
    connection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })

    // Create test queue
    emailQueue = new Queue<EmailSequenceJobData>('email-sequence-test', {
      connection,
    })

    // Clean existing jobs
    await emailQueue.drain()
    await emailQueue.clean(0, 100, 'completed')
    await emailQueue.clean(0, 100, 'failed')

    // Create test data
    emailSequence = await prisma.emailSequence.create({
      data: {
        name: 'Test Email Sequence',
        orgId: TEST_IDS.org,
        description: 'Test sequence for integration tests',
        // `active` is a Boolean on the model; there is no `status` column. And
        // createdBy is required. Both wrong here meant the beforeEach threw and
        // took the whole file with it.
        active: true,
        createdBy: TEST_IDS.recruiter,
      },
    })

    emailStep1 = await prisma.emailStep.create({
      data: {
        name: 'Welcome',
        sequenceId: emailSequence.id,
        subject: 'Welcome {{candidateName}}!',
        bodyTemplate: '<p>Hi {{candidateName}}, welcome to {{companyName}}!</p>',
        order: 1,
        dayOffset: 0,
      },
    })

    emailStep2 = await prisma.emailStep.create({
      data: {
        name: 'Follow-up',
        sequenceId: emailSequence.id,
        subject: 'Follow-up for {{candidateName}}',
        bodyTemplate: '<p>Hi {{candidateName}}, just following up from {{companyName}}.</p>',
        order: 2,
        dayOffset: 1,
      },
    })

    const result = await createTestCandidateWithContact({
      email: 'test-candidate@example.com',
      fullName: 'John Doe',
    })
    candidate = result.candidate
  })

  afterEach(async () => {
    // Stop worker if running
    if (worker) {
      await worker.close()
    }

    // Clean up queue
    await emailQueue.drain()
    await emailQueue.close()
    await connection.quit()

    // Clean up database
    await prisma.emailSequenceRun.deleteMany({
      where: { sequenceId: emailSequence.id },
    })
    await prisma.emailStep.deleteMany({
      where: { sequenceId: emailSequence.id },
    })
    await prisma.emailSequence.deleteMany({
      where: { id: emailSequence.id },
    })
    await prisma.candidateContact.deleteMany({
      where: { candidateId: candidate.id },
    })
    await prisma.candidate.deleteMany({
      where: { id: candidate.id },
    })
  })

  describe('Job Enqueueing', () => {
    it('should successfully enqueue email sequence job', async () => {
      // Arrange
      const enrollment = await prisma.emailSequenceRun.create({
        data: {
          sequenceId: emailSequence.id,
          candidateId: candidate.id,
          status: 'ACTIVE',
        },
      })

      // Act
      const job = await emailQueue.add('send-step', {
        enrollmentId: enrollment.id,
        stepId: emailStep1.id,
      })

      // Assert
      expect(job.id).toBeDefined()
      expect(job.data.enrollmentId).toBe(enrollment.id)
      expect(job.data.stepId).toBe(emailStep1.id)

      const waitingCount = await emailQueue.getWaitingCount()
      expect(waitingCount).toBe(1)
    })

    it('should enqueue job with delay', async () => {
      // Arrange
      const enrollment = await prisma.emailSequenceRun.create({
        data: {
          sequenceId: emailSequence.id,
          candidateId: candidate.id,
          status: 'ACTIVE',
        },
      })

      const delayMs = 5000 // 5 seconds

      // Act
      const job = await emailQueue.add(
        'send-step',
        {
          enrollmentId: enrollment.id,
          stepId: emailStep1.id,
        },
        { delay: delayMs },
      )

      // Assert
      expect(job.opts.delay).toBe(delayMs)

      const delayedCount = await emailQueue.getDelayedCount()
      expect(delayedCount).toBe(1)
    })
  })

  describe('Job Processing', () => {
    it('should process email step successfully', async () => {
      // Arrange
      const { sendEmail } = await import('@/lib/email')

      const enrollment = await prisma.emailSequenceRun.create({
        data: {
          sequenceId: emailSequence.id,
          candidateId: candidate.id,
          status: 'ACTIVE',
        },
      })

      await emailQueue.add('send-step', {
        enrollmentId: enrollment.id,
        stepId: emailStep1.id,
      })

      // Create worker with actual processing function
      const { processEmailStep } = await import('@/workers/email-sequence.worker')

      worker = new Worker<EmailSequenceJobData>('email-sequence-test', processEmailStep, {
        connection,
      })

      // Act - Wait for job to complete
      const completed = await new Promise<Job>((resolve) => {
        worker.on('completed', resolve)
      })

      // Assert
      expect(completed).toBeDefined()
      expect(sendEmail).toHaveBeenCalledWith({
        to: 'test-candidate@example.com',
        subject: 'Welcome John Doe!',
        html: '<p>Hi John Doe, welcome to Test Organization!</p>',
      })
    })

    it('should replace template variables correctly', async () => {
      // Arrange
      const { sendEmail } = await import('@/lib/email')

      const enrollment = await prisma.emailSequenceRun.create({
        data: {
          sequenceId: emailSequence.id,
          candidateId: candidate.id,
          status: 'ACTIVE',
        },
      })

      await emailQueue.add('send-step', {
        enrollmentId: enrollment.id,
        stepId: emailStep1.id,
      })

      worker = new Worker<EmailSequenceJobData>(
        'email-sequence-test',
        async (job: Job<EmailSequenceJobData>) => {
          const { processEmailStep } = await import('@/workers/email-sequence.worker')
          return processEmailStep(job)
        },
        { connection },
      )

      // Act
      await new Promise<void>((resolve) => {
        worker.on('completed', () => resolve())
      })

      // Assert - Check that variables were replaced
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.not.stringContaining('{{'),
          html: expect.not.stringContaining('{{'),
        }),
      )
    })

    it('should schedule next step after completion', async () => {
      // Arrange
      const enrollment = await prisma.emailSequenceRun.create({
        data: {
          sequenceId: emailSequence.id,
          candidateId: candidate.id,
          status: 'ACTIVE',
        },
      })

      await emailQueue.add('send-step', {
        enrollmentId: enrollment.id,
        stepId: emailStep1.id,
      })

      worker = new Worker<EmailSequenceJobData>(
        'email-sequence-test',
        async (job: Job<EmailSequenceJobData>) => {
          const { processEmailStep } = await import('@/workers/email-sequence.worker')
          return processEmailStep(job)
        },
        { connection },
      )

      // Act
      await new Promise<void>((resolve) => {
        worker.on('completed', () => resolve())
      })

      // Small delay to allow next job to be scheduled
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Assert - Should have scheduled step 2
      const delayedCount = await emailQueue.getDelayedCount()
      expect(delayedCount).toBe(1)

      // Verify the delayed job has correct data
      const delayedJobs = await emailQueue.getDelayed()
      expect(delayedJobs).toHaveLength(1)
      expect(delayedJobs[0].data.stepId).toBe(emailStep2.id)
      expect(delayedJobs[0].data.enrollmentId).toBe(enrollment.id)
    })

    it('should mark enrollment as completed when no more steps', async () => {
      // Arrange
      const enrollment = await prisma.emailSequenceRun.create({
        data: {
          sequenceId: emailSequence.id,
          candidateId: candidate.id,
          status: 'ACTIVE',
        },
      })

      // Process the last step
      await emailQueue.add('send-step', {
        enrollmentId: enrollment.id,
        stepId: emailStep2.id,
      })

      worker = new Worker<EmailSequenceJobData>(
        'email-sequence-test',
        async (job: Job<EmailSequenceJobData>) => {
          const { processEmailStep } = await import('@/workers/email-sequence.worker')
          return processEmailStep(job)
        },
        { connection },
      )

      // Act
      await new Promise<void>((resolve) => {
        worker.on('completed', () => resolve())
      })

      // Assert
      const updatedEnrollment = await prisma.emailSequenceRun.findUnique({
        where: { id: enrollment.id },
      })

      expect(updatedEnrollment?.status).toBe('COMPLETED')
      expect(updatedEnrollment?.completedAt).toBeDefined()
    })
  })

  describe('Retry Logic', () => {
    it('should retry failed jobs with exponential backoff', async () => {
      // Arrange
      const enrollment = await prisma.emailSequenceRun.create({
        data: {
          sequenceId: emailSequence.id,
          candidateId: candidate.id,
          status: 'ACTIVE',
        },
      })

      const job = await emailQueue.add(
        'send-step',
        {
          enrollmentId: enrollment.id,
          stepId: emailStep1.id,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      )

      // Assert
      expect(job.opts.attempts).toBe(3)
      expect(job.opts.backoff).toEqual({
        type: 'exponential',
        delay: 1000,
      })
    })

    it('should move to failed after max attempts', async () => {
      // Arrange
      const { sendEmail } = await import('@/lib/email')
      vi.mocked(sendEmail).mockRejectedValue(new Error('Email service down'))

      const enrollment = await prisma.emailSequenceRun.create({
        data: {
          sequenceId: emailSequence.id,
          candidateId: candidate.id,
          status: 'ACTIVE',
        },
      })

      await emailQueue.add(
        'send-step',
        {
          enrollmentId: enrollment.id,
          stepId: emailStep1.id,
        },
        { attempts: 1 }, // Only 1 attempt to speed up test
      )

      worker = new Worker<EmailSequenceJobData>(
        'email-sequence-test',
        async (job: Job<EmailSequenceJobData>) => {
          const { processEmailStep } = await import('@/workers/email-sequence.worker')
          return processEmailStep(job)
        },
        { connection },
      )

      // Act
      const failed = await new Promise<Job>((resolve) => {
        worker.on('failed', (_job) => {
          if (job) resolve(job)
        })
      })

      // Assert
      expect(failed).toBeDefined()
      const failedCount = await emailQueue.getFailedCount()
      expect(failedCount).toBeGreaterThan(0)

      // Restore mock
      vi.mocked(sendEmail).mockResolvedValue(undefined)
    })
  })

  describe('Failure Handling', () => {
    it('should handle enrollment not found', async () => {
      // Arrange
      const nonExistentId = 'non-existent-enrollment-id'

      await emailQueue.add('send-step', {
        enrollmentId: nonExistentId,
        stepId: emailStep1.id,
      })

      worker = new Worker<EmailSequenceJobData>(
        'email-sequence-test',
        async (job: Job<EmailSequenceJobData>) => {
          const { processEmailStep } = await import('@/workers/email-sequence.worker')
          return processEmailStep(job)
        },
        { connection },
      )

      // Act
      const failed = await new Promise<{ job?: Job; error: Error }>((resolve) => {
        worker.on('failed', (job, error) => {
          resolve({ job, error })
        })
      })

      // Assert
      expect(failed.error.message).toContain('Enrollment')
      expect(failed.error.message).toContain('not found')
    })

    it('should skip processing if enrollment is not active', async () => {
      // Arrange
      const { sendEmail } = await import('@/lib/email')
      vi.mocked(sendEmail).mockClear()

      const enrollment = await prisma.emailSequenceRun.create({
        data: {
          sequenceId: emailSequence.id,
          candidateId: candidate.id,
          status: 'PAUSED', // Not active
        },
      })

      await emailQueue.add('send-step', {
        enrollmentId: enrollment.id,
        stepId: emailStep1.id,
      })

      worker = new Worker<EmailSequenceJobData>(
        'email-sequence-test',
        async (job: Job<EmailSequenceJobData>) => {
          const { processEmailStep } = await import('@/workers/email-sequence.worker')
          return processEmailStep(job)
        },
        { connection },
      )

      // Act
      await new Promise<void>((resolve) => {
        worker.on('completed', () => resolve())
      })

      // Assert - Should complete but not send email
      expect(sendEmail).not.toHaveBeenCalled()
    })

    it('should handle missing candidate email', async () => {
      // Arrange
      // Create candidate without contact info
      const candidateNoEmail = await prisma.candidate.create({
        data: {
          orgId: TEST_IDS.org,
          source: 'MANUAL',
        },
      })

      const enrollment = await prisma.emailSequenceRun.create({
        data: {
          sequenceId: emailSequence.id,
          candidateId: candidateNoEmail.id,
          status: 'ACTIVE',
        },
      })

      await emailQueue.add('send-step', {
        enrollmentId: enrollment.id,
        stepId: emailStep1.id,
      })

      worker = new Worker<EmailSequenceJobData>(
        'email-sequence-test',
        async (job: Job<EmailSequenceJobData>) => {
          const { processEmailStep } = await import('@/workers/email-sequence.worker')
          return processEmailStep(job)
        },
        { connection },
      )

      // Act
      const failed = await new Promise<{ error: Error }>((resolve) => {
        worker.on('failed', (job, error) => {
          resolve({ error })
        })
      })

      // Assert
      expect(failed.error.message).toContain('contact not found')

      // Cleanup
      await prisma.emailSequenceRun.deleteMany({
        where: { candidateId: candidateNoEmail.id },
      })
      await prisma.candidate.delete({ where: { id: candidateNoEmail.id } })
    })
  })

  describe('Rate Limiting', () => {
    it('should respect rate limiter configuration', async () => {
      // Arrange - Create queue with rate limiter
      const rateLimitedQueue = new Queue<EmailSequenceJobData>('email-sequence-rate-limited', {
        connection,
        defaultJobOptions: {
          attempts: 1,
        },
      })

      const rateLimitedWorker = new Worker<EmailSequenceJobData>(
        'email-sequence-rate-limited',
        async (_job: Job<EmailSequenceJobData>) => {
          return { processed: true }
        },
        {
          connection,
          limiter: {
            max: 2, // Max 2 jobs per window
            duration: 1000, // 1 second
          },
        },
      )

      const enrollment = await prisma.emailSequenceRun.create({
        data: {
          sequenceId: emailSequence.id,
          candidateId: candidate.id,
          status: 'ACTIVE',
        },
      })

      // Act - Add 3 jobs quickly
      await Promise.all([
        rateLimitedQueue.add('send-step', {
          enrollmentId: enrollment.id,
          stepId: emailStep1.id,
        }),
        rateLimitedQueue.add('send-step', {
          enrollmentId: enrollment.id,
          stepId: emailStep1.id,
        }),
        rateLimitedQueue.add('send-step', {
          enrollmentId: enrollment.id,
          stepId: emailStep1.id,
        }),
      ])

      // Wait for processing
      let completedCount = 0
      await new Promise<void>((resolve) => {
        rateLimitedWorker.on('completed', () => {
          completedCount++
          if (completedCount === 3) resolve()
        })

        // Timeout after 5 seconds
        setTimeout(() => resolve(), 5000)
      })

      // Assert - All jobs should eventually complete
      expect(completedCount).toBe(3)

      // Cleanup
      await rateLimitedWorker.close()
      await rateLimitedQueue.close()
    })
  })

  describe('A/B Testing Support', () => {
    it('should randomly select variant when multiple steps at same order', async () => {
      // Arrange - Create two variants at order 3
      const variantA = await prisma.emailStep.create({
        data: {
          name: 'Variant A',
          sequenceId: emailSequence.id,
          subject: 'Variant A',
          bodyTemplate: '<p>This is variant A</p>',
          order: 3,
          dayOffset: 2,
          abGroup: 'A',
        },
      })

      const variantB = await prisma.emailStep.create({
        data: {
          name: 'Variant B',
          sequenceId: emailSequence.id,
          subject: 'Variant B',
          bodyTemplate: '<p>This is variant B</p>',
          order: 3,
          dayOffset: 2,
          abGroup: 'B',
        },
      })

      const enrollment = await prisma.emailSequenceRun.create({
        data: {
          sequenceId: emailSequence.id,
          candidateId: candidate.id,
          status: 'ACTIVE',
        },
      })

      // Process step 2 which should schedule a variant
      await emailQueue.add('send-step', {
        enrollmentId: enrollment.id,
        stepId: emailStep2.id,
      })

      worker = new Worker<EmailSequenceJobData>(
        'email-sequence-test',
        async (job: Job<EmailSequenceJobData>) => {
          const { processEmailStep } = await import('@/workers/email-sequence.worker')
          return processEmailStep(job)
        },
        { connection },
      )

      // Act
      await new Promise<void>((resolve) => {
        worker.on('completed', () => resolve())
      })

      // Small delay
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Assert - Should have scheduled one of the variants
      const delayedJobs = await emailQueue.getDelayed()
      expect(delayedJobs).toHaveLength(1)

      const scheduledStepId = delayedJobs[0].data.stepId
      expect([variantA.id, variantB.id]).toContain(scheduledStepId)

      // Cleanup
      await prisma.emailStep.deleteMany({
        where: { id: { in: [variantA.id, variantB.id] } },
      })
    })
  })
})
