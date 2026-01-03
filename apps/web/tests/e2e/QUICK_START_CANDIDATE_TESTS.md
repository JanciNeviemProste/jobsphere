# Quick Start - Candidate Flow E2E Tests

## 🚀 Run Tests in 3 Steps

### Step 1: Setup (One-time)
```bash
# Terminal 1: Start dev server
cd apps/web
yarn dev

# Terminal 2: Setup test environment
cd apps/web
npx playwright test --global-setup-only
yarn db:seed
```

### Step 2: Run Tests
```bash
# Run all candidate flow tests
yarn test:e2e candidate-flow.spec.ts

# Run with UI (recommended for development)
yarn test:e2e:ui candidate-flow.spec.ts

# Run in debug mode
yarn test:e2e:debug candidate-flow.spec.ts
```

### Step 3: View Results
```bash
# Open test report
npx playwright show-report
```

## 📋 Test Categories

### Unauthenticated (4 tests)
```bash
yarn test:e2e candidate-flow.spec.ts -g "Unauthenticated"
```
- Browse jobs
- Search/filter
- View details
- Login redirect

### Authenticated (7 tests)
```bash
yarn test:e2e candidate-flow.spec.ts -g "Authenticated"
```
- Apply to job
- Upload CV
- Prevent duplicates
- View dashboard
- View details
- Filter & apply
- Save jobs

### Validation (3 tests)
```bash
yarn test:e2e candidate-flow.spec.ts -g "Validation"
```
- Cover letter length
- Phone format
- LinkedIn URL

### Profile (2 tests)
```bash
yarn test:e2e candidate-flow.spec.ts -g "Profile"
```
- Access profile
- View CVs

## 🎯 Run Specific Test

```bash
# By test name
yarn test:e2e candidate-flow.spec.ts -g "should apply to job"

# By describe block
yarn test:e2e candidate-flow.spec.ts -g "Form Validation"
```

## 🐛 Troubleshooting

### "No jobs found"
```bash
yarn db:seed
```

### "Authentication state not found"
```bash
npx playwright test --global-setup-only
```

### "Sample CV file not found" (optional)
```bash
cd tests/fixtures/files
node generate-test-files.js
```

### Tests are flaky
```bash
# Run with headed browser to see what's happening
yarn test:e2e candidate-flow.spec.ts --headed

# Run single worker (no parallelization)
yarn test:e2e candidate-flow.spec.ts --workers=1
```

## 📖 Documentation

- **Detailed Guide**: [CANDIDATE_FLOW_TESTS.md](./CANDIDATE_FLOW_TESTS.md)
- **E2E Overview**: [README.md](./README.md)
- **Auth Fixtures**: [../fixtures/README.md](../fixtures/README.md)

## 🧪 Test User

**Email**: candidate@test.jobsphere.com
**Password**: TestPassword123!

## ✅ What's Tested

- ✅ Job browsing and search
- ✅ Job application submission
- ✅ CV upload
- ✅ Duplicate prevention (409)
- ✅ Dashboard views
- ✅ Form validation
- ✅ Save jobs
- ✅ Profile/CV management

## 🔧 Common Commands

```bash
# Run all E2E tests
yarn test:e2e

# Run only candidate tests
yarn test:e2e candidate-flow.spec.ts

# Run with UI
yarn test:e2e:ui

# Debug mode
yarn test:e2e:debug

# Headed mode (see browser)
yarn test:e2e --headed

# Specific browser
yarn test:e2e --project=chromium
yarn test:e2e --project=firefox

# Update snapshots (if any)
yarn test:e2e --update-snapshots
```

## 💡 Tips

1. **Use UI mode** for development (`yarn test:e2e:ui`)
2. **Check test report** after failures (`npx playwright show-report`)
3. **Run seed** if database is empty (`yarn db:seed`)
4. **Clean auth state** if stale (`rm -rf playwright/.auth/*.json`)
5. **Use headed mode** to debug (`--headed`)

## 📊 Expected Results

When all tests pass:
```
✓ apps/web/tests/e2e/candidate-flow.spec.ts (14/14)
  ✓ Candidate Job Application Flow - Unauthenticated (4)
  ✓ Candidate Job Application Flow - Authenticated (7)
  ✓ Candidate Application Form Validation (3)

14 passed (2m 30s)
```

## 🚨 If Tests Fail

1. **Check dev server** is running (`yarn dev`)
2. **Check database** has jobs (`yarn db:seed`)
3. **Check auth state** exists (`npx playwright test --global-setup-only`)
4. **View report** for details (`npx playwright show-report`)
5. **Run in headed mode** to see errors (`--headed`)

## 🎓 Learn More

See [CANDIDATE_FLOW_TESTS.md](./CANDIDATE_FLOW_TESTS.md) for:
- Detailed test descriptions
- API coverage
- Database operations
- Troubleshooting guide
- Best practices
- CI/CD integration
