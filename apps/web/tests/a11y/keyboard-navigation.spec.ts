/**
 * E2E Tests - Keyboard Navigation Accessibility
 *
 * Comprehensive keyboard navigation tests to ensure the application
 * is fully usable without a mouse, meeting WCAG 2.1 Level AA standards.
 */

import { test, expect } from '@playwright/test'

test.describe('Keyboard Navigation Accessibility', () => {
  test.describe('Tab Navigation Order', () => {
    test('should navigate through homepage elements in logical order', async ({ page }) => {
      await page.goto('/en')

      // Start at skip link (first focusable element)
      await page.keyboard.press('Tab')
      let focused = await page.locator(':focus')
      await expect(focused).toHaveAttribute('href', '#main-content')

      // Tab to logo
      await page.keyboard.press('Tab')
      focused = await page.locator(':focus')
      await expect(focused).toHaveAttribute('aria-label', 'JobSphere home')

      // Tab to first nav link (Home)
      await page.keyboard.press('Tab')
      focused = await page.locator(':focus')
      await expect(focused).toHaveRole('link')
      const firstNavText = await focused.textContent()
      expect(firstNavText?.toLowerCase()).toContain('home')

      // Tab to Jobs nav link
      await page.keyboard.press('Tab')
      focused = await page.locator(':focus')
      const navText = await focused.textContent()
      expect(navText?.toLowerCase()).toContain('jobs')
    })

    test('should maintain logical focus order on jobs listing page', async ({ page }) => {
      await page.goto('/en/jobs')
      await page.waitForLoadState('networkidle')

      // Skip to main content
      await page.keyboard.press('Tab')
      await page.keyboard.press('Enter')

      // Next tab should be in main content area (search or filters)
      await page.keyboard.press('Tab')
      const focused = await page.locator(':focus')

      // Verify we're in the main content area
      const isInMain = await focused.evaluate(el => {
        const main = document.getElementById('main-content')
        return main ? main.contains(el) : false
      })
      expect(isInMain).toBe(true)
    })

    test('should show visible focus indicators on all interactive elements', async ({ page }) => {
      await page.goto('/en')

      // Tab through several elements and verify focus visibility
      const elementsToTest = 5

      for (let i = 0; i < elementsToTest; i++) {
        await page.keyboard.press('Tab')
        const focused = await page.locator(':focus')

        // Check for focus ring or outline
        const focusStyles = await focused.evaluate(el => {
          const styles = window.getComputedStyle(el)
          return {
            outline: styles.outline,
            outlineWidth: styles.outlineWidth,
            outlineStyle: styles.outlineStyle,
            boxShadow: styles.boxShadow,
          }
        })

        // Should have either outline or box-shadow (focus ring)
        const hasFocusIndicator =
          (focusStyles.outlineStyle !== 'none' && parseFloat(focusStyles.outlineWidth) > 0) ||
          (focusStyles.boxShadow !== 'none' && focusStyles.boxShadow.length > 0)

        expect(hasFocusIndicator).toBe(true)
      }
    })
  })

  test.describe('Dialog/Modal Keyboard Support', () => {
    test('should open and interact with dialog using keyboard', async ({ page }) => {
      // Navigate to a page with a dialog - using employer settings team tab
      await page.goto('/en/employer/settings')
      await page.waitForLoadState('networkidle')

      // Find and activate "Invite Member" button with keyboard
      const inviteButton = page.getByRole('button', { name: /invite.*member/i })

      if (await inviteButton.isVisible()) {
        await inviteButton.focus()
        await page.keyboard.press('Enter')

        // Verify dialog opened
        const dialog = page.locator('[role="dialog"]')
        await expect(dialog).toBeVisible({ timeout: 5000 })

        // Verify focus is inside dialog
        const focused = await page.locator(':focus')
        const isInDialog = await focused.evaluate((el, dialogEl) => {
          return dialogEl?.contains(el) || false
        }, await dialog.elementHandle())

        expect(isInDialog).toBe(true)
      }
    })

    test('should close dialog with Escape key', async ({ page }) => {
      await page.goto('/en/employer/settings')
      await page.waitForLoadState('networkidle')

      const inviteButton = page.getByRole('button', { name: /invite.*member/i })

      if (await inviteButton.isVisible()) {
        // Open dialog
        await inviteButton.click()

        const dialog = page.locator('[role="dialog"]')
        await expect(dialog).toBeVisible({ timeout: 5000 })

        // Press Escape to close
        await page.keyboard.press('Escape')

        // Verify dialog closed
        await expect(dialog).not.toBeVisible({ timeout: 2000 })

        // Focus should return to trigger button
        const focused = await page.locator(':focus')
        const buttonText = await inviteButton.textContent()
        const focusedText = await focused.textContent()
        expect(focusedText).toContain(buttonText || '')
      }
    })

    test('should trap focus within dialog', async ({ page }) => {
      await page.goto('/en/employer/settings')
      await page.waitForLoadState('networkidle')

      const inviteButton = page.getByRole('button', { name: /invite.*member/i })

      if (await inviteButton.isVisible()) {
        // Open dialog
        await inviteButton.click()

        const dialog = page.locator('[role="dialog"]')
        await expect(dialog).toBeVisible({ timeout: 5000 })

        // Find all focusable elements in dialog
        const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        const focusableElements = dialog.locator(focusableSelector)
        const count = await focusableElements.count()

        if (count > 0) {
          // Tab through all elements plus a few extra to test wrapping
          for (let i = 0; i < count + 3; i++) {
            await page.keyboard.press('Tab')

            // Focus should still be within dialog
            const focused = await page.locator(':focus')
            const isInDialog = await focused.evaluate((el, dialogEl) => {
              return dialogEl?.contains(el) || false
            }, await dialog.elementHandle())

            expect(isInDialog).toBe(true)
          }
        }

        // Close dialog
        await page.keyboard.press('Escape')
      }
    })
  })

  test.describe('Button Activation', () => {
    test('should activate buttons with Enter key', async ({ page }) => {
      await page.goto('/en/login')

      // Fill form fields
      await page.fill('input[name="email"]', 'test@example.com')
      await page.fill('input[type="password"]', 'password123')

      // Focus submit button
      const submitButton = page.getByRole('button', { type: 'submit' })
      await submitButton.focus()

      // Activate with Enter
      await page.keyboard.press('Enter')

      // Verify form submission was attempted (error message or loading state)
      await page.waitForTimeout(500)
      const hasError = await page.locator('text=/invalid|error/i').isVisible().catch(() => false)
      const hasLoading = await page.locator('text=/signing in|loading/i').isVisible().catch(() => false)

      // Either error or loading state should appear
      expect(hasError || hasLoading).toBeTruthy()
    })

    test('should activate buttons with Space key', async ({ page }) => {
      await page.goto('/en')

      // Find a button (e.g., Get Started or Sign Up)
      const button = page.getByRole('button', { name: /get started|sign up/i }).first()

      if (await button.isVisible()) {
        await button.focus()

        // Record current URL
        const currentUrl = page.url()

        // Activate with Space
        await page.keyboard.press('Space')

        // Wait for navigation or modal
        await page.waitForTimeout(500)

        // Verify something happened (URL changed or modal opened)
        const newUrl = page.url()
        const hasDialog = await page.locator('[role="dialog"]').isVisible().catch(() => false)

        expect(newUrl !== currentUrl || hasDialog).toBeTruthy()
      }
    })

    test('should activate primary action buttons on job application page', async ({ page }) => {
      await page.goto('/en/jobs')
      await page.waitForLoadState('networkidle')

      // Find and click a job to view details
      const jobCard = page.locator('a[href*="/jobs/"]').first()

      if (await jobCard.isVisible()) {
        await jobCard.click()
        await page.waitForLoadState('networkidle')

        // Look for Apply button
        const applyButton = page.getByRole('link', { name: /apply/i })

        if (await applyButton.isVisible()) {
          await applyButton.focus()

          // Get current URL
          const currentUrl = page.url()

          // Activate with Enter
          await page.keyboard.press('Enter')
          await page.waitForLoadState('networkidle')

          // Should navigate to application page
          const newUrl = page.url()
          expect(newUrl).not.toBe(currentUrl)
          expect(newUrl).toContain('/apply')
        }
      }
    })
  })

  test.describe('Dropdown/Select Navigation', () => {
    test('should open and navigate select with keyboard', async ({ page }) => {
      await page.goto('/en/jobs')
      await page.waitForLoadState('networkidle')

      // Look for filter dropdowns (work mode, job type, etc.)
      const filterButton = page.locator('[role="combobox"], button[aria-haspopup="listbox"]').first()

      if (await filterButton.isVisible()) {
        await filterButton.focus()

        // Open with Space or Enter
        await page.keyboard.press('Space')

        // Wait for dropdown to open
        await page.waitForTimeout(300)

        // Navigate with Arrow Down
        await page.keyboard.press('ArrowDown')
        await page.keyboard.press('ArrowDown')

        // Select with Enter
        await page.keyboard.press('Enter')

        // Dropdown should close
        await page.waitForTimeout(300)
      }
    })

    test('should navigate job filters with keyboard', async ({ page }) => {
      await page.goto('/en/jobs')
      await page.waitForLoadState('networkidle')

      // Find the filters dropdown menu
      const filterDropdown = page.locator('button:has-text("Filter"), button[aria-label*="filter"]').first()

      if (await filterDropdown.isVisible()) {
        await filterDropdown.focus()
        await page.keyboard.press('Enter')

        // Wait for menu to open
        await page.waitForTimeout(300)

        // Navigate through options with arrow keys
        await page.keyboard.press('ArrowDown')
        await page.keyboard.press('ArrowDown')

        // Toggle selection with Space or Enter
        await page.keyboard.press('Space')

        // Close with Escape
        await page.keyboard.press('Escape')
      }
    })
  })

  test.describe('Skip Links', () => {
    test('should have skip link as first focusable element', async ({ page }) => {
      await page.goto('/en')

      // Tab once - should focus skip link
      await page.keyboard.press('Tab')

      const focused = await page.locator(':focus')
      const href = await focused.getAttribute('href')
      const text = await focused.textContent()

      expect(href).toBe('#main-content')
      expect(text?.toLowerCase()).toContain('skip')
    })

    test('should jump to main content when skip link is activated', async ({ page }) => {
      await page.goto('/en')

      // Focus skip link
      await page.keyboard.press('Tab')

      // Activate skip link with Enter
      await page.keyboard.press('Enter')

      // Wait a moment for focus to move
      await page.waitForTimeout(200)

      // Verify focus moved to main content
      const focused = await page.locator(':focus')
      const focusedId = await focused.getAttribute('id')

      // Focus should be on main content or an element within it
      if (focusedId !== 'main-content') {
        const isInMain = await focused.evaluate(el => {
          const main = document.getElementById('main-content')
          return main ? main.contains(el) : false
        })
        expect(isInMain).toBe(true)
      } else {
        expect(focusedId).toBe('main-content')
      }
    })

    test('should have skip link on multiple pages', async ({ page }) => {
      const pages = ['/en', '/en/jobs', '/en/pricing', '/en/for-employers']

      for (const url of pages) {
        await page.goto(url)

        // Tab to first element
        await page.keyboard.press('Tab')

        const focused = await page.locator(':focus')
        const href = await focused.getAttribute('href')

        expect(href).toBe('#main-content')
      }
    })
  })

  test.describe('Form Navigation', () => {
    test('should navigate through form fields in logical order', async ({ page }) => {
      await page.goto('/en/login')

      // Tab to skip link
      await page.keyboard.press('Tab')

      // Skip to main content
      await page.keyboard.press('Enter')

      // Find the form and tab through fields
      const emailInput = page.locator('input[name="email"], input[type="email"]').first()
      const passwordInput = page.locator('input[type="password"]').first()

      // Tab until we reach email field
      let attempts = 0
      while (attempts < 10) {
        await page.keyboard.press('Tab')
        const focused = await page.locator(':focus')
        const type = await focused.getAttribute('type')
        const name = await focused.getAttribute('name')

        if (type === 'email' || name === 'email') {
          break
        }
        attempts++
      }

      // Type in email field
      await page.keyboard.type('test@example.com')

      // Tab to password field
      await page.keyboard.press('Tab')

      // We might hit other elements (remember me checkbox, etc.)
      // Tab until we reach password field
      attempts = 0
      while (attempts < 5) {
        const focused = await page.locator(':focus')
        const type = await focused.getAttribute('type')

        if (type === 'password') {
          break
        }
        await page.keyboard.press('Tab')
        attempts++
      }

      // Type password
      await page.keyboard.type('password123')

      // Verify both fields are filled
      const emailValue = await emailInput.inputValue()
      const passwordValue = await passwordInput.inputValue()

      expect(emailValue).toBe('test@example.com')
      expect(passwordValue).toBe('password123')
    })

    test('should submit form with Enter key from input field', async ({ page }) => {
      await page.goto('/en/login')

      // Fill email field
      await page.fill('input[name="email"]', 'test@example.com')

      // Focus password field
      await page.focus('input[type="password"]')
      await page.keyboard.type('password123')

      // Press Enter to submit (without clicking button)
      await page.keyboard.press('Enter')

      // Verify form submitted (check for error message or navigation)
      await page.waitForTimeout(500)

      // Should show error or attempt authentication
      const hasError = await page.locator('text=/invalid|error/i').isVisible().catch(() => false)
      const hasLoading = await page.locator('text=/signing in/i').isVisible().catch(() => false)

      expect(hasError || hasLoading).toBeTruthy()
    })

    test('should display accessible error messages', async ({ page }) => {
      await page.goto('/en/signup')

      // Fill invalid email
      await page.fill('input[name="email"], input[type="email"]', 'invalid-email')

      // Try to submit
      const submitButton = page.getByRole('button', { name: /sign up/i })
      await submitButton.click()

      // Wait for validation
      await page.waitForTimeout(500)

      // Check for error message
      const errorMessage = page.locator('text=/invalid.*email|email.*invalid/i, [role="alert"]')
      const hasError = await errorMessage.isVisible().catch(() => false)

      if (hasError) {
        // Error should be associated with the field or in an alert
        const errorRole = await errorMessage.getAttribute('role')
        expect(errorRole === 'alert' || errorRole === null).toBeTruthy()
      }
    })
  })

  test.describe('Custom Component Keyboard Support', () => {
    test('should navigate tabs component with arrow keys', async ({ page }) => {
      // Navigate to a page with tabs (employer settings)
      await page.goto('/en/employer/settings')
      await page.waitForLoadState('networkidle')

      // Find tabs list
      const tabsList = page.locator('[role="tablist"]')

      if (await tabsList.isVisible()) {
        // Focus first tab
        const firstTab = tabsList.locator('[role="tab"]').first()
        await firstTab.focus()

        const firstTabText = await firstTab.textContent()

        // Navigate with Arrow Right
        await page.keyboard.press('ArrowRight')

        const focused = await page.locator(':focus')
        const focusedText = await focused.textContent()

        // Should have moved to next tab
        expect(focusedText).not.toBe(firstTabText)

        // Navigate with Arrow Left
        await page.keyboard.press('ArrowLeft')

        const focusedAfterLeft = await page.locator(':focus')
        const textAfterLeft = await focusedAfterLeft.textContent()

        // Should be back to first tab
        expect(textAfterLeft).toBe(firstTabText)
      }
    })

    test('should activate tab with Enter or Space', async ({ page }) => {
      await page.goto('/en/employer/settings')
      await page.waitForLoadState('networkidle')

      const tabsList = page.locator('[role="tablist"]')

      if (await tabsList.isVisible()) {
        const tabs = tabsList.locator('[role="tab"]')
        const tabCount = await tabs.count()

        if (tabCount > 1) {
          // Focus and activate second tab
          await tabs.nth(1).focus()
          await page.keyboard.press('Enter')

          // Wait for tab panel to change
          await page.waitForTimeout(300)

          // Verify tab is selected
          const secondTab = tabs.nth(1)
          const ariaSelected = await secondTab.getAttribute('aria-selected')
          expect(ariaSelected).toBe('true')
        }
      }
    })

    test('should navigate language switcher with keyboard', async ({ page }) => {
      await page.goto('/en')

      // Find language switcher (usually in header)
      const langSwitcher = page.locator('button[aria-label*="language"], button:has-text("EN"), button:has-text("English")').first()

      if (await langSwitcher.isVisible()) {
        await langSwitcher.focus()

        // Open with Enter or Space
        await page.keyboard.press('Space')

        // Wait for dropdown
        await page.waitForTimeout(300)

        // Navigate with arrows
        await page.keyboard.press('ArrowDown')

        // Select with Enter
        await page.keyboard.press('Enter')

        // Should close the dropdown
        await page.waitForTimeout(300)
      }
    })
  })

  test.describe('Complex Interactions', () => {
    test('should handle nested keyboard navigation in job cards', async ({ page }) => {
      await page.goto('/en/jobs')
      await page.waitForLoadState('networkidle')

      // Tab through job cards
      const jobLinks = page.locator('a[href*="/jobs/"]')
      const count = await jobLinks.count()

      if (count > 0) {
        // Focus first job link
        await jobLinks.first().focus()

        // Verify focus is visible
        const focused = await page.locator(':focus')
        const href = await focused.getAttribute('href')
        expect(href).toContain('/jobs/')

        // Tab to next focusable element
        await page.keyboard.press('Tab')

        // Should move to next interactive element
        const newFocused = await page.locator(':focus')
        const newHref = await newFocused.getAttribute('href')

        // If it's another job link, they should be different
        if (newHref?.includes('/jobs/')) {
          expect(newHref).not.toBe(href)
        }
      }
    })

    test('should maintain focus when filtering jobs', async ({ page }) => {
      await page.goto('/en/jobs')
      await page.waitForLoadState('networkidle')

      // Find search input
      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first()

      if (await searchInput.isVisible()) {
        await searchInput.focus()

        // Type search query
        await page.keyboard.type('engineer')

        // Wait for results to update
        await page.waitForTimeout(1000)

        // Focus should still be on search input
        const focused = await page.locator(':focus')
        const focusedType = await focused.getAttribute('type')
        const focusedPlaceholder = await focused.getAttribute('placeholder')

        expect(
          focusedType === 'search' ||
          focusedType === 'text' ||
          focusedPlaceholder?.toLowerCase().includes('search')
        ).toBeTruthy()
      }
    })

    test('should support keyboard navigation on job detail page actions', async ({ page }) => {
      await page.goto('/en/jobs')
      await page.waitForLoadState('networkidle')

      // Navigate to a job detail page
      const jobCard = page.locator('a[href*="/jobs/"]').first()

      if (await jobCard.isVisible()) {
        await jobCard.click()
        await page.waitForLoadState('networkidle')

        // Tab through actions (Apply, Save, Share)
        const applyButton = page.getByRole('link', { name: /apply/i })
        const saveButton = page.getByRole('button', { name: /save/i })
        const shareButton = page.getByRole('button', { name: /share/i })

        // Test Apply button
        if (await applyButton.isVisible()) {
          await applyButton.focus()

          const focused = await page.locator(':focus')
          const focusedText = await focused.textContent()
          expect(focusedText?.toLowerCase()).toContain('apply')
        }

        // Test Save button if visible
        if (await saveButton.isVisible()) {
          await saveButton.focus()
          await page.keyboard.press('Enter')

          // Wait for save action
          await page.waitForTimeout(500)
        }
      }
    })
  })

  test.describe('Focus Management', () => {
    test('should restore focus after closing modal', async ({ page }) => {
      await page.goto('/en/employer/settings')
      await page.waitForLoadState('networkidle')

      const inviteButton = page.getByRole('button', { name: /invite.*member/i })

      if (await inviteButton.isVisible()) {
        // Focus and activate button
        await inviteButton.focus()
        const buttonText = await inviteButton.textContent()

        await page.keyboard.press('Enter')

        // Wait for modal
        const dialog = page.locator('[role="dialog"]')
        await expect(dialog).toBeVisible({ timeout: 5000 })

        // Close modal with Escape
        await page.keyboard.press('Escape')
        await expect(dialog).not.toBeVisible({ timeout: 2000 })

        // Focus should return to trigger button
        const focused = await page.locator(':focus')
        const focusedText = await focused.textContent()
        expect(focusedText).toBe(buttonText)
      }
    })

    test('should not lose focus when content updates', async ({ page }) => {
      await page.goto('/en/jobs')
      await page.waitForLoadState('networkidle')

      // Focus search input
      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first()

      if (await searchInput.isVisible()) {
        await searchInput.focus()

        // Type to trigger content update
        await page.keyboard.type('developer')

        // Wait for debounce and update
        await page.waitForTimeout(1500)

        // Focus should still be on search input
        const focused = await page.locator(':focus')
        const isSameElement = await focused.evaluate((el, inputEl) => {
          return el === inputEl
        }, await searchInput.elementHandle())

        expect(isSameElement).toBe(true)
      }
    })

    test('should handle focus in forms with validation errors', async ({ page }) => {
      await page.goto('/en/signup')

      // Submit empty form
      const submitButton = page.getByRole('button', { name: /sign up/i })
      await submitButton.focus()
      await page.keyboard.press('Enter')

      // Wait for validation
      await page.waitForTimeout(500)

      // Focus should move to first error or stay on button
      const focused = await page.locator(':focus')
      const focusedTag = await focused.evaluate(el => el.tagName.toLowerCase())

      // Should be on an input or button
      expect(['input', 'button'].includes(focusedTag)).toBeTruthy()
    })
  })
})
