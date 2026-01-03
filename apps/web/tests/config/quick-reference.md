# Playwright Cross-Browser Testing - Quick Reference

## Quick Start

```bash
# Install all browsers (first time only)
npx playwright install --with-deps

# Run all tests on all browsers
yarn test:e2e

# Run tests with UI (recommended for development)
npx playwright test --ui
```

## Run Tests by Browser Category

### Desktop Browsers
```bash
# All desktop browsers
npx playwright test --project=chromium --project=firefox --project=webkit --project=edge

# Individual browsers
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
npx playwright test --project=edge
```

### Mobile Devices
```bash
# All mobile devices
npx playwright test --project="iPhone 12" --project="iPhone 13 Pro" --project="Pixel 5" --project="Galaxy S9+"

# Individual devices
npx playwright test --project="iPhone 12"
npx playwright test --project="iPhone 13 Pro"
npx playwright test --project="Pixel 5"
npx playwright test --project="Galaxy S9+"
```

### Tablets
```bash
# All tablets
npx playwright test --project="iPad Air" --project="iPad Mini"

# Individual tablets
npx playwright test --project="iPad Air"
npx playwright test --project="iPad Mini"
```

### iOS Devices (iPhone + iPad)
```bash
npx playwright test --project="iPhone 12" --project="iPhone 13 Pro" --project="iPad Air" --project="iPad Mini"
```

### Android Devices
```bash
npx playwright test --project="Pixel 5" --project="Galaxy S9+"
```

## Run Specific Test Files

```bash
# Run specific test on all browsers
npx playwright test tests/e2e/auth.spec.ts

# Run specific test on one browser
npx playwright test tests/e2e/auth.spec.ts --project=chromium

# Run responsive tests only
npx playwright test tests/e2e/responsive.spec.ts

# Run specific test case
npx playwright test -g "should display homepage"
```

## Debugging

```bash
# Debug mode (opens browser DevTools)
npx playwright test --debug

# Debug specific browser
npx playwright test --project="iPhone 12" --debug

# Debug specific test
npx playwright test tests/e2e/auth.spec.ts --debug

# Headed mode (see browser)
npx playwright test --headed

# Slow motion (see actions)
npx playwright test --slow-mo=1000

# UI mode (best for debugging)
npx playwright test --ui
```

## View Reports

```bash
# View HTML report
npx playwright show-report

# View trace (after test with --trace flag)
npx playwright show-trace trace.zip
```

## CI/CD

```bash
# Run as CI would (with retries, single worker)
CI=true npx playwright test

# Run specific shard (for parallel execution)
npx playwright test --shard=1/3
npx playwright test --shard=2/3
npx playwright test --shard=3/3
```

## Configuration

### Browser Matrix
- **Desktop:** Chromium, Firefox, WebKit, Edge
- **Mobile:** iPhone 12, iPhone 13 Pro, Pixel 5, Galaxy S9+
- **Tablet:** iPad Air, iPad Mini
- **Total:** 10 configurations

### Test Features
- Video recording on failure
- Screenshots on failure
- Trace on first retry
- 2 retries in CI
- Parallel execution with sharding

### Timeouts
- Test timeout: 30 seconds
- Assertion timeout: 5 seconds
- Action timeout: 10 seconds
- Navigation timeout: 30 seconds

## Useful Flags

```bash
# List all available projects
npx playwright test --list

# Update snapshots
npx playwright test --update-snapshots

# Run tests in parallel
npx playwright test --workers=4

# Run tests sequentially
npx playwright test --workers=1

# Fail fast (stop on first failure)
npx playwright test --max-failures=1

# Repeat tests (flakiness detection)
npx playwright test --repeat-each=3

# Run only failed tests from last run
npx playwright test --last-failed
```

## Environment Variables

```bash
# Change base URL
PLAYWRIGHT_TEST_BASE_URL=http://localhost:4000 npx playwright test

# Enable debug mode
PWDEBUG=1 npx playwright test

# Show browser
HEADED=1 npx playwright test
```

## Common Test Patterns

### Test at specific viewport
```typescript
await page.setViewportSize({ width: 1920, height: 1080 })
```

### Test touch interactions
```typescript
await element.tap() // For mobile/touch devices
await element.click() // For desktop/mouse
```

### Check responsive breakpoints
```typescript
const breakpoints = [375, 768, 1024, 1920]
for (const width of breakpoints) {
  await page.setViewportSize({ width, height: 800 })
  // Run assertions
}
```

### Verify touch target size
```typescript
const box = await element.boundingBox()
expect(box.height).toBeGreaterThanOrEqual(44) // WCAG minimum
```

## Troubleshooting

### Tests failing on mobile but passing on desktop?
- Check touch target sizes (minimum 44x44px)
- Verify mobile menu navigation
- Check viewport-specific CSS

### Tests failing on WebKit/Safari?
- iOS Safari has stricter security
- Check focus visible styles
- Verify viewport height (vh) behavior

### Tests slow on CI?
- Use sharding: `--shard=1/3`
- Reduce workers in CI: `--workers=1`
- Skip unnecessary video recording

### Flaky tests?
- Add explicit waits: `await page.waitForLoadState('networkidle')`
- Use retries: `retries: 2` in config
- Check for race conditions

## Performance

### Fastest test execution
```bash
# Run on single browser (Chromium is fastest)
npx playwright test --project=chromium --workers=4
```

### Comprehensive testing (slower)
```bash
# Run on all browsers with sharding
npx playwright test --shard=1/3
```

### Recommended for local development
```bash
# Use UI mode for interactive testing
npx playwright test --ui --project=chromium
```

## Resources

- [Full Browser Testing Guide](./browsers.md)
- [Playwright Documentation](https://playwright.dev)
- [Device Emulation](https://playwright.dev/docs/emulation)
- [Debugging Guide](https://playwright.dev/docs/debug)
