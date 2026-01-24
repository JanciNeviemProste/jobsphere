import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withRateLimit } from '@/lib/rate-limit'

export const GET = withRateLimit(
  async (req: Request) => {
    // Auth check - IMPORTANT for production security!
    const authHeader = req.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.HEALTH_CHECK_SECRET || 'dev-secret-please-change-in-production'}`

    if (process.env.NODE_ENV === 'production' && authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      await prisma.$queryRaw`SELECT 1`
      return NextResponse.json({
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          database: 'disconnected',
          error: String(error),
          timestamp: new Date().toISOString(),
        },
        { status: 503 },
      )
    }
  },
  { preset: 'public', byUser: false }, // 200 req/min by IP - prevents DDoS on health checks
)
