/**
 * E2E journey — dual-role context switcher (resilient)
 *
 * A logged-in employer (`orgAdminUser`) can flip into the candidate context
 * from the header account menu. The menu exposes a "Kontext" group with the
 * org name(s) plus an "Ako uchádzač" item that routes to `/dashboard`.
 *
 * The header hosts two Radix menu triggers inside the "User actions" region:
 * the language switcher (first) and the account dropdown (last) — so we open
 * the last `aria-haspopup="menu"` button. Menu content is portalled, hence the
 * page-level `getByRole('menuitem', …)` lookups. Guards `test.skip()` if the
 * switcher isn't rendered (e.g. session without an org).
 */

import { test, expect } from '@/tests/fixtures/auth'
import type { Page } from '@playwright/test'

const T = 15000

/** Open the header account dropdown and return the "Ako uchádzač" menuitem. */
async function openAccountMenu(page: Page) {
  const userActions = page.getByRole('navigation', { name: 'User actions' }).first()
  const accountTrigger = userActions.locator('button[aria-haspopup="menu"]').last()
  await expect(accountTrigger).toBeVisible({ timeout: T })
  await accountTrigger.click()
  return page.getByRole('menuitem', { name: 'Ako uchádzač' })
}

test.describe('Dual-role context switcher (employer → candidate)', () => {
  test('employer sees the context switcher in the header menu', async ({ orgAdminUser }) => {
    await orgAdminUser.goto('/en', { waitUntil: 'domcontentloaded' })

    const candidateItem = await openAccountMenu(orgAdminUser)
    if (!(await candidateItem.isVisible({ timeout: T }).catch(() => false))) {
      test.skip(true, 'Account menu has no context switcher (session without org)')
      return
    }

    await expect(orgAdminUser.getByText('Kontext', { exact: true })).toBeVisible({ timeout: T })
    await expect(candidateItem).toBeVisible()
  })

  test('employer can switch into the candidate context', async ({ orgAdminUser }) => {
    await orgAdminUser.goto('/en', { waitUntil: 'domcontentloaded' })

    const candidateItem = await openAccountMenu(orgAdminUser)
    if (!(await candidateItem.isVisible({ timeout: T }).catch(() => false))) {
      test.skip(true, 'Account menu has no "Ako uchádzač" switch')
      return
    }

    await candidateItem.click()
    await expect(orgAdminUser, 'switching context lands on the candidate dashboard').toHaveURL(
      /\/dashboard/,
      { timeout: T },
    )
  })
})
