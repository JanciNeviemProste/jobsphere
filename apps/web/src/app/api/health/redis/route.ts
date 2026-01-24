import { NextResponse } from 'next/server'
import Redis from 'ioredis'
import { withRateLimit } from '@/lib/rate-limit'

export const GET = withRateLimit(
  async (req: Request) => {
    // Auth check - IMPORTANT for production security!
    const authHeader = req.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.HEALTH_CHECK_SECRET || 'dev-secret-please-change-in-production'}`

    if (process.env.NODE_ENV === 'production' && authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

    try {
      await redis.ping()
      await redis.quit()

      return NextResponse.json({
        status: 'healthy',
        redis: 'connected',
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          redis: 'disconnected',
          error: String(error),
          timestamp: new Date().toISOString(),
        },
        { status: 503 },
      )
    }
  },
  { preset: 'public', byUser: false }, // 200 req/min by IP - prevents DDoS on health checks
)
