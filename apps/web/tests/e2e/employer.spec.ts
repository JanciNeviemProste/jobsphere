/**
 * E2E Tests - Employer Dashboard
 */

import { test, expect } from '@playwright/test'

// Helper to setup authenticated employer
async function loginAsEmployer(page: any) {
  // This would use real auth in production tests
  // For now, we'll just navigate
  await page.goto('/login')
  await page.getByLabel(/email/i).fill('employer@example.com')
  await page.getByLabel(/password/i).fill('password123')
  await page.getByRole('button', { name: /sign in/i }).click()
}

test.describe('Employer Dashboard', () => {
  test('should require authentication', async ({ page }) => {
    await page.goto('/employer')

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/)
  })

  test.skip('should show employer dashboard after login', async ({ page }) => {
    await loginAsEmployer(page)

    await expect(page).toHaveURL(/\/employer/)
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible()
  })

  test.skip('should navigate to post job page', async ({ page }) => {
    await loginAsEmployer(page)

    await page.goto('/employer')
    await page.getByRole('link', { name: /Post Job/i }).click()

    await expect(page).toHaveURL(/\/employer\/jobs\/new/)
    await expect(page.getByLabel(/Job Title/i)).toBeVisible()
  })

  test.skip('should show applicants list', async ({ page }) => {
    await loginAsEmployer(page)

    await page.goto('/employer/applicants')

    await expect(page.getByRole('heading', { name: /Applicants/i })).toBeVisible()
  })

  test.skip('should navigate to settings', async ({ page }) => {
    await loginAsEmployer(page)

    await page.goto('/employer/settings')

    await expect(page.getByRole('heading', { name: /Settings/i })).toBeVisible()
  })
})
