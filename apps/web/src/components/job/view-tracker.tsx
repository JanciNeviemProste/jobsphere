'use client'

import { useEffect, useRef } from 'react'
import { logger } from '@/lib/logger'

interface ViewTrackerProps {
  jobId: string
}

/**
 * Client component that tracks job views
 * Calls the API once when the component mounts
 */
export function ViewTracker({ jobId }: ViewTrackerProps) {
  const tracked = useRef(false)

  useEffect(() => {
    // Only track once per mount
    if (tracked.current) return
    tracked.current = true

    // Track view asynchronously
    const trackView = async () => {
      try {
        await fetch(`/api/jobs/${jobId}/view`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      } catch (error) {
        // Silently fail - view tracking is not critical
        logger.warn('Failed to track job view', { error: String(error) })
      }
    }

    trackView()
  }, [jobId])

  // This component doesn't render anything
  return null
}
