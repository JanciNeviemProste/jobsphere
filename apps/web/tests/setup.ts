import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

expect.extend(matchers)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Note: Prisma and Auth mocking moved to individual test files
// Integration tests need real Prisma, unit tests can mock as needed