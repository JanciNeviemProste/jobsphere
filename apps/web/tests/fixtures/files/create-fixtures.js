/**
 * Create minimal test CV files using base64-encoded data
 * This avoids needing pdfkit/docx dependencies
 */

const fs = require('fs')
const path = require('path')

const outputDir = __dirname

// Minimal valid PDF with text content (John Doe CV)
// This is a real minimal PDF created with basic PDF structure
const samplePdfBase64 = Buffer.from(`%PDF-1.4
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
/Length 445
>>
stream
BT
/F1 18 Tf
50 750 Td
(John Doe) Tj
0 -20 Td
/F1 12 Tf
(Email: john.doe@example.com) Tj
0 -15 Td
(Phone: +1 555-123-4567) Tj
0 -15 Td
(Location: San Francisco, CA) Tj
0 -25 Td
/F1 14 Tf
(Professional Summary) Tj
0 -18 Td
/F1 11 Tf
(Experienced software engineer with 5+ years in full-stack development.) Tj
0 -15 Td
(Specializing in React, Node.js, and TypeScript.) Tj
0 -25 Td
/F1 14 Tf
(Skills) Tj
0 -18 Td
/F1 11 Tf
(JavaScript, TypeScript, React, Node.js, PostgreSQL, Docker, AWS) Tj
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
814
%%EOF
`).toString()

// Create sample-cv.pdf
fs.writeFileSync(
  path.join(outputDir, 'sample-cv.pdf'),
  samplePdfBase64
)
console.log('✓ Created: sample-cv.pdf')

// Minimal valid DOCX (it's a ZIP file with XML content)
// This is a base64-encoded minimal DOCX with Jane Smith CV
const sampleDocxBase64 = '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'

fs.writeFileSync(
  path.join(outputDir, 'sample-cv.docx'),
  Buffer.from(sampleDocxBase64, 'base64')
)
console.log('✓ Created: sample-cv.docx')

// Create scanned PDF (minimal text for OCR fallback testing)
const scannedPdfContent = `%PDF-1.4
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
/Length 92
>>
stream
BT
/F1 8 Tf
50 750 Td
(Robert Johnson) Tj
0 -12 Td
(robert.j@example.com) Tj
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
461
%%EOF
`

fs.writeFileSync(
  path.join(outputDir, 'scanned-cv.pdf'),
  scannedPdfContent
)
console.log('✓ Created: scanned-cv.pdf')

// Create README explaining the fixtures
const readmeContent = `# Test File Fixtures

This directory contains test files for E2E CV upload testing.

## Files

### sample-cv.pdf
Normal PDF with extractable text content (John Doe CV).
- Used for testing standard PDF parsing
- Should be parsed successfully by node pdf-parse

### sample-cv.docx
Normal DOCX with extractable text content (Jane Smith CV).
- Used for testing standard DOCX parsing
- Should be parsed successfully by mammoth

### scanned-cv.pdf
Minimal PDF simulating a scanned document (Robert Johnson).
- Used for testing OCR fallback when text extraction yields insufficient content
- In real scenarios, would trigger Tesseract OCR

## Creating Additional Test Files

To add more test files, you can:

1. Use the base64-encoded approach in create-fixtures.js
2. Add real PDF/DOCX files manually
3. Generate programmatically with libraries (requires pdfkit, docx dependencies)

## Notes

- Files are intentionally minimal to keep repository size small
- File size limits are tested separately with dynamically generated large files
- Macro detection is tested with specially crafted DOCX files
`

fs.writeFileSync(
  path.join(outputDir, 'README.md'),
  readmeContent
)
console.log('✓ Created: README.md')

console.log('\n✓ All test fixtures created successfully!')
console.log('\nGenerated files:')
console.log('  - sample-cv.pdf (normal PDF)')
console.log('  - sample-cv.docx (normal DOCX)')
console.log('  - scanned-cv.pdf (minimal text for OCR testing)')
console.log('  - README.md (documentation)')
