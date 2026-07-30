import { notFound } from 'next/navigation'
import { getRequestConfig } from 'next-intl/server'

export const locales = ['en', 'de', 'cs', 'sk', 'pl'] as const
export type Locale = (typeof locales)[number]

/**
 * Catalog used to backfill any key a locale is missing. Deliberately NOT the same
 * thing as `defaultLocale` in `@/config/i18n` (which is 'sk' and drives routing) —
 * this only decides which translations stand in for a gap.
 */
const FALLBACK_LOCALE: Locale = 'en'

/**
 * Explicit time zone so a date renders identically on the server and in the browser.
 * Without it next-intl falls back to the runtime zone — UTC when rendered on Vercel,
 * the visitor's zone on the client — which both drifts by a day around midnight and
 * produces hydration mismatches. The audience is Central European.
 */
const TIME_ZONE = 'Europe/Bratislava'

/**
 * Structurally identical to next-intl's `AbstractIntlMessages`, declared locally so
 * this file needs no runtime import from `next-intl` (it is loaded in a
 * react-server context). A `Record<string, unknown>` will NOT satisfy
 * `RequestConfig.messages` — the type has to be recursive.
 */
type Messages = { [key: string]: string | Messages }

function isPlainObject(value: unknown): value is Messages {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Deep-merges `override` on top of `base`. The catalogs are nested several levels
 * (e.g. `employer.newJob.jobTitle`), so a shallow merge would drop whole sub-trees
 * of the fallback catalog as soon as the target locale defines the parent object.
 */
function deepMerge(base: Messages, override: Messages): Messages {
  const result: Messages = { ...base }

  for (const [key, overrideValue] of Object.entries(override)) {
    const baseValue = result[key]
    result[key] =
      isPlainObject(baseValue) && isPlainObject(overrideValue)
        ? deepMerge(baseValue, overrideValue)
        : overrideValue
  }

  return result
}

/** camelCase / dotted key -> readable text, used as the last-resort render. */
function humanizeKey(key: string): string {
  const leaf = key.split('.').pop() ?? key
  const words = leaf
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

// Merged catalogs are stable for the lifetime of the process; build each one once.
const messagesCache = new Map<Locale, Messages>()

async function loadMessages(locale: Locale): Promise<Messages> {
  const cached = messagesCache.get(locale)
  if (cached) return cached

  const localeMessages = (await import(`../messages/${locale}.json`)).default as Messages

  // Merge the English catalog underneath every other locale so a missing key
  // degrades to English instead of rendering the raw key path to the user.
  const merged =
    locale === FALLBACK_LOCALE
      ? localeMessages
      : deepMerge(
          (await import(`../messages/${FALLBACK_LOCALE}.json`)).default as Messages,
          localeMessages,
        )

  messagesCache.set(locale, merged)
  return merged
}

export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocale is a Promise, not a function — await it directly
  const locale = await requestLocale

  if (!locale || !locales.includes(locale as any)) notFound()

  return {
    // next-intl 3.22+ requires `locale` to be returned here; omitting it triggers
    // a "suspended thenable" render crash (500) on locale-rendered pages.
    locale,
    messages: await loadMessages(locale as Locale),
    timeZone: TIME_ZONE,

    // Never surface a raw key path (e.g. "employer.editJob.title") in the UI.
    getMessageFallback({ namespace, key }) {
      return humanizeKey(namespace ? `${namespace}.${key}` : key)
    },

    onError(error) {
      // Missing messages are already handled by the en fallback + getMessageFallback;
      // keep them visible in dev, keep them out of production noise.
      // (compared as a plain string so this file needs no runtime import from
      // `next-intl` — the request config is loaded in a react-server context)
      const code: string = error.code
      if (process.env.NODE_ENV === 'production' && code === 'MISSING_MESSAGE') return
      console.error(error)
    },
  }
})
