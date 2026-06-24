'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Briefcase, ExternalLink } from 'lucide-react'

type Availability = 'AVAILABLE' | 'LIMITED' | 'UNAVAILABLE'

interface ProfileForm {
  title: string
  bio: string
  services: string // one per line
  skills: string // one per line
  hourlyRate: string
  availability: Availability
  location: string
  portfolioUrl: string
  visible: boolean
}

const EMPTY: ProfileForm = {
  title: '',
  bio: '',
  services: '',
  skills: '',
  hourlyRate: '',
  availability: 'AVAILABLE',
  location: '',
  portfolioUrl: '',
  visible: true,
}

const linesToArray = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)

export default function FreelancerProfilePage({ params }: { params: { locale: string } }) {
  const { locale } = params
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [unauthorized, setUnauthorized] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState<ProfileForm>(EMPTY)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/freelancer/profile')
        if (res.status === 401) {
          setUnauthorized(true)
          return
        }
        const { profile } = await res.json()
        if (profile) {
          setForm({
            title: profile.title ?? '',
            bio: profile.bio ?? '',
            services: (profile.services ?? []).join('\n'),
            skills: (profile.skills ?? []).join('\n'),
            hourlyRate: profile.hourlyRate != null ? String(profile.hourlyRate) : '',
            availability: (profile.availability as Availability) ?? 'AVAILABLE',
            location: profile.location ?? '',
            portfolioUrl: profile.portfolioUrl ?? '',
            visible: profile.visible ?? true,
          })
        }
      } catch {
        setMessage('Nepodarilo sa načítať profil.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const save = async () => {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/freelancer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim() || undefined,
          bio: form.bio.trim() || undefined,
          services: linesToArray(form.services),
          skills: linesToArray(form.skills),
          hourlyRate: form.hourlyRate ? parseInt(form.hourlyRate, 10) : null,
          availability: form.availability,
          location: form.location.trim() || undefined,
          portfolioUrl: form.portfolioUrl.trim(),
          visible: form.visible,
        }),
      })
      if (!res.ok) throw new Error('save failed')
      setMessage('✓ Profil uložený.')
    } catch {
      setMessage('Uloženie zlyhalo. Skús znova.')
    } finally {
      setSaving(false)
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
        <p className="text-lg">Pre úpravu freelancer profilu sa prihlás.</p>
        <Button asChild>
          <Link href={`/${locale}/login`}>Prihlásiť sa</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 py-10">
      <div className="container mx-auto max-w-3xl px-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <Briefcase className="h-7 w-7 text-primary" /> Môj freelancer profil
            </h1>
            <p className="text-muted-foreground">Ponúkni svoje služby firmám</p>
          </div>
          <Button variant="outline" asChild>
            <Link href={`/${locale}/freelancers`}>
              Verejný zoznam <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profil</CardTitle>
            <CardDescription>Tieto údaje uvidia firmy vo verejnom zozname.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Profesia / titulok</Label>
              <Input
                id="title"
                placeholder="napr. Grafik & DTP operátor"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">O mne</Label>
              <textarea
                id="bio"
                className="min-h-[100px] w-full rounded-md border px-3 py-2 text-sm"
                placeholder="Krátko o tebe a tvojej práci…"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="services">Služby (jedna na riadok)</Label>
              <textarea
                id="services"
                className="min-h-[90px] w-full rounded-md border px-3 py-2 text-sm"
                placeholder={'tvorba loga\nwebdizajn\nletáky a vizitky'}
                value={form.services}
                onChange={(e) => setForm({ ...form, services: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="skills">Zručnosti (jedna na riadok)</Label>
              <textarea
                id="skills"
                className="min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
                placeholder={'Adobe Photoshop\nIllustrator\nFigma'}
                value={form.skills}
                onChange={(e) => setForm({ ...form, skills: e.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="rate">Hodinová sadzba (€)</Label>
                <Input
                  id="rate"
                  type="number"
                  min={0}
                  placeholder="napr. 25"
                  value={form.hourlyRate}
                  onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="availability">Dostupnosť</Label>
                <select
                  id="availability"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.availability}
                  onChange={(e) =>
                    setForm({ ...form, availability: e.target.value as Availability })
                  }
                >
                  <option value="AVAILABLE">Dostupný</option>
                  <option value="LIMITED">Obmedzene</option>
                  <option value="UNAVAILABLE">Nedostupný</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Lokalita</Label>
                <Input
                  id="location"
                  placeholder="napr. Žilina"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="portfolio">Portfólio (URL)</Label>
              <Input
                id="portfolio"
                placeholder="https://…"
                value={form.portfolioUrl}
                onChange={(e) => setForm({ ...form, portfolioUrl: e.target.value })}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.visible}
                onChange={(e) => setForm({ ...form, visible: e.target.checked })}
              />
              Zobrazovať môj profil vo verejnom zozname
            </label>

            <div className="flex items-center gap-3">
              <Button onClick={save} disabled={saving}>
                {saving ? 'Ukladám…' : 'Uložiť profil'}
              </Button>
              {message && <span className="text-sm text-muted-foreground">{message}</span>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
