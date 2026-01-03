# Cross-Browser Testing Guide

## Supported Browsers

JobSphere is tested on a comprehensive matrix of browsers and devices to ensure consistent functionality across all platforms.

### Desktop Browsers (4)
- **Chrome (Chromium)** - Latest stable
- **Firefox** - Latest stable
- **Safari (WebKit)** - Latest stable (macOS)
- **Edge** - Latest stable (Chromium-based)

### Mobile Phones (4)
- **iPhone 12** - iOS Safari
- **iPhone 13 Pro** - iOS Safari
- **Pixel 5** - Chrome for Android
- **Galaxy S9+** - Chrome for Android

### Tablets (2)
- **iPad Air** - iOS Safari
- **iPad Mini** - iOS Safari

**Total:** 10 browser/device configurations

## Running Tests

### All Browsers
```bash
# From project root
cd apps/web
yarn test:e2e
```

### Specific Browser
```bash
# Desktop browsers
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
npx playwright test --project=edge

# Mobile devices
npx playwright test --project="iPhone 12"
npx playwright test --project="iPhone 13 Pro"
npx playwright test --project="Pixel 5"
npx playwright test --project="Galaxy S9+"

# Tablets
npx playwright test --project="iPad Air"
npx playwright test --project="iPad Mini"
```

### Grouped Test Execution

#### Mobile Only
```bash
npx playwright test --project="iPhone 12" --project="iPhone 13 Pro" --project="Pixel 5" --project="Galaxy S9+"
```

#### Tablets Only
```bash
npx playwright test --project="iPad Air" --project="iPad Mini"
```

#### Desktop Only
```bash
npx playwright test --project=chromium --project=firefox --project=webkit --project=edge
```

#### iOS Devices Only (iPhone + iPad)
```bash
npx playwright test --project="iPhone*" --project="iPad*"
```

### Run Specific Test File
```bash
# On all browsers
npx playwright test tests/e2e/auth.spec.ts

# On specific browser
npx playwright test tests/e2e/auth.spec.ts --project=chromium

# Responsive tests only
npx playwright test tests/e2e/responsive.spec.ts
```

### Debug Mode
```bash
# Debug on specific browser
npx playwright test --project=chromium --debug

# Debug on mobile device
npx playwright test --project="iPhone 12" --debug
```

### UI Mode (Interactive)
```bash
# Recommended for development
npx playwright test --ui
```

## Browser-Specific Considerations

### Chrome (Chromium)
- **Strengths:** Fast execution, excellent DevTools integration
- **Use for:** Primary development and testing
- **Notes:** Edge uses the same engine, so behavior is nearly identical

### Firefox
- **Strengths:** Independent rendering engine, good standards compliance
- **Use for:** Cross-engine compatibility verification
- **Notes:**
  - Service Worker behavior may differ slightly
  - Download dialogs work differently
  - Some CSS features may have different support

### Safari (WebKit)
- **Strengths:** iOS compatibility testing
- **Use for:** Ensuring iOS/macOS compatibility
- **Notes:**
  - Focus visible styles may render differently
  - Viewport units (vh/vw) behavior can vary
  - Date/time input types have different UI
  - Private browsing has strict limitations

### Edge
- **Strengths:** Windows-specific features, Chromium compatibility
- **Use for:** Windows platform verification
- **Notes:**
  - Uses Chromium engine (v79+)
  - Most features identical to Chrome
  - Windows-specific integrations may differ

### iOS Safari (iPhone/iPad)
- **Critical for:** Mobile-first testing
- **Notes:**
  - Touch event handling required for interactions
  - Virtual keyboard affects viewport height
  - Viewport units (vh) include/exclude Safari UI bars
  - No support for some desktop-only features
  - Private mode has strict storage limitations
  - Service Workers have different lifecycle

### Chrome for Android (Pixel, Galaxy)
- **Critical for:** Android platform testing
- **Notes:**
  - Touch targets should be minimum 48x48dp
  - Hardware back button behavior
  - Different keyboard types (email, number, etc.)
  - Chrome custom tabs integration

## Viewport Testing

Tests run at these standard viewports:

| Viewport | Width | Height | Use Case |
|----------|-------|--------|----------|
| Mobile   | 375px | 667px  | iPhone SE, small phones |
| Tablet   | 768px | 1024px | iPad portrait |
| Desktop  | 1920px| 1080px | Full HD monitors |
| Wide     | 2560px| 1440px | 2K/QHD monitors |

### Custom Viewport Testing
```typescript
await page.setViewportSize({ width: 1366, height: 768 })
```

## Device Emulation

Playwright uses device descriptors from Chromium DevTools. Each device includes:
- User Agent string
- Viewport size
- Device pixel ratio
- Touch support
- Mobile flag

Example device configuration:
```typescript
use: {
  ...devices['iPhone 12'],
  // Override specific properties if needed
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
}
```

## CI/CD Integration

Tests run automatically on all browsers in CI/CD pipeline:
- **Trigger:** Every PR to `main` or `develop` branches
- **Execution:** Parallel across browser matrix
- **Sharding:** 3-way split for faster execution
- **Artifacts:** Videos and screenshots captured on failure
- **Reports:** HTML reports uploaded as artifacts

### CI Test Execution Time
- Single browser: ~5-10 minutes
- All browsers (parallel): ~10-15 minutes
- With sharding: ~5-7 minutes per shard

## Test Artifacts

### Screenshots
- Captured automatically on test failure
- Stored in `screenshots/` directory
- Uploaded to CI artifacts on failure
- Named by viewport/test: `mobile-jobs.png`

### Videos
- Recorded when tests fail (`video: 'retain-on-failure'`)
- Stored in `test-results/` directory
- Uploaded to CI artifacts
- Useful for debugging flaky tests

### Traces
- Generated on first retry (`trace: 'on-first-retry'`)
- Contains full test execution timeline
- View with: `npx playwright show-trace trace.zip`

### HTML Reports
- Generated after test run
- View with: `npx playwright show-report`
- Includes screenshots, videos, and traces

## Known Issues & Workarounds

### iOS Safari
**Issue:** Focus visible styles may differ
```typescript
// Workaround: Use explicit focus indicators
await page.focus('input')
await page.waitForSelector('input:focus')
```

**Issue:** Viewport height (vh) includes Safari UI
```typescript
// Workaround: Use window.innerHeight or CSS env()
const viewportHeight = await page.evaluate(() => window.innerHeight)
```

**Issue:** Touch event handling
```typescript
// Use tap() instead of click() for touch devices
if (isMobile) {
  await element.tap()
} else {
  await element.click()
}
```

### Firefox
**Issue:** Service Worker registration timing
```typescript
// Workaround: Add explicit wait
await page.waitForTimeout(1000)
await page.waitForFunction(() => 'serviceWorker' in navigator)
```

**Issue:** Download behavior differs
```typescript
// Use download event handler
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.click('a[download]')
])
```

### WebKit
**Issue:** Date input rendering
```typescript
// Workaround: Use data-testid and avoid relying on visual appearance
await page.fill('[data-testid="date-input"]', '2024-01-01')
```

## Performance Testing

### Lighthouse CI (Coming Soon)
- Performance audits across browsers
- Accessibility checks
- SEO validation
- Best practices verification

### Load Testing
```bash
# Use k6 or similar for load testing
# Separate from Playwright E2E tests
```

## Accessibility Testing

### ARIA Compliance
All tests should verify:
- Proper ARIA labels
- Keyboard navigation
- Screen reader compatibility

```typescript
// Example: Check for proper ARIA labels
await expect(page.locator('[aria-label="Close menu"]')).toBeVisible()
```

### Color Contrast
- Automated checks via axe-core (coming soon)
- Manual verification on different devices

## Visual Regression Testing (Future)

Consider adding visual regression with:
- Percy.io
- Chromatic
- Playwright's built-in screenshot comparison

```typescript
await expect(page).toHaveScreenshot('homepage.png')
```

## Best Practices

1. **Write device-agnostic tests when possible**
   ```typescript
   // Good: Works on all devices
   await page.getByRole('button', { name: 'Submit' }).click()

   // Avoid: Device-specific selectors
   await page.locator('.mobile-menu-button').click()
   ```

2. **Use semantic selectors**
   ```typescript
   // Good
   await page.getByRole('link', { name: 'Home' })

   // Avoid
   await page.locator('div > a:nth-child(1)')
   ```

3. **Handle both touch and mouse events**
   ```typescript
   const button = page.getByRole('button')

   // Playwright automatically handles device type
   await button.click() // Works on both touch and mouse
   ```

4. **Test responsive breakpoints**
   ```typescript
   // Test at critical breakpoints
   const breakpoints = [375, 768, 1024, 1920]
   for (const width of breakpoints) {
     await page.setViewportSize({ width, height: 800 })
     // Run assertions
   }
   ```

5. **Verify touch target sizes**
   ```typescript
   const box = await element.boundingBox()
   expect(box.height).toBeGreaterThanOrEqual(44) // WCAG minimum
   ```

## Debugging Tips

### Browser DevTools
```bash
# Open browser DevTools during test
PWDEBUG=1 npx playwright test --project=chromium
```

### Headed Mode
```bash
# See the browser during test execution
npx playwright test --headed --project="iPhone 12"
```

### Slow Motion
```bash
# Slow down execution to observe
npx playwright test --slow-mo=1000
```

### Console Logs
```typescript
// Capture browser console logs
page.on('console', msg => console.log('Browser:', msg.text()))
```

### Network Monitoring
```typescript
// Monitor network requests
page.on('request', request => console.log('Request:', request.url()))
page.on('response', response => console.log('Response:', response.status()))
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Device Descriptors](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/deviceDescriptors.ts)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Mobile Testing Guide](https://playwright.dev/docs/emulation)
- [Accessibility Testing](https://playwright.dev/docs/accessibility-testing)

## Support

For issues or questions:
1. Check existing tests in `tests/e2e/`
2. Review Playwright documentation
3. Run tests with `--debug` flag
4. Check CI logs for detailed error messages
