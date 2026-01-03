import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import type { Job, User, Organization, Candidate, Application } from '@prisma/client'

/**
 * Database Helper for Integration Tests
 * Provides utilities for seeding and cleaning test data
 */

// Use separate test database
const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
})

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

  // Delete in correct order to respect foreign keys
  await prisma.applicationActivity.deleteMany({
    where: {
      application: {
        orgId: TEST_IDS.org,
      },
    },
  })

  await prisma.application.deleteMany({
    where: { orgId: TEST_IDS.org },
  })

  await prisma.matchScore.deleteMany({
    where: { orgId: TEST_IDS.org },
  })

  await prisma.resumeSection.deleteMany({
    where: {
      resume: {
        candidate: {
          orgId: TEST_IDS.org,
        },
      },
    },
  })

  await prisma.resume.deleteMany({
    where: {
      candidate: {
        orgId: TEST_IDS.org,
      },
    },
  })

  await prisma.candidateDocument.deleteMany({
    where: {
      candidate: {
        orgId: TEST_IDS.org,
      },
    },
  })

  await prisma.candidateContact.deleteMany({
    where: {
      candidate: {
        orgId: TEST_IDS.org,
      },
    },
  })

  await prisma.candidate.deleteMany({
    where: { orgId: TEST_IDS.org },
  })

  await prisma.savedJob.deleteMany({
    where: {
      job: {
        orgId: TEST_IDS.org,
      },
    },
  })

  await prisma.job.deleteMany({
    where: { orgId: TEST_IDS.org },
  })

  await prisma.emailSequenceEvent.deleteMany({
    where: {
      run: {
        sequence: {
          orgId: TEST_IDS.org,
        },
      },
    },
  })

  await prisma.emailSequenceRun.deleteMany({
    where: {
      sequence: {
        orgId: TEST_IDS.org,
      },
    },
  })

  await prisma.emailStep.deleteMany({
    where: {
      sequence: {
        orgId: TEST_IDS.org,
      },
    },
  })

  await prisma.emailSequence.deleteMany({
    where: { orgId: TEST_IDS.org },
  })

  await prisma.answer.deleteMany({
    where: {
      attempt: {
        invite: {
          assessment: {
            orgId: TEST_IDS.org,
          },
        },
      },
    },
  })

  await prisma.attempt.deleteMany({
    where: {
      invite: {
        assessment: {
          orgId: TEST_IDS.org,
        },
      },
    },
  })

  await prisma.assessmentInvite.deleteMany({
    where: {
      assessment: {
        orgId: TEST_IDS.org,
      },
    },
  })

  await prisma.question.deleteMany({
    where: {
      section: {
        assessment: {
          orgId: TEST_IDS.org,
        },
      },
    },
  })

  await prisma.assessmentSection.deleteMany({
    where: {
      assessment: {
        orgId: TEST_IDS.org,
      },
    },
  })

  await prisma.assessment.deleteMany({
    where: { orgId: TEST_IDS.org },
  })

  await prisma.notification.deleteMany({
    where: {
      userId: {
        in: [TEST_IDS.candidate, TEST_IDS.recruiter, TEST_IDS.admin],
      },
    },
  })

  await prisma.auditLog.deleteMany({
    where: { orgId: TEST_IDS.org },
  })

  console.log('Dynamic test data cleaned up')
}

/**
 * Clean up ALL test data including base users and organization
 * Call this after all integration tests
 */
export async function cleanupAllTestData() {
  console.log('Cleaning up all test data...')

  await cleanupDynamicData()

  // Delete user org roles
  await prisma.userOrgRole.deleteMany({
    where: { orgId: TEST_IDS.org },
  })

  // Delete test users
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
  candidateOverrides?: Partial<Candidate>
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
  overrides?: Partial<Application>
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
export async function createTestUser(email: string, name: string, password?: string): Promise<User> {
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
