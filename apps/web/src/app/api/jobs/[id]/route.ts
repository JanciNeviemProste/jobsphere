import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { errorResponse } from '@/lib/errors'
import { withRateLimit } from '@/lib/rate-limit'
import { requireAuth } from '@/lib/auth'

export const GET = withRateLimit(
  async (req: Request, context?: { params?: Record<string, string> }) => {
    const startTime = Date.now()

    try {
      const params = context?.params
      if (!params?.id) {
        return NextResponse.json({ error: 'Missing job ID' }, { status: 400 })
      }

      logger.apiRequest('GET', `/api/jobs/${params.id}`)

      const job = await prisma.job.findUnique({
        where: {
          id: params.id,
          status: 'ACTIVE'
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              logo: true,
              description: true,
              website: true
            }
          },
          _count: {
            select: {
              applications: true
            }
          }
        }
      })

      if (!job) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        )
      }

      const duration = Date.now() - startTime
      logger.info(`Fetched job ${params.id}`, { duration })

      return NextResponse.json(job)
    } catch (error) {
      logger.apiError('GET', `/api/jobs/[id]`, error)
      const errorData = errorResponse(error)
      return NextResponse.json(
        { error: errorData.error },
        { status: errorData.statusCode }
      )
    }
  },
  { preset: 'public' } // 200 requests per minute
)

// Update job (for employers)
export const PUT = withRateLimit(
  async (req: Request, context?: { params?: Record<string, string> }) => {
    try {
      const params = context?.params
      if (!params?.id) {
        return NextResponse.json({ error: 'Missing job ID' }, { status: 400 })
      }

      logger.apiRequest('PUT', `/api/jobs/${params.id}`)

      const session = await requireAuth()

      if (!session.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Check if user owns the job through organization
      const job = await prisma.job.findUnique({
        where: { id: params.id },
        include: {
          organization: {
            include: {
              users: {
                where: { userId: session.user.id }
              }
            }
          }
        }
      })

      if (!job || job.organization.users.length === 0) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      // Update job
      const data = await req.json()
      const updated = await prisma.job.update({
        where: { id: params.id },
        data: {
          title: data.title,
          description: data.description,
          requirements: data.requirements,
          benefits: data.benefits,
          city: data.city,
          salaryMin: data.salaryMin,
          salaryMax: data.salaryMax,
          salaryCurrency: data.salaryCurrency,
          remote: data.remote,
          hybrid: data.hybrid,
          employmentType: data.employmentType,
          seniority: data.seniority,
        }
      })

      // Re-generate embedding if description changed
      if (data.description && data.description !== job.description) {
        const { addEmbeddingJob } = await import('@/lib/queue')
        addEmbeddingJob({ jobId: params.id }).catch((err) => {
          logger.error('Failed to queue job embedding:', err)
          // Don't throw - embedding is nice-to-have, not critical
        })
      }

      logger.info('Job updated', { jobId: updated.id })

      return NextResponse.json(updated)
    } catch (error) {
      logger.apiError('PUT', `/api/jobs/[id]`, error)
      const errorData = errorResponse(error)
      return NextResponse.json(errorData, { status: errorData.statusCode })
    }
  },
  { preset: 'api', byUser: true }
)

// PATCH is an alias for PUT (both allow updates)
export const PATCH = PUT

// Delete job (soft delete - set status to CLOSED)
export const DELETE = withRateLimit(
  async (req: Request, context?: { params?: Record<string, string> }) => {
    try {
      const params = context?.params
      if (!params?.id) {
        return NextResponse.json({ error: 'Missing job ID' }, { status: 400 })
      }

      logger.apiRequest('DELETE', `/api/jobs/${params.id}`)

      const session = await requireAuth()

      if (!session.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Check if user owns the job through organization
      const job = await prisma.job.findUnique({
        where: { id: params.id },
        include: {
          organization: {
            include: {
              users: {
                where: { userId: session.user.id }
              }
            }
          }
        }
      })

      if (!job || job.organization.users.length === 0) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      // Soft delete - set status to CLOSED
      const updated = await prisma.job.update({
        where: { id: params.id },
        data: {
          status: 'CLOSED'
        }
      })

      logger.info('Job closed', { jobId: updated.id })

      return NextResponse.json({ success: true })
    } catch (error) {
      logger.apiError('DELETE', `/api/jobs/[id]`, error)
      const errorData = errorResponse(error)
      return NextResponse.json(errorData, { status: errorData.statusCode })
    }
  },
  { preset: 'api', byUser: true }
)