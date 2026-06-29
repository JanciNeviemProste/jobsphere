import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/errors'
import { withCsrfProtection } from '@/lib/csrf'
import { withRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

async function requireGlobalAdmin() {
  const session = await auth()
  if (!session?.user?.isGlobalAdmin) {
    return null
  }
  return session
}

export async function GET() {
  try {
    const session = await requireGlobalAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [settings, flags] = await Promise.all([
      prisma.systemSetting.findMany({ orderBy: { key: 'asc' } }),
      prisma.featureFlag.findMany({ orderBy: { key: 'asc' } }),
    ])

    return NextResponse.json({ settings, flags })
  } catch (error) {
    logger.error('Admin GET /settings error:', error)
    return handleApiError(error)
  }
}

const patchSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('setting'),
    key: z.string().min(1),
    value: z.string(),
  }),
  z.object({
    type: z.literal('flag'),
    key: z.string().min(1),
    value: z.boolean(),
  }),
])

export const PATCH = withCsrfProtection(
  withRateLimit(
    async (req: Request) => {
      try {
        const session = await requireGlobalAdmin()
        if (!session) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await req.json()
        const parsed = patchSchema.parse(body)

        if (parsed.type === 'setting') {
          const result = await prisma.systemSetting.upsert({
            where: { key: parsed.key },
            update: { value: parsed.value },
            create: { key: parsed.key, value: parsed.value },
          })
          logger.info(`Admin upsert setting ${parsed.key} by ${session.user.id}`)
          return NextResponse.json({ setting: result })
        }

        const flag = await prisma.featureFlag.findUnique({ where: { key: parsed.key } })
        if (!flag) {
          return NextResponse.json({ error: 'Feature flag not found' }, { status: 404 })
        }

        const result = await prisma.featureFlag.update({
          where: { key: parsed.key },
          data: { enabled: parsed.value },
        })
        logger.info(`Admin toggle flag ${parsed.key}=${parsed.value} by ${session.user.id}`)
        return NextResponse.json({ flag: result })
      } catch (error) {
        logger.error('Admin PATCH /settings error:', error)
        return handleApiError(error)
      }
    },
    { preset: 'api' },
  ),
)
