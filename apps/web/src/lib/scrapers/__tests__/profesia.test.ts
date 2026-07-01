/**
 * Profesia parser (L65) — pure cheerio parsing against fixture HTML. No network.
 */

import { describe, it, expect } from 'vitest'
import { extractProfesiaId, parseProfesiaListing, parseProfesiaDetail } from '../profesia'

const LISTING_HTML = `
  <ul class="list">
    <li><a href="/praca/acme-sro/O1234567">Senior Developer</a></li>
    <li><a href="/praca/acme-sro/O1234567">Senior Developer (dup)</a></li>
    <li><a href="https://www.profesia.sk/praca/beta/O7654321">QA Engineer</a></li>
    <li><a href="/praca/nezmysel">No offer id here</a></li>
  </ul>
`

const DETAIL_HTML = `
  <html><body>
    <h1 itemprop="title">Senior Developer</h1>
    <span itemprop="hiringOrganization">Acme s.r.o.</span>
    <span itemprop="jobLocation">Bratislava</span>
    <div itemprop="description">We are hiring an experienced developer to join us.</div>
  </body></html>
`

describe('extractProfesiaId', () => {
  it('extracts the O-id from an offer URL', () => {
    expect(extractProfesiaId('https://www.profesia.sk/praca/acme/O1234567')).toBe('O1234567')
    expect(extractProfesiaId('/praca/acme/O42/')).toBe('O42')
  })
  it('returns null when there is no offer id', () => {
    expect(extractProfesiaId('/praca/acme')).toBeNull()
    expect(extractProfesiaId('')).toBeNull()
  })
})

describe('parseProfesiaListing', () => {
  it('returns absolute, deduped offer URLs only (skips non-offer links)', () => {
    const urls = parseProfesiaListing(LISTING_HTML)
    expect(urls).toContain('https://www.profesia.sk/praca/acme-sro/O1234567')
    expect(urls).toContain('https://www.profesia.sk/praca/beta/O7654321')
    // Deduped + non-offer link excluded.
    expect(urls).toHaveLength(2)
  })
})

describe('parseProfesiaDetail', () => {
  it('extracts title, company, location, description and externalId', () => {
    const url = 'https://www.profesia.sk/praca/acme-sro/O1234567'
    const parsed = parseProfesiaDetail(DETAIL_HTML, url)
    expect(parsed).not.toBeNull()
    expect(parsed!.externalId).toBe('O1234567')
    expect(parsed!.title).toBe('Senior Developer')
    expect(parsed!.company).toBe('Acme s.r.o.')
    expect(parsed!.location).toBe('Bratislava')
    expect(parsed!.description).toContain('experienced developer')
  })

  it('returns null when the URL has no offer id', () => {
    expect(parseProfesiaDetail(DETAIL_HTML, '/praca/acme')).toBeNull()
  })
})
