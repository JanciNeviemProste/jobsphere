/**
 * E2E Tests - Job Browsing
 */

import { test, expect } from '@playwright/test'

test.describe('Job Browsing', () => {
  test('should display jobs page', async ({ page }) => {
    await page.goto('/jobs')

    await expect(page.getByRole('heading', { name: /Browse Jobs/i })).toBeVisible()
  })

  test('should filter jobs by keyword', async ({ page }) => {
    await page.goto('/jobs')

    const searchInput = page.getByPlaceholder(/search jobs/i)
    await searchInput.fill('developer')
    await searchInput.press('Enter')

    // Should update URL with search param
    await expect(page).toHaveURL(/q=developer/)
  })

  test('should navigate to job detail page', async ({ page }) => {
    await page.goto('/jobs')

    // Click first job card (if exists)
    const firstJob = page.locator('[data-testid="job-card"]').first()

    if (await firstJob.count() > 0) {
      await firstJob.click()

      // Should navigate to job detail
      await expect(page).toHaveURL(/\/jobs\/[a-zA-Z0-9]+/)
      await expect(page.getByRole('button', { name: /apply/i })).toBeVisible()
    }
  })

  test('should show job filters', async ({ page }) => {
    await page.goto('/jobs')

    // Check for filter options
    await expect(page.getByText(/Location/i)).toBeVisible()
    await expect(page.getByText(/Job Type/i)).toBeVisible()
  })
})
