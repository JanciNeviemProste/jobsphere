# Common Accessibility Fixes

Quick reference guide for fixing common accessibility violations found by axe-core.

## Color Contrast Issues

### Problem
```
color-contrast: Elements must have sufficient color contrast
```

### Requirements
- **Normal text** (< 18pt, or < 14pt bold): Minimum 4.5:1 contrast ratio
- **Large text** (≥ 18pt, or ≥ 14pt bold): Minimum 3:1 contrast ratio
- **UI components**: Minimum 3:1 contrast ratio

### Fix Examples

#### Bad
```tsx
<p className="text-gray-400 bg-white">
  Low contrast text
</p>
```

#### Good
```tsx
<p className="text-gray-700 bg-white">
  Sufficient contrast text
</p>
```

#### Using CSS Variables
```css
/* Bad */
--text-muted: #999999; /* 2.85:1 on white */

/* Good */
--text-muted: #666666; /* 5.74:1 on white */
```

### Tools
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Colorable](https://colorable.jxnblk.com/)
- Browser DevTools (Chrome, Firefox)

---

## Missing Form Labels

### Problem
```
label: Form elements must have labels
```

### Fix Examples

#### Bad
```tsx
<input type="text" name="email" placeholder="Email" />
```

#### Good - Explicit Label
```tsx
<label htmlFor="email">Email</label>
<input type="text" id="email" name="email" />
```

#### Good - Implicit Label
```tsx
<label>
  Email
  <input type="text" name="email" />
</label>
```

#### Good - aria-label
```tsx
<input
  type="text"
  name="email"
  aria-label="Email address"
  placeholder="Email"
/>
```

#### Good - aria-labelledby
```tsx
<span id="email-label">Email</span>
<input
  type="text"
  name="email"
  aria-labelledby="email-label"
/>
```

---

## Invalid ARIA Attributes

### Problem
```
aria-valid-attr: ARIA attributes must be valid
aria-valid-attr-value: ARIA attribute values must be valid
```

### Common Mistakes

#### Bad - Invalid attribute
```tsx
<button aria-role="button">Click me</button>
<!-- aria-role doesn't exist, use role -->
```

#### Good
```tsx
<button role="button">Click me</button>
<!-- But native button already has implicit role -->
```

#### Bad - Invalid value
```tsx
<div role="button" aria-pressed="yes">Toggle</div>
<!-- aria-pressed must be true/false/mixed -->
```

#### Good
```tsx
<button aria-pressed={isActive}>Toggle</button>
<!-- Boolean value, or "true"/"false" string -->
```

### Reference
- [ARIA Attributes Reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes)
- [ARIA Roles](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)

---

## Heading Hierarchy

### Problem
```
heading-order: Heading levels should only increase by one
```

### Fix Examples

#### Bad
```tsx
<h1>Page Title</h1>
<h3>Section</h3> {/* Skipped h2 */}
<h2>Subsection</h2> {/* Out of order */}
```

#### Good
```tsx
<h1>Page Title</h1>
<h2>Section</h2>
<h3>Subsection</h3>
<h4>Detail</h4>
```

### Tips
- Use semantic heading levels, not for styling
- Use CSS to adjust visual appearance
- One `<h1>` per page (typically the page title)
- Don't skip levels

---

## Missing Alt Text

### Problem
```
image-alt: Images must have alternate text
```

### Fix Examples

#### Bad
```tsx
<img src="/logo.png" />
```

#### Good - Descriptive alt
```tsx
<img src="/logo.png" alt="JobSphere - Find Your Dream Job" />
```

#### Good - Decorative image
```tsx
<img src="/decorative-pattern.png" alt="" />
<!-- Empty alt for decorative images -->
```

#### Good - Next.js Image
```tsx
<Image
  src="/logo.png"
  alt="JobSphere company logo"
  width={200}
  height={60}
/>
```

### Guidelines
- **Informative images**: Describe the image content
- **Functional images**: Describe the function/action
- **Decorative images**: Use empty alt (`alt=""`)
- **Complex images**: Provide longer description nearby

---

## Keyboard Accessibility

### Problem
```
keyboard: Interactive elements must be keyboard accessible
```

### Fix Examples

#### Bad - Non-semantic interactive element
```tsx
<div onClick={handleClick}>Click me</div>
<!-- Not keyboard accessible -->
```

#### Good - Use button
```tsx
<button onClick={handleClick}>Click me</button>
<!-- Naturally keyboard accessible -->
```

#### Good - Custom interactive element
```tsx
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick()
    }
  }}
>
  Click me
</div>
```

### Best Practices
- Use semantic HTML (`<button>`, `<a>`, `<input>`)
- Add `tabIndex={0}` for focusable custom elements
- Never use `tabIndex` > 0 (breaks natural tab order)
- Handle both click and keyboard events

---

## Focus Indicators

### Problem
```
focus-visible: Elements must have visible focus indicators
```

### Fix Examples

#### Bad - Removing outline
```css
button:focus {
  outline: none; /* Don't do this! */
}
```

#### Good - Custom focus style
```css
button:focus-visible {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}
```

#### Good - Tailwind
```tsx
<button className="focus:ring-2 focus:ring-blue-500 focus:outline-none">
  Click me
</button>
```

### Best Practices
- Always provide visible focus indicators
- Use `:focus-visible` to show focus only for keyboard users
- Ensure minimum 2px outline width
- Ensure focus indicator has sufficient contrast

---

## Link Accessibility

### Problem
```
link-name: Links must have discernible text
```

### Fix Examples

#### Bad - Empty link
```tsx
<a href="/profile">
  <img src="/profile-icon.png" />
</a>
```

#### Good - Text content
```tsx
<a href="/profile">
  <img src="/profile-icon.png" alt="View profile" />
</a>
```

#### Good - aria-label
```tsx
<a href="/profile" aria-label="View your profile">
  <UserIcon />
</a>
```

### Icon Links
```tsx
<a href="/settings" aria-label="Settings">
  <SettingsIcon aria-hidden="true" />
</a>
```

---

## Form Validation

### Problem
```
aria-errormessage: Error messages must be associated with inputs
```

### Fix Examples

#### Bad
```tsx
<input type="email" name="email" />
{error && <p>Invalid email</p>}
```

#### Good - aria-describedby
```tsx
<input
  type="email"
  name="email"
  aria-invalid={!!error}
  aria-describedby={error ? "email-error" : undefined}
/>
{error && <p id="email-error" role="alert">{error}</p>}
```

#### Good - React Hook Form
```tsx
<input
  {...register('email', { required: 'Email is required' })}
  aria-invalid={!!errors.email}
  aria-describedby={errors.email ? 'email-error' : undefined}
/>
{errors.email && (
  <span id="email-error" role="alert">
    {errors.email.message}
  </span>
)}
```

---

## Button Accessibility

### Problem
```
button-name: Buttons must have discernible text
```

### Fix Examples

#### Bad - Icon only
```tsx
<button>
  <CloseIcon />
</button>
```

#### Good - Visible text
```tsx
<button>
  <CloseIcon />
  Close
</button>
```

#### Good - aria-label
```tsx
<button aria-label="Close dialog">
  <CloseIcon aria-hidden="true" />
</button>
```

#### Good - Visually hidden text
```tsx
<button>
  <CloseIcon aria-hidden="true" />
  <span className="sr-only">Close</span>
</button>
```

---

## Lists and Navigation

### Problem
```
list: <ul> and <ol> must only contain <li> elements
```

### Fix Examples

#### Bad
```tsx
<ul>
  <a href="/home">Home</a>
  <a href="/about">About</a>
</ul>
```

#### Good
```tsx
<nav>
  <ul>
    <li><a href="/home">Home</a></li>
    <li><a href="/about">About</a></li>
  </ul>
</nav>
```

---

## Tables

### Problem
```
table-headers: Tables must have headers
```

### Fix Examples

#### Bad
```tsx
<table>
  <tr>
    <td>Name</td>
    <td>Email</td>
  </tr>
  <tr>
    <td>John</td>
    <td>john@example.com</td>
  </tr>
</table>
```

#### Good
```tsx
<table>
  <thead>
    <tr>
      <th scope="col">Name</th>
      <th scope="col">Email</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>John</td>
      <td>john@example.com</td>
    </tr>
  </tbody>
</table>
```

---

## Landmark Regions

### Problem
```
region: Page must have main landmark
```

### Fix Examples

#### Bad
```tsx
<div id="content">
  <h1>Welcome</h1>
  <p>Content here...</p>
</div>
```

#### Good
```tsx
<main>
  <h1>Welcome</h1>
  <p>Content here...</p>
</main>
```

### Common Landmarks
```tsx
<header>
  <nav aria-label="Main navigation">
    {/* Navigation items */}
  </nav>
</header>

<main>
  {/* Main content */}
</main>

<aside aria-label="Related articles">
  {/* Sidebar content */}
</aside>

<footer>
  {/* Footer content */}
</footer>
```

---

## Modals and Dialogs

### Problem
```
dialog: Dialogs must trap focus and be dismissible
```

### Fix Examples

#### Good - Radix UI Dialog
```tsx
import { Dialog, DialogContent } from '@/components/ui/dialog'

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <h2>Dialog Title</h2>
    <p>Dialog content...</p>
    <button onClick={() => setIsOpen(false)}>Close</button>
  </DialogContent>
</Dialog>
```

### Best Practices
- Trap focus within dialog
- Return focus to trigger element on close
- Close on Escape key
- Prevent background scrolling
- Use `aria-modal="true"`
- Provide accessible close button

---

## Skip Links

### Best Practice
Add skip navigation link for keyboard users:

```tsx
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>

<main id="main-content">
  {/* Page content */}
</main>
```

CSS for sr-only:
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.focus\:not-sr-only:focus {
  position: static;
  width: auto;
  height: auto;
  padding: 0.5rem 1rem;
  margin: 0;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
```

---

## Testing Checklist

After fixing violations, verify:

- [ ] Run axe-core tests again
- [ ] Test with keyboard navigation (Tab, Enter, Escape)
- [ ] Test with screen reader (NVDA, JAWS, VoiceOver)
- [ ] Zoom to 200% and verify layout
- [ ] Check in high contrast mode
- [ ] Verify focus indicators are visible
- [ ] Test form validation and error messages
- [ ] Verify all interactive elements are reachable

---

## Resources

- [WebAIM Articles](https://webaim.org/articles/)
- [A11y Style Guide](https://a11y-style-guide.com/)
- [Inclusive Components](https://inclusive-components.design/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [axe DevTools Browser Extension](https://www.deque.com/axe/devtools/)
