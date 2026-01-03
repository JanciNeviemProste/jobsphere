# E2E Tests - Playwright

End-to-end tests for JobSphere ATS using Playwright.

## Setup

Playwright is already configured in `playwright.config.ts`. Browsers are installed automatically.

## Running Tests

```bash
# Run all E2E tests (headless)
yarn test:e2e

# Run with UI mode (recommended for development)
yarn test:e2e:ui

# Run in headed mode (see browser)
yarn test:e2e:headed

# Debug mode (step through tests)
yarn test:e2e:debug
```

## Test Structure

```
tests/e2e/
├── auth.spec.ts                  - Authentication flows (signup, login, validation)
├── jobs.spec.ts                  - Job browsing and search
├── candidate-flow.spec.ts        - ✨ NEW: Comprehensive candidate application flow
├── employer.spec.ts              - Employer dashboard (uses auth fixtures)
├── responsive.spec.ts            - Responsive design tests
├── auth-fixtures.example.spec.ts - Examples of using auth fixtures
├── CANDIDATE_FLOW_TESTS.md       - ✨ NEW: Detailed candidate test documentation
└── README.md                     - This file
```

## Current Test Coverage

### ✅ Authentication (6 tests)
- Homepage display
- Navigation to pricing
- Signup/login form display
- Email validation
- Password validation

### ✅ Job Browsing (4 tests)
- Jobs page display
- Keyword search
- Job detail navigation
- Filter display

### ✨ NEW: Candidate Application Flow (14+ tests)
**Comprehensive end-to-end tests for the complete candidate journey**

See [CANDIDATE_FLOW_TESTS.md](./CANDIDATE_FLOW_TESTS.md) for detailed documentation.

#### Unauthenticated Flow (4 tests)
- Browse jobs without authentication
- Search and filter jobs
- View job details
- Redirect to login when applying

#### Authenticated Candidate Flow (7 tests)
- Apply to job with cover letter
- Upload CV during application
- Prevent duplicate applications (409 error)
- View application status in dashboard
- View application details
- Filter jobs and apply to filtered result
- Save job for later

#### Form Validation (3 tests)
- Cover letter length validation (50-2000 chars)
- Phone number format validation
- LinkedIn URL format validation

#### Profile & CV Management (2 tests)
- Access profile from dashboard
- View existing CVs

### ✅ Employer Dashboard (5 tests)
- Authentication requirement
- Dashboard access (uses auth fixtures)
- Post job navigation (uses auth fixtures)
- Applicants list (uses auth fixtures)
- Settings (uses auth fixtures)

## Adding New Tests

1. Create a new `.spec.ts` file in `tests/e2e/`
2. Import test utilities:
   ```typescript
   import { test, expect } from '@playwright/test'
   ```
3. Write tests using `test.describe()` and `test()`
4. Run tests with `yarn test:e2e`

## Best Practices

1. **Use data-testid** for stable selectors:
   ```typescript
   page.locator('[data-testid="job-card"]')
   ```

2. **Use role-based selectors** when possible:
   ```typescript
   page.getByRole('button', { name: /apply/i })
   ```

3. **Wait for navigation**:
   ```typescript
   await expect(page).toHaveURL(/\/jobs/)
   ```

4. **Check visibility** before interacting:
   ```typescript
   await expect(element).toBeVisible()
   ```

## CI/CD Integration

Playwright tests run in CI with:
- Retries: 2 attempts on failure
- Workers: 1 (sequential execution)
- Screenshot on failure
- Trace on first retry

## Authentication Fixtures

This project uses **pre-authenticated Playwright fixtures** to dramatically speed up E2E tests. Instead of logging in for each test, we:

1. **Global Setup** (once): Login all test users and save authentication state
2. **Tests**: Reuse saved authentication state

Available fixtures:
- `candidateUser` - Authenticated candidate (no organization)
- `recruiterUser` - Authenticated recruiter in "Test Org Inc"
- `orgAdminUser` - Authenticated org admin in "Test Org Inc"
- `hiringManagerUser` - Authenticated hiring manager in "Test Org Inc"
- `agencyUser` - Authenticated agency in "Test Org Inc"

**Usage Example:**
```typescript
import { test, expect } from '@/tests/fixtures/auth'

test('candidate can apply to job', async ({ candidateUser }) => {
  await candidateUser.goto('/en/jobs/some-job-id/apply')
  await candidateUser.fill('textarea[name="coverLetter"]', 'I am very interested...')
  await candidateUser.click('button[type="submit"]')
  await expect(candidateUser).toHaveURL(/\/dashboard/)
})
```

See [../fixtures/README.md](../fixtures/README.md) for complete documentation.

## Running Specific Test Suites

```bash
# Run candidate flow tests (comprehensive candidate journey)
yarn test:e2e candidate-flow.spec.ts

# Run authentication tests
yarn test:e2e auth.spec.ts

# Run employer tests
yarn test:e2e employer.spec.ts

# Run specific test by name
yarn test:e2e -g "should apply to job with cover letter"

# Run all tests matching pattern
yarn test:e2e -g "Candidate"
```

## Test Data Requirements

### For Candidate Flow Tests

1. **Database with active jobs**:
   ```bash
   yarn db:seed
   ```

2. **Sample CV files** (optional, for upload tests):
   ```bash
   cd tests/fixtures/files
   node generate-test-files.js
   ```

3. **Test users** (created by global setup):
   ```bash
   npx playwright test --global-setup-only
   ```

## TODO

- [x] ~~Setup authentication helper for employer tests~~ ✅ Done (Agent 3.2)
- [x] ~~Add application submission E2E test~~ ✅ Done (Agent 3.4)
- [x] ~~Add CV upload E2E test~~ ✅ Done (Agent 3.4)
- [ ] Add payment flow E2E test
- [ ] Add mobile viewport tests
- [ ] Add accessibility tests (axe-playwright)
- [ ] Add visual regression tests
- [ ] Test email notifications (mock email service)
- [ ] Test multi-language support
