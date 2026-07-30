'use client'

import { useEffect } from 'react'

/**
 * Browser-level guard against losing unsaved work.
 *
 * While `enabled` is true, closing the tab, reloading, or navigating to
 * another origin shows the browser's native "Leave site?" confirmation.
 *
 * Scope note: this covers *document unloads* only. The Next.js App Router
 * (14.x) exposes no supported way to block a client-side `<Link>` / `router`
 * navigation — there is no `router.events` and no `useBlocker` — so in-app
 * navigation is intentionally not intercepted here rather than papered over
 * with a click-capture hack that misses `router.push` and the back button.
 * The localStorage draft is what protects the user in that case.
 */
export function useUnsavedChangesWarning(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Required for the prompt to appear across browsers.
      event.preventDefault()
      event.returnValue = ''
      return ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [enabled])
}
