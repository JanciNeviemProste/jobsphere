import { defineConfig, devices } from '@playwright/test'

/**
 * Opt-in VISUAL REGRESSION config — kept separate from the main e2e run so that
 * missing baselines never red the default CI job. Generate/refresh baselines with:
 *   yarn test:e2e:update-snapshots
 * then run/verify with:
 *   yarn test:e2e:visual
 */
export default defineConfig({
  testDir: './tests/e2e/visual',
  testMatch: ['**/*.visual.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'playwright-report/visual', open: 'never' }]],

  globalSetup: require.resolve('./tests/setup/global-setup'),
  globalTeardown: require.resolve('./tests/setup/global-teardown'),

  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  // Tolerate sub-pixel font/antialiasing diffs; freeze animations for stable shots.
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled' },
  },

  timeout: 30 * 1000,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
