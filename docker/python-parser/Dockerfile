FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-deu \
    tesseract-ocr-slk \
    tesseract-ocr-ces \
    tesseract-ocr-pol \
    poppler-utils \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy parser script
COPY parser.py .

# Create non-root user
RUN useradd -m -u 1001 parser && \
    chown -R parser:parser /app

# Create temp directory for file processing
RUN mkdir -p /tmp/parser && chown parser:parser /tmp/parser

USER parser

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD python -c "print('healthy')" || exit 1

ENTRYPOINT ["python", "parser.py"]
