import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { subject, body } = await req.json()

    if (!subject || !body) {
      return NextResponse.json({ error: 'Subject and body are required' }, { status: 400 })
    }

    // Get application with candidate contact
    const application = await prisma.application.findUnique({
      where: { id: params.id },
      include: {
        job: {
          include: {
            organization: true,
          },
        },
        candidate: {
          include: {
            contacts: {
              where: { isPrimary: true },
              take: 1,
            },
          },
        },
      },
    })

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // Verify user is member of organization
    const membership = await prisma.userOrgRole.findFirst({
      where: {
        userId: session.user.id,
        orgId: application.job.orgId,
      },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const candidateEmail = application.candidate.contacts?.[0]?.email
    if (!candidateEmail) {
      return NextResponse.json({ error: 'No email found for candidate' }, { status: 400 })
    }

    // Send email
    await sendEmail({
      to: candidateEmail,
      subject,
      html: body,
    })

    // Log activity
    await prisma.applicationActivity.create({
      data: {
        applicationId: params.id,
        type: 'EMAIL_SENT',
        description: `Email sent: ${subject}`,
        performedBy: session.user.id,
        metadata: {
          subject,
          to: candidateEmail,
          sentBy: session.user.name || session.user.email,
        },
      },
    })

    // Update last contact tracking
    await prisma.application.update({
      where: { id: params.id },
      data: {
        lastContactAt: new Date(),
        lastContactType: 'EMAIL',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error sending email:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
