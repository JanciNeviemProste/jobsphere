# Screen Reader Accessibility - Quick Reference Card

## Quick Test Commands

```bash
# Run all screen reader tests
yarn test:a11y screen-reader.spec.ts

# Run in UI mode
yarn test:a11y:ui screen-reader.spec.ts

# Run specific test
yarn test:a11y -g "navigation should have aria-label"
```

---

## Essential ARIA Attributes

| Use Case | ARIA Attribute | Example |
|----------|---------------|---------|
| **Icon button** | `aria-label` | `<button aria-label="Close">×</button>` |
| **Form error** | `role="alert"` | `<div role="alert">{error}</div>` |
| **Invalid input** | `aria-invalid="true"` | `<input aria-invalid={hasError} />` |
| **Link error to input** | `aria-describedby` | `<input aria-describedby="error-id" />` |
| **Status update** | `role="status"` | `<div role="status">Saved!</div>` |
| **Dynamic update** | `aria-live="polite"` | `<div aria-live="polite">{count} results</div>` |
| **Urgent update** | `aria-live="assertive"` | `<div aria-live="assertive">Error!</div>` |
| **Navigation** | `aria-label` | `<nav aria-label="Main navigation">` |
| **Modal dialog** | `aria-modal="true"` | `<div role="dialog" aria-modal="true">` |
| **Loading state** | `aria-busy="true"` | `<div aria-busy={isLoading}>` |

---

## Common Patterns

### ✅ Icon Button
```tsx
<button aria-label="Delete job">
  <TrashIcon />
</button>
```

### ✅ Form Error
```tsx
<div>
  <input
    id="email"
    aria-invalid={hasError}
    aria-describedby={hasError ? "email-error" : undefined}
  />
  {hasError && (
    <div id="email-error" role="alert">
      Invalid email address
    </div>
  )}
</div>
```

### ✅ Search Results
```tsx
<div aria-live="polite" aria-atomic="true">
  {count} jobs found
</div>
```

### ✅ Navigation
```tsx
<nav aria-label="Main navigation">
  <Link href="/jobs">Jobs</Link>
  <Link href="/pricing">Pricing</Link>
</nav>
```

### ✅ Modal Dialog
```tsx
<div
  role="dialog"
  aria-labelledby="dialog-title"
  aria-modal="true"
>
  <h2 id="dialog-title">Confirm Action</h2>
  <p>Are you sure?</p>
  <button>Cancel</button>
  <button>Confirm</button>
</div>
```

### ✅ Loading State
```tsx
<div role="status" aria-live="polite">
  <Spinner /> Loading...
</div>
```

### ✅ Success Message
```tsx
<div role="status" aria-live="polite">
  Job saved successfully!
</div>
```

### ✅ Form Label
```tsx
<div>
  <label htmlFor="email">Email address</label>
  <input id="email" type="email" />
</div>
```

---

## ARIA Live Politeness

| Level | Use For | Example |
|-------|---------|---------|
| `off` (default) | No announcement | Static content |
| `polite` | Non-urgent updates | Search results, saved confirmation |
| `assertive` | Urgent updates | Errors, warnings, time-sensitive alerts |

---

## Landmark Roles

```tsx
<header role="banner">Site header</header>
<nav role="navigation" aria-label="Main navigation">Menu</nav>
<main role="main" id="main-content">Content</main>
<aside role="complementary">Sidebar</aside>
<footer role="contentinfo">Footer</footer>
```

---

## Heading Hierarchy

```tsx
✅ GOOD:
<h1>Page Title</h1>
  <h2>Section</h2>
    <h3>Subsection</h3>
    <h3>Another Subsection</h3>
  <h2>Another Section</h2>

❌ BAD:
<h1>Page Title</h1>
  <h3>Section</h3>  {/* Skipped h2 */}
```

---

## Common Mistakes to Avoid

| ❌ Don't | ✅ Do |
|---------|------|
| `<button><Icon /></button>` | `<button aria-label="Delete"><Icon /></button>` |
| `<div className="error">{error}</div>` | `<div role="alert">{error}</div>` |
| `<input placeholder="Email" />` | `<label htmlFor="email">Email</label><input id="email" />` |
| `<div onClick={...}>Click me</div>` | `<button onClick={...}>Click me</button>` |
| `<h1>Title</h1><h3>Section</h3>` | `<h1>Title</h1><h2>Section</h2>` |
| `<nav><nav>` (multiple unlabeled) | `<nav aria-label="Main"><nav aria-label="User">` |
| Dynamic content with no announcement | `<div aria-live="polite">{dynamic}</div>` |

---

## Testing Checklist

- [ ] All buttons have accessible names
- [ ] Icon-only buttons have `aria-label`
- [ ] Form errors use `role="alert"`
- [ ] Invalid inputs have `aria-invalid="true"`
- [ ] Errors linked via `aria-describedby`
- [ ] Navigation has `aria-label`
- [ ] Page title updates on navigation
- [ ] Each page has one h1
- [ ] Headings don't skip levels
- [ ] Landmarks properly labeled
- [ ] Skip link exists
- [ ] Dynamic updates announced
- [ ] Modals have `role="dialog"`

---

## Screen Reader Keyboard Shortcuts

### NVDA (Windows)
- **Start:** Ctrl+Alt+N
- **Navigate headings:** H / Shift+H
- **Navigate landmarks:** D / Shift+D
- **Navigate links:** K / Shift+K
- **Navigate form fields:** F / Shift+F
- **Elements list:** Insert+F7

### VoiceOver (macOS)
- **Start:** Cmd+F5
- **Navigate forward:** VO+Right Arrow (VO = Ctrl+Option)
- **Navigate back:** VO+Left Arrow
- **Rotor (quick nav):** VO+U
- **Next heading:** VO+H
- **Next link:** VO+L

---

## WCAG Success Criteria

| Level | Criterion | What to Check |
|-------|-----------|---------------|
| A | 1.3.1 Info and Relationships | Semantic HTML, ARIA |
| A | 2.4.1 Bypass Blocks | Skip links |
| A | 2.4.2 Page Titled | Unique page titles |
| A | 3.3.1 Error Identification | Error messages |
| A | 4.1.2 Name, Role, Value | ARIA labels |
| AA | 2.4.6 Headings and Labels | Descriptive headings |
| AA | 3.3.3 Error Suggestion | Error suggestions |
| AA | 4.1.3 Status Messages | Live regions |

---

## Debug Failed Tests

### "Navigation has no aria-label"
```tsx
// Fix: Add aria-label to nav
<nav aria-label="Main navigation">
```

### "Button has no accessible name"
```tsx
// Fix: Add aria-label or text
<button aria-label="Close dialog">×</button>
```

### "Form error not announced"
```tsx
// Fix: Use role="alert"
<div role="alert">{errorMessage}</div>
```

### "Invalid input has no aria-invalid"
```tsx
// Fix: Add aria-invalid
<input aria-invalid={hasError} />
```

### "Error not linked to input"
```tsx
// Fix: Use aria-describedby
<input aria-describedby="error-id" />
<div id="error-id" role="alert">{error}</div>
```

---

## Resources

- **Full Guide:** `SCREEN_READER_TESTING.md`
- **Test Summary:** `SCREEN_READER_TESTS_SUMMARY.md`
- **Main A11y README:** `README.md`
- **ARIA Practices:** https://www.w3.org/WAI/ARIA/apg/
- **WCAG Quick Ref:** https://www.w3.org/WAI/WCAG21/quickref/

---

## When to Use What

| Scenario | Solution |
|----------|----------|
| Icon-only button | `aria-label="Description"` |
| Form validation error | `role="alert"` + `aria-invalid` + `aria-describedby` |
| Search results update | `aria-live="polite"` |
| Success notification | `role="status"` or `aria-live="polite"` |
| Critical error | `role="alert"` or `aria-live="assertive"` |
| Loading state | `role="status"` + loading text |
| Modal dialog | `role="dialog"` + `aria-modal="true"` + `aria-labelledby` |
| Multiple navs | Each has unique `aria-label` |
| Form input | `<label htmlFor="id">` + `<input id="id">` |
| Help text | `aria-describedby` pointing to help text |

---

**Print this page and keep it nearby while developing!**
