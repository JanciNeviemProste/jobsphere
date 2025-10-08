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
├── auth.spec.ts        - Authentication flows (signup, login, validation)
├── jobs.spec.ts        - Job browsing and search
├── employer.spec.ts    - Employer dashboard (mostly skipped - requires auth setup)
└── README.md          - This file
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

### ⏸️ Employer Dashboard (5 tests - skipped)
- Authentication requirement
- Dashboard access (skipped - needs auth)
- Post job navigation (skipped - needs auth)
- Applicants list (skipped - needs auth)
- Settings (skipped - needs auth)

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

## TODO

- [ ] Setup authentication helper for employer tests
- [ ] Add application submission E2E test
- [ ] Add CV upload E2E test
- [ ] Add payment flow E2E test
- [ ] Add mobile viewport tests
- [ ] Add accessibility tests (axe-playwright)
