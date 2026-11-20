# Climactix Terminal — service

Corporate sustainability and climate intelligence: company records, a company-wise report repository, document extraction with provenance, assessments, the Climactix Score and institutional workspaces. The user interface is the `/console` area of the Next.js app in `../climactix-global`.

Architecture, module map, acceptance-criteria evidence and open items: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Deployment: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Run locally

Requirements: Python 3.11+, PostgreSQL 16 with `pg_trgm`, Node 18+ for the console. Optional: Tesseract for OCR.

```sh
cd terminal_platform
python3.12 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
createdb climactix_terminal
.venv/bin/alembic upgrade head
.venv/bin/python -m cxt.cli create-admin --email you@yourorg.com --name "Your Name"
.venv/bin/python -m cxt.cli seed-demo         # optional: four SYNTHETIC companies with generated reports
.venv/bin/uvicorn cxt.main:app --port 8100    # API, docs at http://localhost:8100/api/v1/docs
.venv/bin/python -m cxt.cli worker            # second terminal: processes uploads and assessments

cd ../climactix-global
TERMINAL_API_URL=http://localhost:8100 npx next dev   # console at http://localhost:3000/console
```

Settings come from `TERMINAL_*` environment variables or `terminal_platform/.env` (see `.env.example`). In development the JWT secret is random per process, so restarting the API signs everyone out.

## Test

```sh
createdb climactix_terminal_test
.venv/bin/python -m pytest          # 62 tests against PostgreSQL; the schema is rebuilt from migrations
```

The suite refuses to run against a database whose URL does not contain `test`.

## Commands

| Command | Purpose |
|---|---|
| `python -m cxt.cli init` | Install methodology v1.0 and the Climactix organisation |
| `python -m cxt.cli create-admin` | First Super Administrator |
| `python -m cxt.cli worker` | Background worker (run at least one) |
| `python -m cxt.cli drain` | Process the queue once and exit |
| `python -m cxt.cli seed-demo` | Synthetic demonstration data |
| `python -m cxt.cli verify-audit` | Verify the audit hash chain |
| `scripts/backup.sh <dir>` / `--restore <dir>` | Database and document backup with checksums |

## Layout

```
cxt/
  main.py            app, middleware, error handling
  config.py db.py    settings, sessions
  models.py          schema (27 tables)
  security.py        authentication, roles, tenancy, entitlements
  audit.py           append-only, hash-chained audit trail
  storage.py         content-addressed object storage
  companies.py       records, duplicates, identification, merge
  pipeline.py        seven-stage document workflow, provenance, contradictions
  connectors.py      public-source retrieval (operational and pending connectors)
  jobs.py            PostgreSQL work queue and handlers
  extraction/        parsers, units, KPIs, targets, signals, classification, confidence
  methodology.py     versioned methodology configuration and governance
  scoring.py         pure, reproducible scoring engine
  assessment.py      evidence snapshots, public and company assessments, benchmarks
  questionnaire.py   company questionnaire v1.0
  reports.py         Net Zero view and PDF intelligence report
  routers/           auth, companies, assessments, institutional, admin
migrations/          Alembic
tests/               62 tests; fixtures/make_samples.py generates synthetic reports
```
