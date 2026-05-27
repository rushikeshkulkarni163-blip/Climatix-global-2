# CLAUDE.md

This file provides operational, architectural, and behavioral instructions for Claude Code when working on the Climactix Global platform.

---

## DESIGN SYSTEM — READ FIRST

**ALWAYS read `DESIGN.md` before writing or editing any HTML/CSS.**

The Climactix design system is defined in [`DESIGN.md`](./DESIGN.md). Every UI decision — colors, typography, spacing, borders, elevation, motion — must follow that file exactly. Do not deviate, invent new patterns, or fall back to defaults.

### Non-negotiable design rules (from DESIGN.md):

1. **Background**: `#000000` pure matte black. NEVER warm charcoal or cold navy.
2. **Primary accent**: `#FF6600` Bloomberg amber. NEVER organic green or neon cyan.
3. **Borders**: `#2C2C2C` (default), `#333333` (strong). NEVER `rgba` white overlays.
4. **Typography**: IBM Plex Mono for all data/numbers. Inter for body text.
5. **Elevation**: Surface ladder only — `--surface` → `--surface-2` → `--surface-3`. NEVER `box-shadow` on cards.
6. **Nav**: Solid black background. NEVER glassmorphism or `backdrop-filter: blur()`.
7. **Border-radius**: 3px maximum on all cards, panels, buttons. NEVER rounded pills.
8. **Motion**: `0.12s ease` for all transitions. NEVER > 1s for UI interactions.
9. **Section headers**: ALL-CAPS, IBM Plex Mono, letter-spacing. Bloomberg DNA.
10. **Data values**: Always IBM Plex Mono. Never Inter for prices, scores, metrics.

### Anti-patterns (absolutely forbidden):
- Rounded corners > 6px anywhere except avatar circles
- `backdrop-filter: blur()` on any surface
- Gradient text or gradient backgrounds on panels
- `transform: scale()` or `translateY()` on hover
- Glowing box-shadows on cards or panels
- Startup-style pill buttons
- Warm charcoal (`#0C0C0E`) or organic green (`#4ADE80`) — those were the old system
- Consumer UI spacing (80px+ section padding on analytics pages)

---

# PROJECT IDENTITY

**Project Name:** Climactix Global

**Mission:**
Build an institutional-grade Climate Risk Intelligence Operating System for capital allocation, enterprise sustainability intelligence, and climate-linked financial decision making.

**Climactix Global is NOT:**
- A generic ESG dashboard
- A compliance checklist tool
- A sustainability reporting portal only
- A carbon calculator startup

**Climactix Global IS:**
- A climate risk intelligence infrastructure platform
- A financial-grade risk analytics system
- A climate operating system for enterprises and investors
- A scenario simulation and risk quantification engine
- An AI-native sustainability intelligence platform

**Target Benchmark:**
Bloomberg Terminal · MSCI · BlackRock Aladdin · Moody's Analytics · S&P Global · McKinsey Sustainability Intelligence · KPMG ESG Advisory Systems

---

# CORE PRODUCT MODULES

## 1. Enterprise Assessment Engine

**Purpose:** Collect structured sustainability, operational, governance, emissions, supply-chain, and climate-risk data from enterprises.

**Capabilities:**
- Dynamic industry-based questionnaires
- Multi-stage assessments with auto-save
- Evidence/document upload
- ESG maturity scoring
- Climate preparedness scoring
- Transition risk scoring
- Physical risk exposure mapping

**Key files:** `enterprise-assessment.html`, `enterprise-dashboard.html`, `enterprise-onboarding.html`, `enterprise-login.html`, `enterprise.js`, `climate-risk-os.html`

**Rules:**
- Assessment logic must adapt based on selected industry
- Every answer must contribute to downstream risk simulation
- Store all responses in structured schema form

---

## 2. Climate Risk Intelligence Engine

**Purpose:** Convert raw enterprise data into quantified climate intelligence.

**Capabilities:**
- Physical risk modeling (flood, heatwave, water stress, cyclone, sea-level, wildfire)
- Transition risk analysis (carbon tax, fossil dependency, regulatory, stranded assets)
- Carbon exposure analysis
- Revenue-at-risk simulation
- Climate scenario modeling (1.5°C, 2°C, 3°C, delayed transition, disorderly transition)
- Net-zero credibility scoring
- Greenwashing detection
- AI narrative analysis

**Key files:** `intelligence-engine.js`, `climate-risk-os.html`, backend services in `backend/services/`

**Rules:**
- All scoring must be explainable — no black-box logic
- Every score must contain reasoning layers
- Scores must support institutional interpretation

---

## 3. Investor Intelligence Terminal

**Purpose:** Provide investors with institutional-grade climate intelligence dashboards.

**Capabilities:**
- Company climate profiles (20 entities, 13 industries)
- Portfolio climate exposure and aggregation
- Climate-adjusted investment signals
- Comparative benchmarking vs industry averages
- NGFS-aligned scenario stress testing (6 pathways)
- Carbon market price tracking
- Regulatory exposure matrices
- Climate intelligence feed

**Key files:** `investor-terminal.html`, `intelligence-engine.js`

**Design inspiration:** Bloomberg Terminal · BlackRock Aladdin · Refinitiv Workspace

**Rules:**
- Prioritize dense but readable information layouts
- Avoid consumer-grade UI patterns
- Use institutional design language (see `DESIGN.md`)
- Dark-mode optimized analytics interfaces

---

## 4. AI Disclosure & Reporting Engine

**Purpose:** Generate professional climate and sustainability reports.

**Outputs:** ESG Reports, BRSR Reports, TCFD Reports, CSRD-aligned reports, CDP-style disclosures, climate risk summaries, board-level summaries, investor-ready climate intelligence reports

**Key files:** `climactix-ai.html`, backend AI services

**Rules:**
- Never fabricate metrics
- Never invent commitments
- Avoid exaggerated ESG language
- Maintain institutional tone
- Remove unnecessary "AI-generated" references

---

# CURRENT FILE MAP

| File | Module | Purpose |
|------|---------|---------|
| `enterprise-assessment.html` | System 1 | Industry-adaptive assessment with C-LAYER scoring |
| `enterprise-dashboard.html` | System 1 | Company intelligence dashboard |
| `enterprise-onboarding.html` | System 1 | Company + representative registration |
| `enterprise-login.html` | System 1 | Auth gateway |
| `enterprise.js` | System 1 | Data layer — companies, reps, assessments, RBAC |
| `climate-risk-os.html` | System 2 | C-LAYER Intelligence OS (3,711 lines) |
| `intelligence-engine.js` | System 2+3 | Central intelligence data layer — 20 companies, 6 scenarios, risk models |
| `investor-terminal.html` | System 3 | 4-module Bloomberg investor terminal |
| `dashboard.html` | System 2 | ESG intelligence dashboard |
| `simulation.html` | System 2 | Risk intelligence map (3,548 lines) |
| `climactix-ai.html` | System 4 | AI narrative engine |
| `community.html` | Platform | Social feed |
| `community.js` | Platform | Community data layer |
| `leaderboard.html` | Platform | Global climate rankings |
| `funding-hub.html` | Platform | VC pitch + Funding Hub |
| `forum.html` | Platform | Discussion threads |
| `assessment.html` | Platform | ERI 2.0 climate score assessment |
| `DESIGN.md` | — | **Design system — read before any UI work** |

---

# PLATFORM ARCHITECTURE

**Architecture style:** Modular AI-native SaaS architecture

**Frontend (current):**
- Vanilla HTML/CSS/JS (no framework) — all new pages continue this pattern
- No external CSS frameworks — all styles in `<style>` blocks
- `localStorage` for state persistence
- Firebase for auth (`auth.js`, `firebase-config.js`)

**Preferred stack (production roadmap):**
- Frontend: Next.js + TypeScript + TailwindCSS + ShadCN UI
- Backend: Node.js + Python microservices + FastAPI
- Database: PostgreSQL + Redis
- AI: Claude API + OpenAI API + RAG pipelines + Vector DBs

**Backend (current):** FastAPI (Python) in `backend/` — Docker Compose + PostgreSQL

---

# DATA ARCHITECTURE

**Required intelligence layers:**
- Company metadata + operational footprint
- Emissions profile (Scope 1/2/3 + intensity)
- Physical risk exposure (geo-based hazard scoring)
- Transition risk exposure (policy, technology, market)
- Regulatory exposure + framework compliance
- Supply chain vulnerability
- Financial risk indicators (revenue at risk, EBITDA impact, stranded assets)
- Climate scenario impacts (6 NGFS pathways)

**Important:** All enterprise data must be normalized into structured intelligence layers. Raw reports must be extracted and scored, not stored as blobs.

---

# AI SYSTEM RULES

**AI outputs must:**
- Be explainable with reasoning layers
- Be institutional-grade — sound like Moody's or MSCI, not a startup pitch
- Avoid generic ESG statements
- Prioritize actionable intelligence and financial materiality
- Detect greenwashing, weak commitments, disclosure inconsistencies

**AI must NOT:**
- Generate fake metrics or invent targets
- Fabricate emissions reductions
- Produce unverifiable claims
- Overuse sustainability buzzwords
- Sound like a corporate sustainability report ghostwriter

---

# SCORING SYSTEM RULES

**All scores must:**
- Have weighted, explainable logic
- Include confidence levels and risk reasoning
- Support institutional interpretation
- Use the AAA → AA → A → BBB → BB → B → CCC rating scale (NOT percentage scores)

**Core scores:**
- C-Score (10–100 scale, maps to letter rating)
- C-LAYER Framework: C-CORE, C-FIN, C-RISK/P, C-RISK/T, C-CAPITAL, C-SUPPLY, C-ADAPT, C-TRUTH
- Physical Risk Score (0–100 per hazard)
- Transition Risk Score (0–100 per factor)
- Climate Credibility Score (0–100)
- Greenwashing Risk — flagged qualitatively + scored

---

# CODING STANDARDS

**Code requirements:**
- Production-grade only — no placeholder logic
- Modular architecture, reusable components
- Never hardcode colors — always use CSS variables from `:root`
- The `--t` variable = `0.12s ease` — use for all transitions
- `--amber-fg: #000000` is the text color ON amber buttons
- Strong typing required in TypeScript modules
- No monolithic files — split logic from presentation

**For community/social modules:**
- Preserve all JavaScript logic in `community.js` — only touch CSS/HTML for design work

**For intelligence modules:**
- `intelligence-engine.js` exports `window.INTELLIGENCE` — follow this pattern for new engines
- `enterprise.js` exports `window.ENTERPRISE` — follow this pattern for enterprise data

---

# AUTHENTICATION & ACCESS CONTROL

**User roles:**
1. **Enterprise Users** — submit assessments, upload reports, access generated intelligence, view scores
2. **Investors** — access investor terminal, portfolio tools, scenario simulation
3. **Climactix Internal Team** — review/modify assessments, approve reports, manage accounts, admin intelligence

**Rules:**
- Enterprise users cannot access investor terminal admin functions
- Admin modifications must be logged
- Preserve full audit trail history

---

# REPORT GENERATION RULES

**Generated reports must:**
- Be boardroom-ready with institutional formatting
- Be exportable to PDF
- Include executive summaries + risk visualizations
- Include quantified insights + scenario comparison tables

**Avoid:**
- Marketing-style language
- Empty sustainability claims
- Generic ESG phrasing

---

# API DESIGN RULES

**All APIs must:**
- Be versioned (e.g., `/api/v1/`)
- Have schema validation (Pydantic for Python)
- Include structured error handling
- Support audit logging
- Be documented with OpenAPI specs
- Use JWT authentication + RBAC

---

# PRODUCT POSITIONING

**Core positioning statement:**

> "Climactix Global is a Climate Risk Intelligence Operating System that translates sustainability and climate complexity into decision-grade financial intelligence for enterprises, investors, and institutions."

---

# IMPORTANT PHILOSOPHY

**The platform should feel:**
Trusted · Institutional · Analytical · Executive-grade · Financially intelligent

**The platform should NEVER feel:**
Activist-driven · Generic ESG software · Compliance-only · Startup-hyped · AI gimmicky

**Output quality standard:**
Every feature, dashboard, report, workflow, and AI output should resemble the quality expected from Bloomberg, BlackRock, Moody's, McKinsey, KPMG, or institutional financial platforms.

No prototype-quality outputs. No generic ESG language. No shallow sustainability insights. **Build for institutional trust.**
