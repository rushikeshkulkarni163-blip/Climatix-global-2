# CLIMACTIX GLOBAL — NARRATIVE INTELLIGENCE ENGINE
## Global Semantic Discovery, Knowledge Graph & Predictive Narrative Architecture
### Version 1.0 — Confidential Internal Document — Companion to `ARCHITECTURE.md`

---

> **Classification:** Internal Architecture — Not for distribution
> **Quality Standard:** Bloomberg Terminal · Palantir Gotham · Dataminr · AlphaSense · Refinitiv · BlackRock Aladdin
> **Platform Identity:** The narrative-understanding layer of the Climate Risk Intelligence Operating System
> **Supersedes:** `intelligence_engine/api/narrative_router.py` (v1 stub — sentiment/pulse mocks) becomes the **serving layer** for this engine; every endpoint it exposes must be backed by the pipelines defined here before it is considered production. `platform-narrative.html` is the Greenwashing & Narrative *Credibility* scanner (System 4) — a downstream consumer of this engine's entity/claim graph, not a duplicate of it.

---

## EXECUTIVE SUMMARY

The Narrative Intelligence Engine (NIE) is Climactix Global's global semantic understanding layer. It continuously reads the world's climate-, ESG-, energy-, supply-chain-, and policy-relevant information — news, filings, regulatory text, scientific literature, satellite-derived signals, capital markets data, and compliant social discourse — and converts it into structured, explainable, continuously-scored **narratives**: durable, evolving stories about *why something is happening in the world*, who is driving it, who is exposed to it, and what it is likely to do next.

NIE does not search for keywords. It builds a semantic model of the world's climate-relevant discourse, clusters independent signals into coherent narratives without predefined taxonomies, tracks each narrative's lifecycle from first mention to mainstream saturation, and feeds every other Climactix engine (C-LAYER scoring, Investor Terminal, Enterprise Dashboard, Disclosure Generator, Greenwashing Scanner) with real-time, evidence-linked context.

This document specifies the 15 architectural deliverables required to take NIE from stub to institutional-grade production system:

1. Complete System Architecture
2. AI Workflow Architecture
3. Data Pipeline Architecture
4. Narrative Detection Methodology
5. Knowledge Graph Architecture
6. Database Architecture
7. AI Agent Architecture
8. Event Processing Workflow
9. Real-Time Scoring Methodology
10. Predictive Intelligence Framework
11. Enterprise UI Specification
12. Technology Stack
13. Cloud Deployment Architecture
14. Security Architecture
15. Scalability Strategy

---

## TABLE OF CONTENTS

1. [Complete System Architecture](#1-complete-system-architecture)
2. [AI Workflow Architecture](#2-ai-workflow-architecture)
3. [Data Pipeline Architecture](#3-data-pipeline-architecture)
4. [Narrative Detection Methodology](#4-narrative-detection-methodology)
5. [Knowledge Graph Architecture](#5-knowledge-graph-architecture)
6. [Database Architecture](#6-database-architecture)
7. [AI Agent Architecture](#7-ai-agent-architecture)
8. [Event Processing Workflow](#8-event-processing-workflow)
9. [Real-Time Scoring Methodology](#9-real-time-scoring-methodology)
10. [Predictive Intelligence Framework](#10-predictive-intelligence-framework)
11. [Enterprise UI Specification](#11-enterprise-ui-specification)
12. [Technology Stack](#12-technology-stack)
13. [Cloud Deployment Architecture](#13-cloud-deployment-architecture)
14. [Security Architecture](#14-security-architecture)
15. [Scalability Strategy](#15-scalability-strategy)
16. [Implementation Roadmap](#16-implementation-roadmap)

---

## 1. COMPLETE SYSTEM ARCHITECTURE

### 1.1 Core Design Principles

**Principle 1 — Meaning, not keywords.** Every document is embedded into semantic space and mapped to a taxonomy of climate mechanisms (hazards, transition levers, financial channels), not string-matched. "Insurance losses rising in coastal Florida" and "reinsurers withdrawing from cyclone-exposed markets" must resolve to the same underlying mechanism (physical risk repricing) even sharing zero keywords.

**Principle 2 — Narratives are discovered, not defined.** No hardcoded narrative taxonomy. Narratives emerge from unsupervised clustering over rolling document embeddings, validated by statistical significance (volume, source diversity, growth rate) before being promoted to a tracked entity.

**Principle 3 — Every conclusion is explainable.** No narrative, score, or forecast may be surfaced without a traceable evidence chain: source documents → extracted claims → entities → cluster membership → score computation. This mirrors the Confidence Engine and Auditability Architecture in `ARCHITECTURE.md` §8, §13.

**Principle 4 — Continuous, not batch.** Ingestion, extraction, clustering, and scoring are streaming operations. A narrative's score reflects the state of the world within minutes, not the last nightly batch.

**Principle 5 — Graph-native.** Entities (companies, people, countries, regulations, projects, facilities) and their relationships are first-class, queryable objects — not incidental metadata inside documents.

### 1.2 Layered System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  LAYER 7 — PRESENTATION                                                            │
│  Live Feed · Timeline · Heatmap · Global Map · Graph Explorer · Analyst Workspace   │
│  Executive Dashboard · Alert Center · Company/Industry/Country Views               │
├──────────────────────────────────────────────────────────────────────────────────┤
│  LAYER 6 — API / SERVING                                                          │
│  FastAPI Gateway  /api/v1/narrative/*  ·  GraphQL Graph Query  ·  WebSocket Stream  │
│  JWT + RBAC · Rate Limiting · Schema Validation (Pydantic) · OpenAPI               │
├──────────────────────────────────────────────────────────────────────────────────┤
│  LAYER 5 — INTELLIGENCE & SCORING                                                  │
│  Narrative Risk Scorer · Reasoning Engine (explainability) · Predictive Engine      │
│  Lifecycle Tracker · Company/Industry/Country Exposure Aggregator                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│  LAYER 4 — NARRATIVE INTELLIGENCE CORE                                             │
│  Narrative Detection · Clustering Engine · Event Detector · Entity Resolution      │
│  Relationship Graph Builder · Temporal Trend Modeler                               │
├──────────────────────────────────────────────────────────────────────────────────┤
│  LAYER 3 — AI UNDERSTANDING (NLU)                                                  │
│  Embedding Service · NER/Entity Linking · Claim Extraction · Sentiment/Stance       │
│  Climate Taxonomy Classifier · Credibility/Source-Trust Scorer                     │
├──────────────────────────────────────────────────────────────────────────────────┤
│  LAYER 2 — STREAMING BACKBONE                                                      │
│  Kafka Topics (raw.* → enriched.* → narrative.* → alerts.*) · Schema Registry       │
│  Dead-Letter Queues · Exactly-once Processing (idempotent consumers)               │
├──────────────────────────────────────────────────────────────────────────────────┤
│  LAYER 1 — GLOBAL INGESTION                                                        │
│  180+ connector fleet: news wires, regulators, filings, journals, satellite/climate │
│  data, commodity/carbon markets, shipping/trade, compliant social, conferences      │
├──────────────────────────────────────────────────────────────────────────────────┤
│  LAYER 0 — STORAGE                                                                 │
│  Object Store (raw docs) · Vector DB (embeddings) · Graph DB (entities/relations)   │
│  PostgreSQL (structured/scores) · Search Index · Time-Series Store (signals)        │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Request/Data Flow (End-to-End)

```
Source ──▶ Connector ──▶ raw.documents (Kafka) ──▶ Normalizer ──▶ clean.documents
   │                                                                     │
   │                                                                     ▼
   │                                                     NLU Pipeline (parallel fan-out)
   │                                                     ├─ Embedding Service
   │                                                     ├─ Entity/Relation Extraction
   │                                                     ├─ Claim & Risk-Signal Extraction
   │                                                     ├─ Climate Taxonomy Classifier
   │                                                     └─ Source Credibility Scorer
   │                                                                     │
   │                                                                     ▼
   │                                                    enriched.documents (Kafka)
   │                                                                     │
   │                              ┌──────────────────────────────────────┼───────────────────────┐
   │                              ▼                                      ▼                        ▼
   │                     Entity Resolution &                  Narrative Clustering        Event Detector
   │                     Knowledge Graph Upsert                (streaming HDBSCAN over     (breaking/weak-signal
   │                     (Graph DB)                             rolling embedding windows)  classifiers)
   │                              │                                      │                        │
   │                              └──────────────┬───────────────────────┴────────────┬───────────┘
   │                                             ▼                                    ▼
   │                                   narrative.updates (Kafka)              events.detected (Kafka)
   │                                             │                                    │
   │                                             ▼                                    ▼
   │                                   Real-Time Scoring Engine ◀────────────── Lifecycle Tracker
   │                                             │
   │                                             ▼
   │                                   Reasoning Engine (explainability generation)
   │                                             │
   │                                             ▼
   │                                   narrative.scored (Kafka) ──▶ Postgres (durable) + Search Index
   │                                                                        │
   │                                                                        ▼
   └────────────────────────────────────────────────────────────▶  API Gateway ──▶ UI / WebSocket / Alerts
```

### 1.4 Bounded Contexts (Microservice Domains)

| Domain | Owns | Talks to |
|---|---|---|
| `ingestion-svc` | Connectors, source registry, rate-limit/backoff per source | Kafka `raw.*` |
| `nlu-svc` | Embeddings, NER, claim extraction, taxonomy classification | Kafka `clean.*` → `enriched.*` |
| `graph-svc` | Entity resolution, relationship graph, company intelligence | Graph DB, Kafka `enriched.*` |
| `narrative-svc` | Clustering, lifecycle, narrative registry | Vector DB, Postgres, Kafka `narrative.*` |
| `event-svc` | Breaking/weak-signal/event classification | Kafka `enriched.*` → `events.*` |
| `scoring-svc` | Real-time risk scores, reasoning/explainability | Postgres, Kafka `narrative.scored` |
| `predictive-svc` | Forecasting models, probability estimates | Postgres, Feature Store |
| `api-gateway` | Auth, RBAC, REST/GraphQL/WebSocket serving | All above (read-only) |

---

## 2. AI WORKFLOW ARCHITECTURE

### 2.1 Agentic Pipeline (Per-Document Lifecycle)

Each document moves through an **agent chain** — a supervised pipeline of specialized, independently-scalable AI workers, not a single monolithic LLM call:

```
Document ─▶ [Ingestion Agent] ─▶ [Normalization Agent] ─▶ [Language Detection Agent]
         ─▶ [Embedding Agent] ─▶ [Entity Extraction Agent] ─▶ [Relation Extraction Agent]
         ─▶ [Taxonomy Classification Agent] ─▶ [Claim Extraction Agent]
         ─▶ [Credibility Assessment Agent] ─▶ [Clustering Agent] ─▶ [Graph Upsert Agent]
         ─▶ [Scoring Agent] ─▶ [Reasoning Agent] ─▶ [Publication Agent]
```

Each agent is:
- **Stateless** — reads its input event, writes its output event, no shared in-memory state.
- **Independently scalable** — deployed as its own Kubernetes deployment with its own HPA target.
- **Model-graded** — every agent emits a confidence score alongside its output; low-confidence outputs are routed to a human review queue (`analyst-review` topic), never silently dropped or silently trusted.

### 2.2 Why Agentic, Not a Single LLM Call

A single large-context LLM call per document does not scale to millions of documents/day economically, and it produces black-box outputs. Splitting the pipeline into specialized agents allows:
- Cheaper, fine-tuned/distilled models for high-volume steps (embedding, NER, language ID) and reserving frontier LLM reasoning (Claude) for the two steps that actually require deep reasoning: **Claim Extraction** and the **Reasoning Agent** that produces human-readable explanations.
- Independent quality monitoring and retraining per step.
- Deterministic, auditable intermediate outputs at every stage (Principle 3, §1.1).

### 2.3 Claude's Role in the Pipeline

Claude (via the Claude API, per `[[project_climactix_ai_mvp]]` conventions already used by `climactix-ai.html`) is used at exactly two points, both requiring judgment rather than pattern-matching:

1. **Claim & Risk-Signal Extraction** — given a document plus its extracted entities, produce structured claims (`entity`, `claim_type`, `claim_text`, `polarity`, `financial_materiality_hint`, `confidence`) using a constrained JSON schema (Pydantic-validated on the way back).
2. **Reasoning Agent** — given a narrative's structured evidence (source count, growth curve, entity list, cluster composition), produce the human-readable explanation shown in the UI (§9.4). The prompt is evidence-locked: the model may only reference numbers and entities present in the structured input — it cannot introduce facts not in the evidence bundle. Output is validated against the evidence bundle post-hoc (numeric claims in the explanation must match input numbers) before publication.

All other steps (embedding, NER, taxonomy classification, clustering, scoring arithmetic) are deterministic or classical/ML models — not LLM calls — because they are high-volume and don't require open-ended reasoning.

### 2.4 Agentic Workflow — Narrative-Level (Not Document-Level)

Above the per-document agents, a second, lower-frequency agent loop operates **per narrative** (not per document), triggered whenever a narrative's evidence set changes materially (new source-diversity threshold crossed, growth-rate inflection, new entity linked):

```
[Narrative State Change] ─▶ [Lifecycle Classification Agent] ─▶ [Cross-Narrative Merge/Split Agent]
                          ─▶ [Predictive Agent] ─▶ [Reasoning Agent] ─▶ [Alert Decision Agent]
```

The **Merge/Split Agent** is what prevents narrative sprawl: if two independently-detected narratives (e.g., "Drought — Horn of Africa" and "Hydropower shortfall — East Africa") show rising embedding-space overlap and shared entities, it proposes a merge (into "East Africa Water Stress") for confirmation by the scoring engine's confidence gate — never a silent auto-merge above a materiality threshold (auto-merge is allowed below a configurable narrative-importance threshold; above it, merges/splits queue for analyst confirmation, logged per the Auditability model in `ARCHITECTURE.md` §13).

---

## 3. DATA PIPELINE ARCHITECTURE

### 3.1 Source Categories & Connector Fleet

| Category | Example Sources | Refresh Cadence | Connector Pattern |
|---|---|---|---|
| Global news wires | Reuters, AP, Bloomberg News API, AFP | Streaming (webhook/SSE) | Push connector |
| Government & regulators | SEC EDGAR, ESMA, EU EUR-Lex, India MoEFCC, EPA | 15 min poll | Poll + diff connector |
| Stock exchanges | NSE/BSE, NYSE, LSE corporate announcements | 5 min poll | Poll connector |
| Corporate disclosures | Annual reports, sustainability/BRSR reports, investor decks | Daily crawl + on-demand upload | Crawl + ingest API |
| Scientific/academic | IPCC, Nature, Science, arXiv (climate categories) | Daily | Crawl connector |
| Patent databases | USPTO, EPO, WIPO (climate-tech classes) | Daily | API connector |
| Satellite & climate data | Copernicus, NOAA, NASA FIRMS, ECMWF | Hourly | API connector |
| Commodity & carbon markets | ICE, EU ETS, voluntary carbon registries | 1 min (market hours) | Streaming market feed |
| Shipping & trade | AIS vessel tracking, customs trade data | Hourly | API connector |
| Industry associations & NGOs | WRI, CDP, TNC, sector bodies | Daily crawl | Crawl connector |
| Compliant social/media monitoring | Licensed enterprise social APIs only (no scraping ToS-violating platforms) | Streaming | Push connector via licensed vendor |
| Podcasts, conference transcripts, parliamentary debates | Official transcript feeds, Hansard-style records | Daily | Crawl + ASR fallback |

Every connector implements a common interface so the pipeline is source-agnostic downstream:

```python
class SourceConnector(Protocol):
    source_id: str
    trust_tier: Literal["tier1_regulatory", "tier2_wire", "tier3_corporate",
                         "tier4_ngo_academic", "tier5_social"]

    async def poll(self) -> AsyncIterator[RawDocument]: ...
    def rate_limit(self) -> RateLimitPolicy: ...
    def backoff_policy(self) -> BackoffPolicy: ...
```

`trust_tier` is set at connector registration and feeds directly into the Source Credibility Scorer (§4.5) — it is never inferred per-document, only adjusted per-document by corroboration/contradiction signals.

### 3.2 Streaming Backbone (Kafka Topic Map)

```
raw.documents.{source_tier}          — unprocessed payload + connector metadata
clean.documents                      — normalized text, language-detected, deduplicated
enriched.documents                   — + embeddings, entities, claims, taxonomy tags
graph.upserts                        — entity/relationship mutations
narrative.candidates                 — cluster proposals pre-validation
narrative.updates                    — confirmed narrative state changes
narrative.scored                     — narratives with current score snapshot
events.detected                      — discrete event records (breaking/weak-signal/etc.)
alerts.triggered                     — threshold-crossing alerts for Alert Center
analyst-review                       — low-confidence items routed to human review
dead-letter.{stage}                  — poison messages per pipeline stage
```

- **Partitioning:** by `source_id` for `raw.*` (preserves per-source ordering for rate-limit fairness); by `narrative_id` for `narrative.*` (guarantees a single narrative's updates are processed in order by one consumer).
- **Retention:** `raw.*` 7 days (replay window for reprocessing after model upgrades), `narrative.*` and `events.*` indefinite (append-only history feeds the Lifecycle Tracker's historical replay UI, §11).
- **Delivery guarantee:** at-least-once with idempotent consumers keyed on `(source_id, document_hash)` to make the full pipeline effectively exactly-once without the throughput cost of transactional Kafka producers at ingestion scale.

### 3.3 Deduplication & Near-Duplicate Collapse

Wire stories are frequently re-published verbatim across hundreds of outlets. A SimHash/MinHash near-duplicate filter runs immediately after normalization: documents within a similarity threshold of an already-seen document in a rolling 48-hour window are collapsed into a single canonical document with a `syndication_count` field — this count is itself a signal (high syndication = high media velocity) rather than discarded, feeding directly into narrative "Media Velocity" scoring (§9).

---

## 4. NARRATIVE DETECTION METHODOLOGY

### 4.1 Semantic Understanding, Not Keyword Search

Every document is embedded (see §12 for model choice) into a shared vector space. Separately, a **Climate Mechanism Taxonomy** — a graph of ~400 climate-relevant mechanisms (physical hazards, transition levers, financial channels, policy instruments) — is itself embedded once. Every document is mapped to its nearest mechanism nodes by embedding similarity plus a lightweight classifier head fine-tuned on labeled examples, so a document about "reinsurers exiting Florida" and one about "crop insurance premiums rising in the Punjab" both activate the `physical_risk.insurance_repricing` mechanism node without sharing vocabulary.

This is what allows the example from the brief — flooding, insurance losses, crop failure, water stress, drought, hydropower reduction — to be recognized as expressions of one mechanism family (physical water risk) even when no document uses the words "climate change."

### 4.2 Per-Document Structured Extraction

For every document, the NLU layer (Layer 3) extracts a structured `DocumentIntelligence` record:

```python
class DocumentIntelligence(BaseModel):
    document_id: str
    source_id: str
    trust_tier: str
    published_at: datetime
    language: str
    embedding: list[float]                 # 1024-dim, see §12
    entities: list[ExtractedEntity]         # companies, people, countries, regulators, projects
    mechanisms: list[MechanismTag]          # taxonomy node + confidence
    claims: list[ExtractedClaim]            # structured claim objects (see below)
    sentiment: SentimentProfile             # polarity + stance (activist/regulatory/investor/media)
    financial_signals: list[FinancialSignal]
    credibility_score: float                # 0-100, see §4.5

class ExtractedClaim(BaseModel):
    claim_type: Literal["target", "commitment", "regulation", "lawsuit",
                         "investment", "scientific_finding", "controversy", "other"]
    subject_entity_id: str
    claim_text: str
    deadline: date | None
    monetary_value: MonetaryAmount | None
    polarity: Literal["positive", "negative", "neutral", "mixed"]
    confidence: float
```

Every field maps to the extraction categories requested in the brief (topics, entities, industries, hazards, risks, regulations, targets, deadlines, technology mentions, legal actions, sentiment, scientific findings).

### 4.3 Narrative Clustering (Discovery, Not Predefinition)

**Algorithm:** streaming density-based clustering (HDBSCAN-family, incrementally updated) over a rolling window of document embeddings, re-clustered every ingestion cycle rather than from scratch, using cluster-assignment warm-starts for efficiency.

**Promotion criteria** — a candidate cluster becomes a tracked `Narrative` only when it crosses statistical thresholds (configurable per mechanism family, defaults shown):

| Threshold | Default | Purpose |
|---|---|---|
| Minimum document count | 25 within 14 days | Filters noise/one-off stories |
| Source diversity | ≥ 5 distinct source_ids, ≥ 2 trust tiers | Prevents single-outlet echo from becoming a "narrative" |
| Growth rate | ≥ 15% week-over-week document volume | Confirms momentum, not just historical volume |
| Geographic or entity spread | ≥ 2 countries OR ≥ 3 distinct organizations | Filters purely local/single-company stories into "Events" instead (§4.6) |

Clusters that don't cross promotion thresholds remain `candidate` narratives, visible to analysts in the Analyst Workspace (§11) but not surfaced on the Executive Dashboard or scored for external consumption — this is the mechanism that prevents keyword-noise from becoming false "narratives."

### 4.4 Narrative Merge & Split (Example Worked)

The brief's example — heatwaves, insurance claims, crop loss, food prices, drought, water crisis, hydropower reduction merging into "Global Water Stress Narrative" — happens via the Merge/Split Agent (§2.4): each sub-cluster is tracked independently until pairwise embedding-centroid distance falls below a merge threshold *and* entity-overlap (shared countries, shared affected industries) crosses a co-occurrence threshold, at which point the sub-clusters are merged into one parent narrative with the sub-clusters retained as `sub_narratives` (so drill-down UI, §11, can still show "Drought" and "Hydropower Reduction" as distinct threads inside the parent).

### 4.5 Source Credibility Scoring

```
credibility_score = base_trust_tier_score
                   × corroboration_multiplier(independent_sources_confirming)
                   × recency_decay(time_since_last_corroboration)
                   × contradiction_penalty(conflicting_claims_from_tier1_sources)
```

`trust_tier` sets the base (regulatory/scientific sources highest, unverified social lowest); corroboration across independent, unaffiliated sources raises it; direct contradiction from a Tier-1 (regulatory/scientific) source sharply penalizes it. This score is attached to the narrative, not just the document, as `evidence_quality_score` — directly analogous to the Evidence Quality Score formula in `ARCHITECTURE.md` §6.4.

### 4.6 Event Detection (Discrete, Time-Bound — Distinct from Narratives)

Narratives are durable and evolving; **events** are discrete and time-bound. An `EventClassifier` (a lightweight supervised model, retrained monthly) tags qualifying documents/clusters into one of: `breaking`, `emerging`, `weak_signal`, `policy_shift`, `scientific_breakthrough`, `supply_chain_disruption`, `climate_disaster`, `corporate_commitment`, `greenwashing_event`, `litigation`, `investor_activism`, `technology_adoption`, `carbon_pricing_change`, `renewable_expansion`. Each event opens its own `EventTimeline` record and is linked to zero-or-more parent narratives (an event can be the seed of a new narrative, or a data point inside an existing one).

### 4.7 Narrative Lifecycle Model

Every tracked narrative carries a lifecycle stage, computed from its rolling document-volume curve (first derivative = growth rate, second derivative = acceleration):

```
EMERGING ──▶ GROWING ──▶ ACCELERATING ──▶ PEAK_ATTENTION ──▶ DECLINING ──▶ DORMANT
                                                                     │
                                                                     └──▶ RE_EMERGING ──▶ (loop)
```

| Stage | Definition |
|---|---|
| `EMERGING` | Just crossed promotion threshold (§4.3); volume low, growth rate positive |
| `GROWING` | Sustained positive growth rate over ≥ 2 windows |
| `ACCELERATING` | Positive second derivative — growth rate itself increasing |
| `PEAK_ATTENTION` | Growth rate crosses zero from positive; volume near rolling maximum |
| `DECLINING` | Negative growth rate, volume falling from peak |
| `DORMANT` | Volume below re-activation floor for ≥ 30 days |
| `RE_EMERGING` | A `DORMANT` narrative crosses the promotion threshold again — retains its original `narrative_id` and full history rather than being created as new |

Full historical curves are retained indefinitely (Kafka `narrative.*` retention, §3.2) to power the Historical Replay UI (§11).

---

## 5. KNOWLEDGE GRAPH ARCHITECTURE

### 5.1 Graph Schema (Core Node & Edge Types)

```
NODES: Company · Person · Country · Region · Regulator · Regulation · Project
       · Facility · RawMaterial · Product · Fund · Bank · Investor · MediaSource
       · NGO · ThinkTank · Researcher · Narrative · Event · ClimateHazard

EDGES: (Company)-[SUPPLIES_TO]->(Company)
       (Company)-[OPERATES_IN]->(Country|Region)
       (Company)-[OWNS]->(Facility|Project)
       (Company)-[EXPOSED_TO]->(ClimateHazard)
       (Company)-[ASSOCIATED_WITH]->(Narrative)          # weight = mention frequency & recency
       (Investor)-[HOLDS_POSITION_IN]->(Company)
       (Bank)-[FINANCES]->(Project|Company)
       (Regulator)-[ISSUES]->(Regulation)
       (Regulation)-[APPLIES_TO]->(Company|Country)
       (Event)-[TRIGGERED]->(Narrative)
       (Narrative)-[SUB_NARRATIVE_OF]->(Narrative)
       (MediaSource)-[PUBLISHED]->(Event)                # provenance edge
       (NGO|ThinkTank|Researcher)-[AUTHORED]->(Event)
```

Every edge carries `{weight, first_observed, last_observed, evidence_document_ids[], confidence}` — the graph itself is evidence-linked, not asserted from nowhere, satisfying Principle 3 (§1.1).

### 5.2 Entity Resolution & Identity Resolution

The hardest correctness problem in a global graph is knowing that "Tata Steel", "Tata Steel Ltd", "TISCO", and a Bloomberg ticker all refer to one node. Entity Resolution runs as its own pipeline stage:

1. **Candidate generation** — blocking on normalized name, ticker, LEI (Legal Entity Identifier), and known-alias dictionaries seeded from `enterprise.js` company records and public corporate registries.
2. **Pairwise scoring** — a resolution classifier scores candidate pairs on name similarity, shared registered address, shared LEI/ticker, and co-occurrence pattern in the graph.
3. **Clustering to canonical entity** — above a confidence threshold, candidates are merged into one canonical `Company` node with all aliases retained as searchable synonyms; below threshold, they remain distinct pending analyst confirmation (same human-in-the-loop gate as narrative merges, §2.4).

This same mechanism resolves people (executives, regulators, researchers) and facilities/projects across languages and naming conventions.

### 5.3 Company Intelligence — Auto-Assembly

The moment a `Company` node is created or referenced, the graph auto-assembles its intelligence profile by graph traversal — no manual mapping required:

```
Company Intelligence(company) =
    Industry              ← (Company)-[CLASSIFIED_AS]->(Industry)
    Operations & Geography ← (Company)-[OPERATES_IN]->(*)
    Supply Chain          ← 2-hop traversal over SUPPLIES_TO edges (up and downstream)
    Climate Exposure      ← aggregated EXPOSED_TO edges, weighted by facility revenue share
    Transition Exposure   ← ASSOCIATED_WITH edges to transition-tagged Narratives
    Reputation Exposure   ← ASSOCIATED_WITH edges to negative-polarity Narratives/Events
    Investor Exposure     ← inbound HOLDS_POSITION_IN edges
    Regulatory Exposure   ← inbound APPLIES_TO edges from Regulation nodes
    Historical Controversies ← inbound edges from litigation/greenwashing-tagged Events
    Sustainability Commitments ← ExtractedClaim(claim_type="commitment") linked via ASSOCIATED_WITH
```

This directly answers the brief's "Company Intelligence" requirement and feeds the Investor Terminal's per-company profile view.

### 5.4 Graph Update Cadence & Consistency

Graph mutations are applied as streaming upserts (Kafka `graph.upserts`, §3.2), idempotent on `(entity_id, edge_type, target_id)`. The graph is eventually consistent within seconds of document ingestion; the API layer exposes a `graph_as_of` timestamp on every response so downstream consumers (e.g., a portfolio risk calculation) can pin to a consistent snapshot rather than reading a graph mutating mid-query.

---

## 6. DATABASE ARCHITECTURE

Polyglot persistence — each store is chosen for the access pattern it serves, mirroring the "Vector DB / Graph DB / Relational / Document Store / Search" requirement in the brief:

| Store | Technology | Holds | Access Pattern |
|---|---|---|---|
| Object store | S3-compatible (raw document archive) | Raw source payloads, PDFs, filings | Write-once, replay for reprocessing |
| Vector database | Milvus / pgvector (see §12 tradeoff) | Document & narrative embeddings | ANN similarity search, clustering input |
| Graph database | Neo4j / Amazon Neptune | Entities, relationships, provenance | Multi-hop traversal, company intelligence assembly |
| Relational (system of record) | PostgreSQL | Narratives, scores, events, users, audit log | Transactional, ACID, joins for scoring |
| Document store | Elasticsearch / OpenSearch | Full-text search over documents & claims | Free-text + faceted search (Source Explorer UI) |
| Time-series store | TimescaleDB / ClickHouse | Narrative volume curves, market/carbon price feeds | Time-windowed aggregation, trend velocity |
| Cache / feature store | Redis | Hot narrative state, session, rate limits | Sub-ms reads for live feed |

### 6.1 Core PostgreSQL Schema (System of Record)

```sql
CREATE TABLE narratives (
    narrative_id        UUID PRIMARY KEY,
    title               TEXT NOT NULL,
    mechanism_tags      TEXT[] NOT NULL,
    lifecycle_stage     TEXT NOT NULL CHECK (lifecycle_stage IN
        ('emerging','growing','accelerating','peak_attention','declining','dormant','re_emerging')),
    parent_narrative_id UUID REFERENCES narratives(narrative_id),
    first_detected_at   TIMESTAMPTZ NOT NULL,
    last_updated_at     TIMESTAMPTZ NOT NULL,
    document_count      INTEGER NOT NULL DEFAULT 0,
    source_diversity    INTEGER NOT NULL DEFAULT 0,
    is_promoted         BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE narrative_scores (
    narrative_id        UUID REFERENCES narratives(narrative_id),
    scored_at           TIMESTAMPTZ NOT NULL,
    narrative_strength  NUMERIC(5,2),
    global_reach        NUMERIC(5,2),
    media_velocity      NUMERIC(5,2),
    credibility         NUMERIC(5,2),
    scientific_confidence NUMERIC(5,2),
    policy_relevance    NUMERIC(5,2),
    investor_interest   NUMERIC(5,2),
    financial_materiality NUMERIC(5,2),
    supply_chain_impact NUMERIC(5,2),
    reputation_risk     NUMERIC(5,2),
    transition_risk     NUMERIC(5,2),
    physical_risk       NUMERIC(5,2),
    market_sensitivity  NUMERIC(5,2),
    regulatory_urgency  NUMERIC(5,2),
    reasoning_text      TEXT,                  -- Reasoning Agent output, evidence-locked
    evidence_document_ids UUID[],
    PRIMARY KEY (narrative_id, scored_at)
);

CREATE TABLE events (
    event_id            UUID PRIMARY KEY,
    event_type          TEXT NOT NULL,
    narrative_id        UUID REFERENCES narratives(narrative_id),
    detected_at         TIMESTAMPTZ NOT NULL,
    summary             TEXT NOT NULL,
    source_document_ids UUID[]
);

CREATE TABLE entity_narrative_links (
    entity_id           UUID NOT NULL,          -- FK into graph DB (soft reference)
    entity_type         TEXT NOT NULL,
    narrative_id        UUID REFERENCES narratives(narrative_id),
    mention_weight      NUMERIC(6,3) NOT NULL,
    first_linked_at      TIMESTAMPTZ NOT NULL,
    last_linked_at        TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (entity_id, narrative_id)
);

CREATE TABLE audit_log (
    audit_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor               TEXT NOT NULL,          -- user_id or 'system:merge-agent' etc.
    action              TEXT NOT NULL,
    target_type         TEXT NOT NULL,
    target_id           UUID NOT NULL,
    before_state        JSONB,
    after_state         JSONB,
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

All score history is append-only (`narrative_scores` keyed on `(narrative_id, scored_at)`), giving the Historical Replay UI (§11) and predictive backtesting (§10) full time-series lineage for free.

---

## 7. AI AGENT ARCHITECTURE

### 7.1 Agent Roster

| Agent | Model class | Trigger | Output |
|---|---|---|---|
| Ingestion Agent | Rule-based connector logic | Continuous poll/push | `raw.documents` |
| Normalization Agent | Deterministic (langdetect, boilerplate stripping) | Per document | `clean.documents` |
| Embedding Agent | Fine-tuned sentence-embedding model (domain-adapted) | Per document | vector in Milvus/pgvector |
| Entity Extraction Agent | Fine-tuned NER (domain-adapted transformer) | Per document | entities → graph.upserts |
| Relation Extraction Agent | Fine-tuned relation-classification model | Per document | edges → graph.upserts |
| Taxonomy Classification Agent | Multi-label classifier over Climate Mechanism Taxonomy | Per document | mechanism tags |
| Claim Extraction Agent | Claude (structured, evidence-locked prompt) | Per document | `ExtractedClaim[]` |
| Credibility Assessment Agent | Deterministic formula (§4.5) + ML corroboration matcher | Per document/narrative | `credibility_score` |
| Clustering Agent | Streaming HDBSCAN, incremental | Per ingestion cycle | `narrative.candidates` |
| Merge/Split Agent | Claude (reasoning over cluster-similarity evidence) | On candidate cluster overlap | merge/split proposal |
| Event Detection Agent | Fine-tuned multi-class classifier | Per document/cluster | `events.detected` |
| Lifecycle Classification Agent | Deterministic (curve-derivative rules, §4.7) | Per narrative update | lifecycle stage |
| Scoring Agent | Deterministic weighted formulas (§9) | Per narrative update | `narrative_scores` row |
| Reasoning Agent | Claude (evidence-locked, post-hoc validated) | Per narrative score change above threshold | `reasoning_text` |
| Predictive Agent | Probabilistic ML models (§10) | Scheduled + on-demand | forecast records |
| Alert Decision Agent | Rule engine over user-defined thresholds | Per score/event | `alerts.triggered` |

### 7.2 Agent Orchestration

Orchestration is event-driven, not a central "planner" LLM invoking tools — at this document volume, a supervisor-LLM-per-document pattern is cost-prohibitive and adds unnecessary latency. Instead, each agent is a Kafka consumer/producer pair; the "workflow" is the topic graph itself (§3.2). This is deliberately simpler and more debuggable than a dynamic agent-planning framework: every transition is a durable, replayable Kafka message, so failures are diagnosable by replaying a `document_id` through the topic history rather than reconstructing an LLM's tool-call trace.

The one place genuine agentic reasoning (multi-step, tool-using) is warranted is the **Analyst Workspace co-pilot** (§11.19): an analyst-facing Claude agent with read access to the Graph DB, Search Index, and narrative API, used for ad hoc investigation ("show me every company mentioned alongside the CBAM narrative in the last 30 days that isn't already in our portfolio universe") — this is a bounded, human-supervised agent loop, distinct from the fully automated pipeline above.

---

## 8. EVENT PROCESSING WORKFLOW

### 8.1 Processing Guarantees

- **Idempotency key:** `(source_id, document_hash)` at ingestion; `(narrative_id, scored_at)` at scoring. Reprocessing (e.g., after a model upgrade) never creates duplicate narrative history.
- **Ordering:** guaranteed per-partition only (per `source_id` upstream, per `narrative_id` downstream) — cross-narrative ordering is not required and not guaranteed, which is what makes horizontal scaling of the clustering/scoring stages possible.
- **Backpressure:** each consumer group exposes lag metrics; the Ingestion Agent's poll rate is throttled automatically when downstream `enriched.documents` consumer lag exceeds a configured ceiling, preventing a burst from one high-volume source (e.g., a breaking climate disaster generating thousands of wire stories in an hour) from starving other sources.
- **Dead-letter handling:** any stage that fails validation (schema mismatch, extraction timeout, model error) routes the message to `dead-letter.{stage}` with the failure reason attached; a dedicated reprocessing job replays dead-letter messages after a fix ships, never silently drops data.

### 8.2 Reference Event Trace — "AI Data Centre Electricity Demand" (Brief's Worked Example)

```
t+0        Independent documents begin mentioning data-centre power draw, grid strain,
           utility capacity requests — no shared keyword, no predefined category.
t+0..14d   Embedding Agent places these in adjacent vector-space region; Taxonomy
           Classification Agent tags a mix of "energy_demand.industrial_load" and
           "transition_risk.grid_capacity" mechanism nodes.
t+14d      Clustering Agent's rolling window crosses promotion thresholds (§4.3):
           31 documents, 7 sources, 3 trust tiers, 22% week-over-week growth,
           4 countries, 6 companies (utilities + hyperscalers).
t+14d      Narrative promoted: "AI Data Centre Electricity Demand" (EMERGING).
t+14d      Scoring Agent computes initial scores; Reasoning Agent generates the
           evidence-locked explanation (§9.4 shows the format).
t+14d..    Lifecycle Tracker watches volume curve; Predictive Agent estimates
           probability of regulatory attention, investor attention, mainstream
           breakout (§10) — all recomputed on every material state change.
```

No human ever defined "AI data centre electricity demand" as a category in advance — it was discovered purely from clustering + threshold crossing, exactly as the brief specifies.

---

## 9. REAL-TIME SCORING METHODOLOGY

### 9.1 Score Set

Every narrative carries the following continuously-updated 0–100 scores (persisted per `narrative_scores`, §6.1):

`narrative_strength · global_reach · media_velocity · credibility · scientific_confidence · policy_relevance · investor_interest · financial_materiality · supply_chain_impact · reputation_risk · transition_risk · physical_risk · market_sensitivity · regulatory_urgency`

### 9.2 Representative Formulas

All formulas are explicit, weighted, and reference only fields already present in the evidence bundle — no opaque model outputs feed a score without a named, auditable component (Principle 3).

```
media_velocity = 100 × normalize(
    0.5 × (documents_last_7d - documents_prior_7d) / max(documents_prior_7d, 1)
  + 0.3 × log(unique_sources_last_7d + 1) / log(max_observed_sources + 1)
  + 0.2 × syndication_rate
)

global_reach = 100 × (
    0.5 × (distinct_countries_mentioned / total_tracked_countries)
  + 0.5 × (distinct_languages_detected / total_tracked_languages)
)

credibility = weighted_average(document.credibility_score, weight = document.recency_decay)
              — see §4.5 for the per-document formula this aggregates

policy_relevance = 100 × normalize(
    0.4 × count(claims where claim_type = 'regulation')
  + 0.3 × count(linked Regulator entities)
  + 0.3 × proximity_to_deadline(nearest linked regulation.effective_date)
)

financial_materiality = 100 × normalize(
    0.4 × sum(claim.monetary_value, where claim_type in ['investment','commitment'])
  + 0.3 × count(distinct linked Company entities with market_cap > threshold)
  + 0.3 × investor_interest_score
)

regulatory_urgency = 100 × normalize(
    max(0, 1 - days_until_nearest_deadline / urgency_window_days)
    × policy_relevance / 100
)
```

Every formula follows the same style as `ARCHITECTURE.md` §7's scoring engine — weighted, normalized, explainable — and every weight is a named configuration value in the Scoring Agent's config (not hardcoded), so weights can be revised and the revision itself is audit-logged.

### 9.3 Confidence Envelope

Every score is published with a confidence interval, not a bare point estimate, computed from source diversity and evidence_quality_score exactly as `ARCHITECTURE.md` §8's Confidence Engine does for company scores — a narrative backed by 8 sources across 2 trust tiers carries a materially wider confidence band than one backed by 60 sources across 5 tiers, and the UI (§11) always renders the band, never a bare number.

### 9.4 Reasoning Engine — Explainability Output Format

The Reasoning Agent (§7.1) generates output in this exact structure, matching the brief's worked example:

```json
{
  "narrative_id": "narr_cbam_automotive_2026q1",
  "explanation": "Carbon Border Adjustment Mechanism discussions increased 230% across European policy publications, manufacturing associations, and investor reports over the last 12 days. Automotive exporters have become increasingly associated with this narrative. Regulatory probability is high because multiple consultation documents entered final review.",
  "evidence": {
    "growth_pct_12d": 230,
    "source_categories": ["eu_policy_publication", "manufacturing_association", "investor_report"],
    "newly_linked_entities": ["Company:VW_AG", "Company:Stellantis", "Company:Bosch"],
    "regulatory_signal": {"consultations_in_final_review": 3, "source": "EUR-Lex tracker"}
  },
  "generated_at": "2026-07-08T09:14:00Z",
  "validation": "numeric_claims_verified_against_evidence_bundle"
}
```

The `validation` field is set only after a deterministic post-hoc check confirms every number in `explanation` matches a field in `evidence` — this is the guardrail that keeps the Reasoning Agent from fabricating statistics, directly enforcing the "never behave like a black box" requirement.

---

## 10. PREDICTIVE INTELLIGENCE FRAMEWORK

### 10.1 What Is Forecast

| Prediction target | Model approach |
|---|---|
| Probability narrative reaches `PEAK_ATTENTION` within N days | Survival/hazard model over historical lifecycle curves of comparable narratives (same mechanism family) |
| Probability of new regulation within N months | Logistic model over policy_relevance trajectory + count of consultations in final review |
| Probability of investor-attention escalation | Model over investor_interest trajectory + fund/bank entity linkage growth rate |
| Industries/companies likely to become newly exposed | Link-prediction over the knowledge graph (§5) — which unlinked entities are structurally close to already-linked entities |
| Financial impact range | Monte Carlo over financial_materiality inputs, reusing the Financial Impact Engine already defined in `intelligence_engine/engines/financial_impact_engine.py`, parameterized by the narrative's linked entities instead of a single company assessment |
| Sentiment shift | Time-series forecast (state-space/Kalman or gradient-boosted quantile model) over the sentiment trajectory |

### 10.2 Why Probabilistic, Not Point Forecasts

Every prediction is published as a probability or a distribution (e.g., "62% probability of reaching Peak Attention within 21 days, 90% CI: 12–34 days"), never a bare directional claim — this is what makes it usable for institutional risk decisions rather than punditry, and is consistent with the platform's "no black-box logic" rule.

### 10.3 Backtesting & Calibration

Because every narrative's full lifecycle history is retained (append-only `narrative_scores`, §6.1), the Predictive Agent is continuously backtested: for every past narrative, the model's forecast made at each historical point is compared against what actually happened, producing a rolling calibration score (Brier score for classification-style predictions) surfaced internally on an ML observability dashboard — not shown to end users, but gating whether a model version is promoted to production.

### 10.4 Autonomous Learning Loop

The brief asks for continuous improvement without manual retraining. This is implemented as a scheduled (not ad hoc) retraining pipeline, explicitly *not* fully autonomous online learning — unconstrained online learning on adversarial, noisy internet text is a correctness and security risk (model drift, poisoning). Instead:

```
Weekly:  Entity Resolution & Clustering models retrain on the last 90 days of
         analyst-confirmed merge/split decisions (§2.4, §5.2) — this is how the
         system "learns new relationships" and improves clustering safely, from
         human-confirmed ground truth rather than its own unverified output.
Monthly: Taxonomy Classifier retrains to add newly-stabilized mechanism nodes
         (a candidate cluster that has repeatedly been promoted to a Narrative
         but doesn't map cleanly to an existing taxonomy node is flagged for
         a taxonomy-team review — this is how "new climate topics/terminology"
         enter the system, with a human gate, not silent self-modification).
Continuous: Credibility corroboration weights recalibrate automatically as
         new corroborating/contradicting evidence arrives — this part is
         genuinely online because it is a deterministic formula (§4.5), not
         a model retrain, so it carries no drift risk.
```

This gives real continuous improvement while keeping every learned change auditable and gated — matching Principle 3 rather than treating "autonomous" as license to skip review.

---

## 11. ENTERPRISE UI SPECIFICATION

All screens follow the v4.0 design system in `DESIGN.md` (NASA Blue `#0B3D91`, white/`#FAFAFA` surfaces, `#D9D9D9` borders, flat elevation, 8px radius, no pie charts, no glassmorphism) — this is a new v4.0 surface per `CLAUDE.md`'s migration boundary, not a v3.2 dark-terminal page.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  NARRATIVE INTELLIGENCE                                    [Alerts: 3] ⚙ │
├───────────────┬─────────────────────────────────────────────────────────┤
│ Live Feed      │  NARRATIVE: AI Data Centre Electricity Demand            │
│ Timeline       │  Stage: ● ACCELERATING     Strength 78  Reach 64         │
│ Heatmap        │  ┌───────────────────────────────────────────────────┐  │
│ Global Map     │  │        volume curve (14d) — sparkline, hover pts   │  │
│ Relationship   │  └───────────────────────────────────────────────────┘  │
│   Graph        │  Reasoning: "Discussions increased 230% across..."       │
│ Source Explorer│  Evidence: 31 docs · 7 sources · 4 countries · 6 cos.    │
│ Entity Network │  ┌─────────────┬─────────────┬─────────────┐            │
│ Company        │  │ Financial    │ Regulatory   │ Investor    │            │
│   Exposure     │  │ Materiality  │ Urgency      │ Interest    │            │
│ Industry Dash  │  │   72/100     │   58/100     │   66/100    │            │
│ Country Dash   │  └─────────────┴─────────────┴─────────────┘            │
│ Trend Velocity │  Linked Companies: NVIDIA · Microsoft · Equinix · ...    │
│ Predictive     │  Sub-narratives: Grid Capacity Strain · Water Cooling    │
│   Signals      │  [ View Knowledge Graph ]  [ Historical Replay ]         │
│ Comparison     │                                                          │
│ Historical     │  ← selecting a screen in left nav swaps this main panel  │
│   Replay       │                                                          │
│ Alert Center   │                                                          │
│ Analyst        │                                                          │
│   Workspace    │                                                          │
│ Executive      │                                                          │
│   Dashboard    │                                                          │
└───────────────┴─────────────────────────────────────────────────────────┘
```

### 11.1 Screen Specifications

1. **Live Narrative Feed** — reverse-chronological stream of narrative/event state changes, WebSocket-pushed, each row showing narrative title, lifecycle stage badge (status-color pill — the one permitted pill shape per `DESIGN.md`), and a one-line reasoning excerpt.
2. **Narrative Timeline** — horizontal time-series per narrative with lifecycle-stage color bands; zoom/hover/export per `DESIGN.md`'s data-viz rules.
3. **Narrative Heatmap** — matrix of mechanism-family × industry, cell intensity = aggregate financial_materiality; NASA Blue intensity scale, never a rainbow/decorative palette.
4. **Global Map** — GIS choropleth of narrative geographic_spread; NASA Blue single-hue choropleth, click-through to country dashboard.
5. **Relationship Graph** — force-directed knowledge-graph explorer (§5); filter by entity type, edge-weight threshold, time window.
6. **Source Explorer** — full-text search (Elasticsearch-backed) over source documents with trust-tier and credibility filters.
7. **Narrative Evolution** — side-by-side embedding-space projection (UMAP 2D) showing cluster drift over time.
8. **Confidence Indicators** — every score panel renders its confidence band inline, never a bare number (§9.3).
9. **Evidence Explorer** — drill-down list of every source document backing a narrative's current score.
10. **Entity Network** — per-entity ego-graph (one company/person/country and its immediate graph neighborhood).
11. **Company Exposure** — auto-assembled Company Intelligence view (§5.3).
12. **Industry Dashboard** — aggregated exposure across all companies in an industry.
13. **Country Dashboard** — aggregated exposure and regulatory calendar for a country.
14. **Trend Velocity** — ranked table of narratives by media_velocity, sortable by any score.
15. **Predictive Signals** — forecast cards per §10.1, each showing probability + confidence interval, never a bare directional claim.
16. **Narrative Comparison** — side-by-side scorecards for up to 4 narratives.
17. **Historical Replay** — scrub bar over a narrative's full lifecycle history (append-only `narrative_scores`, §6.1).
18. **Alert Center** — user-configured threshold alerts (e.g., "notify when any narrative linked to my portfolio companies crosses regulatory_urgency > 70").
19. **Analyst Workspace** — the bounded Claude co-pilot (§7.2) plus saved-query/annotation tools.
20. **Executive Dashboard** — top-N narratives by financial_materiality, condensed for board-level consumption; Merriweather typography for any generated narrative summaries per `DESIGN.md`'s report-typography rule.

Every panel updates in real time via the WebSocket channel (`ws_router` pattern already established in `intelligence_engine/api/ws_router.py`) — no manual refresh.

---

## 12. TECHNOLOGY STACK

| Layer | Technology | Rationale |
|---|---|---|
| Ingestion connectors | Python (asyncio), per-source adapter modules | Matches existing `intelligence_engine/connectors` pattern |
| Streaming backbone | Apache Kafka + Schema Registry (Avro/Protobuf) | Durable replay, exactly-once via idempotent keys, industry standard for this throughput |
| Stream processing | Apache Flink (or Kafka Streams for lighter stages) | Stateful streaming clustering/aggregation at scale |
| Embeddings | Domain-adapted sentence-embedding model (e.g., fine-tuned E5/BGE-class model), served via Triton/TorchServe | Open, fine-tunable, avoids per-call cost of an LLM for high-volume embedding |
| NER / Relation Extraction | Fine-tuned transformer (domain-adapted), served via Triton/TorchServe | High-volume, needs low per-call cost |
| Claim Extraction & Reasoning | Claude API (Claude Sonnet 5 class model) | Only steps needing open-ended reasoning; matches existing `climactix-ai` Claude usage |
| Vector database | Milvus (self-hosted, scale) or pgvector (simpler ops, moderate scale) | Milvus for the billions-of-documents target; pgvector acceptable at Phase 1 volumes |
| Graph database | Neo4j (developer velocity) or Amazon Neptune (managed, multi-region) | Multi-hop traversal for Company Intelligence assembly |
| Relational DB | PostgreSQL | System of record, matches existing platform convention |
| Search | OpenSearch | Full-text Source Explorer, avoids AWS-Elasticsearch licensing ambiguity |
| Time-series | TimescaleDB | Narrative volume curves, market feeds |
| Cache | Redis | Hot narrative state, rate limiting, session |
| API layer | FastAPI + Pydantic | Matches existing `intelligence_engine/main.py` and `backend/` convention |
| Frontend | Next.js + TypeScript + TailwindCSS + ShadCN UI | Matches platform's stated production roadmap stack in `CLAUDE.md` |
| Orchestration | Kubernetes | Matches existing `infra/` and Docker Compose → K8s roadmap |
| CI/CD | GitHub Actions → container registry → K8s rolling deploy | Matches existing `deploy.sh` pattern |
| Observability | Prometheus + Grafana + OpenTelemetry tracing | Standard, integrates with Kafka consumer-lag metrics (§8.1) |

---

## 13. CLOUD DEPLOYMENT ARCHITECTURE

### 13.1 Multi-Region Topology

```
                         ┌────────────────────┐
                         │   Global DNS / GSLB │
                         └──────────┬─────────┘
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
      Region: eu-west     Region: us-east      Region: ap-south
      (EU regulatory/     (Americas news/      (APAC — India BRSR,
       source proximity)   markets)             China carbon markets)
      ┌──────────────┐    ┌──────────────┐     ┌──────────────┐
      │ Ingestion +   │    │ Ingestion +   │     │ Ingestion +   │
      │ NLU (regional)│    │ NLU (regional)│     │ NLU (regional)│
      └──────┬───────┘    └──────┬───────┘     └──────┬───────┘
             └────────────────────┼────────────────────┘
                                  ▼
                   Global Kafka (MirrorMaker2 cross-region replication)
                                  │
                                  ▼
                Global Narrative/Scoring/Graph tier (primary region,
                read replicas in each region for API latency)
```

Ingestion and NLU run **regionally** (closer to sources, lower latency, data-residency friendly for EU/India regulatory sources); narrative clustering, scoring, and the graph are **globally consolidated** (a narrative is inherently global and must not be fragmented per-region) with read replicas in each region serving the UI.

### 13.2 Deployment Primitives

- Each microservice domain (§1.4) is its own Kubernetes Deployment with its own Horizontal Pod Autoscaler, scaling on Kafka consumer lag (not just CPU) — this is the correct scaling signal for a streaming pipeline.
- Kafka runs as a managed multi-broker cluster (MSK/Confluent Cloud-class) with MirrorMaker2 for cross-region topic replication of `narrative.*` and `events.*` topics only (not raw ingestion topics, which stay regional to control egress cost).
- Blue/green rolling deploys per service; the NLU model-serving tier (Triton) supports canary model versions so a new embedding/NER model can be validated on a traffic slice before full rollout — directly supporting the calibration gate in §10.3.

---

## 14. SECURITY ARCHITECTURE

- **AuthN/AuthZ:** JWT + RBAC at the API gateway, consistent with `CLAUDE.md`'s platform-wide auth rules; role tiers mirror the existing Enterprise/Investor/Climactix-Internal model, extended with a `narrative_analyst` role scoped to the Analyst Workspace.
- **Source data integrity:** every ingested document is hashed at capture (`document_hash`) and the hash plus source URL is retained permanently even after near-duplicate collapse (§3.3), so any published narrative can be traced back to an immutable original.
- **PII minimization:** the NER pipeline explicitly tags `Person` entities only when relevant to a professional/organizational role (executive, regulator, researcher) mentioned in a public-interest document; the platform does not build profiles of private individuals, and social-media ingestion is limited to licensed, enterprise-compliant vendor APIs only (per the brief's own "enterprise compliant" qualifier) — never scraping of platforms whose terms of service prohibit it.
- **Encryption:** TLS in transit everywhere (including inter-service mTLS within the cluster); encryption at rest on the object store, relational DB, and graph DB.
- **Audit logging:** every narrative merge/split, entity resolution merge, and score-weight change is written to the `audit_log` table (§6.1) with before/after state — matching `ARCHITECTURE.md` §13's Auditability Architecture.
- **Model governance:** every model version (embedding, NER, classifier) is versioned and its calibration metrics (§10.3) logged; a model cannot be promoted to production without passing the calibration gate, preventing silent quality regression.
- **API security:** schema-validated (Pydantic) request/response bodies, rate limiting per API key, versioned endpoints (`/api/v1/narrative/...`), consistent with the platform's global API Design Rules.

---

## 15. SCALABILITY STRATEGY

### 15.1 Target Envelope

Designed to scale toward the brief's "billions of documents globally" as a multi-year ceiling, with an explicit phased ramp rather than over-building Phase 1 infrastructure for Phase 3 volume (see roadmap, §16):

| Phase | Document volume | Primary scaling lever |
|---|---|---|
| Phase 1 | ~1–5M documents/day | Single-region Kafka + pgvector; vertical scaling sufficient |
| Phase 2 | ~20–50M documents/day | Multi-region ingestion (§13.1), Milvus migration, Flink for stateful clustering |
| Phase 3 | Billions cumulative (100M+/day sustained) | Full multi-region active-active, tiered storage (hot/warm/cold), model-serving fleet autoscaling on GPU pools |

### 15.2 Scaling Levers Per Layer

- **Ingestion:** horizontally scale connector pods per source-tier partition; backpressure-aware poll throttling (§8.1) prevents any single high-volume source from destabilizing the pipeline.
- **NLU:** embedding/NER/classification models are the highest-volume compute cost — served via batched GPU inference (Triton dynamic batching), autoscaled on queue depth, with cheaper distilled model variants for the highest-volume, lowest-ambiguity languages/sources.
- **Clustering:** incremental/streaming clustering (§4.3) avoids full-corpus re-clustering; sharded by mechanism-taxonomy family so unrelated mechanism families (e.g., biodiversity vs. carbon markets) cluster independently and in parallel.
- **Graph:** partition the graph by entity-type/region where traversal patterns allow (Company Intelligence assembly, §5.3, is bounded to 2–3 hops, which stays performant even on a very large graph with proper indexing).
- **Storage tiering:** raw documents older than the Kafka replay window (7 days, §3.2) move to cold object storage; embeddings and graph data are re-derivable from raw documents if ever needed, so cold storage is the durability backstop, not the hot path.
- **Cost control:** the two LLM-backed agents (Claim Extraction, Reasoning) are the only per-document steps with meaningful per-call cost — the architecture deliberately keeps every other high-volume step on cheaper fine-tuned models specifically so LLM cost scales with narrative-level events, not raw document volume.

---

## 16. IMPLEMENTATION ROADMAP

| Phase | Scope | Builds On |
|---|---|---|
| **Phase 1 — Foundation** | Core ingestion (10–15 highest-value sources), embedding + NER pipeline, PostgreSQL schema (§6.1), basic clustering, replace `narrative_router.py` stub endpoints with real data | Existing `intelligence_engine/` FastAPI skeleton |
| **Phase 2 — Narrative Core** | Full clustering + lifecycle tracking, knowledge graph (Neo4j), entity resolution, real-time scoring (§9), Reasoning Agent | Phase 1 |
| **Phase 3 — Intelligence UI** | Next.js Narrative Intelligence app (20 screens, §11), WebSocket live feed, Alert Center | Phase 2, existing `ws_router.py` pattern |
| **Phase 4 — Predictive & Scale** | Predictive Intelligence Framework (§10), multi-region deployment (§13), Milvus/Flink migration for scale (§15) | Phase 3 |
| **Phase 5 — Autonomous Learning & Governance** | Scheduled retraining pipelines (§10.4), full audit/model-governance tooling, Analyst Workspace co-pilot (§7.2) | Phase 4 |

Each phase ships a working, narrower-scope version of the full architecture rather than a partial/broken slice of every layer at once — consistent with building for institutional trust rather than demo-quality breadth.
