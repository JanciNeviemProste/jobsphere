/**
 * Accessibility Tests - axe-core
 *
 * Automated WCAG 2.1 Level AA compliance testing using axe-core.
 * These tests scan key pages and components to ensure accessibility standards
 * are met, including color contrast, form labels, semantic HTML, ARIA attributes,
 * and keyboard navigation.
 *
 * @see https://www.deque.com/axe/core-documentation/
 * @see https://www.w3.org/WAI/WCAG21/quickref/
 */

import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility Tests - axe-core', () => {
  /**
   * Configure axe-core to use consistent settings across tests
   */
  const runAxeTest = async (page: any, tags = ['wcag2aa', 'wcag21aa']) => {
    const results = await new AxeBuilder({ page })
      .withTags(tags)
      .analyze()

    return results
  }

  /**
   * Helper to format violation messages for better debugging
   */
  const formatViolations = (violations: any[]) => {
    return violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.length,
      help: v.help,
      helpUrl: v.helpUrl,
    }))
  }

  test.describe('Homepage Accessibility', () => {
    test('should have no WCAG AA violations on homepage', async ({ page }) => {
      await page.goto('/')

      const results = await runAxeTest(page)

      // If there are violations, format them for better error messages
      if (results.violations.length > 0) {
        console.error('Accessibility violations found:', formatViolations(results.violations))
      }

      expect(results.violations).toEqual([])
    })

    test('should pass WCAG 2.1 AA compliance on homepage', async ({ page }) => {
      await page.goto('/')

      const results = await new AxeBuilder({ page })
        .withTags(['wcag21aa'])
        .analyze()

      if (results.violations.length > 0) {
        console.error('WCAG 2.1 AA violations:', formatViolations(results.violations))
      }

      expect(results.violations).toEqual([])
    })
  })

  test.describe('Jobs Page Accessibility', () => {
    test('should have no accessibility violations on jobs listing', async ({ page }) => {
      await page.goto('/jobs')

      // Wait for jobs to load
      await page.waitForLoadState('networkidle')

      const results = await runAxeTest(page)

      if (results.violations.length > 0) {
        console.error('Jobs page violations:', formatViolations(results.violations))
      }

      expect(results.violations).toEqual([])
    })

    test('should remain accessible when filters are applied', async ({ page }) => {
      await page.goto('/jobs')

      // Wait for page to load
      await page.waitForLoadState('networkidle')

      // Apply search filter
      const searchInput = page.getByPlaceholder(/search/i)
      if (await searchInput.count() > 0) {
        await searchInput.fill('developer')
      }

      // Apply work mode filter if available
      const workModeSelect = page.locator('select[name="workMode"]')
      if (await workModeSelect.count() > 0) {
        await workModeSelect.selectOption('REMOTE')
      }

      // Wait for filter results
      await page.waitForTimeout(1000)

      const results = await runAxeTest(page)

      if (results.violations.length > 0) {
        console.error('Filtered jobs violations:', formatViolations(results.violations))
      }

      expect(results.violations).toEqual([])
    })
  })

  test.describe('Job Detail Page Accessibility', () => {
    test('should have proper heading hierarchy and semantic HTML', async ({ page }) => {
      await page.goto('/jobs')
      await page.waitForLoadState('networkidle')

      // Navigate to first job if available
      const firstJob = page.locator('[data-testid="job-card"]').first()

      if (await firstJob.count() > 0) {
        await firstJob.click()
        await page.waitForLoadState('networkidle')

        const results = await runAxeTest(page)

        if (results.violations.length > 0) {
          console.error('Job detail violations:', formatViolations(results.violations))
        }

        expect(results.violations).toEqual([])
      } else {
        // Skip if no jobs available
        test.skip()
      }
    })
  })

  test.describe('Application Form Accessibility', () => {
    test('should have accessible form labels and error messages', async ({ page }) => {
      await page.goto('/jobs')
      await page.waitForLoadState('networkidle')

      // Navigate to first job
      const firstJob = page.locator('[data-testid="job-card"]').first()

      if (await firstJob.count() > 0) {
        await firstJob.click()
        await page.waitForLoadState('networkidle')

        // Click apply button
        const applyButton = page.getByRole('button', { name: /apply/i })
        if (await applyButton.count() > 0) {
          await applyButton.click()
          await page.waitForLoadState('networkidle')

          const results = await runAxeTest(page)

          if (results.violations.length > 0) {
            console.error('Application form violations:', formatViolations(results.violations))
          }

          expect(results.violations).toEqual([])
        } else {
          test.skip()
        }
      } else {
        test.skip()
      }
    })

    test('should maintain accessibility with validation errors visible', async ({ page }) => {
      await page.goto('/jobs')
      await page.waitForLoadState('networkidle')

      const firstJob = page.locator('[data-testid="job-card"]').first()

      if (await firstJob.count() > 0) {
        await firstJob.click()
        await page.waitForLoadState('networkidle')

        const applyButton = page.getByRole('button', { name: /apply/i })
        if (await applyButton.count() > 0) {
          await applyButton.click()
          await page.waitForLoadState('networkidle')

          // Try to submit form without filling required fields
          const submitButton = page.getByRole('button', { name: /submit/i })
          if (await submitButton.count() > 0) {
            await submitButton.click()

            // Wait for validation errors
            await page.waitForTimeout(500)

            const results = await runAxeTest(page)

            if (results.violations.length > 0) {
              console.error('Form validation violations:', formatViolations(results.violations))
            }

            expect(results.violations).toEqual([])
          } else {
            test.skip()
          }
        } else {
          test.skip()
        }
      } else {
        test.skip()
      }
    })
  })

  test.describe('Dashboard Accessibility', () => {
    test('should have accessible candidate dashboard', async ({ page }) => {
      // Note: This test requires authentication
      // Navigate to dashboard (may redirect to login if not authenticated)
      await page.goto('/dashboard')

      // Check if we're on the login page
      const currentUrl = page.url()
      if (currentUrl.includes('/login') || currentUrl.includes('/signup')) {
        // Skip this test if authentication is required
        test.skip()
      } else {
        await page.waitForLoadState('networkidle')

        const results = await runAxeTest(page)

        if (results.violations.length > 0) {
          console.error('Candidate dashboard violations:', formatViolations(results.violations))
        }

        expect(results.violations).toEqual([])
      }
    })

    test('should have accessible employer dashboard with data tables', async ({ page }) => {
      // Navigate to employer dashboard
      await page.goto('/employer/dashboard')

      // Check if we're on the login page
      const currentUrl = page.url()
      if (currentUrl.includes('/login') || currentUrl.includes('/signup')) {
        // Skip this test if authentication is required
        test.skip()
      } else {
        await page.waitForLoadState('networkidle')

        const results = await runAxeTest(page)

        if (results.violations.length > 0) {
          console.error('Employer dashboard violations:', formatViolations(results.violations))
        }

        expect(results.violations).toEqual([])
      }
    })
  })

  test.describe('Auth Pages Accessibility', () => {
    test('should have accessible login form', async ({ page }) => {
      await page.goto('/login')
      await page.waitForLoadState('networkidle')

      const results = await runAxeTest(page)

      if (results.violations.length > 0) {
        console.error('Login page violations:', formatViolations(results.violations))
      }

      expect(results.violations).toEqual([])
    })

    test('should have accessible signup form', async ({ page }) => {
      await page.goto('/signup')
      await page.waitForLoadState('networkidle')

      const results = await runAxeTest(page)

      if (results.violations.length > 0) {
        console.error('Signup page violations:', formatViolations(results.violations))
      }

      expect(results.violations).toEqual([])
    })
  })

  test.describe('Additional Accessibility Checks', () => {
    test('should verify color contrast on homepage', async ({ page }) => {
      await page.goto('/')

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .options({
          rules: {
            'color-contrast': { enabled: true }
          }
        })
        .analyze()

      const contrastViolations = results.violations.filter(v => v.id === 'color-contrast')

      if (contrastViolations.length > 0) {
        console.error('Color contrast violations:', formatViolations(contrastViolations))
      }

      expect(contrastViolations).toEqual([])
    })

    test('should verify ARIA attributes are valid', async ({ page }) => {
      await page.goto('/')

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .options({
          rules: {
            'aria-valid-attr': { enabled: true },
            'aria-valid-attr-value': { enabled: true },
            'aria-roles': { enabled: true }
          }
        })
        .analyze()

      const ariaViolations = results.violations.filter(v =>
        v.id.startsWith('aria-')
      )

      if (ariaViolations.length > 0) {
        console.error('ARIA violations:', formatViolations(ariaViolations))
      }

      expect(ariaViolations).toEqual([])
    })

    test('should verify form labels are present', async ({ page }) => {
      await page.goto('/login')

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .options({
          rules: {
            'label': { enabled: true },
            'label-title-only': { enabled: true }
          }
        })
        .analyze()

      const labelViolations = results.violations.filter(v =>
        v.id.includes('label')
      )

      if (labelViolations.length > 0) {
        console.error('Form label violations:', formatViolations(labelViolations))
      }

      expect(labelViolations).toEqual([])
    })

    test('should verify images have alt text', async ({ page }) => {
      await page.goto('/')

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .options({
          rules: {
            'image-alt': { enabled: true }
          }
        })
        .analyze()

      const imageViolations = results.violations.filter(v => v.id === 'image-alt')

      if (imageViolations.length > 0) {
        console.error('Image alt text violations:', formatViolations(imageViolations))
      }

      expect(imageViolations).toEqual([])
    })
  })

  test.describe('Specific Element Accessibility', () => {
    test('should scan navigation menu for accessibility', async ({ page }) => {
      await page.goto('/')

      // Target the navigation element specifically
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .include('nav')
        .analyze()

      if (results.violations.length > 0) {
        console.error('Navigation violations:', formatViolations(results.violations))
      }

      expect(results.violations).toEqual([])
    })

    test('should scan footer for accessibility', async ({ page }) => {
      await page.goto('/')

      // Target the footer element specifically
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2aa'])
        .include('footer')
        .analyze()

      if (results.violations.length > 0) {
        console.error('Footer violations:', formatViolations(results.violations))
      }

      expect(results.violations).toEqual([])
    })
  })

  test.describe('Best Practices', () => {
    test('should follow accessibility best practices on homepage', async ({ page }) => {
      await page.goto('/')

      const results = await new AxeBuilder({ page })
        .withTags(['best-practice'])
        .analyze()

      // Best practices are warnings, not hard failures
      // Log them for awareness but don't fail the test
      if (results.violations.length > 0) {
        console.warn('Best practice suggestions:', formatViolations(results.violations))
      }

      // We can still assert on critical best practices
      const criticalViolations = results.violations.filter(v => v.impact === 'critical')

      expect(criticalViolations).toEqual([])
    })
  })
})
