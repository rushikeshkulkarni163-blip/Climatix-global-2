# Climactix AI — Backend Deployment Guide

## Quick Start (Local Development)

```bash
# 1. Create virtual environment
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# 4. Start server
uvicorn main:app --reload --port 8000
```

Server runs at: `http://localhost:8000`

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | — | Your Anthropic API key from console.anthropic.com |
| `CLAUDE_MODEL` | No | `claude-opus-4-6` | Claude model to use |
| `CORS_ORIGINS` | No | `*` | Allowed CORS origins |
| `HOST` | No | `0.0.0.0` | Server host |
| `PORT` | No | `8000` | Server port |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/upload` | Upload ESG document (PDF/DOCX/XLSX) |
| `POST` | `/api/generate` | Generate all ESG narratives |
| `POST` | `/api/export/pdf` | Export results as PDF |
| `POST` | `/api/export/docx` | Export results as DOCX |

### Example: Generate narratives

```bash
curl -X POST http://localhost:8000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"text": "Your ESG report text here...", "company_name": "Acme Corp", "report_year": "2024"}'
```

---

## Production Deployment

### Railway
1. Push repo to GitHub
2. Connect repo in Railway dashboard
3. Add environment variables in Railway settings
4. Deploy

### Render
1. New Web Service → connect GitHub repo
2. Build command: `pip install -r requirements.txt`
3. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables

### Docker
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `ANTHROPIC_API_KEY not set` | Add your key to `backend/.env` file |
| `pymupdf` import error | Run `pip install pymupdf` |
| CORS errors in browser | Check `CORS_ORIGINS` env var |
| PDF upload fails | Check file size < 10 MB |
| Backend offline in UI | Enter correct URL in API config bar |
