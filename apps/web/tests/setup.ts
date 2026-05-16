import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

expect.extend(matchers)

afterEach(async () => {
  cleanup()
  vi.clearAllMocks()
  // Reset rate-limit internal state (circuit breaker, in-memory store, Redis singleton)
  // so tests don't bleed state into each other.
  try {
    const { __resetRateLimitState } = await import('@/lib/rate-limit')
    __resetRateLimitState()
  } catch {
    // Ignore if module not loaded
  }
})

// Note: Prisma and Auth mocking moved to individual test files
// Integration tests need real Prisma, unit tests can mock as needed
