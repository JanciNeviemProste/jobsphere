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

    // Only run integration tests
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**', 'tests/setup.ts'],

    // Longer timeout for database operations
    testTimeout: 30000,
    hookTimeout: 30000,

    // Sequential execution to avoid database conflicts
    // Set to false if you want parallel execution (requires careful test design)
    sequence: {
      concurrent: false,
    },

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
