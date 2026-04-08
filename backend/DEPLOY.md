# Climactix AI Backend — Deployment Guide

## Local Development (5 minutes)

### 1. Prerequisites
- Python 3.10+
- An Anthropic API key → https://console.anthropic.com

### 2. Setup

```bash
# From the project root
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and paste your ANTHROPIC_API_KEY
```

### 3. Start the server

```bash
uvicorn main:app --reload --port 8000
```

The API is now running at **http://localhost:8000**

### 4. Open the frontend

Open `climactix-ai.html` in your browser (or serve via any static file server):

```bash
# Simple static server from project root
python -m http.server 3000
# Then visit http://localhost:3000/climactix-ai.html
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/upload` | Upload PDF/DOCX/XLSX → extracted text |
| POST | `/api/generate` | ESG text → narratives + scores |
| POST | `/api/export/pdf` | Narratives → PDF download |
| POST | `/api/export/docx` | Narratives → DOCX download |

### Example: Generate narratives

```bash
curl -X POST http://localhost:8000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Scope 1 emissions: 18,450 tCO2e (-11%). Renewable energy: 42%. TRIR: 0.38.",
    "company_name": "Acme Corp",
    "report_year": "2024"
  }'
```

---

## Production Deployment

### Option A: Railway (recommended, free tier)

1. Push `backend/` to a GitHub repo
2. Connect to [Railway](https://railway.app)
3. Add env var: `ANTHROPIC_API_KEY=your_key`
4. Deploy — Railway auto-detects FastAPI

Update `API_URL` in `climactix-ai.html`:
```js
const DEFAULT_API = 'https://your-app.railway.app';
```

### Option B: Render

1. New Web Service → connect GitHub repo
2. Build command: `pip install -r requirements.txt`
3. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add env var: `ANTHROPIC_API_KEY`

### Option C: Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
docker build -t climactix-ai .
docker run -e ANTHROPIC_API_KEY=your_key -p 8000:8000 climactix-ai
```

---

## CORS Configuration

For production, set `CORS_ORIGINS` in `.env` to your frontend domain:

```
CORS_ORIGINS=https://climactixglobal.com,https://www.climactixglobal.com
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `ANTHROPIC_API_KEY not set` | AYOUR_API_KEY_HERE
| `pymupdf` import error | Run `pip install pymupdf` |
| CORS errors in browser | Check `CORS_ORIGINS` env var |
| PDF upload fails | Check file size < 10 MB |
| Backend offline in UI | Enter correct URL in API config bar |
