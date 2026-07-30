/**
 * Shared date/time format options for next-intl's formatter.
 *
 * These are passed inline to `format.dateTime(value, OPTIONS)` rather than
 * registered as named presets in `src/i18n.ts`, because named presets declared in
 * the request config are only resolvable in Server Components — a Client Component
 * calling `useFormatter().dateTime(d, 'short')` would raise MISSING_FORMAT unless
 * the presets were also threaded through `NextIntlClientProvider`. Inline options
 * work identically on both sides of the boundary.
 *
 * The active locale (and the time zone configured in `src/i18n.ts`) is applied by
 * the formatter, so nothing here hardcodes a locale.
 */

/** 01.02.2026 — dense, for table cells and metadata lines. */
export const SHORT_DATE = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
} as const

/** 1 February 2026 — for prose and detail headers. */
export const LONG_DATE = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
} as const

/** 01.02.2026, 14:30 — audit trails and activity timestamps. */
export const SHORT_DATE_TIME = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
} as const

/** 14:30 — time only. */
export const TIME_ONLY = {
  hour: '2-digit',
  minute: '2-digit',
} as const

/**
 * Structural type of `useFormatter().number` / `(await getFormatter()).number`.
 * Declared here so this module needs no import from next-intl and stays usable
 * from both Server and Client Components.
 */
type NumberFormatter = (value: number, options?: { style: 'currency'; currency: string; minimumFractionDigits: number; maximumFractionDigits: number }) => string

/**
 * Renders a salary amount in the job's own currency and the reader's locale —
 * "45 000 €" (sk), "45.000 €" (de), "45 000 zł" (pl, PLN), "€45,000" (en).
 *
 * `Job.salaryCurrency` is `String @default("EUR")` and therefore non-nullable in the
 * database; the `?? 'EUR'` guard only covers rows reaching the UI through loosely
 * typed API payloads. Salaries are stored as whole units (`Int`), so no decimals.
 */
export function formatMoney(
  formatNumber: NumberFormatter,
  amount: number,
  currency?: string | null,
): string {
  return formatNumber(amount, {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}
