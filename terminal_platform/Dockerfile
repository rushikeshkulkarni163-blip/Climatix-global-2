# Climactix Terminal service — API and worker share this image.
FROM python:3.12-slim

# Tesseract provides OCR for scanned PDFs and image documents.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng postgresql-client \
 && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 10001 cxt
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY cxt ./cxt
COPY migrations ./migrations
COPY alembic.ini ./
COPY scripts ./scripts
RUN mkdir -p /data/documents && chown -R cxt /data /app
USER cxt

ENV TERMINAL_STORAGE_DIR=/data/documents PYTHONUNBUFFERED=1
EXPOSE 8100
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8100/api/v1/health').status==200 else 1)"
# Migrations run before the API starts; they are idempotent.
CMD ["sh", "-c", "alembic upgrade head && uvicorn cxt.main:app --host 0.0.0.0 --port 8100 --proxy-headers --workers 2"]
