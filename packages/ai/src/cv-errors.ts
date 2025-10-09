/**
 * CV Parsing Error Taxonomy
 * Comprehensive error codes for all CV upload/parse failures
 */

export enum CVParseErrorCode {
  // File validation errors
  FILE_TOO_LARGE = 'file_too_large',
  FILE_INVALID_TYPE = 'file_invalid_type',
  MIME_MISMATCH = 'mime_type_mismatch',

  // Security errors
  FILE_MALWARE = 'file_malware_detected',
  FILE_HAS_MACROS = 'file_has_macros',

  // Content errors
  FILE_ENCRYPTED = 'file_encrypted',
  FILE_CORRUPTED = 'file_corrupted',
  FILE_NO_TEXT = 'file_no_text_after_ocr',
  FILE_EMPTY = 'file_empty',

  // Processing errors
  PARSE_TIMEOUT = 'parse_timeout',
  OCR_FAILED = 'ocr_failed',
  AI_PROVIDER_FAILED = 'ai_provider_failed',

  // System errors
  ANTIVIRUS_UNAVAILABLE = 'antivirus_unavailable',
  STORAGE_FAILED = 'storage_failed',
  QUEUE_FAILED = 'queue_failed',
}

export interface CVParseError {
  code: CVParseErrorCode
  message: string
  details?: Record<string, any>
  recoverable: boolean
}

export class CVParseException extends Error {
  public readonly code: CVParseErrorCode
  public readonly details?: Record<string, any>
  public readonly recoverable: boolean

  constructor(error: CVParseError) {
    super(error.message)
    this.name = 'CVParseException'
    this.code = error.code
    this.details = error.details
    this.recoverable = error.recoverable
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      recoverable: this.recoverable,
    }
  }
}

/**
 * Error factory helpers
 */
export const CVErrors = {
  fileTooLarge: (size: number, maxSize: number): CVParseError => ({
    code: CVParseErrorCode.FILE_TOO_LARGE,
    message: `File size ${size} bytes exceeds maximum ${maxSize} bytes`,
    details: { size, maxSize },
    recoverable: false,
  }),

  invalidType: (type: string, allowed: string[]): CVParseError => ({
    code: CVParseErrorCode.FILE_INVALID_TYPE,
    message: `File type ${type} not allowed`,
    details: { type, allowed },
    recoverable: false,
  }),

  mimeMismatch: (declared: string, actual: string): CVParseError => ({
    code: CVParseErrorCode.MIME_MISMATCH,
    message: `File MIME type mismatch: declared ${declared}, actual ${actual}`,
    details: { declared, actual },
    recoverable: false,
  }),

  malwareDetected: (virus?: string): CVParseError => ({
    code: CVParseErrorCode.FILE_MALWARE,
    message: `Malware detected: ${virus || 'unknown threat'}`,
    details: { virus },
    recoverable: false,
  }),

  hasMacros: (): CVParseError => ({
    code: CVParseErrorCode.FILE_HAS_MACROS,
    message: 'Document contains macros (VBA code) which are not allowed',
    recoverable: false,
  }),

  encrypted: (): CVParseError => ({
    code: CVParseErrorCode.FILE_ENCRYPTED,
    message: 'File is password-protected or encrypted',
    recoverable: false,
  }),

  corrupted: (reason?: string): CVParseError => ({
    code: CVParseErrorCode.FILE_CORRUPTED,
    message: `File is corrupted or invalid: ${reason || 'unknown'}`,
    details: { reason },
    recoverable: false,
  }),

  noText: (extractedLength: number, method: string): CVParseError => ({
    code: CVParseErrorCode.FILE_NO_TEXT,
    message: `No text extracted after ${method} (extracted: ${extractedLength} chars)`,
    details: { extractedLength, method },
    recoverable: false,
  }),

  parseTimeout: (duration: number, maxDuration: number): CVParseError => ({
    code: CVParseErrorCode.PARSE_TIMEOUT,
    message: `Parse timeout: ${duration}ms exceeded maximum ${maxDuration}ms`,
    details: { duration, maxDuration },
    recoverable: true,
  }),

  ocrFailed: (error: string): CVParseError => ({
    code: CVParseErrorCode.OCR_FAILED,
    message: `OCR processing failed: ${error}`,
    details: { error },
    recoverable: true,
  }),

  aiProviderFailed: (errors: string[]): CVParseError => ({
    code: CVParseErrorCode.AI_PROVIDER_FAILED,
    message: `All AI providers failed: ${errors.join(', ')}`,
    details: { errors },
    recoverable: true,
  }),
}
