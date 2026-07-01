/**
 * Profesia.sk import pipeline (L65).
 *
 * Decoupled from BullMQ/Redis so it can be unit-tested with a mocked `fetch`
 * and a mocked Prisma client. `scraper.worker.ts` is a thin wrapper that runs
 * `processScrape` on the 'scraper' queue.
 *
 * POLITENESS / ROBOTS:
 *  - Every outbound HTTP request is spaced by a fixed delay (SCRAPER_DELAY_MS,
 *    default 1.5s) and the run is capped at SCRAPER_MAX_OFFERS offers, so we
 *    never hammer the origin. The worker runs at concurrency 1 with a BullMQ
 *    limiter as a second guard.
 *  - A descriptive User-Agent is sent so the site owner can identify/deny the
 *    bot. Profesia's robots.txt permits crawling public `/praca/` offer pages
 *    for well-behaved agents; keep this scraper limited to those paths.
 *
 * CONSENT (L64):
 *  - Import runs ONLY when a granted, non-revoked `DATA_IMPORT` ConsentRecord
 *    exists. With no consent on record the run is skipped (logged, no writes).
 *
 * SYSTEM OWNERSHIP:
 *  - Imported jobs are owned by a synthetic "Profesia Import" organization
 *    (fixed slug `profesia-import`) created + used by a non-admin system user
 *    (fixed email, `isGlobalAdmin:false`). Both are found-or-created via upsert.
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import type { ScraperJobData } from '@/lib/queue'
import {
  PROFESIA_SOURCE,
  PROFESIA_LISTING_URL,
  parseProfesiaListing,
  parseProfesiaDetail,
  type ParsedProfesiaJob,
} from '@/lib/scrapers/profesia'

const USER_AGENT = process.env.SCRAPER_USER_AGENT || 'JobSphereBot/1.0 (+https://jobsphere.eu/bot)'
const REQUEST_DELAY_MS = parseInt(process.env.SCRAPER_DELAY_MS || '1500', 10)
const MAX_OFFERS_PER_RUN = parseInt(process.env.SCRAPER_MAX_OFFERS || '20', 10)

const SYSTEM_ORG_SLUG = 'profesia-import'
const SYSTEM_ORG_NAME = 'Profesia Import'
const SYSTEM_USER_EMAIL = process.env.SCRAPER_SYSTEM_EMAIL || 'system+scraper@jobsphere.local'

/** Minimal shape accepted from a BullMQ Job (only `data` is read). */
export interface ScrapeJobLike {
  data?: ScraperJobData
}

export interface ScrapeRunResult {
  source: string
  found: number
  imported: number
  failed: number
  skipped?: boolean
  reason?: string
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
  })
  if (!res.ok) {
    throw new Error(`Fetch ${url} failed with status ${res.status}`)
  }
  return res.text()
}

/**
 * Consent gate (L64). Returns true only when at least one granted, non-revoked
 * DATA_IMPORT consent exists.
 */
export async function hasDataImportConsent(): Promise<boolean> {
  const consent = await prisma.consentRecord.findFirst({
    where: { consentType: 'DATA_IMPORT', granted: true, revokedAt: null },
    select: { id: true },
  })
  return Boolean(consent)
}

/** Find-or-create the synthetic import org; returns its id. */
export async function getSystemOrgId(): Promise<string> {
  const org = await prisma.organization.upsert({
    where: { slug: SYSTEM_ORG_SLUG },
    update: {},
    create: { name: SYSTEM_ORG_NAME, slug: SYSTEM_ORG_SLUG },
    select: { id: true },
  })
  return org.id
}

/** Find-or-create the non-admin system user used as Job.createdBy. */
export async function getSystemUserId(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: SYSTEM_USER_EMAIL },
    update: {},
    create: { email: SYSTEM_USER_EMAIL, name: 'Profesia Scraper', isGlobalAdmin: false },
    select: { id: true },
  })
  return user.id
}

/**
 * Dedup upsert (L65) keyed on the (externalSource, externalId) unique index:
 * a re-scan of the same offer UPDATES the existing row instead of inserting a
 * duplicate.
 */
export async function upsertProfesiaJob(
  parsed: ParsedProfesiaJob,
  orgId: string,
  createdBy: string,
): Promise<void> {
  const common = {
    title: parsed.title,
    // Job.description is required (non-null); fall back to the title when the
    // offer body could not be extracted.
    description: parsed.description || parsed.title,
    city: parsed.location,
  }

  await prisma.job.upsert({
    where: {
      externalSource_externalId: {
        externalSource: PROFESIA_SOURCE,
        externalId: parsed.externalId,
      },
    },
    update: common,
    create: {
      ...common,
      employmentType: 'FULL_TIME',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      externalSource: PROFESIA_SOURCE,
      externalId: parsed.externalId,
      orgId,
      createdBy,
    },
  })
}

/**
 * Run one scrape pass: consent-gate → fetch listing → for each capped offer,
 * pause, fetch, parse, dedup-upsert. Never throws on a single-offer failure;
 * returns aggregate counts.
 */
export async function processScrape(job: ScrapeJobLike = {}): Promise<ScrapeRunResult> {
  const data = job.data ?? {}
  const source = data.source || PROFESIA_SOURCE
  const listingUrl = data.url || PROFESIA_LISTING_URL

  // CONSENT GATE — never import without a recorded DATA_IMPORT consent.
  if (!(await hasDataImportConsent())) {
    logger.warn('Scraper skipped — no DATA_IMPORT consent on record', { source })
    return { source, found: 0, imported: 0, failed: 0, skipped: true, reason: 'no-consent' }
  }

  const listingHtml = await fetchHtml(listingUrl)
  const offerUrls = parseProfesiaListing(listingHtml).slice(0, MAX_OFFERS_PER_RUN)

  const [orgId, createdBy] = await Promise.all([getSystemOrgId(), getSystemUserId()])

  let imported = 0
  let failed = 0

  for (const url of offerUrls) {
    try {
      // Rate-limit: pause between every request to stay polite to the origin.
      await delay(REQUEST_DELAY_MS)
      const detailHtml = await fetchHtml(url)
      const parsed = parseProfesiaDetail(detailHtml, url)
      if (!parsed) {
        failed++
        continue
      }
      await upsertProfesiaJob(parsed, orgId, createdBy)
      imported++
    } catch (error) {
      failed++
      logger.error('Scraper failed to import offer', {
        url,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  logger.info('Scraper run complete', { source, found: offerUrls.length, imported, failed })
  return { source, found: offerUrls.length, imported, failed }
}
