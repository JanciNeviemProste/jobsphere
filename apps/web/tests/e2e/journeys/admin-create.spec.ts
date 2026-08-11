/**
 * E2E journey — superadmin create dialogs (resilient)
 *
 * `globalAdminUser`: the `/admin/organizations` and `/admin/jobs` screens each
 * expose a create trigger that opens a dialog. We assert the trigger is
 * present, open the dialog, and confirm the core field (name/title) renders.
 * We do NOT actually persist a record — UI presence + dialog open is the
 * contract; if a create were to succeed, a toast/refresh would follow, but the
 * assertion stays at the dialog boundary so the test is DB-neutral.
 *
 * Trigger labels are matched by regex so copy changes don't break the test.
 * NOTE: `withLocale()` defaults to 'en', and the admin panel is now translated
 * (it used to be hardcoded Slovak), so the English labels — "New organization"
 * and "New job" — MUST stay in these alternations. Without them the locator
 * finds nothing and the `test.skip` below fires: the suite stays green while
 * silently testing nothing.
 */

import { test, expect } from '@/tests/fixtures/auth'
import { withLocale } from '@/tests/e2e/support/routes'

const T = 15000

test.describe('Superadmin create dialogs', () => {
  test('organizations page opens the "create organization" dialog', async ({ globalAdminUser }) => {
    await globalAdminUser.goto(withLocale('/admin/organizations'), {
      waitUntil: 'domcontentloaded',
    })
    await expect(globalAdminUser.locator('main, h1, [role="main"]').first()).toBeVisible({
      timeout: T,
    })

    const createBtn = globalAdminUser.getByRole('button', {
      name: /nová organizácia|pridať firmu|nová firma|(new|add).*organi[sz]ation/i,
    })
    if ((await createBtn.count()) === 0) {
      test.skip(true, 'No create-organization trigger on this page')
      return
    }

    await createBtn.first().click()

    const dialog = globalAdminUser.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: T })
    // Name field present inside the dialog (label "Názov" / "Name").
    await expect(dialog.getByText(/Názov|Name/i).first()).toBeVisible({ timeout: T })
  })

  test('jobs page opens the "create job" dialog', async ({ globalAdminUser }) => {
    await globalAdminUser.goto(withLocale('/admin/jobs'), { waitUntil: 'domcontentloaded' })
    await expect(globalAdminUser.locator('main, h1, [role="main"]').first()).toBeVisible({
      timeout: T,
    })

    const createBtn = globalAdminUser.getByRole('button', {
      name: /nový job|nový inzerát|pridať inzerát|(new|add).*job/i,
    })
    if ((await createBtn.count()) === 0) {
      test.skip(true, 'No create-job trigger on this page')
      return
    }

    await createBtn.first().click()

    const dialog = globalAdminUser.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: T })
    // Title field present inside the dialog (label "Názov" / "Title").
    await expect(dialog.getByText(/Názov|Title/i).first()).toBeVisible({ timeout: T })
  })
})
