#!/usr/bin/env tsx
/**
 * Verification script for Playwright E2E test setup
 *
 * This script verifies that all components of the E2E testing
 * infrastructure are properly configured:
 * - Test users are defined
 * - Fixtures are properly structured
 * - Global setup/teardown scripts exist
 * - Auth directory exists
 * - Playwright config is correct
 *
 * Run this script to verify your setup:
 *   npx tsx tests/verify-setup.ts
 */

import fs from 'fs'
import path from 'path'

const checks: Array<{ name: string; pass: boolean; message?: string }> = []

function check(name: string, condition: boolean, message?: string) {
  checks.push({ name, pass: condition, message })
}

console.log('\n🔍 Verifying Playwright E2E test setup...\n')

// Check 1: Test user helpers exist
const testUsersPath = path.join(__dirname, 'helpers', 'test-users.ts')
check(
  'Test user helpers',
  fs.existsSync(testUsersPath),
  `File: ${testUsersPath}`
)

// Check 2: Auth fixtures exist
const authFixturesPath = path.join(__dirname, 'fixtures', 'auth.ts')
check(
  'Auth fixtures',
  fs.existsSync(authFixturesPath),
  `File: ${authFixturesPath}`
)

// Check 3: Global setup exists
const globalSetupPath = path.join(__dirname, 'setup', 'global-setup.ts')
check(
  'Global setup',
  fs.existsSync(globalSetupPath),
  `File: ${globalSetupPath}`
)

// Check 4: Global teardown exists
const globalTeardownPath = path.join(__dirname, 'setup', 'global-teardown.ts')
check(
  'Global teardown',
  fs.existsSync(globalTeardownPath),
  `File: ${globalTeardownPath}`
)

// Check 5: Auth directory exists
const authDir = path.join(__dirname, '..', 'playwright', '.auth')
check('Auth directory', fs.existsSync(authDir), `Directory: ${authDir}`)

// Check 6: Playwright config exists and references setup
const playwrightConfigPath = path.join(__dirname, '..', 'playwright.config.ts')
const configExists = fs.existsSync(playwrightConfigPath)
check('Playwright config', configExists, `File: ${playwrightConfigPath}`)

if (configExists) {
  const configContent = fs.readFileSync(playwrightConfigPath, 'utf-8')
  check(
    'Config has globalSetup',
    configContent.includes('globalSetup'),
    'Playwright config includes globalSetup'
  )
  check(
    'Config has globalTeardown',
    configContent.includes('globalTeardown'),
    'Playwright config includes globalTeardown'
  )
}

// Check 7: Example test exists
const exampleTestPath = path.join(
  __dirname,
  'e2e',
  'auth-fixtures.example.spec.ts'
)
check('Example test', fs.existsSync(exampleTestPath), `File: ${exampleTestPath}`)

// Check 8: .gitignore updated
const gitignorePath = path.join(__dirname, '..', '..', '..', '.gitignore')
if (fs.existsSync(gitignorePath)) {
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8')
  check(
    'Auth files in .gitignore',
    gitignoreContent.includes('playwright/.auth'),
    'Auth state files are gitignored'
  )
}

// Check 9: Required dependencies in package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json')
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
  check(
    '@playwright/test installed',
    !!packageJson.devDependencies?.['@playwright/test'],
    'Playwright test framework is installed'
  )
  check(
    'bcryptjs installed',
    !!packageJson.dependencies?.['bcryptjs'],
    'bcryptjs for password hashing is installed'
  )
}

// Check 10: README documentation exists
const fixturesReadmePath = path.join(__dirname, 'fixtures', 'README.md')
check(
  'Fixtures README',
  fs.existsSync(fixturesReadmePath),
  `File: ${fixturesReadmePath}`
)

const testingGuidePath = path.join(__dirname, 'TESTING.md')
check(
  'Testing guide',
  fs.existsSync(testingGuidePath),
  `File: ${testingGuidePath}`
)

// Print results
console.log('Results:')
console.log('--------\n')

let allPassed = true
for (const result of checks) {
  const icon = result.pass ? '✅' : '❌'
  console.log(`${icon} ${result.name}`)
  if (result.message) {
    console.log(`   ${result.message}`)
  }
  if (!result.pass) {
    allPassed = false
  }
  console.log()
}

// Summary
console.log('Summary:')
console.log('--------')
const passedCount = checks.filter((c) => c.pass).length
const totalCount = checks.length
console.log(`${passedCount}/${totalCount} checks passed\n`)

if (allPassed) {
  console.log('✅ All checks passed! Your E2E test setup is ready.\n')
  console.log('Next steps:')
  console.log('1. Ensure your dev server is running: yarn dev')
  console.log('2. Run global setup: npx playwright test --global-setup-only')
  console.log('3. Run tests: yarn test:e2e\n')
  process.exit(0)
} else {
  console.log('❌ Some checks failed. Please fix the issues above.\n')
  console.log(
    'Refer to tests/TESTING.md for setup instructions.\n'
  )
  process.exit(1)
}
