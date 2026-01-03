# Security Tests

Comprehensive security test suite for JobSphere ATS platform.

## Overview

This directory contains security-focused tests that validate the multi-layered security controls protecting the CV upload pipeline from malicious files and attacks.

## Test Coverage

### 1. File Size Validation (`File Size Validation`)
- **Oversized file rejection** - Validates files exceeding `MAX_FILE_SIZE` (default: 10MB) are rejected
- **Custom limits** - Tests respect for custom `MAX_FILE_SIZE` environment variable
- **Valid size acceptance** - Ensures legitimate files pass validation

### 2. VBA Macro Detection (`VBA Macro Detection`)
- **Macro-infected DOCX detection** - Identifies and rejects DOCX files containing `vbaProject.bin`
- **Clean DOCX acceptance** - Allows DOCX files without macros
- **Error reporting** - Validates proper error codes (`FILE_HAS_MACROS`)

### 3. MIME Type Validation (`MIME Type Validation`)
- **Extension spoofing prevention** - Detects executables disguised as PDFs
- **Magic byte verification** - Uses `file-type` library to verify actual file type
- **DOCX/ZIP handling** - Correctly handles DOCX as ZIP archives
- **Fail modes** - Tests fail-open (dev) vs fail-closed (production) behavior

### 4. ClamAV Malware Detection (`ClamAV Malware Detection`)
- **EICAR test virus** - Validates detection of standard AV test signatures
- **Clean file passage** - Ensures legitimate files pass AV scan
- **Fail-closed mode** - Rejects files when AV unavailable in production
- **Fail-open mode** - Allows files when AV unavailable in dev (with warnings)
- **Configuration respect** - Tests `ENABLE_ANTIVIRUS` and `ANTIVIRUS_FAIL_MODE` settings

### 5. Filename Sanitization (`Filename Sanitization`)
- **Path traversal attacks** - Blocks filenames like `../../../etc/passwd.pdf`
- **XSS payloads** - Sanitizes `<script>alert("XSS")</script>.pdf`
- **Unicode handling** - Processes international characters gracefully
- **Length limits** - Handles extremely long filenames (300+ chars)

### 6. Complete Security Pipeline (`Complete Security Pipeline`)
- **Multi-check orchestration** - Validates all security checks execute in order
- **Failure handling** - Ensures any single check failure rejects the file
- **Error details** - Verifies detailed error information for debugging
- **Audit logging** - Confirms security events are logged

### 7. Rate Limiting (`Rate Limiting`)
- **Upload throttling** - Validates rate limiting is applied (10 uploads per 5 min)

### 8. Integration Tests (`Integration Tests`)
- **End-to-end valid upload** - Full flow for legitimate CV
- **End-to-end rejection** - Full flow for each attack vector
- **Error responses** - Validates API error codes and messages

## Test Fixtures

### Malicious File Generators

All test fixtures are **generated programmatically** (not stored as files) to prevent:
- Accidental execution
- Version control pollution
- AV false positives on the repository

#### 1. `createOversizedFile()`
Creates an 11MB PDF to test size validation.

```typescript
// Usage
const file = createOversizedFile()
// Result: 11MB buffer exceeding 10MB limit
```

#### 2. `createMacroInfectedDocx()`
Generates a DOCX file with `word/vbaProject.bin` to simulate macro infection.

```typescript
// Usage
const file = await createMacroInfectedDocx()
// Result: DOCX with VBA macro binary
```

#### 3. `createSpoofedExecutable()`
Creates a file with MZ header (executable) but declared as PDF.

```typescript
// Usage
const file = createSpoofedExecutable()
// Result: Executable disguised as PDF
```

#### 4. `createPathTraversalFile()`
Generates a file with path traversal in filename.

```typescript
// Usage
const file = createPathTraversalFile()
// Filename: ../../../etc/passwd.pdf
```

#### 5. `createXSSFilename()`
Creates a file with XSS payload in filename.

```typescript
// Usage
const file = createXSSFilename()
// Filename: <script>alert("XSS")</script>.pdf
```

#### 6. `createValidPDF()`
Generates a minimal valid PDF for baseline testing.

```typescript
// Usage
const file = createValidPDF()
// Result: Valid PDF with "John Doe" text
```

#### 7. `createEICARTestVirus()`
Creates EICAR standard AV test file (safe, recognized by all AV software).

```typescript
// Usage
const file = createEICARTestVirus()
// Result: EICAR test signature
```

## Running Tests

### Run all security tests
```bash
cd apps/web
yarn test tests/security/
```

### Run with coverage
```bash
yarn test tests/security/ --coverage
```

### Run specific test suite
```bash
yarn test tests/security/cv-upload-security.test.ts
```

### Run with ClamAV (requires Docker)
```bash
# Start ClamAV service
docker-compose up -d clamav

# Run tests
ENABLE_ANTIVIRUS=true yarn test tests/security/
```

### Run without ClamAV (skips AV tests)
```bash
ENABLE_ANTIVIRUS=false yarn test tests/security/
```

## Environment Variables

Tests respect the following environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_FILE_SIZE` | `10485760` | Maximum file size in bytes (10MB) |
| `ENABLE_ANTIVIRUS` | `true` | Enable ClamAV scanning |
| `ANTIVIRUS_FAIL_MODE` | `closed` (prod) / `open` (dev) | Behavior when AV unavailable |
| `CLAMAV_HOST` | `localhost` | ClamAV daemon host |
| `CLAMAV_PORT` | `3310` | ClamAV daemon port |

## Test Timeouts

- **Default tests**: 5 seconds
- **ClamAV tests**: 10 seconds (AV scanning is slower)

## Security Test Checklist

Before deploying CV upload changes, ensure:

- [ ] All file size validation tests pass
- [ ] VBA macro detection works
- [ ] MIME spoofing is prevented
- [ ] ClamAV integration works (if enabled)
- [ ] Filename sanitization blocks path traversal
- [ ] XSS payloads are neutralized
- [ ] Rate limiting is enforced
- [ ] Error messages don't leak sensitive info
- [ ] Audit logs capture security events

## Related Documentation

- [CV Parser Pipeline](../../src/lib/cv-parser-pipeline.ts) - Multi-stage parsing with fallbacks
- [Antivirus Module](../../src/lib/antivirus.ts) - ClamAV integration and MIME verification
- [CV Upload API](../../src/app/api/cv/upload/route.ts) - Upload endpoint with security checks
- [CLAUDE.md](../../../../CLAUDE.md) - Project-wide security guidelines

## Security Incidents

If a test fails in production:

1. **Immediate Action**: Check if a malicious file bypassed security
2. **Investigation**: Review audit logs for the failed upload
3. **Mitigation**: Update security checks to catch the new attack vector
4. **Testing**: Add new test case for the discovered vulnerability
5. **Deployment**: Deploy security patch immediately

## Contributing

When adding new security tests:

1. Create fixture generator function (don't commit actual files)
2. Test both positive (should block) and negative (should allow) cases
3. Verify error codes and messages
4. Document the attack vector in this README
5. Update security checklist if needed

## Known Limitations

- **ClamAV availability**: Tests skip AV checks if ClamAV is not running
- **Magic byte detection**: `file-type` library has finite signature database
- **Filename sanitization**: Tests assume Vercel Blob handles storage-level sanitization
- **Rate limiting**: Full rate limit testing requires E2E tests (multiple rapid requests)

## False Positives

Some legitimate files may trigger security checks:

- **Password-protected PDFs**: Rejected as encrypted files
- **Scanned documents**: May fail text extraction (triggers metadata fallback)
- **Large CVs with images**: May exceed size limit

These are **expected rejections** with user-friendly error messages.

## Compliance

These security tests help ensure compliance with:

- **GDPR**: Protects candidate PII from malicious uploads
- **SOC 2**: Demonstrates security controls and audit trails
- **ISO 27001**: File upload security best practices
