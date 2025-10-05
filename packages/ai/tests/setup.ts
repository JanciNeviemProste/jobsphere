/**
 * Vitest Setup
 */

import { beforeAll, afterAll } from 'vitest'

beforeAll(() => {
  // Setup test environment
  process.env.ANTHROPIC_API_KEY = 'test-api-key'
})

afterAll(() => {
  // Cleanup
})
