/**
 * Profesia.sk HTML parsing (L65).
 *
 * Pure functions only — no network, no Redis, no Prisma — so they are trivially
 * unit-testable against fixture HTML. The worker (profesia-import.ts) handles
 * fetching, rate-limiting, robots politeness and persistence.
 */

import * as cheerio from 'cheerio'

/** Provenance value stored on Job.externalSource for deduped imports. */
export const PROFESIA_SOURCE = 'profesia.sk'
export const PROFESIA_BASE_URL = 'https://www.profesia.sk'
/** Default listing entry point (public job offers). */
export const PROFESIA_LISTING_URL = `${PROFESIA_BASE_URL}/praca/`

export interface ParsedProfesiaJob {
  /** Stable Profesia offer id, e.g. "O1234567" — used for dedup. */
  externalId: string
  url: string
  title: string
  company: string | null
  location: string | null
  description: string
}

/**
 * Extract the Profesia offer id (e.g. "O1234567") from an offer URL.
 * Profesia offer URLs end in `/O<digits>`; returns null when absent.
 */
export function extractProfesiaId(url: string): string | null {
  if (!url) return null
  const m = url.match(/\/(O\d+)(?:[/?#]|$)/i)
  return m ? m[1].toUpperCase() : null
}

/** Resolve a possibly-relative href against the Profesia base URL. */
function absoluteUrl(href: string): string {
  try {
    return new URL(href, PROFESIA_BASE_URL).toString()
  } catch {
    return href
  }
}

/**
 * Parse a listing page → absolute offer URLs (deduped; only real offer links
 * carrying an O-id are kept).
 */
export function parseProfesiaListing(html: string): string[] {
  const $ = cheerio.load(html)
  const urls = new Set<string>()
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return
    const abs = absoluteUrl(href)
    if (extractProfesiaId(abs)) urls.add(abs)
  })
  return Array.from(urls)
}

/**
 * Parse an offer detail page. Returns null when required fields (id, title) are
 * missing so the caller can skip malformed pages rather than persist garbage.
 */
export function parseProfesiaDetail(html: string, url: string): ParsedProfesiaJob | null {
  const externalId = extractProfesiaId(url)
  if (!externalId) return null

  const $ = cheerio.load(html)

  const title = $('[itemprop="title"]').first().text().trim() || $('h1').first().text().trim()
  if (!title) return null

  const company =
    $('[itemprop="hiringOrganization"]').first().text().trim() ||
    $('.company-name').first().text().trim() ||
    null

  const location =
    $('[itemprop="jobLocation"]').first().text().trim() ||
    $('.job-location').first().text().trim() ||
    null

  const description =
    $('[itemprop="description"]').first().text().trim() ||
    $('.job-description').first().text().trim() ||
    ''

  return { externalId, url, title, company, location, description }
}
