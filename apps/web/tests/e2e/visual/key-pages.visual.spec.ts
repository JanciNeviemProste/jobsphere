/**
 * Visual-regression baselines for key pages (opt-in — playwright.visual.config.ts).
 *
 * Baselines are generated once with `yarn test:e2e:update-snapshots` and then
 * committed; subsequent runs (`yarn test:e2e:visual`) fail on visual diffs.
 * Dynamic content (times, images, avatars) is masked so snapshots stay stable.
 */

import { test, expect } from '@/tests/fixtures/auth'
import { VISUAL_ROUTES, withLocale, type RouteDef } from '@/tests/e2e/support/routes'
import type { Page } from '@playwright/test'

function masks(page: Page) {
  return [page.locator('time'), page.locator('img'), page.locator('video')]
}

async function snapshot(page: Page, route: RouteDef) {
  await page.goto(withLocale(route.path), { waitUntil: 'domcontentloaded' })
  // Settle async content before the shot.
  await page.waitForLoadState('networkidle').catch(() => {})
  const name = `${route.path === '/' ? 'home' : route.path.replace(/^\//, '').replace(/\//g, '_')}.png`
  await expect(page).toHaveScreenshot(name, {
    fullPage: true,
    mask: masks(page),
    animations: 'disabled',
  })
}

const byRole = (role: RouteDef['minRole']) => VISUAL_ROUTES.filter((r) => r.minRole === role)

test.describe('visual: public', () => {
  for (const route of byRole('anon')) {
    test(`snapshot ${route.path}`, async ({ page }) => snapshot(page, route))
  }
})

test.describe('visual: candidate', () => {
  for (const route of byRole('candidate')) {
    test(`snapshot ${route.path}`, async ({ candidateUser }) => snapshot(candidateUser, route))
  }
})

test.describe('visual: employer', () => {
  for (const route of byRole('employer')) {
    test(`snapshot ${route.path}`, async ({ orgAdminUser }) => snapshot(orgAdminUser, route))
  }
})

test.describe('visual: admin', () => {
  for (const route of byRole('admin')) {
    test(`snapshot ${route.path}`, async ({ globalAdminUser }) => snapshot(globalAdminUser, route))
  }
})
