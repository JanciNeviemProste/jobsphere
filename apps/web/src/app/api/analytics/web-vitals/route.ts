/**
 * Web Vitals Analytics Endpoint
 * Receives and stores Web Vitals metrics
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { withRateLimit } from '@/lib/rate-limit'

// Validation schema for Web Vitals metrics
const webVitalSchema = z.object({
  name: z.enum(['CLS', 'FCP', 'FID', 'INP', 'LCP', 'TTFB']),
  value: z.number(),
  rating: z.enum(['good', 'needs-improvement', 'poor']),
  delta: z.number(),
  id: z.string(),
  navigationType: z.enum(['navigate', 'reload', 'back-forward', 'back-forward-cache', 'prerender']),
  timestamp: z.number(),
})

export const POST = withRateLimit(
  async function POST(req: Request) {
    try {
      const body = await req.json()
      const metric = webVitalSchema.parse(body)

      // Get user agent and IP for context
      const userAgent = req.headers.get('user-agent') || 'unknown'
      const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
      const url = req.headers.get('referer') || 'unknown'

      // Log the metric
      logger.info('Web Vital recorded', {
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
        navigationType: metric.navigationType,
        userAgent,
        url,
        ip: ip.split(',')[0].trim(), // Take first IP if multiple
      })

      // Store in database for long-term analysis
      await prisma.webVitalsMetric.create({
        data: {
          name: metric.name,
          value: metric.value,
          rating: metric.rating,
          delta: metric.delta,
          metricId: metric.id,
          navigationType: metric.navigationType,
          timestamp: new Date(metric.timestamp),
          userAgent,
          url,
          ip: ip.split(',')[0].trim(),
        },
      })

      return NextResponse.json({ success: true }, { status: 200 })
    } catch (error) {
      // Don't log validation errors to avoid spam
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Invalid metric data' }, { status: 400 })
      }

      logger.error('Failed to record Web Vital', { error })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  },
  { preset: 'public' },
)

// Allow GET for health check
export const GET = withRateLimit(
  async function GET() {
    return NextResponse.json({
      status: 'ok',
      message: 'Web Vitals analytics endpoint',
    })
  },
  { preset: 'public' },
)
