/**
 * PR2 — the ATS pipeline collapsed to 5 canonical stages and a 4-column Kanban.
 * These pins lock in that PHONE_SCREEN / OFFER are gone and the column model
 * matches the client spec (order + the RESULT column grouping HIRED+REJECTED).
 */

import { describe, it, expect } from 'vitest'
import {
  APPLICATION_STAGES,
  STAGE_COLORS,
  ACTIVE_STAGES,
  TERMINAL_STAGES,
  KANBAN_COLUMNS,
  type ApplicationStage,
} from '../application-stages'
import en from '../../../../messages/en.json'
import de from '../../../../messages/de.json'
import cs from '../../../../messages/cs.json'
import sk from '../../../../messages/sk.json'
import pl from '../../../../messages/pl.json'

const CATALOGS = { en, de, cs, sk, pl } as const

describe('application-stages — 5 canonical stages', () => {
  it('has exactly the 5 canonical stages and no legacy stages', () => {
    expect(APPLICATION_STAGES).toEqual(['NEW', 'SCREENING', 'INTERVIEW', 'HIRED', 'REJECTED'])
    expect(APPLICATION_STAGES).not.toContain('PHONE_SCREEN')
    expect(APPLICATION_STAGES).not.toContain('OFFER')
  })

  it('the color map covers exactly the 5 stages', () => {
    expect(Object.keys(STAGE_COLORS).sort()).toEqual([...APPLICATION_STAGES].sort())
    expect(STAGE_COLORS).not.toHaveProperty('PHONE_SCREEN')
    expect(STAGE_COLORS).not.toHaveProperty('OFFER')
  })

  it('splits stages into active vs terminal', () => {
    expect([...ACTIVE_STAGES]).toEqual(['NEW', 'SCREENING', 'INTERVIEW'])
    expect([...TERMINAL_STAGES]).toEqual(['HIRED', 'REJECTED'])
    // Every stage is either active or terminal, none both.
    for (const stage of APPLICATION_STAGES) {
      const inActive = ACTIVE_STAGES.includes(stage)
      const inTerminal = TERMINAL_STAGES.includes(stage)
      expect(inActive || inTerminal).toBe(true)
      expect(inActive && inTerminal).toBe(false)
    }
  })

  // Labels used to live in this module as STAGE_LABELS_SK / STAGE_LABELS_EN,
  // which meant three screens rendered English and five rendered Slovak with no
  // regard for the reader's locale. They are message-catalog keys now, so what
  // this file has to guarantee is that every stage HAS a translation in every
  // locale — a stronger contract than pinning two hardcoded maps.
  it('every stage has a translation in all five catalogs', () => {
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      const stages = (catalog as Record<string, any>).employer?.stages
      expect(stages, `${locale}: employer.stages missing`).toBeDefined()
      expect(Object.keys(stages).sort(), `${locale}: employer.stages`).toEqual(
        [...APPLICATION_STAGES].sort(),
      )
      for (const stage of APPLICATION_STAGES) {
        expect(typeof stages[stage], `${locale}.employer.stages.${stage}`).toBe('string')
        expect(stages[stage].trim(), `${locale}.employer.stages.${stage} is blank`).not.toBe('')
      }
    }
  })

  it('the Slovak stage labels still read the way the client specified', () => {
    expect((sk as Record<string, any>).employer.stages).toEqual({
      NEW: 'Noví záujemcovia',
      SCREENING: 'Posudzovanie',
      INTERVIEW: 'Pozvaný na pohovor',
      HIRED: 'Prijatý',
      REJECTED: 'Odmietnutý',
    })
  })
})

describe('KANBAN_COLUMNS — 4 columns', () => {
  it('has 4 columns in the client-specified order', () => {
    expect(KANBAN_COLUMNS.map((c) => c.key)).toEqual(['NEW', 'INTERVIEW', 'SCREENING', 'RESULT'])
  })

  it('the RESULT column groups both terminal stages', () => {
    const result = KANBAN_COLUMNS.find((c) => c.key === 'RESULT')
    expect(result).toBeDefined()
    expect([...(result!.stages as readonly string[])]).toEqual(['HIRED', 'REJECTED'])
  })

  it('every stage maps to exactly one column and every column stage is valid', () => {
    const seen = new Map<string, number>()
    for (const column of KANBAN_COLUMNS) {
      for (const stage of column.stages) {
        expect(APPLICATION_STAGES).toContain(stage as ApplicationStage)
        seen.set(stage, (seen.get(stage) ?? 0) + 1)
      }
    }
    for (const stage of APPLICATION_STAGES) {
      expect(seen.get(stage)).toBe(1)
    }
    // No legacy stages leaked into a column.
    expect(seen.has('PHONE_SCREEN')).toBe(false)
    expect(seen.has('OFFER')).toBe(false)
  })

  // `key` doubles as the translation key, so a renamed column silently loses its
  // heading unless the catalogs move with it.
  it('every column key has a translation in all five catalogs', () => {
    const keys = KANBAN_COLUMNS.map((c) => c.key).sort()
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      const columns = (catalog as Record<string, any>).employer?.kanbanColumns
      expect(columns, `${locale}: employer.kanbanColumns missing`).toBeDefined()
      expect(Object.keys(columns).sort(), `${locale}: employer.kanbanColumns`).toEqual(keys)
    }
  })
})
