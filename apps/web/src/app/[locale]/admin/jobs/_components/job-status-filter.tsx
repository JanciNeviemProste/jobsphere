'use client'

import { useTranslations } from 'next-intl'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface JobStatusFilterProps {
  currentStatus?: string
}

export function JobStatusFilter({ currentStatus }: JobStatusFilterProps) {
  const t = useTranslations('admin')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'ALL') {
      params.delete('status')
    } else {
      params.set('status', value)
    }
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <Select defaultValue={currentStatus ?? 'ALL'} onValueChange={handleChange}>
      <SelectTrigger className="w-[160px]">
        <SelectValue placeholder={t('jobs.filterPlaceholder')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">{t('jobs.allStatuses')}</SelectItem>
        <SelectItem value="PUBLISHED">PUBLISHED</SelectItem>
        <SelectItem value="DRAFT">DRAFT</SelectItem>
        <SelectItem value="CLOSED">CLOSED</SelectItem>
        <SelectItem value="PAUSED">PAUSED</SelectItem>
      </SelectContent>
    </Select>
  )
}
