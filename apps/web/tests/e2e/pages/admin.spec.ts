/**
 * E2E — Superadmin area (data-driven smoke + a11y + access guards)
 *
 * Covers the new `/admin/*` superadmin surface (PR6). The smoke loop reuses the
 * shared `smokePage` helper over `ADMIN_ROUTES`; a11y is scanned on the two
 * highest-traffic admin screens. Guard tests assert that neither an anonymous
 * visitor nor a logged-in-but-non-admin (orgAdmin) can reach `/admin`.
 *
 * Foundation (do not edit): `@/tests/e2e/support/{routes,smoke}` + auth fixtures.
 */

import { test, expect } from '@/tests/fixtures/auth'
import { ADMIN_ROUTES, withLocale } from '@/tests/e2e/support/routes'
import { smokePage, a11yScan, expectLoginRedirect } from '@/tests/e2e/support/smoke'

test.describe('Admin pages — smoke (globalAdminUser)', () => {
  // Data-driven: one resilient smoke test per admin route.
  for (const route of ADMIN_ROUTES) {
    test(`renders ${route.path}`, async ({ globalAdminUser }) => {
      await smokePage(globalAdminUser, route)
    })
  }
})

test.describe('Admin pages — a11y (globalAdminUser)', () => {
  const A11Y_TARGETS = ['/admin', '/admin/organizations']

  for (const path of A11Y_TARGETS) {
    test(`no serious/critical a11y violations on ${path}`, async ({ globalAdminUser }) => {
      await globalAdminUser.goto(withLocale(path), { waitUntil: 'domcontentloaded' })
      await expect(globalAdminUser.locator('main, h1, [role="main"]').first()).toBeVisible({
        timeout: 15000,
      })
      await a11yScan(globalAdminUser)
    })
  }
})

test.describe('Admin access guards', () => {
  test('anonymous visitor is redirected to login from /admin', async ({ page }) => {
    await expectLoginRedirect(page, '/admin')
  })

  test('non-admin (orgAdmin) is redirected away from /admin', async ({ orgAdminUser }) => {
    // Middleware sends authenticated non-global-admins to /login?error=forbidden.
    await orgAdminUser.goto(withLocale('/admin'), { waitUntil: 'domcontentloaded' })
    await expect(orgAdminUser, '/admin must reject a non-global-admin').toHaveURL(/\/login/, {
      timeout: 15000,
    })
  })
})
