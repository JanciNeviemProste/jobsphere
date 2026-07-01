/**
 * PR2 — the ATS pipeline collapsed to 5 canonical stages and a 4-column Kanban.
 * These pins lock in that PHONE_SCREEN / OFFER are gone and the column model
 * matches the client spec (order + the RESULT column grouping HIRED+REJECTED).
 */

import { describe, it, expect } from 'vitest'
import {
  APPLICATION_STAGES,
  STAGE_LABELS_SK,
  STAGE_LABELS_EN,
  STAGE_COLORS,
  ACTIVE_STAGES,
  TERMINAL_STAGES,
  KANBAN_COLUMNS,
  getStageLabel,
  type ApplicationStage,
} from '../application-stages'

describe('application-stages — 5 canonical stages', () => {
  it('has exactly the 5 canonical stages and no legacy stages', () => {
    expect(APPLICATION_STAGES).toEqual(['NEW', 'SCREENING', 'INTERVIEW', 'HIRED', 'REJECTED'])
    expect(APPLICATION_STAGES).not.toContain('PHONE_SCREEN')
    expect(APPLICATION_STAGES).not.toContain('OFFER')
  })

  it('label + color maps cover exactly the 5 stages', () => {
    for (const map of [STAGE_LABELS_SK, STAGE_LABELS_EN, STAGE_COLORS]) {
      expect(Object.keys(map).sort()).toEqual([...APPLICATION_STAGES].sort())
      expect(map).not.toHaveProperty('PHONE_SCREEN')
      expect(map).not.toHaveProperty('OFFER')
    }
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

  it('uses the client SK labels', () => {
    expect(STAGE_LABELS_SK).toEqual({
      NEW: 'Noví záujemcovia',
      SCREENING: 'Posudzovanie',
      INTERVIEW: 'Pozvaný na pohovor',
      HIRED: 'Prijatý',
      REJECTED: 'Odmietnutý',
    })
  })

  it('getStageLabel resolves SK/EN and falls back to the raw value', () => {
    expect(getStageLabel('INTERVIEW', 'sk')).toBe('Pozvaný na pohovor')
    expect(getStageLabel('INTERVIEW', 'en')).toBe('Interview')
    expect(getStageLabel('UNKNOWN_STAGE')).toBe('UNKNOWN_STAGE')
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
})
