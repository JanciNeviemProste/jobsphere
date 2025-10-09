/**
 * CV Parser Pipeline with Multi-Stage Fallbacks
 * Stage 1: Node.js parsers (pdf-parse, mammoth)
 * Stage 2: OCR fallback (Python/Tesseract)
 * Stage 3: Metadata extraction (graceful degradation)
 */

import { CVParseErrorCode, CVErrors, CVParseException } from '@jobsphere/ai/cv-errors'
import { logger } from './logger'

export interface ParseResult {
  text: string
  method: 'node_pdf' | 'node_docx' | 'ocr_tesseract' | 'metadata_fallback'
  confidence: number
  extractedLength: number
  error?: {
    code: CVParseErrorCode
    message: string
  }
  metadata: {
    filename: string
    mimeType: string
    fileSize: number
    createdAt?: Date
  }
  traceId: string
}

/**
 * PDF text extraction using pdf-parse
 */
async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  try {
    // Dynamic import for server-only pdf-parse
    const pdfParse = await import('pdf-parse')
    const data = await (pdfParse as any).default(Buffer.from(buffer))
    return data.text || ''
  } catch (error) {
    logger.warn('PDF parsing error', { error })
    throw new CVParseException(
      CVErrors.corrupted(error instanceof Error ? error.message : 'PDF parse failed')
    )
  }
}

/**
 * DOCX text extraction using mammoth
 */
async function extractTextFromDOCX(buffer: ArrayBuffer): Promise<string> {
  try {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })

    if (result.messages && result.messages.length > 0) {
      logger.warn('DOCX parsing warnings', { messages: result.messages })
    }

    return result.value || ''
  } catch (error) {
    logger.warn('DOCX parsing error', { error })
    throw new CVParseException(
      CVErrors.corrupted(error instanceof Error ? error.message : 'DOCX parse failed')
    )
  }
}

/**
 * Check if DOCX contains VBA macros (security risk)
 */
async function checkForMacros(buffer: ArrayBuffer): Promise<boolean> {
  try {
    const JSZip = await import('jszip')
    const zip = await JSZip.default.loadAsync(buffer)

    // Check for vbaProject.bin (indicates VBA macros)
    const hasMacros = Object.keys(zip.files).some(
      (filename) => filename.includes('vbaProject.bin')
    )

    return hasMacros
  } catch (error) {
    logger.warn('Macro detection failed', { error })
    return false // Fail open for macro detection
  }
}

// Import OCR client (actual implementation)
import { callPythonOCR as callOCR } from './ocr-client'

/**
 * Extract metadata as fallback when text extraction fails
 */
function extractMetadataFallback(metadata: {
  filename: string
  mimeType: string
  fileSize: number
}): string {
  // Return filename without extension as last resort
  const nameWithoutExt = metadata.filename.replace(/\.[^/.]+$/, '')
  return `Filename: ${nameWithoutExt}\nFile type: ${metadata.mimeType}\nSize: ${metadata.fileSize} bytes`
}

/**
 * Main parsing pipeline with multi-stage fallbacks
 */
export async function parseCV(
  buffer: ArrayBuffer,
  metadata: { filename: string; mimeType: string; fileSize?: number; locale?: string }
): Promise<ParseResult> {
  const traceId = crypto.randomUUID()
  const startTime = Date.now()

  logger.info('CV parse pipeline started', {
    traceId,
    filename: metadata.filename,
    mimeType: metadata.mimeType,
    fileSize: metadata.fileSize || buffer.byteLength
  })

  let text = ''
  let method: ParseResult['method'] = 'node_pdf'
  let confidence = 0.95
  const fileSize = metadata.fileSize || buffer.byteLength

  // Stage 0: Security checks (macros)
  if (metadata.mimeType.includes('wordprocessing')) {
    const hasMacros = await checkForMacros(buffer)
    if (hasMacros) {
      logger.warn('DOCX contains macros - rejected', { traceId })
      throw new CVParseException(CVErrors.hasMacros())
    }
  }

  // Stage 1: Node.js parsers (fast path)
  try {
    if (metadata.mimeType === 'application/pdf') {
      text = await extractTextFromPDF(buffer)
      method = 'node_pdf'
      logger.info('Node.js PDF parser complete', {
        traceId,
        extractedLength: text.length,
        duration: Date.now() - startTime
      })
    } else if (metadata.mimeType.includes('wordprocessing')) {
      text = await extractTextFromDOCX(buffer)
      method = 'node_docx'
      logger.info('Node.js DOCX parser complete', {
        traceId,
        extractedLength: text.length,
        duration: Date.now() - startTime
      })
    }
  } catch (error) {
    if (error instanceof CVParseException) {
      throw error
    }
    logger.warn('Node.js parser failed', { traceId, error })
  }

  // Stage 2: OCR fallback if insufficient text
  if (text.length < 50) {
    logger.info('Triggering OCR fallback', {
      traceId,
      nodeExtractedLength: text.length,
      reason: 'insufficient_text'
    })

    try {
      const ocrResult = await callOCR(buffer, metadata, traceId)

      if (ocrResult.success && ocrResult.text) {
        text = ocrResult.text
        method = 'ocr_tesseract'
        confidence = 0.7 // Lower confidence for OCR

        logger.info('OCR complete', {
          traceId,
          extractedLength: text.length,
          duration: Date.now() - startTime
        })
      } else {
        logger.warn('OCR returned no text', { traceId, error: ocrResult.error })
      }
    } catch (error) {
      logger.error('OCR failed', { traceId, error })
      // Continue to Stage 3
    }
  }

  // Stage 3: Graceful fallback - extract metadata
  if (text.length < 20) {
    logger.warn('Insufficient text after all parsers', {
      traceId,
      finalLength: text.length,
      duration: Date.now() - startTime
    })

    // Return metadata fallback instead of throwing
    const metadataText = extractMetadataFallback({
      filename: metadata.filename,
      mimeType: metadata.mimeType,
      fileSize,
    })

    return {
      text: metadataText,
      method: 'metadata_fallback',
      confidence: 0,
      extractedLength: metadataText.length,
      error: {
        code: CVParseErrorCode.FILE_NO_TEXT,
        message: 'No text extracted after all parsing attempts',
      },
      metadata: {
        filename: metadata.filename,
        mimeType: metadata.mimeType,
        fileSize,
      },
      traceId,
    }
  }

  // Success path
  logger.info('CV parse pipeline complete', {
    traceId,
    method,
    extractedLength: text.length,
    confidence,
    duration: Date.now() - startTime
  })

  return {
    text,
    method,
    confidence,
    extractedLength: text.length,
    metadata: {
      filename: metadata.filename,
      mimeType: metadata.mimeType,
      fileSize,
    },
    traceId,
  }
}
