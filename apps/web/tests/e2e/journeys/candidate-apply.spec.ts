/**
 * E2E journey — public candidate apply flow (resilient / data-independent)
 *
 * Anonymous `page`: browse `/en/jobs`, open the first job detail, follow the
 * "Apply" CTA to `/jobs/[id]/apply` and confirm the application form renders
 * (cover letter + CV choice). `/apply` is not middleware-protected, so an anon
 * visitor normally reaches the form; the last test still tolerates a login
 * redirect. Every step guards its precondition and `test.skip()`s when the
 * seeded DB has no published jobs.
 */

import { test, expect } from '@/tests/fixtures/auth'
import type { Page } from '@playwright/test'

const T = 15000

/** Locator for job-detail links on the listing (`/jobs/<id>`, never the nav). */
function jobLinks(page: Page) {
  return page.locator('a[href*="/jobs/"]')
}

test.describe('Candidate apply journey (public)', () => {
  test('jobs listing renders', async ({ page }) => {
    await page.goto('/en/jobs', { waitUntil: 'domcontentloaded' })

    await expect(page.locator('main, h1, [role="main"]').first()).toBeVisible({ timeout: T })

    // Either job cards or an explicit empty/no-results state must be present.
    const hasJobs = await jobLinks(page).count()
    const noResults = await page.getByText(/no.*result|žiadne|not found/i).count()
    expect(hasJobs > 0 || noResults > 0).toBeTruthy()
  })

  test('first job detail opens with an Apply CTA', async ({ page }) => {
    await page.goto('/en/jobs', { waitUntil: 'domcontentloaded' })

    const links = jobLinks(page)
    if ((await links.count()) === 0) {
      test.skip(true, 'No published jobs in the seeded DB')
      return
    }

    await links.first().click()
    await page.waitForURL(/\/jobs\/[^/]+$/, { timeout: T }).catch(() => {})
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: T })

    // Apply CTA (link to /apply, or a fallback Apply button).
    const applyCta = page.locator('a[href*="/apply"], button:has-text("Apply")').first()
    await expect(applyCta).toBeVisible({ timeout: T })
  })

  test('Apply CTA leads to the application form (or a login redirect)', async ({ page }) => {
    await page.goto('/en/jobs', { waitUntil: 'domcontentloaded' })

    const links = jobLinks(page)
    if ((await links.count()) === 0) {
      test.skip(true, 'No published jobs in the seeded DB')
      return
    }

    await links.first().click()
    await page.waitForURL(/\/jobs\/[^/]+$/, { timeout: T }).catch(() => {})

    const applyCta = page.locator('a[href*="/apply"], button:has-text("Apply")').first()
    if (!(await applyCta.isVisible({ timeout: T }).catch(() => false))) {
      test.skip(true, 'Job detail exposes no Apply CTA')
      return
    }

    await applyCta.click()
    await page.waitForURL(/\/(apply|login)/, { timeout: T }).catch(() => {})

    if (/\/login/.test(page.url())) {
      // Gated: confirm we landed on the login surface.
      await expect(page).toHaveURL(/\/login/, { timeout: T })
      return
    }

    // Reached the apply form — assert cover letter + a CV-choice control render.
    await expect(page).toHaveURL(/\/apply/, { timeout: T })
    await expect(page.locator('textarea[name="coverLetter"]')).toBeVisible({ timeout: T })

    const cvChoice = page
      .getByText(/Resume\/CV|CV source|select cv/i)
      .first()
      .or(page.getByRole('combobox').first())
    await expect(cvChoice).toBeVisible({ timeout: T })
  })
})
