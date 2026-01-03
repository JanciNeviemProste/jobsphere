# E2E Testing Quick Start

**TL;DR**: Use pre-authenticated user fixtures for fast E2E tests. No manual login required.

## 30-Second Start

```typescript
// tests/e2e/my-test.spec.ts
import { test, expect } from '@/tests/fixtures/auth'

test('recruiter can view jobs', async ({ recruiterUser }) => {
  await recruiterUser.goto('/en/employer/jobs')
  await expect(recruiterUser).toHaveURL(/\/employer\/jobs/)
})
```

Run it:
```bash
yarn test:e2e
```

## First Time Setup

```bash
# 1. Start dev server (required for setup)
yarn dev

# 2. Create test users and save auth state
cd apps/web
npx playwright test --global-setup-only

# 3. Run tests
yarn test:e2e
```

## Available User Fixtures

```typescript
import { test } from '@/tests/fixtures/auth'

test('my test', async ({
  candidateUser,      // CANDIDATE role, no org
  recruiterUser,      // RECRUITER in Test Org Inc
  orgAdminUser,       // ORG_ADMIN in Test Org Inc
  hiringManagerUser,  // HIRING_MANAGER in Test Org Inc
  agencyUser,         // AGENCY in Test Org Inc
}) => {
  // Use any fixture you need
})
```

## Common Patterns

### Basic Role Test
```typescript
test('admin can access settings', async ({ orgAdminUser }) => {
  await orgAdminUser.goto('/en/employer/settings')
  await expect(orgAdminUser).toHaveURL(/\/employer\/settings/)
})
```

### Multi-Role Workflow
```typescript
test('candidate applies, recruiter reviews', async ({
  candidateUser,
  recruiterUser,
}) => {
  // Candidate applies
  await candidateUser.goto('/en/jobs/job-123')
  await candidateUser.click('text=Apply Now')

  // Recruiter sees application
  await recruiterUser.goto('/en/employer/applications')
  await expect(recruiterUser.locator('text=Test Candidate')).toBeVisible()
})
```

### Permission Test
```typescript
test('candidate cannot access employer routes', async ({ candidateUser }) => {
  await candidateUser.goto('/en/employer')
  await expect(candidateUser).not.toHaveURL(/\/employer/)
})
```

## Test User Credentials

| Fixture | Email | Password |
|---------|-------|----------|
| candidateUser | candidate@test.jobsphere.com | TestPassword123! |
| recruiterUser | recruiter@test.jobsphere.com | TestPassword123! |
| orgAdminUser | admin@test.jobsphere.com | TestPassword123! |
| hiringManagerUser | hiring-manager@test.jobsphere.com | TestPassword123! |
| agencyUser | agency@test.jobsphere.com | TestPassword123! |

Organization: **Test Org Inc** (for all except candidate)

## Running Tests

```bash
# All tests
yarn test:e2e

# Specific file
yarn test:e2e my-test.spec.ts

# With UI (recommended for development)
yarn test:e2e:ui

# Debug mode
yarn test:e2e:debug

# Headed (see browser)
yarn test:e2e:headed
```

## Troubleshooting

### "Auth state file not found"
```bash
# Re-run global setup
npx playwright test --global-setup-only
```

### Stale auth state
```bash
# Clear and recreate
rm -rf playwright/.auth/*.json
npx playwright test --global-setup-only
```

### Test fails unexpectedly
```bash
# Run in debug mode to investigate
yarn test:e2e:debug my-test.spec.ts
```

## More Info

- **Comprehensive Guide**: `tests/TESTING.md`
- **Fixture Documentation**: `tests/fixtures/README.md`
- **Example Tests**: `tests/e2e/auth-fixtures.example.spec.ts`
- **Implementation Details**: `tests/IMPLEMENTATION_SUMMARY.md`

## Pro Tips

1. **Use data-testid**: Add to critical elements for stable selectors
   ```tsx
   <button data-testid="submit-job">Create</button>
   ```
   ```typescript
   await page.locator('[data-testid="submit-job"]').click()
   ```

2. **Wait for navigation**: Don't assume instant redirects
   ```typescript
   await page.click('text=Apply')
   await page.waitForURL(/\/applications\//)
   ```

3. **Use specific locators**: Avoid fragile CSS selectors
   ```typescript
   // Good
   await page.locator('button', { hasText: 'Submit' }).click()

   // Bad
   await page.click('.btn.btn-primary.submit')
   ```

4. **Clean up test data**: If creating resources, consider cleanup
   ```typescript
   test('create and delete job', async ({ recruiterUser }) => {
     // Create
     await recruiterUser.goto('/en/employer/jobs/new')
     // ... create job

     // Cleanup
     await recruiterUser.click('[data-testid="delete-job"]')
   })
   ```

## Need Help?

1. Check the guides in `tests/` directory
2. Look at `auth-fixtures.example.spec.ts`
3. Run with `yarn test:e2e:ui` to debug visually
4. Ask in #engineering-testing

---

**Happy Testing!** 🎭
