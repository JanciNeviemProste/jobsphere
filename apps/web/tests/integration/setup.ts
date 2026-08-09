import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import {
  seedTestData,
  cleanupDynamicData,
  cleanupAllTestData,
  disconnectDb,
} from './helpers/test-db'
import { assertTestDatabase } from './helpers/assert-test-database'

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

// Refuse to run against anything but a local *_test database. The previous check
// was `DATABASE_URL?.includes('test')`, which passes for a Neon branch named
// "testing" — and the developer .env here points at the same Neon instance that
// serves production, while this suite truncates and re-seeds on every file.
//
// It also used to print the whole DATABASE_URL on failure, which put the database
// password into CI logs. The guard reports host and database name only.
const target = assertTestDatabase(process.env.DATABASE_URL, {
  allowRemote: process.env.ALLOW_REMOTE_TEST_DB === '1',
})

console.log(`Integration test environment configured — ${target.host}/${target.database}`)

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
