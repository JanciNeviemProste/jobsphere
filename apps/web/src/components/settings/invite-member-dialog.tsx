'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

interface InviteMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (member: any) => void
}

export function InviteMemberDialog({ open, onOpenChange, onSuccess }: InviteMemberDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    role: 'RECRUITER',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/organizations/current/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to invite member')
      }

      const data = await response.json()

      if (data.emailSent === false) {
        toast.warning(
          data.message ||
            'Člen pridaný, ale pozvánkový e-mail sa nepodarilo odoslať — skontrolujte nastavenie e-mailu.',
        )
      } else {
        toast.success(`Invitation sent to ${formData.email}`)
      }

      // Reset form
      setFormData({ email: '', role: 'RECRUITER' })

      // Call success callback
      onSuccess(data.member)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to invite member')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join your organization. They will receive an email with
            instructions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              placeholder="colleague@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => setFormData({ ...formData, role: value })}
            >
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ORG_ADMIN">
                  <div className="space-y-0.5">
                    <div className="font-medium">Admin</div>
                    <div className="text-xs text-muted-foreground">
                      Full access to all settings and data
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="RECRUITER">
                  <div className="space-y-0.5">
                    <div className="font-medium">Recruiter</div>
                    <div className="text-xs text-muted-foreground">
                      Manage jobs, candidates, and applications
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="SUB_HR">
                  <div className="space-y-0.5">
                    <div className="font-medium">Sub-HR</div>
                    <div className="text-xs text-muted-foreground">
                      Pomocný HR: kandidáti, prihlášky a pipeline — bez fakturácie, členov a
                      nastavení
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="HIRING_MANAGER">
                  <div className="space-y-0.5">
                    <div className="font-medium">Hiring Manager</div>
                    <div className="text-xs text-muted-foreground">
                      View and review applications for assigned jobs
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="AGENCY">
                  <div className="space-y-0.5">
                    <div className="font-medium">Agency</div>
                    <div className="text-xs text-muted-foreground">
                      Limited access to specific jobs and candidates
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
