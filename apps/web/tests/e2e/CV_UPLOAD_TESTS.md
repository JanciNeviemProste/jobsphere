# CV Upload E2E Tests

This document describes the comprehensive E2E test suite for CV upload functionality.

## Test File

`apps/web/tests/e2e/cv-upload.spec.ts`

## Test Fixtures

Located in `apps/web/tests/fixtures/files/`:

- **sample-cv.pdf** - Normal PDF with extractable text (John Doe CV)
- **sample-cv.docx** - Normal DOCX with extractable text (Jane Smith CV)
- **scanned-cv.pdf** - Minimal text PDF for OCR fallback testing (Robert Johnson)
- **README.md** - Documentation for test fixtures

## Test Coverage

### 1. File Type Validation (4 tests)

Tests proper handling of different file types:

- **PDF Upload** - Verifies successful PDF parsing with node_pdf method
- **DOCX Upload** - Verifies successful DOCX parsing with node_docx method
- **Invalid File Type** - Ensures rejection of non-CV file types (e.g., .exe)
- **No File Provided** - Validates error handling when file is missing

**Expected Results:**
- Valid PDFs/DOCX files should be parsed successfully
- Parse method should be `node_pdf` or `node_docx`
- Confidence should be >= 0.9 for standard documents
- Invalid file types should return 400 error with code `file_invalid_type`

### 2. Security Checks (3 tests)

Tests security validations in the upload pipeline:

- **File Size Limit** - Rejects files > 10MB
- **Macro Detection** - Rejects DOCX files containing VBA macros
- **MIME Type Spoofing** - Detects when declared MIME type doesn't match actual content

**Expected Results:**
- Large files (> 10MB) should return error code `file_too_large`
- DOCX with macros should return error code `file_has_macros`
- MIME mismatches should return error code `file_mime_mismatch`

### 3. OCR Fallback (2 tests)

Tests the multi-stage parsing pipeline with fallback mechanisms:

- **OCR Fallback** - Triggers OCR when node parser extracts insufficient text
- **Empty PDF Handling** - Tests graceful degradation to metadata extraction

**Expected Results:**
- Scanned PDFs should trigger OCR (method: `ocr_tesseract`) or metadata fallback
- OCR confidence should be 0.7
- Metadata fallback confidence should be 0
- Warning should be included with code `file_no_text` for metadata fallback

### 4. Response Format (2 tests)

Validates API response structure and metadata:

- **Complete Metadata** - Ensures all required fields are present
- **Low-Confidence Warnings** - Verifies warnings are included for problematic files

**Expected Response Fields:**
```typescript
{
  blobUrl: string        // Vercel Blob URL
  rawText: string        // Extracted text
  filename: string       // Original filename
  size: number          // File size in bytes
  extractedLength: number  // Length of extracted text
  parseMethod: 'node_pdf' | 'node_docx' | 'ocr_tesseract' | 'metadata_fallback'
  confidence: number    // 0-1 confidence score
  traceId: string       // UUID for debugging
  warning?: {           // Optional warning for issues
    code: string
    message: string
  }
}
```

### 5. Anonymous vs Authenticated (1 test)

Tests upload functionality for different user states:

- **Anonymous Upload** - Verifies CV upload works without authentication

**Expected Results:**
- Anonymous uploads should succeed
- Blob URL should contain `/cvs/anonymous/` path

### 6. Rate Limiting (1 test)

Tests upload rate limit enforcement:

- **Rate Limit Enforcement** - Verifies 10 uploads per 5 minutes limit

**Expected Results:**
- After 10+ rapid uploads, subsequent requests should return 429
- Rate limiting may be disabled in test environment (check `ENABLE_RATE_LIMIT` env var)

### 7. Error Handling (3 tests)

Tests error scenarios and messaging:

- **Corrupted PDF** - Handles invalid/corrupted PDF files gracefully
- **Helpful Error Messages** - Ensures errors are descriptive
- **Trace IDs** - Verifies all responses include debugging trace ID

**Expected Results:**
- Corrupted files should either error or fallback to metadata extraction
- Error messages should be descriptive (> 10 characters)
- All responses should include UUID trace ID

## Running the Tests

### Run All CV Upload Tests

```bash
# Run in all browsers/devices
yarn test:e2e cv-upload

# Run in Chromium only
yarn test:e2e cv-upload --project=chromium

# Run with UI
yarn test:e2e cv-upload --ui

# Run in headed mode (see browser)
yarn test:e2e cv-upload --headed

# Run in debug mode
yarn test:e2e cv-upload --debug
```

### Run Specific Test Suite

```bash
# File type validation only
yarn test:e2e cv-upload -g "File Type Validation"

# Security checks only
yarn test:e2e cv-upload -g "Security Checks"

# OCR fallback only
yarn test:e2e cv-upload -g "OCR Fallback"
```

### Run Single Test

```bash
# Run specific test by name
yarn test:e2e cv-upload -g "should successfully upload and parse PDF"
```

## Test Statistics

- **Total Test Suites:** 7
- **Total Tests:** 16
- **Browser/Device Coverage:** 10 configurations (Chrome, Firefox, Safari, Edge, iPhone 12, iPhone 13 Pro, Pixel 5, Galaxy S9+, iPad Air, iPad Mini)
- **Total Test Executions:** 160 (16 tests × 10 configurations)

## Environment Requirements

### Required Environment Variables

```bash
# Next.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=test-secret-key

# Vercel Blob (for file storage)
BLOB_READ_WRITE_TOKEN=vercel_blob_token

# Optional but recommended
ANTHROPIC_API_KEY=your_api_key  # For CV parsing
```

### Optional Environment Variables

```bash
# Security
ENABLE_ANTIVIRUS=false          # Disable ClamAV in tests (faster)
ANTIVIRUS_FAIL_MODE=open        # Allow files when AV unavailable
MAX_FILE_SIZE=10485760          # 10MB (default)

# OCR
ENABLE_OCR=true                 # Enable OCR fallback
OCR_TIMEOUT=30000               # 30 seconds timeout

# Rate Limiting
ENABLE_RATE_LIMIT=false         # Disable in tests to avoid flakiness
```

### Test Infrastructure

The tests use Playwright's `request` fixture for API testing:
- No browser needed for most tests (faster execution)
- Direct HTTP requests to `/api/cv/upload` endpoint
- File uploads via multipart form data

## Test Data

### Sample PDF Content (John Doe)
- Name: John Doe
- Email: john.doe@example.com
- Phone: +1 (555) 123-4567
- Location: San Francisco, CA
- Skills: JavaScript, TypeScript, React, Node.js, PostgreSQL, Docker, AWS

### Sample DOCX Content (Jane Smith)
- Name: Jane Smith
- Email: jane.smith@example.com
- Phone: +1 (555) 987-6543
- Location: New York, NY
- Skills: Product Strategy, Agile/Scrum, User Research, A/B Testing, SQL

### Scanned PDF Content (Robert Johnson)
- Name: Robert Johnson
- Email: robert.j@example.com
- Skills: Python, Machine Learning, Data Analysis

## Debugging Failed Tests

### 1. Check Test Output

```bash
# Run with verbose output
yarn test:e2e cv-upload --reporter=list

# Save trace for failed tests
yarn test:e2e cv-upload --trace=on
```

### 2. View Trace

```bash
# Open trace viewer
npx playwright show-trace trace.zip
```

### 3. Check Logs

- Test logs are in `apps/web/test-results/`
- Server logs show in terminal during test execution
- Check trace ID in response for debugging server-side issues

### 4. Common Issues

**Issue: "Module not found" errors**
- Solution: Run `yarn install` to ensure dependencies are installed

**Issue: Rate limit errors**
- Solution: Set `ENABLE_RATE_LIMIT=false` in test environment

**Issue: Antivirus errors**
- Solution: Set `ENABLE_ANTIVIRUS=false` or ensure ClamAV is running

**Issue: OCR timeout**
- Solution: Increase `OCR_TIMEOUT` or disable OCR in tests

**Issue: Blob upload fails**
- Solution: Ensure `BLOB_READ_WRITE_TOKEN` is set correctly

## CI/CD Integration

These tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run E2E Tests
  run: yarn test:e2e cv-upload --project=chromium
  env:
    ENABLE_ANTIVIRUS: false
    ENABLE_RATE_LIMIT: false
    BLOB_READ_WRITE_TOKEN: ${{ secrets.BLOB_TOKEN }}
```

**CI Optimizations:**
- Use single browser (chromium) for faster execution
- Disable antivirus and rate limiting
- Use fail-open security mode
- Set shorter timeouts

## Future Improvements

1. **Add macro-infected DOCX file** - Create actual DOCX with vbaProject.bin for realistic macro testing
2. **Add authenticated upload tests** - Test with auth fixtures when available
3. **Add concurrent upload tests** - Test race conditions and concurrent processing
4. **Add large file streaming** - Test chunked upload for very large files
5. **Add virus detection tests** - Test with EICAR test file when ClamAV is enabled
6. **Add OCR accuracy tests** - Compare OCR output against expected text
7. **Add performance benchmarks** - Track parsing time across different file types

## Related Files

- CV Upload API: `apps/web/src/app/api/cv/upload/route.ts`
- CV Parser Pipeline: `apps/web/src/lib/cv-parser-pipeline.ts`
- Antivirus Module: `apps/web/src/lib/antivirus.ts`
- OCR Client: `apps/web/src/lib/ocr-client.ts`
- Rate Limiting: `apps/web/src/lib/rate-limit.ts`

## Contributing

When adding new CV upload tests:

1. Follow existing test structure and naming conventions
2. Add test fixtures to `apps/web/tests/fixtures/files/`
3. Document new test scenarios in this file
4. Ensure tests are deterministic (no flaky tests)
5. Add appropriate assertions for both success and error cases
6. Include trace ID verification for debugging
