#!/usr/bin/env node

/**
 * Verify Cross-Browser Testing Setup
 *
 * This script validates that the Playwright configuration includes all required
 * browser and device configurations for comprehensive cross-browser testing.
 */

const fs = require('fs')
const path = require('path')

const CONFIG_PATH = path.join(__dirname, '..', 'playwright.config.ts')
const REQUIRED_BROWSERS = [
  'chromium',
  'firefox',
  'webkit',
  'edge'
]
const REQUIRED_MOBILE = [
  'iPhone 12',
  'iPhone 13 Pro',
  'Pixel 5',
  'Galaxy S9+'
]
const REQUIRED_TABLETS = [
  'iPad Air',
  'iPad Mini'
]

function verifyConfiguration() {
  console.log('🔍 Verifying Cross-Browser Testing Setup...\n')

  // Check if config file exists
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('❌ Error: playwright.config.ts not found')
    process.exit(1)
  }

  // Read config file
  const configContent = fs.readFileSync(CONFIG_PATH, 'utf-8')

  let errors = []
  let warnings = []
  let passed = 0

  // Check for video recording
  if (configContent.includes("video: 'retain-on-failure'")) {
    console.log('✅ Video recording on failure: ENABLED')
    passed++
  } else {
    errors.push('Video recording on failure not configured')
  }

  // Check for screenshot
  if (configContent.includes("screenshot: 'only-on-failure'")) {
    console.log('✅ Screenshot on failure: ENABLED')
    passed++
  } else {
    warnings.push('Screenshot on failure not configured')
  }

  // Check for timeout configuration
  if (configContent.includes('timeout:') && configContent.includes('30 * 1000')) {
    console.log('✅ Test timeout: 30 seconds')
    passed++
  } else {
    warnings.push('Test timeout not set to 30 seconds')
  }

  // Check for expect timeout
  if (configContent.includes('expect:') && configContent.includes('timeout: 5000')) {
    console.log('✅ Assertion timeout: 5 seconds')
    passed++
  } else {
    warnings.push('Assertion timeout not configured')
  }

  console.log('\n📱 Checking Browser Configurations...\n')

  // Check desktop browsers
  console.log('Desktop Browsers:')
  REQUIRED_BROWSERS.forEach(browser => {
    if (configContent.includes(`name: '${browser}'`)) {
      console.log(`  ✅ ${browser}`)
      passed++
    } else {
      errors.push(`Desktop browser not configured: ${browser}`)
      console.log(`  ❌ ${browser}`)
    }
  })

  // Check mobile devices
  console.log('\nMobile Devices:')
  REQUIRED_MOBILE.forEach(device => {
    if (configContent.includes(`name: '${device}'`)) {
      console.log(`  ✅ ${device}`)
      passed++
    } else {
      errors.push(`Mobile device not configured: ${device}`)
      console.log(`  ❌ ${device}`)
    }
  })

  // Check tablets
  console.log('\nTablets:')
  REQUIRED_TABLETS.forEach(tablet => {
    if (configContent.includes(`name: '${tablet}'`)) {
      console.log(`  ✅ ${tablet}`)
      passed++
    } else {
      errors.push(`Tablet not configured: ${tablet}`)
      console.log(`  ❌ ${tablet}`)
    }
  })

  // Check for Edge specific configuration
  if (configContent.includes("channel: 'msedge'")) {
    console.log('\n✅ Edge browser channel: Correctly configured')
    passed++
  } else {
    warnings.push("Edge browser channel not set to 'msedge'")
  }

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('📊 Summary\n')
  console.log(`Total Checks: ${passed + errors.length + warnings.length}`)
  console.log(`✅ Passed: ${passed}`)
  console.log(`⚠️  Warnings: ${warnings.length}`)
  console.log(`❌ Errors: ${errors.length}`)

  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:')
    warnings.forEach(w => console.log(`  - ${w}`))
  }

  if (errors.length > 0) {
    console.log('\n❌ Errors:')
    errors.forEach(e => console.log(`  - ${e}`))
    console.log('\n❌ Configuration verification FAILED')
    process.exit(1)
  }

  // Check for test files
  console.log('\n📝 Checking Test Files...\n')

  const testFiles = [
    'tests/e2e/responsive.spec.ts',
    'tests/config/browsers.md',
    'tests/config/quick-reference.md',
    'tests/CROSS_BROWSER_TESTING.md'
  ]

  testFiles.forEach(file => {
    const filePath = path.join(__dirname, '..', file)
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${file}`)
    } else {
      console.log(`❌ ${file} - NOT FOUND`)
      errors.push(`Test file missing: ${file}`)
    }
  })

  // Check for CI workflow
  const workflowPath = path.join(__dirname, '..', '..', '..', '.github', 'workflows', 'e2e-cross-browser.yml')
  if (fs.existsSync(workflowPath)) {
    console.log('✅ .github/workflows/e2e-cross-browser.yml')
  } else {
    console.log('❌ .github/workflows/e2e-cross-browser.yml - NOT FOUND')
    errors.push('CI workflow file missing')
  }

  if (errors.length > 0) {
    console.log('\n❌ Setup verification FAILED')
    process.exit(1)
  }

  console.log('\n✅ All checks passed! Cross-browser testing is ready to use.')
  console.log('\n📖 Quick start:')
  console.log('  1. Install browsers: npx playwright install --with-deps')
  console.log('  2. Run tests: yarn test:e2e')
  console.log('  3. Run with UI: npx playwright test --ui')
  console.log('\n📚 See tests/config/quick-reference.md for more commands')
}

// Run verification
verifyConfiguration()
