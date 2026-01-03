# Quick Start Guide - Accessibility Testing

Get started with accessibility testing in 5 minutes.

## Prerequisites

1. **Development server running**
   ```bash
   cd apps/web
   yarn dev
   ```
   Server will start at `http://localhost:3000`

2. **Dependencies installed**
   ```bash
   yarn install
   ```
   `@axe-core/playwright` is already installed

## Running Your First Test

### Option 1: UI Mode (Recommended)
```bash
cd apps/web
yarn test:a11y:ui
```

This opens an interactive UI where you can:
- See all tests in a tree view
- Run individual tests
- Watch tests execute in browser
- Debug failures visually

### Option 2: Command Line
```bash
cd apps/web
yarn test:a11y
```

This runs all tests and shows results in terminal.

### Option 3: Headed Mode
```bash
cd apps/web
yarn test:a11y:headed
```

See the browser while tests run (useful for debugging).

## Understanding Results

### ✅ Passing Test
```
✓ [chromium] › axe-core.spec.ts:43:9 › Homepage Accessibility › should have no WCAG AA violations
```

### ❌ Failing Test
```
✗ [chromium] › axe-core.spec.ts:43:9 › Homepage Accessibility › should have no WCAG AA violations

Accessibility violations found:
{
  id: 'color-contrast',
  impact: 'serious',
  description: 'Elements must have sufficient color contrast',
  help: 'Ensure the contrast ratio is at least 4.5:1',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/color-contrast'
}
```

## Fixing Violations

When tests fail, follow these steps:

### 1. Read the Violation Details
Look at the console output for:
- **id**: The rule that failed (e.g., `color-contrast`)
- **impact**: How serious it is (`critical`, `serious`, `moderate`, `minor`)
- **description**: What's wrong
- **helpUrl**: Link to detailed documentation

### 2. Check Common Fixes
Open `COMMON_FIXES.md` and find your violation type:
```bash
# In your editor
code apps/web/tests/a11y/COMMON_FIXES.md
```

### 3. Apply the Fix
Example for color contrast:

**Before (Low Contrast)**:
```tsx
<p className="text-gray-400 bg-white">
  Low contrast text
</p>
```

**After (Good Contrast)**:
```tsx
<p className="text-gray-700 bg-white">
  Sufficient contrast text
</p>
```

### 4. Re-run the Test
```bash
yarn test:a11y -g "homepage"
```

Use `-g` flag to run only tests matching the pattern.

## Common Commands

### Run specific test file
```bash
yarn test:a11y axe-core.spec.ts
```

### Run specific test by name
```bash
yarn test:a11y -g "login form"
```

### Run tests matching pattern
```bash
yarn test:a11y -g "Homepage"
```

### Debug a failing test
```bash
yarn test:a11y:debug
```

### View HTML report
```bash
# After running tests
npx playwright show-report playwright-report-a11y
```

## What's Being Tested?

### Pages Covered
- ✅ Homepage
- ✅ Jobs listing page
- ✅ Job detail page
- ✅ Application form
- ✅ Login page
- ✅ Signup page
- ✅ Candidate dashboard (if authenticated)
- ✅ Employer dashboard (if authenticated)

### Accessibility Checks
- ✅ Color contrast (4.5:1 minimum)
- ✅ Form labels
- ✅ ARIA attributes
- ✅ Heading hierarchy (h1 → h2 → h3)
- ✅ Image alt text
- ✅ Keyboard accessibility
- ✅ Semantic HTML
- ✅ Focus indicators
- ✅ Error messages
- ✅ Navigation landmarks

## Test Structure

### Main Test File
`apps/web/tests/a11y/axe-core.spec.ts` - 18 automated tests

### Test Categories
1. **Homepage Accessibility** (2 tests)
2. **Jobs Page Accessibility** (2 tests)
3. **Job Detail Page** (1 test)
4. **Application Form** (2 tests)
5. **Dashboards** (2 tests)
6. **Auth Pages** (2 tests)
7. **Additional Checks** (4 tests)
8. **Specific Elements** (2 tests)
9. **Best Practices** (1 test)

## Troubleshooting

### Tests fail immediately
**Issue**: "Page not found" or "Network timeout"

**Solution**: Make sure dev server is running
```bash
yarn dev
```

### Tests skip (don't run)
**Issue**: Some tests show as "skipped"

**Reason**: Tests skip when:
- No jobs exist in database
- Not authenticated (for dashboard tests)
- Required elements not found

**Solution**: Either:
1. Seed database: `yarn db:seed`
2. Or accept that these tests skip (it's expected behavior)

### Tests are slow
**Issue**: Tests take a long time

**Reason**: axe-core scans can take 3-5 seconds per page

**Solution**: This is normal. Use UI mode for better feedback during development.

### Can't see browser
**Issue**: Tests run but browser is hidden

**Solution**: Use headed mode
```bash
yarn test:a11y:headed
```

## Next Steps

### 1. Run All Tests
```bash
yarn test:a11y:ui
```

### 2. Fix Any Violations
Refer to `COMMON_FIXES.md` for solutions

### 3. Add Tests for New Features
When adding new pages/components:
```typescript
test('my new page should be accessible', async ({ page }) => {
  await page.goto('/my-new-page')

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2aa', 'wcag21aa'])
    .analyze()

  expect(results.violations).toEqual([])
})
```

### 4. Integrate with CI/CD
Add to `.github/workflows/test.yml`:
```yaml
- name: Run accessibility tests
  run: |
    cd apps/web
    yarn test:a11y
```

## Resources

### Internal Documentation
- 📖 `README.md` - Complete guide
- 🔧 `COMMON_FIXES.md` - Fix reference
- 📋 `IMPLEMENTATION_SUMMARY.md` - Technical details

### External Resources
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- [WCAG Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

## Getting Help

### Check Logs
Tests output detailed violation information to console

### Check Help URL
Every violation includes a `helpUrl` with detailed fix instructions

### Ask Team
Reach out in team accessibility channel

### Consult Documentation
All docs are in `apps/web/tests/a11y/`

## Key Takeaways

✅ **Run tests early and often** - Catch issues during development

✅ **Fix critical violations first** - Prioritize by impact level

✅ **Use UI mode for development** - Better visual feedback

✅ **Read violation details** - helpUrl provides detailed fixes

✅ **Refer to COMMON_FIXES.md** - Quick solutions to common issues

✅ **Don't skip violations** - All accessibility issues matter

## Example Workflow

1. **Start development server**
   ```bash
   yarn dev
   ```

2. **Make changes to a component**
   ```bash
   # Edit component file
   ```

3. **Run accessibility tests**
   ```bash
   yarn test:a11y:ui
   ```

4. **If tests fail, check violations**
   - Read the error message
   - Check `COMMON_FIXES.md`
   - Click helpUrl for details

5. **Fix the issue**
   ```bash
   # Apply fix to component
   ```

6. **Re-run tests**
   ```bash
   yarn test:a11y -g "my component"
   ```

7. **Commit when passing**
   ```bash
   git add .
   git commit -m "Fix accessibility issues in MyComponent"
   ```

That's it! You're now ready to maintain and improve accessibility in JobSphere.
