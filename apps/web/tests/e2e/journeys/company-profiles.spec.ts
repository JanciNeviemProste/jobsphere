/**
 * E2E journey — public company profiles (resilient / data-independent)
 *
 * Anonymous `page`: the landing companies strip (`/en`), the `/companies`
 * listing, and an individual `/company/[id]` profile with its open positions.
 * All three sections are conditional on seeded orgs (the landing strip only
 * shows orgs that have a logo), so each test degrades gracefully to an
 * empty-state assertion or `test.skip()`.
 */

import { test, expect } from '@/tests/fixtures/auth'

const T = 15000

test.describe('Public company profiles', () => {
  test('landing page renders (companies strip when present)', async ({ page }) => {
    await page.goto('/en', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main, h1, [role="main"]').first()).toBeVisible({ timeout: T })

    // The "Firmy, ktoré hľadajú" strip only renders for orgs that have a logo.
    const companyLinks = page.locator('a[href*="/company/"]')
    if ((await companyLinks.count()) > 0) {
      await expect(companyLinks.first()).toBeVisible({ timeout: T })
    }
  })

  test('/companies listing renders', async ({ page }) => {
    await page.goto('/en/companies', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('main, h1, [role="main"]').first()).toBeVisible({ timeout: T })

    // Either company cards or the explicit empty state must be shown.
    const companyLinks = page.locator('a[href*="/company/"]')
    const emptyState = page.getByText(/žiadne firmy|no compan/i)
    const hasCompanies = (await companyLinks.count()) > 0
    const hasEmpty = (await emptyState.count()) > 0
    expect(hasCompanies || hasEmpty).toBeTruthy()
  })

  test('open a company profile with its open positions', async ({ page }) => {
    await page.goto('/en/companies', { waitUntil: 'domcontentloaded' })

    const companyLinks = page.locator('a[href*="/company/"]')
    if ((await companyLinks.count()) === 0) {
      test.skip(true, 'No seeded companies to open')
      return
    }

    await companyLinks.first().click()
    await expect(page).toHaveURL(/\/company\/[^/]+/, { timeout: T })
    await expect(page.locator('main, h1, [role="main"]').first()).toBeVisible({ timeout: T })

    // Profile shows the "Otvorené pozície" section (empty or with job cards).
    await expect(page.getByText(/Otvorené pozície|open position/i).first()).toBeVisible({
      timeout: T,
    })
  })
})
