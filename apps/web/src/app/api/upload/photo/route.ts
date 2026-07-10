/**
 * Profile photo upload (CV builder).
 * Validates an image and stores it in Vercel Blob, returning a public URL.
 * Separate from /api/cv/upload (which is PDF/DOCX + AI parsing only).
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { auth } from '@/lib/auth'
import { withRateLimit } from '@/lib/rate-limit'
import { withCsrfProtection } from '@/lib/csrf'
import { logger } from '@/lib/logger'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

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
            { error: 'Invalid image type. Use JPG, PNG or WEBP.', code: 'invalid_type' },
            { status: 400 },
          )
        }
        if (file.size > MAX_SIZE) {
          return NextResponse.json(
            { error: 'Image too large (max 5MB).', code: 'too_large' },
            { status: 400 },
          )
        }

        // Sanitize the original name for the blob path; addRandomSuffix keeps URLs unguessable.
        const safeName = (file.name || 'photo').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60)
        const blob = await put(`photos/${Date.now()}-${safeName}`, file, {
          access: 'public',
          addRandomSuffix: true,
          token: process.env.BLOB_READ_WRITE_TOKEN,
        })

        return NextResponse.json({ url: blob.url })
      } catch (error) {
        logger.error('Photo upload error', { error })
        return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 })
      }
    },
    { limit: 20, window: 300 }, // 20 photo uploads per 5 minutes
  ),
)
