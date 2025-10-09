/**
 * CV Upload API
 * Uploads file to Vercel Blob & extracts text using multi-stage pipeline
 */

import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { auth } from '@/lib/auth'
import { withRateLimit } from '@/lib/rate-limit'
import { parseCV } from '@/lib/cv-parser-pipeline'
import { securityCheck } from '@/lib/antivirus'
import { CVParseException } from '@jobsphere/ai/cv-errors'
import { logger } from '@/lib/logger'

export const POST = withRateLimit(
  async (request: NextRequest) => {
    const requestId = crypto.randomUUID()

    try {
      // 1. Optional authentication - works for both logged in and anonymous users
      const session = await auth()
      const userId = session?.user?.id || 'anonymous'

      logger.info('CV upload request', { requestId, userId })

      // 2. Get file from form data
      const formData = await request.formData()
      const file = formData.get('file') as File

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      // 3. Validate file type
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ]
      if (!validTypes.includes(file.type)) {
        return NextResponse.json({
          error: 'Invalid file type',
          code: 'file_invalid_type'
        }, { status: 400 })
      }

      // 4. Get file buffer
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // 5. Security check (antivirus, MIME verification, size check)
      try {
        await securityCheck(buffer, {
          filename: file.name,
          mimeType: file.type,
          fileSize: file.size,
        })
      } catch (error) {
        if (error instanceof CVParseException) {
          logger.warn('Security check failed', { requestId, code: error.code, message: error.message })
          return NextResponse.json({
            error: error.message,
            code: error.code,
            details: error.details,
          }, { status: 400 })
        }
        throw error
      }

      // 6. Upload to Vercel Blob (use timestamp for anonymous users)
      const timestamp = Date.now()
      const blobPath = session?.user?.id
        ? `cvs/${session.user.id}/${file.name}`
        : `cvs/anonymous/${timestamp}-${file.name}`

      const blob = await put(blobPath, file, {
        access: 'public',
        addRandomSuffix: true,
      })

      logger.info('File uploaded to blob', { requestId, blobUrl: blob.url })

      // 7. Parse CV with multi-stage pipeline
      try {
        const parseResult = await parseCV(arrayBuffer, {
          filename: file.name,
          mimeType: file.type,
          fileSize: file.size,
        })

        logger.info('CV parsed successfully', {
          requestId,
          traceId: parseResult.traceId,
          method: parseResult.method,
          extractedLength: parseResult.extractedLength,
          confidence: parseResult.confidence,
        })

        // Return parse result
        return NextResponse.json({
          blobUrl: blob.url,
          rawText: parseResult.text,
          filename: file.name,
          size: file.size,
          extractedLength: parseResult.extractedLength,
          parseMethod: parseResult.method,
          confidence: parseResult.confidence,
          traceId: parseResult.traceId,
          warning: parseResult.error ? {
            code: parseResult.error.code,
            message: parseResult.error.message,
          } : undefined,
        })

      } catch (error) {
        if (error instanceof CVParseException) {
          logger.error('CV parsing failed', { requestId, code: error.code, message: error.message })
          return NextResponse.json({
            error: error.message,
            code: error.code,
            details: error.details,
            hint: 'Try DOCX format instead, or fill form manually',
          }, { status: 400 })
        }
        throw error
      }

    } catch (error) {
      logger.error('CV upload error', { requestId, error })
      return NextResponse.json(
        {
          error: 'Failed to upload CV',
          code: 'internal_error'
        },
        { status: 500 }
      )
    }
  },
  { preset: 'upload', byUser: true } // 10 uploads per 5 minutes
)
