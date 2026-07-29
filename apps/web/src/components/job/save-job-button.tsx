'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { showToast } from '@/components/ui/use-toast'
import { logger } from '@/lib/logger'
import { useTranslations } from 'next-intl'

interface SaveJobButtonProps {
  jobId: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  showLabel?: boolean
  className?: string
}

export function SaveJobButton({
  jobId,
  variant = 'outline',
  size = 'lg',
  showLabel = false,
  className,
}: SaveJobButtonProps) {
  const t = useTranslations('jobs')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  // Check initial saved state
  useEffect(() => {
    const checkSavedState = async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}/save`)
        const data = await response.json()
        setSaved(data.saved)
      } catch (error) {
        logger.warn('Failed to check saved state', { error: String(error) })
      } finally {
        setInitialLoad(false)
      }
    }

    checkSavedState()
  }, [jobId])

  const handleToggleSave = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/jobs/${jobId}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.status === 401) {
        showToast({
          title: t('loginRequired'),
          description: t('loginRequiredDescription'),
          variant: 'destructive',
        })
        return
      }

      const data = await response.json()
      setSaved(data.saved)

      showToast({
        title: data.saved ? t('saved') : t('removed'),
        description: data.saved ? t('savedDescription') : t('removedDescription'),
      })
    } catch {
      showToast({
        title: t('error'),
        description: t('saveError'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggleSave}
      disabled={loading || initialLoad}
      className={cn(className)}
      aria-label={saved ? t('removeFromSaved') : t('addToSaved')}
    >
      <Heart className={cn('h-4 w-4', showLabel && 'mr-2', saved && 'fill-red-500 text-red-500')} />
      {showLabel && (saved ? t('saved') : t('save'))}
    </Button>
  )
}
