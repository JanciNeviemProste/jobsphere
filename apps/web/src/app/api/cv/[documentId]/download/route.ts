/**
 * Authenticated CV download (SEC-001)
 *
 * Serves a CandidateDocument's file ONLY to authorized callers:
 *   - a member of the document's candidate's organization (recruiter/employer), OR
 *   - the candidate themselves (the document's candidate is linked to the caller's User).
 *
 * The file is fetched server-side and streamed back; we never redirect the caller
 * to the raw storage URL (that would re-expose the public blob).
 */

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limit'
import { isAllowedCvUrl } from '@/lib/cv-url'

export const runtime = 'nodejs'

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

      // Defense-in-depth SSRF guard (F1): only fetch URLs we produced, in case a
      // pre-guard / legacy CandidateDocument holds an attacker-controlled uri.
      if (!isAllowedCvUrl(doc.uri)) {
        logger.error('Refusing to fetch non-allowlisted CV uri', { documentId })
        return NextResponse.json({ error: 'Failed to retrieve file' }, { status: 502 })
      }

      // Fetch the file server-side and stream it back. Never redirect to doc.uri.
      const upstream = await fetch(doc.uri)
      if (!upstream.ok || !upstream.body) {
        logger.error('Failed to fetch CV from storage', {
          documentId,
          status: upstream.status,
        })
        return NextResponse.json({ error: 'Failed to retrieve file' }, { status: 502 })
      }

      // RFC 5987 encode the filename to safely handle non-ASCII characters.
      const safeFilename = doc.filename.replace(/["\\]/g, '_')
      const encodedFilename = encodeURIComponent(doc.filename)

      return new NextResponse(upstream.body, {
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
