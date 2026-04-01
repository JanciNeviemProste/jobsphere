import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export const GET = withRateLimit(
  async (req: Request) => {
    const isProduction = process.env.NODE_ENV === 'production'
    const authHeader = req.headers.get('authorization')
    const secret = process.env.HEALTH_CHECK_SECRET
    const isAuthorized = secret && authHeader === `Bearer ${secret}`

    try {
      // Lightweight DB connectivity check
      await prisma.$queryRaw`SELECT 1`

      if (!isProduction || isAuthorized) {
        // Full details only in dev or with auth token
        const jobCount = await prisma.job.count({ where: { status: 'PUBLISHED' } })
        return NextResponse.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          version: '1.0.0',
          database: { connected: true, publishedJobs: jobCount },
        })
      }

      // Production: minimal info only
      return NextResponse.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
      })
    } catch {
      // Never leak error details in production
      return NextResponse.json(
        { status: 'unhealthy', timestamp: new Date().toISOString() },
        { status: 500 },
      )
    }
  },
  { preset: 'public' },
)
