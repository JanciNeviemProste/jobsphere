/**
 * Lighthouse CI Performance Tests
 *
 * This test suite runs Lighthouse audits on critical application paths
 * to ensure performance, accessibility, and best practices standards are met.
 *
 * Test URLs:
 * - / (Home page)
 * - /jobs (Jobs listing page)
 *
 * Performance Thresholds:
 * - Performance Score: >80
 * - Accessibility Score: >90
 * - First Contentful Paint (FCP): <2s
 * - Largest Contentful Paint (LCP): <3s
 * - Cumulative Layout Shift (CLS): <0.1
 *
 * Run: yarn lighthouse
 */

import { execSync } from 'child_process'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { ChildProcess } from 'child_process'

interface LighthouseResult {
  categories: {
    performance: { score: number }
    accessibility: { score: number }
    'best-practices': { score: number }
    seo: { score: number }
  }
  audits: {
    'first-contentful-paint': { numericValue: number }
    'largest-contentful-paint': { numericValue: number }
    'cumulative-layout-shift': { numericValue: number }
    'total-blocking-time': { numericValue: number }
    'speed-index': { numericValue: number }
    interactive: { numericValue: number }
  }
}

describe('Lighthouse CI Performance Tests', () => {
  let serverProcess: ChildProcess | null = null

  beforeAll(async () => {
    // Build the application
    console.log('Building application for Lighthouse tests...')
    try {
      execSync('yarn build:skip-verify', {
        cwd: process.cwd(),
        stdio: 'inherit',
        timeout: 300000 // 5 minutes
      })
    } catch (error) {
      console.error('Build failed:', error)
      throw error
    }

    // Start the production server
    console.log('Starting production server...')
    const { spawn } = await import('child_process')
    serverProcess = spawn('yarn', ['start'], {
      cwd: process.cwd(),
      stdio: 'pipe',
      shell: true
    })

    // Wait for server to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server failed to start within 30 seconds'))
      }, 30000)

      serverProcess!.stdout?.on('data', (data: Buffer) => {
        const output = data.toString()
        console.log(output)
        if (output.includes('Ready') || output.includes('started server')) {
          clearTimeout(timeout)
          resolve()
        }
      })

      serverProcess!.stderr?.on('data', (data: Buffer) => {
        console.error(data.toString())
      })

      serverProcess!.on('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
    })

    // Give server extra time to stabilize
    await new Promise(resolve => setTimeout(resolve, 2000))
  }, 360000) // 6 minutes timeout for beforeAll

  afterAll(() => {
    if (serverProcess) {
      console.log('Stopping server...')
      serverProcess.kill()
    }
  })

  describe('Home Page Performance', () => {
    let results: LighthouseResult

    beforeAll(async () => {
      // Run Lighthouse audit on home page
      const output = execSync(
        'npx @lhci/cli@latest autorun --config=../../../lighthouserc.json --url=http://localhost:3000/',
        {
          cwd: process.cwd(),
          encoding: 'utf-8',
          timeout: 120000
        }
      )

      // Parse results (this is simplified - actual implementation would parse JSON output)
      console.log('Lighthouse output:', output)

      // For actual implementation, you would parse the JSON output from Lighthouse
      results = JSON.parse(
        execSync(
          'npx lighthouse http://localhost:3000/ --output=json --quiet --chrome-flags="--headless"',
          { encoding: 'utf-8', timeout: 60000 }
        )
      )
    }, 180000)

    it('should have performance score > 80', () => {
      expect(results.categories.performance.score).toBeGreaterThanOrEqual(0.8)
    })

    it('should have accessibility score > 90', () => {
      expect(results.categories.accessibility.score).toBeGreaterThanOrEqual(0.9)
    })

    it('should have First Contentful Paint < 2s', () => {
      expect(results.audits['first-contentful-paint'].numericValue).toBeLessThan(2000)
    })

    it('should have Largest Contentful Paint < 3s', () => {
      expect(results.audits['largest-contentful-paint'].numericValue).toBeLessThan(3000)
    })

    it('should have Cumulative Layout Shift < 0.1', () => {
      expect(results.audits['cumulative-layout-shift'].numericValue).toBeLessThan(0.1)
    })

    it('should have Total Blocking Time < 300ms', () => {
      expect(results.audits['total-blocking-time'].numericValue).toBeLessThan(300)
    })
  })

  describe('Jobs Listing Page Performance', () => {
    let results: LighthouseResult

    beforeAll(async () => {
      // Run Lighthouse audit on jobs page
      results = JSON.parse(
        execSync(
          'npx lighthouse http://localhost:3000/jobs --output=json --quiet --chrome-flags="--headless"',
          { encoding: 'utf-8', timeout: 60000 }
        )
      )
    }, 180000)

    it('should have performance score > 80', () => {
      expect(results.categories.performance.score).toBeGreaterThanOrEqual(0.8)
    })

    it('should have accessibility score > 90', () => {
      expect(results.categories.accessibility.score).toBeGreaterThanOrEqual(0.9)
    })

    it('should have First Contentful Paint < 2s', () => {
      expect(results.audits['first-contentful-paint'].numericValue).toBeLessThan(2000)
    })

    it('should have Largest Contentful Paint < 3s', () => {
      expect(results.audits['largest-contentful-paint'].numericValue).toBeLessThan(3000)
    })

    it('should have Cumulative Layout Shift < 0.1', () => {
      expect(results.audits['cumulative-layout-shift'].numericValue).toBeLessThan(0.1)
    })

    it('should have Speed Index < 3.5s', () => {
      expect(results.audits['speed-index'].numericValue).toBeLessThan(3500)
    })

    it('should have Time to Interactive < 3.8s', () => {
      expect(results.audits.interactive.numericValue).toBeLessThan(3800)
    })
  })

  describe('Performance Budgets', () => {
    it('should meet best practices score > 80', async () => {
      const results = JSON.parse(
        execSync(
          'npx lighthouse http://localhost:3000/ --output=json --quiet --chrome-flags="--headless"',
          { encoding: 'utf-8', timeout: 60000 }
        )
      )
      expect(results.categories['best-practices'].score).toBeGreaterThanOrEqual(0.8)
    })

    it('should meet SEO score > 80', async () => {
      const results = JSON.parse(
        execSync(
          'npx lighthouse http://localhost:3000/ --output=json --quiet --chrome-flags="--headless"',
          { encoding: 'utf-8', timeout: 60000 }
        )
      )
      expect(results.categories.seo.score).toBeGreaterThanOrEqual(0.8)
    })
  })
})

/**
 * Usage:
 *
 * 1. Run all Lighthouse tests:
 *    yarn test tests/performance/lighthouse.test.ts
 *
 * 2. Run Lighthouse CI:
 *    npx @lhci/cli autorun
 *
 * 3. Run Lighthouse manually:
 *    npx lighthouse http://localhost:3000 --view
 *
 * 4. Generate Lighthouse report:
 *    npx lighthouse http://localhost:3000 --output=html --output-path=./lighthouse-report.html
 *
 * Configuration:
 * - Lighthouse CI config: lighthouserc.json (root directory)
 * - Desktop preset with minimal throttling
 * - 3 runs per URL, median results used
 * - Results uploaded to temporary public storage
 */
