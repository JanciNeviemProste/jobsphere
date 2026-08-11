'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

/**
 * Superadmin: create a new organization, or — when an admin e-mail is supplied —
 * provision the org AND invite its first ORG_ADMIN by e-mail (L59). The presence
 * of `adminEmail` switches the request to the invite endpoint.
 */
export function CreateOrgButton() {
  const router = useRouter()
  const t = useTranslations('admin')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    slug: '',
    industry: '',
    size: '',
    website: '',
    adminEmail: '',
  })

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const invite = form.adminEmail.trim().length > 0
      const url = invite ? '/api/admin/organizations/invite' : '/api/admin/organizations'
      const body = invite
        ? {
            orgName: form.name,
            adminEmail: form.adminEmail.trim(),
            industry: form.industry || undefined,
          }
        : {
            name: form.name,
            slug: form.slug || undefined,
            industry: form.industry || undefined,
            size: form.size || undefined,
            website: form.website || undefined,
          }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? t('organizations.create.error'))
        return
      }
      const data = await res.json().catch(() => ({}))
      if (invite && data.emailSent === false) {
        setError(t('organizations.create.inviteFailed'))
      }
      setForm({ name: '', slug: '', industry: '', size: '', website: '', adminEmail: '' })
      setOpen(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">{t('organizations.create.title')}</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('organizations.create.title')}</DialogTitle>
            <DialogDescription>{t('organizations.create.description')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="org-name">{t('organizations.create.nameLabel')}</Label>
              <Input
                id="org-name"
                required
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org-slug">{t('organizations.create.slugLabel')}</Label>
              <Input
                id="org-slug"
                value={form.slug}
                placeholder={t('organizations.create.slugPlaceholder')}
                onChange={(e) => update('slug', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org-industry">{t('organizations.create.industryLabel')}</Label>
              <Input
                id="org-industry"
                value={form.industry}
                onChange={(e) => update('industry', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org-size">{t('organizations.create.sizeLabel')}</Label>
              <Input
                id="org-size"
                value={form.size}
                onChange={(e) => update('size', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org-website">{t('organizations.create.websiteLabel')}</Label>
              <Input
                id="org-website"
                type="url"
                value={form.website}
                onChange={(e) => update('website', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org-admin-email">{t('organizations.create.adminEmailLabel')}</Label>
              <Input
                id="org-admin-email"
                type="email"
                value={form.adminEmail}
                onChange={(e) => update('adminEmail', e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading || !form.name.trim()}>
              {loading ? t('common.saving') : t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
