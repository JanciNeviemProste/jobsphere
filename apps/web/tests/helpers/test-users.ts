/**
 * Test user helpers and factories for Playwright E2E tests
 *
 * This module provides:
 * - Test user data for each role (CANDIDATE, RECRUITER, ORG_ADMIN, HIRING_MANAGER)
 * - Factory functions to create test users with proper role assignments
 * - Organization seeding data for multi-tenant testing
 */

import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

// Test organization data
export const TEST_ORG = {
  id: 'test-org-playwright',
  name: 'Test Org Inc',
  slug: 'test-org-inc',
  description: 'Test organization for E2E tests',
  industry: 'Technology',
  size: '50-200',
  website: 'https://testorg.example.com',
} as const

// Default test password (hashed version will be stored in DB)
export const TEST_PASSWORD = 'TestPassword123!'

// Test users for each role
export const TEST_USERS = {
  candidate: {
    id: 'test-candidate-user',
    email: 'candidate@test.jobsphere.com',
    password: TEST_PASSWORD,
    name: 'Test Candidate',
    role: null, // Candidates don't have org roles
  },
  recruiter: {
    id: 'test-recruiter-user',
    email: 'recruiter@test.jobsphere.com',
    password: TEST_PASSWORD,
    name: 'Test Recruiter',
    role: 'RECRUITER',
    orgId: TEST_ORG.id,
  },
  orgAdmin: {
    id: 'test-admin-user',
    email: 'admin@test.jobsphere.com',
    password: TEST_PASSWORD,
    name: 'Test Admin',
    role: 'ORG_ADMIN',
    orgId: TEST_ORG.id,
  },
  hiringManager: {
    id: 'test-hiring-manager-user',
    email: 'hiring-manager@test.jobsphere.com',
    password: TEST_PASSWORD,
    name: 'Test Hiring Manager',
    role: 'HIRING_MANAGER',
    orgId: TEST_ORG.id,
  },
  agency: {
    id: 'test-agency-user',
    email: 'agency@test.jobsphere.com',
    password: TEST_PASSWORD,
    name: 'Test Agency',
    role: 'AGENCY',
    orgId: TEST_ORG.id,
  },
  // Global (super) admin — no org membership; access to /admin via isGlobalAdmin.
  globalAdmin: {
    id: 'test-global-admin-user',
    email: 'global-admin@test.jobsphere.com',
    password: TEST_PASSWORD,
    name: 'Test Global Admin',
    role: null,
    isGlobalAdmin: true,
  },
} as const

/**
 * Create test organization in database
 */
export async function createTestOrganization(prisma: PrismaClient) {
  return await prisma.organization.upsert({
    where: { id: TEST_ORG.id },
    update: {},
    create: {
      id: TEST_ORG.id,
      name: TEST_ORG.name,
      slug: TEST_ORG.slug,
      description: TEST_ORG.description,
      industry: TEST_ORG.industry,
      size: TEST_ORG.size,
      website: TEST_ORG.website,
      settings: {},
      features: {},
    },
  })
}

/**
 * Create a test user with the specified role
 */
export async function createTestUser(prisma: PrismaClient, userKey: keyof typeof TEST_USERS) {
  const userData = TEST_USERS[userKey]
  const hashedPassword = await hash(userData.password, 10)

  // Create user
  const user = await prisma.user.upsert({
    where: { id: userData.id },
    update: {},
    create: {
      id: userData.id,
      email: userData.email,
      password: hashedPassword,
      name: userData.name,
      emailVerified: new Date(), // Auto-verify test users
      locale: 'en',
      timezone: 'UTC',
      isGlobalAdmin: 'isGlobalAdmin' in userData ? userData.isGlobalAdmin : false,
    },
  })

  // Create organization membership if user has a role
  if (userData.role && userData.orgId) {
    await prisma.userOrgRole.upsert({
      where: {
        userId_orgId: {
          userId: user.id,
          orgId: userData.orgId,
        },
      },
      update: {},
      create: {
        userId: user.id,
        orgId: userData.orgId,
        role: userData.role,
        permissions: [],
      },
    })
  }

  return user
}

/**
 * Create all test users (for use in global setup)
 */
export async function createAllTestUsers(prisma: PrismaClient) {
  // First create the organization
  await createTestOrganization(prisma)

  // Then create all users
  const users = await Promise.all([
    createTestUser(prisma, 'candidate'),
    createTestUser(prisma, 'recruiter'),
    createTestUser(prisma, 'orgAdmin'),
    createTestUser(prisma, 'hiringManager'),
    createTestUser(prisma, 'agency'),
    createTestUser(prisma, 'globalAdmin'),
  ])

  return {
    organization: TEST_ORG,
    users: {
      candidate: users[0],
      recruiter: users[1],
      orgAdmin: users[2],
      hiringManager: users[3],
      agency: users[4],
      globalAdmin: users[5],
    },
  }
}

/**
 * Clean up all test users and organization
 */
export async function cleanupTestData(prisma: PrismaClient) {
  // Delete in order of foreign key dependencies

  // Delete user org roles
  await prisma.userOrgRole.deleteMany({
    where: {
      orgId: TEST_ORG.id,
    },
  })

  // Delete all users
  await prisma.user.deleteMany({
    where: {
      id: {
        in: [
          TEST_USERS.candidate.id,
          TEST_USERS.recruiter.id,
          TEST_USERS.orgAdmin.id,
          TEST_USERS.hiringManager.id,
          TEST_USERS.agency.id,
          TEST_USERS.globalAdmin.id,
        ],
      },
    },
  })

  // Delete organization (this will cascade delete many related records)
  await prisma.organization.deleteMany({
    where: { id: TEST_ORG.id },
  })
}

/**
 * Get user credentials for login
 */
export function getUserCredentials(userKey: keyof typeof TEST_USERS) {
  const user = TEST_USERS[userKey]
  return {
    email: user.email,
    password: user.password,
  }
}
