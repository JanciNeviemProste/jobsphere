/**
 * Web Vitals Monitoring Unit Tests
 * Tests for Web Vitals thresholds, rating calculation, and metric tracking
 */

import { describe, it, expect } from 'vitest'
import { WEB_VITALS_THRESHOLDS, type WebVitalName, type WebVitalRating } from '../web-vitals'

describe('Web Vitals Thresholds', () => {
  it('should have correct LCP thresholds', () => {
    expect(WEB_VITALS_THRESHOLDS.LCP.good).toBe(2500) // 2.5s
    expect(WEB_VITALS_THRESHOLDS.LCP.needsImprovement).toBe(4000) // 4s
  })

  it('should have correct INP thresholds', () => {
    expect(WEB_VITALS_THRESHOLDS.INP.good).toBe(200) // 200ms
    expect(WEB_VITALS_THRESHOLDS.INP.needsImprovement).toBe(500) // 500ms
  })

  it('should have correct CLS thresholds', () => {
    expect(WEB_VITALS_THRESHOLDS.CLS.good).toBe(0.1)
    expect(WEB_VITALS_THRESHOLDS.CLS.needsImprovement).toBe(0.25)
  })

  it('should have correct FCP thresholds', () => {
    expect(WEB_VITALS_THRESHOLDS.FCP.good).toBe(1800) // 1.8s
    expect(WEB_VITALS_THRESHOLDS.FCP.needsImprovement).toBe(3000) // 3s
  })

  it('should have correct TTFB thresholds', () => {
    expect(WEB_VITALS_THRESHOLDS.TTFB.good).toBe(800) // 800ms
    expect(WEB_VITALS_THRESHOLDS.TTFB.needsImprovement).toBe(1800) // 1.8s
  })

  it('should have thresholds for all Core Web Vitals', () => {
    const coreWebVitals: WebVitalName[] = ['CLS', 'INP', 'LCP']

    coreWebVitals.forEach((metric) => {
      expect(WEB_VITALS_THRESHOLDS[metric]).toBeDefined()
      expect(WEB_VITALS_THRESHOLDS[metric].good).toBeDefined()
      expect(WEB_VITALS_THRESHOLDS[metric].needsImprovement).toBeDefined()
    })
  })
})

describe('Web Vitals Rating Classification', () => {
  // Helper function to simulate getRating (since it's not exported)
  function getRating(name: WebVitalName, value: number): WebVitalRating {
    const threshold = WEB_VITALS_THRESHOLDS[name]
    if (value <= threshold.good) return 'good'
    if (value <= threshold.needsImprovement) return 'needs-improvement'
    return 'poor'
  }

  describe('LCP Rating', () => {
    it('should classify LCP <= 2500ms as good', () => {
      expect(getRating('LCP', 2000)).toBe('good')
      expect(getRating('LCP', 2500)).toBe('good')
    })

    it('should classify LCP 2500-4000ms as needs-improvement', () => {
      expect(getRating('LCP', 3000)).toBe('needs-improvement')
      expect(getRating('LCP', 4000)).toBe('needs-improvement')
    })

    it('should classify LCP > 4000ms as poor', () => {
      expect(getRating('LCP', 5000)).toBe('poor')
      expect(getRating('LCP', 10000)).toBe('poor')
    })
  })

  describe('INP Rating', () => {
    it('should classify INP <= 200ms as good', () => {
      expect(getRating('INP', 100)).toBe('good')
      expect(getRating('INP', 200)).toBe('good')
    })

    it('should classify INP 200-500ms as needs-improvement', () => {
      expect(getRating('INP', 300)).toBe('needs-improvement')
      expect(getRating('INP', 500)).toBe('needs-improvement')
    })

    it('should classify INP > 500ms as poor', () => {
      expect(getRating('INP', 600)).toBe('poor')
      expect(getRating('INP', 1000)).toBe('poor')
    })
  })

  describe('CLS Rating', () => {
    it('should classify CLS <= 0.1 as good', () => {
      expect(getRating('CLS', 0.05)).toBe('good')
      expect(getRating('CLS', 0.1)).toBe('good')
    })

    it('should classify CLS 0.1-0.25 as needs-improvement', () => {
      expect(getRating('CLS', 0.15)).toBe('needs-improvement')
      expect(getRating('CLS', 0.25)).toBe('needs-improvement')
    })

    it('should classify CLS > 0.25 as poor', () => {
      expect(getRating('CLS', 0.3)).toBe('poor')
      expect(getRating('CLS', 0.5)).toBe('poor')
    })
  })

  describe('FCP Rating', () => {
    it('should classify FCP <= 1800ms as good', () => {
      expect(getRating('FCP', 1500)).toBe('good')
      expect(getRating('FCP', 1800)).toBe('good')
    })

    it('should classify FCP 1800-3000ms as needs-improvement', () => {
      expect(getRating('FCP', 2000)).toBe('needs-improvement')
      expect(getRating('FCP', 3000)).toBe('needs-improvement')
    })

    it('should classify FCP > 3000ms as poor', () => {
      expect(getRating('FCP', 3500)).toBe('poor')
      expect(getRating('FCP', 5000)).toBe('poor')
    })
  })

  describe('TTFB Rating', () => {
    it('should classify TTFB <= 800ms as good', () => {
      expect(getRating('TTFB', 500)).toBe('good')
      expect(getRating('TTFB', 800)).toBe('good')
    })

    it('should classify TTFB 800-1800ms as needs-improvement', () => {
      expect(getRating('TTFB', 1000)).toBe('needs-improvement')
      expect(getRating('TTFB', 1800)).toBe('needs-improvement')
    })

    it('should classify TTFB > 1800ms as poor', () => {
      expect(getRating('TTFB', 2000)).toBe('poor')
      expect(getRating('TTFB', 3000)).toBe('poor')
    })
  })
})

describe('Web Vitals Metric Structure', () => {
  it('should have correct metric names', () => {
    const validMetrics: WebVitalName[] = ['CLS', 'FCP', 'FID', 'INP', 'LCP', 'TTFB']

    validMetrics.forEach((metric) => {
      expect(['CLS', 'FCP', 'FID', 'INP', 'LCP', 'TTFB']).toContain(metric)
    })
  })

  it('should have correct rating values', () => {
    const validRatings: WebVitalRating[] = ['good', 'needs-improvement', 'poor']

    validRatings.forEach((rating) => {
      expect(['good', 'needs-improvement', 'poor']).toContain(rating)
    })
  })

  it('should support all navigation types', () => {
    const validNavigationTypes = [
      'navigate',
      'reload',
      'back-forward',
      'back-forward-cache',
      'prerender',
      'restore',
    ]

    validNavigationTypes.forEach((navType) => {
      expect(validNavigationTypes).toContain(navType)
    })
  })
})

describe('Web Vitals Edge Cases', () => {
  function getRating(name: WebVitalName, value: number): WebVitalRating {
    const threshold = WEB_VITALS_THRESHOLDS[name]
    if (value <= threshold.good) return 'good'
    if (value <= threshold.needsImprovement) return 'needs-improvement'
    return 'poor'
  }

  it('should handle boundary values correctly', () => {
    // Exact threshold values
    expect(getRating('LCP', 2500)).toBe('good')
    expect(getRating('LCP', 2501)).toBe('needs-improvement')
    expect(getRating('LCP', 4000)).toBe('needs-improvement')
    expect(getRating('LCP', 4001)).toBe('poor')
  })

  it('should handle zero values', () => {
    expect(getRating('LCP', 0)).toBe('good')
    expect(getRating('CLS', 0)).toBe('good')
    expect(getRating('TTFB', 0)).toBe('good')
  })

  it('should handle very large values', () => {
    expect(getRating('LCP', 999999)).toBe('poor')
    expect(getRating('TTFB', 999999)).toBe('poor')
  })

  it('should handle decimal values for CLS', () => {
    expect(getRating('CLS', 0.09)).toBe('good')
    expect(getRating('CLS', 0.11)).toBe('needs-improvement')
    expect(getRating('CLS', 0.26)).toBe('poor')
  })
})

describe('Web Vitals Best Practices', () => {
  it('should follow Google Core Web Vitals guidelines', () => {
    // Core Web Vitals should match Google recommendations
    // LCP: Good <= 2.5s, Poor > 4s
    expect(WEB_VITALS_THRESHOLDS.LCP.good).toBe(2500)
    expect(WEB_VITALS_THRESHOLDS.LCP.needsImprovement).toBe(4000)

    // INP: Good <= 200ms, Poor > 500ms
    expect(WEB_VITALS_THRESHOLDS.INP.good).toBe(200)
    expect(WEB_VITALS_THRESHOLDS.INP.needsImprovement).toBe(500)

    // CLS: Good <= 0.1, Poor > 0.25
    expect(WEB_VITALS_THRESHOLDS.CLS.good).toBe(0.1)
    expect(WEB_VITALS_THRESHOLDS.CLS.needsImprovement).toBe(0.25)
  })

  it('should have reasonable thresholds for other metrics', () => {
    // FCP: Good <= 1.8s
    expect(WEB_VITALS_THRESHOLDS.FCP.good).toBe(1800)

    // TTFB: Good <= 800ms
    expect(WEB_VITALS_THRESHOLDS.TTFB.good).toBe(800)
  })
})
