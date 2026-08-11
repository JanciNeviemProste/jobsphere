/**
 * Route wrapper contract.
 *
 * Writing one test per route does not scale to 76 files and, worse, it only ever
 * covers routes that already exist. This gate instead states the invariant once
 * and enforces it across every `route.ts` in the app — including files nobody has
 * written yet. A new endpoint that forgets rate limiting fails CI on the day it is
 * added, not during the next audit.
 *
 * The rules:
 *   1. every handler is rate limited
 *   2. every mutating handler (POST/PUT/PATCH/DELETE) has CSRF protection
 *   3. every handler establishes who the caller is
 *
 * Deviations live in `route-contract-allowlist.ts` with a written reason. A stale
 * entry there fails the suite too — otherwise the list grows forever and quietly
 * turns back into "no rule at all", which is exactly how the ESLint ignorePatterns
 * regression happened in this repo.
 */

import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { analyzeAllRoutes, MUTATING_METHODS, type RouteHandler } from './route-contract-analyzer'
import {
  ALLOWLIST,
  ALLOWLIST_INDEX,
  allowlistKey,
  type ContractRule,
} from './route-contract-allowlist'

const WEB_ROOT = join(__dirname, '..', '..')
const APP_DIR = join(WEB_ROOT, 'src', 'app')
const API_DIR = join(APP_DIR, 'api')

const handlers = analyzeAllRoutes(API_DIR, APP_DIR, WEB_ROOT)

/** Rules waived for this handler, if any. */
function exemptions(h: RouteHandler): ContractRule[] {
  return ALLOWLIST_INDEX.get(allowlistKey(h.method, h.route))?.exempt ?? []
}

/** Handlers that break `rule` and are not allowlisted for it. */
function violations(rule: ContractRule, predicate: (h: RouteHandler) => boolean): RouteHandler[] {
  return handlers.filter((h) => predicate(h) && !exemptions(h).includes(rule))
}

const describeViolation = (h: RouteHandler) =>
  `${h.method} ${h.route}  (${h.file}) wrappers=[${h.wrappers.join(' > ') || 'none'}]`

describe('route wrapper contract', () => {
  it('finds the API surface at all', () => {
    // A refactor that moves the api directory would otherwise turn every rule below
    // into a vacuous pass over an empty array — the same failure mode as the
    // ESLint config that silently linted zero files.
    expect(handlers.length).toBeGreaterThan(50)
    const files = new Set(handlers.map((h) => h.file))
    expect(files.size).toBeGreaterThan(50)
  })

  it('rate limits every handler', () => {
    const bad = violations('rateLimit', (h) => !h.hasRateLimit)
    expect(bad.map(describeViolation)).toEqual([])
  })

  it('protects every mutating handler with CSRF', () => {
    const bad = violations('csrf', (h) => MUTATING_METHODS.includes(h.method) && !h.hasCsrf)
    expect(bad.map(describeViolation)).toEqual([])
  })

  it('establishes the caller identity in every handler', () => {
    const bad = violations('auth', (h) => !h.hasAuthGuard)
    expect(bad.map(describeViolation)).toEqual([])
  })
})

describe('route contract allowlist hygiene', () => {
  it('has no entry for a route that no longer exists', () => {
    const live = new Set(handlers.map((h) => allowlistKey(h.method, h.route)))
    const orphans = ALLOWLIST.filter((e) => !live.has(allowlistKey(e.method, e.route))).map(
      (e) => `${e.method} ${e.route}`,
    )
    expect(orphans).toEqual([])
  })

  it('has no exemption that the route no longer needs', () => {
    // The point of this check: when someone finally wraps an exempted route, the
    // exemption must be deleted in the same PR. Otherwise the allowlist keeps
    // asserting a hole that has been filled, and the next real hole hides in the noise.
    const unnecessary: string[] = []
    for (const entry of ALLOWLIST) {
      const h = handlers.find((x) => x.method === entry.method && x.route === entry.route)
      if (!h) continue // covered by the orphan test above
      if (entry.exempt.includes('rateLimit') && h.hasRateLimit)
        unnecessary.push(`${entry.method} ${entry.route}: 'rateLimit' — route is now rate limited`)
      if (entry.exempt.includes('csrf') && h.hasCsrf)
        unnecessary.push(`${entry.method} ${entry.route}: 'csrf' — route now has CSRF protection`)
      if (entry.exempt.includes('auth') && h.hasAuthGuard)
        unnecessary.push(`${entry.method} ${entry.route}: 'auth' — route now has an auth guard`)
    }
    expect(unnecessary).toEqual([])
  })

  it('gives every exemption a substantive reason', () => {
    const weak = ALLOWLIST.filter((e) => e.reason.trim().length < 30).map(
      (e) => `${e.method} ${e.route}`,
    )
    expect(weak).toEqual([])
  })

  it('has no duplicate entries', () => {
    const keys = ALLOWLIST.map((e) => allowlistKey(e.method, e.route))
    expect(keys.length).toBe(new Set(keys).size)
  })
})
