/**
 * Edit or remove a single note on an application.
 *
 * The parent route only exposed POST, so notes were append-only: a typo, a wrong
 * candidate, or a line written in the heat of a rejection stayed forever.
 *
 * Notes are `ApplicationActivity` rows of type NOTE_ADDED — the same table that
 * records stage changes and emails. That makes them part of the timeline rather
 * than a scratchpad, so two constraints follow, and both are enforced here
 * rather than left to the UI:
 *
 *   - only the author may edit or remove their own note. A recruiter quietly
 *     rewriting a colleague's assessment of a candidate is exactly what an
 *     activity trail exists to prevent.
 *   - an edited note is marked as edited. Silent rewriting of a record others
 *     have already read is the same problem in slower motion.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/errors'
import { withCsrfProtection } from '@/lib/csrf'
import { withRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const updateNoteSchema = z.object({
  note: z.string().min(1).max(5000),
})

function ids(context?: { params?: Record<string, string> }) {
  const applicationId = context?.params?.id
  const noteId = context?.params?.noteId
  return applicationId && noteId ? { applicationId, noteId } : null
}

/** The note, if it exists on this application, is a note, and the caller wrote it. */
async function findOwnNote(noteId: string, applicationId: string, userId: string) {
  const note = await prisma.applicationActivity.findFirst({
    where: { id: noteId, applicationId, type: 'NOTE_ADDED' },
  })
  if (!note) return { note: null as null, forbidden: false }
  if (note.performedBy !== userId) return { note: null as null, forbidden: true }
  return { note, forbidden: false }
}

export const PATCH = withCsrfProtection(
  withRateLimit(
    async (req: Request, context?: { params?: Record<string, string> }) => {
      try {
        const parsed = ids(context)
        if (!parsed) {
          return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
        }

        const session = await auth()
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { note: text } = updateNoteSchema.parse(await req.json())

        const { note, forbidden } = await findOwnNote(
          parsed.noteId,
          parsed.applicationId,
          session.user.id,
        )
        if (forbidden) {
          return NextResponse.json({ error: 'You can only edit your own notes' }, { status: 403 })
        }
        if (!note) {
          return NextResponse.json({ error: 'Note not found' }, { status: 404 })
        }

        const updated = await prisma.applicationActivity.update({
          where: { id: parsed.noteId },
          data: {
            description: text,
            // The marker matters: someone reading the timeline later should be
            // able to tell a note that was revised from one that was not.
            metadata: {
              ...((note.metadata as Record<string, unknown>) ?? {}),
              edited: true,
              editedAt: new Date().toISOString(),
            },
          },
        })

        logger.info('Application note edited', { noteId: parsed.noteId })

        return NextResponse.json({ note: updated })
      } catch (error) {
        return handleApiError(error)
      }
    },
    { preset: 'api', byUser: true },
  ),
)

export const DELETE = withCsrfProtection(
  withRateLimit(
    async (_req: Request, context?: { params?: Record<string, string> }) => {
      try {
        const parsed = ids(context)
        if (!parsed) {
          return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
        }

        const session = await auth()
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { note, forbidden } = await findOwnNote(
          parsed.noteId,
          parsed.applicationId,
          session.user.id,
        )
        if (forbidden) {
          return NextResponse.json({ error: 'You can only delete your own notes' }, { status: 403 })
        }
        if (!note) {
          return NextResponse.json({ error: 'Note not found' }, { status: 404 })
        }

        // A note is the one activity type a person authored freely and may
        // retract, so this is a real delete rather than a tombstone — unlike the
        // stage changes and emails around it, which record things that happened.
        await prisma.applicationActivity.delete({ where: { id: parsed.noteId } })

        logger.info('Application note deleted', { noteId: parsed.noteId })

        return NextResponse.json({ success: true })
      } catch (error) {
        return handleApiError(error)
      }
    },
    { preset: 'api', byUser: true },
  ),
)
