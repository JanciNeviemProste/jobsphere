import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const jobId = searchParams.get('jobId')

    const applications = await prisma.application.findMany({
      where: {
        candidateId: session.user.id,
        ...(status && { status: status as any }),
        ...(jobId && { jobId }),
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(applications)
  } catch (error) {
    console.error('Error fetching applications:', error)
    return NextResponse.json(
      { error: 'Failed to fetch applications' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const {
      jobId,
      coverLetter,
      cvUrl,
      expectedSalary,
      availableFrom,
    } = body

    // Validation
    if (!jobId || !coverLetter) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if already applied
    const existingApplication = await prisma.application.findFirst({
      where: {
        jobId,
        candidateId: session.user.id,
      },
    })

    if (existingApplication) {
      return NextResponse.json(
        { error: 'You have already applied to this job' },
        { status: 409 }
      )
    }

    // Create application
    const application = await prisma.application.create({
      data: {
        jobId,
        candidateId: session.user.id,
        coverLetter,
        cvUrl: cvUrl || null,
        expectedSalary: expectedSalary ? parseInt(expectedSalary) : null,
        availableFrom: availableFrom ? new Date(availableFrom) : null,
        status: 'PENDING',
      },
      include: {
        job: {
          include: {
            organization: true,
          },
        },
      },
    })

    // Create application event
    await prisma.applicationEvent.create({
      data: {
        applicationId: application.id,
        type: 'APPLIED',
        title: 'Application Submitted',
        description: 'Your application has been successfully submitted',
      },
    })

    // Send email notifications
    try {
      const { sendEmail, getApplicationReceivedEmail, getNewApplicationEmail } = await import('@/lib/email')

      // Email to candidate
      if (session.user.email) {
        await sendEmail({
          to: session.user.email,
          subject: `Application Received - ${application.job.title}`,
          html: getApplicationReceivedEmail(
            session.user.name || 'Candidate',
            application.job.title,
            application.job.organization.name
          ),
        })
      }

      // Email to employer (get org admin email)
      const orgAdmin = await prisma.orgMember.findFirst({
        where: {
          organizationId: application.job.organizationId,
          role: 'ADMIN',
        },
        include: {
          user: true,
        },
      })

      if (orgAdmin?.user.email) {
        await sendEmail({
          to: orgAdmin.user.email,
          subject: `New Application - ${application.job.title}`,
          html: getNewApplicationEmail(
            orgAdmin.user.name || 'Employer',
            session.user.name || 'Unknown Candidate',
            application.job.title,
            application.id
          ),
        })
      }
    } catch (emailError) {
      console.error('Failed to send email notifications:', emailError)
      // Don't fail the request if email fails
    }

    return NextResponse.json(application, { status: 201 })
  } catch (error) {
    console.error('Error creating application:', error)
    return NextResponse.json(
      { error: 'Failed to create application' },
      { status: 500 }
    )
  }
}
