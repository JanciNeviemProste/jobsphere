'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  KANBAN_COLUMNS,
  STAGE_LABELS_SK,
  STAGE_COLORS,
  type ApplicationStage,
} from '@/lib/constants/application-stages'
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
}

function relativeTime(date: Date | string): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diffMs = now - then
  const diffDays = Math.floor(diffMs / 86400000)
  const rtf = new Intl.RelativeTimeFormat('sk', { numeric: 'auto' })
  if (diffDays === 0) return rtf.format(0, 'day')
  if (diffDays < 30) return rtf.format(-diffDays, 'day')
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return rtf.format(-diffMonths, 'month')
  return rtf.format(-Math.floor(diffMonths / 12), 'year')
}

function candidateName(app: ApplicationCard): string {
  const contact = app.candidate.contacts[0]
  return contact?.fullName || contact?.email || 'Kandidát'
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

export function PipelineBoard({ applications, currentJobId }: PipelineBoardProps) {
  const pathname = usePathname()
  const locale = pathname.split('/')[1] || 'en'
  const [cards, setCards] = useState<ApplicationCard[]>(applications)
  const dragId = useRef<string | null>(null)
  // The RESULT column groups HIRED + REJECTED, so a drop there needs an explicit choice.
  const [pendingResult, setPendingResult] = useState<{ id: string; name: string } | null>(null)

  const columnCards = (stages: readonly string[]) => cards.filter((c) => stages.includes(c.stage))

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
      toast.error('Nepodarilo sa presunúť kandidáta')
    }
  }

  const handleDrop = (column: (typeof KANBAN_COLUMNS)[number]) => {
    const id = dragId.current
    dragId.current = null
    if (!id) return

    if (column.key === 'RESULT') {
      const card = cards.find((c) => c.id === id)
      if (!card) return
      setPendingResult({ id, name: candidateName(card) })
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
            return (
              <div
                key={column.key}
                className="flex min-w-[260px] flex-1 flex-col rounded-xl border bg-muted/40"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(column)}
              >
                <div className="flex items-center justify-between rounded-t-xl border-b bg-background px-3 py-2">
                  <span className="text-sm font-semibold">{column.label}</span>
                  <span className="text-xs text-muted-foreground">{stageCards.length}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-2">
                  {stageCards.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center py-10 text-center text-sm text-muted-foreground">
                      Žiadni kandidáti
                    </div>
                  ) : (
                    stageCards.map((card) => {
                      const name = candidateName(card)
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
                                  {relativeTime(card.createdAt)}
                                </p>
                                {isMultiStage && (
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                      STAGE_COLORS[card.stage as ApplicationStage] ?? ''
                                    }`}
                                  >
                                    {STAGE_LABELS_SK[card.stage as ApplicationStage] ?? card.stage}
                                  </span>
                                )}
                              </div>
                            </div>
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
            <h3 className="text-lg font-semibold">Rozhodnutie o kandidátovi</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Vyberte výsledok pre kandidáta {pendingResult.name}.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => confirmResult('HIRED')}
                className="flex-1 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Prijať
              </button>
              <button
                type="button"
                onClick={() => confirmResult('REJECTED')}
                className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Odmietnuť
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPendingResult(null)}
              className="mt-3 w-full rounded-md border px-3 py-2 text-sm hover:bg-muted"
            >
              Zrušiť
            </button>
          </div>
        </div>
      )}
    </>
  )
}
