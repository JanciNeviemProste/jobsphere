import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { errorResponse, ValidationError } from '@/lib/errors'

export async function GET(req: Request) {
  const startTime = Date.now()
  try {
    logger.apiRequest('GET', '/api/jobs')

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')
    const workMode = searchParams.get('workMode')
    const jobType = searchParams.get('jobType')
    const seniority = searchParams.get('seniority')

    const jobs = await prisma.job.findMany({
      where: {
        status: 'ACTIVE',
        ...(search && {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { location: { contains: search, mode: 'insensitive' } },
            { organization: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }),
        ...(workMode && { workMode: workMode as any }),
        ...(jobType && { type: jobType as any }),
        ...(seniority && { seniority: seniority as any }),
      },
      include: {
        organization: {
          select: {
            name: true,
            logo: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    })

    const duration = Date.now() - startTime
    logger.info(`Fetched ${jobs.length} jobs`, { duration })

    return NextResponse.json(jobs)
  } catch (error) {
    logger.apiError('GET', '/api/jobs', error)
    const errorData = errorResponse(error)
    return NextResponse.json(
      { error: errorData.error },
      { status: errorData.statusCode }
    )
  }
}

export async function POST(req: Request) {
  try {
    logger.apiRequest('POST', '/api/jobs')

    const body = await req.json()
    const {
      title,
      location,
      minSalary,
      maxSalary,
      workMode,
      type,
      seniority,
      description,
      organizationId,
    } = body

    // Validation
    if (!title || !location || !description || !organizationId) {
      throw new ValidationError('Missing required fields', {
        title: !title ? 'Title is required' : '',
        location: !location ? 'Location is required' : '',
        description: !description ? 'Description is required' : '',
        organizationId: !organizationId ? 'Organization ID is required' : '',
      })
    }

    const job = await prisma.job.create({
      data: {
        title,
        location,
        salaryMin: minSalary ? parseInt(minSalary) : null,
        salaryMax: maxSalary ? parseInt(maxSalary) : null,
        workMode: workMode || 'HYBRID',
        type: type || 'FULL_TIME',
        seniority: seniority || 'MEDIOR',
        description,
        organizationId,
        status: 'ACTIVE',
      },
    })

    logger.info('Job created', { jobId: job.id, organizationId })

    return NextResponse.json(job, { status: 201 })
  } catch (error) {
    logger.apiError('POST', '/api/jobs', error)
    const errorData = errorResponse(error)
    return NextResponse.json(
      errorData,
      { status: errorData.statusCode }
    )
  }
}
