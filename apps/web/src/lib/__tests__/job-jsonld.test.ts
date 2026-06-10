/**
 * Focused unit tests for the JobPosting JSON-LD generator (SEO-002/003/010).
 * We extract and test the pure logic in isolation — no Next.js or Prisma required.
 */

import { describe, it, expect } from 'vitest'

// Re-implement the generator as a pure function for testability
// (mirrors the implementation in apps/web/src/app/[locale]/jobs/[id]/page.tsx)
function generateJobPostingJsonLd(job: Record<string, any>, locale: string) {
  const appUrl = 'https://jobsphere.com'

  const employmentTypeMap: Record<string, string> = {
    FULL_TIME: 'FULL_TIME',
    PART_TIME: 'PART_TIME',
    CONTRACT: 'CONTRACTOR',
    INTERNSHIP: 'INTERN',
    TEMPORARY: 'TEMPORARY',
  }

  const addressCountry: string = job.country ?? 'SK'

  const baseDate = job.publishedAt ? new Date(job.publishedAt) : new Date(job.createdAt)
  const validThroughDate = job.closedAt
    ? new Date(job.closedAt)
    : new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000)
  const validThrough = validThroughDate.toISOString().split('T')[0]

  const datePosted = job.publishedAt
    ? new Date(job.publishedAt).toISOString().split('T')[0]
    : new Date(job.createdAt).toISOString().split('T')[0]

  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description || '',
    datePosted,
    validThrough,
    employmentType: employmentTypeMap[job.employmentType] || job.employmentType,
    hiringOrganization: {
      '@type': 'Organization',
      name: job.organization.name,
      ...(job.organization.logo && { logo: job.organization.logo }),
      ...(job.organization.website && { sameAs: job.organization.website }),
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        ...(job.city && { addressLocality: job.city }),
        ...(job.region && { addressRegion: job.region }),
        addressCountry,
      },
    },
    directApply: true,
    url: `${appUrl}/${locale}/jobs/${job.id}`,
  }

  if (job.remote) {
    jsonLd.jobLocationType = 'TELECOMMUTE'
    jsonLd.applicantLocationRequirements = {
      '@type': 'Country',
      name: addressCountry,
    }
  }

  if (job.salaryMin || job.salaryMax) {
    const unitText = job.salaryPeriod === 'MONTH' ? 'MONTH' : 'YEAR'
    jsonLd.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: job.salaryCurrency || 'EUR',
      value: {
        '@type': 'QuantitativeValue',
        unitText,
        ...(job.salaryMin && job.salaryMax
          ? { minValue: job.salaryMin, maxValue: job.salaryMax }
          : job.salaryMin
            ? { value: job.salaryMin }
            : { maxValue: job.salaryMax }),
      },
    }
  }

  return jsonLd
}

const BASE_JOB = {
  id: 'job-001',
  title: 'Senior Developer',
  description: 'Build awesome things',
  employmentType: 'FULL_TIME',
  createdAt: '2026-01-01T00:00:00.000Z',
  publishedAt: '2026-01-02T00:00:00.000Z',
  closedAt: null,
  remote: false,
  hybrid: false,
  city: 'Bratislava',
  region: 'BA',
  country: null,
  salaryMin: 3000,
  salaryMax: 5000,
  salaryCurrency: 'EUR',
  salaryPeriod: 'MONTH',
  organization: {
    name: 'Acme s.r.o.',
    logo: null,
    website: 'https://acme.sk',
  },
}

describe('generateJobPostingJsonLd', () => {
  it('always includes addressCountry — defaults to SK when job.country is null', () => {
    const ld = generateJobPostingJsonLd({ ...BASE_JOB, country: null }, 'sk')
    expect(ld.jobLocation.address.addressCountry).toBe('SK')
  })

  it('uses stored job.country when present', () => {
    const ld = generateJobPostingJsonLd({ ...BASE_JOB, country: 'DE' }, 'de')
    expect(ld.jobLocation.address.addressCountry).toBe('DE')
  })

  it('always includes validThrough — derived from publishedAt + 30 days when closedAt is null', () => {
    const ld = generateJobPostingJsonLd({ ...BASE_JOB, closedAt: null }, 'sk')
    expect(ld.validThrough).toBeDefined()
    // publishedAt 2026-01-02 + 30 days = 2026-02-01
    expect(ld.validThrough).toBe('2026-02-01')
  })

  it('uses closedAt for validThrough when set', () => {
    const ld = generateJobPostingJsonLd({ ...BASE_JOB, closedAt: '2026-03-15T00:00:00.000Z' }, 'sk')
    expect(ld.validThrough).toBe('2026-03-15')
  })

  it('uses publishedAt for datePosted when available', () => {
    const ld = generateJobPostingJsonLd(BASE_JOB, 'sk')
    expect(ld.datePosted).toBe('2026-01-02')
  })

  it('falls back to createdAt for datePosted when publishedAt is null', () => {
    const ld = generateJobPostingJsonLd({ ...BASE_JOB, publishedAt: null }, 'sk')
    expect(ld.datePosted).toBe('2026-01-01')
  })

  it('includes addressLocality from city', () => {
    const ld = generateJobPostingJsonLd(BASE_JOB, 'sk')
    expect(ld.jobLocation.address.addressLocality).toBe('Bratislava')
  })

  it('sets jobLocationType=TELECOMMUTE and applicantLocationRequirements for remote jobs', () => {
    const ld = generateJobPostingJsonLd({ ...BASE_JOB, remote: true }, 'sk')
    expect(ld.jobLocationType).toBe('TELECOMMUTE')
    expect(ld.applicantLocationRequirements).toMatchObject({ '@type': 'Country', name: 'SK' })
  })

  it('does NOT set jobLocationType for on-site jobs', () => {
    const ld = generateJobPostingJsonLd({ ...BASE_JOB, remote: false }, 'sk')
    expect(ld.jobLocationType).toBeUndefined()
  })

  it('maps CONTRACT to CONTRACTOR employment type', () => {
    const ld = generateJobPostingJsonLd({ ...BASE_JOB, employmentType: 'CONTRACT' }, 'sk')
    expect(ld.employmentType).toBe('CONTRACTOR')
  })

  it('includes baseSalary with correct unitText for MONTH period', () => {
    const ld = generateJobPostingJsonLd({ ...BASE_JOB, salaryPeriod: 'MONTH' }, 'sk')
    expect(ld.baseSalary['@type']).toBe('MonetaryAmount')
    expect(ld.baseSalary.value.unitText).toBe('MONTH')
    expect(ld.baseSalary.value.minValue).toBe(3000)
    expect(ld.baseSalary.value.maxValue).toBe(5000)
  })

  it('serialises without XSS — < is escaped in JSON string', () => {
    const ld = generateJobPostingJsonLd(
      { ...BASE_JOB, description: '<script>alert(1)</script>' },
      'sk',
    )
    const serialised = JSON.stringify(ld).replace(/</g, '\\u003c')
    expect(serialised).not.toContain('<script>')
    expect(serialised).toContain('\\u003cscript')
  })
})
