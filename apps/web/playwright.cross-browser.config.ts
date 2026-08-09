import { defineConfig, devices } from '@playwright/test'
import base from './playwright.config'

/**
 * Cross-browser matrix — the nine projects that are NOT part of the PR smoke run.
 *
 * These live here rather than in playwright.config.ts because the default config
 * is what CI runs on every pull request, and it installs only chromium. Declaring
 * webkit/firefox/msedge projects there guaranteed a launch failure on every run
 * regardless of whether the application worked.
 *
 * Driven by .github/workflows/e2e-cross-browser.yml, which shards each project
 * three ways. That workflow must install the browser it selects — `npx playwright
 * install --with-deps <browser>` — since none of them ship with the runner.
 *
 * Note the WebKit dependency: iPhone, iPad and Desktop Safari projects all run on
 * WebKit, and Galaxy S9+/Pixel 5 run on Chromium. Installing "all the browsers a
 * project name suggests" is not the same as installing the engines they use.
 */
export default defineConfig({
  ...base,

  projects: [
    // Desktop
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },

    // Phones
    { name: 'iPhone 12', use: { ...devices['iPhone 12'] } },
    { name: 'iPhone 13 Pro', use: { ...devices['iPhone 13 Pro'] } },
    { name: 'Pixel 5', use: { ...devices['Pixel 5'] } },
    { name: 'Galaxy S9+', use: { ...devices['Galaxy S9+'] } },

    // Tablets
    { name: 'iPad Air', use: { ...devices['iPad (gen 7)'] } },
    { name: 'iPad Mini', use: { ...devices['iPad Mini'] } },
  ],
})
