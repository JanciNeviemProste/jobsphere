import { NextResponse } from 'next/server'
import Redis from 'ioredis'

export async function GET() {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

  try {
    await redis.ping()
    await redis.quit()

    return NextResponse.json({
      status: 'healthy',
      redis: 'connected',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        redis: 'disconnected',
        error: String(error),
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    )
  }
}
