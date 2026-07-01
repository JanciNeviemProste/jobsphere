/**
 * E2E — Candidate dashboard page coverage (data-driven smoke + a11y).
 *
 * Loops the central DASHBOARD_ROUTES inventory through the shared `smokePage`
 * helper (renders a landmark, no 5xx, no error boundary, no fatal console
 * errors) using the pre-authenticated `candidateUser` fixture. Plus focused
 * axe-core scans on the two highest-traffic candidate pages.
 */

import { test, expect } from '@/tests/fixtures/auth'
import { DASHBOARD_ROUTES, withLocale } from '@/tests/e2e/support/routes'
import { smokePage, a11yScan } from '@/tests/e2e/support/smoke'

test.describe('Candidate dashboard — page smoke', () => {
  for (const route of DASHBOARD_ROUTES) {
    test(`smoke ${route.path}`, async ({ candidateUser }) => {
      await smokePage(candidateUser, route)
    })
  }
})

test.describe('Candidate dashboard — a11y', () => {
  for (const path of ['/dashboard', '/dashboard/cv']) {
    test(`a11y ${path}`, async ({ candidateUser }) => {
      await candidateUser.goto(withLocale(path), { waitUntil: 'domcontentloaded' })
      // Ensure the primary content has rendered before scanning.
      await expect(candidateUser.locator('main, h1, [role="main"]').first()).toBeVisible({
        timeout: 15000,
      })
      await a11yScan(candidateUser)
    })
  }
})
