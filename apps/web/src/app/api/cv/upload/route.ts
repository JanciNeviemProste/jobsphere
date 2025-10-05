/**
 * CV Upload API
 * Uploads file to Vercel Blob & extracts text
 */

import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { getServerSession } from 'next-auth'
import { authOptions } from '../../auth/[...nextauth]/route'

// PDF text extraction
async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  // TODO: Integrate pdf-parse library
  // For now, return placeholder
  return '[PDF text extraction - integrate pdf-parse library]'
}

// DOCX text extraction
async function extractTextFromDOCX(buffer: ArrayBuffer): Promise<string> {
  // TODO: Integrate mammoth library
  return '[DOCX text extraction - integrate mammoth library]'
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    // 4. Upload to Vercel Blob
    const blob = await put(`cvs/${session.user.id}/${file.name}`, file, {
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

    return NextResponse.json({
      blobUrl: blob.url,
      rawText,
      filename: file.name,
      size: file.size,
    })

  } catch (error) {
    console.error('CV upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload CV' },
      { status: 500 }
    )
  }
}
