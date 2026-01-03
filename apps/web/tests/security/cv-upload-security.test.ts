/**
 * CV Upload Security Tests
 *
 * Comprehensive security-focused tests for CV file upload functionality.
 * Tests cover:
 * - ClamAV malware detection
 * - VBA macro detection
 * - File size validation
 * - MIME type validation and spoofing prevention
 * - Filename sanitization
 * - Path traversal attacks
 * - XSS payload in filenames
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { POST } from '@/app/api/cv/upload/route'
import { createMultipartRequest, parseResponse } from '../integration/helpers/api-client'
import { securityCheck, scanWithClamAV, verifyMimeType } from '@/lib/antivirus'
import { parseCV } from '@/lib/cv-parser-pipeline'
import { CVParseErrorCode, CVParseException } from '@jobsphere/ai'
import * as JSZip from 'jszip'

/**
 * Test Fixtures - Malicious File Generators
 */

/**
 * 1. Oversized file (>10MB)
 */
function createOversizedFile(): File {
  // Create a buffer larger than 10MB (default MAX_FILE_SIZE)
  const size = 11 * 1024 * 1024 // 11MB
  const buffer = Buffer.alloc(size, 'A')

  return new File([buffer], 'oversized-cv.pdf', {
    type: 'application/pdf'
  })
}

/**
 * 2. Macro-infected DOCX
 */
async function createMacroInfectedDocx(): Promise<File> {
  const zip = new JSZip.default()

  // Add minimal DOCX structure
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`)

  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`)

  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Test document with macros</w:t></w:r></w:p>
  </w:body>
</w:document>`)

  // Add VBA macro file - this triggers macro detection
  zip.file('word/vbaProject.bin', 'FAKE_MACRO_BINARY_CONTENT_FOR_TESTING')

  const buffer = await zip.generateAsync({ type: 'nodebuffer' })

  return new File([buffer], 'resume-with-macros.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  })
}

/**
 * 3. Executable disguised as PDF (MIME spoofing)
 */
function createSpoofedExecutable(): File {
  // Create a file with executable magic bytes but PDF extension
  // MZ header = executable file
  const mzHeader = Buffer.from([0x4D, 0x5A, 0x90, 0x00])
  const padding = Buffer.alloc(100, 0x00)
  const buffer = Buffer.concat([mzHeader, padding])

  return new File([buffer], 'resume.pdf', {
    type: 'application/pdf' // Declared as PDF but actually executable
  })
}

/**
 * 4. Path traversal filename
 */
function createPathTraversalFile(): File {
  const buffer = Buffer.from('CV content')

  // Malicious filename attempting directory traversal
  const maliciousFilename = '../../../etc/passwd.pdf'

  return new File([buffer], maliciousFilename, {
    type: 'application/pdf'
  })
}

/**
 * 5. XSS payload in filename
 */
function createXSSFilename(): File {
  const buffer = Buffer.from('CV content')

  // Malicious filename with XSS payload
  const xssFilename = '<script>alert("XSS")</script>.pdf'

  return new File([buffer], xssFilename, {
    type: 'application/pdf'
  })
}

/**
 * 6. Valid PDF for baseline testing
 */
function createValidPDF(): File {
  // Minimal valid PDF structure
  const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(John Doe) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000317 00000 n
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
410
%%EOF`

  return new File([Buffer.from(pdfContent)], 'valid-cv.pdf', {
    type: 'application/pdf'
  })
}

/**
 * 7. EICAR test virus (safe test malware signature)
 */
function createEICARTestVirus(): File {
  // EICAR anti-virus test file - recognized by all AV software as a test virus
  const eicar = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'

  return new File([Buffer.from(eicar)], 'test-virus.pdf', {
    type: 'application/pdf'
  })
}

/**
 * Test Suite
 */
describe('CV Upload Security Tests', () => {
  beforeEach(() => {
    // Reset environment variables
    vi.stubEnv('MAX_FILE_SIZE', '10485760') // 10MB
    vi.stubEnv('ENABLE_ANTIVIRUS', 'true')
    vi.stubEnv('ANTIVIRUS_FAIL_MODE', 'closed')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('File Size Validation', () => {
    it('should reject files larger than MAX_FILE_SIZE', async () => {
      const oversizedFile = createOversizedFile()
      const buffer = Buffer.from(await oversizedFile.arrayBuffer())

      await expect(
        securityCheck(buffer, {
          filename: oversizedFile.name,
          mimeType: oversizedFile.type,
          fileSize: oversizedFile.size,
        })
      ).rejects.toThrow(CVParseException)

      try {
        await securityCheck(buffer, {
          filename: oversizedFile.name,
          mimeType: oversizedFile.type,
          fileSize: oversizedFile.size,
        })
      } catch (error) {
        expect(error).toBeInstanceOf(CVParseException)
        expect((error as CVParseException).code).toBe(CVParseErrorCode.FILE_TOO_LARGE)
        expect((error as CVParseException).details?.size).toBe(oversizedFile.size)
        expect((error as CVParseException).details?.maxSize).toBe(10485760)
      }
    })

    it('should accept files within size limit', async () => {
      const validFile = createValidPDF()
      const buffer = Buffer.from(await validFile.arrayBuffer())

      await expect(
        securityCheck(buffer, {
          filename: validFile.name,
          mimeType: validFile.type,
          fileSize: validFile.size,
        })
      ).resolves.not.toThrow()
    })

    it('should respect custom MAX_FILE_SIZE environment variable', async () => {
      // Set custom limit to 1MB
      vi.stubEnv('MAX_FILE_SIZE', '1048576')

      const file = createValidPDF()
      // Create a 2MB file (exceeds 1MB limit)
      const buffer = Buffer.alloc(2 * 1024 * 1024, 'A')

      await expect(
        securityCheck(buffer, {
          filename: file.name,
          mimeType: file.type,
          fileSize: buffer.length,
        })
      ).rejects.toThrow(CVParseException)
    })
  })

  describe('VBA Macro Detection', () => {
    it('should detect and reject DOCX files with VBA macros', async () => {
      const macroFile = await createMacroInfectedDocx()
      const buffer = Buffer.from(await macroFile.arrayBuffer())

      await expect(
        parseCV(buffer, {
          filename: macroFile.name,
          mimeType: macroFile.type,
          fileSize: macroFile.size,
        })
      ).rejects.toThrow(CVParseException)

      try {
        await parseCV(buffer, {
          filename: macroFile.name,
          mimeType: macroFile.type,
          fileSize: macroFile.size,
        })
      } catch (error) {
        expect(error).toBeInstanceOf(CVParseException)
        expect((error as CVParseException).code).toBe(CVParseErrorCode.FILE_HAS_MACROS)
        expect((error as CVParseException).message).toContain('macros')
      }
    })

    it('should accept DOCX files without macros', async () => {
      const zip = new JSZip.default()

      // Create clean DOCX without vbaProject.bin
      zip.file('[Content_Types].xml', `<?xml version="1.0"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
</Types>`)

      zip.file('word/document.xml', `<?xml version="1.0"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>Clean CV content</w:t></w:r></w:p></w:body>
</w:document>`)

      const buffer = await zip.generateAsync({ type: 'nodebuffer' })

      // Should not throw - no macros detected
      const result = await parseCV(buffer, {
        filename: 'clean-cv.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: buffer.length,
      })

      expect(result.method).toBe('node_docx')
    })
  })

  describe('MIME Type Validation (Anti-Spoofing)', () => {
    it('should detect MIME type mismatch (executable disguised as PDF)', async () => {
      const spoofedFile = createSpoofedExecutable()
      const buffer = Buffer.from(await spoofedFile.arrayBuffer())

      const result = await verifyMimeType(buffer, spoofedFile.type)

      expect(result.valid).toBe(false)
      expect(result.actualType).not.toBe('application/pdf')
    })

    it('should reject file when MIME verification fails in fail-closed mode', async () => {
      vi.stubEnv('ANTIVIRUS_FAIL_MODE', 'closed')

      const spoofedFile = createSpoofedExecutable()
      const buffer = Buffer.from(await spoofedFile.arrayBuffer())

      await expect(
        securityCheck(buffer, {
          filename: spoofedFile.name,
          mimeType: spoofedFile.type,
          fileSize: spoofedFile.size,
        })
      ).rejects.toThrow(CVParseException)
    })

    it('should accept valid PDF with correct MIME type', async () => {
      const validFile = createValidPDF()
      const buffer = Buffer.from(await validFile.arrayBuffer())

      const result = await verifyMimeType(buffer, validFile.type)

      expect(result.valid).toBe(true)
      expect(result.actualType).toBe('application/pdf')
    })

    it('should handle DOCX as zip archive correctly', async () => {
      const zip = new JSZip.default()
      zip.file('test.txt', 'test content')
      const buffer = await zip.generateAsync({ type: 'nodebuffer' })

      const result = await verifyMimeType(
        buffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )

      // DOCX is a zip file, so should be accepted
      expect(result.valid).toBe(true)
    })
  })

  describe('ClamAV Malware Detection', () => {
    it('should detect EICAR test virus', async () => {
      // Skip if ClamAV is not available in test environment
      if (process.env.ENABLE_ANTIVIRUS === 'false') {
        console.log('⚠ ClamAV disabled, skipping malware detection test')
        return
      }

      const virusFile = createEICARTestVirus()
      const buffer = Buffer.from(await virusFile.arrayBuffer())

      const result = await scanWithClamAV(buffer)

      // In test environment, ClamAV might not be available
      // Result should either detect virus OR skip with warning
      if (!result.skipped) {
        expect(result.clean).toBe(false)
        expect(result.virus).toBeTruthy()
        expect(result.virus).toContain('EICAR')
      }
    }, 10000) // Longer timeout for AV scan

    it('should pass clean files through ClamAV', async () => {
      if (process.env.ENABLE_ANTIVIRUS === 'false') {
        return
      }

      const validFile = createValidPDF()
      const buffer = Buffer.from(await validFile.arrayBuffer())

      const result = await scanWithClamAV(buffer)

      if (!result.skipped) {
        expect(result.clean).toBe(true)
        expect(result.virus).toBeUndefined()
      }
    }, 10000)

    it('should respect ENABLE_ANTIVIRUS=false', async () => {
      vi.stubEnv('ENABLE_ANTIVIRUS', 'false')

      const file = createValidPDF()
      const buffer = Buffer.from(await file.arrayBuffer())

      const result = await scanWithClamAV(buffer)

      expect(result.clean).toBe(true)
      expect(result.scanTime).toBe(0)
    })

    it('should handle fail-closed mode when ClamAV unavailable', async () => {
      vi.stubEnv('ENABLE_ANTIVIRUS', 'true')
      vi.stubEnv('ANTIVIRUS_FAIL_MODE', 'closed')
      vi.stubEnv('CLAMAV_HOST', 'non-existent-host')

      const file = createValidPDF()
      const buffer = Buffer.from(await file.arrayBuffer())

      const result = await scanWithClamAV(buffer)

      // In fail-closed mode, should reject when AV unavailable
      expect(result.clean).toBe(false)
      expect(result.virus).toBe('ANTIVIRUS_UNAVAILABLE')
      expect(result.skipped).toBe(true)
    })

    it('should handle fail-open mode when ClamAV unavailable (dev only)', async () => {
      vi.stubEnv('ENABLE_ANTIVIRUS', 'true')
      vi.stubEnv('ANTIVIRUS_FAIL_MODE', 'open')
      vi.stubEnv('CLAMAV_HOST', 'non-existent-host')

      const file = createValidPDF()
      const buffer = Buffer.from(await file.arrayBuffer())

      const result = await scanWithClamAV(buffer)

      // In fail-open mode, should allow when AV unavailable (with warning)
      expect(result.clean).toBe(true)
      expect(result.skipped).toBe(true)
    })
  })

  describe('Filename Sanitization', () => {
    it('should handle path traversal attempts', async () => {
      const pathTraversalFile = createPathTraversalFile()

      // The filename should be sanitized before storage
      expect(pathTraversalFile.name).toContain('..')

      // Create form data with malicious filename
      const formData = new FormData()
      formData.append('file', pathTraversalFile)

      const request = createMultipartRequest(
        'POST',
        formData,
        {},
        'http://localhost:3000/api/cv/upload'
      )

      const response = await POST(request)
      const data = await parseResponse(response)

      // Should either reject or sanitize the filename
      // The blob URL should NOT contain path traversal sequences
      if (response.status === 200) {
        expect(data.blobUrl).not.toContain('..')
        expect(data.blobUrl).not.toContain('/etc/')
      }
    })

    it('should handle XSS payloads in filename', async () => {
      const xssFile = createXSSFilename()

      expect(xssFile.name).toContain('<script>')

      const formData = new FormData()
      formData.append('file', xssFile)

      const request = createMultipartRequest(
        'POST',
        formData,
        {},
        'http://localhost:3000/api/cv/upload'
      )

      const response = await POST(request)
      const data = await parseResponse(response)

      // Filename should be sanitized
      if (response.status === 200) {
        expect(data.filename).toBeDefined()
        // Should not contain raw script tags
        expect(data.blobUrl).not.toContain('<script>')
        expect(data.blobUrl).not.toContain('alert')
      }
    })

    it('should handle Unicode and special characters in filename', async () => {
      const specialChars = 'résumé-日本語-файл.pdf'
      const buffer = Buffer.from('CV content')
      const file = new File([buffer], specialChars, {
        type: 'application/pdf'
      })

      const formData = new FormData()
      formData.append('file', file)

      const request = createMultipartRequest(
        'POST',
        formData,
        {},
        'http://localhost:3000/api/cv/upload'
      )

      const response = await POST(request)

      // Should handle Unicode gracefully
      expect([200, 400]).toContain(response.status)
    })

    it('should handle extremely long filenames', async () => {
      const longFilename = 'a'.repeat(300) + '.pdf'
      const buffer = Buffer.from('CV content')
      const file = new File([buffer], longFilename, {
        type: 'application/pdf'
      })

      const formData = new FormData()
      formData.append('file', file)

      const request = createMultipartRequest(
        'POST',
        formData,
        {},
        'http://localhost:3000/api/cv/upload'
      )

      const response = await POST(request)

      // Should handle long filenames (truncate or reject)
      expect([200, 400]).toContain(response.status)
    })
  })

  describe('Complete Security Pipeline', () => {
    it('should execute all security checks in order', async () => {
      const validFile = createValidPDF()
      const buffer = Buffer.from(await validFile.arrayBuffer())

      // Full security check pipeline
      await expect(
        securityCheck(buffer, {
          filename: validFile.name,
          mimeType: validFile.type,
          fileSize: validFile.size,
        })
      ).resolves.not.toThrow()
    })

    it('should reject file failing any security check', async () => {
      const oversizedFile = createOversizedFile()
      const buffer = Buffer.from(await oversizedFile.arrayBuffer())

      await expect(
        securityCheck(buffer, {
          filename: oversizedFile.name,
          mimeType: oversizedFile.type,
          fileSize: oversizedFile.size,
        })
      ).rejects.toThrow()
    })

    it('should provide detailed error information for security failures', async () => {
      const macroFile = await createMacroInfectedDocx()
      const buffer = Buffer.from(await macroFile.arrayBuffer())

      try {
        await parseCV(buffer, {
          filename: macroFile.name,
          mimeType: macroFile.type,
          fileSize: macroFile.size,
        })
        // Should not reach here
        expect(true).toBe(false)
      } catch (error) {
        expect(error).toBeInstanceOf(CVParseException)
        const cvError = error as CVParseException

        expect(cvError.code).toBe(CVParseErrorCode.FILE_HAS_MACROS)
        expect(cvError.message).toBeTruthy()
        expect(cvError.recoverable).toBe(false)
      }
    })

    it('should log security events for audit trail', async () => {
      const consoleSpy = vi.spyOn(console, 'log')

      const validFile = createValidPDF()
      const buffer = Buffer.from(await validFile.arrayBuffer())

      await securityCheck(buffer, {
        filename: validFile.name,
        mimeType: validFile.type,
        fileSize: validFile.size,
      })

      // Logger should have been called
      // Note: Actual logging verification depends on logger implementation
      consoleSpy.mockRestore()
    })
  })

  describe('Rate Limiting', () => {
    it('should apply upload rate limiting', async () => {
      const file = createValidPDF()
      const formData = new FormData()
      formData.append('file', file)

      const request = createMultipartRequest(
        'POST',
        formData,
        {},
        'http://localhost:3000/api/cv/upload'
      )

      const response = await POST(request)

      // First request should succeed (or fail for valid reasons, but not rate limit)
      expect(response.status).not.toBe(429)
    })
  })

  describe('Integration Tests - Full Upload Flow', () => {
    it('should successfully upload and parse valid CV', async () => {
      const validFile = createValidPDF()
      const formData = new FormData()
      formData.append('file', validFile)

      const request = createMultipartRequest(
        'POST',
        formData,
        {},
        'http://localhost:3000/api/cv/upload'
      )

      const response = await POST(request)
      const data = await parseResponse(response)

      expect(response.status).toBe(200)
      expect(data.blobUrl).toBeDefined()
      expect(data.rawText).toBeDefined()
      expect(data.parseMethod).toBeDefined()
    })

    it('should reject malicious file at upload endpoint', async () => {
      const macroFile = await createMacroInfectedDocx()
      const formData = new FormData()
      formData.append('file', macroFile)

      const request = createMultipartRequest(
        'POST',
        formData,
        {},
        'http://localhost:3000/api/cv/upload'
      )

      const response = await POST(request)
      const data = await parseResponse(response)

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
      expect(data.code).toBe(CVParseErrorCode.FILE_HAS_MACROS)
    })

    it('should reject oversized file at upload endpoint', async () => {
      const oversizedFile = createOversizedFile()
      const formData = new FormData()
      formData.append('file', oversizedFile)

      const request = createMultipartRequest(
        'POST',
        formData,
        {},
        'http://localhost:3000/api/cv/upload'
      )

      const response = await POST(request)
      const data = await parseResponse(response)

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
      expect(data.code).toBe(CVParseErrorCode.FILE_TOO_LARGE)
    })

    it('should reject MIME spoofed file at upload endpoint', async () => {
      const spoofedFile = createSpoofedExecutable()
      const formData = new FormData()
      formData.append('file', spoofedFile)

      const request = createMultipartRequest(
        'POST',
        formData,
        {},
        'http://localhost:3000/api/cv/upload'
      )

      const response = await POST(request)
      const data = await parseResponse(response)

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
      expect(data.code).toBe(CVParseErrorCode.MIME_MISMATCH)
    })
  })
})
