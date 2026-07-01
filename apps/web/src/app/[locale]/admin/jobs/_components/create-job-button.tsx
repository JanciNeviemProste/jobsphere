'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface OrgOption {
  id: string
  name: string
}

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

/**
 * Superadmin: create a job for an explicitly chosen organization. The admin is
 * not bound to any org, so orgId is a required field (POST /api/admin/jobs).
 */
export function CreateJobButton({ orgs }: { orgs: OrgOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    orgId: '',
    title: '',
    description: '',
    location: '',
    workMode: 'ONSITE',
    type: 'FULL_TIME',
    seniority: 'MID',
  })

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: form.orgId,
          title: form.title,
          description: form.description,
          location: form.location || undefined,
          workMode: form.workMode,
          type: form.type,
          seniority: form.seniority,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Chyba pri vytváraní jobu')
        return
      }
      setForm({
        orgId: '',
        title: '',
        description: '',
        location: '',
        workMode: 'ONSITE',
        type: 'FULL_TIME',
        seniority: 'MID',
      })
      setOpen(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Nový job</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nový job</DialogTitle>
            <DialogDescription>
              Vytvorte job pre zvolenú organizáciu. Popis musí mať aspoň 50 znakov.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="job-org">Organizácia *</Label>
              <select
                id="job-org"
                required
                className={SELECT_CLASS}
                value={form.orgId}
                onChange={(e) => update('orgId', e.target.value)}
              >
                <option value="" disabled>
                  Vyberte organizáciu…
                </option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="job-title">Názov *</Label>
              <Input
                id="job-title"
                required
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="job-description">Popis * (min. 50 znakov)</Label>
              <Textarea
                id="job-description"
                required
                rows={5}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="job-location">Lokalita (voliteľné)</Label>
              <Input
                id="job-location"
                value={form.location}
                onChange={(e) => update('location', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="job-workmode">Režim</Label>
                <select
                  id="job-workmode"
                  className={SELECT_CLASS}
                  value={form.workMode}
                  onChange={(e) => update('workMode', e.target.value)}
                >
                  <option value="ONSITE">ONSITE</option>
                  <option value="HYBRID">HYBRID</option>
                  <option value="REMOTE">REMOTE</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="job-type">Typ</Label>
                <select
                  id="job-type"
                  className={SELECT_CLASS}
                  value={form.type}
                  onChange={(e) => update('type', e.target.value)}
                >
                  <option value="FULL_TIME">FULL_TIME</option>
                  <option value="PART_TIME">PART_TIME</option>
                  <option value="CONTRACT">CONTRACT</option>
                  <option value="FREELANCE">FREELANCE</option>
                  <option value="INTERNSHIP">INTERNSHIP</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="job-seniority">Seniorita</Label>
                <select
                  id="job-seniority"
                  className={SELECT_CLASS}
                  value={form.seniority}
                  onChange={(e) => update('seniority', e.target.value)}
                >
                  <option value="JUNIOR">JUNIOR</option>
                  <option value="MID">MID</option>
                  <option value="SENIOR">SENIOR</option>
                  <option value="LEAD">LEAD</option>
                  <option value="EXECUTIVE">EXECUTIVE</option>
                </select>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={
                loading || !form.orgId || !form.title.trim() || form.description.trim().length < 50
              }
            >
              {loading ? 'Ukladám…' : 'Vytvoriť'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
