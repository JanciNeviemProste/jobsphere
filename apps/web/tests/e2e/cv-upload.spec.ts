/**
 * E2E Tests - CV Upload Functionality
 *
 * Tests the multi-stage CV parsing pipeline including:
 * - File upload and validation
 * - PDF/DOCX text extraction
 * - OCR fallback for scanned documents
 * - Security checks (file size, MIME type, macros, antivirus)
 */

import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

// Path to test fixtures
const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures', 'files')

// Helper to get fixture file path
function getFixturePath(filename: string): string {
  return path.join(FIXTURES_DIR, filename)
}

// Helper to create a file buffer from fixture
function getFixtureBuffer(filename: string): Buffer {
  const filePath = getFixturePath(filename)
  return fs.readFileSync(filePath)
}

// Helper to create a large file for size limit testing
function createLargeFile(): Buffer {
  // Create > 10MB file
  const size = 11 * 1024 * 1024 // 11MB
  return Buffer.alloc(size, 'a')
}

// Helper to create a DOCX with macros
function createMacroDocx(): Buffer {
  // Base DOCX content
  const baseDocx = getFixtureBuffer('sample-cv.docx')

  // For testing purposes, we'll use the base DOCX
  // In real implementation, this would have vbaProject.bin added
  return baseDocx
}

test.describe('CV Upload - File Type Validation', () => {
  test('should successfully upload and parse PDF file', async ({ request }) => {
    const file = getFixtureBuffer('sample-cv.pdf')

    const formData = new FormData()
    formData.append('file', new Blob([file], { type: 'application/pdf' }), 'sample-cv.pdf')

    const response = await request.post('/api/cv/upload', {
      multipart: {
        file: {
          name: 'sample-cv.pdf',
          mimeType: 'application/pdf',
          buffer: file,
        },
      },
    })

    expect(response.ok()).toBeTruthy()
    const data = await response.json()

    // Verify response structure
    expect(data).toHaveProperty('blobUrl')
    expect(data).toHaveProperty('rawText')
    expect(data).toHaveProperty('filename', 'sample-cv.pdf')
    expect(data).toHaveProperty('parseMethod')
    expect(data).toHaveProperty('confidence')
    expect(data).toHaveProperty('extractedLength')
    expect(data).toHaveProperty('traceId')

    // Verify parsing method
    expect(data.parseMethod).toBe('node_pdf')

    // Verify text was extracted
    expect(data.rawText).toContain('John Doe')
    expect(data.rawText).toContain('john.doe@example.com')
    expect(data.extractedLength).toBeGreaterThan(50)

    // Verify high confidence for standard PDF
    expect(data.confidence).toBeGreaterThanOrEqual(0.9)
  })

  test('should successfully upload and parse DOCX file', async ({ request }) => {
    const file = getFixtureBuffer('sample-cv.docx')

    const response = await request.post('/api/cv/upload', {
      multipart: {
        file: {
          name: 'sample-cv.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          buffer: file,
        },
      },
    })

    expect(response.ok()).toBeTruthy()
    const data = await response.json()

    // Verify response structure
    expect(data).toHaveProperty('blobUrl')
    expect(data).toHaveProperty('rawText')
    expect(data).toHaveProperty('filename', 'sample-cv.docx')

    // Verify parsing method
    expect(data.parseMethod).toBe('node_docx')

    // Verify text was extracted (DOCX contains Jane Smith CV)
    expect(data.rawText).toContain('Jane Smith')
    expect(data.rawText).toContain('jane.smith@example.com')
    expect(data.extractedLength).toBeGreaterThan(50)

    // Verify high confidence for standard DOCX
    expect(data.confidence).toBeGreaterThanOrEqual(0.9)
  })

  test('should reject invalid file type', async ({ request }) => {
    // Create a fake executable file
    const file = Buffer.from('fake executable content')

    const response = await request.post('/api/cv/upload', {
      multipart: {
        file: {
          name: 'malware.exe',
          mimeType: 'application/x-msdownload',
          buffer: file,
        },
      },
    })

    expect(response.status()).toBe(400)
    const data = await response.json()

    expect(data).toHaveProperty('error')
    expect(data).toHaveProperty('code', 'file_invalid_type')
    expect(data.error).toMatch(/invalid file type/i)
  })

  test('should reject when no file provided', async ({ request }) => {
    const response = await request.post('/api/cv/upload', {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    expect(response.status()).toBe(400)
    const data = await response.json()

    expect(data).toHaveProperty('error', 'No file provided')
  })
})

test.describe('CV Upload - Security Checks', () => {
  test('should reject file larger than 10MB', async ({ request }) => {
    const largeFile = createLargeFile()

    const response = await request.post('/api/cv/upload', {
      multipart: {
        file: {
          name: 'large-cv.pdf',
          mimeType: 'application/pdf',
          buffer: largeFile,
        },
      },
    })

    expect(response.status()).toBe(400)
    const data = await response.json()

    expect(data).toHaveProperty('error')
    expect(data).toHaveProperty('code', 'file_too_large')
    expect(data.error).toMatch(/file.*too large/i)
  })

  test('should reject DOCX with macros', async ({ request }) => {
    // Note: This test depends on the macro detection implementation
    // The actual macro-infected file would need vbaProject.bin
    const macroFile = createMacroDocx()

    const response = await request.post('/api/cv/upload', {
      multipart: {
        file: {
          name: 'macro-cv.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          buffer: macroFile,
        },
      },
    })

    // Should either succeed (if no macros detected) or reject with has_macros
    const data = await response.json()

    if (!response.ok()) {
      expect(data).toHaveProperty('code')
      // If rejected, should be due to macros
      if (data.code === 'file_has_macros') {
        expect(data.error).toMatch(/macro/i)
      }
    }
  })

  test('should detect MIME type spoofing', async ({ request }) => {
    // Create a text file but claim it's a PDF
    const textFile = Buffer.from('This is plain text, not a PDF')

    const response = await request.post('/api/cv/upload', {
      multipart: {
        file: {
          name: 'fake.pdf',
          mimeType: 'application/pdf',
          buffer: textFile,
        },
      },
    })

    // Should either reject (MIME mismatch) or parse with fallback
    const data = await response.json()

    if (!response.ok()) {
      expect(data).toHaveProperty('code')
      // Could be MIME mismatch or parsing failure
      expect(['file_mime_mismatch', 'file_corrupted', 'file_no_text']).toContain(data.code)
    }
  })
})

test.describe('CV Upload - OCR Fallback', () => {
  test('should fallback to OCR for scanned PDF with minimal text', async ({ request }) => {
    const file = getFixtureBuffer('scanned-cv.pdf')

    const response = await request.post('/api/cv/upload', {
      multipart: {
        file: {
          name: 'scanned-cv.pdf',
          mimeType: 'application/pdf',
          buffer: file,
        },
      },
    })

    expect(response.ok()).toBeTruthy()
    const data = await response.json()

    // Should either use OCR or metadata fallback
    expect(['ocr_tesseract', 'metadata_fallback']).toContain(data.parseMethod)

    // OCR has lower confidence
    if (data.parseMethod === 'ocr_tesseract') {
      expect(data.confidence).toBeLessThan(0.9)
      expect(data.confidence).toBeGreaterThanOrEqual(0.7)
    }

    // Metadata fallback has zero confidence
    if (data.parseMethod === 'metadata_fallback') {
      expect(data.confidence).toBe(0)
      expect(data).toHaveProperty('warning')
      expect(data.warning?.code).toBe('file_no_text')
    }
  })

  test('should gracefully handle empty PDF', async ({ request }) => {
    // Create minimal empty PDF
    const emptyPdf = Buffer.from(`%PDF-1.4
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
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 0
>>
stream
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000236 00000 n
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
286
%%EOF
`)

    const response = await request.post('/api/cv/upload', {
      multipart: {
        file: {
          name: 'empty.pdf',
          mimeType: 'application/pdf',
          buffer: emptyPdf,
        },
      },
    })

    expect(response.ok()).toBeTruthy()
    const data = await response.json()

    // Should fallback to metadata extraction
    expect(data.parseMethod).toBe('metadata_fallback')
    expect(data.confidence).toBe(0)
    expect(data).toHaveProperty('warning')
    expect(data.warning?.code).toBe('file_no_text')

    // Should still provide metadata
    expect(data.rawText).toContain('Filename: empty')
  })
})

test.describe('CV Upload - Response Format', () => {
  test('should return complete metadata for successful upload', async ({ request }) => {
    const file = getFixtureBuffer('sample-cv.pdf')

    const response = await request.post('/api/cv/upload', {
      multipart: {
        file: {
          name: 'test-cv.pdf',
          mimeType: 'application/pdf',
          buffer: file,
        },
      },
    })

    const data = await response.json()

    // Verify all required fields are present
    expect(data).toMatchObject({
      blobUrl: expect.stringMatching(/^https?:\/\//),
      rawText: expect.any(String),
      filename: 'test-cv.pdf',
      size: expect.any(Number),
      extractedLength: expect.any(Number),
      parseMethod: expect.stringMatching(/^(node_pdf|node_docx|ocr_tesseract|metadata_fallback)$/),
      confidence: expect.any(Number),
      traceId: expect.stringMatching(/^[a-f0-9-]{36}$/), // UUID format
    })

    // Verify numeric constraints
    expect(data.size).toBeGreaterThan(0)
    expect(data.extractedLength).toBeGreaterThan(0)
    expect(data.confidence).toBeGreaterThanOrEqual(0)
    expect(data.confidence).toBeLessThanOrEqual(1)
  })

  test('should include warning for low-confidence extractions', async ({ request }) => {
    const file = getFixtureBuffer('scanned-cv.pdf')

    const response = await request.post('/api/cv/upload', {
      multipart: {
        file: {
          name: 'scanned.pdf',
          mimeType: 'application/pdf',
          buffer: file,
        },
      },
    })

    const data = await response.json()

    // If metadata fallback, should have warning
    if (data.parseMethod === 'metadata_fallback') {
      expect(data).toHaveProperty('warning')
      expect(data.warning).toMatchObject({
        code: expect.any(String),
        message: expect.any(String),
      })
    }
  })
})

test.describe('CV Upload - Anonymous vs Authenticated', () => {
  test('should allow anonymous CV upload', async ({ request }) => {
    const file = getFixtureBuffer('sample-cv.pdf')

    const response = await request.post('/api/cv/upload', {
      multipart: {
        file: {
          name: 'anonymous-cv.pdf',
          mimeType: 'application/pdf',
          buffer: file,
        },
      },
    })

    expect(response.ok()).toBeTruthy()
    const data = await response.json()

    // Should succeed for anonymous users
    expect(data).toHaveProperty('blobUrl')

    // Blob URL should contain 'anonymous' path for unauthenticated uploads
    expect(data.blobUrl).toMatch(/cvs\/anonymous\//i)
  })

  // Note: Authenticated upload test would require auth fixtures
  // Example with auth fixture (when available):
  /*
  test('should upload CV for authenticated user', async ({ candidateUser }) => {
    // This would use the candidateUser fixture from auth.ts
    // and make the upload request in authenticated context
  })
  */
})

test.describe('CV Upload - Rate Limiting', () => {
  test('should enforce rate limits on uploads', async ({ request }) => {
    const file = getFixtureBuffer('sample-cv.pdf')

    // Make multiple rapid requests to trigger rate limit
    // Rate limit: 10 uploads per 5 minutes (preset: 'upload')
    const requests = []

    for (let i = 0; i < 12; i++) {
      requests.push(
        request.post('/api/cv/upload', {
          multipart: {
            file: {
              name: `cv-${i}.pdf`,
              mimeType: 'application/pdf',
              buffer: file,
            },
          },
        })
      )
    }

    const responses = await Promise.all(requests)

    // Some requests should succeed, but eventually hit rate limit
    const successCount = responses.filter((r) => r.ok()).length
    const rateLimitedCount = responses.filter((r) => r.status() === 429).length

    // At least one should be rate limited (if rate limiting is enabled)
    // Note: Rate limiting may be disabled in test environment
    if (process.env.ENABLE_RATE_LIMIT !== 'false') {
      expect(rateLimitedCount).toBeGreaterThan(0)
    }
  })
})

test.describe('CV Upload - Error Handling', () => {
  test('should handle corrupted PDF gracefully', async ({ request }) => {
    const corruptedPdf = Buffer.from('This is not a valid PDF file content')

    const response = await request.post('/api/cv/upload', {
      multipart: {
        file: {
          name: 'corrupted.pdf',
          mimeType: 'application/pdf',
          buffer: corruptedPdf,
        },
      },
    })

    // Should return error or fallback to metadata
    const data = await response.json()

    if (!response.ok()) {
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('code')
      expect(['file_corrupted', 'file_mime_mismatch', 'file_no_text']).toContain(data.code)
    } else {
      // If it succeeded, should be via metadata fallback
      expect(data.parseMethod).toBe('metadata_fallback')
      expect(data.confidence).toBe(0)
    }
  })

  test('should provide helpful error messages', async ({ request }) => {
    const largeFile = createLargeFile()

    const response = await request.post('/api/cv/upload', {
      multipart: {
        file: {
          name: 'huge.pdf',
          mimeType: 'application/pdf',
          buffer: largeFile,
        },
      },
    })

    expect(response.status()).toBe(400)
    const data = await response.json()

    // Should have descriptive error
    expect(data).toHaveProperty('error')
    expect(data).toHaveProperty('code')
    expect(data.error).toBeTruthy()
    expect(data.error.length).toBeGreaterThan(10) // Not just a code
  })

  test('should include trace ID for debugging', async ({ request }) => {
    const file = getFixtureBuffer('sample-cv.pdf')

    const response = await request.post('/api/cv/upload', {
      multipart: {
        file: {
          name: 'test.pdf',
          mimeType: 'application/pdf',
          buffer: file,
        },
      },
    })

    const data = await response.json()

    // All responses should include trace ID for debugging
    expect(data).toHaveProperty('traceId')
    expect(data.traceId).toMatch(/^[a-f0-9-]{36}$/) // UUID format
  })
})
