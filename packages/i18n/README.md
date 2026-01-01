# @jobsphere/i18n

**Status: PLACEHOLDER / DEPRECATED**

This package is currently a placeholder for future shared internationalization utilities.

## Current State

- Contains sample translation files but not actively used
- Apps use their own local `messages/` folders
- Removed from Next.js `transpilePackages`

## Actual i18n Implementation

Internationalization is handled in:
- **apps/web/messages/** - Translation JSON files (en, de, cs, sk, pl)
- **next-intl** - Library for Next.js i18n

## Future Plans

This package is reserved for:
- Shared translation utilities across multiple apps
- Common i18n helpers
- Centralized translation management

## If You Need This

To activate this package:
1. Move messages from apps to this package
2. Create shared utilities/helpers
3. Add build configuration
4. Add to `transpilePackages` in apps/web/next.config.js
5. Update imports in apps to use @jobsphere/i18n
