/**
 * CV Upload API
 * Uploads file to Vercel Blob & extracts text using multi-stage pipeline
 */

export const runtime = 'nodejs' // Required for Node.js-only libraries (clamscan, file-type)

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { withRateLimit } from '@/lib/rate-limit'
import { withCsrfProtection } from '@/lib/csrf'
import { parseCV } from '@/lib/cv-parser-pipeline'
import { securityCheck } from '@/lib/antivirus'
import { uploadCV } from '@/lib/cv-storage'
import { CVParseException } from '@jobsphere/ai'
import { logger } from '@/lib/logger'
import { createHash } from 'crypto'

export const POST = withCsrfProtection<NextRequest>(
  withRateLimit<NextRequest>(
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

        // 3. Validate file type (strict - no text/plain to prevent spoofing)
        const validTypes = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword', // .doc files
        ]
        if (!validTypes.includes(file.type)) {
          return NextResponse.json(
            {
              error: 'Invalid file type. Only PDF and DOC/DOCX files are allowed.',
              code: 'file_invalid_type',
            },
            { status: 400 },
          )
        }

        // 4. Get file buffer
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Compute a content hash so the parse step can persist a CandidateDocument
        // with integrity metadata (and to support dedupe by hash).
        const fileHash = createHash('sha256').update(buffer).digest('hex')

        // 5. Security check (antivirus, MIME verification, size check)
        try {
          await securityCheck(buffer, {
            filename: file.name,
            mimeType: file.type,
            fileSize: file.size,
          })
        } catch (error) {
          if (error instanceof CVParseException) {
            logger.warn('Security check failed', {
              requestId,
              code: error.code,
              message: error.message,
            })
            return NextResponse.json(
              {
                error: error.message,
                code: error.code,
                details: error.details,
              },
              { status: 400 },
            )
          }
          throw error
        }

        // 6. Upload to storage (Vercel Blob or local fallback)
        const candidateId = session?.user?.id || 'anonymous'
        const uploadResult = await uploadCV(file, candidateId, file.name)

        logger.info('File uploaded to storage', {
          requestId,
          url: uploadResult.url,
          provider: uploadResult.provider,
        })

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
            blobUrl: uploadResult.url, // Keep field name for backward compatibility
            url: uploadResult.url,
            storageProvider: uploadResult.provider,
            rawText: parseResult.text,
            filename: file.name,
            mime: file.type,
            size: file.size,
            hash: fileHash,
            extractedLength: parseResult.extractedLength,
            parseMethod: parseResult.method,
            confidence: parseResult.confidence,
            traceId: parseResult.traceId,
            warning: parseResult.error
              ? {
                  code: parseResult.error.code,
                  message: parseResult.error.message,
                }
              : undefined,
          })
        } catch (error) {
          if (error instanceof CVParseException) {
            logger.error('CV parsing failed', {
              requestId,
              code: error.code,
              message: error.message,
            })
            return NextResponse.json(
              {
                error: error.message,
                code: error.code,
                details: error.details,
                hint: 'Try DOCX format instead, or fill form manually',
              },
              { status: 400 },
            )
          }
          throw error
        }
      } catch (error) {
        logger.error('CV upload error', { requestId, error })
        return NextResponse.json(
          {
            error: 'Failed to upload CV',
            code: 'internal_error',
          },
          { status: 500 },
        )
      }
    },
    { preset: 'upload', byUser: true }, // 10 uploads per 5 minutes
  ),
)
