/**
 * E2E journey — GDPR / privacy surface for a candidate (resilient, best-effort)
 *
 * `candidateUser`: verifies the privacy/GDPR information pages render, then
 * hunts for any consent/export/download control in the account area
 * (dashboard/profile/settings). The GDPR export & consent flows are currently
 * exposed as API endpoints (`/api/gdpr/{export,consent}`) without a dedicated
 * button, so the control-discovery and export tests degrade gracefully
 * (`test.skip()`) rather than assert UI that may not exist yet. When an export
 * control IS present, the click is expected to trigger a download or a
 * `/api/gdpr/export` response.
 */

import { test, expect } from '@/tests/fixtures/auth'
import type { Page } from '@playwright/test'

const T = 15000

/** Any plausible GDPR/privacy/export/consent control across the account UI. */
function gdprControls(page: Page) {
  return page.getByRole('button', {
    name: /export|download.*data|stiahnu[ťt]|consent|súhlas|delete.*account|gdpr|privacy/i,
  })
}

test.describe('Candidate GDPR / privacy surface', () => {
  test('privacy & GDPR information pages render', async ({ candidateUser }) => {
    for (const path of ['/en/gdpr', '/en/privacy']) {
      await candidateUser.goto(path, { waitUntil: 'domcontentloaded' })
      await expect(
        candidateUser.locator('main, h1, [role="main"]').first(),
        `landmark on ${path}`,
      ).toBeVisible({ timeout: T })
    }
  })

  test('locate GDPR/consent/export controls in the account area', async ({ candidateUser }) => {
    const surfaces = ['/en/dashboard', '/en/dashboard/profile']
    let found = false

    for (const path of surfaces) {
      await candidateUser.goto(path, { waitUntil: 'domcontentloaded' })
      await expect(candidateUser.locator('main, h1, [role="main"]').first()).toBeVisible({
        timeout: T,
      })
      if ((await gdprControls(candidateUser).count()) > 0) {
        found = true
        await expect(gdprControls(candidateUser).first()).toBeVisible({ timeout: T })
        break
      }
    }

    if (!found) {
      test.skip(true, 'No GDPR/consent/export control in the account UI (API-only today)')
    }
  })

  test('export control triggers a download or /api/gdpr/export (best-effort)', async ({
    candidateUser,
  }) => {
    const exportBtn = candidateUser
      .getByRole('button', { name: /export|download.*data|stiahnu[ťt]/i })
      .first()

    await candidateUser.goto('/en/dashboard', { waitUntil: 'domcontentloaded' })
    if (!(await exportBtn.isVisible({ timeout: T }).catch(() => false))) {
      test.skip(true, 'No export control to exercise (export is API-only today)')
      return
    }

    // Race a file download against the export API response — either satisfies.
    const download = candidateUser.waitForEvent('download', { timeout: T }).catch(() => null)
    const apiResponse = candidateUser
      .waitForResponse((r) => /\/api\/gdpr\/export/.test(r.url()), { timeout: T })
      .catch(() => null)

    await exportBtn.click()

    const [dl, resp] = await Promise.all([download, apiResponse])
    expect(
      dl !== null || resp !== null,
      'export should download a file or hit the export API',
    ).toBe(true)
    if (resp) expect(resp.status()).toBeLessThan(400)
  })
})
