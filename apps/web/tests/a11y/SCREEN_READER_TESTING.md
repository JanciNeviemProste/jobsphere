# Screen Reader Accessibility Testing Guide

This guide provides detailed information about screen reader accessibility testing for the JobSphere application.

## Overview

Screen readers are assistive technologies that read web content aloud for users who are blind or have low vision. Our automated tests in `screen-reader.spec.ts` verify that the application provides proper semantics and ARIA attributes for screen reader compatibility.

## Supported Screen Readers

Our application is tested to work with:

- **NVDA (NonVisual Desktop Access)** - Free, Windows
- **JAWS (Job Access With Speech)** - Commercial, Windows
- **VoiceOver** - Built-in, macOS/iOS
- **TalkBack** - Built-in, Android
- **Narrator** - Built-in, Windows

## Test Coverage (31 Total Tests)

### 1. ARIA Labels (4 tests)

Ensures all interactive elements have accessible names that screen readers can announce.

**Tests:**
- Navigation has `aria-label="Main navigation"`
- All buttons have accessible names (via text, aria-label, or aria-labelledby)
- Icon-only buttons have descriptive aria-label
- Links have descriptive labels when needed

**WCAG Success Criteria:** 4.1.2 Name, Role, Value (Level A)

**Why it matters:** Screen readers announce "button" or "link" but users need to know what the button does. "Edit button" is useful; "Button" is not.

**Example:**
```tsx
// ✅ Good
<button aria-label="Close dialog">
  <XIcon />
</button>

// ❌ Bad
<button>
  <XIcon />
</button>
```

---

### 2. Live Regions (3 tests)

Verifies dynamic content updates are announced to screen readers without requiring user interaction.

**Tests:**
- Form errors use `role="alert"` or `aria-live="polite"`
- Search results count announced when filtering
- Loading states properly announced

**WCAG Success Criteria:** 4.1.3 Status Messages (Level AA)

**Why it matters:** When content changes dynamically (search results update, form error appears), screen reader users need to be notified without moving focus.

**ARIA Live Politeness Levels:**
- `aria-live="off"` - Default, no announcement
- `aria-live="polite"` - Announce when user is idle (search results, status messages)
- `aria-live="assertive"` - Announce immediately (errors, urgent alerts)

**Example:**
```tsx
// ✅ Good - Polite announcement for search results
<div aria-live="polite" aria-atomic="true">
  {jobCount} jobs found
</div>

// ✅ Good - Assertive for errors
<div role="alert">
  Invalid email address
</div>

// ❌ Bad - No announcement
<div>
  {jobCount} jobs found
</div>
```

---

### 3. Form Error Announcements (3 tests)

Ensures form validation errors are properly associated with inputs and announced.

**Tests:**
- Invalid fields have `aria-invalid="true"`
- Error messages linked via `aria-describedby`
- Error summaries announced on form submit

**WCAG Success Criteria:**
- 3.3.1 Error Identification (Level A)
- 3.3.3 Error Suggestion (Level AA)

**Why it matters:** Screen reader users need to know which field has an error and what the error is without visually scanning the form.

**Example:**
```tsx
// ✅ Good
<div>
  <label htmlFor="email">Email</label>
  <input
    id="email"
    type="email"
    aria-invalid={hasError}
    aria-describedby={hasError ? "email-error" : undefined}
  />
  {hasError && (
    <div id="email-error" role="alert">
      Please enter a valid email address
    </div>
  )}
</div>

// ❌ Bad
<div>
  <input type="email" />
  {hasError && <span style={{color: 'red'}}>Invalid email</span>}
</div>
```

---

### 4. Page Title Updates (3 tests)

Verifies page titles update on navigation to provide context.

**Tests:**
- Title updates when navigating between pages
- Each page has unique, descriptive title
- All titles include "JobSphere" branding

**WCAG Success Criteria:** 2.4.2 Page Titled (Level A)

**Why it matters:** Screen readers announce the page title when navigating. This is often the first thing users hear and helps them understand where they are.

**Example:**
```tsx
// ✅ Good
<title>Jobs | JobSphere</title>
<title>Software Engineer at TechCorp | JobSphere</title>

// ❌ Bad
<title>JobSphere</title> {/* Same on all pages */}
<title>Page</title>
```

---

### 5. Heading Hierarchy (3 tests)

Ensures proper heading structure for screen reader navigation.

**Tests:**
- Each page has exactly one h1
- Headings follow logical order (no skipped levels)
- Headings have meaningful content

**WCAG Success Criteria:**
- 1.3.1 Info and Relationships (Level A)
- 2.4.6 Headings and Labels (Level AA)

**Why it matters:** Screen reader users navigate by headings (H key in NVDA/JAWS). A proper hierarchy creates a document outline that makes sense.

**Example:**
```tsx
// ✅ Good
<h1>Job Listings</h1>
<section>
  <h2>Software Engineering</h2>
  <h3>Frontend Developer</h3>
  <h3>Backend Developer</h3>
</section>
<section>
  <h2>Design</h2>
  <h3>UX Designer</h3>
</section>

// ❌ Bad
<h1>Job Listings</h1>
<h3>Software Engineering</h3> {/* Skipped h2 */}
<h4>Frontend Developer</h4>
```

---

### 6. Landmark Regions (5 tests)

Verifies proper semantic HTML landmarks for screen reader navigation.

**Tests:**
- Page has header, nav, main, footer landmarks
- Navigation landmarks have descriptive labels
- Main content has id for skip link
- Multiple landmarks of same type have unique labels

**WCAG Success Criteria:**
- 1.3.1 Info and Relationships (Level A)
- 2.4.1 Bypass Blocks (Level A)

**Why it matters:** Screen readers can jump directly to landmarks (D key in NVDA/JAWS), allowing users to quickly navigate to main content, navigation, etc.

**Landmark Roles:**
- `<header>` or `role="banner"` - Site header
- `<nav>` or `role="navigation"` - Navigation menu
- `<main>` or `role="main"` - Main content (one per page)
- `<footer>` or `role="contentinfo"` - Site footer
- `<aside>` or `role="complementary"` - Sidebar
- `role="search"` - Search form

**Example:**
```tsx
// ✅ Good
<header role="banner" aria-label="Site header">
  <nav aria-label="Main navigation">...</nav>
  <nav aria-label="User account">...</nav>
</header>

<main id="main-content">
  <h1>Page Title</h1>
  ...
</main>

<footer role="contentinfo">...</footer>

// ❌ Bad
<div className="header">
  <div className="nav">...</div>
</div>
```

---

### 7. Status and Live Regions (3 tests)

Ensures status messages and updates are properly announced.

**Tests:**
- Success messages use `role="status"` or `aria-live="polite"`
- Critical alerts use `role="alert"` or `aria-live="assertive"`
- Loading indicators announced

**WCAG Success Criteria:** 4.1.3 Status Messages (Level AA)

**Why it matters:** Users need to know when actions succeed/fail or when content is loading, without focus changing.

**When to use each:**
- `role="status"` / `aria-live="polite"` - Non-critical updates (job saved, search complete)
- `role="alert"` / `aria-live="assertive"` - Errors, warnings, urgent messages

**Example:**
```tsx
// ✅ Good - Success message
<div role="status" aria-live="polite">
  Job application submitted successfully
</div>

// ✅ Good - Error
<div role="alert">
  Failed to submit application. Please try again.
</div>

// ✅ Good - Loading
<div role="status" aria-live="polite">
  <Spinner /> Loading jobs...
</div>
```

---

### 8. Dialog Accessibility (2 tests)

Verifies modals and dialogs are properly announced.

**Tests:**
- Dialogs have `role="dialog"` and `aria-labelledby` or `aria-label`
- Modal dialogs have `aria-modal="true"`

**WCAG Success Criteria:** 4.1.2 Name, Role, Value (Level A)

**Why it matters:** Screen reader users need to know when a dialog opens and what it's for. `aria-modal="true"` tells screen readers to limit navigation to the modal.

**Example:**
```tsx
// ✅ Good
<div
  role="dialog"
  aria-labelledby="dialog-title"
  aria-modal="true"
>
  <h2 id="dialog-title">Confirm Delete</h2>
  <p>Are you sure you want to delete this job?</p>
  <button>Cancel</button>
  <button>Delete</button>
</div>

// ❌ Bad
<div className="modal">
  <h2>Confirm Delete</h2>
  ...
</div>
```

---

### 9. Form Input Accessibility (2 tests)

Ensures all form inputs are properly labeled.

**Tests:**
- All inputs have associated labels
- Checkboxes have accessible labels

**WCAG Success Criteria:**
- 1.3.1 Info and Relationships (Level A)
- 4.1.2 Name, Role, Value (Level A)

**Why it matters:** Screen readers announce the label when focus enters an input. Without labels, users don't know what to type.

**Example:**
```tsx
// ✅ Good
<label htmlFor="email">Email address</label>
<input id="email" type="email" />

// ✅ Good - aria-label when visual label not needed
<input type="search" aria-label="Search jobs" />

// ❌ Bad
<input type="email" placeholder="Email" /> {/* Placeholder is not a label */}
```

---

## Running the Tests

```bash
# Run all screen reader tests
cd apps/web
yarn test:a11y screen-reader.spec.ts

# Run in UI mode
yarn test:a11y:ui screen-reader.spec.ts

# Run in headed mode (see browser)
yarn test:a11y:headed screen-reader.spec.ts

# Run specific test
yarn test:a11y -g "navigation should have aria-label"
```

## Manual Testing with Screen Readers

While automated tests verify attributes, manual testing with actual screen readers is essential.

### Testing with NVDA (Windows)

1. **Install NVDA:** https://www.nvaccess.org/download/
2. **Start NVDA:** Ctrl+Alt+N
3. **Navigate:**
   - H / Shift+H - Jump between headings
   - D / Shift+D - Jump between landmarks
   - F / Shift+F - Jump between form fields
   - K / Shift+K - Jump between links
   - B / Shift+B - Jump between buttons
   - Insert+F7 - Elements list (headings, links, etc.)
4. **Stop NVDA:** Insert+Q

### Testing with VoiceOver (macOS)

1. **Start VoiceOver:** Cmd+F5
2. **Navigate:**
   - VO+Right Arrow - Next item
   - VO+Left Arrow - Previous item
   - VO+U - Rotor (quick navigation)
   - VO+H - Next heading
   - VO+L - Next link
   - VO+J - Next form control
3. **Stop VoiceOver:** Cmd+F5

### Testing with JAWS (Windows)

1. **Start JAWS:** (Commercial software, similar to NVDA)
2. **Navigate:**
   - H / Shift+H - Headings
   - D / Shift+D - Landmarks
   - F / Shift+F - Form fields
   - Insert+F6 - Headings list
   - Insert+Ctrl+; - Elements list

## Common Issues and Fixes

### Issue: Button announced as "Button" with no description

**Fix:** Add aria-label or visible text
```tsx
// Before
<button><TrashIcon /></button>

// After
<button aria-label="Delete job"><TrashIcon /></button>
```

---

### Issue: Form errors not announced

**Fix:** Use role="alert" or aria-live
```tsx
// Before
<div className="error">{error}</div>

// After
<div role="alert">{error}</div>
```

---

### Issue: Dynamic content changes not announced

**Fix:** Add aria-live region
```tsx
// Before
<div>{searchResults.length} results</div>

// After
<div aria-live="polite" aria-atomic="true">
  {searchResults.length} results
</div>
```

---

### Issue: Form field has no label

**Fix:** Add visible label or aria-label
```tsx
// Before
<input type="text" placeholder="Search" />

// After - Option 1: Visible label
<label htmlFor="search">Search</label>
<input id="search" type="text" placeholder="Search" />

// After - Option 2: aria-label
<input type="text" aria-label="Search jobs" placeholder="Search" />
```

---

### Issue: Navigation announced multiple times

**Fix:** Add unique aria-label to each nav
```tsx
// Before
<nav>...</nav>
<nav>...</nav>

// After
<nav aria-label="Main navigation">...</nav>
<nav aria-label="User account">...</nav>
```

---

## Best Practices

### DO:
- ✅ Use semantic HTML (`<nav>`, `<main>`, `<button>`) when possible
- ✅ Provide text alternatives for icons (aria-label)
- ✅ Use `role="alert"` for errors
- ✅ Use `aria-live="polite"` for status updates
- ✅ Label all form inputs
- ✅ Maintain logical heading hierarchy
- ✅ Announce loading states
- ✅ Test with actual screen readers

### DON'T:
- ❌ Use `<div>` or `<span>` for interactive elements
- ❌ Rely on placeholders as labels
- ❌ Skip heading levels (h1 → h3)
- ❌ Use color alone to convey information
- ❌ Have multiple unlabeled navigation regions
- ❌ Forget to announce dynamic content changes
- ❌ Rely only on automated tests

## Resources

### Screen Readers
- [NVDA Download](https://www.nvaccess.org/download/)
- [JAWS Trial](https://www.freedomscientific.com/downloads/jaws/)
- [VoiceOver User Guide](https://support.apple.com/guide/voiceover/welcome/mac)

### Documentation
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Screen Reader Survey](https://webaim.org/projects/screenreadersurvey9/)
- [MDN ARIA](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA)
- [A11y Project](https://www.a11yproject.com/)

### Testing Tools
- [Accessibility Insights](https://accessibilityinsights.io/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)

## Support

For questions about screen reader testing:
- Review this guide
- Check existing test examples in `screen-reader.spec.ts`
- Test with actual screen readers
- Consult ARIA Authoring Practices Guide
- Ask in team accessibility channel
