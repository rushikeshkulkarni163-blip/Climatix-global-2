# Climactix Terminal — Architecture and Implementation Record

Status as of 17 November 2026. This document records what was found in the repository, what was built, how it fits together, and what is not yet in place.

## 1. What existed before this build

| Area | Finding | Verdict |
|---|---|---|
| Terminal pages (`terminal.html`, `terminal-walkthrough*.js`, `terminal-film*.js`) | Driven by `terminal-demo-data.js` (`window.CX_TERMINAL_DEMO`): 10 hard-coded profiles, scores computed in the browser | Demonstration only. Kept unchanged as the marketing walkthrough |
| Next.js app (`climactix-global/`) `/terminal/*`, `/dashboard`, `/scenario-studio` | API routes call open climate APIs (Open-Meteo, ReliefWeb) or return seeded data; users stored in a JSON file store (`lib/db/file-store.ts`) | No company database, no document pipeline, no scoring of disclosures |
| `backend/` (FastAPI) | Auth, MFA, greenwashing scanner, materiality, green-production modules; `scorer.py` is keyword counting; migrations run every `.sql` file on every start | Separate products; nothing implements a company repository or Climactix Score |
| `intelligence_engine/` | Climate simulation engines, synthetic live stream | Out of scope for this phase (the brief excludes climate simulation) |
| `iam/` (NestJS + Keycloak) | Full IAM design; not wired to any company data | Not reused: a second runtime and identity provider would add operational load before it adds value. The Terminal's auth can be federated to it later |
| Evidence Engine (`git stash@{0}`, untracked files, 12 Nov 2026) | Tested, provenance-preserving parsers and extractors (units, KPIs, targets, signals, classification, extraction confidence) | **Reused.** Copied into `cxt/extraction/` and extended. The stash itself was left untouched |

Conclusion: the existing Terminal was a front end over fixed data. The production system was built as a new service, `terminal_platform/`, plus a new `/console` area in the Next.js app. Nothing existing was deleted; the demo walkthrough remains the public product tour.

## 2. System overview

```
Next.js /console  ──/cxt-api/* (same-origin rewrite)──►  FastAPI  cxt.main      ─┐
 (TypeScript, v4.0 design)                               97 endpoints, /api/v1   │
                                                                                 ├─ PostgreSQL 16 (Alembic migrations)
                                       Worker  cxt.cli worker  ◄── jobs table ───┤
                                       (pipeline, assessment,     SKIP LOCKED    │
                                        retrieval, maintenance)                  └─ Object store (local volume or S3)
```

- **API** (`cxt/main.py`, `cxt/routers/*`): versioned REST under `/api/v1`, Pydantic validation, structured errors `{"error": {code, message, ...}}`, OpenAPI at `/api/v1/docs`, request ids, security headers, rate limiting.
- **Worker** (`cxt/jobs.py`): a PostgreSQL-backed queue. Jobs are enqueued in the same transaction as the change that caused them; workers claim with `FOR UPDATE SKIP LOCKED`; failures retry with back-off, then surface in the review queue. No separate broker to operate.
- **Database** (`cxt/models.py`, `migrations/`): 27 tables. Status vocabularies enforced by CHECK constraints. Triggers make `audit_log` append-only and `scores` immutable except for the `is_current` flag.
- **Storage** (`cxt/storage.py`): content-addressed by SHA-256, files written `0600`, never served from a public path. Downloads go through an authorisation check.

## 3. Modules

### 01 Data ingestion — `cxt/pipeline.py`, `cxt/connectors.py`, `cxt/extraction/`
Every document passes SOURCE DISCOVERY → INGESTION → EXTRACTION → CLASSIFICATION → VALIDATION → COMPANY MAPPING → REPOSITORY, with a processing log entry per stage and status `pending / processing / completed / failed / requires_review`.

- File validation by content, not by name: magic bytes, size limit, PDF active content (JavaScript, launch actions, embedded files) rejected, macro-enabled and legacy Office formats rejected, zip-bomb guard.
- Formats: PDF (text layer, tables, OCR fallback), DOCX, XLSX, CSV (title rows above the header detected), PNG/JPEG/TIFF (OCR).
- Duplicate detection by SHA-256; a newer document for the same company, category and period supersedes the older one (versioned, history kept).
- Company mapping: declared company verified against the text, or identified from the text; ambiguous or mismatched documents go to review.
- Connectors. **Operational:** direct public URL; company web-page discovery (lists report links for an analyst to select). Both honour robots.txt, refuse private network addresses on every redirect and enforce the size limit. **Pending configuration (honest stubs that never return data):** BSE filings, NSE filings, MCA master data, licensed financial data. Each states what agreement or credential it needs.

### 02 Company database and repository — `cxt/companies.py`, `routers/companies.py`
Unique `CX-000001` identifiers from a database sequence; CIN/LEI validation; aliases; duplicate detection (exact registration, normalised name, alias, trigram similarity); CSV import; audited merge that moves every dependent record, keeps the old record as a redirect and alias, and snapshots it. The repository groups documents by financial year with search, year and category filters, preview, download and period comparison.

### 03 Extraction and normalisation — `cxt/extraction/`
Environmental, climate, social, governance and financial metrics (≈50), qualitative signals and framework references (84 patterns) and climate targets. Original value and unit are stored beside the normalised value; conversion happens only within a unit family; ambiguous units ("MT") and unstated currency scales are never guessed; forward-looking sentences are never read as reported values. Every data point records document, page, location, quote, period, method, timestamp, confidence with its factors, and verification status. Values below the confidence threshold and contradictions between sources go to human review; a contradicted metric-year is withheld from scoring until a reviewer verifies one value. Corrections never overwrite: they add a verified row that supersedes the extracted one.

### 04 Assessment — `cxt/assessment.py`, `cxt/questionnaire.py`
- **Public channel:** generated automatically whenever public evidence changes. A company has no route to edit it.
- **Company channel:** six-section questionnaire (41 questions, each mapped to a metric, signal or target). Every answer needs an evidence document or a source declaration. Draft → submitted → under review → returned/validated → scored, with per-answer evidence decisions, reviewer comments, submission history and version numbers. Only reviewer-accepted evidence is scored; other answers are listed as unverified claims.
- Companies request corrections to the public record; Climactix staff decide them.

### 05 Scoring — `cxt/methodology.py`, `cxt/scoring.py`
Six pillars at 25/20/20/15/10/10 (the reference weights; no prior approved configuration existed in the repository — `terminal-demo-data.js` uses a different five-dimension demo model, which was not carried over). 26 indicators, 13 rule types, 3 deductions.

- Three outputs kept separate: **Public Data Score**, **Company Assessment Score**, **Data Confidence Score** (coverage 40%, verification 25%, extraction reliability 20%, recency 15%; independent of performance).
- Indicator states: scored, missing disclosure, insufficient evidence, conflicting data, unverified claim. Only "scored" contributes; pillars and the overall score are re-normalised over evidenced weight and withheld below 40% / 50% coverage. A missing disclosure is never scored as zero. An explicit statement that a practice does not exist *is* scored (low).
- Each indicator is classified: poor performance / moderate / positive evidence (verified or not yet verified).
- `compute(config, evidence)` is a pure function. Each score row stores its methodology version, engine version, the full evidence snapshot and hashes; `/scores/{id}/reproduce` recomputes it. Methodology changes are new versions that a *different* Super Administrator must approve; old scores keep their version.
- Sector benchmarks are context only (min. 3 scored companies; peer intensity comparison needs 5).
- Subscription status is never an input to scoring (enforced structurally: the evidence builder reads no commercial table).

### 06–07 Company profile, Net Zero, report — `cxt/reports.py`, `/console/companies/[id]`
Profile tabs: overview, score (pillars, indicators with evidence links, confidence, movement), disclosures with provenance, repository, Net Zero, history. Net Zero keeps declared targets, source-stated validation, reported emissions and a labelled straight-line modelled path apart; progress is assessed only with a baseline value, a later reported value and a quantified target, otherwise the gap is stated. The PDF intelligence report is generated from stored data on request, stored with its hash and audited.

### 08–11 Institutional workspaces — `routers/institutional.py`
Bank, insurance and investor users share screening, comparison (up to six), private portfolios and Net Zero tracking; framing text differs per type and disclaims credit, underwriting and investment decisions. Government users see sector aggregates and disclosure coverage only, with statistics suppressed for groups under three, and the view is labelled as not an official portal.

### 12 Administration — `routers/admin.py`, `/console/admin/*`
Processing dashboard (no reports → ingested → awaiting extraction → assessment pending → score generated), document and job monitoring with retry, review queue, organisations, users, subscriptions, methodology, sectors, audit search with hash-chain verification, system status (OCR, email, LLM, connectors, payments) reported honestly.

### 13 Users, tenancy, subscriptions — `cxt/security.py`
Eight roles; permission matrix; organisation-scoped data (portfolios, private documents, submissions, generated reports); another tenant's private object returns 404. Argon2 passwords, lockout after 5 failures, single-use hashed tokens for invitations and resets, server-side sessions (revocation and user disabling take effect on the next request), short-lived JWT access tokens, httpOnly cookie with a CSRF header requirement. Plans: company annual (12 months), institutional pilot (6 months), institutional enterprise, internal; entitlements per plan and organisation type; expiry enforced on every request and swept by the maintenance job. No payment processing.

## 4. Acceptance criteria → evidence

All 17 steps are exercised in order by `tests/test_lifecycle.py::test_full_data_lifecycle` over HTTP against PostgreSQL:

| # | Criterion | Where verified |
|---|---|---|
| 1–2 | Company created with unique profile; duplicate refused | lifecycle; `test_csv_company_import` |
| 3 | Report uploaded and queued (not merely filed) | lifecycle |
| 4–5 | Processed, classified, mapped to company and year | lifecycle; `test_unassigned_upload_is_mapped_from_document_text`; mapping review tests |
| 6 | Data point traced to document, page, quote, period, method | lifecycle |
| 7 | Repository updated automatically, versioned | lifecycle; `test_new_report_for_same_period_supersedes…` |
| 8 | Assessment generated from evidence | lifecycle |
| 9 | Company submission with evidence; incomplete submission refused | lifecycle |
| 10 | Evidence accepted and rejected; reviewer verification | lifecycle; contradiction test |
| 11 | Score from the real engine; reproducible | lifecycle; `test_scoring.py` (22 tests) |
| 12 | Confidence independent of performance | `test_confidence_is_independent_of_performance` |
| 13 | History preserved across versions and methodology changes | lifecycle; methodology governance test |
| 14 | Intelligence report generated from stored data | lifecycle (PDF text checked) |
| 15 | Bank searches and reviews | lifecycle |
| 16 | Institutional and company isolation | `test_permissions.py` (15 tests) |
| 17 | Audit trail complete, append-only, chain verified | lifecycle; `test_scores_and_audit_rows_are_immutable…` |

Test suite: **62 tests, all passing** (`pytest`, ~30 s, real PostgreSQL). The console was additionally driven in a browser as a Super Administrator (22 pages) and as a bank user (8 pages, including refused admin pages).

## 5. Not yet in place

| Item | State | What it needs |
|---|---|---|
| Exchange and registry connectors (BSE, NSE, MCA, licensed financial data) | Interfaces present, marked pending | Data agreements or credentials |
| OCR in this development environment | Code path present and tested for the unavailable case; scanned files go to review | `brew install tesseract` locally; the Docker image installs it |
| LLM-assisted extraction | Configuration hook only; all extraction is rule-based and explainable | A decision on provider, prompts and validation before enabling |
| Email delivery | SMTP client present; without it, invitation and reset links are shown once to administrators | SMTP credentials |
| Payment processing | Deliberately absent | A chosen provider and approved configuration |
| Malware scanning of uploads | Content validation only (type, active content, macros, archive bombs) | ClamAV or a scanning service in front of storage |
| Rate limiting across replicas | Per-process limiter | Gateway or Redis limiter when running more than one API replica |
| Container build | Dockerfile and compose written; not built here (Docker is not installed on this machine) | `docker compose up --build` on a host with Docker |
| Real company data | Only synthetic demonstration companies are seeded | Ingesting real disclosures through the pipeline |
| Single sign-on with the existing `iam/` service | Not connected | Federation design |

The Climactix Score is an independent assessment of disclosed information. It must not be presented as a certification, a credit rating or an assurance opinion; the product copy, API description and generated report say so.
