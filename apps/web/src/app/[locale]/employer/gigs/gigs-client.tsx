'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, Briefcase, Plus, Euro, Clock, Users } from 'lucide-react'

interface Gig {
  id: string
  title: string
  description: string
  budget: number | null
  currency: string
  durationDays: number | null
  status: string
  createdAt: string
  _count: { proposals: number }
}

interface Proposal {
  id: string
  proposedRate: number | null
  proposedDurationDays: number | null
  message: string | null
  status: string
  createdAt: string
  freelancer: {
    id: string
    title: string | null
    location: string | null
    user: { name: string | null; email: string }
  }
}

const gigStatusLabel: Record<string, string> = {
  OPEN: 'Otvorená',
  IN_PROGRESS: 'Prebieha',
  CLOSED: 'Uzavretá',
}

const proposalStatusLabel: Record<string, string> = {
  PENDING: 'Čaká',
  ACCEPTED: 'Prijatá',
  REJECTED: 'Odmietnutá',
  WITHDRAWN: 'Stiahnutá',
}

export default function GigsClient({ params }: { params: { locale: string } }) {
  const { locale } = params
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)
  const [gigs, setGigs] = useState<Gig[]>([])
  const [message, setMessage] = useState('')

  // create form
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', budget: '', durationDays: '' })

  // proposals per gig (lazy-loaded)
  const [openGigId, setOpenGigId] = useState<string | null>(null)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [proposalsLoading, setProposalsLoading] = useState(false)
  const [deciding, setDeciding] = useState<string | null>(null)

  const loadGigs = useCallback(async () => {
    try {
      const res = await fetch('/api/gigs')
      if (res.status === 401) {
        setUnauthorized(true)
        return
      }
      const { gigs } = await res.json()
      setGigs(gigs ?? [])
    } catch {
      setMessage('Nepodarilo sa načítať zákazky.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadGigs()
  }, [loadGigs])

  const createGig = async () => {
    setCreating(true)
    setMessage('')
    try {
      const res = await fetch('/api/gigs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          budget: form.budget ? parseInt(form.budget, 10) : null,
          durationDays: form.durationDays ? parseInt(form.durationDays, 10) : null,
        }),
      })
      if (!res.ok) throw new Error('create failed')
      setForm({ title: '', description: '', budget: '', durationDays: '' })
      setMessage('✓ Zákazka zverejnená.')
      await loadGigs()
    } catch {
      setMessage('Zverejnenie zlyhalo. Skús znova.')
    } finally {
      setCreating(false)
    }
  }

  const toggleProposals = async (gigId: string) => {
    if (openGigId === gigId) {
      setOpenGigId(null)
      return
    }
    setOpenGigId(gigId)
    setProposalsLoading(true)
    setProposals([])
    try {
      const res = await fetch(`/api/gigs/${gigId}/proposals`)
      const { proposals } = await res.json()
      setProposals(proposals ?? [])
    } catch {
      setProposals([])
    } finally {
      setProposalsLoading(false)
    }
  }

  const decide = async (gigId: string, proposalId: string, action: 'ACCEPT' | 'REJECT') => {
    setDeciding(proposalId)
    try {
      const res = await fetch(`/api/gigs/${gigId}/proposals/${proposalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error('decision failed')
      await Promise.all([toggleProposalsRefresh(gigId), loadGigs()])
    } catch {
      setMessage('Akcia zlyhala. Skús znova.')
    } finally {
      setDeciding(null)
    }
  }

  // re-fetch proposals for a gig that stays open after a decision
  const toggleProposalsRefresh = async (gigId: string) => {
    try {
      const res = await fetch(`/api/gigs/${gigId}/proposals`)
      const { proposals } = await res.json()
      setProposals(proposals ?? [])
    } catch {
      /* ignore */
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (unauthorized) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg">Pre správu zákaziek sa prihlás ako firma.</p>
        <Button asChild>
          <Link href={`/${locale}/login`}>Prihlásiť sa</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 py-10">
      <div className="container mx-auto max-w-3xl px-4">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Briefcase className="h-7 w-7 text-primary" /> Zákazky pre freelancerov
          </h1>
          <p className="text-muted-foreground">
            Zadaj prácu, freelanceri pošlú ponuky a vy sa dohodnete na cene a trvaní.
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Plus className="h-5 w-5" /> Nová zákazka
            </CardTitle>
            <CardDescription>Bez online platby — platbu si dohodnete priamo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Názov</Label>
              <Input
                id="title"
                placeholder="napr. Logo + vizuálna identita pre kaviareň"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Popis</Label>
              <textarea
                id="description"
                className="min-h-[110px] w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Čo potrebuješ spraviť, očakávania, termíny…"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="budget">Rozpočet (€, voliteľné)</Label>
                <Input
                  id="budget"
                  type="number"
                  min={0}
                  placeholder="napr. 800"
                  value={form.budget}
                  onChange={(e) => setForm({ ...form, budget: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="durationDays">Trvanie (dni, voliteľné)</Label>
                <Input
                  id="durationDays"
                  type="number"
                  min={1}
                  placeholder="napr. 14"
                  value={form.durationDays}
                  onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={createGig}
                disabled={creating || !form.title.trim() || !form.description.trim()}
              >
                {creating ? 'Zverejňujem…' : 'Zverejniť zákazku'}
              </Button>
              {message && <span className="text-sm text-muted-foreground">{message}</span>}
            </div>
          </CardContent>
        </Card>

        <h2 className="mb-4 text-xl font-semibold">Moje zákazky ({gigs.length})</h2>
        {gigs.length === 0 ? (
          <div className="rounded-lg border bg-background p-10 text-center text-muted-foreground">
            Zatiaľ žiadne zákazky. Zadaj prvú vyššie.
          </div>
        ) : (
          <div className="space-y-4">
            {gigs.map((gig) => (
              <Card key={gig.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{gig.title}</CardTitle>
                    <Badge variant={gig.status === 'OPEN' ? 'default' : 'secondary'}>
                      {gigStatusLabel[gig.status] ?? gig.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {gig.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    {gig.budget != null && (
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <Euro className="h-4 w-4" />
                        {gig.budget} {gig.currency}
                      </span>
                    )}
                    {gig.durationDays != null && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {gig.durationDays} dní
                      </span>
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => toggleProposals(gig.id)}>
                    <Users className="mr-2 h-4 w-4" />
                    {openGigId === gig.id ? 'Skryť ponuky' : `Ponuky (${gig._count.proposals})`}
                  </Button>

                  {openGigId === gig.id && (
                    <div className="mt-2 space-y-3 border-t pt-3">
                      {proposalsLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Načítavam ponuky…
                        </div>
                      ) : proposals.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Zatiaľ žiadne ponuky.</p>
                      ) : (
                        proposals.map((p) => (
                          <div key={p.id} className="rounded-md border bg-muted/30 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium">
                                  {p.freelancer.user.name || p.freelancer.user.email}
                                </p>
                                {p.freelancer.title && (
                                  <p className="text-xs text-muted-foreground">
                                    {p.freelancer.title}
                                    {p.freelancer.location ? ` · ${p.freelancer.location}` : ''}
                                  </p>
                                )}
                              </div>
                              <Badge
                                variant={
                                  p.status === 'ACCEPTED'
                                    ? 'default'
                                    : p.status === 'REJECTED'
                                      ? 'destructive'
                                      : 'secondary'
                                }
                              >
                                {proposalStatusLabel[p.status] ?? p.status}
                              </Badge>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                              {p.proposedRate != null && (
                                <span className="flex items-center gap-1">
                                  <Euro className="h-3.5 w-3.5" />
                                  {p.proposedRate} {gig.currency}
                                </span>
                              )}
                              {p.proposedDurationDays != null && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {p.proposedDurationDays} dní
                                </span>
                              )}
                            </div>
                            {p.message && (
                              <p className="mt-2 whitespace-pre-wrap text-sm">{p.message}</p>
                            )}
                            {p.status === 'PENDING' && gig.status === 'OPEN' && (
                              <div className="mt-3 flex gap-2">
                                <Button
                                  size="sm"
                                  disabled={deciding === p.id}
                                  onClick={() => decide(gig.id, p.id, 'ACCEPT')}
                                >
                                  {deciding === p.id ? '…' : 'Prijať'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={deciding === p.id}
                                  onClick={() => decide(gig.id, p.id, 'REJECT')}
                                >
                                  Odmietnuť
                                </Button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
