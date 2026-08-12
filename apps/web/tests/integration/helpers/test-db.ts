import { hash } from 'bcryptjs'
import type { Job, User, Organization, Candidate, Application } from '@prisma/client'
import { prisma as appPrisma } from '@/lib/prisma'

/**
 * Database Helper for Integration Tests
 * Provides utilities for seeding and cleaning test data
 */

// Use application Prisma instance (includes XSS sanitization middleware)
const prisma = appPrisma

// Test IDs - all prefixed with 'test-' for easy cleanup
export const TEST_IDS = {
  org: 'test-org-id',
  candidate: 'test-user-candidate',
  recruiter: 'test-user-recruiter',
  admin: 'test-user-admin',
  hiringManager: 'test-user-hiring-manager',
  agency: 'test-user-agency',
} as const

/**
 * Seed base test data (organizations and users)
 * Call this once before all integration tests
 */
export async function seedTestData() {
  console.log('Seeding test data...')

  // Create test organization
  const org = await prisma.organization.upsert({
    where: { id: TEST_IDS.org },
    update: {},
    create: {
      id: TEST_IDS.org,
      name: 'Test Organization',
      slug: 'test-org',
      industry: 'Technology',
      size: '50-100',
    },
  })

  // Create candidate user
  const candidateUser = await prisma.user.upsert({
    where: { id: TEST_IDS.candidate },
    update: {},
    create: {
      id: TEST_IDS.candidate,
      email: 'candidate@test.com',
      name: 'Test Candidate',
      password: await hash('TestPassword123!', 12),
      locale: 'en',
    },
  })

  // Create recruiter user with org membership
  const recruiterUser = await prisma.user.upsert({
    where: { id: TEST_IDS.recruiter },
    update: {},
    create: {
      id: TEST_IDS.recruiter,
      email: 'recruiter@test.com',
      name: 'Test Recruiter',
      password: await hash('TestPassword123!', 12),
      locale: 'en',
    },
  })

  await prisma.userOrgRole.upsert({
    where: {
      userId_orgId: {
        userId: TEST_IDS.recruiter,
        orgId: TEST_IDS.org,
      },
    },
    update: {},
    create: {
      userId: TEST_IDS.recruiter,
      orgId: TEST_IDS.org,
      role: 'RECRUITER',
    },
  })

  // Create admin user with org membership
  const adminUser = await prisma.user.upsert({
    where: { id: TEST_IDS.admin },
    update: {},
    create: {
      id: TEST_IDS.admin,
      email: 'admin@test.com',
      name: 'Test Admin',
      password: await hash('TestPassword123!', 12),
      locale: 'en',
    },
  })

  await prisma.userOrgRole.upsert({
    where: {
      userId_orgId: {
        userId: TEST_IDS.admin,
        orgId: TEST_IDS.org,
      },
    },
    update: {},
    create: {
      userId: TEST_IDS.admin,
      orgId: TEST_IDS.org,
      role: 'ORG_ADMIN',
    },
  })

  // Create hiring manager user with org membership
  const hiringManagerUser = await prisma.user.upsert({
    where: { id: TEST_IDS.hiringManager },
    update: {},
    create: {
      id: TEST_IDS.hiringManager,
      email: 'hiring@test.com',
      name: 'Test Hiring Manager',
      password: await hash('TestPassword123!', 12),
      locale: 'en',
    },
  })

  await prisma.userOrgRole.upsert({
    where: {
      userId_orgId: {
        userId: TEST_IDS.hiringManager,
        orgId: TEST_IDS.org,
      },
    },
    update: {},
    create: {
      userId: TEST_IDS.hiringManager,
      orgId: TEST_IDS.org,
      role: 'HIRING_MANAGER',
    },
  })

  // Create agency user with org membership
  const agencyUser = await prisma.user.upsert({
    where: { id: TEST_IDS.agency },
    update: {},
    create: {
      id: TEST_IDS.agency,
      email: 'agency@test.com',
      name: 'Test Agency',
      password: await hash('TestPassword123!', 12),
      locale: 'en',
    },
  })

  await prisma.userOrgRole.upsert({
    where: {
      userId_orgId: {
        userId: TEST_IDS.agency,
        orgId: TEST_IDS.org,
      },
    },
    update: {},
    create: {
      userId: TEST_IDS.agency,
      orgId: TEST_IDS.org,
      role: 'AGENCY',
    },
  })

  console.log('Test data seeded successfully')
  return { org, candidateUser, recruiterUser, adminUser, hiringManagerUser, agencyUser }
}

/**
 * Clean up dynamic test data (jobs, applications, candidates, etc.)
 * Keep base users and organization
 */
export async function cleanupDynamicData() {
  console.log('Cleaning up dynamic test data...')

  // Order matters, and it is not the order this used to be in.
  //
  // Candidate was deleted before EmailSequenceRun and AssessmentInvite, both of
  // which hold a non-cascading foreign key to it. Every beforeEach therefore
  // failed with P2003 (EmailSequenceRun_candidateId_fkey), and because this runs
  // in a global beforeEach it took the whole 305-test suite with it — which is
  // most of why that suite has never been green.
  //
  // The rule below is simply: delete leaves first, and finish a subtree before
  // deleting anything it points at.

  // --- assessments: answers -> attempts -> invites (invite -> Candidate) ------
  await prisma.answer.deleteMany({
    where: { attempt: { invite: { assessment: { orgId: TEST_IDS.org } } } },
  })
  await prisma.attempt.deleteMany({
    where: { invite: { assessment: { orgId: TEST_IDS.org } } },
  })
  await prisma.assessmentInvite.deleteMany({
    where: { assessment: { orgId: TEST_IDS.org } },
  })

  // --- email sequences: events -> runs (run -> Candidate) -> steps -----------
  await prisma.emailSequenceEvent.deleteMany({
    where: { run: { sequence: { orgId: TEST_IDS.org } } },
  })
  await prisma.emailSequenceRun.deleteMany({
    where: { sequence: { orgId: TEST_IDS.org } },
  })

  // --- applications ----------------------------------------------------------
  await prisma.applicationActivity.deleteMany({
    where: { application: { orgId: TEST_IDS.org } },
  })
  await prisma.application.deleteMany({ where: { orgId: TEST_IDS.org } })
  await prisma.matchScore.deleteMany({ where: { orgId: TEST_IDS.org } })

  // --- candidate subtree, then the candidate ---------------------------------
  await prisma.resumeSection.deleteMany({
    where: { resume: { candidate: { orgId: TEST_IDS.org } } },
  })
  await prisma.resume.deleteMany({ where: { candidate: { orgId: TEST_IDS.org } } })
  await prisma.candidateDocument.deleteMany({
    where: { candidate: { orgId: TEST_IDS.org } },
  })
  await prisma.candidateContact.deleteMany({
    where: { candidate: { orgId: TEST_IDS.org } },
  })
  // CandidateTag and Task cascade from Candidate, so they need no line here.
  await prisma.candidate.deleteMany({ where: { orgId: TEST_IDS.org } })

  // --- jobs ------------------------------------------------------------------
  await prisma.savedJob.deleteMany({ where: { job: { orgId: TEST_IDS.org } } })
  await prisma.job.deleteMany({ where: { orgId: TEST_IDS.org } })

  // --- remaining org-scoped definitions --------------------------------------
  await prisma.emailStep.deleteMany({ where: { sequence: { orgId: TEST_IDS.org } } })
  await prisma.emailSequence.deleteMany({ where: { orgId: TEST_IDS.org } })

  await prisma.question.deleteMany({
    where: { section: { assessment: { orgId: TEST_IDS.org } } },
  })
  await prisma.assessmentSection.deleteMany({
    where: { assessment: { orgId: TEST_IDS.org } },
  })
  await prisma.assessment.deleteMany({ where: { orgId: TEST_IDS.org } })

  // --- CRM tables added alongside the models ---------------------------------
  await prisma.task.deleteMany({ where: { orgId: TEST_IDS.org } })
  await prisma.candidateTag.deleteMany({ where: { tag: { orgId: TEST_IDS.org } } })
  await prisma.tag.deleteMany({ where: { orgId: TEST_IDS.org } })
  await prisma.emailTemplate.deleteMany({ where: { orgId: TEST_IDS.org } })

  await prisma.notification.deleteMany({
    where: {
      userId: { in: [TEST_IDS.candidate, TEST_IDS.recruiter, TEST_IDS.admin] },
    },
  })
  await prisma.auditLog.deleteMany({ where: { orgId: TEST_IDS.org } })

  console.log('Dynamic test data cleaned up')
}

/**
 * Clean up ALL test data including base users and organization
 * Call this after all integration tests
 */
export async function cleanupAllTestData() {
  console.log('Cleaning up all test data...')

  await cleanupDynamicData()

  // Anything a test user authored, wherever it lives.
  //
  // cleanupDynamicData scopes on TEST_IDS.org, but several suites deliberately
  // create data in a SECOND organisation to prove the tenant boundary holds.
  // Those rows still point at test users through Job.createdBy, which is a
  // RESTRICT relation — so deleting the users failed with
  // P2003 Job_createdBy_fkey and every afterAll blew up.
  const testUsers = await prisma.user.findMany({
    where: { id: { startsWith: 'test-user-' } },
    select: { id: true },
  })
  const testUserIds = testUsers.map((u) => u.id)

  if (testUserIds.length > 0) {
    const strayJobs = await prisma.job.findMany({
      where: { createdBy: { in: testUserIds } },
      select: { id: true },
    })
    const strayJobIds = strayJobs.map((j) => j.id)

    if (strayJobIds.length > 0) {
      await prisma.applicationActivity.deleteMany({
        where: { application: { jobId: { in: strayJobIds } } },
      })
      await prisma.application.deleteMany({ where: { jobId: { in: strayJobIds } } })
      await prisma.savedJob.deleteMany({ where: { jobId: { in: strayJobIds } } })
      await prisma.job.deleteMany({ where: { id: { in: strayJobIds } } })
    }

    // Task.createdBy is RESTRICT for the same reason.
    await prisma.task.deleteMany({ where: { createdBy: { in: testUserIds } } })
    // AuditLog rows written outside TEST_IDS.org still hold a userId FK.
    await prisma.auditLog.deleteMany({ where: { userId: { in: testUserIds } } })
    await prisma.userOrgRole.deleteMany({ where: { userId: { in: testUserIds } } })
  }

  await prisma.userOrgRole.deleteMany({
    where: { orgId: TEST_IDS.org },
  })

  await prisma.user.deleteMany({
    where: {
      id: {
        startsWith: 'test-user-',
      },
    },
  })

  // Delete test organization
  await prisma.organization.deleteMany({
    where: { id: TEST_IDS.org },
  })

  console.log('All test data cleaned up')
}

/**
 * Disconnect Prisma client
 */
export async function disconnectDb() {
  await prisma.$disconnect()
}

// ============ FACTORY FUNCTIONS ============

/**
 * Create a test job
 */
export async function createTestJob(overrides?: Partial<Job>): Promise<Job> {
  return await prisma.job.create({
    data: {
      title: 'Test Software Engineer',
      description: 'A'.repeat(100), // Min 50 chars
      orgId: TEST_IDS.org,
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
      ...overrides,
    },
  })
}

/**
 * Create a test candidate
 */
export async function createTestCandidate(overrides?: Partial<Candidate>): Promise<Candidate> {
  return await prisma.candidate.create({
    data: {
      orgId: TEST_IDS.org,
      source: 'MANUAL',
      ...overrides,
    },
  })
}

/**
 * Create a test candidate with contact info
 */
export async function createTestCandidateWithContact(
  contactOverrides?: any,
  candidateOverrides?: Partial<Candidate>,
) {
  const candidate = await createTestCandidate(candidateOverrides)

  const contact = await prisma.candidateContact.create({
    data: {
      candidateId: candidate.id,
      fullName: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+421900123456',
      location: 'Bratislava, Slovakia',
      isPrimary: true,
      ...contactOverrides,
    },
  })

  return { candidate, contact }
}

/**
 * Create a test application
 */
export async function createTestApplication(
  jobId: string,
  candidateId: string,
  overrides?: Partial<Application>,
): Promise<Application> {
  return await prisma.application.create({
    data: {
      jobId,
      candidateId,
      orgId: TEST_IDS.org,
      stage: 'NEW',
      source: 'WEBSITE',
      ...overrides,
    },
  })
}

/**
 * Create a test user (for dynamic tests)
 */
export async function createTestUser(
  email: string,
  name: string,
  password?: string,
): Promise<User> {
  return await prisma.user.create({
    data: {
      email,
      name,
      password: await hash(password || 'TestPassword123!', 12),
      locale: 'en',
    },
  })
}

/**
 * Create a test organization (for dynamic tests)
 */
export async function createTestOrganization(name: string, slug: string): Promise<Organization> {
  return await prisma.organization.create({
    data: {
      name,
      slug,
      industry: 'Technology',
    },
  })
}

/**
 * Get Prisma client instance
 */
export function getPrismaClient() {
  return prisma
}

export { prisma }
