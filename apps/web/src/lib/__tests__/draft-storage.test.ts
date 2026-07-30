import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  ASSESSMENT_DRAFT_MAX_AGE_MS,
  DRAFT_VERSION,
  assessmentDraftKey,
  clearDraft,
  cvEditDraftKey,
  deserializeAnswers,
  loadDraft,
  saveDraft,
  serializeAnswers,
  type AnswerValue,
  type AssessmentDraft,
} from '../draft-storage'

describe('draft-storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('keys', () => {
    it('namespaces assessment drafts per assessment', () => {
      expect(assessmentDraftKey('a1')).not.toBe(assessmentDraftKey('a2'))
      expect(assessmentDraftKey('a1')).toContain('a1')
    })

    it('separates two invitees sharing one browser', () => {
      expect(assessmentDraftKey('a1', 'token-one')).not.toBe(assessmentDraftKey('a1', 'token-two'))
    })

    it('never writes the raw invite token into the key', () => {
      const token = 'super-secret-invite-token'
      expect(assessmentDraftKey('a1', token)).not.toContain(token)
    })

    it('is stable for the same inputs', () => {
      expect(assessmentDraftKey('a1', 'tok')).toBe(assessmentDraftKey('a1', 'tok'))
      expect(cvEditDraftKey('r1')).toBe(cvEditDraftKey('r1'))
    })

    it('namespaces cv drafts per resume', () => {
      expect(cvEditDraftKey('r1')).not.toBe(cvEditDraftKey('r2'))
    })
  })

  describe('save / load / clear', () => {
    it('round-trips a draft', () => {
      const key = cvEditDraftKey('r1')
      expect(saveDraft(key, { title: 'My CV' })).toBe(true)
      expect(loadDraft<{ title: string }>(key)).toEqual({ title: 'My CV' })
    })

    it('returns null when nothing was saved', () => {
      expect(loadDraft(cvEditDraftKey('missing'))).toBeNull()
    })

    it('clears a draft', () => {
      const key = cvEditDraftKey('r1')
      saveDraft(key, { title: 'My CV' })
      clearDraft(key)
      expect(loadDraft(key)).toBeNull()
    })

    it('drops (and evicts) unparsable entries', () => {
      const key = cvEditDraftKey('r1')
      localStorage.setItem(key, 'not json {{{')
      expect(loadDraft(key)).toBeNull()
      expect(localStorage.getItem(key)).toBeNull()
    })

    it('drops envelopes written by an older draft version', () => {
      const key = cvEditDraftKey('r1')
      localStorage.setItem(
        key,
        JSON.stringify({ v: DRAFT_VERSION + 1, savedAt: Date.now(), data: { title: 'x' } }),
      )
      expect(loadDraft(key)).toBeNull()
    })

    it('drops drafts older than maxAgeMs', () => {
      const key = assessmentDraftKey('a1')
      saveDraft(key, { answers: [], questionIndex: 0 })

      vi.useFakeTimers()
      vi.setSystemTime(Date.now() + ASSESSMENT_DRAFT_MAX_AGE_MS + 1000)

      expect(loadDraft(key, { maxAgeMs: ASSESSMENT_DRAFT_MAX_AGE_MS })).toBeNull()
    })

    it('keeps drafts inside maxAgeMs', () => {
      const key = assessmentDraftKey('a1')
      saveDraft(key, { answers: [], questionIndex: 3 })
      expect(loadDraft<AssessmentDraft>(key, { maxAgeMs: ASSESSMENT_DRAFT_MAX_AGE_MS })).toEqual({
        answers: [],
        questionIndex: 3,
      })
    })

    it('never persists a deadline or remaining-time value', () => {
      // Guards the anti-cheat invariant: the assessment timer must always come
      // from the server response, never from user-editable storage.
      const key = assessmentDraftKey('a1')
      const draft: AssessmentDraft = {
        answers: [['q1', 'answer']],
        questionIndex: 0,
      }
      saveDraft(key, draft)
      const raw = localStorage.getItem(key) ?? ''
      expect(raw).not.toMatch(/deadline|timeRemaining|expiresAt|durationMin/i)
    })
  })

  describe('answer (de)serialisation', () => {
    it('round-trips a Map of answers', () => {
      const answers = new Map<string, AnswerValue>([
        ['q1', 'text answer'],
        ['q2', ['a', 'b']],
      ])
      const restored = deserializeAnswers(serializeAnswers(answers))
      expect(restored.get('q1')).toBe('text answer')
      expect(restored.get('q2')).toEqual(['a', 'b'])
      expect(restored.size).toBe(2)
    })

    it('filters out answers for questions not in the served assessment', () => {
      const raw = [
        ['q1', 'kept'],
        ['injected', 'dropped'],
      ]
      const restored = deserializeAnswers(raw, ['q1', 'q2'])
      expect(restored.has('q1')).toBe(true)
      expect(restored.has('injected')).toBe(false)
    })

    it('ignores malformed entries instead of throwing', () => {
      const raw = [
        ['q1', 'ok'],
        ['q2'],
        [42, 'bad id'],
        ['q3', { nope: true }],
        ['q4', [1, 2]],
        'garbage',
        null,
      ]
      const restored = deserializeAnswers(raw)
      expect(Array.from(restored.keys())).toEqual(['q1'])
    })

    it('returns an empty Map for a non-array payload', () => {
      expect(deserializeAnswers(undefined).size).toBe(0)
      expect(deserializeAnswers({ q1: 'a' }).size).toBe(0)
    })
  })

  describe('resilience when storage is unavailable', () => {
    it('reports failure instead of throwing when setItem rejects', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })
      expect(saveDraft(cvEditDraftKey('r1'), { title: 'x' })).toBe(false)
      spy.mockRestore()
    })

    it('returns null instead of throwing when getItem rejects', () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })
      expect(loadDraft(cvEditDraftKey('r1'))).toBeNull()
      spy.mockRestore()
    })
  })
})
