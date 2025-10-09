#!/usr/bin/env python3
"""
CV Parser CLI with OCR support
Extracts text from PDF, DOCX, and image-based documents
"""

import sys
import json
import argparse
from pathlib import Path
import tempfile
import pytesseract
from pdf2image import convert_from_path
import fitz  # PyMuPDF
from docx import Document
from PIL import Image


def parse_pdf_text(file_path):
    """Try text extraction first using PyMuPDF"""
    try:
        doc = fitz.open(file_path)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        return text.strip()
    except Exception as e:
        raise ValueError(f"PyMuPDF extraction failed: {str(e)}")


def parse_pdf_ocr(file_path, lang='eng'):
    """OCR fallback for scanned PDFs using Tesseract"""
    try:
        # Convert PDF to images (300 DPI for better OCR)
        images = convert_from_path(file_path, dpi=300)

        text = ""
        for i, img in enumerate(images):
            # Preprocess image for better OCR
            # (grayscale conversion happens automatically in pytesseract)
            page_text = pytesseract.image_to_string(img, lang=lang)
            text += page_text + "\n\n"

        return text.strip()
    except Exception as e:
        raise ValueError(f"OCR extraction failed: {str(e)}")


def parse_docx(file_path):
    """DOCX text extraction"""
    try:
        doc = Document(file_path)
        text = "\n".join([para.text for para in doc.paragraphs])
        return text.strip()
    except Exception as e:
        raise ValueError(f"DOCX extraction failed: {str(e)}")


def parse_image(file_path, lang='eng'):
    """Extract text from image file using OCR"""
    try:
        img = Image.open(file_path)
        text = pytesseract.image_to_string(img, lang=lang)
        return text.strip()
    except Exception as e:
        raise ValueError(f"Image OCR failed: {str(e)}")


def main():
    parser = argparse.ArgumentParser(
        description='Extract text from CV files (PDF, DOCX, images) with OCR support'
    )
    parser.add_argument('--file', required=True, help='Path to CV file')
    parser.add_argument(
        '--lang',
        default='eng',
        help='Tesseract language code (eng, deu, slk, ces, pol)'
    )
    parser.add_argument(
        '--output-json',
        action='store_true',
        help='Output result as JSON'
    )
    parser.add_argument(
        '--force-ocr',
        action='store_true',
        help='Force OCR even if text extraction works'
    )
    args = parser.parse_args()

    file_path = Path(args.file)

    if not file_path.exists():
        result = {
            'text': '',
            'method': 'error',
            'length': 0,
            'success': False,
            'error': f'File not found: {file_path}'
        }
        print(json.dumps(result), file=sys.stderr)
        sys.exit(1)

    try:
        text = ""
        method = "unknown"

        # Determine file type and parse
        suffix = file_path.suffix.lower()

        if suffix == '.pdf':
            # Try text extraction first unless forced OCR
            if not args.force_ocr:
                text = parse_pdf_text(file_path)
                method = 'pymupdf'

            # OCR if no text or forced
            if len(text) < 50 or args.force_ocr:
                text = parse_pdf_ocr(file_path, args.lang)
                method = 'ocr_tesseract'

        elif suffix in ['.docx', '.doc']:
            text = parse_docx(file_path)
            method = 'docx'

        elif suffix in ['.png', '.jpg', '.jpeg', '.tiff', '.bmp']:
            text = parse_image(file_path, args.lang)
            method = 'ocr_image'

        else:
            raise ValueError(f"Unsupported file format: {suffix}")

        # Build result
        result = {
            'text': text,
            'method': method,
            'length': len(text),
            'success': True,
            'lang': args.lang
        }

        if args.output_json:
            print(json.dumps(result, ensure_ascii=False))
        else:
            print(text)

    except Exception as e:
        result = {
            'text': '',
            'method': 'error',
            'length': 0,
            'success': False,
            'error': str(e)
        }

        if args.output_json:
            print(json.dumps(result), file=sys.stderr)
        else:
            print(f"ERROR: {str(e)}", file=sys.stderr)

        sys.exit(1)


if __name__ == '__main__':
    main()
