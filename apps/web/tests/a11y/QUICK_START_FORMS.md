# Quick Start: Form Accessibility Tests

## What Was Created

A comprehensive form accessibility test suite with **20 test cases** covering all major forms in the JobSphere application.

**File**: `apps/web/tests/a11y/forms.spec.ts` (628 lines)

## Quick Test Commands

```bash
# Run all form accessibility tests (Chromium only - 20 tests)
yarn playwright test tests/a11y/forms.spec.ts --project=chromium

# Run with UI (recommended)
yarn playwright test tests/a11y/forms.spec.ts --ui

# Run a specific test
yarn playwright test tests/a11y/forms.spec.ts -g "login form - all inputs"

# Run on all browsers (200 tests total)
yarn playwright test tests/a11y/forms.spec.ts
```

## Test Categories (20 Tests)

1. **Label Associations** (3 tests)
   - Login form labels
   - Signup form labels
   - Descriptive label text

2. **Error Messages** (2 tests)
   - aria-live/role="alert" usage
   - aria-describedby linking

3. **Required Fields** (2 tests)
   - required/aria-required attributes
   - Visual indicators

4. **Help Text** (2 tests)
   - aria-describedby linking
   - Unique IDs

5. **Autocomplete** (4 tests)
   - Email autocomplete
   - Password autocomplete (login)
   - Password autocomplete (signup)
   - Name autocomplete

6. **Fieldset/Legend** (2 tests)
   - Radio button groups
   - Checkbox labels

7. **Multiple Descriptors** (1 test)
   - Help text + error messages

8. **Submission States** (2 tests)
   - Loading state announcements
   - Error announcements

9. **Complex Forms** (2 tests)
   - Job application labels
   - Validation messages

## WCAG Criteria Covered

- ✅ 1.3.1 Info and Relationships
- ✅ 1.3.5 Identify Input Purpose
- ✅ 3.3.1 Error Identification
- ✅ 3.3.2 Labels or Instructions
- ✅ 3.3.3 Error Suggestion
- ✅ 4.1.2 Name, Role, Value

## Forms Tested

- `/en/login` - Login form
- `/en/signup` - Signup form
- `/en/jobs/[id]/apply` - Job application form

## View Test Report

After running tests:

```bash
yarn playwright show-report
```

## Configuration Updated

The `playwright.config.ts` was updated to include the a11y directory:

```typescript
testDir: './tests',
testMatch: ['**/*.spec.ts', '**/*.e2e.ts'],
```

## Documentation Files

- `forms.spec.ts` - The test file (628 lines)
- `FORMS_TEST_SUMMARY.md` - Comprehensive documentation
- `README.md` - Updated with form test details
- This file - Quick start guide

## Next Steps

1. Set up test environment (DATABASE_URL, dev server)
2. Run tests: `yarn playwright test tests/a11y/forms.spec.ts --project=chromium`
3. View report: `yarn playwright show-report`
4. Fix any failing tests
5. Integrate into CI/CD pipeline

## Support

See `FORMS_TEST_SUMMARY.md` for detailed documentation and `README.md` for general accessibility testing guidance.
