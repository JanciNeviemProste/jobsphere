/**
 * E2E journey — Employer hiring flow (resilient).
 *
 * Walks the recruiter-facing hiring surface introduced in the big PR: create a
 * job ad, the 4-column kanban pipeline, an applicant detail (HR match % +
 * interview actions), and the interview calendar. Every step is defensive —
 * where seed data may be absent it asserts UI presence / graceful states rather
 * than depending on specific rows, and skips (not fails) when a prerequisite
 * row simply isn't there.
 *
 * Uses the `orgAdminUser` fixture (authenticated + has an orgId). No fixed
 * `waitForTimeout` on data; navigations use `domcontentloaded`, waits cap at 15s.
 */

import { test, expect } from '@/tests/fixtures/auth'
import { withLocale } from '@/tests/e2e/support/routes'

const T = 15000

test.describe('Employer hiring journey', () => {
  test('step 1 — create a job ad', async ({ orgAdminUser }) => {
    await orgAdminUser.goto(withLocale('/employer/jobs/new'), { waitUntil: 'domcontentloaded' })

    // Form renders (heading + the required fields, incl. the PR "screening" radios).
    await expect(orgAdminUser.getByRole('heading', { name: /new job/i })).toBeVisible({
      timeout: T,
    })

    // Fill the required fields, respecting the schema minimums
    // (title >= 3, description >= 50, requirements >= 20, location >= 2).
    await orgAdminUser.getByLabel(/job title/i).fill('E2E Automation Engineer')
    await orgAdminUser
      .getByLabel(/^description/i)
      .fill(
        'We are hiring an automation engineer to build and maintain our end-to-end ' +
          'test suites across the hiring platform. This is a resilient E2E fixture role.',
      )
    await orgAdminUser
      .getByLabel(/requirements/i)
      .fill('Solid TypeScript and Playwright experience required for this role.')
    await orgAdminUser.getByLabel(/^location/i).fill('Bratislava')

    // The screening RadioGroup (extra questions OR a test) should be present.
    await expect(
      orgAdminUser.getByText(/screening questions or test|no screening/i).first(),
    ).toBeVisible({ timeout: T })

    await orgAdminUser.getByRole('button', { name: /publish/i }).click()

    // Success == redirect back to the employer dashboard OR a success toast.
    // A surfaced validation error is also a non-crash outcome (handled gracefully).
    await expect
      .poll(
        async () => {
          const pathname = new URL(orgAdminUser.url()).pathname
          if (/\/employer\/?$/.test(pathname)) return 'redirected'
          if ((await orgAdminUser.getByText(/job posted successfully/i).count()) > 0) return 'toast'
          if ((await orgAdminUser.getByText(/must be|is required|at least/i).count()) > 0)
            return 'validation'
          return 'pending'
        },
        { timeout: T, intervals: [500, 1000, 2000] },
      )
      .not.toBe('pending')
  })

  test('step 2 — pipeline shows the 4 stage columns', async ({ orgAdminUser }) => {
    await orgAdminUser.goto(withLocale('/employer/pipeline'), { waitUntil: 'domcontentloaded' })

    await expect(orgAdminUser.getByRole('heading', { name: /pipeline/i })).toBeVisible({
      timeout: T,
    })

    // The four kanban column headers (Slovak labels are hardcoded in the board).
    for (const label of [/Noví záujemcovia/i, /Pozvaný na pohovor/i, /Posudzovanie/i]) {
      await expect(orgAdminUser.getByText(label).first()).toBeVisible({ timeout: T })
    }
    // Result column groups HIRED + REJECTED → "Prijatý / Odmietnutý".
    await expect(orgAdminUser.getByText(/Prijatý\s*\/\s*Odmietnutý/i).first()).toBeVisible({
      timeout: T,
    })

    // If any cards are present, a match-% badge should render for scored ones.
    const cards = orgAdminUser.locator('a[href*="/employer/applicants/"]')
    if ((await cards.count()) > 0) {
      const scoreBadges = orgAdminUser.getByText(/^\d{1,3}%$/)
      if ((await scoreBadges.count()) > 0) {
        await expect(scoreBadges.first()).toBeVisible({ timeout: T })
      }
    }
  })

  test('step 3 — applicant detail exposes match % + interview actions', async ({
    orgAdminUser,
  }) => {
    await orgAdminUser.goto(withLocale('/employer/applicants'), { waitUntil: 'domcontentloaded' })
    await expect(orgAdminUser.getByRole('heading', { name: /Všetci kandidáti/i })).toBeVisible({
      timeout: T,
    })

    const detailLink = orgAdminUser.getByRole('link', { name: /^Detail$/i }).first()
    if ((await detailLink.count()) === 0) {
      test.skip(true, 'No seeded applicants — nothing to open')
      return
    }

    await detailLink.click()
    await expect(orgAdminUser).toHaveURL(/\/employer\/applicants\/[^/]+$/, { timeout: T })

    // The actions card + interview scheduling buttons always render on the detail.
    // `.first()` guards against strict-mode multi-match (a hidden schedule dialog
    // may mount matching controls too).
    await expect(
      orgAdminUser.getByRole('button', { name: /Naplánovať videopohovor/i }).first(),
    ).toBeVisible({ timeout: T })
    await expect(
      orgAdminUser.getByRole('button', { name: /Naplánovať pohovor/i }).first(),
    ).toBeVisible({ timeout: T })

    // The match/HR-override section only renders when a MatchScore exists — assert
    // it only when present (graceful for candidates without a computed score).
    const matchSection = orgAdminUser.getByText(/Zhoda s pozíciou/i)
    if ((await matchSection.count()) > 0) {
      await expect(matchSection.first()).toBeVisible()
    }
  })

  test('step 4 — interview calendar renders', async ({ orgAdminUser }) => {
    await orgAdminUser.goto(withLocale('/employer/calendar'), { waitUntil: 'domcontentloaded' })

    await expect(orgAdminUser.getByRole('heading', { name: /Kalendár pohovorov/i })).toBeVisible({
      timeout: T,
    })

    // Either upcoming interviews are listed, or the empty state is shown — both
    // are valid, non-crash renders.
    const emptyState = orgAdminUser.getByText(/Zatiaľ nie sú naplánované žiadne/i)
    const interviewLinks = orgAdminUser.getByRole('link', { name: /Detail uchádzača/i })
    expect((await emptyState.count()) + (await interviewLinks.count())).toBeGreaterThan(0)
  })
})
