/**
 * E2E Tests - Authentication Flow
 */

import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('should display homepage', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle(/JobSphere/)
    await expect(page.getByRole('heading', { name: /Find Your Dream Job/i })).toBeVisible()
  })

  test('should navigate to pricing page', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: /Pricing/i }).click()

    await expect(page).toHaveURL(/\/pricing/)
    await expect(page.getByText(/Simple, Transparent Pricing/i)).toBeVisible()
  })

  test('should show signup form', async ({ page }) => {
    await page.goto('/signup')

    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign up/i })).toBeVisible()
  })

  test('should show login form', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('should validate email format on signup', async ({ page }) => {
    await page.goto('/signup')

    await page.getByLabel(/email/i).fill('invalid-email')
    await page.getByLabel(/password/i).fill('password123')
    await page.getByRole('button', { name: /sign up/i }).click()

    // Should show validation error
    await expect(page.getByText(/invalid email/i)).toBeVisible()
  })

  test('should require password on signup', async ({ page }) => {
    await page.goto('/signup')

    await page.getByLabel(/email/i).fill('test@example.com')
    await page.getByRole('button', { name: /sign up/i }).click()

    // Should show validation error
    await expect(page.getByText(/password.*required/i)).toBeVisible()
  })
})
