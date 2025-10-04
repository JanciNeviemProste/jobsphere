import { describe, it, expect, beforeEach } from 'vitest'
import { prisma, hashPassword, comparePassword } from '../src'

describe('Database Models', () => {
  describe('Organization', () => {
    it('should create an organization', async () => {
      const org = await prisma.organization.create({
        data: {
          name: 'Test Company',
          slug: 'test-company',
          regions: ['BA', 'ZA'],
        },
      })

      expect(org).toBeDefined()
      expect(org.name).toBe('Test Company')
      expect(org.slug).toBe('test-company')
      expect(org.regions).toEqual(['BA', 'ZA'])
    })

    it('should enforce unique slug', async () => {
      await prisma.organization.create({
        data: {
          name: 'Company 1',
          slug: 'same-slug',
        },
      })

      await expect(
        prisma.organization.create({
          data: {
            name: 'Company 2',
            slug: 'same-slug',
          },
        })
      ).rejects.toThrow()
    })

    it('should soft delete organizations', async () => {
      const org = await prisma.organization.create({
        data: {
          name: 'To Delete',
          slug: 'to-delete',
        },
      })

      await prisma.organization.update({
        where: { id: org.id },
        data: { deletedAt: new Date() },
      })

      const deleted = await prisma.organization.findUnique({
        where: { id: org.id },
      })

      expect(deleted?.deletedAt).toBeDefined()
    })
  })

  describe('User', () => {
    it('should create user with hashed password', async () => {
      const password = 'testpassword123'
      const hashedPassword = await hashPassword(password)

      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: hashedPassword,
          name: 'Test User',
        },
      })

      expect(user).toBeDefined()
      expect(user.password).not.toBe(password)
      expect(await comparePassword(password, user.password)).toBe(true)
    })

    it('should enforce unique email', async () => {
      await prisma.user.create({
        data: {
          email: 'duplicate@example.com',
          password: 'hashed',
        },
      })

      await expect(
        prisma.user.create({
          data: {
            email: 'duplicate@example.com',
            password: 'hashed',
          },
        })
      ).rejects.toThrow()
    })

    it('should track failed login attempts', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: 'hashed',
          failedAttempts: 0,
        },
      })

      // Simulate failed login
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: { increment: 1 },
        },
      })

      expect(updated.failedAttempts).toBe(1)
    })

    it('should lock account after max failed attempts', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          password: 'hashed',
          failedAttempts: 5,
        },
      })

      const lockUntil = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes

      await prisma.user.update({
        where: { id: user.id },
        data: { lockedUntil: lockUntil },
      })

      const locked = await prisma.user.findUnique({
        where: { id: user.id },
      })

      expect(locked?.lockedUntil).toBeDefined()
      expect(locked!.lockedUntil! > new Date()).toBe(true)
    })
  })

  describe('Job', () => {
    let org: any
    let user: any

    beforeEach(async () => {
      org = await prisma.organization.create({
        data: { name: 'Test Org', slug: 'test-org' },
      })

      user = await prisma.user.create({
        data: {
          email: 'recruiter@test.com',
          password: 'hashed',
        },
      })
    })

    it('should create job with required fields', async () => {
      const job = await prisma.job.create({
        data: {
          orgId: org.id,
          title: 'Senior Developer',
          description: 'Great opportunity',
          employmentType: 'FULL_TIME',
          createdBy: user.id,
          locale: 'en',
        },
      })

      expect(job).toBeDefined()
      expect(job.title).toBe('Senior Developer')
      expect(job.status).toBe('DRAFT')
    })

    it('should support Slovak regions', async () => {
      const job = await prisma.job.create({
        data: {
          orgId: org.id,
          title: 'Developer in Bratislava',
          description: 'Job in BA',
          employmentType: 'FULL_TIME',
          region: 'BA',
          city: 'Bratislava',
          createdBy: user.id,
        },
      })

      expect(job.region).toBe('BA')
      expect(job.city).toBe('Bratislava')
    })

    it('should enforce unique slug per organization', async () => {
      await prisma.job.create({
        data: {
          orgId: org.id,
          title: 'Job 1',
          description: 'Description',
          employmentType: 'FULL_TIME',
          slug: 'same-slug',
          createdBy: user.id,
        },
      })

      await expect(
        prisma.job.create({
          data: {
            orgId: org.id,
            title: 'Job 2',
            description: 'Description',
            employmentType: 'FULL_TIME',
            slug: 'same-slug',
            createdBy: user.id,
          },
        })
      ).rejects.toThrow()
    })
  })

  describe('Application', () => {
    let org: any
    let user: any
    let job: any
    let candidate: any

    beforeEach(async () => {
      org = await prisma.organization.create({
        data: { name: 'Test Org', slug: 'test-org' },
      })

      user = await prisma.user.create({
        data: { email: 'test@test.com', password: 'hashed' },
      })

      job = await prisma.job.create({
        data: {
          orgId: org.id,
          title: 'Test Job',
          description: 'Description',
          employmentType: 'FULL_TIME',
          createdBy: user.id,
        },
      })

      candidate = await prisma.candidate.create({
        data: { orgId: org.id },
      })
    })

    it('should create application', async () => {
      const application = await prisma.application.create({
        data: {
          candidateId: candidate.id,
          jobId: job.id,
          orgId: org.id,
          source: 'WEBSITE',
        },
      })

      expect(application).toBeDefined()
      expect(application.stage).toBe('NEW')
    })

    it('should prevent duplicate applications', async () => {
      await prisma.application.create({
        data: {
          candidateId: candidate.id,
          jobId: job.id,
          orgId: org.id,
        },
      })

      await expect(
        prisma.application.create({
          data: {
            candidateId: candidate.id,
            jobId: job.id,
            orgId: org.id,
          },
        })
      ).rejects.toThrow()
    })

    it('should track stage history', async () => {
      const application = await prisma.application.create({
        data: {
          candidateId: candidate.id,
          jobId: job.id,
          orgId: org.id,
          stage: 'NEW',
          stageHistory: [],
        },
      })

      const updated = await prisma.application.update({
        where: { id: application.id },
        data: {
          stage: 'SCREENING',
          stageHistory: {
            push: {
              from: 'NEW',
              to: 'SCREENING',
              changedAt: new Date(),
              changedBy: user.id,
            },
          },
        },
      })

      expect(updated.stage).toBe('SCREENING')
      expect(Array.isArray(updated.stageHistory)).toBe(true)
    })
  })

  describe('Billing', () => {
    let org: any

    beforeEach(async () => {
      org = await prisma.organization.create({
        data: { name: 'Test Org', slug: 'test-org' },
      })
    })

    it('should create entitlement with limits', async () => {
      const entitlement = await prisma.entitlement.create({
        data: {
          orgId: org.id,
          featureKey: 'job_slots',
          limitInt: 10,
          remainingInt: 10,
        },
      })

      expect(entitlement.limitInt).toBe(10)
      expect(entitlement.remainingInt).toBe(10)
    })

    it('should decrement entitlement on usage', async () => {
      const entitlement = await prisma.entitlement.create({
        data: {
          orgId: org.id,
          featureKey: 'job_slots',
          limitInt: 10,
          remainingInt: 10,
        },
      })

      const updated = await prisma.entitlement.update({
        where: { id: entitlement.id },
        data: { remainingInt: { decrement: 1 } },
      })

      expect(updated.remainingInt).toBe(9)
    })

    it('should track usage events', async () => {
      const usageEvent = await prisma.usageEvent.create({
        data: {
          orgId: org.id,
          featureKey: 'job_slots',
          delta: 1,
          entityType: 'JOB',
          entityId: 'job-id',
        },
      })

      expect(usageEvent).toBeDefined()
      expect(usageEvent.delta).toBe(1)
    })
  })
})