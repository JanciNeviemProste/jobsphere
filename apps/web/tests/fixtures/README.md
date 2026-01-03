# Playwright Authentication Fixtures

This directory contains Playwright test fixtures that provide pre-authenticated browser contexts for different user roles. This approach dramatically speeds up E2E tests by avoiding repeated login operations.

## Overview

The authentication system consists of:

- **Test User Helpers** (`tests/helpers/test-users.ts`): Factory functions for creating test users
- **Auth Fixtures** (`tests/fixtures/auth.ts`): Playwright fixtures for pre-authenticated contexts
- **Global Setup** (`tests/setup/global-setup.ts`): Runs once before all tests to seed DB and login
- **Global Teardown** (`tests/setup/global-teardown.ts`): Runs once after all tests to cleanup

## Architecture

### How It Works

1. **Global Setup** (runs once before all tests):
   - Creates test organization "Test Org Inc"
   - Seeds database with 5 test users (one per role)
   - Logs in each user via the UI
   - Saves authentication state to `playwright/.auth/{role}.json`

2. **Test Execution** (runs for each test):
   - Tests import fixtures from `@/tests/fixtures/auth`
   - Each fixture reuses saved authentication state
   - No login required - tests start authenticated

3. **Global Teardown** (runs once after all tests):
   - Removes test users and organization from database
   - Deletes authentication state files

## Available Fixtures

### Role-Based Fixtures

Each fixture provides a pre-authenticated `Page` object:

```typescript
import { test, expect } from '@/tests/fixtures/auth'

test('recruiter can view jobs', async ({ recruiterUser }) => {
  await recruiterUser.goto('/en/employer/jobs')
  await expect(recruiterUser).toHaveURL(/\/employer\/jobs/)
})
```

Available fixtures:

- **`candidateUser`**: CANDIDATE role (no organization)
- **`recruiterUser`**: RECRUITER role in "Test Org Inc"
- **`orgAdminUser`**: ORG_ADMIN role in "Test Org Inc"
- **`hiringManagerUser`**: HIRING_MANAGER role in "Test Org Inc"
- **`agencyUser`**: AGENCY role in "Test Org Inc"

### Context Factory Fixture

For advanced scenarios where you need multiple contexts:

```typescript
test('multiple roles in one test', async ({ createAuthenticatedContext }) => {
  const { page: recruiter } = await createAuthenticatedContext('recruiter')
  const { page: candidate } = await createAuthenticatedContext('candidate')

  await recruiter.goto('/en/employer')
  await candidate.goto('/en/dashboard')

  // Contexts are automatically closed after the test
})
```

## Test User Credentials

All test users are defined in `tests/helpers/test-users.ts`:

| Role | Email | Password | Organization |
|------|-------|----------|--------------|
| Candidate | candidate@test.jobsphere.com | TestPassword123! | None |
| Recruiter | recruiter@test.jobsphere.com | TestPassword123! | Test Org Inc |
| Org Admin | admin@test.jobsphere.com | TestPassword123! | Test Org Inc |
| Hiring Manager | hiring-manager@test.jobsphere.com | TestPassword123! | Test Org Inc |
| Agency | agency@test.jobsphere.com | TestPassword123! | Test Org Inc |

## Usage Examples

### Basic Role Testing

```typescript
import { test, expect } from '@/tests/fixtures/auth'

test('recruiter can create job', async ({ recruiterUser }) => {
  await recruiterUser.goto('/en/employer/jobs/new')

  await recruiterUser.fill('#title', 'Software Engineer')
  await recruiterUser.fill('#description', 'Build amazing products')
  await recruiterUser.click('button[type="submit"]')

  await expect(recruiterUser).toHaveURL(/\/employer\/jobs\//)
})
```

### Testing Different Access Levels

```typescript
test('roles have different permissions', async ({
  candidateUser,
  recruiterUser,
  orgAdminUser
}) => {
  // Candidate cannot access employer routes
  await candidateUser.goto('/en/employer/settings')
  await expect(candidateUser).not.toHaveURL(/\/employer\/settings/)

  // Recruiter cannot access org settings
  await recruiterUser.goto('/en/employer/settings')
  await expect(recruiterUser.locator('text=Access Denied')).toBeVisible()

  // Org admin CAN access org settings
  await orgAdminUser.goto('/en/employer/settings')
  await expect(orgAdminUser).toHaveURL(/\/employer\/settings/)
})
```

### Testing Cross-Role Interactions

```typescript
test('candidate applies, recruiter reviews', async ({
  candidateUser,
  recruiterUser,
}) => {
  // Candidate applies for job
  await candidateUser.goto('/en/jobs/some-job-id')
  await candidateUser.click('text=Apply Now')
  await candidateUser.fill('#coverLetter', 'I am excited about this role')
  await candidateUser.click('button[type="submit"]')

  // Recruiter sees application
  await recruiterUser.goto('/en/employer/applications')
  await expect(recruiterUser.locator('text=Test Candidate')).toBeVisible()
})
```

## Running Tests

### Run All E2E Tests

```bash
yarn test:e2e
```

### Run Specific Test File

```bash
yarn test:e2e auth-fixtures.example.spec.ts
```

### Run Tests with UI

```bash
yarn test:e2e:ui
```

### Debug Tests

```bash
yarn test:e2e:debug
```

## Configuration

The authentication system is configured in `playwright.config.ts`:

```typescript
export default defineConfig({
  globalSetup: require.resolve('./tests/setup/global-setup'),
  globalTeardown: require.resolve('./tests/setup/global-teardown'),
  // ... other config
})
```

## Database Considerations

### Test Database

The global setup uses the Prisma client with the `DATABASE_URL` from your environment. For isolated testing, consider:

1. **Option 1**: Use `.env.test` file with separate test database
2. **Option 2**: Use in-memory SQLite for tests (faster but requires schema changes)
3. **Option 3**: Docker container with ephemeral database

### Data Isolation

- Test users have deterministic IDs (e.g., `test-candidate-user`)
- Test organization has deterministic ID (`test-org-playwright`)
- Global teardown ensures cleanup after tests
- Tests should not modify test user accounts

## Troubleshooting

### Authentication State Not Found

**Error**: `ENOENT: no such file or directory, open 'playwright/.auth/candidate.json'`

**Solution**: Run global setup manually:
```bash
cd apps/web
npx playwright test --global-setup-only
```

### Login Failed During Setup

**Error**: Login timeout or failed navigation

**Possible causes**:
1. Dev server not running (ensure `yarn dev` is running)
2. Database not seeded (check DATABASE_URL)
3. Login form changed (update selectors in global-setup.ts)

**Debug**:
```bash
# Run setup with headed browser to see what's happening
DEBUG=pw:api npx playwright test --global-setup-only
```

### Test Users Not Found

**Error**: Prisma query fails in tests

**Solution**: Ensure global setup ran successfully. Check for errors in setup output.

### Stale Authentication

If auth state becomes invalid (e.g., after schema changes):

```bash
# Clean up old auth state
rm -rf apps/web/playwright/.auth/*.json

# Re-run global setup
npx playwright test --global-setup-only
```

## Advanced Patterns

### Custom Test User

For tests that need a unique user (not one of the default roles):

```typescript
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

test('custom user workflow', async ({ browser }) => {
  const prisma = new PrismaClient()

  // Create custom user
  const customUser = await prisma.user.create({
    data: {
      email: 'custom@test.com',
      password: await hash('password123', 10),
      name: 'Custom User',
    },
  })

  // Login this user
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto('/en/login')
  await page.fill('input[type="email"]', 'custom@test.com')
  await page.fill('input[type="password"]', 'password123')
  await page.click('button[type="submit"]')

  // ... test logic

  // Cleanup
  await prisma.user.delete({ where: { id: customUser.id } })
  await prisma.$disconnect()
})
```

### Testing Without Authentication

For unauthenticated flows (e.g., public job listings):

```typescript
import { test as base, expect } from '@playwright/test'

// Use base test (not auth fixtures)
base('public can view jobs', async ({ page }) => {
  await page.goto('/en/jobs')
  await expect(page.locator('h1')).toContainText('Job Listings')
})
```

## Security Notes

- Test passwords are hardcoded (`TestPassword123!`) - this is acceptable for test data
- Auth state files contain session tokens - they're gitignored for security
- Test users are isolated from production data
- Always use separate test database in CI/CD

## Contributing

When adding new user roles:

1. Add role definition to `TEST_USERS` in `test-users.ts`
2. Add fixture to `auth.ts`
3. Update global setup to create auth state for new role
4. Update this README with new fixture documentation
