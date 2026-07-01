/**
 * Playwright Global Setup
 *
 * This script runs once before all tests. It:
 * 1. Seeds the test database with test users for each role
 * 2. Logs in each user via the UI to obtain auth state
 * 3. Saves auth state to files for reuse across all tests
 *
 * This approach dramatically speeds up test execution by avoiding
 * repeated logins in individual tests.
 */

import { chromium, type FullConfig } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs'
import { createAllTestUsers, getUserCredentials, TEST_USERS } from '../helpers/test-users'

const AUTH_DIR = path.join(__dirname, '..', '..', 'playwright', '.auth')

/**
 * Login via UI and save authentication state
 */
async function loginAndSaveAuth(
  baseURL: string,
  userKey: keyof typeof TEST_USERS,
  authFilePath: string,
) {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    const credentials = getUserCredentials(userKey)

    // Navigate to login page
    await page.goto(`${baseURL}/en/login`)

    // Fill in login form
    await page.fill('input[type="email"]', credentials.email)
    await page.fill('input[type="password"]', credentials.password)

    // Submit form
    await page.click('button[type="submit"]')

    // Wait for redirect after successful login
    await page.waitForURL(/\/(en|de|cs|sk|pl)\/(dashboard|employer)/, {
      timeout: 10000,
    })

    // Save authentication state
    await context.storageState({ path: authFilePath })

    console.log(`✓ Saved auth state for ${userKey}`)
  } catch (error) {
    console.error(`✗ Failed to login ${userKey}:`, error)
    throw error
  } finally {
    await context.close()
    await browser.close()
  }
}

/**
 * Main global setup function
 */
async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3000'

  console.log('\n🔧 Running Playwright global setup...\n')

  // Initialize Prisma client
  const prisma = new PrismaClient()

  try {
    // Ensure auth directory exists
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true })
    }

    console.log('📦 Seeding test database with users...')

    // Create all test users in database
    const { users } = await createAllTestUsers(prisma)

    console.log('✓ Test users created:')
    console.log(`  - Candidate: ${users.candidate.email}`)
    console.log(`  - Recruiter: ${users.recruiter.email}`)
    console.log(`  - Org Admin: ${users.orgAdmin.email}`)
    console.log(`  - Hiring Manager: ${users.hiringManager.email}`)
    console.log(`  - Agency: ${users.agency.email}\n`)

    console.log('🔐 Logging in users and saving auth states...\n')

    // Login each user and save auth state
    await Promise.all([
      loginAndSaveAuth(baseURL, 'candidate', path.join(AUTH_DIR, 'candidate.json')),
      loginAndSaveAuth(baseURL, 'recruiter', path.join(AUTH_DIR, 'recruiter.json')),
      loginAndSaveAuth(baseURL, 'orgAdmin', path.join(AUTH_DIR, 'orgAdmin.json')),
      loginAndSaveAuth(baseURL, 'hiringManager', path.join(AUTH_DIR, 'hiringManager.json')),
      loginAndSaveAuth(baseURL, 'agency', path.join(AUTH_DIR, 'agency.json')),
      loginAndSaveAuth(baseURL, 'globalAdmin', path.join(AUTH_DIR, 'globalAdmin.json')),
    ])

    console.log('\n✅ Global setup completed successfully!\n')
  } catch (error) {
    console.error('\n❌ Global setup failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

export default globalSetup
