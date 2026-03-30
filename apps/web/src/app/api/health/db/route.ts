import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export const GET = withRateLimit(
  async (req: Request) => {
    // Auth check - IMPORTANT for production security!
    const authHeader = req.headers.get('authorization')
    const secret = process.env.HEALTH_CHECK_SECRET
    if (process.env.NODE_ENV === 'production') {
      if (!secret) {
        return NextResponse.json({ error: 'Health check not configured' }, { status: 503 })
      }
      if (authHeader !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    try {
      await prisma.$queryRaw`SELECT 1`
      return NextResponse.json({
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString(),
      })
    } catch {
      return NextResponse.json(
        {
          status: 'unhealthy',
          database: 'disconnected',
          timestamp: new Date().toISOString(),
        },
        { status: 503 },
      )
    }
  },
  { preset: 'public', byUser: false }, // 200 req/min by IP - prevents DDoS on health checks
)
