/**
 * CV Parser Pipeline with Multi-Stage Fallbacks
 * Stage 1: Node.js parsers (pdf-parse, mammoth)
 * Stage 2: OCR fallback (Python/Tesseract)
 * Stage 3: Metadata extraction (graceful degradation)
 */

import { CVParseErrorCode, CVErrors, CVParseException } from '@jobsphere/ai'
import { logger } from './logger'

export interface ParseResult {
  text: string
  method: 'node_pdf' | 'node_docx' | 'ocr_vision' | 'ocr_tesseract' | 'metadata_fallback'
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
    // Import pdf-parse v1 via its inner lib entry (NOT the package index): the index
    // runs debug code that reads a bundled test PDF and throws under webpack, and v2's
    // pdf.js loads external worker/font assets that aren't present in the Vercel
    // serverless bundle (extraction silently returned empty -> metadata fallback).
    // v1's self-contained pdf.js works in the bundle and via this entry.
    // @ts-expect-error pdf-parse v1 inner lib entry ships no type declarations
    const mod: any = await import('pdf-parse/lib/pdf-parse.js')
    const pdfParse = mod.default || mod
    const data = await pdfParse(Buffer.from(buffer))
    return data?.text || ''
  } catch (error) {
    logger.warn('PDF parsing error', { error })
    throw new CVParseException(
      CVErrors.corrupted(error instanceof Error ? error.message : 'PDF parse failed'),
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
      CVErrors.corrupted(error instanceof Error ? error.message : 'DOCX parse failed'),
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

    // Check for vbaProject.bin (indicates VBA macros) — case-insensitive: the OOXML part
    // name is conventionally "word/vbaProject.bin" but a crafted file can vary the casing
    // (VBAProject.bin / vbaproject.bin) to evade a case-sensitive match (SEC-VBA-002).
    const hasMacros = Object.keys(zip.files).some((filename) =>
      filename.toLowerCase().includes('vbaproject.bin'),
    )

    return hasMacros
  } catch (error) {
    logger.warn('Macro detection failed', { error })
    // Fail closed in production — a JSZip crash could be caused by a malformed file
    // designed to bypass detection. Safer to reject and ask user to re-upload.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Failed to scan file for macros. Please re-upload.')
    }
    return false
  }
}

// Import OCR client (actual implementation)
import { callPythonOCR as callOCR } from './ocr-client'
// Multimodal (vision) OCR fallback — works in serverless where Python OCR does not.
import { visionExtractText } from './vision-ocr'

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
  metadata: { filename: string; mimeType: string; fileSize?: number; locale?: string },
): Promise<ParseResult> {
  const traceId = crypto.randomUUID()
  const startTime = Date.now()

  logger.info('CV parse pipeline started', {
    traceId,
    filename: metadata.filename,
    mimeType: metadata.mimeType,
    fileSize: metadata.fileSize || buffer.byteLength,
  })

  let text = ''
  let method: ParseResult['method'] = 'node_pdf'
  let confidence = 0.95
  const fileSize = metadata.fileSize || buffer.byteLength

  // Pre-Stage: File size validation (max 10MB)
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
  if (fileSize > MAX_FILE_SIZE) {
    logger.warn('File size exceeds limit', {
      traceId,
      fileSize,
      maxSize: MAX_FILE_SIZE,
      filename: metadata.filename,
    })
    throw new CVParseException(CVErrors.fileTooLarge(fileSize, MAX_FILE_SIZE))
  }

  // Stage 0: Security checks (macros). Both DOCX (wordprocessingml) and DOCM
  // (vnd.ms-word.document.macroEnabled.12) are zip-based OOXML that can carry VBA;
  // a DOCM previously bypassed this because its MIME has no "wordprocessing" (SEC-VBA-001).
  const macroScanMime = metadata.mimeType.toLowerCase()
  if (macroScanMime.includes('wordprocessing') || macroScanMime.includes('macroenabled')) {
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
        duration: Date.now() - startTime,
      })
    } else if (metadata.mimeType.includes('wordprocessing')) {
      text = await extractTextFromDOCX(buffer)
      method = 'node_docx'
      logger.info('Node.js DOCX parser complete', {
        traceId,
        extractedLength: text.length,
        duration: Date.now() - startTime,
      })
    }
  } catch (error) {
    // Don't re-throw CVParseException - allow fallback to OCR (Stage 2)
    logger.warn('Node.js parser failed - will attempt OCR fallback', {
      traceId,
      error,
      errorType: error instanceof CVParseException ? 'CVParseException' : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    // text remains empty, triggering OCR fallback at line 161
  }

  // Stage 2: OCR fallback if insufficient text
  if (text.length < 50) {
    logger.info('Triggering OCR fallback', {
      traceId,
      nodeExtractedLength: text.length,
      reason: 'insufficient_text',
    })

    // Stage 2a: Vision OCR (multimodal LLM) — reads scanned/image PDFs directly and
    // runs in the serverless environment. Preferred over the Python OCR service.
    try {
      const vision = await visionExtractText(buffer, metadata.mimeType, traceId)
      if (vision.success && vision.text) {
        text = vision.text
        method = 'ocr_vision'
        confidence = vision.confidence ?? 0.6
        logger.info('Vision OCR complete', {
          traceId,
          extractedLength: text.length,
          duration: Date.now() - startTime,
        })
      }
    } catch (error) {
      logger.warn('Vision OCR threw - will try Python OCR', { traceId, error })
    }
  }

  // Stage 2b: Python Tesseract OCR (legacy fallback, e.g. if vision is unavailable)
  if (text.length < 50) {
    try {
      const ocrResult = await callOCR(buffer, metadata, traceId)

      if (ocrResult.success && ocrResult.text) {
        text = ocrResult.text
        method = 'ocr_tesseract'
        // Use OCR's returned confidence, fallback to 0.7 if not provided
        confidence = ocrResult.confidence ?? 0.7

        logger.info('OCR complete', {
          traceId,
          extractedLength: text.length,
          confidence: ocrResult.confidence,
          duration: Date.now() - startTime,
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
      duration: Date.now() - startTime,
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
    duration: Date.now() - startTime,
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
