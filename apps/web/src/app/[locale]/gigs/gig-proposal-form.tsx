'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Inline "send a proposal" form for a single gig. Posts to the gig proposals API.
 * Auth + freelancer-profile checks happen server-side; we surface the API's message.
 */
export function GigProposalForm({ gigId, currency }: { gigId: string; currency: string }) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ proposedRate: '', proposedDurationDays: '', message: '' })

  const submit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/gigs/${gigId}/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposedRate: form.proposedRate ? parseInt(form.proposedRate, 10) : null,
          proposedDurationDays: form.proposedDurationDays
            ? parseInt(form.proposedDurationDays, 10)
            : null,
          message: form.message.trim() || undefined,
        }),
      })
      if (res.status === 401) {
        setError('Pre poslanie ponuky sa prihlás ako freelancer.')
        return
      }
      if (res.status === 403) {
        setError('Ponuky môžu posielať len freelanceri (zaregistruj sa ako freelancer).')
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Poslanie ponuky zlyhalo.')
        return
      }
      setDone(true)
    } catch {
      setError('Poslanie ponuky zlyhalo. Skús znova.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return <p className="text-sm font-medium text-green-600">✓ Ponuka odoslaná firme.</p>
  }

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        Poslať ponuku
      </Button>
    )
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`rate-${gigId}`}>Tvoja cena ({currency})</Label>
          <Input
            id={`rate-${gigId}`}
            type="number"
            min={0}
            placeholder="napr. 700"
            value={form.proposedRate}
            onChange={(e) => setForm({ ...form, proposedRate: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`dur-${gigId}`}>Trvanie (dni)</Label>
          <Input
            id={`dur-${gigId}`}
            type="number"
            min={1}
            placeholder="napr. 10"
            value={form.proposedDurationDays}
            onChange={(e) => setForm({ ...form, proposedDurationDays: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`msg-${gigId}`}>Správa</Label>
        <textarea
          id={`msg-${gigId}`}
          className="min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Predstav sa a napíš, ako to spravíš…"
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={submitting}>
          {submitting ? 'Odosielam…' : 'Odoslať ponuku'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Zrušiť
        </Button>
      </div>
    </div>
  )
}
