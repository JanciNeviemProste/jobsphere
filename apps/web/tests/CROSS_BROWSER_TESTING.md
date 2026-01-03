# Cross-Browser Testing Implementation

## Overview

JobSphere now supports comprehensive cross-browser and cross-device testing with Playwright, covering 10 different browser and device configurations.

## Browser Coverage

### Desktop Browsers (4)
- ✅ Chromium (Desktop Chrome)
- ✅ Firefox
- ✅ WebKit (Desktop Safari)
- ✅ Edge (Chromium-based)

### Mobile Phones (4)
- ✅ iPhone 12
- ✅ iPhone 13 Pro
- ✅ Pixel 5
- ✅ Galaxy S9+

### Tablets (2)
- ✅ iPad Air
- ✅ iPad Mini

**Total: 10 browser/device configurations**

## New Features

### 1. Extended Playwright Configuration

**File:** `apps/web/playwright.config.ts`

**Enhancements:**
- Video capture on failure (`video: 'retain-on-failure'`)
- Screenshot on failure (already enabled)
- Test timeout: 30 seconds
- Assertion timeout: 5 seconds
- 6 new browser/device configurations added

**Browser Projects:**
```typescript
projects: [
  // Desktop Browsers
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  { name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },

  // Mobile Phones
  { name: 'iPhone 12', use: { ...devices['iPhone 12'] } },
  { name: 'iPhone 13 Pro', use: { ...devices['iPhone 13 Pro'] } },
  { name: 'Pixel 5', use: { ...devices['Pixel 5'] } },
  { name: 'Galaxy S9+', use: { ...devices['Galaxy S9+'] } },

  // Tablets
  { name: 'iPad Air', use: { ...devices['iPad (gen 7)'] } },
  { name: 'iPad Mini', use: { ...devices['iPad Mini'] } },
]
```

### 2. Responsive Design Tests

**File:** `apps/web/tests/e2e/responsive.spec.ts`

**Test Coverage:**
- Layout adaptation across 4 viewports (mobile, tablet, desktop, wide)
- Touch-friendly interface verification
- Text readability checks
- Navigation consistency
- Form input usability on mobile
- Image responsiveness
- Horizontal scroll prevention

**Viewports Tested:**
- Mobile: 375x667 (iPhone SE)
- Tablet: 768x1024 (iPad)
- Desktop: 1920x1080 (Full HD)
- Wide: 2560x1440 (2K)

### 3. CI/CD Cross-Browser Workflow

**File:** `.github/workflows/e2e-cross-browser.yml`

**Features:**
- Parallel execution across browser matrix
- 3-way sharding for faster execution
- Separate jobs for desktop, mobile, and tablet devices
- Artifact upload for test reports, videos, screenshots, and traces
- Test summary job to aggregate results

**Jobs:**
- `test`: Desktop browsers (chromium, firefox, webkit, edge) with 3-way sharding
- `mobile-test`: Mobile devices (iPhone 12, iPhone 13 Pro, Pixel 5, Galaxy S9+)
- `tablet-test`: Tablet devices (iPad Air, iPad Mini)
- `test-summary`: Aggregates results and reports overall status

**Matrix Strategy:**
```yaml
strategy:
  fail-fast: false
  matrix:
    browser: [chromium, firefox, webkit, edge]
    shard: [1/3, 2/3, 3/3]
```

### 4. Comprehensive Documentation

**Files Created:**
- `apps/web/tests/config/browsers.md` - Full browser testing guide
- `apps/web/tests/config/quick-reference.md` - Quick command reference

**Documentation Includes:**
- Supported browsers and devices
- Running tests (all browsers, specific browsers, grouped execution)
- Browser-specific considerations
- Viewport testing details
- Device emulation configuration
- CI/CD integration details
- Known issues and workarounds
- Performance testing tips
- Debugging tips
- Best practices

### 5. Project Infrastructure

**Files Modified/Created:**
- `.gitignore` - Added `screenshots` directory to ignore list
- `apps/web/screenshots/.gitkeep` - Placeholder for screenshots directory

## Usage

### Quick Start

```bash
# Install all browsers (first time only)
cd apps/web
npx playwright install --with-deps

# Run all tests on all browsers
yarn test:e2e

# Run tests with UI (recommended for development)
npx playwright test --ui
```

### Run Tests by Category

```bash
# Desktop browsers only
npx playwright test --project=chromium --project=firefox --project=webkit --project=edge

# Mobile devices only
npx playwright test --project="iPhone 12" --project="iPhone 13 Pro" --project="Pixel 5" --project="Galaxy S9+"

# Tablets only
npx playwright test --project="iPad Air" --project="iPad Mini"

# iOS devices (iPhone + iPad)
npx playwright test --project="iPhone 12" --project="iPhone 13 Pro" --project="iPad Air" --project="iPad Mini"

# Android devices
npx playwright test --project="Pixel 5" --project="Galaxy S9+"
```

### Run Specific Tests

```bash
# Run specific test file
npx playwright test tests/e2e/auth.spec.ts

# Run responsive tests
npx playwright test tests/e2e/responsive.spec.ts

# Run on specific browser
npx playwright test --project=chromium

# Run on mobile device
npx playwright test --project="iPhone 12"
```

### Debug Mode

```bash
# Debug mode (opens DevTools)
npx playwright test --debug

# UI mode (interactive)
npx playwright test --ui

# Headed mode (see browser)
npx playwright test --headed

# Slow motion
npx playwright test --slow-mo=1000
```

## CI/CD Integration

### Automatic Execution

The cross-browser tests run automatically on:
- Pull requests to `main` or `develop`
- Pushes to `main`
- Manual trigger via workflow_dispatch

### Execution Time

- Desktop browsers (with sharding): ~5-7 minutes per shard
- Mobile devices: ~10-15 minutes
- Tablets: ~5-10 minutes
- Total (parallel): ~15-20 minutes

### Artifacts

On test failure, the following artifacts are uploaded:
- **Test Reports:** HTML reports with detailed results
- **Videos:** Video recordings of failed tests
- **Screenshots:** Screenshots from failed tests and responsive tests
- **Traces:** Playwright traces for debugging

Artifacts are retained for 7 days.

## Test Coverage

### Core Functionality Tests

**Existing Tests:**
- Authentication flow (`auth.spec.ts`)
- Employer features (`employer.spec.ts`)
- Job listings (`jobs.spec.ts`)

**New Responsive Tests:**
- Layout adaptation across viewports
- Touch-friendly interface
- Text readability
- Navigation consistency
- Form input usability
- Image responsiveness
- Overflow prevention

### Browser-Specific Considerations

**iOS Safari (iPhone/iPad):**
- Touch event handling
- Virtual keyboard behavior
- Viewport height (vh) considerations
- Storage limitations in private mode

**Firefox:**
- Service Worker differences
- Download behavior variations
- CSS feature support differences

**WebKit:**
- Focus visible style differences
- Viewport unit behavior
- Date/time input UI differences

**Edge:**
- Chromium-based (similar to Chrome)
- Windows-specific features

**Android (Pixel/Galaxy):**
- Touch target sizes (minimum 48x48dp)
- Hardware back button
- Keyboard type variations

## Performance Optimizations

### Parallel Execution
- Desktop browsers run with 3-way sharding
- Mobile and tablet tests run in parallel
- CI uses single worker per shard to avoid resource contention

### Selective Browser Installation
```bash
# Install only needed browsers
npx playwright install chromium
npx playwright install firefox
npx playwright install webkit
npx playwright install msedge
```

### Local Development
```bash
# Run on fastest browser only
npx playwright test --project=chromium --workers=4
```

## Best Practices

1. **Write device-agnostic tests**
   - Use semantic selectors (`getByRole`, `getByLabel`)
   - Avoid device-specific CSS selectors
   - Let Playwright handle touch vs. mouse automatically

2. **Test responsive breakpoints**
   - Use `setViewportSize()` to test critical breakpoints
   - Verify layout adapts correctly at each size

3. **Verify touch target sizes**
   - Ensure buttons/links are at least 44x44px (WCAG guideline)
   - Use `boundingBox()` to verify sizes

4. **Handle browser differences gracefully**
   - Don't rely on browser-specific features
   - Test cross-browser compatibility explicitly

5. **Use appropriate waits**
   - `waitForLoadState('networkidle')` for full page load
   - `waitForSelector()` for dynamic content
   - Avoid hard-coded `waitForTimeout()` when possible

## Troubleshooting

### Common Issues

**Tests failing on mobile but passing on desktop?**
- Check touch target sizes
- Verify mobile menu navigation
- Inspect viewport-specific CSS

**Tests failing on WebKit/Safari?**
- Check focus visible styles
- Verify viewport height (vh) behavior
- Test with reduced security restrictions

**Tests slow on CI?**
- Use sharding to parallelize
- Reduce workers in CI environment
- Skip video recording for passing tests

**Flaky tests?**
- Add explicit waits for dynamic content
- Enable retries in config
- Check for race conditions

### Debugging Commands

```bash
# View test results
npx playwright show-report

# View trace files
npx playwright show-trace trace.zip

# Run with debug logging
DEBUG=pw:api npx playwright test

# Generate debug logs
PWDEBUG=1 npx playwright test
```

## Next Steps

### Recommended Enhancements

1. **Visual Regression Testing**
   - Integrate Percy.io or Chromatic
   - Add screenshot comparison tests

2. **Accessibility Testing**
   - Add axe-core for automated a11y checks
   - Test keyboard navigation
   - Verify screen reader compatibility

3. **Performance Testing**
   - Integrate Lighthouse CI
   - Add Core Web Vitals monitoring
   - Test on slow networks (3G, 4G)

4. **Additional Device Coverage**
   - Add more mobile devices (iPhone 14, Pixel 7)
   - Test landscape orientation
   - Add foldable device support

5. **Browser Version Matrix**
   - Test on older browser versions
   - Add browser compatibility matrix
   - Test beta/canary versions

## Resources

- [Browser Testing Guide](./tests/config/browsers.md)
- [Quick Reference](./tests/config/quick-reference.md)
- [Playwright Documentation](https://playwright.dev)
- [Device Emulation](https://playwright.dev/docs/emulation)
- [Best Practices](https://playwright.dev/docs/best-practices)

## Summary

JobSphere now has comprehensive cross-browser testing coverage across 10 browser/device configurations:
- 4 desktop browsers (Chrome, Firefox, Safari, Edge)
- 4 mobile phones (iPhone 12, iPhone 13 Pro, Pixel 5, Galaxy S9+)
- 2 tablets (iPad Air, iPad Mini)

All tests run automatically in CI with parallel execution, sharding, and artifact collection. The responsive test suite ensures the application works correctly across all viewport sizes and device types.
