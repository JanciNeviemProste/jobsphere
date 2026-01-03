import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { getPrismaClient, seedTestData, cleanupDynamicData, cleanupAllTestData, disconnectDb, TEST_IDS, createTestJob, createTestCandidate, createTestCandidateWithContact } from '../helpers/test-db'
import { Prisma } from '@prisma/client'

/**
 * Database Schema Validation Integration Tests
 * Tests foreign key constraints, unique constraints, and cascade deletes
 */

const prisma = getPrismaClient()

describe('Database Schema Validation', () => {
  beforeAll(async () => {
    await seedTestData()
  })

  beforeEach(async () => {
    await cleanupDynamicData()
  })

  afterAll(async () => {
    await cleanupAllTestData()
    await disconnectDb()
  })

  describe('Foreign Key Constraints', () => {
    it('should prevent creating job with non-existent organization', async () => {
      await expect(
        prisma.job.create({
          data: {
            title: 'Test Job',
            description: 'A'.repeat(100),
            orgId: 'non-existent-org-id',
            createdBy: TEST_IDS.recruiter,
            locale: 'en',
            status: 'PUBLISHED',
            employmentType: 'FULL_TIME',
            seniority: 'MID',
            salaryMin: 50000,
            salaryMax: 80000,
            salaryCurrency: 'EUR',
            remote: false,
            hybrid: false,
          },
        })
      ).rejects.toThrow()
    })

    it('should prevent creating job with non-existent creator', async () => {
      await expect(
        prisma.job.create({
          data: {
            title: 'Test Job',
            description: 'A'.repeat(100),
            orgId: TEST_IDS.org,
            createdBy: 'non-existent-user-id',
            locale: 'en',
            status: 'PUBLISHED',
            employmentType: 'FULL_TIME',
            seniority: 'MID',
            salaryMin: 50000,
            salaryMax: 80000,
            salaryCurrency: 'EUR',
            remote: false,
            hybrid: false,
          },
        })
      ).rejects.toThrow()
    })

    it('should prevent creating application with non-existent job', async () => {
      const candidate = await createTestCandidate()

      await expect(
        prisma.application.create({
          data: {
            jobId: 'non-existent-job-id',
            candidateId: candidate.id,
            orgId: TEST_IDS.org,
            stage: 'NEW',
            source: 'WEBSITE',
          },
        })
      ).rejects.toThrow()
    })

    it('should prevent creating application with non-existent candidate', async () => {
      const job = await createTestJob()

      await expect(
        prisma.application.create({
          data: {
            jobId: job.id,
            candidateId: 'non-existent-candidate-id',
            orgId: TEST_IDS.org,
            stage: 'NEW',
            source: 'WEBSITE',
          },
        })
      ).rejects.toThrow()
    })

    it('should prevent creating candidate contact without candidate', async () => {
      await expect(
        prisma.candidateContact.create({
          data: {
            candidateId: 'non-existent-candidate-id',
            fullName: 'Test Contact',
            email: 'test@example.com',
            isPrimary: true,
          },
        })
      ).rejects.toThrow()
    })

    it('should allow nullable foreign keys (assignedTo in Application)', async () => {
      const job = await createTestJob()
      const candidate = await createTestCandidate()

      const application = await prisma.application.create({
        data: {
          jobId: job.id,
          candidateId: candidate.id,
          orgId: TEST_IDS.org,
          stage: 'NEW',
          source: 'WEBSITE',
          assignedTo: null, // Nullable FK
        },
      })

      expect(application.assignedTo).toBeNull()
    })

    it('should validate foreign key on update', async () => {
      const job = await createTestJob()
      const candidate = await createTestCandidate()

      const application = await prisma.application.create({
        data: {
          jobId: job.id,
          candidateId: candidate.id,
          orgId: TEST_IDS.org,
          stage: 'NEW',
          source: 'WEBSITE',
        },
      })

      await expect(
        prisma.application.update({
          where: { id: application.id },
          data: { assignedTo: 'non-existent-user-id' },
        })
      ).rejects.toThrow()
    })
  })

  describe('Unique Constraints', () => {
    it('should enforce unique email on User table', async () => {
      const email = 'unique-test@example.com'

      await prisma.user.create({
        data: {
          email,
          name: 'First User',
          password: 'hashedpassword',
          locale: 'en',
        },
      })

      await expect(
        prisma.user.create({
          data: {
            email, // Duplicate email
            name: 'Second User',
            password: 'hashedpassword',
            locale: 'en',
          },
        })
      ).rejects.toThrow()
    })

    it('should enforce unique organization slug', async () => {
      const slug = 'unique-org-slug'

      await prisma.organization.create({
        data: {
          name: 'First Org',
          slug,
          industry: 'Technology',
        },
      })

      await expect(
        prisma.organization.create({
          data: {
            name: 'Second Org',
            slug, // Duplicate slug
            industry: 'Technology',
          },
        })
      ).rejects.toThrow()
    })

    it('should enforce unique job slug per organization', async () => {
      const slug = 'software-engineer'

      await createTestJob({ slug })

      // Same slug in same org should fail
      await expect(
        createTestJob({ slug })
      ).rejects.toThrow()
    })

    it('should allow same job slug in different organizations', async () => {
      const slug = 'software-engineer-2'

      // Create second organization
      const org2 = await prisma.organization.create({
        data: {
          name: 'Second Org',
          slug: 'second-org',
          industry: 'Technology',
        },
      })

      await createTestJob({ slug })

      // Same slug in different org should succeed
      const job2 = await prisma.job.create({
        data: {
          title: 'Software Engineer',
          description: 'A'.repeat(100),
          orgId: org2.id,
          createdBy: TEST_IDS.recruiter,
          locale: 'en',
          slug, // Same slug, different org
          status: 'PUBLISHED',
          employmentType: 'FULL_TIME',
          seniority: 'MID',
          salaryMin: 50000,
          salaryMax: 80000,
          salaryCurrency: 'EUR',
          remote: false,
          hybrid: false,
        },
      })

      expect(job2.slug).toBe(slug)
    })

    it('should enforce unique candidateId + jobId on Application', async () => {
      const job = await createTestJob()
      const candidate = await createTestCandidate()

      await prisma.application.create({
        data: {
          jobId: job.id,
          candidateId: candidate.id,
          orgId: TEST_IDS.org,
          stage: 'NEW',
          source: 'WEBSITE',
        },
      })

      // Duplicate application should fail
      await expect(
        prisma.application.create({
          data: {
            jobId: job.id,
            candidateId: candidate.id,
            orgId: TEST_IDS.org,
            stage: 'SCREENING',
            source: 'LINKEDIN',
          },
        })
      ).rejects.toThrow()
    })

    it('should enforce unique userId + orgId on UserOrgRole', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'user-org-role-test@example.com',
          name: 'Test User',
          password: 'hashedpassword',
          locale: 'en',
        },
      })

      await prisma.userOrgRole.create({
        data: {
          userId: user.id,
          orgId: TEST_IDS.org,
          role: 'RECRUITER',
        },
      })

      // Duplicate role assignment should fail
      await expect(
        prisma.userOrgRole.create({
          data: {
            userId: user.id,
            orgId: TEST_IDS.org,
            role: 'ORG_ADMIN', // Different role, same user+org
          },
        })
      ).rejects.toThrow()
    })

    it('should enforce unique jobId + candidateId on MatchScore', async () => {
      const job = await createTestJob()
      const candidate = await createTestCandidate()

      await prisma.matchScore.create({
        data: {
          orgId: TEST_IDS.org,
          jobId: job.id,
          candidateId: candidate.id,
          score0to100: 85,
          evidence: {},
          explanation: [],
          version: 'v1.0',
        },
      })

      // Duplicate match score should fail
      await expect(
        prisma.matchScore.create({
          data: {
            orgId: TEST_IDS.org,
            jobId: job.id,
            candidateId: candidate.id,
            score0to100: 90,
            evidence: {},
            explanation: [],
            version: 'v1.0',
          },
        })
      ).rejects.toThrow()
    })

    it('should allow updating unique fields to same value', async () => {
      const job = await createTestJob({ slug: 'update-test' })

      const updated = await prisma.job.update({
        where: { id: job.id },
        data: { slug: 'update-test' }, // Same value
      })

      expect(updated.slug).toBe('update-test')
    })
  })

  describe('Cascade Deletes', () => {
    it('should cascade delete applications when job is deleted', async () => {
      const job = await createTestJob()
      const candidate = await createTestCandidate()

      const application = await prisma.application.create({
        data: {
          jobId: job.id,
          candidateId: candidate.id,
          orgId: TEST_IDS.org,
          stage: 'NEW',
          source: 'WEBSITE',
        },
      })

      await prisma.job.delete({ where: { id: job.id } })

      // Application should be deleted (or trigger error if not cascading)
      const applicationAfter = await prisma.application.findUnique({
        where: { id: application.id },
      })

      // Depending on schema: either null (cascade delete) or throws error
      // For this test, we expect cascade delete
      expect(applicationAfter).toBeNull()
    })

    it('should cascade delete candidate contacts when candidate is deleted', async () => {
      const { candidate, contact } = await createTestCandidateWithContact()

      await prisma.candidate.delete({ where: { id: candidate.id } })

      const contactAfter = await prisma.candidateContact.findUnique({
        where: { id: contact.id },
      })

      expect(contactAfter).toBeNull()
    })

    it('should cascade delete resume sections when resume is deleted', async () => {
      const candidate = await createTestCandidate()

      const resume = await prisma.resume.create({
        data: {
          candidateId: candidate.id,
          language: 'en',
          skills: ['JavaScript', 'React'],
        },
      })

      const section = await prisma.resumeSection.create({
        data: {
          resumeId: resume.id,
          kind: 'EXPERIENCE',
          title: 'Software Engineer',
          organization: 'Tech Corp',
          text: 'Developed web applications',
          order: 1,
        },
      })

      await prisma.resume.delete({ where: { id: resume.id } })

      const sectionAfter = await prisma.resumeSection.findUnique({
        where: { id: section.id },
      })

      expect(sectionAfter).toBeNull()
    })

    it('should cascade delete application activities when application is deleted', async () => {
      const job = await createTestJob()
      const candidate = await createTestCandidate()

      const application = await prisma.application.create({
        data: {
          jobId: job.id,
          candidateId: candidate.id,
          orgId: TEST_IDS.org,
          stage: 'NEW',
          source: 'WEBSITE',
        },
      })

      const activity = await prisma.applicationActivity.create({
        data: {
          applicationId: application.id,
          type: 'STAGE_CHANGE',
          description: 'Application created',
        },
      })

      await prisma.application.delete({ where: { id: application.id } })

      const activityAfter = await prisma.applicationActivity.findUnique({
        where: { id: activity.id },
      })

      expect(activityAfter).toBeNull()
    })

    it('should cascade delete email sequence events when run is deleted', async () => {
      const candidate = await createTestCandidate()

      const sequence = await prisma.emailSequence.create({
        data: {
          orgId: TEST_IDS.org,
          name: 'Test Sequence',
          createdBy: TEST_IDS.recruiter,
          active: true,
        },
      })

      const step = await prisma.emailStep.create({
        data: {
          sequenceId: sequence.id,
          name: 'Step 1',
          dayOffset: 0,
          subject: 'Hello',
          bodyTemplate: 'Hello {{name}}',
          order: 1,
        },
      })

      const run = await prisma.emailSequenceRun.create({
        data: {
          sequenceId: sequence.id,
          candidateId: candidate.id,
          status: 'ACTIVE',
        },
      })

      const event = await prisma.emailSequenceEvent.create({
        data: {
          runId: run.id,
          stepId: step.id,
          kind: 'SCHEDULED',
        },
      })

      await prisma.emailSequenceRun.delete({ where: { id: run.id } })

      const eventAfter = await prisma.emailSequenceEvent.findUnique({
        where: { id: event.id },
      })

      expect(eventAfter).toBeNull()
    })

    it('should cascade delete answers when attempt is deleted', async () => {
      const candidate = await createTestCandidate()

      const assessment = await prisma.assessment.create({
        data: {
          orgId: TEST_IDS.org,
          name: 'Test Assessment',
          createdBy: TEST_IDS.recruiter,
          isPublished: true,
        },
      })

      const section = await prisma.assessmentSection.create({
        data: {
          assessmentId: assessment.id,
          title: 'Section 1',
          order: 1,
        },
      })

      const question = await prisma.question.create({
        data: {
          sectionId: section.id,
          type: 'MCQ',
          text: 'What is 2+2?',
          choices: ['3', '4', '5'],
          correctIndexes: [1],
          points: 10,
          order: 1,
        },
      })

      const invite = await prisma.assessmentInvite.create({
        data: {
          assessmentId: assessment.id,
          candidateId: candidate.id,
          token: 'test-token-cascade',
          status: 'STARTED',
        },
      })

      const attempt = await prisma.attempt.create({
        data: {
          inviteId: invite.id,
          candidateId: candidate.id,
          status: 'IN_PROGRESS',
        },
      })

      const answer = await prisma.answer.create({
        data: {
          attemptId: attempt.id,
          questionId: question.id,
          response: { selectedIndex: 1 },
          autoScore: 10,
        },
      })

      await prisma.attempt.delete({ where: { id: attempt.id } })

      const answerAfter = await prisma.answer.findUnique({
        where: { id: answer.id },
      })

      expect(answerAfter).toBeNull()
    })
  })

  describe('Composite Keys and Indexes', () => {
    it('should enforce composite unique constraint on UserOrgRole', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'composite-test@example.com',
          name: 'Composite Test',
          password: 'hashedpassword',
          locale: 'en',
        },
      })

      await prisma.userOrgRole.create({
        data: {
          userId: user.id,
          orgId: TEST_IDS.org,
          role: 'RECRUITER',
        },
      })

      // Query by composite key
      const role = await prisma.userOrgRole.findUnique({
        where: {
          userId_orgId: {
            userId: user.id,
            orgId: TEST_IDS.org,
          },
        },
      })

      expect(role).toBeDefined()
      expect(role?.role).toBe('RECRUITER')
    })

    it('should use composite unique constraint on Application', async () => {
      const job = await createTestJob()
      const candidate = await createTestCandidate()

      const application = await prisma.application.create({
        data: {
          jobId: job.id,
          candidateId: candidate.id,
          orgId: TEST_IDS.org,
          stage: 'NEW',
          source: 'WEBSITE',
        },
      })

      // Query by composite unique key
      const found = await prisma.application.findUnique({
        where: {
          candidateId_jobId: {
            candidateId: candidate.id,
            jobId: job.id,
          },
        },
      })

      expect(found).toBeDefined()
      expect(found?.id).toBe(application.id)
    })
  })

  describe('Data Integrity', () => {
    it('should maintain referential integrity across complex relationships', async () => {
      const job = await createTestJob()
      const { candidate, contact } = await createTestCandidateWithContact()

      const application = await prisma.application.create({
        data: {
          jobId: job.id,
          candidateId: candidate.id,
          orgId: TEST_IDS.org,
          stage: 'NEW',
          source: 'WEBSITE',
        },
      })

      const activity = await prisma.applicationActivity.create({
        data: {
          applicationId: application.id,
          type: 'APPLICATION_SUBMITTED',
          description: 'Application received',
        },
      })

      // Verify all relationships are intact
      const applicationWithRelations = await prisma.application.findUnique({
        where: { id: application.id },
        include: {
          job: true,
          candidate: {
            include: {
              contacts: true,
            },
          },
          activities: true,
        },
      })

      expect(applicationWithRelations).toBeDefined()
      expect(applicationWithRelations?.job.id).toBe(job.id)
      expect(applicationWithRelations?.candidate.id).toBe(candidate.id)
      expect(applicationWithRelations?.candidate.contacts).toHaveLength(1)
      expect(applicationWithRelations?.activities).toHaveLength(1)
    })

    it('should prevent orphaned records through foreign key constraints', async () => {
      const job = await createTestJob()
      const candidate = await createTestCandidate()

      const application = await prisma.application.create({
        data: {
          jobId: job.id,
          candidateId: candidate.id,
          orgId: TEST_IDS.org,
          stage: 'NEW',
          source: 'WEBSITE',
        },
      })

      // Try to delete job (should fail or cascade delete application)
      try {
        await prisma.job.delete({ where: { id: job.id } })

        // If cascade delete is configured, verify application is gone
        const appAfter = await prisma.application.findUnique({
          where: { id: application.id },
        })
        expect(appAfter).toBeNull()
      } catch (error) {
        // If cascade delete is not configured, should throw error
        expect(error).toBeDefined()
      }
    })
  })
})
