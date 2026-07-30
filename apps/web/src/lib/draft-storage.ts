/**
 * Draft persistence for long-lived forms (localStorage).
 *
 * Forms a user can spend many minutes in — the assessment runner, the CV
 * editor — used to lose *everything* on a refresh or an accidental navigation.
 * These helpers generalise the pattern already used by the CV builder
 * (`create-cv-client.tsx`): a namespaced key, a versioned envelope, a
 * defensive read, and an explicit clear once the work is safely on the server.
 *
 * Two hard rules, because localStorage is user-editable:
 *
 *  1. Store ONLY what the user typed. Never cache anything the server
 *     deliberately withheld (assessment correct answers are never even sent to
 *     the client — see `api/assessments/[id]/route.ts`), and never store data
 *     belonging to somebody else.
 *  2. Never store anything the app then *enforces* — above all not a deadline
 *     or a remaining-time value. The assessment timer is always derived from
 *     the duration the server returned on this page load; restoring a draft
 *     can never lengthen it.
 *
 * Every read is defensive: unparsable, wrong-version, foreign-shaped or
 * expired drafts are dropped silently rather than thrown.
 */

/** Bump when the stored shape changes; older envelopes are then discarded. */
export const DRAFT_VERSION = 1

const PREFIX = 'jobsphere:draft'

/** CV drafts survive a week — people come back to a half-finished CV. */
export const CV_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
/** Assessment drafts are only useful within the sitting itself. */
export const ASSESSMENT_DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000

export interface DraftEnvelope<T> {
  v: number
  savedAt: number
  data: T
}

export type AnswerValue = string | string[]

export interface AssessmentDraft {
  /** Serialised `Map<questionId, response>` — the candidate's own answers only. */
  answers: [string, AnswerValue][]
  /** Which question the candidate was on, so a refresh lands them back there. */
  questionIndex: number
}

/**
 * djb2 — used only to namespace a key by invite token without writing the raw
 * token (a bearer credential) into localStorage. Not a security primitive.
 */
function stableHash(value: string): string {
  let hash = 5381
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(36)
}

/**
 * Key for one candidate's in-progress assessment. The invite token is folded
 * in (hashed) so two invitees sharing a browser never see each other's answers.
 */
export function assessmentDraftKey(assessmentId: string, token?: string | null): string {
  const base = `${PREFIX}:assessment:${assessmentId}`
  return token ? `${base}:${stableHash(token)}` : base
}

/** Key for an in-progress edit of an existing resume. */
export function cvEditDraftKey(resumeId: string): string {
  return `${PREFIX}:cv-edit:${resumeId}`
}

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage ?? null
  } catch {
    // Safari private mode / storage disabled by policy.
    return null
  }
}

/** Persist a draft. Returns false when storage is unavailable or full. */
export function saveDraft<T>(key: string, data: T): boolean {
  const storage = getStorage()
  if (!storage) return false
  try {
    const envelope: DraftEnvelope<T> = { v: DRAFT_VERSION, savedAt: Date.now(), data }
    storage.setItem(key, JSON.stringify(envelope))
    return true
  } catch {
    // QuotaExceededError and friends — a lost draft must never break the form.
    return false
  }
}

/**
 * Read a draft back. Returns `null` (and evicts the entry) for anything that
 * is not a current-version, non-expired envelope.
 */
export function loadDraft<T>(key: string, options?: { maxAgeMs?: number }): T | null {
  const storage = getStorage()
  if (!storage) return null

  let raw: string | null
  try {
    raw = storage.getItem(key)
  } catch {
    return null
  }
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    clearDraft(key)
    return null
  }

  if (typeof parsed !== 'object' || parsed === null) {
    clearDraft(key)
    return null
  }

  const envelope = parsed as Partial<DraftEnvelope<T>>
  if (envelope.v !== DRAFT_VERSION || typeof envelope.savedAt !== 'number') {
    clearDraft(key)
    return null
  }

  const maxAgeMs = options?.maxAgeMs
  if (typeof maxAgeMs === 'number' && Date.now() - envelope.savedAt > maxAgeMs) {
    clearDraft(key)
    return null
  }

  return (envelope.data ?? null) as T | null
}

/** Drop a draft — call this the moment the data is safely on the server. */
export function clearDraft(key: string): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(key)
  } catch {
    // ignore
  }
}

/** `Map` -> JSON-safe entries. */
export function serializeAnswers(answers: Map<string, AnswerValue>): [string, AnswerValue][] {
  return Array.from(answers.entries())
}

function isAnswerValue(value: unknown): value is AnswerValue {
  return (
    typeof value === 'string' || (Array.isArray(value) && value.every((v) => typeof v === 'string'))
  )
}

/**
 * Entries -> `Map`, dropping anything malformed. When `allowedIds` is given,
 * answers for questions that are not part of the assessment as served *now*
 * are discarded, so a stale or hand-crafted draft cannot inject question ids.
 */
export function deserializeAnswers(
  raw: unknown,
  allowedIds?: Iterable<string>,
): Map<string, AnswerValue> {
  const result = new Map<string, AnswerValue>()
  if (!Array.isArray(raw)) return result

  const allowed = allowedIds ? new Set(allowedIds) : null

  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length !== 2) continue
    const [questionId, value] = entry as [unknown, unknown]
    if (typeof questionId !== 'string' || questionId.length === 0) continue
    if (allowed && !allowed.has(questionId)) continue
    if (!isAnswerValue(value)) continue
    result.set(questionId, value)
  }

  return result
}
