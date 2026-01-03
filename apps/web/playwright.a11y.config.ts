import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright Configuration for Accessibility Tests
 *
 * This configuration is specifically for running axe-core accessibility tests.
 * We run these tests only on Chromium to avoid redundant checks, as accessibility
 * violations are typically not browser-specific.
 */
export default defineConfig({
  testDir: './tests/a11y',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report-a11y' }],
    ['json', { outputFile: 'test-results-a11y.json' }],
    ['list'],
  ],

  // Global setup and teardown
  globalSetup: require.resolve('./tests/setup/global-setup'),
  globalTeardown: require.resolve('./tests/setup/global-teardown'),

  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Default timeout for actions (e.g., click, fill)
    actionTimeout: 10000,
    // Default timeout for navigation
    navigationTimeout: 30000,
  },

  timeout: 60 * 1000, // 60 seconds per test (axe scans can take longer)
  expect: {
    timeout: 10000, // 10 seconds for assertions
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to run accessibility tests on multiple browsers
    // Note: This will increase test execution time significantly
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
