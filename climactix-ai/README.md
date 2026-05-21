# Climactix AI Core v1

**Climate Risk Intelligence Infrastructure**

Institutional-grade multi-agent AI system for climate risk analysis, ESG disclosure interpretation, transition risk modeling, and climate finance intelligence.

**Stack:** LangGraph · OpenAI GPT-4o · FastAPI · Qdrant · Python 3.11

---

## Architecture

```
climactix-ai/
├── app/
│   ├── agents/           # LangGraph ReAct agents
│   │   └── climate_agent.py    ← PRIMARY: Climate Intelligence Agent
│   ├── orchestration/    # Multi-agent routing graph
│   │   └── graph.py            ← Query classifier + agent router
│   ├── retrieval/        # Vector store (Qdrant)
│   │   └── qdrant_client.py    ← ESG document embeddings + search
│   ├── services/         # External service clients
│   │   └── openai_service.py   ← Embeddings + completions
│   ├── routes/           # FastAPI route handlers
│   │   └── query.py            ← POST /api/v1/query
│   ├── schemas/          # Pydantic request/response models
│   └── utils/
│       └── logger.py           ← Structured logging
├── data/                 # ESG documents for ingestion (Phase 2)
├── tests/                # pytest test suite
├── scripts/
│   └── setup.sh          ← One-shot environment setup
├── .env                  ← API keys (never commit)
├── main.py               ← FastAPI server entry point
├── requirements.txt
└── docker-compose.yml    ← Qdrant + API server
```

---

## Quick Start (5 minutes)

### Step 1 — Open the folder in VS Code

```
File → Open Folder → select climactix-ai/
```

### Step 2 — Open the VS Code terminal

```
Terminal → New Terminal   (or Ctrl + `)
```

### Step 3 — Run the setup script

```bash
bash scripts/setup.sh
```

This creates a virtual environment and installs all packages automatically.

### Step 4 — Add your OpenAI API key

Open `.env` and fill in your key:

```
OPENAI_API_KEY=sk-...your-key-here...
```

Get a key at: https://platform.openai.com/api-keys

### Step 5 — Activate the virtual environment

```bash
source .venv/bin/activate
```

Your terminal prompt will show `(.venv)` when active.

### Step 6 — Start the server

```bash
uvicorn main:app --reload --port 8000
```

You should see:
```
INFO  Climactix AI Core v1 — starting up
INFO  Uvicorn running on http://0.0.0.0:8000
```

### Step 7 — Open the API documentation

Go to: **http://localhost:8000/docs**

This is the interactive Swagger UI where you can send queries directly from your browser.

---

## Sending Your First Climate Query

### Option A — Browser (Swagger UI)

1. Open http://localhost:8000/docs
2. Click `POST /api/v1/query`
3. Click `Try it out`
4. Enter a query and click `Execute`

### Option B — Terminal (curl)

```bash
curl -X POST http://localhost:8000/api/v1/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is transition risk and how does it affect oil & gas companies under the IEA Net Zero 2050 scenario?"}'
```

### Option C — Python

```python
import httpx

response = httpx.post(
    "http://localhost:8000/api/v1/query",
    json={"query": "Explain TCFD scenario analysis requirements for a financial institution."}
)
print(response.json()["answer"])
```

---

## Example Queries

```
"What is transition risk?"

"Explain TCFD disclosure requirements for a bank."

"What are the physical climate risks for coastal infrastructure in Southeast Asia?"

"Estimate carbon cost exposure for a steel company with $10B annual revenue."

"What is the difference between CSRD and ISSB S2?"

"How does the EU Taxonomy define climate change adaptation?"

"What is a Science Based Target and how does a company set one?"

"Explain the difference between Scope 1, 2, and 3 emissions."
```

---

## Running Tests

```bash
# Activate venv first
source .venv/bin/activate

# Run all tests
pytest tests/ -v

# Run without network calls (tool-level tests only)
pytest tests/test_climate_agent.py::test_climate_tools_callable -v
pytest tests/test_climate_agent.py::test_orchestrator_classifier -v
```

---

## Starting Qdrant (Vector Store)

Qdrant is optional for Phase 1. The server runs in LLM-only mode if Qdrant is unavailable.

To start Qdrant locally via Docker:

```bash
docker compose up qdrant -d
```

Qdrant dashboard: **http://localhost:6333/dashboard**

---

## Full Docker Stack

To run the entire stack (API server + Qdrant) in Docker:

```bash
# Build and start
docker compose up --build -d

# View logs
docker compose logs -f climactix_ai

# Stop
docker compose down
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | Yes | — | OpenAI API key |
| `QDRANT_URL` | No | `http://localhost:6333` | Qdrant server URL |
| `QDRANT_API_KEY` | No | — | Qdrant Cloud API key |
| `AGENT_MODEL` | No | `gpt-4o` | OpenAI model for agent |
| `AGENT_TEMPERATURE` | No | `0.1` | LLM temperature (0.0–1.0) |
| `AGENT_MAX_TOKENS` | No | `2048` | Max response tokens |
| `APP_PORT` | No | `8000` | Server port |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Server + vector store status |
| `POST` | `/api/v1/query` | Submit climate intelligence query |
| `GET` | `/docs` | Swagger interactive API docs |
| `GET` | `/redoc` | ReDoc API documentation |

---

## Phase 2 Roadmap

The architecture is designed for clean expansion:

| Component | Phase 2 Addition |
|---|---|
| `app/agents/` | Specialized agents: `physical_risk_agent.py`, `esg_agent.py`, `finance_agent.py` |
| `app/retrieval/` | PDF ingestion pipeline — parse TCFD reports, IPCC chapters |
| `app/orchestration/` | LLM-based query classifier replacing keyword routing |
| `data/` | ESG document corpus for RAG (Scope 3 reports, IPCC AR6, NGFS scenarios) |
| Database | Neo4j knowledge graph for climate entity relationships |
| Streaming | WebSocket endpoint for streaming agent responses |

---

## Troubleshooting

**`OPENAI_API_KEY not set`**
→ Open `.env` and add your OpenAI key. Make sure `.env` is in the `climactix-ai/` folder.

**`ModuleNotFoundError`**
→ Your virtual environment is not activated. Run: `source .venv/bin/activate`

**`Address already in use: port 8000`**
→ Something else is using port 8000. Try: `uvicorn main:app --reload --port 8001`

**`Qdrant unavailable`**
→ This is expected if you haven't started Docker. The server still works — just without vector retrieval.

**Packages fail to install**
→ Try: `pip install --upgrade pip` then `pip install -r requirements.txt` again.

---

*Climactix Global — Climate Risk Intelligence Infrastructure*
