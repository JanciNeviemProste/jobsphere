import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/errors'

export const runtime = 'nodejs'

async function requireGlobalAdmin() {
  const session = await auth()
  if (!session?.user?.isGlobalAdmin) {
    return null
  }
  return session
}

export async function GET(req: Request) {
  try {
    const session = await requireGlobalAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') ?? undefined
    const status = searchParams.get('status') ?? undefined
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '50')))
    const skip = (page - 1) * limit

    const where = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { organization: { name: { contains: search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        select: {
          id: true,
          title: true,
          status: true,
          orgId: true,
          createdAt: true,
          organization: { select: { name: true } },
          _count: { select: { applications: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.job.count({ where }),
    ])

    return NextResponse.json({ jobs, total, page, limit })
  } catch (error) {
    logger.error('Admin GET /jobs error:', error)
    return handleApiError(error)
  }
}

const patchSchema = z.object({
  jobId: z.string().min(1),
  status: z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']),
})

export async function PATCH(req: Request) {
  try {
    const session = await requireGlobalAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { jobId, status } = patchSchema.parse(body)

    const job = await prisma.job.findUnique({ where: { id: jobId } })
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: { status },
      select: { id: true, title: true, status: true },
    })

    logger.info(`Admin set job ${jobId} status=${status} by ${session.user.id}`)
    return NextResponse.json({ job: updated })
  } catch (error) {
    logger.error('Admin PATCH /jobs error:', error)
    return handleApiError(error)
  }
}
