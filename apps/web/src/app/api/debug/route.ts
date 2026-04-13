import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { errorResponse } from '@/lib/errors'
import { withRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

export const runtime = 'nodejs'

export const GET = withRateLimit(
  async () => {
    try {
      const count = await prisma.job.count({ where: { status: 'PUBLISHED' } })
      return NextResponse.json({
        status: 'ok',
        jobCount: count,
        node: process.version,
      })
    } catch (e: any) {
      logger.error('Debug endpoint error', e)
      return NextResponse.json(
        {
          status: 'error',
          error: e.message?.substring(0, 500),
          code: e.code,
        },
        { status: 500 },
      )
    }
  },
  { preset: 'public' },
)
