# Screen Reader Accessibility Tests - Summary

## Overview

**File:** `apps/web/tests/a11y/screen-reader.spec.ts`
**Total Tests:** 28 comprehensive test cases
**Lines of Code:** 702
**Target:** WCAG 2.1 Level AA Compliance

## Test Breakdown

### 1. ARIA Labels (4 tests)
- ✅ Navigation has aria-label
- ✅ All interactive elements have accessible names
- ✅ Icon-only buttons have aria-label
- ✅ Links have descriptive aria-labels when needed

**WCAG:** 4.1.2 Name, Role, Value (Level A)

---

### 2. Live Regions (3 tests)
- ✅ Form errors use aria-live or role="alert"
- ✅ Search results count is announced
- ✅ Loading states are announced

**WCAG:** 4.1.3 Status Messages (Level AA)

---

### 3. Form Error Announcements (3 tests)
- ✅ Invalid fields have aria-invalid="true"
- ✅ Errors linked with aria-describedby
- ✅ Form error summaries announced

**WCAG:** 3.3.1 Error Identification (Level A), 3.3.3 Error Suggestion (Level AA)

---

### 4. Page Title Updates (3 tests)
- ✅ Title updates on navigation
- ✅ Titles are descriptive and unique
- ✅ Titles include branding

**WCAG:** 2.4.2 Page Titled (Level A)

---

### 5. Heading Hierarchy (3 tests)
- ✅ Each page has exactly one h1
- ✅ Headings follow logical hierarchy
- ✅ Headings describe content structure

**WCAG:** 1.3.1 Info and Relationships (Level A), 2.4.6 Headings and Labels (Level AA)

---

### 6. Landmark Regions (5 tests)
- ✅ Page has proper landmarks (header, nav, main, footer)
- ✅ Navigation landmarks have descriptive labels
- ✅ Main content has id for skip link
- ✅ Skip navigation link is present
- ✅ Multiple landmarks have unique labels

**WCAG:** 1.3.1 Info and Relationships (Level A), 2.4.1 Bypass Blocks (Level A)

---

### 7. Status and Live Region Announcements (3 tests)
- ✅ Success messages use role="status" or aria-live="polite"
- ✅ Critical alerts use role="alert" or aria-live="assertive"
- ✅ Loading indicators are announced

**WCAG:** 4.1.3 Status Messages (Level AA)

---

### 8. Dialog Accessibility (2 tests)
- ✅ Dialogs have role="dialog" and aria-labelledby
- ✅ Modal dialogs have aria-modal="true"

**WCAG:** 4.1.2 Name, Role, Value (Level A)

---

### 9. Form Input Accessibility (2 tests)
- ✅ All form inputs have associated labels
- ✅ Checkboxes have accessible labels

**WCAG:** 1.3.1 Info and Relationships (Level A), 4.1.2 Name, Role, Value (Level A)

---

## Pages Tested

1. **Homepage** (`/en`)
   - Navigation structure
   - Interactive elements
   - Headings and landmarks

2. **Jobs Listing** (`/en/jobs`)
   - Search functionality
   - Filter announcements
   - Results count
   - Loading states

3. **Login Page** (`/en/login`)
   - Form labels
   - Error messages
   - Validation feedback

4. **Signup Page** (`/en/signup`)
   - Form structure
   - Input associations

5. **Pricing Page** (`/en/pricing`)
   - Page titles
   - Content structure

6. **Dashboard** (`/en/dashboard`)
   - Authenticated content
   - Page structure

---

## Running the Tests

```bash
# Navigate to web app
cd apps/web

# Run all screen reader tests
yarn test:a11y screen-reader.spec.ts

# Run in UI mode (recommended)
yarn test:a11y:ui screen-reader.spec.ts

# Run in headed mode (see browser)
yarn test:a11y:headed screen-reader.spec.ts

# Run specific test
yarn test:a11y -g "navigation should have aria-label"

# Debug mode
yarn test:a11y:debug screen-reader.spec.ts
```

---

## Screen Readers Supported

- **NVDA** (Windows) - Free
- **JAWS** (Windows) - Commercial
- **VoiceOver** (macOS/iOS) - Built-in
- **TalkBack** (Android) - Built-in
- **Narrator** (Windows) - Built-in

---

## Key ARIA Attributes Tested

| Attribute | Purpose | Example |
|-----------|---------|---------|
| `aria-label` | Provides accessible name | `<button aria-label="Close">×</button>` |
| `aria-labelledby` | References element for label | `<div aria-labelledby="title">` |
| `aria-describedby` | Links description/error | `<input aria-describedby="error-msg">` |
| `aria-invalid` | Marks invalid input | `<input aria-invalid="true">` |
| `aria-live` | Announces updates | `<div aria-live="polite">` |
| `aria-modal` | Modal dialog indicator | `<div role="dialog" aria-modal="true">` |
| `role="alert"` | Urgent announcement | `<div role="alert">Error!</div>` |
| `role="status"` | Status update | `<div role="status">Loading...</div>` |
| `role="dialog"` | Dialog/modal window | `<div role="dialog">` |

---

## Test Execution Flow

### 1. Navigation Tests
```typescript
await page.goto('/en')
→ Verify nav has aria-label="Main navigation"
→ Check header has role="banner"
→ Verify all buttons have accessible names
```

### 2. Form Tests
```typescript
await page.goto('/en/login')
→ Fill form incorrectly
→ Submit form
→ Verify errors use role="alert"
→ Check aria-invalid on inputs
→ Verify aria-describedby links
```

### 3. Heading Tests
```typescript
await page.goto('/en')
→ Count h1 elements (should be 1)
→ Get all heading levels
→ Verify no skipped levels
```

### 4. Landmark Tests
```typescript
await page.goto('/en')
→ Verify header, nav, main, footer exist
→ Check navigation labels
→ Verify skip link targets main content
```

---

## Common Patterns Used

### Live Region Pattern
```typescript
// Test checks for:
<div role="alert">
  {errorMessage}
</div>

// Or:
<div aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>
```

### Form Error Pattern
```typescript
// Test checks for:
<input
  id="email"
  aria-invalid={hasError}
  aria-describedby={hasError ? "email-error" : undefined}
/>
{hasError && (
  <div id="email-error" role="alert">
    Error message
  </div>
)}
```

### Navigation Pattern
```typescript
// Test checks for:
<nav role="navigation" aria-label="Main navigation">
  <Link href="/jobs">Jobs</Link>
  <Link href="/pricing">Pricing</Link>
</nav>
```

### Landmark Pattern
```typescript
// Test checks for:
<header role="banner" aria-label="Site header">
  <nav aria-label="Main navigation">...</nav>
</header>

<main id="main-content">
  <h1>Page Title</h1>
  ...
</main>

<footer role="contentinfo">...</footer>
```

---

## Expected Results

All 28 tests should pass when:

1. ✅ Navigation has `aria-label="Main navigation"`
2. ✅ Header has `role="banner"` and `aria-label="Site header"`
3. ✅ All buttons have accessible names (text or aria-label)
4. ✅ Icon buttons have descriptive aria-label
5. ✅ Auth links have descriptive labels
6. ✅ Form errors use `role="alert"` or `aria-live`
7. ✅ Search results count is visible
8. ✅ Invalid inputs have `aria-invalid="true"`
9. ✅ Errors linked via `aria-describedby`
10. ✅ Page titles update on navigation
11. ✅ Each page has unique, descriptive title
12. ✅ All titles include "JobSphere"
13. ✅ Each page has exactly one h1
14. ✅ Headings follow logical order
15. ✅ Headings have meaningful text
16. ✅ Page has header, nav, main, footer
17. ✅ Multiple navs have unique labels
18. ✅ Main content has id for skip link
19. ✅ Skip link exists and works
20. ✅ Status messages use `role="status"`
21. ✅ Alerts use `role="alert"`
22. ✅ Loading states announced
23. ✅ Dialogs have `role="dialog"` and labels
24. ✅ Modals have `aria-modal="true"`
25. ✅ All inputs have labels
26. ✅ Checkboxes have labels
27. ✅ Form submission states announced
28. ✅ Dynamic content changes announced

---

## Troubleshooting

### Tests Failing?

**"Navigation has no aria-label"**
- Add `aria-label="Main navigation"` to `<nav>` element
- Check `apps/web/src/components/layout/header.tsx`

**"Button has no accessible name"**
- Add aria-label to icon-only buttons
- Ensure buttons have text content or aria-label

**"Form errors not announced"**
- Wrap errors in `<div role="alert">`
- Or use `aria-live="assertive"`

**"Page title not unique"**
- Update page metadata in Next.js
- Ensure each page has unique `<title>` tag

**"Heading hierarchy broken"**
- Check heading levels (h1→h2→h3, don't skip)
- Ensure only one h1 per page

**"Skip link not found"**
- Add skip link: `<a href="#main-content">Skip to content</a>`
- Ensure main has `id="main-content"`

---

## Documentation

- **Full Guide:** `SCREEN_READER_TESTING.md` - Detailed explanations and examples
- **Main README:** `README.md` - Overall accessibility testing guide
- **Test File:** `screen-reader.spec.ts` - Actual test implementation

---

## WCAG 2.1 Level AA Coverage

These tests help ensure compliance with:

- ✅ **1.3.1** Info and Relationships (Level A)
- ✅ **2.4.1** Bypass Blocks (Level A)
- ✅ **2.4.2** Page Titled (Level A)
- ✅ **2.4.6** Headings and Labels (Level AA)
- ✅ **3.3.1** Error Identification (Level A)
- ✅ **3.3.3** Error Suggestion (Level AA)
- ✅ **4.1.2** Name, Role, Value (Level A)
- ✅ **4.1.3** Status Messages (Level AA)

---

## Next Steps

1. ✅ Run tests: `yarn test:a11y screen-reader.spec.ts`
2. ✅ Fix any failing tests
3. ✅ Test manually with NVDA/VoiceOver
4. ✅ Add tests for new features
5. ✅ Integrate into CI/CD pipeline

---

## Maintenance

- Update tests when adding new pages
- Add tests for new interactive components
- Review and update ARIA patterns
- Keep in sync with WCAG updates
- Test with latest screen reader versions

---

**Last Updated:** 2026-01-03
**Playwright Version:** ^1.56.0
**Framework:** Next.js 14
**Testing Framework:** Playwright
