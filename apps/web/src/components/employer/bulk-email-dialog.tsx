'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { getCsrfToken } from '@/lib/csrf'
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
      const csrfToken = await getCsrfToken()
      const res = await fetch('/api/applications/bulk', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
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
