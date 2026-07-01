export const APPLICATION_STAGES = ['NEW', 'SCREENING', 'INTERVIEW', 'HIRED', 'REJECTED'] as const

export type ApplicationStage = (typeof APPLICATION_STAGES)[number]

export const STAGE_LABELS_SK: Record<ApplicationStage, string> = {
  NEW: 'Noví záujemcovia',
  SCREENING: 'Posudzovanie',
  INTERVIEW: 'Pozvaný na pohovor',
  HIRED: 'Prijatý',
  REJECTED: 'Odmietnutý',
}

export const STAGE_LABELS_EN: Record<ApplicationStage, string> = {
  NEW: 'New',
  SCREENING: 'Screening',
  INTERVIEW: 'Interview',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
}

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
 * there needs an explicit "Prijať / Odmietnuť" choice.
 */
export const KANBAN_COLUMNS = [
  { key: 'NEW', label: 'Noví záujemcovia', stages: ['NEW'] as const },
  { key: 'INTERVIEW', label: 'Pozvaný na pohovor', stages: ['INTERVIEW'] as const },
  { key: 'SCREENING', label: 'Posudzovanie', stages: ['SCREENING'] as const },
  { key: 'RESULT', label: 'Prijatý / Odmietnutý', stages: ['HIRED', 'REJECTED'] as const },
] as const

export type KanbanColumnKey = (typeof KANBAN_COLUMNS)[number]['key']

export function getStageLabel(stage: string, locale: 'sk' | 'en' = 'sk'): string {
  const map = locale === 'sk' ? STAGE_LABELS_SK : STAGE_LABELS_EN
  return map[stage as ApplicationStage] ?? stage
}
