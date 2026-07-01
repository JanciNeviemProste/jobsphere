/**
 * E2E — public & auth page coverage (smoke + a11y).
 *
 * Data-driven from the central route inventory (`support/routes`): every public
 * marketing/content page and every auth entry page is smoke-tested — it renders a
 * landmark, returns no 5xx, hits no Next error boundary, and emits no fatal console
 * errors. A curated subset of the highest-traffic pages additionally runs an
 * axe-core a11y scan (serious/critical WCAG 2 A/AA only), kept small so the run
 * stays fast.
 *
 * Anonymous only — uses the base `page` fixture (no stored auth state).
 */

import { test, expect } from '@/tests/fixtures/auth'
import { smokePage, a11yScan } from '@/tests/e2e/support/smoke'
import { PUBLIC_ROUTES, AUTH_ROUTES, withLocale } from '@/tests/e2e/support/routes'

test.describe.configure({ mode: 'parallel' })

test.describe('public & auth pages — smoke', () => {
  for (const route of [...PUBLIC_ROUTES, ...AUTH_ROUTES]) {
    test(`smoke ${route.path}`, async ({ page }) => {
      await smokePage(page, route)
      // Anon-accessible pages must not silently redirect off the locale prefix.
      await expect(page).toHaveURL(/\/en(\/|$|\?)/)
    })
  }
})

/** Highest-traffic pages that must stay accessible. Kept small to bound runtime. */
const A11Y_PATHS = ['/', '/jobs', '/companies', '/pricing', '/login', '/signup']

test.describe('public & auth pages — a11y', () => {
  const a11yRoutes = [...PUBLIC_ROUTES, ...AUTH_ROUTES].filter((r) => A11Y_PATHS.includes(r.path))

  for (const route of a11yRoutes) {
    test(`a11y ${route.path}`, async ({ page }) => {
      await page.goto(withLocale(route.path), { waitUntil: 'domcontentloaded' })
      // Wait on a real landmark (URL/landmark, not a fixed delay) so the scan runs
      // against hydrated content rather than an empty pre-render.
      await page
        .locator('main, h1, [role="main"]')
        .first()
        .waitFor({ state: 'visible', timeout: 15000 })
      await a11yScan(page)
    })
  }
})
