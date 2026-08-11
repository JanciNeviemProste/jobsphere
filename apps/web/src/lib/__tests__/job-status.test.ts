/**
 * Job status transitions.
 *
 * `status` was missing from updateJobSchema, and zod without `.strict()` drops
 * unknown keys without complaint — so pausing or reopening a posting was
 * impossible through the API and the UI could not offer it. The only writer of
 * PAUSED anywhere was the updateJobStatus server action.
 *
 * The table is enumerated rather than "any status to any status", and these
 * tests pin why each edge is or is not there.
 */

import { describe, it, expect } from 'vitest'
import {
  JOB_STATUSES,
  ALLOWED_TRANSITIONS,
  canTransition,
  isJobStatus,
  shouldStampPublishedAt,
} from '../job-status'

describe('the status set', () => {
  it('is the four the application actually uses', () => {
    expect([...JOB_STATUSES]).toEqual(['DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED'])
  })

  it('excludes ARCHIVED, which nothing reads or writes', () => {
    // It exists in the service-layer union and in no query. Offering it would
    // mean deciding what it means first.
    expect(JOB_STATUSES).not.toContain('ARCHIVED' as never)
  })

  it('every status has an entry in the transition table', () => {
    for (const status of JOB_STATUSES) {
      expect(ALLOWED_TRANSITIONS[status], status).toBeDefined()
    }
  })

  it.each([['ARCHIVED'], ['ACTIVE'], [''], ['published']])('%s is not a status', (value) => {
    expect(isJobStatus(value)).toBe(false)
  })
})

describe('allowed moves', () => {
  it.each([
    ['DRAFT', 'PUBLISHED'],
    ['DRAFT', 'CLOSED'],
    ['PUBLISHED', 'PAUSED'],
    ['PUBLISHED', 'CLOSED'],
    ['PAUSED', 'PUBLISHED'],
    ['PAUSED', 'CLOSED'],
    ['CLOSED', 'DRAFT'],
  ] as const)('%s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true)
  })

  it('lets a posting be paused and resumed, which is the point of this change', () => {
    expect(canTransition('PUBLISHED', 'PAUSED')).toBe(true)
    expect(canTransition('PAUSED', 'PUBLISHED')).toBe(true)
  })
})

describe('refused moves', () => {
  it('CLOSED cannot jump straight back to PUBLISHED', () => {
    // Reopening should mean editing and republishing deliberately, not flipping
    // a switch on a posting nobody has re-read.
    expect(canTransition('CLOSED', 'PUBLISHED')).toBe(false)
    expect(canTransition('CLOSED', 'DRAFT')).toBe(true)
  })

  it('a DRAFT cannot be paused — there is nothing to pause', () => {
    expect(canTransition('DRAFT', 'PAUSED')).toBe(false)
  })

  it('CLOSED cannot be paused', () => {
    expect(canTransition('CLOSED', 'PAUSED')).toBe(false)
  })
})

describe('edge cases', () => {
  it.each([...JOB_STATUSES])('%s -> itself is allowed', (status) => {
    // The edit form submits the whole object including an unchanged status;
    // rejecting that would make every save fail.
    expect(canTransition(status, status)).toBe(true)
  })

  it('an unknown current status can only be closed', () => {
    // Legacy rows, or ARCHIVED written by the unused service method. Closing is
    // the one move that is meaningful from a state we cannot reason about.
    expect(canTransition('ARCHIVED', 'CLOSED')).toBe(true)
    expect(canTransition('ARCHIVED', 'PUBLISHED')).toBe(false)
    expect(canTransition('WHATEVER', 'DRAFT')).toBe(false)
  })
})

describe('publishedAt is stamped once', () => {
  it('stamps on the first publish', () => {
    expect(shouldStampPublishedAt('PUBLISHED', null)).toBe(true)
    expect(shouldStampPublishedAt('PUBLISHED', undefined)).toBe(true)
  })

  it('does not re-stamp when resuming a paused posting', () => {
    // Otherwise pausing and resuming keeps resetting the posting's age and
    // "posted 3 days ago" quietly becomes false.
    expect(shouldStampPublishedAt('PUBLISHED', new Date('2026-01-01'))).toBe(false)
  })

  it.each(['DRAFT', 'PAUSED', 'CLOSED'] as const)('does not stamp on %s', (status) => {
    expect(shouldStampPublishedAt(status, null)).toBe(false)
  })
})
