/**
 * Playwright authentication fixtures
 *
 * This module extends Playwright's base test with authentication fixtures
 * that provide pre-authenticated browser contexts for different user roles.
 *
 * Usage:
 *   import { test, expect } from '@/tests/fixtures/auth'
 *
 *   test('recruiter can view jobs', async ({ recruiterUser }) => {
 *     await recruiterUser.goto('/en/employer/jobs')
 *     await expect(recruiterUser).toHaveURL(/\/employer\/jobs/)
 *   })
 */

import { test as base, type Page, type BrowserContext } from '@playwright/test'
import path from 'path'

// Type for authenticated page fixtures
export type AuthFixtures = {
  /**
   * Authenticated page for CANDIDATE role (no organization)
   */
  candidateUser: Page

  /**
   * Authenticated page for RECRUITER role
   */
  recruiterUser: Page

  /**
   * Authenticated page for ORG_ADMIN role
   */
  orgAdminUser: Page

  /**
   * Authenticated page for HIRING_MANAGER role
   */
  hiringManagerUser: Page

  /**
   * Authenticated page for AGENCY role
   */
  agencyUser: Page

  /**
   * Authenticated page for GLOBAL ADMIN (isGlobalAdmin) — access to /admin
   */
  globalAdminUser: Page

  /**
   * Generic authenticated context factory
   * Use when you need to create multiple contexts with different roles
   */
  createAuthenticatedContext: (
    role: 'candidate' | 'recruiter' | 'orgAdmin' | 'hiringManager' | 'agency' | 'globalAdmin',
  ) => Promise<{ context: BrowserContext; page: Page }>
}

// Path to stored authentication states
const AUTH_DIR = path.join(__dirname, '..', '..', 'playwright', '.auth')

/**
 * Get the path to the stored auth state for a given role
 */
function getAuthStatePath(
  role: 'candidate' | 'recruiter' | 'orgAdmin' | 'hiringManager' | 'agency' | 'globalAdmin',
): string {
  return path.join(AUTH_DIR, `${role}.json`)
}

/**
 * Extended Playwright test with authentication fixtures
 */
export const test = base.extend<AuthFixtures>({
  /**
   * Candidate user fixture (no organization)
   */
  candidateUser: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: getAuthStatePath('candidate'),
    })
    const page = await context.newPage()

    // Set default locale
    await page.addInitScript(() => {
      window.localStorage.setItem('locale', 'en')
    })

    await use(page)
    await context.close()
  },

  /**
   * Recruiter user fixture
   */
  recruiterUser: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: getAuthStatePath('recruiter'),
    })
    const page = await context.newPage()

    await page.addInitScript(() => {
      window.localStorage.setItem('locale', 'en')
    })

    await use(page)
    await context.close()
  },

  /**
   * Organization admin user fixture
   */
  orgAdminUser: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: getAuthStatePath('orgAdmin'),
    })
    const page = await context.newPage()

    await page.addInitScript(() => {
      window.localStorage.setItem('locale', 'en')
    })

    await use(page)
    await context.close()
  },

  /**
   * Hiring manager user fixture
   */
  hiringManagerUser: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: getAuthStatePath('hiringManager'),
    })
    const page = await context.newPage()

    await page.addInitScript(() => {
      window.localStorage.setItem('locale', 'en')
    })

    await use(page)
    await context.close()
  },

  /**
   * Agency user fixture
   */
  agencyUser: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: getAuthStatePath('agency'),
    })
    const page = await context.newPage()

    await page.addInitScript(() => {
      window.localStorage.setItem('locale', 'en')
    })

    await use(page)
    await context.close()
  },

  /**
   * Global admin user fixture (isGlobalAdmin — access to /admin)
   */
  globalAdminUser: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: getAuthStatePath('globalAdmin'),
    })
    const page = await context.newPage()

    await page.addInitScript(() => {
      window.localStorage.setItem('locale', 'en')
    })

    await use(page)
    await context.close()
  },

  /**
   * Factory function to create authenticated contexts on-demand
   */
  createAuthenticatedContext: async ({ browser }, use) => {
    const contexts: BrowserContext[] = []

    const factory = async (
      role: 'candidate' | 'recruiter' | 'orgAdmin' | 'hiringManager' | 'agency' | 'globalAdmin',
    ) => {
      const context = await browser.newContext({
        storageState: getAuthStatePath(role),
      })
      const page = await context.newPage()

      await page.addInitScript(() => {
        window.localStorage.setItem('locale', 'en')
      })

      contexts.push(context)
      return { context, page }
    }

    await use(factory)

    // Clean up all contexts created by the factory
    for (const context of contexts) {
      await context.close()
    }
  },
})

/**
 * Re-export expect from Playwright for convenience
 */
export { expect } from '@playwright/test'
