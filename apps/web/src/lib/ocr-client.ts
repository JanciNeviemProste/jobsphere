/**
 * OCR Client - Python Parser Integration
 * Calls Python/Tesseract parser via Docker for OCR fallback
 */

import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { CVErrors } from '@jobsphere/ai'
import { logger } from './logger'

export interface OCRResult {
  text: string
  method: string
  length: number
  success: boolean
  lang?: string
  error?: string
}

/**
 * Map locale to Tesseract language code
 */
function localeToTesseractLang(locale?: string): string {
  const langMap: Record<string, string> = {
    en: 'eng',
    sk: 'slk',
    cs: 'ces',
    de: 'deu',
    pl: 'pol',
  }

  const code = locale?.split('-')[0]?.toLowerCase() || 'en'
  return langMap[code] || 'eng'
}

/**
 * Call Python parser for OCR processing
 */
export async function callPythonOCR(
  buffer: ArrayBuffer,
  metadata: { filename: string; mimeType: string; locale?: string },
  traceId: string
): Promise<OCRResult> {
  const startTime = Date.now()
  const enabled = process.env.ENABLE_OCR !== 'false'

  if (!enabled) {
    logger.info('OCR disabled, skipping', { traceId })
    return {
      text: '',
      method: 'ocr_disabled',
      length: 0,
      success: false,
      error: 'OCR is disabled',
    }
  }

  // Generate unique temp file
  const tempId = `${traceId}-${Date.now()}`
  const ext = metadata.filename.split('.').pop() || 'pdf'
  const tempPath = join(tmpdir(), `cv-${tempId}.${ext}`)

  try {
    // 1. Write buffer to temp file
    await writeFile(tempPath, Buffer.from(buffer))
    logger.debug('Temp file created', { traceId, tempPath })

    // 2. Determine Tesseract language
    const lang = localeToTesseractLang(metadata.locale)

    // 3. Call Python parser via Docker
    const dockerImage = process.env.PYTHON_PARSER_IMAGE || 'jobsphere-python-parser'
    const timeout = parseInt(process.env.OCR_TIMEOUT || '30000') // 30s default

    // Check if running in Docker environment
    const useDocker = process.env.USE_DOCKER_PARSER !== 'false'

    let result: OCRResult

    if (useDocker) {
      // Call via Docker (production/docker-compose environment)
      const { execa } = await import('execa')

      const { stdout, stderr } = await execa(
        'docker',
        [
          'run',
          '--rm',
          '-v',
          `${tempPath}:/input/${tempId}.${ext}`,
          dockerImage,
          '--file',
          `/input/${tempId}.${ext}`,
          '--lang',
          lang,
          '--output-json',
        ],
        { timeout }
      )

      if (stderr) {
        logger.warn('Python parser stderr', { traceId, stderr })
      }

      result = JSON.parse(stdout)
    } else {
      // Direct Python call (development environment)
      logger.info('Using direct Python parser (dev mode)', { traceId })

      const { execa } = await import('execa')
      const parserScript = join(
        process.cwd(),
        '..',
        '..',
        'docker',
        'python-parser',
        'parser.py'
      )

      const { stdout, stderr } = await execa(
        'python',
        [parserScript, '--file', tempPath, '--lang', lang, '--output-json'],
        { timeout }
      )

      if (stderr) {
        logger.warn('Python parser stderr', { traceId, stderr })
      }

      result = JSON.parse(stdout)
    }

    const duration = Date.now() - startTime

    logger.info('OCR processing complete', {
      traceId,
      method: result.method,
      length: result.length,
      duration,
    })

    return result
  } catch (error) {
    const duration = Date.now() - startTime

    logger.error('OCR processing failed', {
      traceId,
      error,
      duration,
    })

    // Return error result instead of throwing
    return {
      text: '',
      method: 'ocr_error',
      length: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown OCR error',
    }
  } finally {
    // Cleanup temp file
    try {
      await unlink(tempPath)
      logger.debug('Temp file deleted', { traceId, tempPath })
    } catch (error) {
      logger.warn('Failed to delete temp file', { traceId, tempPath, error })
    }
  }
}
