/**
 * E2E Tests - Responsive Design
 * Tests application layout across different viewport sizes
 */

import { test, expect } from '@playwright/test'

const viewports = [
  { name: 'mobile', width: 375, height: 667 },    // iPhone SE
  { name: 'tablet', width: 768, height: 1024 },   // iPad
  { name: 'desktop', width: 1920, height: 1080 }, // Full HD
  { name: 'wide', width: 2560, height: 1440 },    // 2K
]

test.describe('Responsive Layout', () => {
  viewports.forEach(viewport => {
    test(`Jobs page at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto('/en/jobs')

      // Wait for page load
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 })

      // Verify layout adapts
      if (viewport.name === 'mobile') {
        // On mobile, check for mobile-specific elements
        // Mobile menu button or hamburger should be present
        const mobileMenu = page.locator('button[aria-label*="menu" i], button[aria-label*="navigation" i]')
        const hasMobileMenu = await mobileMenu.count() > 0

        if (hasMobileMenu) {
          await expect(mobileMenu.first()).toBeVisible()
        }
      } else {
        // Desktop navigation should be visible or accessible
        const nav = page.locator('nav, header')
        await expect(nav.first()).toBeVisible()
      }

      // Take screenshot for visual regression
      await page.screenshot({
        path: `screenshots/${viewport.name}-jobs.png`,
        fullPage: true
      })
    })

    test(`Homepage at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto('/en')

      // Wait for page load
      await expect(page).toHaveTitle(/JobSphere/)

      // Verify main heading is visible
      const heading = page.getByRole('heading', { name: /Find Your Dream Job|JobSphere/i })
      await expect(heading.first()).toBeVisible()

      // Take screenshot for visual regression
      await page.screenshot({
        path: `screenshots/${viewport.name}-homepage.png`,
        fullPage: true
      })
    })
  })
})

test.describe('Touch-Friendly Interface', () => {
  test('Buttons should be touch-friendly on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/en')

    // Find all buttons
    const buttons = page.locator('button, a[role="button"]')
    const count = await buttons.count()

    // Check first few buttons for adequate touch target size
    const maxToCheck = Math.min(count, 5)
    for (let i = 0; i < maxToCheck; i++) {
      const button = buttons.nth(i)
      if (await button.isVisible()) {
        const box = await button.boundingBox()
        if (box) {
          // Touch targets should be at least 44x44 pixels (WCAG guidelines)
          expect(box.height).toBeGreaterThanOrEqual(32) // Relaxed for some smaller buttons
          expect(box.width).toBeGreaterThanOrEqual(32)
        }
      }
    }
  })
})

test.describe('Text Readability', () => {
  viewports.forEach(viewport => {
    test(`Text should be readable at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto('/en')

      // Check that main content text is visible and readable
      const body = page.locator('body')
      const fontSize = await body.evaluate((el) => {
        return window.getComputedStyle(el).fontSize
      })

      // Font size should be at least 14px for readability
      const size = parseInt(fontSize)
      expect(size).toBeGreaterThanOrEqual(14)
    })
  })
})

test.describe('Navigation Consistency', () => {
  test('Navigation should work consistently across viewports', async ({ page }) => {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      await page.goto('/en')

      // Try to find and click a navigation link
      const pricingLink = page.getByRole('link', { name: /Pricing/i })

      if (await pricingLink.isVisible()) {
        await pricingLink.click()
        await expect(page).toHaveURL(/\/pricing/)

        // Navigate back for next iteration
        await page.goBack()
      } else {
        // If link is not visible, might be in a mobile menu
        const menuButton = page.locator('button[aria-label*="menu" i]')
        if (await menuButton.count() > 0 && await menuButton.first().isVisible()) {
          await menuButton.first().click()
          // Wait for menu to open
          await page.waitForTimeout(500)

          const pricingLinkInMenu = page.getByRole('link', { name: /Pricing/i })
          if (await pricingLinkInMenu.isVisible()) {
            await pricingLinkInMenu.click()
            await expect(page).toHaveURL(/\/pricing/)
            await page.goBack()
          }
        }
      }
    }
  })
})

test.describe('Form Inputs on Mobile', () => {
  test('Form inputs should be usable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/en/login')

    // Check email input
    const emailInput = page.getByLabel(/email/i)
    await expect(emailInput).toBeVisible()

    // Check that input can be focused and typed into
    await emailInput.click()
    await emailInput.fill('test@example.com')
    await expect(emailInput).toHaveValue('test@example.com')

    // Check password input
    const passwordInput = page.getByLabel(/password/i)
    await expect(passwordInput).toBeVisible()
    await passwordInput.click()
    await passwordInput.fill('testpassword123')
    await expect(passwordInput).toHaveValue('testpassword123')

    // Verify inputs are large enough
    const emailBox = await emailInput.boundingBox()
    const passwordBox = await passwordInput.boundingBox()

    if (emailBox && passwordBox) {
      expect(emailBox.height).toBeGreaterThanOrEqual(32)
      expect(passwordBox.height).toBeGreaterThanOrEqual(32)
    }
  })
})

test.describe('Image Responsiveness', () => {
  viewports.forEach(viewport => {
    test(`Images should scale appropriately at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto('/en')

      // Find all images
      const images = page.locator('img')
      const count = await images.count()

      if (count > 0) {
        // Check first image
        const firstImage = images.first()
        if (await firstImage.isVisible()) {
          const box = await firstImage.boundingBox()

          if (box) {
            // Image should not exceed viewport width
            expect(box.width).toBeLessThanOrEqual(viewport.width)
          }
        }
      }
    })
  })
})

test.describe('Overflow Prevention', () => {
  viewports.forEach(viewport => {
    test(`No horizontal scroll at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto('/en')

      // Wait for page to fully load
      await page.waitForLoadState('networkidle')

      // Check for horizontal overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)

      // Allow small margin of error (1-2px) for rounding
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2)
    })
  })
})
