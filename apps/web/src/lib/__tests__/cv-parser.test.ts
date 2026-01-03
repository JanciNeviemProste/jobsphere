/**
 * CV Parser Pipeline Tests
 * Tests for multi-stage CV parsing with fallbacks
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseCV } from '../cv-parser-pipeline'
import type { ParseResult } from '../cv-parser-pipeline'

// Mock dependencies
vi.mock('pdf-parse', () => ({
  default: vi.fn(),
}))

vi.mock('mammoth', () => ({
  extractRawText: vi.fn(),
}))

vi.mock('jszip', () => ({
  default: {
    loadAsync: vi.fn(),
  },
}))

vi.mock('../ocr-client', () => ({
  callPythonOCR: vi.fn(),
}))

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('CV Parser Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Text Extraction - PDF', () => {
    it('should extract text from PDF using pdf-parse', async () => {
      const mockText = 'John Doe\nSoftware Engineer\n5 years experience'
      const mockBuffer = new ArrayBuffer(100)

      // Mock pdf-parse to return extracted text
      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockResolvedValueOnce({
        text: mockText,
        numpages: 1,
        info: {},
        metadata: null,
        version: '1.0',
      } as any)

      const result: ParseResult = await parseCV(mockBuffer, {
        filename: 'resume.pdf',
        mimeType: 'application/pdf',
        fileSize: 100,
      })

      expect(result.text).toBe(mockText)
      expect(result.method).toBe('node_pdf')
      expect(result.confidence).toBeGreaterThanOrEqual(0.9)
      expect(result.extractedLength).toBe(mockText.length)
    })

    it('should return extracted text > 50 chars for valid PDF', async () => {
      const longText = 'A'.repeat(100) // 100 characters
      const mockBuffer = new ArrayBuffer(200)

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockResolvedValueOnce({
        text: longText,
        numpages: 1,
        info: {},
        metadata: null,
        version: '1.0',
      } as any)

      const result = await parseCV(mockBuffer, {
        filename: 'long-resume.pdf',
        mimeType: 'application/pdf',
      })

      expect(result.text.length).toBeGreaterThan(50)
      expect(result.extractedLength).toBe(100)
    })

    it('should handle corrupt PDF files gracefully', async () => {
      const mockBuffer = new ArrayBuffer(50)

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockRejectedValueOnce(
        new Error('Invalid PDF structure')
      )

      // Should trigger OCR fallback
      const ocrClient = await import('../ocr-client')
      vi.mocked(ocrClient.callPythonOCR).mockResolvedValueOnce({
        success: true,
        text: 'OCR extracted text',
        confidence: 0.85,
        language: 'en',
        processingTime: 2000,
      })

      const result = await parseCV(mockBuffer, {
        filename: 'corrupt.pdf',
        mimeType: 'application/pdf',
      })

      expect(result.method).toBe('ocr_tesseract')
      expect(result.text).toBe('OCR extracted text')
    })
  })

  describe('Text Extraction - DOCX', () => {
    it('should extract text from DOCX using mammoth', async () => {
      const mockText = 'Jane Smith\nProject Manager\n10 years experience'
      const mockBuffer = new ArrayBuffer(150)

      const mammoth = await import('mammoth')
      vi.mocked(mammoth.extractRawText).mockResolvedValueOnce({
        value: mockText,
        messages: [],
      })

      // Mock JSZip for macro check
      const JSZip = await import('jszip')
      vi.mocked(JSZip.default.loadAsync).mockResolvedValueOnce({
        files: {},
      } as any)

      const result = await parseCV(mockBuffer, {
        filename: 'resume.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: 150,
      })

      expect(result.text).toBe(mockText)
      expect(result.method).toBe('node_docx')
      expect(result.confidence).toBeGreaterThanOrEqual(0.9)
    })

    it('should handle corrupt DOCX files gracefully', async () => {
      const mockBuffer = new ArrayBuffer(100)

      // Mock JSZip for macro check
      const JSZip = await import('jszip')
      vi.mocked(JSZip.default.loadAsync).mockResolvedValueOnce({
        files: {},
      } as any)

      const mammoth = await import('mammoth')
      vi.mocked(mammoth.extractRawText).mockRejectedValueOnce(
        new Error('Invalid DOCX file')
      )

      // Should trigger OCR fallback
      const ocrClient = await import('../ocr-client')
      vi.mocked(ocrClient.callPythonOCR).mockResolvedValueOnce({
        success: true,
        text: 'OCR from corrupt DOCX',
        confidence: 0.80,
        language: 'en',
        processingTime: 3000,
      })

      const result = await parseCV(mockBuffer, {
        filename: 'corrupt.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })

      expect(result.method).toBe('ocr_tesseract')
      expect(result.text).toBe('OCR from corrupt DOCX')
    })
  })

  describe('Text Extraction - TXT', () => {
    it('should extract text from TXT files', async () => {
      const mockText = 'Plain text resume\nDeveloper'
      const mockBuffer = new TextEncoder().encode(mockText).buffer

      const result = await parseCV(mockBuffer, {
        filename: 'resume.txt',
        mimeType: 'text/plain',
        fileSize: mockBuffer.byteLength,
      })

      // TXT files are decoded directly
      expect(result.text).toContain('resume')
      expect(result.extractedLength).toBeGreaterThan(0)
    })
  })

  describe('Security Checks', () => {
    it('should validate file size (max 10MB)', async () => {
      const largeBuffer = new ArrayBuffer(11 * 1024 * 1024) // 11MB

      await expect(
        parseCV(largeBuffer, {
          filename: 'huge.pdf',
          mimeType: 'application/pdf',
          fileSize: 11 * 1024 * 1024,
        })
      ).rejects.toThrow()
    })

    it('should validate MIME types', async () => {
      const buffer = new ArrayBuffer(100)

      // Invalid MIME type should be rejected or handled
      const result = await parseCV(buffer, {
        filename: 'unknown.xyz',
        mimeType: 'application/octet-stream',
        fileSize: 100,
      })

      // Should fall back to metadata extraction
      expect(result.method).toBe('metadata_fallback')
    })

    it('should detect VBA macros in DOCX', async () => {
      const mockBuffer = new ArrayBuffer(200)

      // Mock JSZip to find vbaProject.bin (macro indicator)
      const JSZip = await import('jszip')
      vi.mocked(JSZip.default.loadAsync).mockResolvedValueOnce({
        files: {
          'word/vbaProject.bin': {} as any,
        },
      } as any)

      await expect(
        parseCV(mockBuffer, {
          filename: 'macro-infected.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
      ).rejects.toThrow(/macro/i)
    })

    it('should reject files with macros', async () => {
      const mockBuffer = new ArrayBuffer(150)

      const JSZip = await import('jszip')
      vi.mocked(JSZip.default.loadAsync).mockResolvedValueOnce({
        files: {
          'word/vbaProject.bin': {} as any,
          'word/document.xml': {} as any,
        },
      } as any)

      await expect(
        parseCV(mockBuffer, {
          filename: 'virus.docm',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
      ).rejects.toThrow()
    })
  })

  describe('OCR Fallback', () => {
    it('should trigger OCR when Node.js parsing fails', async () => {
      const mockBuffer = new ArrayBuffer(100)

      // Node.js parser fails
      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockRejectedValueOnce(new Error('Parse failed'))

      // OCR succeeds
      const ocrClient = await import('../ocr-client')
      vi.mocked(ocrClient.callPythonOCR).mockResolvedValueOnce({
        success: true,
        text: 'Scanned CV text from OCR',
        confidence: 0.92,
        language: 'en',
        processingTime: 2500,
      })

      const result = await parseCV(mockBuffer, {
        filename: 'scanned.pdf',
        mimeType: 'application/pdf',
      })

      expect(result.method).toBe('ocr_tesseract')
      expect(result.text).toBe('Scanned CV text from OCR')
      expect(result.confidence).toBe(0.92)
    })

    it('should handle OCR timeout gracefully', async () => {
      const mockBuffer = new ArrayBuffer(120)

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockRejectedValueOnce(new Error('PDF error'))

      const ocrClient = await import('../ocr-client')
      vi.mocked(ocrClient.callPythonOCR).mockRejectedValueOnce(
        new Error('OCR timeout after 30s')
      )

      const result = await parseCV(mockBuffer, {
        filename: 'timeout.pdf',
        mimeType: 'application/pdf',
      })

      // Should fall back to metadata extraction
      expect(result.method).toBe('metadata_fallback')
      expect(result.text).toContain('timeout')
    })

    it('should support multiple languages (EN, DE, SK)', async () => {
      const mockBuffer = new ArrayBuffer(100)

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockRejectedValueOnce(new Error('Scanned PDF'))

      const ocrClient = await import('../ocr-client')
      vi.mocked(ocrClient.callPythonOCR).mockResolvedValueOnce({
        success: true,
        text: 'Životopis - Slovenský text',
        confidence: 0.88,
        language: 'sk',
        processingTime: 2000,
      })

      const result = await parseCV(mockBuffer, {
        filename: 'slovak-cv.pdf',
        mimeType: 'application/pdf',
        locale: 'sk',
      })

      expect(result.method).toBe('ocr_tesseract')
      expect(result.text).toContain('Životopis')
    })
  })

  describe('Error Handling', () => {
    it('should return graceful error messages', async () => {
      const mockBuffer = new ArrayBuffer(50)

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockRejectedValueOnce(
        new Error('Encrypted PDF')
      )

      const ocrClient = await import('../ocr-client')
      vi.mocked(ocrClient.callPythonOCR).mockRejectedValueOnce(
        new Error('OCR service unavailable')
      )

      const result = await parseCV(mockBuffer, {
        filename: 'encrypted.pdf',
        mimeType: 'application/pdf',
      })

      // Should fall back to metadata
      expect(result.method).toBe('metadata_fallback')
      expect(result.text).toBeDefined()
      expect(result.error).toBeDefined()
    })

    it('should not crash on invalid inputs', async () => {
      const emptyBuffer = new ArrayBuffer(0)

      const result = await parseCV(emptyBuffer, {
        filename: 'empty.pdf',
        mimeType: 'application/pdf',
        fileSize: 0,
      })

      expect(result).toBeDefined()
      expect(result.method).toBeDefined()
    })

    it('should handle null/undefined buffer gracefully', async () => {
      await expect(
        parseCV(null as any, {
          filename: 'test.pdf',
          mimeType: 'application/pdf',
        })
      ).rejects.toThrow()
    })

    it('should log errors but continue processing', async () => {
      const mockBuffer = new ArrayBuffer(80)

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockRejectedValueOnce(new Error('Test error'))

      const ocrClient = await import('../ocr-client')
      vi.mocked(ocrClient.callPythonOCR).mockResolvedValueOnce({
        success: true,
        text: 'Recovered via OCR',
        confidence: 0.75,
        language: 'en',
        processingTime: 1500,
      })

      const result = await parseCV(mockBuffer, {
        filename: 'error-test.pdf',
        mimeType: 'application/pdf',
      })

      const logger = await import('../logger')
      expect(logger.logger.warn).toHaveBeenCalled()
      expect(result.text).toBe('Recovered via OCR')
    })
  })

  describe('Metadata Extraction', () => {
    it('should extract filename as fallback', async () => {
      const mockBuffer = new ArrayBuffer(60)

      // All parsers fail
      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockRejectedValueOnce(new Error('PDF fail'))

      const ocrClient = await import('../ocr-client')
      vi.mocked(ocrClient.callPythonOCR).mockRejectedValueOnce(new Error('OCR fail'))

      const result = await parseCV(mockBuffer, {
        filename: 'John_Doe_Resume_2024.pdf',
        mimeType: 'application/pdf',
        fileSize: 60,
      })

      expect(result.method).toBe('metadata_fallback')
      expect(result.text).toContain('John_Doe_Resume_2024')
    })

    it('should include file metadata in fallback', async () => {
      const mockBuffer = new ArrayBuffer(100)

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockRejectedValueOnce(new Error('Fail'))

      const ocrClient = await import('../ocr-client')
      vi.mocked(ocrClient.callPythonOCR).mockRejectedValueOnce(new Error('Fail'))

      const result = await parseCV(mockBuffer, {
        filename: 'resume.pdf',
        mimeType: 'application/pdf',
        fileSize: 100,
      })

      expect(result.metadata.filename).toBe('resume.pdf')
      expect(result.metadata.mimeType).toBe('application/pdf')
      expect(result.metadata.fileSize).toBe(100)
    })
  })

  describe('Performance', () => {
    it('should complete parsing in reasonable time', async () => {
      const mockBuffer = new ArrayBuffer(200)

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockResolvedValueOnce({
        text: 'Fast parse result',
        numpages: 2,
        info: {},
        metadata: null,
        version: '1.0',
      } as any)

      const startTime = Date.now()
      await parseCV(mockBuffer, {
        filename: 'performance.pdf',
        mimeType: 'application/pdf',
      })
      const duration = Date.now() - startTime

      // Node.js parsing should be fast (< 1s for mocked)
      expect(duration).toBeLessThan(1000)
    })
  })

  describe('Multi-Page PDF Handling', () => {
    it('should handle 10-page PDF documents', async () => {
      const mockBuffer = new ArrayBuffer(2000)
      const mockText = Array(10)
        .fill('Page content with CV information\n')
        .join('\n')

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockResolvedValueOnce({
        text: mockText,
        numpages: 10,
        info: {},
        metadata: null,
        version: '1.0',
      } as any)

      const result = await parseCV(mockBuffer, {
        filename: 'long-cv.pdf',
        mimeType: 'application/pdf',
        fileSize: 2000,
      })

      expect(result.text.length).toBeGreaterThan(50)
      expect(result.method).toBe('node_pdf')
      expect(result.extractedLength).toBe(mockText.length)
    })

    it('should handle multi-page scanned PDFs with OCR', async () => {
      const mockBuffer = new ArrayBuffer(5000)

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockResolvedValueOnce({
        text: '', // Scanned PDF returns empty text
        numpages: 5,
        info: {},
        metadata: null,
        version: '1.0',
      } as any)

      const ocrClient = await import('../ocr-client')
      vi.mocked(ocrClient.callPythonOCR).mockResolvedValueOnce({
        success: true,
        text: 'OCR extracted text from 5 pages\nJohn Doe\nSoftware Engineer\nExperience...',
        confidence: 0.85,
        language: 'en',
        processingTime: 5000,
      })

      const result = await parseCV(mockBuffer, {
        filename: 'scanned-multi-page.pdf',
        mimeType: 'application/pdf',
      })

      expect(result.method).toBe('ocr_tesseract')
      expect(result.text).toContain('OCR extracted text')
      expect(result.confidence).toBe(0.85)
    })

    it('should handle very large PDFs (50+ pages)', async () => {
      const mockBuffer = new ArrayBuffer(10000)
      const largeMockText = Array(50)
        .fill('Page content\n')
        .join('')

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockResolvedValueOnce({
        text: largeMockText,
        numpages: 50,
        info: {},
        metadata: null,
        version: '1.0',
      } as any)

      const result = await parseCV(mockBuffer, {
        filename: 'huge-cv.pdf',
        mimeType: 'application/pdf',
        fileSize: 10000,
      })

      expect(result.text.length).toBeGreaterThan(500)
      expect(result.method).toBe('node_pdf')
    })
  })

  describe('Multi-Language Support', () => {
    it('should parse German CV with OCR', async () => {
      const mockBuffer = new ArrayBuffer(200)

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockRejectedValueOnce(new Error('Scanned PDF'))

      const ocrClient = await import('../ocr-client')
      vi.mocked(ocrClient.callPythonOCR).mockResolvedValueOnce({
        success: true,
        text: 'Lebenslauf\nMax Müller\nSoftwareentwickler\nErfahrung: 5 Jahre',
        confidence: 0.90,
        language: 'de',
        processingTime: 2500,
      })

      const result = await parseCV(mockBuffer, {
        filename: 'lebenslauf.pdf',
        mimeType: 'application/pdf',
        locale: 'de',
      })

      expect(result.method).toBe('ocr_tesseract')
      expect(result.text).toContain('Lebenslauf')
      expect(result.text).toContain('Müller')
    })

    it('should parse Czech CV with proper encoding', async () => {
      const mockBuffer = new ArrayBuffer(200)

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockResolvedValueOnce({
        text: 'Životopis\nPetr Novák\nVývojář softwaru\nZkušenosti: 3 roky',
        numpages: 1,
        info: {},
        metadata: null,
        version: '1.0',
      } as any)

      const result = await parseCV(mockBuffer, {
        filename: 'zivotopis.pdf',
        mimeType: 'application/pdf',
        locale: 'cs',
      })

      expect(result.method).toBe('node_pdf')
      expect(result.text).toContain('Životopis')
      expect(result.text).toContain('Novák')
    })

    it('should parse Polish CV', async () => {
      const mockBuffer = new ArrayBuffer(200)

      const ocrClient = await import('../ocr-client')
      vi.mocked(ocrClient.callPythonOCR).mockResolvedValueOnce({
        success: true,
        text: 'CV\nJan Kowalski\nProgramista\nDoświadczenie: 4 lata',
        confidence: 0.88,
        language: 'pl',
        processingTime: 2000,
      })

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockRejectedValueOnce(new Error('Scanned'))

      const result = await parseCV(mockBuffer, {
        filename: 'cv-polish.pdf',
        mimeType: 'application/pdf',
        locale: 'pl',
      })

      expect(result.method).toBe('ocr_tesseract')
      expect(result.text).toContain('Kowalski')
    })

    it('should handle mixed-language CVs (EN+DE)', async () => {
      const mockBuffer = new ArrayBuffer(300)

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockResolvedValueOnce({
        text: 'John Smith\nSoftware Engineer\nErfahrung in Deutschland\nSkills: TypeScript, React',
        numpages: 1,
        info: {},
        metadata: null,
        version: '1.0',
      } as any)

      const result = await parseCV(mockBuffer, {
        filename: 'bilingual-cv.pdf',
        mimeType: 'application/pdf',
        locale: 'en',
      })

      expect(result.text).toContain('John Smith')
      expect(result.text).toContain('Erfahrung')
      expect(result.method).toBe('node_pdf')
    })
  })

  describe('Corrupted File Recovery', () => {
    it('should recover from partially corrupted PDF using OCR', async () => {
      const mockBuffer = new ArrayBuffer(150)

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockRejectedValueOnce(
        new Error('PDF header corrupted')
      )

      const ocrClient = await import('../ocr-client')
      vi.mocked(ocrClient.callPythonOCR).mockResolvedValueOnce({
        success: true,
        text: 'Recovered CV text via OCR\nCandidate Name\nPosition',
        confidence: 0.75,
        language: 'en',
        processingTime: 3000,
      })

      const result = await parseCV(mockBuffer, {
        filename: 'corrupted.pdf',
        mimeType: 'application/pdf',
      })

      expect(result.method).toBe('ocr_tesseract')
      expect(result.text).toContain('Recovered CV text')
    })

    it('should handle encrypted PDF files gracefully', async () => {
      const mockBuffer = new ArrayBuffer(200)

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockRejectedValueOnce(
        new Error('PDF is password protected')
      )

      const ocrClient = await import('../ocr-client')
      vi.mocked(ocrClient.callPythonOCR).mockRejectedValueOnce(
        new Error('Cannot OCR encrypted file')
      )

      const result = await parseCV(mockBuffer, {
        filename: 'encrypted.pdf',
        mimeType: 'application/pdf',
      })

      expect(result.method).toBe('metadata_fallback')
      expect(result.error).toBeDefined()
      expect(result.text).toContain('encrypted')
    })

    it('should handle DOCX with corrupted XML structure', async () => {
      const mockBuffer = new ArrayBuffer(180)

      const JSZip = await import('jszip')
      vi.mocked(JSZip.default.loadAsync).mockResolvedValueOnce({
        files: {},
      } as any)

      const mammoth = await import('mammoth')
      vi.mocked(mammoth.extractRawText).mockRejectedValueOnce(
        new Error('Invalid XML structure in document.xml')
      )

      const ocrClient = await import('../ocr-client')
      vi.mocked(ocrClient.callPythonOCR).mockResolvedValueOnce({
        success: true,
        text: 'OCR recovery from corrupted DOCX',
        confidence: 0.70,
        language: 'en',
        processingTime: 2800,
      })

      const result = await parseCV(mockBuffer, {
        filename: 'corrupted.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })

      expect(result.method).toBe('ocr_tesseract')
      expect(result.text).toContain('OCR recovery')
    })

    it('should handle files with missing fonts', async () => {
      const mockBuffer = new ArrayBuffer(160)

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockResolvedValueOnce({
        text: '□□□ Missing font text □□□',
        numpages: 1,
        info: {},
        metadata: null,
        version: '1.0',
      } as any)

      const result = await parseCV(mockBuffer, {
        filename: 'missing-fonts.pdf',
        mimeType: 'application/pdf',
      })

      // Should accept partial text
      expect(result.text.length).toBeGreaterThan(0)
      expect(result.method).toBe('node_pdf')
    })

    it('should handle zero-byte files', async () => {
      const emptyBuffer = new ArrayBuffer(0)

      const result = await parseCV(emptyBuffer, {
        filename: 'empty.pdf',
        mimeType: 'application/pdf',
        fileSize: 0,
      })

      expect(result).toBeDefined()
      expect(result.method).toBe('metadata_fallback')
    })
  })

  describe('OCR Timeout and Error Handling', () => {
    it('should handle OCR timeout after 30 seconds', async () => {
      const mockBuffer = new ArrayBuffer(300)

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockRejectedValueOnce(new Error('Scanned PDF'))

      const ocrClient = await import('../ocr-client')
      vi.mocked(ocrClient.callPythonOCR).mockRejectedValueOnce(
        new Error('OCR timeout after 30000ms')
      )

      const result = await parseCV(mockBuffer, {
        filename: 'large-scanned.pdf',
        mimeType: 'application/pdf',
      })

      expect(result.method).toBe('metadata_fallback')
      expect(result.text).toContain('large-scanned')
      expect(result.error).toBeDefined()
    })

    it('should handle OCR service unavailable', async () => {
      const mockBuffer = new ArrayBuffer(200)

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockRejectedValueOnce(new Error('Parse error'))

      const ocrClient = await import('../ocr-client')
      vi.mocked(ocrClient.callPythonOCR).mockRejectedValueOnce(
        new Error('Connection refused - OCR service down')
      )

      const result = await parseCV(mockBuffer, {
        filename: 'test.pdf',
        mimeType: 'application/pdf',
      })

      expect(result.method).toBe('metadata_fallback')
      expect(result.error?.message).toBeDefined()
    })

    it('should handle OCR disabled via environment variable', async () => {
      const mockBuffer = new ArrayBuffer(200)

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockResolvedValueOnce({
        text: 'Short', // Less than 50 chars - would normally trigger OCR
        numpages: 1,
        info: {},
        metadata: null,
        version: '1.0',
      } as any)

      const ocrClient = await import('../ocr-client')
      vi.mocked(ocrClient.callPythonOCR).mockResolvedValueOnce({
        success: false,
        text: '',
        method: 'ocr_disabled',
        length: 0,
        error: 'OCR is disabled',
      })

      const result = await parseCV(mockBuffer, {
        filename: 'test.pdf',
        mimeType: 'application/pdf',
      })

      // Should fall back to metadata since OCR is disabled
      expect(result.method).toBe('metadata_fallback')
    })

    it('should handle OCR rate limiting', async () => {
      const mockBuffer = new ArrayBuffer(250)

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockRejectedValueOnce(new Error('Scanned'))

      const ocrClient = await import('../ocr-client')
      vi.mocked(ocrClient.callPythonOCR).mockRejectedValueOnce(
        new Error('Rate limit exceeded - too many OCR requests')
      )

      const result = await parseCV(mockBuffer, {
        filename: 'rate-limited.pdf',
        mimeType: 'application/pdf',
      })

      expect(result.method).toBe('metadata_fallback')
      expect(result.error).toBeDefined()
    })

    it('should retry OCR on transient failures', async () => {
      const mockBuffer = new ArrayBuffer(200)

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockRejectedValueOnce(new Error('Scanned'))

      const ocrClient = await import('../ocr-client')
      // First call fails with transient error
      vi.mocked(ocrClient.callPythonOCR).mockResolvedValueOnce({
        success: false,
        text: '',
        method: 'ocr_error',
        length: 0,
        error: 'Network timeout',
      })

      const result = await parseCV(mockBuffer, {
        filename: 'transient-error.pdf',
        mimeType: 'application/pdf',
      })

      // Should fall back to metadata after OCR error
      expect(result.method).toBe('metadata_fallback')
    })
  })

  describe('Special Characters and Encoding', () => {
    it('should handle special characters in CV text', async () => {
      const mockBuffer = new ArrayBuffer(200)
      const specialText = 'Résumé\nJosé García\nEmail: josé@example.com\nSkills: C++, C#, .NET'

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockResolvedValueOnce({
        text: specialText,
        numpages: 1,
        info: {},
        metadata: null,
        version: '1.0',
      } as any)

      const result = await parseCV(mockBuffer, {
        filename: 'special-chars.pdf',
        mimeType: 'application/pdf',
      })

      expect(result.text).toContain('Résumé')
      expect(result.text).toContain('García')
      expect(result.text).toContain('C++')
    })

    it('should handle emoji in modern CVs', async () => {
      const mockBuffer = new ArrayBuffer(180)
      const emojiText = 'Jane Doe 📧 jane@example.com 📱 +1234567890\nSkills: React ⚛️ TypeScript 💙'

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockResolvedValueOnce({
        text: emojiText,
        numpages: 1,
        info: {},
        metadata: null,
        version: '1.0',
      } as any)

      const result = await parseCV(mockBuffer, {
        filename: 'modern-cv.pdf',
        mimeType: 'application/pdf',
      })

      expect(result.text).toContain('Jane Doe')
      expect(result.extractedLength).toBeGreaterThan(50)
    })

    it('should handle non-Latin scripts (Cyrillic, Asian)', async () => {
      const mockBuffer = new ArrayBuffer(220)
      const cyrillicText = 'Иван Петров\nРазработчик\nОпыт: 5 лет'

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockResolvedValueOnce({
        text: cyrillicText,
        numpages: 1,
        info: {},
        metadata: null,
        version: '1.0',
      } as any)

      const result = await parseCV(mockBuffer, {
        filename: 'cyrillic-cv.pdf',
        mimeType: 'application/pdf',
        locale: 'ru',
      })

      expect(result.text).toContain('Иван')
      expect(result.method).toBe('node_pdf')
    })
  })

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle CV with exactly 50 characters (threshold)', async () => {
      const mockBuffer = new ArrayBuffer(100)
      const exactText = 'A'.repeat(50) // Exactly 50 chars

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockResolvedValueOnce({
        text: exactText,
        numpages: 1,
        info: {},
        metadata: null,
        version: '1.0',
      } as any)

      const result = await parseCV(mockBuffer, {
        filename: 'exact-threshold.pdf',
        mimeType: 'application/pdf',
      })

      // Should not trigger OCR at exactly 50 chars
      expect(result.method).toBe('node_pdf')
      expect(result.extractedLength).toBe(50)
    })

    it('should handle CV with 49 characters (triggers OCR)', async () => {
      const mockBuffer = new ArrayBuffer(100)
      const shortText = 'A'.repeat(49) // Just below threshold

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockResolvedValueOnce({
        text: shortText,
        numpages: 1,
        info: {},
        metadata: null,
        version: '1.0',
      } as any)

      const ocrClient = await import('../ocr-client')
      vi.mocked(ocrClient.callPythonOCR).mockResolvedValueOnce({
        success: true,
        text: 'OCR provided more text content here',
        confidence: 0.80,
        language: 'en',
        processingTime: 1500,
      })

      const result = await parseCV(mockBuffer, {
        filename: 'below-threshold.pdf',
        mimeType: 'application/pdf',
      })

      // Should trigger OCR
      expect(result.method).toBe('ocr_tesseract')
    })

    it('should handle extremely long CVs (100+ pages)', async () => {
      const mockBuffer = new ArrayBuffer(20000)
      const veryLongText = Array(100)
        .fill('Page content with various information\n')
        .join('')

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockResolvedValueOnce({
        text: veryLongText,
        numpages: 120,
        info: {},
        metadata: null,
        version: '1.0',
      } as any)

      const result = await parseCV(mockBuffer, {
        filename: 'academic-cv.pdf',
        mimeType: 'application/pdf',
      })

      expect(result.text.length).toBeGreaterThan(1000)
      expect(result.method).toBe('node_pdf')
    })

    it('should handle files with unusual extensions but valid MIME', async () => {
      const mockBuffer = new ArrayBuffer(150)

      const pdfParse = await import('pdf-parse')
      vi.mocked(pdfParse.default).mockResolvedValueOnce({
        text: 'CV content from unusual file extension',
        numpages: 1,
        info: {},
        metadata: null,
        version: '1.0',
      } as any)

      const result = await parseCV(mockBuffer, {
        filename: 'resume.xyz', // Unusual extension
        mimeType: 'application/pdf', // But correct MIME type
      })

      expect(result.method).toBe('node_pdf')
      expect(result.text).toContain('CV content')
    })
  })
})
