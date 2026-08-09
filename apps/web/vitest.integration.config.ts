import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Vitest Configuration for Integration Tests
 * Uses real database, no mocking
 */

export default defineConfig({
  plugins: [react()] as any,
  test: {
    // Integration tests use node environment for API testing
    environment: 'node',

    // Load integration test setup
    setupFiles: ['./tests/integration/setup.ts'],

    // Run integration tests (DB-bound) including security tests that need a real DB
    include: [
      'tests/integration/**/*.test.ts',
      'tests/security/xss-protection.test.ts',
      'tests/security/sql-injection.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**', 'tests/setup.ts'],

    // Longer timeout for database operations
    testTimeout: 30000,
    hookTimeout: 30000,

    // Sequential execution to avoid database conflicts.
    // `sequence.concurrent` only orders tests WITHIN a file — it says nothing
    // about files running alongside each other, and `fileParallelism` defaults
    // to true. All 17 files share one fixture organisation (`test-org-id`), and
    // setup.ts registers a global afterAll that deletes that organisation and its
    // users. So a file finishing its run tore the fixture out from under whatever
    // was still executing, the request under test 4xx'd, and the assertion blew up
    // on `data.job.id` with "Cannot read properties of undefined (reading 'id')".
    //
    // That symptom read as "the seed is missing" and sent the CI step to
    // continue-on-error. It was a race, not a seed: `beforeAll` does call
    // seedTestData(). Serialising the files is the smallest fix that addresses the
    // cause; per-worker fixture namespacing would be the larger one, and needs a
    // green baseline first.
    sequence: {
      concurrent: false,
    },
    fileParallelism: false,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/app/api/**/*.ts', 'src/lib/**/*.ts'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.{ts,js}',
        '**/types.ts',
        'src/lib/prisma.ts', // Prisma client wrapper
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
    },

    // Global test configuration
    globals: true,

    // Isolation between test files
    isolate: true,

    // Pool options
    pool: 'forks', // Use forks for better isolation with database

    // Environment variables
    env: {
      NODE_ENV: 'test',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
