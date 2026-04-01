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
  skipped?: boolean // True if scan was skipped due to unavailability
}

// Security: Determine fail mode - default to CLOSED in production, OPEN in development
function getFailMode(): 'open' | 'closed' {
  const envMode = process.env.ANTIVIRUS_FAIL_MODE?.toLowerCase()
  if (envMode === 'open' || envMode === 'closed') {
    return envMode
  }
  // Default: fail-closed in production, fail-open in development
  return process.env.NODE_ENV === 'production' ? 'closed' : 'open'
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
    const failMode = getFailMode()

    logger.error('ClamAV scan error', { error, scanTime, failMode })

    if (failMode === 'closed') {
      // Security: In fail-closed mode, reject files when AV is unavailable
      logger.error('ClamAV unavailable - rejecting file (fail-closed mode)')
      return {
        clean: false,
        virus: 'ANTIVIRUS_UNAVAILABLE',
        scanTime,
        skipped: true,
      }
    }

    // Fail-open mode (development only) - allow file but log warning
    logger.warn('ClamAV unavailable - allowing file (fail-open mode). DO NOT USE IN PRODUCTION!')
    return { clean: true, scanTime, skipped: true }
  }
}

/**
 * Verify file MIME type matches declared type (prevent extension spoofing)
 */
export async function verifyMimeType(
  buffer: Buffer,
  declaredType: string,
): Promise<{ valid: boolean; actualType?: string }> {
  try {
    // Dynamic import for file-type
    const fileTypeModule = await import('file-type')
    const fileType = await fileTypeModule.fileTypeFromBuffer(buffer)

    if (!fileType) {
      // Unable to detect file type from magic bytes - reject for security
      logger.warn('Unable to detect file type from magic bytes', { declaredType })
      return { valid: false }
    }

    // Normalize MIME types for comparison
    const normalize = (mime: string) => mime.toLowerCase().replace(/\s/g, '')
    const declaredNorm = normalize(declaredType)
    const actualNorm = normalize(fileType.mime)

    // Special cases
    const isDocx = declaredNorm.includes('wordprocessing') && actualNorm === 'application/zip' // DOCX is a zip file

    const isPdf = declaredNorm === 'application/pdf' && actualNorm === 'application/pdf'

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
    const failMode = getFailMode()
    logger.error('MIME verification error', { error, failMode })

    if (failMode === 'closed') {
      // Security: In fail-closed mode, reject files when verification fails
      logger.error('MIME verification failed - rejecting file (fail-closed mode)')
      return { valid: false }
    }

    // Fail-open mode (development only)
    logger.warn(
      'MIME verification failed - allowing file (fail-open mode). DO NOT USE IN PRODUCTION!',
    )
    return { valid: true }
  }
}

/**
 * Comprehensive security check before parsing
 */
export async function securityCheck(
  buffer: Buffer,
  metadata: { filename: string; mimeType: string; fileSize: number },
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
      CVErrors.mimeMismatch(metadata.mimeType, mimeCheck.actualType || 'unknown'),
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
