/**
 * ClamAV Antivirus Integration
 * Scans files for malware before processing
 */

import { CVErrors, CVParseException } from '@jobsphere/ai'
import { logger } from './logger'

export interface AntivirusResult {
  clean: boolean
  virus?: string
  scanTime: number
}

/**
 * Scan file with ClamAV daemon
 */
export async function scanWithClamAV(buffer: Buffer): Promise<AntivirusResult> {
  const startTime = Date.now()

  // Check if ClamAV is enabled
  const clamavHost = process.env.CLAMAV_HOST || 'localhost'
  const clamavPort = parseInt(process.env.CLAMAV_PORT || '3310')
  const enabled = process.env.ENABLE_ANTIVIRUS !== 'false'

  if (!enabled) {
    logger.debug('ClamAV disabled, skipping scan')
    return { clean: true, scanTime: 0 }
  }

  try {
    // Dynamic import to avoid bundling in environments without ClamAV
    const NodeClam = await import('clamscan')
    const clamscan = await new NodeClam.default().init({
      clamdscan: {
        host: clamavHost,
        port: clamavPort,
      },
      preference: 'clamdscan', // Use daemon (faster)
    })

    // Scan buffer
    const { isInfected, viruses } = await clamscan.scanStream(buffer)

    const scanTime = Date.now() - startTime

    if (isInfected && viruses && viruses.length > 0) {
      logger.warn('Malware detected', { viruses, scanTime })
      return {
        clean: false,
        virus: viruses.join(', '),
        scanTime,
      }
    }

    logger.info('File clean', { scanTime })
    return { clean: true, scanTime }

  } catch (error) {
    const scanTime = Date.now() - startTime
    logger.error('ClamAV scan error', { error, scanTime })

    // Fail open if ClamAV unavailable (log warning but allow file)
    logger.warn('ClamAV unavailable, allowing file (fail-open mode)')
    return { clean: true, scanTime }
  }
}

/**
 * Verify file MIME type matches declared type (prevent extension spoofing)
 */
export async function verifyMimeType(
  buffer: Buffer,
  declaredType: string
): Promise<{ valid: boolean; actualType?: string }> {
  try {
    // Dynamic import for file-type
    const fileTypeModule = await import('file-type')
    const fileType = await fileTypeModule.fileTypeFromBuffer(buffer)

    if (!fileType) {
      // Unable to detect type, allow if it's plain text
      if (declaredType === 'text/plain') {
        return { valid: true }
      }
      logger.warn('Unable to detect file type', { declaredType })
      return { valid: false }
    }

    // Normalize MIME types for comparison
    const normalize = (mime: string) => mime.toLowerCase().replace(/\s/g, '')
    const declaredNorm = normalize(declaredType)
    const actualNorm = normalize(fileType.mime)

    // Special cases
    const isDocx =
      declaredNorm.includes('wordprocessing') &&
      actualNorm === 'application/zip' // DOCX is a zip file

    const isPdf =
      declaredNorm === 'application/pdf' &&
      actualNorm === 'application/pdf'

    const valid = isDocx || isPdf || declaredNorm === actualNorm

    if (!valid) {
      logger.warn('MIME type mismatch', {
        declared: declaredType,
        actual: fileType.mime,
      })
    }

    return {
      valid,
      actualType: fileType.mime,
    }
  } catch (error) {
    logger.error('MIME verification error', { error })
    // Fail open - allow file if verification fails
    return { valid: true }
  }
}

/**
 * Comprehensive security check before parsing
 */
export async function securityCheck(
  buffer: Buffer,
  metadata: { filename: string; mimeType: string; fileSize: number }
): Promise<void> {
  const traceId = crypto.randomUUID()

  logger.info('Security check started', { traceId, ...metadata })

  // 1. File size validation
  const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
  if (metadata.fileSize > maxSize) {
    throw new CVParseException(CVErrors.fileTooLarge(metadata.fileSize, maxSize))
  }

  // 2. MIME type verification
  const mimeCheck = await verifyMimeType(buffer, metadata.mimeType)
  if (!mimeCheck.valid) {
    throw new CVParseException(
      CVErrors.mimeMismatch(metadata.mimeType, mimeCheck.actualType || 'unknown')
    )
  }

  // 3. Antivirus scan
  const avResult = await scanWithClamAV(buffer)
  if (!avResult.clean) {
    throw new CVParseException(CVErrors.malwareDetected(avResult.virus))
  }

  logger.info('Security check passed', {
    traceId,
    scanTime: avResult.scanTime,
    mimeVerified: mimeCheck.valid,
  })
}
