/**
 * Job status lifecycle.
 *
 * `status` was absent from `updateJobSchema`, and zod without `.strict()` drops
 * unknown keys silently — so a job could not be paused or reopened through the
 * API at all, and the UI had no way to offer it. The only writer of `PAUSED`
 * anywhere in the app was the `updateJobStatus` server action.
 *
 * Transitions are enumerated rather than exposed as a free enum. "Any status to
 * any status" would let a CLOSED posting jump straight back to PUBLISHED without
 * anyone re-reading it, and would let a DRAFT be paused, which means nothing.
 */

export const JOB_STATUSES = ['DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED'] as const

export type JobStatus = (typeof JOB_STATUSES)[number]

/**
 * ARCHIVED exists in the service-layer type union but nothing in the app writes
 * or reads it, so it is deliberately not offered here. Adding it would mean
 * deciding what it means first.
 */

/**
 * Allowed moves, keyed by current status.
 *
 * - DRAFT    → publish it, or close it without ever publishing
 * - PUBLISHED→ pause it (temporarily off the market) or close it (done)
 * - PAUSED   → resume, or close
 * - CLOSED   → back to DRAFT only. Reopening a closed posting means editing and
 *              republishing it deliberately, not flipping a switch.
 */
export const ALLOWED_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  DRAFT: ['PUBLISHED', 'CLOSED'],
  PUBLISHED: ['PAUSED', 'CLOSED'],
  PAUSED: ['PUBLISHED', 'CLOSED'],
  CLOSED: ['DRAFT'],
}

export function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === 'string' && (JOB_STATUSES as readonly string[]).includes(value)
}

/**
 * True when `to` may be reached from `from`.
 *
 * A no-op transition (`from === to`) is allowed: the edit form submits the whole
 * object including the unchanged status, and rejecting that would make every
 * save fail.
 */
export function canTransition(from: string, to: JobStatus): boolean {
  if (from === to) return true
  if (!isJobStatus(from)) {
    // A status outside the known set (legacy row, or ARCHIVED) is not something
    // this table can reason about. Only closing is allowed out of it.
    return to === 'CLOSED'
  }
  return ALLOWED_TRANSITIONS[from].includes(to)
}

/**
 * Whether this transition is the moment the job first goes live.
 *
 * `publishedAt` must be stamped once and then left alone — otherwise pausing and
 * resuming a posting would keep resetting its age, and "posted 3 days ago" would
 * be a lie. POST /api/jobs already sets it on create; PATCH never did.
 */
export function shouldStampPublishedAt(
  to: JobStatus,
  currentPublishedAt: Date | null | undefined,
): boolean {
  return to === 'PUBLISHED' && !currentPublishedAt
}
