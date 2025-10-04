import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
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

    return NextResponse.json(jobs)
  } catch (error) {
    console.error('Error fetching jobs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
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
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
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

    return NextResponse.json(job, { status: 201 })
  } catch (error) {
    console.error('Error creating job:', error)
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    )
  }
}
