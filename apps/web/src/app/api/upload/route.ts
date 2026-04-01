import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { join, resolve, basename } from 'path'
import { randomUUID } from 'crypto'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

// Security: Validate filename to prevent path traversal attacks
function isValidFilename(filename: string): boolean {
  // Only allow UUID-based filenames with valid extensions (our upload format)
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|doc|docx)$/i
  return uuidPattern.test(filename)
}

// Security: Ensure resolved path is within allowed directory
function isPathWithinDirectory(filepath: string, directory: string): boolean {
  const resolvedPath = resolve(filepath)
  const resolvedDirectory = resolve(directory)
  return (
    resolvedPath.startsWith(resolvedDirectory + '\\') ||
    resolvedPath.startsWith(resolvedDirectory + '/')
  )
}

export async function POST(req: Request) {
  try {
    // DEPRECATED: This endpoint uses local filesystem storage which doesn't work on Vercel
    // Use /api/cv/upload instead (Vercel Blob Storage)
    logger.warn('[DEPRECATED] /api/upload is deprecated. Use /api/cv/upload instead.')

    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF, DOC, and DOCX are allowed.' },
        { status: 400 },
      )
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 })
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop()
    const filename = `${randomUUID()}.${fileExtension}`

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'cvs')
    try {
      await mkdir(uploadsDir, { recursive: true })
    } catch (error) {
      // Directory might already exist
    }

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const filepath = join(uploadsDir, filename)
    await writeFile(filepath, buffer)

    // Return public URL
    const url = `/uploads/cvs/${filename}`

    return NextResponse.json(
      {
        url,
        filename: file.name,
        size: file.size,
        type: file.type,
        _deprecated: true,
        _migration: 'Use /api/cv/upload instead for Vercel Blob Storage',
      },
      {
        headers: {
          'X-Deprecated': 'true',
          'X-Deprecation-Message':
            'This endpoint will be removed in v2.0. Use /api/cv/upload instead.',
          'X-Alternative-Endpoint': '/api/cv/upload',
        },
      },
    )
  } catch (error) {
    logger.error('Error uploading file', error)
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const url = searchParams.get('url')

    if (!url) {
      return NextResponse.json({ error: 'No URL provided' }, { status: 400 })
    }

    // Security: Extract and validate filename using basename to prevent path traversal
    const filename = basename(url)

    // Security: Validate filename format (must be UUID.extension)
    if (!filename || !isValidFilename(filename)) {
      return NextResponse.json({ error: 'Invalid filename format' }, { status: 400 })
    }

    // Construct filepath
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'cvs')
    const filepath = join(uploadsDir, filename)

    // Security: Double-check path is within uploads directory (defense in depth)
    if (!isPathWithinDirectory(filepath, uploadsDir)) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
    }

    // Delete file
    await unlink(filepath)

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error deleting file', error)
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}
