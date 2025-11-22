'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { showToast } from '@/components/ui/use-toast'

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
  className
}: SaveJobButtonProps) {
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
        console.warn('Failed to check saved state:', error)
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
          'Content-Type': 'application/json'
        }
      })

      if (response.status === 401) {
        showToast({
          title: 'Prihlásenie vyžadované',
          description: 'Pre uloženie práce sa musíte prihlásiť.',
          variant: 'destructive'
        })
        return
      }

      const data = await response.json()
      setSaved(data.saved)

      showToast({
        title: data.saved ? 'Práca uložená' : 'Práca odstránená',
        description: data.saved
          ? 'Práca bola pridaná do obľúbených.'
          : 'Práca bola odstránená z obľúbených.'
      })
    } catch (error) {
      showToast({
        title: 'Chyba',
        description: 'Nepodarilo sa uložiť prácu. Skúste to znova.',
        variant: 'destructive'
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
      aria-label={saved ? 'Odstrániť z obľúbených' : 'Pridať do obľúbených'}
    >
      <Heart
        className={cn(
          'h-4 w-4',
          showLabel && 'mr-2',
          saved && 'fill-red-500 text-red-500'
        )}
      />
      {showLabel && (saved ? 'Uložené' : 'Uložiť')}
    </Button>
  )
}
