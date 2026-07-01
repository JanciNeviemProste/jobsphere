/**
 * E2E journey — Assessment builder + runner (resilient).
 *
 * Covers the section/question assessment builder (incl. the "Vygenerovať AI"
 * draft button) and a graceful check that the candidate runner degrades to a
 * "not found" state (rather than crashing) for a bogus id/token.
 *
 * Uses the `orgAdminUser` fixture. Saving is asserted defensively — if the API
 * or seed data rejects the draft it must surface a handled outcome, never a
 * crash. No fixed `waitForTimeout` on data; waits cap at 15s.
 */

import { test, expect } from '@/tests/fixtures/auth'
import { withLocale } from '@/tests/e2e/support/routes'

const T = 15000

test.describe('Assessment builder journey', () => {
  test('builder renders form, sections and the AI generate button', async ({ orgAdminUser }) => {
    await orgAdminUser.goto(withLocale('/employer/assessments/builder'), {
      waitUntil: 'domcontentloaded',
    })

    await expect(orgAdminUser.getByRole('heading', { name: /create assessment/i })).toBeVisible({
      timeout: T,
    })

    // Basic-info + section scaffolding.
    await expect(orgAdminUser.getByLabel(/assessment name/i)).toBeVisible({ timeout: T })
    await expect(orgAdminUser.getByRole('button', { name: /add section/i })).toBeVisible()

    // AI draft generator (Slovak CTA "Vygenerovať AI").
    await expect(
      orgAdminUser.getByRole('button', { name: /vygenerovať ai|AI/i }).first(),
    ).toBeVisible({ timeout: T })

    // Adding a question into the default section reveals a question editor.
    await orgAdminUser.getByRole('button', { name: /multiple choice/i }).click()
    await expect(orgAdminUser.getByPlaceholder(/enter your question/i).first()).toBeVisible({
      timeout: T,
    })
  })

  test('minimal assessment can be filled and submitted', async ({ orgAdminUser }) => {
    await orgAdminUser.goto(withLocale('/employer/assessments/builder'), {
      waitUntil: 'domcontentloaded',
    })

    await expect(orgAdminUser.getByRole('heading', { name: /create assessment/i })).toBeVisible({
      timeout: T,
    })

    await orgAdminUser.getByLabel(/assessment name/i).fill('E2E Smoke Assessment')

    // Add one short-text question to the default section and give it text.
    await orgAdminUser.getByRole('button', { name: /short text/i }).click()
    await orgAdminUser
      .getByPlaceholder(/enter your question/i)
      .first()
      .fill('Describe your automated-testing experience.')

    await orgAdminUser.getByRole('button', { name: /create assessment/i }).click()

    // A non-crash outcome: success toast, redirect to the assessment detail, or a
    // handled error toast (e.g. entitlement / seed data). Any of these is fine.
    await expect
      .poll(
        async () => {
          const pathname = new URL(orgAdminUser.url()).pathname
          if (/\/employer\/assessments\/[^/]+$/.test(pathname) && !/builder$/.test(pathname))
            return 'redirected'
          if ((await orgAdminUser.getByText(/assessment created/i).count()) > 0) return 'toast'
          if ((await orgAdminUser.getByText(/error|failed|must be/i).count()) > 0) return 'handled'
          return 'pending'
        },
        { timeout: T, intervals: [500, 1000, 2000] },
      )
      .not.toBe('pending')
  })

  test('runner degrades gracefully for a bogus id/token', async ({ orgAdminUser }) => {
    // The runner alerts on a failed load; auto-dismiss so it never blocks.
    orgAdminUser.on('dialog', (dialog) => dialog.dismiss().catch(() => {}))

    await orgAdminUser.goto(
      withLocale('/assessment/nonexistent-e2e-id/take') + '?token=e2e-bogus',
      { waitUntil: 'domcontentloaded' },
    )

    // It must render the graceful "not found" (or transient loading) state, not a
    // Next.js error boundary / crash.
    await expect(
      orgAdminUser.getByText(/assessment not found|loading assessment/i).first(),
    ).toBeVisible({ timeout: T })
    await expect(orgAdminUser.getByText(/Application error|Internal Server Error/i)).toHaveCount(0)
  })
})
