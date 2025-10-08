/**
 * GDPR Data Subject Access Request (DSAR) API
 * Export, delete, or rectify user data
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * POST /api/gdpr/dsar
 * Submit DSAR request
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { type } = await request.json()

    const validTypes = ['EXPORT', 'DELETE']

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid request type' },
        { status: 400 }
      )
    }

    // Create DSAR request
    const dsarRequest = await prisma.dSARRequest.create({
      data: {
        userId: session.user.id,
        type,
        status: 'PENDING',
      },
      include: {
        user: { select: { email: true, name: true } },
      },
    })

    // Send email notifications
    try {
      const { sendEmail } = await import('@/lib/email')
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@jobsphere.com'

      // Notify admin
      await sendEmail({
        to: adminEmail,
        subject: `New GDPR ${type} Request`,
        html: `
          <h2>New GDPR Data Subject Access Request</h2>
          <p><strong>Request Type:</strong> ${type}</p>
          <p><strong>User:</strong> ${dsarRequest.user?.name || 'Unknown'} (${dsarRequest.user?.email || 'N/A'})</p>
          <p><strong>User ID:</strong> ${session.user.id}</p>
          <p><strong>Request ID:</strong> ${dsarRequest.id}</p>
          <p><strong>Status:</strong> PENDING</p>
          <p>This request must be processed within 30 days according to GDPR requirements.</p>
          <hr />
          <p style="color: #666; font-size: 12px;">JobSphere ATS - GDPR Compliance</p>
        `,
      })

      // Notify user
      if (session.user.email) {
        await sendEmail({
          to: session.user.email,
          subject: `Your GDPR ${type} Request - JobSphere`,
          html: `
            <h2>Request Received</h2>
            <p>Hi ${session.user.name || 'there'},</p>
            <p>We have received your GDPR ${type} request.</p>
            <p><strong>Request ID:</strong> ${dsarRequest.id}</p>
            <p>Your request will be processed within 30 days as required by GDPR regulations.</p>
            <p>You will receive an email notification once your request has been completed.</p>
            <hr />
            <p style="color: #666; font-size: 12px;">JobSphere ATS - GDPR Compliance</p>
          `,
        })
      }
    } catch (emailError) {
      console.error('Failed to send DSAR notification:', emailError)
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      request: dsarRequest,
      message: 'Your request has been submitted and will be processed within 30 days.',
    })
  } catch (error) {
    console.error('DSAR request error:', error)
    return NextResponse.json(
      { error: 'Failed to submit request' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/gdpr/dsar
 * Get user's DSAR requests
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const requests = await prisma.dSARRequest.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Get DSAR error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    )
  }
}
