export const APPLICATION_STAGES = ['NEW', 'SCREENING', 'INTERVIEW', 'HIRED', 'REJECTED'] as const

export type ApplicationStage = (typeof APPLICATION_STAGES)[number]

/**
 * Stage labels live in the message catalogs under `employer.stages.*`, not here.
 *
 * This file used to export STAGE_LABELS_SK and STAGE_LABELS_EN, and the app
 * picked whichever the author happened to import: three screens rendered the
 * English names and five rendered the Slovak ones — neither followed the
 * reader's locale, so a German recruiter saw a mix of English and Slovak stage
 * names. `getStageLabel(stage, locale)` was typed `'sk' | 'en'` and defaulted to
 * 'sk', so it could not serve de/cs/pl at all.
 *
 * Call `useTranslations('employer.stages')` / `getTranslations` and index by the
 * stage key instead. What stays here is the structural data — which stages
 * exist, how they group, what colour they get — none of which is language.
 */

export const STAGE_COLORS: Record<ApplicationStage, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  SCREENING: 'bg-purple-100 text-purple-800',
  INTERVIEW: 'bg-amber-100 text-amber-800',
  HIRED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
}

export const ACTIVE_STAGES: readonly ApplicationStage[] = ['NEW', 'SCREENING', 'INTERVIEW']

export const TERMINAL_STAGES: readonly ApplicationStage[] = ['HIRED', 'REJECTED']

/**
 * Kanban board layout — 4 columns in the order the client requested.
 * The RESULT column groups the two terminal stages (HIRED + REJECTED) so a drop
 * there needs an explicit hire/reject choice.
 *
 * `key` doubles as the translation key: `employer.kanbanColumns.<key>`.
 */
export const KANBAN_COLUMNS = [
  { key: 'NEW', stages: ['NEW'] as const },
  { key: 'INTERVIEW', stages: ['INTERVIEW'] as const },
  { key: 'SCREENING', stages: ['SCREENING'] as const },
  { key: 'RESULT', stages: ['HIRED', 'REJECTED'] as const },
] as const

export type KanbanColumnKey = (typeof KANBAN_COLUMNS)[number]['key']
