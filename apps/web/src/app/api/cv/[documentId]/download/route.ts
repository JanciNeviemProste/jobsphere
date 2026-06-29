/**
 * Authenticated CV download (SEC-001 / F6)
 *
 * Serves a CandidateDocument's file ONLY to authorized callers:
 *   - a member of the document's candidate's organization (recruiter/employer), OR
 *   - the candidate themselves (the document's candidate is linked to the caller's User).
 *
 * CVs are stored as PRIVATE Vercel blobs; the bytes are read server-side via the
 * authenticated SDK (get({ access: 'private' })) and streamed back. We never redirect
 * the caller to the raw storage URL. Legacy public blobs (uploaded before the private
 * switch) fall back to a plain server-side fetch.
 */

import { NextResponse } from 'next/server'
import { get } from '@vercel/blob'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limit'
import { isAllowedCvUrl, isVercelBlobUrl } from '@/lib/cv-url'

export const runtime = 'nodejs'

/**
 * Read the CV bytes for `uri`. New uploads are PRIVATE Vercel blobs read via the
 * authenticated SDK; legacy uploads were PUBLIC blobs still readable by fetch().
 */
async function readCvStream(uri: string): Promise<ReadableStream<Uint8Array> | null> {
  if (isVercelBlobUrl(uri)) {
    try {
      const result = await get(uri, {
        access: 'private',
        token: process.env.BLOB_READ_WRITE_TOKEN,
      })
      if (result?.statusCode === 200 && result.stream) {
        return result.stream
      }
    } catch (error) {
      // Legacy public blob (pre-F6) — not readable via the private get(); fall back.
      logger.warn('Private blob read failed; falling back to public fetch', { error })
    }
  }
  const upstream = await fetch(uri)
  return upstream.ok && upstream.body ? (upstream.body as ReadableStream<Uint8Array>) : null
}

export const GET = withRateLimit(
  async (_req: Request, context?: { params?: Record<string, string> }) => {
    try {
      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const documentId = context?.params?.documentId
      if (!documentId) {
        return NextResponse.json({ error: 'Missing document ID' }, { status: 400 })
      }

      const doc = await prisma.candidateDocument.findFirst({
        where: { id: documentId, deletedAt: null },
        include: {
          candidate: { select: { orgId: true, userId: true } },
        },
      })

      if (!doc) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 })
      }

      // Authorize: caller is the candidate, OR a member of the candidate's org.
      const isOwner = doc.candidate.userId === session.user.id
      let authorized = isOwner
      if (!authorized) {
        const membership = await prisma.userOrgRole.findFirst({
          where: { userId: session.user.id, orgId: doc.candidate.orgId },
        })
        authorized = Boolean(membership)
      }

      if (!authorized) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }

      // Defense-in-depth SSRF guard (F1): only read URLs we produced, in case a
      // pre-guard / legacy CandidateDocument holds an attacker-controlled uri.
      if (!isAllowedCvUrl(doc.uri)) {
        logger.error('Refusing to read non-allowlisted CV uri', { documentId })
        return NextResponse.json({ error: 'Failed to retrieve file' }, { status: 502 })
      }

      // Read the file server-side and stream it back. Never redirect to doc.uri.
      const body = await readCvStream(doc.uri)
      if (!body) {
        logger.error('Failed to read CV from storage', { documentId })
        return NextResponse.json({ error: 'Failed to retrieve file' }, { status: 502 })
      }

      // RFC 5987 encode the filename to safely handle non-ASCII characters.
      const safeFilename = doc.filename.replace(/["\\]/g, '_')
      const encodedFilename = encodeURIComponent(doc.filename)

      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': doc.mime || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`,
          ...(doc.size ? { 'Content-Length': String(doc.size) } : {}),
          'Cache-Control': 'private, no-store',
        },
      })
    } catch (error) {
      logger.error('CV download error', error)
      return NextResponse.json({ error: 'Failed to download CV' }, { status: 500 })
    }
  },
  { preset: 'api', byUser: true },
)
