'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface OrgActionButtonProps {
  orgId: string
  suspended: boolean
}

export function OrgActionButton({ orgId, suspended }: OrgActionButtonProps) {
  const router = useRouter()
  const t = useTranslations('admin')
  const [loading, setLoading] = useState(false)

  async function handleAction() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/organizations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, action: suspended ? 'activate' : 'suspend' }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? t('common.error'))
        return
      }
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={suspended ? 'outline' : 'destructive'}
      size="sm"
      disabled={loading}
      onClick={handleAction}
    >
      {suspended ? t('organizations.activate') : t('organizations.suspend')}
    </Button>
  )
}
