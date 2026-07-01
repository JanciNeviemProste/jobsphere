/**
 * Company / job video upload.
 * Validates a video and stores it in Vercel Blob, returning a public URL.
 * Membership-gated: only authenticated org members may upload.
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { auth } from '@/lib/auth'
import { withRateLimit } from '@/lib/rate-limit'
import { withCsrfProtection } from '@/lib/csrf'
import { logger } from '@/lib/logger'

const ALLOWED_TYPES = ['video/mp4', 'video/webm']
const MAX_SIZE = 50 * 1024 * 1024 // 50MB

export const POST = withCsrfProtection<NextRequest>(
  withRateLimit<NextRequest>(
    async (request: NextRequest) => {
      try {
        const session = await auth()
        if (!session?.user?.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const formData = await request.formData()
        const file = formData.get('file') as File | null

        if (!file) {
          return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
          return NextResponse.json(
            { error: 'Invalid video type. Use MP4 or WEBM.', code: 'invalid_type' },
            { status: 400 },
          )
        }
        if (file.size > MAX_SIZE) {
          return NextResponse.json(
            { error: 'Video too large (max 50MB).', code: 'too_large' },
            { status: 400 },
          )
        }

        // Sanitize the original name for the blob path; addRandomSuffix keeps URLs unguessable.
        const safeName = (file.name || 'video').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60)
        const blob = await put(`videos/${Date.now()}-${safeName}`, file, {
          access: 'public',
          addRandomSuffix: true,
          token: process.env.BLOB_READ_WRITE_TOKEN,
        })

        return NextResponse.json({ url: blob.url })
      } catch (error) {
        logger.error('Video upload error', { error })
        return NextResponse.json({ error: 'Failed to upload video' }, { status: 500 })
      }
    },
    { preset: 'upload', byUser: true },
  ),
)
