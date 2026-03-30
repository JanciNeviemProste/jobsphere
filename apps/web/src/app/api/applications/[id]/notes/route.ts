import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { withCsrfProtection } from '@/lib/csrf'
import { withRateLimit } from '@/lib/rate-limit'
import { sanitizeNote } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

export const POST = withCsrfProtection(
  withRateLimit(
    async (req: Request, context?: { params?: Record<string, string> }) => {
      const params = context?.params as { id: string }
      if (!params?.id) {
        return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
      }
      try {
        const session = await auth()
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { note } = await req.json()

        if (!note || typeof note !== 'string' || note.trim().length === 0) {
          return NextResponse.json({ error: 'Note content is required' }, { status: 400 })
        }

        // Get application with job to verify permissions
        const application = await prisma.application.findUnique({
          where: { id: params.id },
          include: { job: true },
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

        // Create activity with note
        const activity = await prisma.applicationActivity.create({
          data: {
            applicationId: params.id,
            type: 'NOTE_ADDED',
            description: 'Note added',
            performedBy: session.user.id,
            metadata: {
              note: sanitizeNote(note) || '',
              addedBy: session.user.name || session.user.email,
            },
          },
        })

        // Also update the notes JSON field in Application
        const existingNotes = Array.isArray(application.notes) ? application.notes : []
        await prisma.application.update({
          where: { id: params.id },
          data: {
            notes: [
              ...existingNotes,
              {
                text: sanitizeNote(note) || '',
                createdAt: new Date().toISOString(),
                createdBy: session.user.id,
                createdByName: session.user.name || session.user.email,
              },
            ],
          },
        })

        return NextResponse.json(activity)
      } catch (error) {
        logger.error('Error adding note:', error)
        return NextResponse.json({ error: 'Failed to add note' }, { status: 500 })
      }
    },
    { preset: 'api', byUser: true }, // 100 requests per minute
  ),
)
