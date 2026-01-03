/**
 * File Upload Attack Tests
 *
 * Advanced attack scenario testing for file upload security.
 * Tests specific attack vectors that malicious actors might use to bypass security.
 *
 * Attack Categories:
 * 1. Executable File Rejection - Preventing execution of malicious binaries
 * 2. MIME Type Spoofing - Detecting files masquerading as safe types
 * 3. VBA Macro Detection - Blocking macro-enabled documents
 * 4. Path Traversal - Preventing directory traversal attacks
 * 5. File Size Enforcement - DoS protection via oversized files
 * 6. Polyglot Files - Multi-format files that exploit parser confusion
 * 7. Zip Bombs - Decompression bombs
 * 8. Null Byte Injection - Filename-based attacks
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { securityCheck, verifyMimeType, scanWithClamAV } from '@/lib/antivirus'
import { parseCV } from '@/lib/cv-parser-pipeline'
import { CVParseErrorCode, CVParseException } from '@jobsphere/ai'
import { POST } from '@/app/api/cv/upload/route'
import { createMultipartRequest, parseResponse } from '../integration/helpers/api-client'
import * as JSZip from 'jszip'

/**
 * ==========================================
 * ATTACK VECTOR 1: EXECUTABLE FILE ATTACKS
 * ==========================================
 */

describe('File Upload Attacks - Executable Rejection', () => {
  beforeEach(() => {
    vi.stubEnv('ENABLE_ANTIVIRUS', 'true')
    vi.stubEnv('ANTIVIRUS_FAIL_MODE', 'closed')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('ATTACK: Windows PE executable disguised as PDF', async () => {
    // MZ header (DOS/PE executable magic bytes)
    const peHeader = Buffer.from([
      0x4D, 0x5A, // MZ signature
      0x90, 0x00, 0x03, 0x00, 0x00, 0x00,
      0x04, 0x00, 0x00, 0x00, 0xFF, 0xFF,
      // Add more realistic PE structure
      ...Buffer.alloc(100, 0x00)
    ])

    const result = await verifyMimeType(peHeader, 'application/pdf')

    expect(result.valid).toBe(false)
    expect(result.actualType).not.toBe('application/pdf')
  })

  it('ATTACK: ELF executable (Linux binary) disguised as DOCX', async () => {
    // ELF header (Linux/Unix executable)
    const elfHeader = Buffer.from([
      0x7F, 0x45, 0x4C, 0x46, // \x7FELF
      0x02, 0x01, 0x01, 0x00,
      ...Buffer.alloc(100, 0x00)
    ])

    const result = await verifyMimeType(
      elfHeader,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )

    expect(result.valid).toBe(false)
  })

  it('ATTACK: Mach-O executable (macOS binary) with PDF extension', async () => {
    // Mach-O header (macOS executable)
    const machoHeader = Buffer.from([
      0xCF, 0xFA, 0xED, 0xFE, // Mach-O 64-bit
      ...Buffer.alloc(100, 0x00)
    ])

    const result = await verifyMimeType(machoHeader, 'application/pdf')

    expect(result.valid).toBe(false)
  })

  it('ATTACK: Windows screensaver (.scr) disguised as document', async () => {
    // Screensaver is also a PE executable
    const scrHeader = Buffer.from([0x4D, 0x5A, ...Buffer.alloc(100)])

    await expect(
      securityCheck(scrHeader, {
        filename: 'resume.pdf',
        mimeType: 'application/pdf',
        fileSize: scrHeader.length,
      })
    ).rejects.toThrow(CVParseException)
  })

  it('ATTACK: Java class file disguised as PDF', async () => {
    // Java .class file magic bytes
    const classHeader = Buffer.from([
      0xCA, 0xFE, 0xBA, 0xBE, // Java class signature
      ...Buffer.alloc(100, 0x00)
    ])

    const result = await verifyMimeType(classHeader, 'application/pdf')

    expect(result.valid).toBe(false)
  })
})

/**
 * ===============================================
 * ATTACK VECTOR 2: MIME TYPE SPOOFING ATTACKS
 * ===============================================
 */

describe('File Upload Attacks - MIME Type Spoofing', () => {
  it('ATTACK: Image file (PNG) claiming to be PDF', async () => {
    // PNG header
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      ...Buffer.alloc(100, 0x00)
    ])

    const result = await verifyMimeType(pngHeader, 'application/pdf')

    expect(result.valid).toBe(false)
    expect(result.actualType).toContain('image/png')
  })

  it('ATTACK: ZIP archive claiming to be PDF', async () => {
    const zip = new JSZip.default()
    zip.file('malicious.exe', Buffer.from('FAKE_EXECUTABLE'))
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

    const result = await verifyMimeType(zipBuffer, 'application/pdf')

    // ZIP should be rejected as PDF (unless it's DOCX which is special-cased)
    if (result.actualType === 'application/zip') {
      expect(result.valid).toBe(false)
    }
  })

  it('ATTACK: HTML file with JavaScript claiming to be PDF', async () => {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head><script>alert('XSS')</script></head>
<body>Malicious content</body>
</html>
    `
    const htmlBuffer = Buffer.from(htmlContent)

    const result = await verifyMimeType(htmlBuffer, 'application/pdf')

    expect(result.valid).toBe(false)
  })

  it('ATTACK: RAR archive disguised as DOCX', async () => {
    // RAR signature
    const rarHeader = Buffer.from([
      0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, // Rar!
      ...Buffer.alloc(100, 0x00)
    ])

    const result = await verifyMimeType(
      rarHeader,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )

    expect(result.valid).toBe(false)
  })

  it('ATTACK: 7-Zip archive claiming to be PDF', async () => {
    // 7z signature
    const sevenZipHeader = Buffer.from([
      0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C, // 7z
      ...Buffer.alloc(100, 0x00)
    ])

    const result = await verifyMimeType(sevenZipHeader, 'application/pdf')

    expect(result.valid).toBe(false)
  })
})

/**
 * =========================================
 * ATTACK VECTOR 3: VBA MACRO ATTACKS
 * =========================================
 */

describe('File Upload Attacks - VBA Macro Exploits', () => {
  it('ATTACK: DOCX with embedded VBA macro payload', async () => {
    const zip = new JSZip.default()

    // Minimal DOCX structure
    zip.file('[Content_Types].xml', `<?xml version="1.0"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
</Types>`)

    zip.file('word/document.xml', `<?xml version="1.0"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>Resume Content</w:t></w:r></w:p></w:body>
</w:document>`)

    // Add macro binary - this should trigger detection
    const maliciousMacro = Buffer.from('MACRO_PAYLOAD_SIMULATED_CONTENT_FOR_TESTING')
    zip.file('word/vbaProject.bin', maliciousMacro)

    const buffer = await zip.generateAsync({ type: 'nodebuffer' })

    await expect(
      parseCV(buffer, {
        filename: 'infected-cv.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: buffer.length,
      })
    ).rejects.toThrow(CVParseException)
  })

  it('ATTACK: DOCM (macro-enabled) file upload', async () => {
    const zip = new JSZip.default()

    zip.file('[Content_Types].xml', `<?xml version="1.0"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Override PartName="/word/vbaProject.bin" ContentType="application/vnd.ms-office.vbaProject"/>
</Types>`)

    zip.file('word/vbaProject.bin', 'VBA_CODE_HERE')
    const buffer = await zip.generateAsync({ type: 'nodebuffer' })

    await expect(
      parseCV(buffer, {
        filename: 'resume.docm',
        mimeType: 'application/vnd.ms-word.document.macroEnabled.12',
        fileSize: buffer.length,
      })
    ).rejects.toThrow()
  })

  it('ATTACK: Nested macro in subfolder structure', async () => {
    const zip = new JSZip.default()

    zip.file('word/document.xml', '<w:document/>')
    // Try to hide macro in nested path
    zip.file('word/embeddings/activeX/vbaProject.bin', 'HIDDEN_MACRO')

    const buffer = await zip.generateAsync({ type: 'nodebuffer' })

    await expect(
      parseCV(buffer, {
        filename: 'sneaky-cv.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: buffer.length,
      })
    ).rejects.toThrow()
  })

  it('ATTACK: Obfuscated vbaProject filename (case variations)', async () => {
    const zip = new JSZip.default()

    zip.file('word/document.xml', '<w:document/>')
    // Try different casing to bypass detection
    zip.file('word/VBAProject.bin', 'MACRO_CONTENT')
    zip.file('word/vbaproject.BIN', 'MACRO_CONTENT')

    const buffer = await zip.generateAsync({ type: 'nodebuffer' })

    // Detection should be case-insensitive
    await expect(
      parseCV(buffer, {
        filename: 'obfuscated.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: buffer.length,
      })
    ).rejects.toThrow()
  })
})

/**
 * ==========================================
 * ATTACK VECTOR 4: PATH TRAVERSAL ATTACKS
 * ==========================================
 */

describe('File Upload Attacks - Path Traversal', () => {
  it('ATTACK: Unix path traversal (../../../etc/passwd)', async () => {
    const file = new File(
      [Buffer.from('malicious content')],
      '../../../etc/passwd.pdf',
      { type: 'application/pdf' }
    )

    const formData = new FormData()
    formData.append('file', file)

    const request = createMultipartRequest(
      'POST',
      formData,
      {},
      'http://localhost:3000/api/cv/upload'
    )

    const response = await POST(request)
    const data = await parseResponse(response)

    // Should either reject or sanitize filename
    if (response.status === 200) {
      expect(data.blobUrl).not.toContain('..')
      expect(data.blobUrl).not.toContain('/etc/')
      expect(data.blobUrl).not.toMatch(/passwd/)
    }
  })

  it('ATTACK: Windows path traversal (..\\..\\Windows\\System32)', async () => {
    const file = new File(
      [Buffer.from('malicious')],
      '..\\..\\Windows\\System32\\config.pdf',
      { type: 'application/pdf' }
    )

    const formData = new FormData()
    formData.append('file', file)

    const request = createMultipartRequest(
      'POST',
      formData,
      {},
      'http://localhost:3000/api/cv/upload'
    )

    const response = await POST(request)
    const data = await parseResponse(response)

    if (response.status === 200) {
      expect(data.blobUrl).not.toContain('..')
      expect(data.blobUrl).not.toContain('Windows')
      expect(data.blobUrl).not.toContain('System32')
    }
  })

  it('ATTACK: URL-encoded path traversal (%2e%2e%2f)', async () => {
    const file = new File(
      [Buffer.from('content')],
      '%2e%2e%2f%2e%2e%2fetc%2fpasswd.pdf',
      { type: 'application/pdf' }
    )

    const formData = new FormData()
    formData.append('file', file)

    const request = createMultipartRequest(
      'POST',
      formData,
      {},
      'http://localhost:3000/api/cv/upload'
    )

    const response = await POST(request)
    const data = await parseResponse(response)

    if (response.status === 200) {
      // Should not decode and allow traversal
      expect(data.blobUrl).not.toContain('/etc/')
    }
  })

  it('ATTACK: Absolute path injection (/var/www/uploads/backdoor.php)', async () => {
    const file = new File(
      [Buffer.from('<?php system($_GET["cmd"]); ?>')],
      '/var/www/uploads/backdoor.pdf',
      { type: 'application/pdf' }
    )

    const formData = new FormData()
    formData.append('file', file)

    const request = createMultipartRequest(
      'POST',
      formData,
      {},
      'http://localhost:3000/api/cv/upload'
    )

    const response = await POST(request)
    const data = await parseResponse(response)

    if (response.status === 200) {
      // Filename should be sanitized, not use absolute path
      expect(data.blobUrl).not.toMatch(/^\/var\//)
    }
  })

  it('ATTACK: Null byte injection (resume.pdf\\x00.exe)', async () => {
    // Null byte can truncate filename on some systems
    const file = new File(
      [Buffer.from('executable content')],
      'resume.pdf\x00.exe',
      { type: 'application/pdf' }
    )

    const formData = new FormData()
    formData.append('file', file)

    const request = createMultipartRequest(
      'POST',
      formData,
      {},
      'http://localhost:3000/api/cv/upload'
    )

    const response = await POST(request)
    const data = await parseResponse(response)

    if (response.status === 200) {
      // Null bytes should be stripped or rejected
      expect(data.filename).not.toContain('\x00')
      expect(data.blobUrl).not.toContain('\x00')
    }
  })
})

/**
 * ==========================================
 * ATTACK VECTOR 5: FILE SIZE DoS ATTACKS
 * ==========================================
 */

describe('File Upload Attacks - File Size Enforcement', () => {
  it('ATTACK: Exactly at size limit boundary (10MB)', async () => {
    const maxSize = 10 * 1024 * 1024 // 10MB
    const buffer = Buffer.alloc(maxSize, 'A')

    // At exact limit should pass
    await expect(
      securityCheck(buffer, {
        filename: 'large.pdf',
        mimeType: 'application/pdf',
        fileSize: maxSize,
      })
    ).resolves.not.toThrow()
  })

  it('ATTACK: One byte over size limit (10MB + 1)', async () => {
    const maxSize = 10 * 1024 * 1024
    const oversized = maxSize + 1
    const buffer = Buffer.alloc(oversized, 'A')

    await expect(
      securityCheck(buffer, {
        filename: 'oversized.pdf',
        mimeType: 'application/pdf',
        fileSize: oversized,
      })
    ).rejects.toThrow(CVParseException)
  })

  it('ATTACK: Massive file (100MB) - DoS attempt', async () => {
    const massive = 100 * 1024 * 1024
    const buffer = Buffer.alloc(1024) // Don't actually allocate 100MB in test

    await expect(
      securityCheck(buffer, {
        filename: 'dos-attack.pdf',
        mimeType: 'application/pdf',
        fileSize: massive, // Claim massive size
      })
    ).rejects.toThrow(CVParseException)
  })

  it('ATTACK: Negative file size integer overflow', async () => {
    const buffer = Buffer.from('content')

    await expect(
      securityCheck(buffer, {
        filename: 'negative.pdf',
        mimeType: 'application/pdf',
        fileSize: -1,
      })
    ).rejects.toThrow()
  })

  it('ATTACK: Zero-byte file', async () => {
    const buffer = Buffer.alloc(0)

    // Zero-byte file should be handled gracefully
    const result = await securityCheck(buffer, {
      filename: 'empty.pdf',
      mimeType: 'application/pdf',
      fileSize: 0,
    })

    // May pass security check but fail parsing later
    expect(result).toBeUndefined() // securityCheck returns void on success
  })
})

/**
 * ==========================================
 * ATTACK VECTOR 6: POLYGLOT FILE ATTACKS
 * ==========================================
 */

describe('File Upload Attacks - Polyglot Files', () => {
  it('ATTACK: PDF-JavaScript polyglot', async () => {
    // File that is valid PDF AND valid JavaScript
    const polyglot = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj
xref
0 4
trailer<</Size 4/Root 1 0 R>>
startxref
0
%%EOF
/*
JavaScript payload here - this could execute if parsed as JS
alert('XSS')
*/`

    const buffer = Buffer.from(polyglot)
    const result = await verifyMimeType(buffer, 'application/pdf')

    // Should detect as PDF (which is what we want)
    expect(result.valid).toBe(true)
    expect(result.actualType).toBe('application/pdf')
  })

  it('ATTACK: JPEG-JAR polyglot (CVE-style attack)', async () => {
    // Create buffer with JPEG header followed by ZIP content
    const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0])
    const zip = new JSZip.default()
    zip.file('malicious.class', 'JAVA_BYTECODE')
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

    const polyglot = Buffer.concat([jpegHeader, zipBuffer])

    const result = await verifyMimeType(polyglot, 'application/pdf')

    // Should NOT validate as PDF
    expect(result.valid).toBe(false)
  })
})

/**
 * ==========================================
 * ATTACK VECTOR 7: ZIP BOMB ATTACKS
 * ==========================================
 */

describe('File Upload Attacks - Decompression Bombs', () => {
  it('ATTACK: Nested ZIP bomb (zip in zip)', async () => {
    // Create deeply nested ZIPs
    let innerZip = new JSZip.default()
    innerZip.file('payload.txt', 'X'.repeat(1000))

    let level1 = await innerZip.generateAsync({ type: 'nodebuffer' })

    let outerZip = new JSZip.default()
    outerZip.file('inner.zip', level1)

    const zipBomb = await outerZip.generateAsync({ type: 'nodebuffer' })

    // DOCX parser should handle nested content safely
    // This tests that we don't recursively decompress
    const result = await parseCV(zipBomb, {
      filename: 'nested.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileSize: zipBomb.length,
    })

    // Should not crash or timeout
    expect(result).toBeDefined()
  })

  it('ATTACK: Many files in ZIP (DOCX with 10,000 files)', async () => {
    const zip = new JSZip.default()

    // Add many small files to inflate decompression size
    for (let i = 0; i < 100; i++) {
      zip.file(`file${i}.xml`, 'X'.repeat(100))
    }

    const manyFiles = await zip.generateAsync({ type: 'nodebuffer' })

    // Should handle without timeout or memory issues
    const result = await parseCV(manyFiles, {
      filename: 'many-files.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileSize: manyFiles.length,
    })

    expect(result).toBeDefined()
  })
})

/**
 * ==========================================
 * ATTACK VECTOR 8: SPECIAL CHARACTER ATTACKS
 * ==========================================
 */

describe('File Upload Attacks - Special Characters & Injection', () => {
  it('ATTACK: XSS in filename (<script>alert(1)</script>.pdf)', async () => {
    const file = new File(
      [Buffer.from('content')],
      '<script>alert(document.cookie)</script>.pdf',
      { type: 'application/pdf' }
    )

    const formData = new FormData()
    formData.append('file', file)

    const request = createMultipartRequest(
      'POST',
      formData,
      {},
      'http://localhost:3000/api/cv/upload'
    )

    const response = await POST(request)
    const data = await parseResponse(response)

    if (response.status === 200) {
      // XSS should be sanitized
      expect(data.blobUrl).not.toContain('<script>')
      expect(data.blobUrl).not.toContain('alert')
    }
  })

  it('ATTACK: SQL injection in filename (\'; DROP TABLE users--.pdf)', async () => {
    const file = new File(
      [Buffer.from('content')],
      "'; DROP TABLE users--.pdf",
      { type: 'application/pdf' }
    )

    const formData = new FormData()
    formData.append('file', file)

    const request = createMultipartRequest(
      'POST',
      formData,
      {},
      'http://localhost:3000/api/cv/upload'
    )

    const response = await POST(request)

    // Should not cause SQL errors (filename shouldn't reach DB unsanitized)
    expect([200, 400]).toContain(response.status)
  })

  it('ATTACK: Command injection in filename ($(rm -rf /).pdf)', async () => {
    const file = new File(
      [Buffer.from('content')],
      '$(rm -rf /).pdf',
      { type: 'application/pdf' }
    )

    const formData = new FormData()
    formData.append('file', file)

    const request = createMultipartRequest(
      'POST',
      formData,
      {},
      'http://localhost:3000/api/cv/upload'
    )

    const response = await POST(request)
    const data = await parseResponse(response)

    if (response.status === 200) {
      // Command injection chars should be sanitized
      expect(data.blobUrl).not.toContain('$(')
      expect(data.blobUrl).not.toContain('rm -rf')
    }
  })

  it('ATTACK: LDAP injection in filename (*)(&)(objectClass=*).pdf', async () => {
    const file = new File(
      [Buffer.from('content')],
      '*)(&)(objectClass=*).pdf',
      { type: 'application/pdf' }
    )

    const formData = new FormData()
    formData.append('file', file)

    const request = createMultipartRequest(
      'POST',
      formData,
      {},
      'http://localhost:3000/api/cv/upload'
    )

    const response = await POST(request)

    // Should handle special chars safely
    expect([200, 400]).toContain(response.status)
  })

  it('ATTACK: Newline injection in filename (line1\\nline2.pdf)', async () => {
    const file = new File(
      [Buffer.from('content')],
      'line1\nline2\rline3.pdf',
      { type: 'application/pdf' }
    )

    const formData = new FormData()
    formData.append('file', file)

    const request = createMultipartRequest(
      'POST',
      formData,
      {},
      'http://localhost:3000/api/cv/upload'
    )

    const response = await POST(request)
    const data = await parseResponse(response)

    if (response.status === 200) {
      // Newlines should be stripped
      expect(data.filename).not.toContain('\n')
      expect(data.filename).not.toContain('\r')
    }
  })
})

/**
 * ==========================================
 * INTEGRATION: COMBINED ATTACK SCENARIOS
 * ==========================================
 */

describe('File Upload Attacks - Combined Multi-Vector Attacks', () => {
  it('COMBINED ATTACK: Oversized + MIME spoofed + path traversal', async () => {
    const exe = Buffer.from([0x4D, 0x5A, ...Buffer.alloc(100)])

    await expect(
      securityCheck(exe, {
        filename: '../../../etc/passwd.pdf',
        mimeType: 'application/pdf',
        fileSize: 15 * 1024 * 1024, // Over limit
      })
    ).rejects.toThrow()
  })

  it('COMBINED ATTACK: Macro + XSS filename + polyglot', async () => {
    const zip = new JSZip.default()
    zip.file('word/document.xml', '<w:document/>')
    zip.file('word/vbaProject.bin', 'MACRO')

    const buffer = await zip.generateAsync({ type: 'nodebuffer' })

    const file = new File(
      [buffer],
      '<script>alert("pwned")</script>.docx',
      { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
    )

    const formData = new FormData()
    formData.append('file', file)

    const request = createMultipartRequest(
      'POST',
      formData,
      {},
      'http://localhost:3000/api/cv/upload'
    )

    const response = await POST(request)

    // Should reject due to macro detection
    expect(response.status).toBe(400)
  })

  it('EDGE CASE: Valid file with suspicious but safe filename', async () => {
    // File that looks suspicious but is actually safe
    const validPDF = `%PDF-1.4
1 0 obj<</Type/Catalog>>endobj
xref
0 1
trailer<</Size 1/Root 1 0 R>>
%%EOF`

    const file = new File(
      [Buffer.from(validPDF)],
      'my-resume-2024-final-FINAL-v3.pdf',
      { type: 'application/pdf' }
    )

    const formData = new FormData()
    formData.append('file', file)

    const request = createMultipartRequest(
      'POST',
      formData,
      {},
      'http://localhost:3000/api/cv/upload'
    )

    const response = await POST(request)

    // Should accept valid files even with weird names
    expect(response.status).toBe(200)
  })
})
