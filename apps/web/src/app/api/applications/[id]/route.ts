import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const application = await prisma.application.findUnique({
      where: {
        id: params.id,
      },
      include: {
        job: {
          include: {
            organization: {
              select: {
                name: true,
                logo: true,
              },
            },
          },
        },
        candidate: true,
        events: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    })

    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    // Check authorization - only candidate or employer can view
    const isCandidate = application.candidateId === session.user.id
    const isEmployer = await prisma.orgMember.findFirst({
      where: {
        userId: session.user.id,
        orgId: application.job.orgId,
      },
    })

    if (!isCandidate && !isEmployer) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    return NextResponse.json(application)
  } catch (error) {
    console.error('Error fetching application:', error)
    return NextResponse.json(
      { error: 'Failed to fetch application' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { status, notes } = body

    const application = await prisma.application.findUnique({
      where: { id: params.id },
      include: { job: true },
    })

    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    // Only employer can update status
    const isEmployer = await prisma.orgMember.findFirst({
      where: {
        userId: session.user.id,
        orgId: application.job.orgId,
      },
    })

    if (!isEmployer) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Update application
    const updatedApplication = await prisma.application.update({
      where: { id: params.id },
      data: {
        ...(status && { status }),
        ...(notes && { notes }),
      },
    })

    // Create event for status change
    if (status && status !== application.status) {
      const statusDescriptions: Record<string, string> = {
        REVIEWING: 'Application is now under review',
        INTERVIEWED: 'Interview has been scheduled',
        ACCEPTED: 'Application has been accepted',
        REJECTED: 'Application has been rejected',
      }

      await prisma.applicationEvent.create({
        data: {
          applicationId: application.id,
          type: 'STATUS_CHANGED',
          title: statusDescriptions[status] || `Application status changed to ${status}`,
        },
      })
    }

    return NextResponse.json(updatedApplication)
  } catch (error) {
    console.error('Error updating application:', error)
    return NextResponse.json(
      { error: 'Failed to update application' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const application = await prisma.application.findUnique({
      where: { id: params.id },
    })

    if (!application) {
      return NextResponse.json(
        { error: 'Application not found' },
        { status: 404 }
      )
    }

    // Only candidate can delete their own application
    if (application.candidateId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Delete application (cascade will delete activities)
    await prisma.application.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting application:', error)
    return NextResponse.json(
      { error: 'Failed to delete application' },
      { status: 500 }
    )
  }
}
