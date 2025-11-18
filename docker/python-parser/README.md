# Python CV Parser with OCR

Standalone Python service for extracting text from CV files with OCR fallback.

## Features

- **PDF text extraction** using PyMuPDF (fast)
- **OCR fallback** for scanned PDFs using Tesseract
- **DOCX extraction** using python-docx
- **Multi-language support**: EN, DE, SK, CS, PL
- **Image processing**: PNG, JPG, TIFF, BMP

## Usage

### Build Docker Image

```bash
cd docker/python-parser
docker build -t jobsphere-python-parser .
```

### Run as CLI

```bash
# Text-based PDF
docker run --rm -v "$(pwd):/data" jobsphere-python-parser \
  --file /data/resume.pdf --output-json

# Scanned PDF with Slovak OCR
docker run --rm -v "$(pwd):/data" jobsphere-python-parser \
  --file /data/scanned.pdf --lang slk --output-json

# Force OCR even if text exists
docker run --rm -v "$(pwd):/data" jobsphere-python-parser \
  --file /data/resume.pdf --force-ocr --output-json
```

### Output Format

```json
{
  "text": "John Doe\nSoftware Engineer\n...",
  "method": "ocr_tesseract",
  "length": 1234,
  "success": true,
  "lang": "eng"
}
```

### Error Output

```json
{
  "text": "",
  "method": "error",
  "length": 0,
  "success": false,
  "error": "OCR extraction failed: ..."
}
```

## Tesseract Language Codes

- `eng` - English
- `deu` - German
- `slk` - Slovak
- `ces` - Czech
- `pol` - Polish

## Integration with Node.js

The parser is called from Node.js via file-based IPC:

1. Node.js saves file to `/tmp/parser/{requestId}.pdf`
2. Runs Docker container with volume mount
3. Parses JSON output from stdout
4. Cleans up temp file

## Performance

- **Text extraction**: ~100ms per page
- **OCR**: ~2-3s per page (300 DPI)
- **Memory**: ~512MB peak during OCR

## Troubleshooting

### Low OCR Quality

- Increase DPI: `convert_from_path(file, dpi=400)`
- Preprocess image: grayscale, denoise, sharpen
- Try different language models

### Missing Tesseract Models

```bash
# Download additional language data
apt-get install tesseract-ocr-{lang}

# Or manually download from
# https://github.com/tesseract-ocr/tessdata
```

### Permission Errors

Ensure parser user (UID 1001) can read input files:

```bash
chmod 644 input.pdf
```
