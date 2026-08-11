#!/usr/bin/env node
/**
 * i18n key-parity gate.
 *
 * Every locale catalog in apps/web/messages must expose exactly the same set of
 * message keys as the reference catalog (en). A gap there is a user-visible bug:
 * next-intl renders the raw key path (e.g. "employer.editJob.title") straight
 * into the page when a key is absent, and stale keys that exist in only some
 * locales quietly rot until someone tries to use them.
 *
 * Dependency-free on purpose — runs with plain `node` in CI before install-heavy
 * steps if needed.
 *
 * Usage: node scripts/check-i18n-parity.mjs
 * Exit code: 0 = all catalogs agree, 1 = drift detected (or a catalog is unreadable).
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MESSAGES_DIR = join(ROOT, 'apps', 'web', 'messages')
const REFERENCE_LOCALE = 'en'

/** Flattens a nested catalog into dotted leaf paths -> string value. */
function flatten(node, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out)
    } else {
      out.set(path, value)
    }
  }
  return out
}

/** Extracts ICU argument names, e.g. "Hi {name}, {count, plural, ...}" -> ["count", "name"]. */
function icuArgs(value) {
  if (typeof value !== 'string') return []
  const found = new Set()
  for (const match of value.matchAll(/\{\s*([a-zA-Z0-9_]+)\s*[,}]/g)) found.add(match[1])
  return [...found].sort()
}

function loadCatalogs() {
  let files
  try {
    // Underscore-prefixed files are working fragments, not locale catalogs.
    // Large i18n migrations are split across parallel workers that each write
    // `_fragment-<area>.json` (all five locales in one file) instead of editing
    // the shared catalogs concurrently; those get merged in and deleted. Without
    // this filter the fragment is compared against `en` as if it were a locale
    // and the check fails with thousands of bogus "missing key" lines.
    files = readdirSync(MESSAGES_DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  } catch (error) {
    console.error(`i18n-parity: cannot read ${MESSAGES_DIR}\n  ${error.message}`)
    process.exit(1)
  }

  if (files.length === 0) {
    console.error(`i18n-parity: no catalogs found in ${MESSAGES_DIR}`)
    process.exit(1)
  }

  const catalogs = new Map()
  for (const file of files.sort()) {
    const locale = file.replace(/\.json$/, '')
    try {
      catalogs.set(locale, JSON.parse(readFileSync(join(MESSAGES_DIR, file), 'utf8')))
    } catch (error) {
      console.error(`i18n-parity: ${file} is not valid JSON\n  ${error.message}`)
      process.exit(1)
    }
  }
  return catalogs
}

function list(label, keys, limit = 40) {
  const shown = keys.slice(0, limit)
  console.error(`    ${label} (${keys.length}):`)
  for (const key of shown) console.error(`      - ${key}`)
  if (keys.length > shown.length) console.error(`      ... and ${keys.length - shown.length} more`)
}

function main() {
  const catalogs = loadCatalogs()

  if (!catalogs.has(REFERENCE_LOCALE)) {
    console.error(`i18n-parity: reference catalog "${REFERENCE_LOCALE}.json" is missing`)
    process.exit(1)
  }

  const flat = new Map()
  for (const [locale, catalog] of catalogs) flat.set(locale, flatten(catalog))

  const reference = flat.get(REFERENCE_LOCALE)
  const referenceKeys = new Set(reference.keys())

  const locales = [...catalogs.keys()]
  console.log(`i18n-parity: reference "${REFERENCE_LOCALE}" has ${referenceKeys.size} keys`)
  console.log(`i18n-parity: checking ${locales.length} catalogs [${locales.join(', ')}]\n`)

  let failed = false
  const warnings = []

  for (const locale of locales) {
    if (locale === REFERENCE_LOCALE) continue

    const localeFlat = flat.get(locale)
    const localeKeys = new Set(localeFlat.keys())

    const missing = [...referenceKeys].filter((k) => !localeKeys.has(k)).sort()
    const extra = [...localeKeys].filter((k) => !referenceKeys.has(k)).sort()
    const empty = [...localeFlat.entries()]
      .filter(([, v]) => typeof v === 'string' && v.trim() === '')
      .map(([k]) => k)
      .sort()

    // A key that is a string here but an object in en (or vice versa) collides on
    // lookup even though both key sets technically contain the path.
    const typeMismatch = [...localeKeys]
      .filter((k) => referenceKeys.has(k) && typeof localeFlat.get(k) !== typeof reference.get(k))
      .sort()

    const placeholderDrift = [...localeKeys]
      .filter((k) => referenceKeys.has(k))
      .filter((k) => icuArgs(localeFlat.get(k)).join('|') !== icuArgs(reference.get(k)).join('|'))
      .sort()

    const problems = missing.length + extra.length + empty.length + typeMismatch.length

    if (problems === 0) {
      console.log(`  OK   ${locale}  ${localeKeys.size} keys`)
    } else {
      failed = true
      console.error(`  FAIL ${locale}  ${localeKeys.size} keys`)
      if (missing.length) list(`missing (present in ${REFERENCE_LOCALE})`, missing)
      if (extra.length) list(`extra (absent from ${REFERENCE_LOCALE})`, extra)
      if (typeMismatch.length) list('type mismatch vs reference', typeMismatch)
      if (empty.length) list('empty string values', empty)
    }

    for (const key of placeholderDrift) {
      warnings.push(
        `${locale}: "${key}" ICU args {${icuArgs(localeFlat.get(key)).join(', ')}} ` +
          `differ from ${REFERENCE_LOCALE} {${icuArgs(reference.get(key)).join(', ')}}`,
      )
    }
  }

  if (warnings.length) {
    console.log(`\ni18n-parity: ${warnings.length} non-blocking warning(s)`)
    for (const warning of warnings) console.log(`  warn ${warning}`)
  }

  if (failed) {
    console.error(
      '\ni18n-parity: FAILED — locale catalogs disagree on their key sets.\n' +
        'Add the missing translations, or delete the stale keys from every catalog.',
    )
    process.exit(1)
  }

  console.log('\ni18n-parity: PASS — all catalogs expose an identical key set.')
}

main()
