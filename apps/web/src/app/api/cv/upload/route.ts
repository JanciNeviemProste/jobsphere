/**
 * CV Upload API
 * Uploads file to Vercel Blob & extracts text
 */

import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { auth } from '@/lib/auth'
import { withRateLimit } from '@/lib/rate-limit'
import mammoth from 'mammoth'

// PDF text extraction
async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  try {
    // Dynamic import for server-only pdf-parse
    const pdfParse = await import('pdf-parse')
    const data = await (pdfParse as any)(Buffer.from(buffer))
    return data.text
  } catch (error) {
    console.error('PDF parsing error:', error)
    throw new Error('Failed to extract text from PDF. File may be corrupted or password-protected.')
  }
}

// DOCX text extraction
async function extractTextFromDOCX(buffer: ArrayBuffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })

    if (result.messages && result.messages.length > 0) {
      console.warn('DOCX parsing warnings:', result.messages)
    }

    return result.value
  } catch (error) {
    console.error('DOCX parsing error:', error)
    throw new Error('Failed to extract text from DOCX. File may be corrupted.')
  }
}

export const POST = withRateLimit(
  async (request: NextRequest) => {
    try {
      // 1. Optional authentication - works for both logged in and anonymous users
      const session = await auth()
      const userId = session?.user?.id || 'anonymous'

      // 2. Get file from form data
      const formData = await request.formData()
      const file = formData.get('file') as File

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      // 3. Validate file
      const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
      if (!validTypes.includes(file.type)) {
        return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
      }

      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'File too large' }, { status: 400 })
      }

      // 4. Upload to Vercel Blob (use timestamp for anonymous users)
      const timestamp = Date.now()
      const blobPath = session?.user?.id
        ? `cvs/${session.user.id}/${file.name}`
        : `cvs/anonymous/${timestamp}-${file.name}`

      const blob = await put(blobPath, file, {
        access: 'public',
        addRandomSuffix: true,
      })

      // 5. Extract text based on file type
      const arrayBuffer = await file.arrayBuffer()
      let rawText: string

      if (file.type === 'application/pdf') {
        rawText = await extractTextFromPDF(arrayBuffer)
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        rawText = await extractTextFromDOCX(arrayBuffer)
      } else {
        // Plain text
        const decoder = new TextDecoder()
        rawText = decoder.decode(arrayBuffer)
      }

      // Log extracted text length for debugging
      console.log(`Extracted ${rawText.length} characters from ${file.name}`)

      // Check if text extraction failed
      if (rawText.length < 10) {
        console.warn('Very short text extracted. PDF might be image-based or corrupted.')
        return NextResponse.json({
          error: 'Could not extract text from file. PDF might be image-based (scanned). Please use a text-based PDF or DOCX file.',
          extractedLength: rawText.length,
        }, { status: 400 })
      }

      return NextResponse.json({
        blobUrl: blob.url,
        rawText,
        filename: file.name,
        size: file.size,
        extractedLength: rawText.length,
      })

    } catch (error) {
      console.error('CV upload error:', error)
      return NextResponse.json(
        { error: 'Failed to upload CV' },
        { status: 500 }
      )
    }
  },
  { preset: 'upload', byUser: true } // 10 uploads per 5 minutes
)
