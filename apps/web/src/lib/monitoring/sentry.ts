/**
 * Sentry Monitoring Wrapper (stub)
 * @sentry/nextjs removed to fix ERR_REQUIRE_ESM on Vercel.
 * Re-add when NEXT_PUBLIC_SENTRY_DSN is configured.
 */

export function captureException(
  error: Error,
  context?: { tags?: Record<string, string>; extra?: Record<string, unknown> },
): void {
  if (process.env.NODE_ENV === 'development') {
    console.error('[Sentry]', error, context)
  }
}

export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: { tags?: Record<string, string>; extra?: Record<string, unknown> },
): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Sentry:${level}]`, message, context)
  }
}

export function setUserContext(_user: { id?: string; email?: string; username?: string }): void {}
export function clearUserContext(): void {}
export function addBreadcrumb(
  _message: string,
  _category?: string,
  _data?: Record<string, unknown>,
): void {}
