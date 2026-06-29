/**
 * CV Storage Abstraction Layer
 * Supports Vercel Blob (production) with fallback to local storage (development)
 */

import { put, del } from '@vercel/blob'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { logger } from './logger'

export interface UploadResult {
  url: string
  path: string
  provider: 'vercel-blob' | 'local'
}

/**
 * Upload CV file to configured storage provider
 *
 * @param file - File to upload
 * @param candidateId - Candidate ID or 'anonymous'
 * @param filename - Original filename
 * @returns Upload result with URL and metadata
 */
export async function uploadCV(
  file: File | Buffer,
  candidateId: string,
  filename: string,
): Promise<UploadResult> {
  const provider = process.env.STORAGE_PROVIDER || 'vercel-blob'
  const timestamp = Date.now()

  // Construct blob path
  const blobPath =
    candidateId !== 'anonymous'
      ? `cvs/${candidateId}/${filename}`
      : `cvs/anonymous/${timestamp}-${filename}`

  if (provider === 'vercel-blob') {
    // Production: Use Vercel Blob
    try {
      // SEC-001 / finding F6: CVs are stored as PRIVATE blobs (privacy at rest).
      // They are read back only by the authenticated /api/cv/{documentId}/download
      // route via the SDK's authenticated get({ access: 'private' }) — never fetched
      // through a plain public URL. `addRandomSuffix` keeps paths unguessable.
      const blob = await put(blobPath, file, {
        access: 'private',
        addRandomSuffix: true,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      })

      const fileSize = file instanceof Buffer ? file.length : (file as File).size

      logger.info('CV uploaded to Vercel Blob', {
        url: blob.url,
        path: blobPath,
        size: fileSize,
      })

      return {
        url: blob.url,
        path: blobPath,
        provider: 'vercel-blob',
      }
    } catch (error) {
      logger.error('Vercel Blob upload failed', { error, path: blobPath })
      throw new Error('Failed to upload file to Vercel Blob')
    }
  } else {
    // Development: Use local storage
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'cvs')
    const userDir = join(uploadsDir, candidateId)

    try {
      // Ensure directory exists
      await mkdir(userDir, { recursive: true })

      // Generate unique filename
      const uniqueFilename = `${timestamp}-${filename}`
      const filePath = join(userDir, uniqueFilename)

      // Write file
      const buffer = file instanceof Buffer ? file : Buffer.from(await (file as File).arrayBuffer())
      await writeFile(filePath, buffer)

      // Construct public URL
      const publicUrl = `/uploads/cvs/${candidateId}/${uniqueFilename}`

      logger.info('CV uploaded to local storage', {
        url: publicUrl,
        path: filePath,
        size: buffer.length,
      })

      return {
        url: publicUrl,
        path: filePath,
        provider: 'local',
      }
    } catch (error) {
      logger.error('Local storage upload failed', { error, path: userDir })
      throw new Error('Failed to upload file to local storage')
    }
  }
}

/**
 * Delete CV file from storage
 *
 * @param url - File URL to delete
 * @returns Success boolean
 */
export async function deleteCV(url: string): Promise<boolean> {
  const provider = process.env.STORAGE_PROVIDER || 'vercel-blob'

  if (provider === 'vercel-blob') {
    try {
      await del(url, {
        token: process.env.BLOB_READ_WRITE_TOKEN,
      })
      logger.info('CV deleted from Vercel Blob', { url })
      return true
    } catch (error) {
      logger.error('Vercel Blob delete failed', { error, url })
      return false
    }
  } else {
    // Local storage: delete file from filesystem
    try {
      const filePath = join(process.cwd(), 'public', url)
      await unlink(filePath)
      logger.info('CV deleted from local storage', { path: filePath })
      return true
    } catch (error) {
      logger.error('Local storage delete failed', { error, url })
      return false
    }
  }
}

/**
 * Get storage provider name
 */
export function getStorageProvider(): 'vercel-blob' | 'local' {
  return (process.env.STORAGE_PROVIDER as 'vercel-blob' | 'local') || 'vercel-blob'
}
