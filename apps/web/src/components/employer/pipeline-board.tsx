'use client'

import { useState, useRef, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  APPLICATION_STAGES,
  KANBAN_COLUMNS,
  STAGE_COLORS,
  type ApplicationStage,
} from '@/lib/constants/application-stages'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

export interface ApplicationCard {
  id: string
  stage: string
  createdAt: Date | string
  job: { id: string; title: string }
  candidate: {
    contacts: { fullName?: string | null; email?: string | null }[]
  }
  score?: number | null
  avatar?: string | null
}

interface PipelineBoardProps {
  applications: ApplicationCard[]
  jobs?: { id: string; title: string }[]
  currentJobId?: string
  /**
   * True number of applications per stage on the server, before the per-stage
   * cap the page applies. Without it the column header would print the capped
   * count as if it were the total and quietly hide the overflow.
   */
  stageTotals?: Partial<Record<ApplicationStage, number>>
}

// `locale` is threaded in rather than hardcoded: this used to construct
// RelativeTimeFormat('sk'), so every reader — German, Czech, Polish — got
// Slovak relative dates ("pred 3 dňami") on their kanban cards.
function relativeTime(date: Date | string, locale: string): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diffMs = now - then
  const diffDays = Math.floor(diffMs / 86400000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (diffDays === 0) return rtf.format(0, 'day')
  if (diffDays < 30) return rtf.format(-diffDays, 'day')
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return rtf.format(-diffMonths, 'month')
  return rtf.format(-Math.floor(diffMonths / 12), 'year')
}

function candidateName(app: ApplicationCard, fallback: string): string {
  const contact = app.candidate.contacts[0]
  return contact?.fullName || contact?.email || fallback
}

function initials(name: string): string {
  return (
    name
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'K'
  )
}

// Match-score chip — same 80/60 thresholds as ApplicantSummaryCard's ScoreBadge.
function ScoreBadge({ score }: { score: number }) {
  let colorClass = 'bg-red-100 text-red-800'
  if (score >= 80) colorClass = 'bg-green-100 text-green-800'
  else if (score >= 60) colorClass = 'bg-amber-100 text-amber-800'

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${colorClass}`}
    >
      {score}%
    </span>
  )
}

function CardAvatar({ name, avatar }: { name: string; avatar?: string | null }) {
  if (avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatar} alt={name} className="h-9 w-9 flex-shrink-0 rounded-full object-cover" />
    )
  }
  return (
    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
      <span className="text-xs font-semibold text-primary">{initials(name)}</span>
    </div>
  )
}

export function PipelineBoard({ applications, currentJobId, stageTotals }: PipelineBoardProps) {
  const pathname = usePathname()
  const t = useTranslations('employer.pipelineBoard')
  const tCommon = useTranslations('common')
  const tStages = useTranslations('employer.stages')
  const tColumns = useTranslations('employer.kanbanColumns')
  const locale = pathname.split('/')[1] || 'en'
  const [cards, setCards] = useState<ApplicationCard[]>(applications)
  const dragId = useRef<string | null>(null)
  // The RESULT column groups HIRED + REJECTED, so a drop there needs an explicit choice.
  const [pendingResult, setPendingResult] = useState<{ id: string; name: string } | null>(null)

  const columnCards = (stages: readonly string[]) => cards.filter((c) => stages.includes(c.stage))

  // How many applications the server holds back per stage. Derived from the
  // ORIGINAL `applications` prop, not from `cards`, so the number stays stable
  // while the recruiter moves cards between columns.
  const hiddenByStage = useMemo(() => {
    const loaded = new Map<string, number>()
    for (const a of applications) loaded.set(a.stage, (loaded.get(a.stage) ?? 0) + 1)

    const hidden: Partial<Record<ApplicationStage, number>> = {}
    for (const stage of APPLICATION_STAGES) {
      const total = stageTotals?.[stage]
      if (typeof total === 'number') {
        hidden[stage] = Math.max(0, total - (loaded.get(stage) ?? 0))
      }
    }
    return hidden
  }, [applications, stageTotals])

  const applyStage = async (id: string, targetStage: ApplicationStage) => {
    const card = cards.find((c) => c.id === id)
    if (!card || card.stage === targetStage) return

    const previousStage = card.stage
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, stage: targetStage } : c)))

    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStage }),
      })
      if (!res.ok) throw new Error('patch failed')
    } catch {
      // Rollback the optimistic move.
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, stage: previousStage } : c)))
      toast.error(t('moveFailed'))
    }
  }

  const handleDrop = (column: (typeof KANBAN_COLUMNS)[number]) => {
    const id = dragId.current
    dragId.current = null
    if (!id) return

    if (column.key === 'RESULT') {
      const card = cards.find((c) => c.id === id)
      if (!card) return
      setPendingResult({ id, name: candidateName(card, t('candidateFallback')) })
      return
    }

    // Single-stage columns map 1:1 onto their stage.
    applyStage(id, column.stages[0] as ApplicationStage)
  }

  const confirmResult = (stage: 'HIRED' | 'REJECTED') => {
    if (pendingResult) applyStage(pendingResult.id, stage)
    setPendingResult(null)
  }

  return (
    <>
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3" style={{ minWidth: `${KANBAN_COLUMNS.length * 272}px` }}>
          {KANBAN_COLUMNS.map((column) => {
            const stageCards = columnCards(column.stages)
            const isMultiStage = column.stages.length > 1
            const hidden = column.stages.reduce(
              (sum, stage) => sum + (hiddenByStage[stage as ApplicationStage] ?? 0),
              0,
            )
            return (
              <div
                key={column.key}
                className="flex min-w-[260px] flex-1 flex-col rounded-xl border bg-muted/40"
                role="group"
                aria-label={tColumns(column.key)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(column)}
              >
                <div className="flex items-center justify-between rounded-t-xl border-b bg-background px-3 py-2">
                  <span className="text-sm font-semibold">{tColumns(column.key)}</span>
                  {hidden > 0 ? (
                    <span
                      className="text-xs text-muted-foreground"
                      title={t('truncatedTitle', {
                        shown: stageCards.length,
                        total: stageCards.length + hidden,
                      })}
                    >
                      {t('truncatedCount', {
                        shown: stageCards.length,
                        total: stageCards.length + hidden,
                      })}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{stageCards.length}</span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-2">
                  {stageCards.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center py-10 text-center text-sm text-muted-foreground">
                      {t('emptyStage')}
                    </div>
                  ) : (
                    stageCards.map((card) => {
                      const name = candidateName(card, t('candidateFallback'))
                      return (
                        <div
                          key={card.id}
                          draggable
                          onDragStart={() => {
                            dragId.current = card.id
                          }}
                          className="cursor-grab rounded-lg border bg-background p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
                        >
                          <div className="flex items-start gap-2">
                            <CardAvatar name={name} avatar={card.avatar} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <Link
                                  href={`/${locale}/employer/applicants/${card.id}`}
                                  className="block truncate text-sm font-medium hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {name}
                                </Link>
                                {typeof card.score === 'number' && (
                                  <ScoreBadge score={card.score} />
                                )}
                              </div>
                              {!currentJobId && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {card.job.title}
                                </p>
                              )}
                              <div className="mt-1 flex items-center justify-between gap-2">
                                <p className="text-xs text-muted-foreground">
                                  {relativeTime(card.createdAt, locale)}
                                </p>
                                {isMultiStage && (
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                      STAGE_COLORS[card.stage as ApplicationStage] ?? ''
                                    }`}
                                  >
                                    {(APPLICATION_STAGES as readonly string[]).includes(card.stage)
                                      ? tStages(card.stage)
                                      : card.stage}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Keyboard-equivalent of the drag gesture: drag-and-drop
                              alone leaves the board unusable without a mouse, so the
                              same `applyStage` handler is reachable from a listbox.
                              Unlike a drop on the grouped RESULT column this needs no
                              disambiguation — HIRED and REJECTED are separate options. */}
                          {/* draggable={false} keeps a click-drag on the trigger from
                              turning into a card drag. */}
                          <div className="mt-2" draggable={false}>
                            <Select
                              value={card.stage}
                              onValueChange={(next) =>
                                applyStage(card.id, next as ApplicationStage)
                              }
                            >
                              <SelectTrigger
                                className="h-8 w-full text-xs"
                                aria-label={t('changeStageAriaLabel', { name })}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {APPLICATION_STAGES.map((stage) => (
                                  <SelectItem key={stage} value={stage} className="text-xs">
                                    {tStages(stage)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {pendingResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setPendingResult(null)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-xl border bg-background p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">{t('resultTitle')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('resultDescription', { name: pendingResult.name })}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => confirmResult('HIRED')}
                className="flex-1 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                {t('hire')}
              </button>
              <button
                type="button"
                onClick={() => confirmResult('REJECTED')}
                className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                {t('reject')}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPendingResult(null)}
              className="mt-3 w-full rounded-md border px-3 py-2 text-sm hover:bg-muted"
            >
              {tCommon('cancel')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
