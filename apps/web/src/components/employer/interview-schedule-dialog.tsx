'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
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
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { logger } from '@/lib/logger'

type InterviewType = 'VIDEO' | 'ONSITE' | 'PHONE'

interface Branch {
  id: string
  name: string
  street: string | null
  city: string | null
  region: string | null
  country: string | null
  postalCode: string | null
  isPrimary: boolean
}

interface InterviewScheduleDialogProps {
  applicationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultType?: InterviewType
  onScheduled?: () => void
}

export function InterviewScheduleDialog({
  applicationId,
  open,
  onOpenChange,
  defaultType = 'VIDEO',
  onScheduled,
}: InterviewScheduleDialogProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [type, setType] = useState<InterviewType>(defaultType)
  const [scheduledAt, setScheduledAt] = useState('')
  const [durationMin, setDurationMin] = useState('60')
  const [meetingUrl, setMeetingUrl] = useState('')
  const [location, setLocation] = useState('')
  const [branchId, setBranchId] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [branches, setBranches] = useState<Branch[]>([])

  // Reset the type to the trigger's default each time the dialog opens.
  useEffect(() => {
    if (open) setType(defaultType)
  }, [open, defaultType])

  const loadBranches = useCallback(async () => {
    try {
      const res = await fetch('/api/organizations/current/branches')
      if (!res.ok) return
      const data = await res.json()
      setBranches(data.branches || [])
    } catch (error) {
      logger.error('Error loading branches', error)
    }
  }, [])

  // Branches are only needed for on-site interviews.
  useEffect(() => {
    if (open && type === 'ONSITE' && branches.length === 0) {
      loadBranches()
    }
  }, [open, type, branches.length, loadBranches])

  const resetForm = () => {
    setScheduledAt('')
    setDurationMin('60')
    setMeetingUrl('')
    setLocation('')
    setBranchId('')
    setNotes('')
  }

  const handleSubmit = async () => {
    if (!scheduledAt) {
      toast.error('Zadajte dátum a čas pohovoru')
      return
    }

    const scheduledIso = new Date(scheduledAt)
    if (Number.isNaN(scheduledIso.getTime())) {
      toast.error('Neplatný dátum a čas')
      return
    }

    setIsLoading(true)
    try {
      const payload: Record<string, unknown> = {
        type,
        scheduledAt: scheduledIso.toISOString(),
      }
      const duration = parseInt(durationMin, 10)
      if (!Number.isNaN(duration) && duration > 0) payload.durationMin = duration
      if (type === 'VIDEO' && meetingUrl.trim()) payload.meetingUrl = meetingUrl.trim()
      if (type === 'ONSITE' && branchId) payload.branchId = branchId
      if (location.trim()) payload.location = location.trim()
      if (notes.trim()) payload.notes = notes.trim()

      const res = await fetch(`/api/applications/${applicationId}/interviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error('Failed to schedule interview')
      }

      toast.success('Pohovor bol naplánovaný')
      resetForm()
      onOpenChange(false)
      onScheduled?.()
      router.refresh()
    } catch (error) {
      logger.error('Error scheduling interview', error)
      toast.error('Nepodarilo sa naplánovať pohovor')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Naplánovať pohovor</DialogTitle>
          <DialogDescription>Naplánujte pohovor s kandidátom</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="interview-type">Typ pohovoru</Label>
            <Select value={type} onValueChange={(v) => setType(v as InterviewType)}>
              <SelectTrigger id="interview-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VIDEO">Videopohovor</SelectItem>
                <SelectItem value="ONSITE">Osobne (fyzicky)</SelectItem>
                <SelectItem value="PHONE">Telefonicky</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="interview-datetime">Dátum a čas</Label>
              <Input
                id="interview-datetime"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interview-duration">Trvanie (min)</Label>
              <Input
                id="interview-duration"
                type="number"
                min={1}
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
              />
            </div>
          </div>

          {type === 'VIDEO' && (
            <div className="space-y-2">
              <Label htmlFor="interview-url">Odkaz na video hovor</Label>
              <Input
                id="interview-url"
                type="url"
                placeholder="https://meet.google.com/..."
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
              />
            </div>
          )}

          {type === 'ONSITE' && (
            <div className="space-y-2">
              <Label htmlFor="interview-branch">Pobočka</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger id="interview-branch">
                  <SelectValue placeholder="Vyberte pobočku" />
                </SelectTrigger>
                <SelectContent>
                  {branches.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Žiadne pobočky — pridajte ich v nastaveniach
                    </SelectItem>
                  ) : (
                    branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                        {b.city ? ` — ${b.city}` : ''}
                        {b.isPrimary ? ' (hlavná)' : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Alebo zadajte adresu ručne nižšie.</p>
              <Input
                aria-label="Adresa"
                placeholder="Adresa (voliteľné)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="interview-notes">Poznámka</Label>
            <Textarea
              id="interview-notes"
              placeholder="Poznámka k pohovoru (voliteľné)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Zrušiť
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Naplánovať
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
