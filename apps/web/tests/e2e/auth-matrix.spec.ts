/**
 * E2E — authorization redirect matrix (key security coverage).
 *
 * Verifies the app's route guards across roles: anonymous users are bounced to
 * login on every protected prefix, a candidate (no organization) cannot reach the
 * employer or admin areas, an employer/org-admin cannot reach the superadmin area,
 * and only a global admin lands on `/admin`.
 *
 * Assertions are URL-based (resilient to page content) with generous timeouts and
 * `domcontentloaded` navigation so a redirect chain has time to settle.
 */

import { test, expect } from '@/tests/fixtures/auth'
import { expectLoginRedirect } from '@/tests/e2e/support/smoke'
import { PROTECTED_PREFIXES, withLocale } from '@/tests/e2e/support/routes'

const NAV = { waitUntil: 'domcontentloaded' as const }
const URL_TIMEOUT = { timeout: 15000 }

test.describe.configure({ mode: 'parallel' })

test.describe('auth matrix — anonymous', () => {
  for (const p of PROTECTED_PREFIXES) {
    test(`anon ${p.path} -> login`, async ({ page }) => {
      await expectLoginRedirect(page, p.path)
    })
  }
})

test.describe('auth matrix — candidate (no organization)', () => {
  test('candidate on /employer is redirected away from employer', async ({ candidateUser }) => {
    await candidateUser.goto(withLocale('/employer'), NAV)
    // May land on /dashboard?error=no_organization — the invariant is simply
    // "not inside the employer area".
    await expect(candidateUser).not.toHaveURL(/\/employer(\/|$)/, URL_TIMEOUT)
  })

  test('candidate on /admin is forbidden (-> login)', async ({ candidateUser }) => {
    await candidateUser.goto(withLocale('/admin'), NAV)
    await expect(candidateUser).toHaveURL(/\/login/, URL_TIMEOUT)
  })
})

test.describe('auth matrix — employer (org admin)', () => {
  test('employer on /admin is still forbidden (-> login)', async ({ orgAdminUser }) => {
    await orgAdminUser.goto(withLocale('/admin'), NAV)
    await expect(orgAdminUser).toHaveURL(/\/login/, URL_TIMEOUT)
  })

  test('employer on /employer is allowed', async ({ orgAdminUser }) => {
    await orgAdminUser.goto(withLocale('/employer'), NAV)
    await expect(orgAdminUser).toHaveURL(/\/employer/, URL_TIMEOUT)
  })
})

test.describe('auth matrix — global admin', () => {
  test('global admin on /admin is allowed', async ({ globalAdminUser }) => {
    await globalAdminUser.goto(withLocale('/admin'), NAV)
    await expect(globalAdminUser).toHaveURL(/\/admin/, URL_TIMEOUT)
  })
})
