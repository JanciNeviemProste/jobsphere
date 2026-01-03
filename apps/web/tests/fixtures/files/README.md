# Test File Fixtures

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
