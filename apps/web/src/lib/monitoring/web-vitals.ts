/**
 * Web Vitals Monitoring
 * Tracks Core Web Vitals metrics and reports to monitoring services
 */

// Temporarily disabled - web-vitals package not installed
// import { onCLS, onFCP, onFID, onINP, onLCP, onTTFB, type Metric } from 'web-vitals'
type Metric = any // Temporary placeholder

import { captureMessage } from './sentry'

/**
 * Web Vitals thresholds based on Google recommendations
 * Good: User experience is excellent
 * Needs Improvement: User experience is acceptable but can be better
 * Poor: User experience needs significant improvement
 */
export const WEB_VITALS_THRESHOLDS = {
  LCP: {
    good: 2500, // 2.5s
    needsImprovement: 4000, // 4s
  },
  FID: {
    good: 100, // 100ms
    needsImprovement: 300, // 300ms
  },
  INP: {
    good: 200, // 200ms
    needsImprovement: 500, // 500ms
  },
  CLS: {
    good: 0.1,
    needsImprovement: 0.25,
  },
  TTFB: {
    good: 800, // 800ms
    needsImprovement: 1800, // 1.8s
  },
  FCP: {
    good: 1800, // 1.8s
    needsImprovement: 3000, // 3s
  },
} as const

export type WebVitalName = 'CLS' | 'FCP' | 'FID' | 'INP' | 'LCP' | 'TTFB'

export type WebVitalRating = 'good' | 'needs-improvement' | 'poor'

export interface WebVitalMetric {
  name: WebVitalName
  value: number
  rating: WebVitalRating
  delta: number
  id: string
  navigationType: 'navigate' | 'reload' | 'back-forward' | 'back-forward-cache' | 'prerender'
  timestamp: number
}

/**
 * Calculate rating for a given metric
 */
function getRating(name: WebVitalName, value: number): WebVitalRating {
  const threshold = WEB_VITALS_THRESHOLDS[name]
  if (value <= threshold.good) return 'good'
  if (value <= threshold.needsImprovement) return 'needs-improvement'
  return 'poor'
}

/**
 * Send metric to analytics endpoint
 */
async function sendToAnalytics(metric: WebVitalMetric): Promise<void> {
  try {
    // Send to custom analytics endpoint
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const body = JSON.stringify(metric)
      navigator.sendBeacon('/api/analytics/web-vitals', body)
    } else {
      // Fallback to fetch
      fetch('/api/analytics/web-vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metric),
        keepalive: true,
      }).catch(() => {
        // Silently fail - we don't want to break the page
      })
    }

    // Also send to Vercel Analytics if available
    if (typeof window !== 'undefined' && (window as any).va) {
      ;(window as any).va('event', {
        name: 'web-vital',
        data: {
          metric: metric.name,
          value: metric.value,
          rating: metric.rating,
        },
      })
    }
  } catch (error) {
    // Silently fail
    if (process.env.NODE_ENV === 'development') {
      console.error('[Web Vitals] Failed to send metric:', error)
    }
  }
}

/**
 * Log metric to console in development
 */
function logMetric(metric: WebVitalMetric): void {
  if (process.env.NODE_ENV !== 'development') return

  const emoji = metric.rating === 'good' ? '✅' : metric.rating === 'needs-improvement' ? '⚠️' : '❌'
  console.log(
    `[Web Vitals] ${emoji} ${metric.name}: ${metric.value.toFixed(2)}ms (${metric.rating})`
  )
}

/**
 * Alert if metric is poor
 */
function alertPoorMetric(metric: WebVitalMetric): void {
  if (metric.rating === 'poor') {
    captureMessage(`Poor Web Vital: ${metric.name}`, 'warning', {
      tags: {
        metric: metric.name,
        rating: metric.rating,
      },
      extra: {
        value: metric.value,
        id: metric.id,
        navigationType: metric.navigationType,
      },
    })
  }
}

/**
 * Handle metric callback
 */
function handleMetric(metric: Metric): void {
  const webVitalMetric: WebVitalMetric = {
    name: metric.name as WebVitalName,
    value: metric.value,
    rating: getRating(metric.name as WebVitalName, metric.value),
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    timestamp: Date.now(),
  }

  // Log to console in development
  logMetric(webVitalMetric)

  // Send to analytics
  sendToAnalytics(webVitalMetric)

  // Alert if poor
  alertPoorMetric(webVitalMetric)
}

/**
 * Initialize Web Vitals monitoring
 * Should be called once on page load
 */
export function reportWebVitals(): void {
  // Temporarily disabled - web-vitals package not installed
  return

  /* try {
    // Core Web Vitals
    onCLS(handleMetric)
    onFID(handleMetric)
    onINP(handleMetric)
    onLCP(handleMetric)

    // Other important metrics
    onFCP(handleMetric)
    onTTFB(handleMetric)
  } catch (error) {
    // Silently fail if web-vitals is not available
    if (process.env.NODE_ENV === 'development') {
      console.error('[Web Vitals] Failed to initialize:', error)
    }
  } */
}

/**
 * Get current page performance metrics
 * Useful for manual reporting or debugging
 */
export function getPageMetrics(): Record<string, number> {
  if (typeof window === 'undefined' || !window.performance) {
    return {}
  }

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming

  if (!navigation) {
    return {}
  }

  return {
    // Page load metrics
    dns: navigation.domainLookupEnd - navigation.domainLookupStart,
    tcp: navigation.connectEnd - navigation.connectStart,
    ttfb: navigation.responseStart - navigation.requestStart,
    download: navigation.responseEnd - navigation.responseStart,
    domInteractive: navigation.domInteractive - navigation.fetchStart,
    domComplete: navigation.domComplete - navigation.fetchStart,
    loadComplete: navigation.loadEventEnd - navigation.fetchStart,

    // Resource timing
    totalResources: performance.getEntriesByType('resource').length,
  }
}

/**
 * Monitor resource timing
 * Useful for identifying slow resources
 */
export function monitorResourceTiming(threshold: number = 1000): void {
  if (typeof window === 'undefined' || !window.PerformanceObserver) {
    return
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const resourceTiming = entry as PerformanceResourceTiming
        const duration = resourceTiming.duration

        if (duration > threshold) {
          captureMessage(`Slow resource: ${resourceTiming.name}`, 'warning', {
            tags: {
              type: resourceTiming.initiatorType,
            },
            extra: {
              duration,
              size: resourceTiming.transferSize,
              url: resourceTiming.name,
            },
          })
        }
      }
    })

    observer.observe({ entryTypes: ['resource'] })
  } catch (error) {
    // Silently fail
    if (process.env.NODE_ENV === 'development') {
      console.error('[Web Vitals] Failed to monitor resource timing:', error)
    }
  }
}

/**
 * Monitor long tasks
 * Tasks that take longer than 50ms block the main thread
 */
export function monitorLongTasks(threshold: number = 50): void {
  if (typeof window === 'undefined' || !window.PerformanceObserver) {
    return
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const duration = entry.duration

        if (duration > threshold) {
          captureMessage(`Long task detected: ${duration.toFixed(2)}ms`, 'warning', {
            tags: {
              type: 'long-task',
            },
            extra: {
              duration,
              startTime: entry.startTime,
              name: entry.name,
            },
          })
        }
      }
    })

    observer.observe({ entryTypes: ['longtask'] })
  } catch (error) {
    // Silently fail - longtask may not be supported in all browsers
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Web Vitals] Long task monitoring not supported:', error)
    }
  }
}

/**
 * Export metrics summary for debugging
 */
export function exportMetricsSummary(): string {
  const metrics = getPageMetrics()
  return JSON.stringify(metrics, null, 2)
}
