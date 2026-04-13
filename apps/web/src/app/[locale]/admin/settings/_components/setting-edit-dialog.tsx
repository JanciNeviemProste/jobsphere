'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface SettingEditDialogProps {
  settingKey: string
  currentValue: string
}

export function SettingEditDialog({ settingKey, currentValue }: SettingEditDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(currentValue)
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'setting', key: settingKey, value }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? 'Chyba')
        return
      }
      setOpen(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Upraviť
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upraviť nastavenie</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs text-slate-500">Kľúč</Label>
            <p className="mt-0.5 font-mono text-sm">{settingKey}</p>
          </div>
          <div>
            <Label htmlFor="setting-value" className="text-xs text-slate-500">
              Hodnota
            </Label>
            <Input
              id="setting-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="mt-1"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Zrušiť
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Ukladám…' : 'Uložiť'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
