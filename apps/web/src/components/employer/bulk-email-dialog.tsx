'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'

interface BulkEmailDialogProps {
  selectedIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function BulkEmailDialog({
  selectedIds,
  open,
  onOpenChange,
  onSuccess,
}: BulkEmailDialogProps) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  // Templates exist so the considered message is the cheap one. Loaded lazily
  // when the dialog opens; an org with none simply gets no picker.
  const [templates, setTemplates] = useState<
    { id: string; name: string; subject: string; body: string }[]
  >([])

  useEffect(() => {
    if (!open) return
    fetch('/api/email-templates')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setTemplates(data?.templates ?? []))
      .catch(() => {
        // Not worth surfacing: the dialog works without templates.
      })
  }, [open])
  const [loading, setLoading] = useState(false)
  const [partialErrors, setPartialErrors] = useState<
    { applicationId: string; candidateName?: string; error: string }[]
  >([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !body.trim()) {
      toast.error('Predmet a telo správy sú povinné')
      return
    }

    setLoading(true)
    setPartialErrors([])

    try {
      const res = await fetch('/api/applications/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-email',
          applicationIds: selectedIds,
          subject: subject.trim(),
          body: body.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Nepodarilo sa odoslať emaily')
        return
      }

      if (data.failed > 0) {
        toast.warning(`Odoslaných ${data.processed}, zlyhaných ${data.failed}`)
        setPartialErrors(data.errors || [])
      } else {
        toast.success(`Odoslaných ${data.processed} emailov`)
        setSubject('')
        setBody('')
        onSuccess()
        onOpenChange(false)
      }
    } catch {
      toast.error('Nepodarilo sa odoslať emaily')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Hromadný email ({selectedIds.length} kandidátov)</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {templates.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="bulk-template">Šablóna</Label>
              <select
                id="bulk-template"
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                defaultValue=""
                disabled={loading}
                onChange={(e) => {
                  const picked = templates.find((t) => t.id === e.target.value)
                  if (!picked) return
                  // Fills the fields rather than locking them: a template is a
                  // starting point, and the last thing anyone wants is an email
                  // they cannot adjust before it goes to fifty people.
                  setSubject(picked.subject)
                  setBody(picked.body)
                }}
              >
                <option value="">Bez šablóny</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="bulk-subject">Predmet</Label>
            <Input
              id="bulk-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Predmet emailu"
              maxLength={200}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bulk-body">Telo správy</Label>
            <Textarea
              id="bulk-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Text emailu..."
              rows={8}
              maxLength={10000}
              disabled={loading}
            />
          </div>
          {partialErrors.length > 0 && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <p className="mb-2 font-medium">Niektoré emaily zlyhali:</p>
              <ul className="list-inside list-disc space-y-1">
                {partialErrors.map((e) => (
                  <li key={e.applicationId}>
                    {e.candidateName ? `${e.candidateName}: ` : ''}
                    {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Zrušiť
            </Button>
            <Button type="submit" disabled={loading || !subject.trim() || !body.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Odoslať
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
