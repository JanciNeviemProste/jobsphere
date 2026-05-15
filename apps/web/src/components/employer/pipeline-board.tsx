'use client'

import { useState, useRef } from 'react'
import {
  APPLICATION_STAGES,
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
}

interface PipelineBoardProps {
  applications: ApplicationCard[]
  jobs: { id: string; title: string }[]
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

export function PipelineBoard({ applications, currentJobId }: PipelineBoardProps) {
  const [cards, setCards] = useState<ApplicationCard[]>(applications)
  const dragId = useRef<string | null>(null)

  const byStage = (stage: ApplicationStage) => cards.filter((c) => c.stage === stage)

  const handleDragStart = (id: string) => {
    dragId.current = id
  }

  const handleDrop = async (targetStage: ApplicationStage) => {
    const id = dragId.current
    if (!id) return
    const card = cards.find((c) => c.id === id)
    if (!card || card.stage === targetStage) {
      dragId.current = null
      return
    }

    const previousStage = card.stage
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, stage: targetStage } : c)))
    dragId.current = null

    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStage }),
      })

      if (!res.ok) {
        throw new Error('patch failed')
      }
    } catch {
      setCards((prev) => prev.map((c) => (c.id === id ? { ...c, stage: previousStage } : c)))
      toast.error('Nepodarilo sa presunúť kandidáta')
    }
  }

  const jobTitle = (app: ApplicationCard) =>
    currentJobId ? null : <p className="truncate text-xs text-muted-foreground">{app.job.title}</p>

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3" style={{ minWidth: `${APPLICATION_STAGES.length * 272}px` }}>
        {APPLICATION_STAGES.map((stage) => {
          const stageCards = byStage(stage)
          const colorClass = STAGE_COLORS[stage]
          return (
            <div
              key={stage}
              className="flex min-w-[260px] flex-col rounded-xl border bg-muted/40"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(stage)}
            >
              <div className="flex items-center justify-between rounded-t-xl border-b bg-background px-3 py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colorClass}`}>
                  {STAGE_LABELS_SK[stage]}
                </span>
                <span className="text-xs text-muted-foreground">{stageCards.length}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {stageCards.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center py-10 text-center text-sm text-muted-foreground">
                    Žiadni kandidáti
                  </div>
                ) : (
                  stageCards.map((card) => (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={() => handleDragStart(card.id)}
                      className="cursor-grab rounded-lg border bg-background p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
                    >
                      <p className="truncate text-sm font-medium">{candidateName(card)}</p>
                      {jobTitle(card)}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {relativeTime(card.createdAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
