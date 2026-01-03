'use client'

/**
 * Web Vitals Reporter Component
 * Client component that initializes Web Vitals monitoring
 */

import { useEffect } from 'react'
import { reportWebVitals, monitorResourceTiming, monitorLongTasks } from '@/lib/monitoring/web-vitals'

export function WebVitalsReporter() {
  useEffect(() => {
    // Initialize Web Vitals monitoring
    reportWebVitals()

    // Monitor slow resources (>1s)
    monitorResourceTiming(1000)

    // Monitor long tasks (>50ms)
    monitorLongTasks(50)
  }, [])

  // This component doesn't render anything
  return null
}
