'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Switch } from '@/components/ui/switch'

interface FeatureFlagToggleProps {
  flagKey: string
  enabled: boolean
}

export function FeatureFlagToggle({ flagKey, enabled }: FeatureFlagToggleProps) {
  const t = useTranslations('admin.common')
  const router = useRouter()
  const [checked, setChecked] = useState(enabled)
  const [loading, setLoading] = useState(false)

  async function handleToggle(value: boolean) {
    setChecked(value)
    setLoading(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'flag', key: flagKey, value }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? t('error'))
        setChecked(!value)
        return
      }
      router.refresh()
    } catch {
      setChecked(!value)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Switch
      checked={checked}
      onCheckedChange={handleToggle}
      disabled={loading}
      aria-label={`Toggle ${flagKey}`}
    />
  )
}
