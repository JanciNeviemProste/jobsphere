# E2E Testing Guide for JobSphere

This document provides a comprehensive guide to E2E testing in the JobSphere ATS platform using Playwright.

## Quick Start

### Setup

1. Ensure the development server is running:
   ```bash
   yarn dev
   ```

2. Run E2E tests:
   ```bash
   yarn test:e2e
   ```

The first time you run tests, the global setup will:
- Seed test users in the database
- Login each user and save authentication state
- This takes ~30 seconds but only happens once

### Subsequent Test Runs

Once authentication state is saved, tests run much faster (no repeated logins).

## Test User Roles

The system provides 5 pre-authenticated test users:

| Fixture Name | Role | Email | Organization |
|-------------|------|-------|--------------|
| `candidateUser` | CANDIDATE | candidate@test.jobsphere.com | None |
| `recruiterUser` | RECRUITER | recruiter@test.jobsphere.com | Test Org Inc |
| `orgAdminUser` | ORG_ADMIN | admin@test.jobsphere.com | Test Org Inc |
| `hiringManagerUser` | HIRING_MANAGER | hiring-manager@test.jobsphere.com | Test Org Inc |
| `agencyUser` | AGENCY | agency@test.jobsphere.com | Test Org Inc |

All test users share the password: `TestPassword123!`

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '@/tests/fixtures/auth'

test('recruiter can create job posting', async ({ recruiterUser }) => {
  // Navigate to create job page
  await recruiterUser.goto('/en/employer/jobs/new')

  // Fill out job form
  await recruiterUser.fill('#title', 'Senior Software Engineer')
  await recruiterUser.fill('#description', 'Build scalable systems')
  await recruiterUser.selectOption('#employmentType', 'FULL_TIME')

  // Submit form
  await recruiterUser.click('button[type="submit"]')

  // Verify success
  await expect(recruiterUser).toHaveURL(/\/employer\/jobs\//)
  await expect(recruiterUser.locator('text=Job created')).toBeVisible()
})
```

### Testing Authorization

```typescript
test('candidate cannot access employer routes', async ({ candidateUser }) => {
  // Attempt to access employer-only route
  await candidateUser.goto('/en/employer/jobs/new')

  // Should be redirected or see error
  await expect(candidateUser).not.toHaveURL(/\/employer/)
})

test('recruiter can access employer routes', async ({ recruiterUser }) => {
  await recruiterUser.goto('/en/employer')
  await expect(recruiterUser).toHaveURL(/\/employer/)
})
```

### Multi-Role Workflows

```typescript
test('end-to-end application workflow', async ({
  recruiterUser,
  candidateUser,
}) => {
  // Step 1: Recruiter creates job
  await recruiterUser.goto('/en/employer/jobs/new')
  await recruiterUser.fill('#title', 'UX Designer')
  await recruiterUser.click('button[type="submit"]')

  // Get job ID from URL
  const jobUrl = recruiterUser.url()
  const jobId = jobUrl.split('/').pop()

  // Step 2: Candidate applies
  await candidateUser.goto(`/en/jobs/${jobId}`)
  await candidateUser.click('text=Apply Now')
  await candidateUser.fill('#coverLetter', 'I would love to join your team')
  await candidateUser.click('button[type="submit"]')

  // Step 3: Recruiter reviews application
  await recruiterUser.goto('/en/employer/applications')
  await expect(recruiterUser.locator('text=Test Candidate')).toBeVisible()
})
```

### Using Context Factory

For advanced scenarios with dynamic role creation:

```typescript
test('compare different role views', async ({ createAuthenticatedContext }) => {
  // Create multiple contexts
  const { page: recruiter } = await createAuthenticatedContext('recruiter')
  const { page: admin } = await createAuthenticatedContext('orgAdmin')

  // Each has different permissions
  await recruiter.goto('/en/employer/jobs')
  await admin.goto('/en/employer/settings')

  // Contexts auto-close after test
})
```

## Test Organization

### File Structure

```
tests/
├── e2e/                          # E2E test files
│   ├── auth.spec.ts              # Authentication tests
│   ├── jobs.spec.ts              # Job CRUD tests
│   ├── applications.spec.ts      # Application workflow tests
│   └── auth-fixtures.example.spec.ts  # Example/reference tests
├── fixtures/                     # Playwright fixtures
│   ├── auth.ts                   # Auth fixtures (main)
│   └── README.md                 # Fixture documentation
├── helpers/                      # Test utilities
│   ├── test-users.ts             # User factory functions
│   └── factories.ts              # Mock data factories
├── setup/                        # Global setup/teardown
│   ├── global-setup.ts           # Database seeding, auth state
│   └── global-teardown.ts        # Cleanup
└── TESTING.md                    # This file
```

### Naming Conventions

- Test files: `*.spec.ts` or `*.test.ts`
- Describe blocks: Use clear, hierarchical descriptions
- Test names: Should read as complete sentences

```typescript
test.describe('Job Management', () => {
  test.describe('Creating Jobs', () => {
    test('recruiter can create a new job posting', async ({ recruiterUser }) => {
      // ...
    })

    test('validates required fields', async ({ recruiterUser }) => {
      // ...
    })
  })
})
```

## Running Tests

### All Tests

```bash
yarn test:e2e
```

### Specific File

```bash
yarn test:e2e jobs.spec.ts
```

### Specific Test

```bash
yarn test:e2e -g "recruiter can create job"
```

### With UI (Interactive Mode)

```bash
yarn test:e2e:ui
```

This opens Playwright's UI where you can:
- Run tests visually
- Inspect DOM during test execution
- Time-travel through test steps
- Debug failures

### Debug Mode

```bash
yarn test:e2e:debug
```

Runs tests with the Playwright inspector for step-by-step debugging.

### Headed Mode (See Browser)

```bash
yarn test:e2e:headed
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: yarn install

      - name: Setup test database
        run: |
          docker-compose up -d postgres
          yarn db:push

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: yarn test:e2e
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/jobsphere_test

      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## Best Practices

### 1. Use Fixtures for Authentication

**Good:**
```typescript
test('create job', async ({ recruiterUser }) => {
  await recruiterUser.goto('/en/employer/jobs/new')
})
```

**Bad:**
```typescript
test('create job', async ({ page }) => {
  // DON'T manually login in each test
  await page.goto('/en/login')
  await page.fill('input[type="email"]', 'recruiter@test.com')
  await page.fill('input[type="password"]', 'password')
  await page.click('button[type="submit"]')
  await page.goto('/en/employer/jobs/new')
})
```

### 2. Use Locators Over Selectors

**Good:**
```typescript
await page.locator('button', { hasText: 'Submit' }).click()
await page.locator('[data-testid="job-form"]').fill('...')
```

**Bad:**
```typescript
await page.click('.btn.btn-primary.submit-btn')  // Fragile CSS selector
```

### 3. Wait for Navigation/Actions

**Good:**
```typescript
await page.click('text=Apply')
await page.waitForURL(/\/applications\//)
```

**Bad:**
```typescript
await page.click('text=Apply')
// Assuming navigation completed - may cause flakiness
```

### 4. Use Data Test IDs

Add `data-testid` attributes to critical elements:

```tsx
<button type="submit" data-testid="submit-job-form">
  Create Job
</button>
```

```typescript
await page.locator('[data-testid="submit-job-form"]').click()
```

### 5. Avoid Hard-Coded Waits

**Good:**
```typescript
await page.waitForSelector('[data-testid="job-list"]')
await expect(page.locator('text=Software Engineer')).toBeVisible()
```

**Bad:**
```typescript
await page.waitForTimeout(3000)  // Arbitrary wait
```

### 6. Cleanup After Tests

If your test creates data, consider cleanup:

```typescript
test('create and delete job', async ({ recruiterUser }) => {
  // Create job
  await recruiterUser.goto('/en/employer/jobs/new')
  await recruiterUser.fill('#title', 'Temp Job')
  await recruiterUser.click('button[type="submit"]')

  const jobId = recruiterUser.url().split('/').pop()

  // Test logic...

  // Cleanup
  await recruiterUser.goto(`/en/employer/jobs/${jobId}`)
  await recruiterUser.click('[data-testid="delete-job"]')
})
```

## Debugging Tips

### 1. Use Playwright Inspector

```bash
yarn test:e2e:debug
```

Step through tests line by line, inspect elements, and see console logs.

### 2. Screenshots on Failure

Playwright automatically takes screenshots on failure. Find them in:
```
test-results/
```

### 3. Video Recording

Enable video recording in `playwright.config.ts`:

```typescript
use: {
  video: 'retain-on-failure',
}
```

### 4. Console Logs

Capture browser console logs:

```typescript
test('my test', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER:', msg.text()))

  await page.goto('/en/employer')
})
```

### 5. Pause Execution

Pause test to inspect state:

```typescript
test('debug test', async ({ page }) => {
  await page.goto('/en/employer')
  await page.pause()  // Opens Playwright inspector
})
```

## Troubleshooting

### Problem: "Auth state file not found"

**Solution:**
```bash
# Re-run global setup
npx playwright test --global-setup-only
```

### Problem: "Test user not found in database"

**Cause:** Global setup didn't run or failed

**Solution:**
1. Check database connection (DATABASE_URL)
2. Ensure dev server is running
3. Re-run global setup

### Problem: "Login failed during setup"

**Cause:** Login form changed or selectors outdated

**Solution:**
1. Update selectors in `tests/setup/global-setup.ts`
2. Verify login page structure matches expectations

### Problem: Tests are slow

**Possible causes:**
1. Not using auth fixtures (logging in repeatedly)
2. Network requests not mocked
3. Animations/transitions not disabled

**Solutions:**
1. Use `candidateUser`, `recruiterUser`, etc. fixtures
2. Mock external API calls
3. Disable animations in test environment

### Problem: Flaky tests

**Common causes:**
1. Race conditions (element not loaded)
2. Hard-coded timeouts
3. Relying on animation timing

**Solutions:**
1. Use `waitForSelector`, `waitForURL`
2. Use Playwright's auto-waiting
3. Add `data-testid` attributes for reliable selectors

## Performance Optimization

### Parallel Execution

Playwright runs tests in parallel by default. Configure in `playwright.config.ts`:

```typescript
workers: process.env.CI ? 1 : undefined,  // Single worker in CI, multiple locally
```

### Test Isolation

Each test gets a fresh browser context, ensuring isolation without slowdown.

### Auth State Reuse

By reusing authentication state (via fixtures), we avoid:
- ~2-3 seconds per login
- Multiplied by number of tests
- Result: **10x faster test execution**

## Further Reading

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Fixtures](https://playwright.dev/docs/test-fixtures)
- [Auth Fixtures README](./fixtures/README.md)

## Getting Help

If you encounter issues with E2E tests:

1. Check this guide and [fixtures/README.md](./fixtures/README.md)
2. Review example tests in `auth-fixtures.example.spec.ts`
3. Run with debug mode: `yarn test:e2e:debug`
4. Check Playwright documentation
5. Ask the team in #engineering-testing
