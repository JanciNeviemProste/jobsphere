export const APPLICATION_STAGES = [
  'NEW',
  'SCREENING',
  'PHONE_SCREEN',
  'INTERVIEW',
  'OFFER',
  'HIRED',
  'REJECTED',
] as const

export type ApplicationStage = (typeof APPLICATION_STAGES)[number]

export const STAGE_LABELS_SK: Record<ApplicationStage, string> = {
  NEW: 'Nové',
  SCREENING: 'Posudzovanie',
  PHONE_SCREEN: 'Tel. pohovor',
  INTERVIEW: 'Pohovor',
  OFFER: 'Ponuka',
  HIRED: 'Prijatý',
  REJECTED: 'Odmietnutý',
}

export const STAGE_LABELS_EN: Record<ApplicationStage, string> = {
  NEW: 'New',
  SCREENING: 'Screening',
  PHONE_SCREEN: 'Phone Screen',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
}

export const STAGE_COLORS: Record<ApplicationStage, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  SCREENING: 'bg-purple-100 text-purple-800',
  PHONE_SCREEN: 'bg-indigo-100 text-indigo-800',
  INTERVIEW: 'bg-amber-100 text-amber-800',
  OFFER: 'bg-emerald-100 text-emerald-800',
  HIRED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
}

export const ACTIVE_STAGES: readonly ApplicationStage[] = [
  'NEW',
  'SCREENING',
  'PHONE_SCREEN',
  'INTERVIEW',
  'OFFER',
]

export const TERMINAL_STAGES: readonly ApplicationStage[] = ['HIRED', 'REJECTED']

export function getStageLabel(stage: string, locale: 'sk' | 'en' = 'sk'): string {
  const map = locale === 'sk' ? STAGE_LABELS_SK : STAGE_LABELS_EN
  return map[stage as ApplicationStage] ?? stage
}
