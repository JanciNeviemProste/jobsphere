# Accessibility Testing with axe-core

This directory contains comprehensive accessibility tests using axe-core to ensure WCAG 2.1 Level AA compliance across the JobSphere platform.

## Overview

Accessibility testing helps ensure that our application is usable by everyone, including users with disabilities. We use [axe-core](https://github.com/dequelabs/axe-core) integrated with Playwright to automatically detect accessibility violations.

## Test Coverage

Our accessibility test suite covers:

1. **axe-core Automated Tests** (`axe-core.spec.ts`)
   - WCAG 2.0 Level AA compliance
   - WCAG 2.1 Level AA compliance
   - Color contrast ratios
   - Semantic HTML structure
   - Homepage, Jobs, Job Detail, Application Forms
   - Dashboard and Auth Pages
   - Navigation, Footer, and Components

2. **Keyboard Navigation Tests** (`keyboard-navigation.spec.ts`)
   - Tab order and focus management
   - Skip navigation links
   - Modal/dialog focus trapping
   - Focus indicators visibility
   - Arrow key navigation
   - Escape key functionality

3. **Form Accessibility Tests** (`forms.spec.ts`) - **20 comprehensive tests**
   - **Label Associations**: All inputs have associated labels with descriptive text
   - **Error Message Accessibility**: Error messages use aria-live/role="alert" and aria-describedby
   - **Required Field Indicators**: Required fields have HTML attributes and visual indicators
   - **Help Text Association**: Help text linked via aria-describedby with unique IDs
   - **Autocomplete Attributes**: Email, password, name inputs have proper autocomplete
   - **Fieldset and Legend**: Radio/checkbox groups use proper semantic structure
   - **Multiple aria-describedby**: Inputs with help text + errors reference both
   - **Form Submission States**: Loading states and success/error announcements
   - **Complex Forms**: Job application forms with proper label associations
   - Tests cover: Login, Signup, Job Application forms

4. **Screen Reader Accessibility Tests** (`screen-reader.spec.ts`)
   - ARIA labels and accessible names
   - Live regions (aria-live, role="alert", role="status")
   - Form error announcements (aria-invalid, aria-describedby)
   - Page title updates on navigation
   - Heading hierarchy (h1-h6)
   - Landmark regions (header, nav, main, footer)
   - Status announcements
   - Dialog accessibility
   - Form input associations

## Running Tests

### Run all accessibility tests
```bash
cd apps/web
yarn test:a11y
```

### Run with UI mode (recommended for development)
```bash
yarn test:a11y:ui
```

### Run in headed mode (see browser)
```bash
yarn test:a11y:headed
```

### Debug a specific test
```bash
yarn test:a11y:debug
```

### Run a specific test file
```bash
yarn test:a11y axe-core.spec.ts
```

### Run a specific test by name
```bash
yarn test:a11y -g "homepage should have no accessibility violations"
```

### Run only screen reader tests
```bash
yarn test:a11y screen-reader.spec.ts
```

### Run only keyboard navigation tests
```bash
yarn test:a11y keyboard-navigation.spec.ts
```

### Run only form accessibility tests
```bash
yarn test:a11y forms.spec.ts
```

## Prerequisites

- Development server must be running on `http://localhost:3000`
- Start with: `yarn dev`
- Or tests will auto-start the server (configured in `playwright.a11y.config.ts`)

## Understanding Test Results

### Violations

When a test fails, you'll see detailed information about accessibility violations:

```typescript
{
  id: 'color-contrast',
  impact: 'serious',
  description: 'Elements must have sufficient color contrast',
  nodes: 3,
  help: 'Ensure the contrast ratio is at least 4.5:1',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/color-contrast'
}
```

**Impact Levels:**
- `critical` - Must be fixed immediately
- `serious` - Should be fixed soon
- `moderate` - Should be addressed
- `minor` - Nice to fix

### Common Violations

1. **Color Contrast**
   - Minimum ratio: 4.5:1 for normal text
   - Minimum ratio: 3:1 for large text (18pt+ or 14pt+ bold)
   - Solution: Adjust foreground/background colors

2. **Missing Form Labels**
   - All form inputs must have associated labels
   - Solution: Add `<label>` elements or `aria-label` attributes

3. **Heading Hierarchy**
   - Don't skip heading levels (h1 → h2 → h3, not h1 → h3)
   - Solution: Restructure heading hierarchy

4. **Missing Alt Text**
   - All images must have descriptive alt text
   - Solution: Add meaningful `alt` attributes

5. **Invalid ARIA Attributes**
   - ARIA attributes must be valid and used correctly
   - Solution: Refer to [ARIA specification](https://www.w3.org/TR/wai-aria-1.1/)

## WCAG 2.1 Level AA Standards

Our tests check compliance with:

- **Perceivable**: Information must be presentable to users in ways they can perceive
  - Text alternatives (alt text)
  - Time-based media alternatives
  - Adaptable content
  - Distinguishable content (color contrast)

- **Operable**: UI components must be operable
  - Keyboard accessible
  - Enough time to read/use content
  - No seizure-inducing content
  - Navigable

- **Understandable**: Information and operation must be understandable
  - Readable text
  - Predictable behavior
  - Input assistance (form labels, error messages)

- **Robust**: Content must be robust enough for assistive technologies
  - Compatible with current and future tools
  - Valid HTML
  - Proper ARIA usage

## axe-core Rule Tags

Our tests use these tag sets:

- `wcag2a` - WCAG 2.0 Level A rules
- `wcag2aa` - WCAG 2.0 Level AA rules (primary target)
- `wcag21aa` - WCAG 2.1 Level AA rules (primary target)
- `best-practice` - Industry best practices (optional)

## Configuration

### Test Configuration
File: `playwright.a11y.config.ts`

Key settings:
- Tests run only on Chromium (accessibility violations are not browser-specific)
- 60-second timeout per test (axe scans can take longer)
- Separate HTML report: `playwright-report-a11y`

### Customizing Tests

#### Run axe on specific elements
```typescript
const results = await new AxeBuilder({ page })
  .withTags(['wcag2aa'])
  .include('#main-content')  // Only scan this element
  .analyze()
```

#### Exclude elements from scan
```typescript
const results = await new AxeBuilder({ page })
  .withTags(['wcag2aa'])
  .exclude('.third-party-widget')  // Skip this element
  .analyze()
```

#### Test specific rules
```typescript
const results = await new AxeBuilder({ page })
  .options({
    rules: {
      'color-contrast': { enabled: true },
      'heading-order': { enabled: true }
    }
  })
  .analyze()
```

#### Disable specific rules
```typescript
const results = await new AxeBuilder({ page })
  .disableRules(['color-contrast'])  // Temporarily disable
  .analyze()
```

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run accessibility tests
  run: |
    cd apps/web
    yarn test:a11y
```

### Continuous Monitoring
Consider integrating accessibility testing into:
- Pre-commit hooks
- Pull request checks
- Nightly builds
- Production monitoring

## Best Practices

1. **Run tests frequently** - Catch issues early in development
2. **Fix critical and serious violations first** - Prioritize by impact
3. **Test with real assistive technologies** - Automated tests catch ~30-50% of issues
4. **Include manual testing** - Screen readers, keyboard navigation, etc.
5. **Educate the team** - Share accessibility knowledge
6. **Test with actual users** - Get feedback from users with disabilities

## Manual Testing Checklist

Automated tests complement, but don't replace, manual testing:

### Keyboard Navigation
- [ ] Tab through all interactive elements
- [ ] Shift+Tab to navigate backwards
- [ ] Enter/Space to activate buttons and links
- [ ] Escape to close modals and dropdowns
- [ ] Arrow keys for dropdowns and radio groups
- [ ] Focus indicators are visible and clear

### Screen Reader Testing
- [ ] **NVDA (Windows)** - Test with Firefox or Chrome
  - Download: https://www.nvaccess.org/download/
  - NVDA+Space to activate browse mode
  - Tab/Shift+Tab to navigate focusable elements
  - H/Shift+H to navigate headings
  - K/Shift+K to navigate links
  - D/Shift+D to navigate landmarks
  - F/Shift+F to navigate form fields

- [ ] **JAWS (Windows)** - Most widely used screen reader
  - Commercial software, trial available
  - Similar keyboard commands to NVDA

- [ ] **VoiceOver (macOS/iOS)** - Built into Apple devices
  - macOS: Cmd+F5 to toggle VoiceOver
  - VO+Right Arrow to navigate forward
  - VO+Left Arrow to navigate backward
  - VO+U to open rotor (quick navigation)

- [ ] **TalkBack (Android)** - Built into Android
  - Settings > Accessibility > TalkBack
  - Swipe right/left to navigate

### Screen Reader Verification Checklist
- [ ] Page title announced on navigation
- [ ] Heading hierarchy makes sense (h1→h2→h3)
- [ ] Landmarks announced (main, navigation, banner, contentinfo)
- [ ] Form labels read correctly
- [ ] Error messages announced (aria-live, role="alert")
- [ ] Button purposes are clear
- [ ] Image alt text is descriptive
- [ ] Link text is meaningful (not "click here")
- [ ] Dynamic content updates announced
- [ ] Loading states announced

### Visual Testing
- [ ] Zoom to 200% without horizontal scrolling
- [ ] High contrast mode (Windows High Contrast)
- [ ] Browser zoom and text resize
- [ ] Dark mode compatibility
- [ ] Color blindness simulation

### Other Accessibility Checks
- [ ] Skip navigation links work
- [ ] No keyboard traps
- [ ] No content only visible on hover
- [ ] Videos have captions/transcripts
- [ ] Forms show clear error messages

## Screen Reader Test Details

The `screen-reader.spec.ts` file contains comprehensive tests to ensure the application works properly with assistive technologies. Here's what each test group verifies:

### 1. ARIA Labels (3 tests)
- **Navigation labels**: Verifies nav has `aria-label="Main navigation"`
- **Interactive elements**: All buttons, links have accessible names
- **Icon buttons**: Icon-only buttons have descriptive `aria-label`

### 2. Live Regions (3 tests)
- **Form errors**: Error messages use `role="alert"` or `aria-live="polite"`
- **Search results**: Results count announced when filtering
- **Loading states**: Loading indicators have proper announcements

### 3. Form Error Announcements (3 tests)
- **aria-invalid**: Invalid fields marked with `aria-invalid="true"`
- **aria-describedby**: Error messages linked to inputs
- **Error summaries**: Form submission errors announced properly

### 4. Page Title Updates (3 tests)
- **Navigation updates**: Title changes when navigating pages
- **Unique titles**: Each page has distinct, descriptive title
- **Branding**: All titles include "JobSphere" for context

### 5. Heading Hierarchy (3 tests)
- **Single h1**: Each page has exactly one h1 element
- **Logical order**: Headings don't skip levels (h1→h2→h3, not h1→h3)
- **Meaningful content**: Headings describe page structure

### 6. Landmark Regions (5 tests)
- **Proper landmarks**: Page has header, nav, main, footer
- **Descriptive labels**: Multiple navs have unique `aria-label`
- **Skip links**: Main content has id for skip navigation
- **Unique labels**: Multiple landmarks of same type have distinct labels

### 7. Status and Live Regions (3 tests)
- **Success messages**: Use `role="status"` or `aria-live="polite"`
- **Critical alerts**: Use `role="alert"` or `aria-live="assertive"`
- **Loading announcements**: Loading indicators properly announced

### 8. Dialog Accessibility (2 tests)
- **Dialog attributes**: Modals have `role="dialog"` and labels
- **Modal behavior**: Dialogs have `aria-modal="true"`

### 9. Form Input Accessibility (2 tests)
- **Input labels**: All inputs have associated `<label>` or `aria-label`
- **Checkbox labels**: Checkboxes properly labeled

## Resources

- [axe-core documentation](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md)
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Deque University](https://dequeuniversity.com/)
- [A11y Project](https://www.a11yproject.com/)
- [NVDA Screen Reader](https://www.nvaccess.org/)
- [WebAIM Screen Reader User Survey](https://webaim.org/projects/screenreadersurvey9/)
- [Inclusive Components](https://inclusive-components.design/)

## Troubleshooting

### Tests are failing with "Page not found"
- Ensure dev server is running: `yarn dev`
- Check `baseURL` in `playwright.a11y.config.ts`

### Tests timeout
- Increase timeout in `playwright.a11y.config.ts`
- Check if page is loading correctly
- Look for JavaScript errors in browser console

### False positives
- Review the violation details carefully
- Check if the rule applies to your use case
- Consider disabling specific rules if justified
- Document why you disabled rules

### Need to skip authentication
- Tests currently skip dashboard tests if not authenticated
- To test authenticated pages, add authentication setup
- See `tests/fixtures/auth.ts` for examples

## Contributing

When adding new pages or features:

1. Add corresponding accessibility tests
2. Run tests locally before committing
3. Fix any violations found
4. Document any intentional rule exclusions
5. Update this README if needed

## Support

For questions or issues:
- Check existing test examples
- Review axe-core documentation
- Ask in team accessibility channel
- Consult with accessibility specialist
