'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Check, X, Loader2 } from 'lucide-react'

interface Props {
  applicationId: string
  score0to100: number
  overrideScore?: number | null
}

function badgeColor(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-800'
  if (score >= 60) return 'bg-amber-100 text-amber-800'
  return 'bg-red-100 text-red-800'
}

/**
 * HR manual override of the displayed match score (L44). The shown value is
 * `overrideScore ?? score0to100`; the AI archive stays in `score0to100`.
 * Editing PATCHes /api/applications/{id}/match-score; clearing sends null.
 */
export function MatchScoreOverride({ applicationId, score0to100, overrideScore }: Props) {
  const [override, setOverride] = useState<number | null>(overrideScore ?? null)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState<string>(String(overrideScore ?? score0to100))
  const [saving, setSaving] = useState(false)

  const display = override ?? score0to100

  const save = async (next: number | null) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/applications/${applicationId}/match-score`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrideScore: next }),
      })
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      const nextOverride: number | null = data.overrideScore ?? null
      setOverride(nextOverride)
      setValue(String(nextOverride ?? score0to100))
      setEditing(false)
      toast.success(next === null ? 'Úprava HR zrušená' : 'Skóre upravené')
    } catch {
      toast.error('Nepodarilo sa uložiť skóre')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = () => {
    const n = parseInt(value, 10)
    if (Number.isNaN(n) || n < 0 || n > 100) {
      toast.error('Zadajte číslo 0 – 100')
      return
    }
    save(n)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-16 rounded-md border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={saving}
          aria-label="Skóre zhody (0 – 100)"
        />
        <span className="text-sm text-muted-foreground">%</span>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md p-1 text-green-700 hover:bg-green-50"
          aria-label="Uložiť"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false)
            setValue(String(display))
          }}
          disabled={saving}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          aria-label="Zrušiť úpravu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${badgeColor(display)}`}
        >
          {display}% zhoda
        </span>
        <button
          type="button"
          onClick={() => {
            setValue(String(display))
            setEditing(true)
          }}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Upraviť skóre (HR)"
          aria-label="Upraviť skóre"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
      {override !== null && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="rounded bg-muted px-1.5 py-0.5 font-medium">upravené HR</span>
          <button
            type="button"
            onClick={() => save(null)}
            disabled={saving}
            className="underline hover:text-foreground"
          >
            zrušiť
          </button>
        </div>
      )}
    </div>
  )
}
