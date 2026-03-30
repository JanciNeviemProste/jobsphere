import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import {
  seedTestData,
  cleanupDynamicData,
  cleanupAllTestData,
  disconnectDb,
} from './helpers/test-db'

/**
 * Integration Test Setup
 * Configures database and environment for integration tests
 */

// This file is loaded only for integration tests (see vitest.config.ts setupFiles)
// Always set test environment
process.env.NODE_ENV = 'test'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.NEXTAUTH_SECRET = 'test-secret-key-for-integration-tests'

// Disable rate limiting in tests
process.env.DISABLE_RATE_LIMIT = 'true'

// Disable external API calls
process.env.ANTHROPIC_API_KEY = 'test-key'
process.env.STRIPE_SECRET_KEY = 'sk_test_fake'

// Check if we're running integration tests (not unit/security tests)
const isIntegrationTest = process.argv.some((arg) => {
  const normalizedArg = arg.replace(/\\/g, '/')
  return normalizedArg.includes('tests/integration') && !normalizedArg.includes('tests/security')
})

// Ensure we're using test database only for integration tests
if (isIntegrationTest && !process.env.DATABASE_URL?.includes('test')) {
  console.warn(
    '⚠️  WARNING: DATABASE_URL does not contain "test". Are you sure you want to run integration tests?',
  )
  console.warn('   Current DATABASE_URL:', process.env.DATABASE_URL)
  console.warn('   Set DATABASE_URL to a test database to continue.')
  process.exit(1)
}

if (isIntegrationTest) {
  console.log('Integration test environment configured')

  /**
   * Global Setup - Run once before all tests
   */
  beforeAll(async () => {
    console.log('\n=== Setting up integration tests ===\n')

    // Seed base test data (users, organization)
    await seedTestData()

    console.log('\n=== Integration test setup complete ===\n')
  }, 30000) // 30 second timeout for setup

  /**
   * Global Teardown - Run once after all tests
   */
  afterAll(async () => {
    console.log('\n=== Tearing down integration tests ===\n')

    // Clean up all test data
    await cleanupAllTestData()

    // Disconnect from database
    await disconnectDb()

    console.log('\n=== Integration test teardown complete ===\n')
  }, 30000) // 30 second timeout for teardown

  /**
   * Test Cleanup - Run before each test
   * Cleans dynamic data but keeps base users/org
   */
  beforeEach(async () => {
    // Clean up dynamic data from previous test
    await cleanupDynamicData()
  })

  /**
   * Post-test Cleanup - Run after each test
   */
  afterEach(() => {
    // Clear any mocks or timers
    // (handled by vitest automatically in most cases)
  })
} else {
  console.log('Skipping integration test setup for unit/security tests')
}
