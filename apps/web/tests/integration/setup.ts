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

// This setup file is loaded only via vitest.integration.config.ts,
// so we always run integration test setup here. Previous argv-based
// detection was fragile across CI/Windows and caused tests to silently
// skip seeding when loaded from the unified vitest.config.ts.

if (!process.env.DATABASE_URL?.includes('test')) {
  console.warn(
    '⚠️  WARNING: DATABASE_URL does not contain "test". Are you sure you want to run integration tests?',
  )
  console.warn('   Current DATABASE_URL:', process.env.DATABASE_URL)
  console.warn('   Set DATABASE_URL to a test database to continue.')
  process.exit(1)
}

console.log('Integration test environment configured')

beforeAll(async () => {
  console.log('\n=== Setting up integration tests ===\n')
  await seedTestData()
  console.log('\n=== Integration test setup complete ===\n')
}, 30000)

afterAll(async () => {
  console.log('\n=== Tearing down integration tests ===\n')
  await cleanupAllTestData()
  await disconnectDb()
  console.log('\n=== Integration test teardown complete ===\n')
}, 30000)

beforeEach(async () => {
  await cleanupDynamicData()
})

afterEach(() => {})
