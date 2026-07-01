/**
 * E2E — Employer area page coverage (data-driven smoke + a11y).
 *
 * Loops the central EMPLOYER_ROUTES inventory through the shared `smokePage`
 * helper using the pre-authenticated `orgAdminUser` fixture (has an orgId, so
 * the org-scoped employer pages render instead of redirecting). Plus axe-core
 * scans on the dashboard, the new 4-column pipeline, and the job-create form.
 */

import { test, expect } from '@/tests/fixtures/auth'
import { EMPLOYER_ROUTES, withLocale } from '@/tests/e2e/support/routes'
import { smokePage, a11yScan } from '@/tests/e2e/support/smoke'

test.describe('Employer area — page smoke', () => {
  for (const route of EMPLOYER_ROUTES) {
    test(`smoke ${route.path}`, async ({ orgAdminUser }) => {
      await smokePage(orgAdminUser, route)
    })
  }
})

test.describe('Employer area — a11y', () => {
  for (const path of ['/employer', '/employer/pipeline', '/employer/jobs/new']) {
    test(`a11y ${path}`, async ({ orgAdminUser }) => {
      await orgAdminUser.goto(withLocale(path), { waitUntil: 'domcontentloaded' })
      await expect(orgAdminUser.locator('main, h1, [role="main"]').first()).toBeVisible({
        timeout: 15000,
      })
      await a11yScan(orgAdminUser)
    })
  }
})
