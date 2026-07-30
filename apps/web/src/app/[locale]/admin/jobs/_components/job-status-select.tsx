'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const STATUSES = ['DRAFT', 'PUBLISHED', 'CLOSED'] as const

interface JobStatusSelectProps {
  jobId: string
  currentStatus: string
}

export function JobStatusSelect({ jobId, currentStatus }: JobStatusSelectProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleChange(status: string) {
    if (status === currentStatus) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, status }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? 'Chyba')
        return
      }
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Select defaultValue={currentStatus} onValueChange={handleChange} disabled={loading}>
      <SelectTrigger className="h-8 w-[130px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => (
          <SelectItem key={s} value={s} className="text-xs">
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
