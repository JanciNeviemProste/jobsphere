# Candidate Job Application Flow E2E Tests

This document describes the comprehensive E2E test suite for the candidate job application flow in JobSphere.

## Overview

The `candidate-flow.spec.ts` test suite covers the complete candidate journey from browsing jobs to submitting applications and viewing their status. These tests verify both unauthenticated and authenticated user flows.

## Test File Location

```
apps/web/tests/e2e/candidate-flow.spec.ts
```

## Prerequisites

### 1. Database Setup

Ensure you have a test database running with the schema properly migrated:

```bash
# Start database (if using Docker)
yarn docker:up

# Run migrations
yarn db:push
```

### 2. Test User Setup

The tests use pre-authenticated fixtures from Agent 3.2. Ensure global setup has run:

```bash
cd apps/web
npx playwright test --global-setup-only
```

This creates the following test users:
- **Candidate**: candidate@test.jobsphere.com / TestPassword123!
- **Recruiter**: recruiter@test.jobsphere.com / TestPassword123!

### 3. Test Data (Optional)

For file upload tests, generate sample CV files:

```bash
cd tests/fixtures/files
node generate-test-files.js
```

This creates:
- `sample-cv.pdf` - Normal PDF CV with text
- `sample-cv.docx` - Normal DOCX CV with text
- `scanned-cv.pdf` - Simulated scanned document
- `large-cv.pdf` - File >10MB for size testing
- `macro-infected.docx` - DOCX with macros for rejection testing

## Test Scenarios

### 1. Unauthenticated User Flow

Tests that verify public access to job listings:

#### `should browse jobs without authentication`
- Navigates to `/en/jobs`
- Verifies jobs page loads correctly
- Checks for job listings or "no results" message

#### `should search and filter jobs`
- Tests search functionality
- Verifies URL updates with search parameters
- Validates debounced search input

#### `should view job details without authentication`
- Navigates to job detail page
- Verifies job information is displayed
- Checks that Apply button is visible

#### `should redirect to login when applying without authentication`
- Clicks Apply button as unauthenticated user
- Verifies redirect to login page
- Confirms callback URL is preserved for post-login navigation

### 2. Authenticated Candidate Flow

Tests that verify authenticated candidate functionality:

#### `should apply to job with cover letter`
- Navigates to job application page
- Fills in cover letter (minimum 50 characters per schema)
- Fills optional phone number field
- Submits application
- Verifies success message or dashboard redirect

**Expected behavior:**
- Cover letter must be 50-2000 characters
- Phone number must be at least 9 digits
- Application creates `Application` record in database
- Status starts as `NEW`
- Email notifications sent to candidate and employer

#### `should upload CV during application`
- Navigates to apply page
- Selects "upload new" CV option
- Uploads PDF file via file input
- Waits for upload completion
- Verifies file upload indicator

**Expected behavior:**
- CV file uploaded to storage
- File size must be ≤ 10MB
- Allowed types: PDF, DOC, DOCX
- Security validation (MIME type, VBA macros, antivirus if enabled)
- CV text extraction via pipeline (see CLAUDE.md for details)

#### `should prevent duplicate application`
- Applies to a job successfully
- Attempts to apply to the same job again
- Verifies 409 Conflict error is returned
- Checks error message is displayed

**Expected behavior:**
- API returns 409 status code
- Error message: "You have already applied to this job"
- No duplicate `Application` record created

#### `should view application status in dashboard`
- Navigates to candidate dashboard
- Verifies application statistics are displayed
- Checks for application list/cards
- Validates application data is visible

**Dashboard stats:**
- Total applications
- Pending (stage: NEW)
- Reviewing (stage: SCREENING, PHONE_SCREEN)
- Accepted (stage: HIRED, OFFER)
- Rejected (stage: REJECTED)

#### `should view application details`
- Clicks on application from dashboard
- Navigates to application detail page
- Verifies job title, company, and status
- Checks cover letter is displayed
- Validates timeline/activities if present

**Application detail page includes:**
- Job information (title, company, location, salary)
- Application status badge
- Cover letter
- Timeline of activities
- Contact information
- CV download link

#### `should filter jobs and apply to filtered result`
- Opens job filters (Work Mode dropdown)
- Selects REMOTE filter
- Verifies filtered results
- Clicks on filtered job
- Confirms remote badge is visible

**Available filters:**
- Work Mode: REMOTE, HYBRID, ONSITE
- Job Type: FULL_TIME, PART_TIME, CONTRACT
- Seniority: JUNIOR, MEDIOR, SENIOR, LEAD

#### `should save job for later`
- Navigates to job detail page
- Clicks Save/Bookmark button
- Navigates to `/en/dashboard/saved`
- Verifies saved jobs page displays saved job

### 3. Form Validation Tests

Tests that verify client-side and server-side validation:

#### `should validate cover letter length`
- Attempts to submit with cover letter < 50 characters
- Verifies validation error message
- Confirms submission is blocked

**Validation rules:**
- Minimum: 50 characters
- Maximum: 2000 characters
- Required field

#### `should validate phone number format`
- Fills valid cover letter
- Enters invalid phone number (e.g., "123")
- Submits form
- Checks for validation error

**Validation rules:**
- Minimum: 9 characters
- Optional field
- Format validation via Zod schema

#### `should validate LinkedIn URL format`
- Fills valid cover letter
- Enters invalid LinkedIn URL (e.g., "not-a-url")
- Submits form
- Verifies URL validation error

**Validation rules:**
- Must be valid URL format
- Optional field
- Can be empty string

### 4. Profile and CV Management

Tests for candidate profile features:

#### `should access profile from dashboard`
- Finds profile link in dashboard
- Clicks profile link
- Verifies navigation to profile page

#### `should view existing CVs`
- Looks for CV/Resume section
- Clicks CV link
- Verifies CV list or upload page is displayed

## Running the Tests

### Run All Candidate Flow Tests

```bash
cd apps/web
yarn test:e2e candidate-flow.spec.ts
```

### Run Specific Test

```bash
yarn test:e2e candidate-flow.spec.ts -g "should apply to job with cover letter"
```

### Run with UI Mode

```bash
yarn test:e2e:ui candidate-flow.spec.ts
```

### Run in Debug Mode

```bash
yarn test:e2e:debug candidate-flow.spec.ts
```

### Run in Headed Browser (see what's happening)

```bash
yarn test:e2e candidate-flow.spec.ts --headed
```

## Test Configuration

### Timeouts

- Default action timeout: 5000ms
- Navigation timeout: 30000ms
- Assertion timeout: 5000ms

### Retries

- CI mode: 2 retries per test
- Local mode: 0 retries

### Parallelization

Tests run in parallel by default. Set workers in `playwright.config.ts`:

```typescript
workers: process.env.CI ? 1 : 3
```

## Test Data Requirements

### Jobs

Tests expect at least one active job in the database. You can:

1. **Create via seed script**:
   ```bash
   cd apps/web
   yarn db:seed
   ```

2. **Create manually**:
   - Login as recruiter@test.jobsphere.com
   - Navigate to /en/employer/jobs/new
   - Create a test job

3. **Use API**:
   ```typescript
   await prisma.job.create({
     data: {
       title: 'Test Software Engineer',
       description: 'Test job for E2E tests',
       workMode: 'REMOTE',
       type: 'FULL_TIME',
       location: 'Remote',
       status: 'ACTIVE',
       orgId: 'test-org-playwright',
     }
   })
   ```

### Test Organization

Global setup creates "Test Org Inc" organization with ID `test-org-playwright`.

## Common Issues and Troubleshooting

### Issue: "No jobs found" - Tests skip

**Cause**: Database doesn't have any active jobs

**Solution**:
```bash
yarn db:seed
```

### Issue: "Authentication state not found"

**Cause**: Global setup hasn't run

**Solution**:
```bash
npx playwright test --global-setup-only
```

### Issue: "Cannot upload CV - file input not found"

**Cause**: UI changed or file input is hidden

**Solution**: Update selectors in test file or check component implementation

### Issue: "409 error on first application"

**Cause**: Test candidate already applied to this job in previous run

**Solution**: Clean up applications:
```typescript
await prisma.application.deleteMany({
  where: { candidateId: 'test-candidate-user' }
})
```

### Issue: "Sample CV file not found"

**Cause**: Test CV files haven't been generated

**Solution**:
```bash
cd tests/fixtures/files
node generate-test-files.js
```

## Test Coverage

This test suite covers:

- ✅ Unauthenticated job browsing
- ✅ Job search and filtering
- ✅ Job detail viewing
- ✅ Login redirect for unauthenticated apply
- ✅ Application submission with cover letter
- ✅ CV upload during application
- ✅ Duplicate application prevention (409)
- ✅ Application status viewing in dashboard
- ✅ Application detail page
- ✅ Form validation (cover letter, phone, LinkedIn)
- ✅ Job filtering and apply to filtered result
- ✅ Save job for later
- ✅ Profile access
- ✅ CV management

## Integration with API

Tests interact with these API endpoints:

- `GET /api/jobs` - List jobs with filters
- `GET /api/jobs/:id` - Get job details
- `POST /api/applications` - Submit application
- `GET /api/applications` - Get candidate's applications
- `GET /api/applications/:id` - Get application details
- `POST /api/cv/upload` - Upload CV file
- `POST /api/cv/parse` - Parse CV with AI

## Database State

Tests modify database state:

### Created Records

- `Application` records in various stages
- `ApplicationActivity` records for timeline
- Potentially `Resume` records if CV uploaded

### Modified Records

- Job view counts (if tracking enabled)
- Saved jobs (if save functionality tested)

### Cleanup

Tests should be idempotent where possible. Global teardown removes test users and organization.

## Performance Considerations

- Tests use pre-authenticated fixtures (fast)
- File uploads may take 2-3 seconds
- CV parsing with AI may take 1-2 seconds
- Consider increasing timeout for upload/parse tests

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests - Candidate Flow

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: yarn install
      - run: yarn db:push
      - run: npx playwright install --with-deps
      - run: yarn test:e2e candidate-flow.spec.ts
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          NEXTAUTH_URL: http://localhost:3000
          NEXTAUTH_SECRET: test-secret-key-for-ci
```

## Best Practices

1. **Use fixtures**: Always use `candidateUser` fixture instead of manual login
2. **Wait for network**: Use `waitForLoadState('networkidle')` after navigation
3. **Flexible selectors**: Use text content where possible, IDs/classes as fallback
4. **Handle edge cases**: Check if elements exist before interacting
5. **Clean assertions**: Use `expect()` with clear, specific conditions
6. **Idempotent tests**: Tests should work regardless of run order
7. **Skip gracefully**: Use `test.skip()` when data is missing instead of failing

## Future Improvements

- [ ] Add tests for CV auto-fill functionality
- [ ] Test email notifications (mock email service)
- [ ] Test application withdrawal/cancellation
- [ ] Test multi-language support (locale switching)
- [ ] Add visual regression testing for key pages
- [ ] Test accessibility (WCAG compliance)
- [ ] Add performance metrics tracking
- [ ] Test mobile responsiveness

## Related Documentation

- [Auth Fixtures README](../fixtures/README.md) - Authentication system
- [Test Users Helper](../helpers/test-users.ts) - Test user factory
- [CLAUDE.md](../../CLAUDE.md) - Project architecture and patterns
- [Playwright Docs](https://playwright.dev/) - Official Playwright documentation

## Contact

For questions or issues with this test suite, contact the QA team or create an issue in the repository.
