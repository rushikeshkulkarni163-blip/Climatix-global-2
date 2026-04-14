# Climactix AI Engine v2 — Deployment Guide

## Architecture

```
Raw ESG Data (PDF / DOCX / XLSX / CSV / manual text)
    │
    ▼  POST /api/upload
    extractor.py  →  Plain text
    │
    ▼  POST /api/generate
    ai_engine.py (Claude API, max_tokens=7000)
    ├─ 1. investor_brief        Financial-grade summary
    ├─ 2. investor_output       E/S/G grade, positioning, thesis
    ├─ 3. esg_structured        Classified KPIs, data gaps, completeness
    ├─ 4. insights              What's improving / needs attention
    ├─ 5. risk_flags            High/Medium/Low severity risk cards
    ├─ 6. esg_summary           Board-ready regulatory summary
    ├─ 7. marketing_narrative   Brand story, tagline, pillars
    ├─ 8. social_media          LinkedIn / X thread / Instagram
    └─ 9. sdg_mapping           Top 5 SDGs with evidence
    │
    ▼  scorer.py
    7 scores: ESG · Environmental · Social · Governance · SDG · Readability · Quality
    │
    ├─ POST /api/export/pdf        reportlab PDF   (always works, no system deps)
    ├─ POST /api/export/html-pdf   Jinja2 + WeasyPrint premium PDF
    └─ POST /api/export/docx       python-docx DOCX
```

---

## Quick Start (Local)

```bash
# 1. Create + activate virtual environment
python3 -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate

# 2. Install core dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=sk-ant-...

# 4. Start the server
uvicorn main:app --reload --port 8000
```

- API:  `http://localhost:8000`
- Docs: `http://localhost:8000/docs`

---

## Environment Variables

| Variable            | Required | Default           | Description                               |
|---------------------|----------|-------------------|-------------------------------------------|
| `ANTHROPIC_API_KEY` | **Yes**  | —                 | Anthropic API key — console.anthropic.com |
| `CLAUDE_MODEL`      | No       | `claude-opus-4-6` | Claude model ID                           |
| `CORS_ORIGINS`      | No       | `*`               | Comma-separated allowed origins           |

---

## WeasyPrint Setup (Optional — Premium PDF)

WeasyPrint requires system-level Cairo/Pango libraries in addition to the Python package.
The standard `/api/export/pdf` (reportlab) always works without these.

**macOS:**
```bash
brew install cairo pango gdk-pixbuf libffi
pip install weasyprint jinja2
```

**Ubuntu / Debian:**
```bash
apt-get install -y libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b \
    libpangocairo-1.0-0 libcairo2 libgdk-pixbuf2.0-0
pip install weasyprint jinja2
```

**Windows:** Use WSL2 or Docker — WeasyPrint on native Windows is unsupported.

> If WeasyPrint is not installed, `POST /api/export/html-pdf` returns HTTP 500 with an install hint.

---

## API Reference

| Method | Endpoint               | Description                                      |
|--------|------------------------|--------------------------------------------------|
| GET    | `/health`              | Health check + version                           |
| POST   | `/api/upload`          | Upload PDF/DOCX/XLSX/CSV → extracted text        |
| POST   | `/upload-data`         | REST alias for `/api/upload`                     |
| POST   | `/api/generate`        | ESG text → 9 AI modules + 7 scores               |
| POST   | `/generate-insights`   | REST alias for `/api/generate`                   |
| GET    | `/investor-summary`    | Last cached investor output + risk flags         |
| GET    | `/report`              | Last cached metadata + export links              |
| POST   | `/api/export/pdf`      | reportlab PDF (always available)                 |
| POST   | `/api/export/html-pdf` | Jinja2 + WeasyPrint premium PDF                  |
| POST   | `/api/export/docx`     | DOCX report                                      |

### POST /api/generate — Request
```json
{
  "text": "Raw ESG data or extracted file text",
  "company_name": "Acme Corp",
  "report_year": "2024"
}
```

### POST /api/generate — Response (abbreviated)
```json
{
  "success": true,
  "narratives": {
    "investor_brief":       { "headline": "...", "key_metrics": [...], "risks": [...] },
    "investor_output":      { "esg_grade": "B+", "e_score_rationale": "...", ... },
    "esg_structured":       { "environmental": { "kpis": [...], "missing_fields": [...] }, ... },
    "insights":             { "improving": [...], "needs_attention": [...] },
    "risk_flags":           [{ "title": "...", "severity": "High", "mitigation": "..." }],
    "esg_summary":          { "executive_summary": "...", "forward_guidance": "..." },
    "marketing_narrative":  { "tagline": "...", "brand_pillars": [...] },
    "social_media":         { "linkedin": "...", "twitter_thread": [...] },
    "sdg_mapping":          { "top_sdgs": [...], "alignment_summary": "..." }
  },
  "scores": {
    "esg_score": 74, "environmental_score": 71,
    "social_score": 68, "governance_score": 76,
    "sdg_alignment": 82, "readability": 88, "content_quality": 91
  }
}
```

---

## Sample Data

A ready-to-use demo dataset is included:

```
backend/sample_data/greengrid_esg_2024.csv
```

Upload this CSV via the AI Engine page (`climactix-ai.html`) for a full end-to-end demo.

---

## Report Templates

```
backend/templates/esg_report.html
```

Premium 9-section BCG-style PDF template rendered with Jinja2 → WeasyPrint.
Template variables: `company_name`, `report_year`, `report_title`, `narratives`, `scores`,
`investor_output`, `generated_date`.

---

## Frontend Pages

| Page                 | Role                                                |
|----------------------|-----------------------------------------------------|
| `climactix-ai.html`  | Main AI Engine — full 9-module pipeline + downloads |
| `assessment.html`    | ERI 2.0 self-assessment → "Analyse with AI" bridge  |
| `dashboard.html`     | Bloomberg-style dashboard with live AI data toggle  |

**Assessment → AI flow:**
1. User completes assessment → clicks "Analyse with AI Engine"
2. Answers serialised to ESG text → stored in `sessionStorage`
3. `climactix-ai.html` picks up prefill on load, shows notice, ready to generate

**Dashboard live data:**
- Click "✦ Load AI Data" in topbar → fetches `GET /investor-summary`
- Overlays E/S/G scores, grade, and investment thesis onto the dashboard
- Click "AI LIVE · Reset" to return to demo data

---

## Deployment: Railway

Create `railway.toml` at repo root:
```toml
[build]
  builder = "NIXPACKS"

[deploy]
  startCommand = "cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT"
  healthcheckPath = "/health"
  restartPolicyType = "ON_FAILURE"
```

Set `ANTHROPIC_API_KEY` in Railway environment variables.

---

## Deployment: Render

1. New Web Service → connect repo
2. Root directory: `backend`
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add env var: `ANTHROPIC_API_KEY`

---

## Deployment: Docker

```dockerfile
FROM python:3.11-slim

# WeasyPrint system libs (remove block if not using /api/export/html-pdf)
RUN apt-get update && apt-get install -y \
    libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b \
    libpangocairo-1.0-0 libcairo2 libgdk-pixbuf2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
docker build -t climactix-ai .
docker run -p 8000:8000 -e ANTHROPIC_API_KEY=sk-ant-... climactix-ai
```

---

## Production Checklist

- [ ] `ANTHROPIC_API_KEY` set in environment
- [ ] `CORS_ORIGINS` set to your frontend domain (not `*`)
- [ ] WeasyPrint system libraries installed (for premium PDF)
- [ ] Frontend AI Engine page API URL updated to deployed backend
- [ ] HTTPS enabled on deployment platform
- [ ] Rate limiting configured at platform or reverse proxy level
