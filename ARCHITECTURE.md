# CLIMACTIX GLOBAL — INSTITUTIONAL CLIMATE INTELLIGENCE ARCHITECTURE
## Platform Architecture, Methodology Handbook & Engineering Specification
### Version 1.0 — Confidential Internal Document

---

> **Classification:** Internal Architecture — Not for distribution  
> **Quality Standard:** Bloomberg Terminal · Moody's Analytics · MSCI Climate · S&P Global  
> **Platform Identity:** Climate Risk Operating System for Capital Allocation

---

## EXECUTIVE SUMMARY

Climactix Global is designed as a Climate Risk Intelligence Operating System — not an ESG questionnaire platform, not a compliance checklist tool, not a sustainability reporting portal. Every architectural decision in this document is made in service of one goal: transforming raw company data into institutional-grade climate intelligence usable for capital allocation, sovereign risk assessment, and regulatory decision-making.

The architecture described here produces outputs comparable to:
- **Moody's ESG Solutions** — quantified risk ratings with methodology transparency
- **MSCI Climate Analytics** — scenario-based portfolio stress testing
- **S&P Global ESG Scores** — sector-adjusted, evidence-weighted scoring
- **Bloomberg ESG Terminal** — real-time data density and peer benchmarking
- **BlackRock Aladdin Climate** — financial materiality integration

This document covers 13 architectural layers, each with full methodology, database schema, API design, and scoring formulas.

---

## TABLE OF CONTENTS

1. [Platform Architecture Overview](#1-platform-architecture-overview)
2. [Company Profiling Engine](#2-company-profiling-engine)
3. [Industry Materiality Engine](#3-industry-materiality-engine)
4. [Question Design Architecture](#4-question-design-architecture)
5. [Framework Mapping Engine](#5-framework-mapping-engine)
6. [Evidence Verification Engine](#6-evidence-verification-engine)
7. [Scoring Engine](#7-scoring-engine)
8. [Confidence Engine](#8-confidence-engine)
9. [Benchmarking Engine](#9-benchmarking-engine)
10. [Climate Risk Simulation Engine](#10-climate-risk-simulation-engine)
11. [Disclosure Generator](#11-disclosure-generator)
12. [Company Intelligence Dashboard](#12-company-intelligence-dashboard)
13. [Auditability Architecture](#13-auditability-architecture)
14. [Complete Database Schema](#14-complete-database-schema)
15. [API Architecture](#15-api-architecture)
16. [Implementation Roadmap](#16-implementation-roadmap)

---

## 1. PLATFORM ARCHITECTURE OVERVIEW

### 1.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIMACTIX INTELLIGENCE STACK                     │
├─────────────────────────────────────────────────────────────────────────┤
│  PRESENTATION LAYER                                                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │  Enterprise  │ │  Investor    │ │  Regulator   │ │  Internal    │   │
│  │  Portal      │ │  Terminal    │ │  Dashboard   │ │  CX Portal   │   │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│  API GATEWAY LAYER (FastAPI + JWT + RBAC)                                │
│  /api/v1/assess  /api/v1/score  /api/v1/bench  /api/v1/simulate         │
│  /api/v1/disclose  /api/v1/evidence  /api/v1/intelligence                │
├─────────────────────────────────────────────────────────────────────────┤
│  INTELLIGENCE ENGINE LAYER                                                │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐           │
│  │ Assessment │ │  Scoring   │ │ Simulation │ │ Disclosure │           │
│  │   Engine   │ │   Engine   │ │   Engine   │ │ Generator  │           │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘           │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐           │
│  │ Framework  │ │ Benchmark  │ │ Evidence   │ │ Confidence │           │
│  │  Mapping   │ │   Engine   │ │  Verify    │ │   Engine   │           │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘           │
├─────────────────────────────────────────────────────────────────────────┤
│  AI SERVICES LAYER (Claude API + RAG + Vector DB)                        │
│  ┌────────────────────┐ ┌─────────────────────┐ ┌──────────────────┐   │
│  │ Evidence Extractor │ │ Greenwashing Detect  │ │ Narrative Engine │   │
│  └────────────────────┘ └─────────────────────┘ └──────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│  DATA LAYER (PostgreSQL + Redis + S3)                                     │
│  Companies · Assessments · Scores · Evidence · Benchmarks · Audit Logs  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Core Intelligence Principles

**Principle 1 — Financial Materiality First**  
Every question, score, and output is anchored to financial materiality. Climate risk is a financial risk. The platform quantifies impact in currency terms wherever possible.

**Principle 2 — Explainability by Design**  
No black-box scoring. Every score references specific questions, weights, evidence, and methodology. An analyst at Moody's must be able to audit every number the platform produces.

**Principle 3 — Sector Specificity**  
A cement company's climate profile is structurally different from a bank's. All engines are sector-parameterized. Generic scores are never produced — only sector-adjusted intelligence.

**Principle 4 — Confidence-Weighted Output**  
Every score carries a confidence envelope. A score based on 3 uploaded documents carries different institutional weight than one backed by 40 audited data sources.

**Principle 5 — Framework Interoperability**  
One assessment populates all frameworks simultaneously. Companies do not fill out BRSR, then TCFD, then CDP separately. The platform handles crosswalk automatically.

---

## 2. COMPANY PROFILING ENGINE

### 2.1 Profiling Workflow

The Company Profiling Engine is the first intelligence layer. It does not simply collect metadata — it constructs a **Dynamic Risk Profile** that drives every subsequent engine's behavior.

#### Stage 1: Company Identity

```
FIELDS CAPTURED:
─────────────────────────────────────────────────────────────────
company_name          VARCHAR(255)    Legal registered name
legal_entity_type     ENUM           Private / Public / PSU / MNC / JV
cin_number            VARCHAR(50)     Corporate Identification Number
ticker_symbol         VARCHAR(20)     For listed entities
industry_code         VARCHAR(20)     GICS Level 1 code
sub_industry_code     VARCHAR(20)     GICS Level 4 code
geography_primary     VARCHAR(10)     ISO 3166-1 alpha-2
geographies_operated  JSONB          Array of country codes
revenue_usd_band      ENUM           <10M / 10-50M / 50-250M / 250M-1B / 1B-5B / >5B
employee_count_band   ENUM           <100 / 100-500 / 500-2000 / 2000-10000 / >10000
fiscal_year_end       DATE
founded_year          INTEGER
ownership_structure   ENUM           Family / Institutional / Government / Dispersed / PE-backed
listed_exchanges      JSONB          Array of exchange codes
credit_rating         VARCHAR(10)    S&P / Moody's / Fitch equivalent if available
```

#### Stage 2: Operational Footprint Mapping

```
OPERATIONAL FOOTPRINT:
─────────────────────────────────────────────────────────────────
asset_locations[]        JSONB   [{lat, lon, asset_type, capacity, criticality}]
manufacturing_sites[]    JSONB   [{location, annual_output_units, energy_intensity}]
office_locations[]       JSONB   [{location, employee_count}]
data_center_locations[]  JSONB   [{location, pue_ratio, MW_capacity}] — IT sector
port_terminals[]         JSONB   [{port_code, throughput_mtpa}] — Ports/Logistics
agricultural_land[]      JSONB   [{location_state, hectares, crop_type}] — Agriculture

SUPPLY CHAIN PROFILE:
─────────────────────────────────────────────────────────────────
tier1_supplier_count     INTEGER
tier1_supplier_geographies JSONB  Country distribution
key_raw_materials[]      JSONB   [{material, annual_volume, primary_source_country, criticality}]
supplier_concentration   FLOAT   HHI index of supplier distribution (0–1)
export_market_share      FLOAT   % revenue from exports
key_export_markets[]     JSONB   Country codes + revenue share

PHYSICAL ASSET PROFILE:
─────────────────────────────────────────────────────────────────
total_fixed_assets_usd   BIGINT
coastal_asset_exposure   FLOAT   % assets within 10km of coast
flood_zone_assets        FLOAT   % assets in 100-year flood zones
water_stressed_assets    FLOAT   % assets in WRI Aqueduct High/Extremely High stress zones
```

### 2.2 Dynamic Risk Profile Generation

After profiling, the backend generates a `CompanyRiskProfile` object. This object drives all downstream engines.

```python
class CompanyRiskProfile:
    # Derived automatically from Company Profile

    physical_risk_priority: List[str]     # Ordered hazard types by exposure
    transition_risk_priority: List[str]   # Ordered transition factors by exposure
    material_sectors: List[str]           # SASB materiality table sectors
    regulatory_jurisdictions: List[str]   # Applicable regulatory frameworks by geography
    supply_chain_risk_tier: str           # Low / Medium / High / Critical
    asset_vulnerability_class: str       # Low / Moderate / High / Extreme
    carbon_exposure_class: str           # Scope 1 Heavy / Scope 2 Heavy / Scope 3 Heavy / Mixed
    disclosure_frameworks_required: List[str]  # Auto-selected based on geography + listing
    peer_benchmark_group_id: str         # Auto-assigned peer cohort
    assessment_complexity: str           # Standard / Enhanced / Full-Spectrum
    question_set_ids: List[str]          # Dynamic question set selection

    # Example: Steel company in Maharashtra with coastal assets
    # physical_risk_priority = ["heat", "water_stress", "flood", "cyclone"]
    # transition_risk_priority = ["carbon_pricing", "energy_costs", "regulation"]
    # carbon_exposure_class = "Scope 1 Heavy"
    # assessment_complexity = "Full-Spectrum"
    # disclosure_frameworks_required = ["BRSR", "TCFD", "IFRS_S2", "GRI"]
```

### 2.3 Backend Logic — Industry Risk Differentiation

The following matrix illustrates how the profiling engine differentiates risk exposure by industry:

```
INDUSTRY               PHYSICAL RISK CLASS    TRANSITION RISK CLASS   CARBON CLASS
─────────────────────────────────────────────────────────────────────────────────
Steel                  High                   Critical                Scope 1 Heavy
Cement                 Moderate               Critical                Scope 1 Heavy
Power Generation       High                   Critical                Scope 1 Heavy
Oil & Gas              High                   Critical                Scope 1+3 Heavy
Mining                 High                   High                    Scope 1 Heavy
Aviation               Moderate               High                    Scope 1 Heavy
Shipping               High                   High                    Scope 1 Heavy
Ports                  Critical (sea level)   Moderate                Mixed
Real Estate            Critical               Moderate                Scope 2+3 Heavy
Agriculture            Critical (heat/drought) Low-Moderate          Mixed
Data Centers           Moderate               High                    Scope 2 Heavy
Banking                Low Direct             High Indirect           Financed (Scope 3)
Asset Management       Low Direct             High Indirect           Portfolio-linked
Insurance              High (liability)       High                    Claims-linked
FMCG                   High (supply chain)    Moderate               Scope 3 Heavy
Pharma                 Moderate               Low-Moderate            Mixed
IT                     Low Direct             Moderate               Scope 2 Heavy
Logistics              High                   High                    Scope 1+3 Heavy
```

---

## 3. INDUSTRY MATERIALITY ENGINE

### 3.1 Architecture

The Industry Materiality Engine maps every GICS sector to a **Materiality Matrix** — a weighted hierarchy of climate and ESG factors that determines which questions are asked, in what order, with what weight, and against which benchmarks.

The materiality engine is based on three source standards:
1. **SASB Materiality Map** — sector-specific financial materiality
2. **TCFD Recommendations** — climate-specific risk categories
3. **GRI Universal Standards** — disclosure completeness

### 3.2 Sector Materiality Matrices (Selected)

#### STEEL SECTOR

```yaml
sector: Steel
gics_code: "15101030"
carbon_intensity_class: Very High (1.85 tCO2/t steel global avg)
water_intensity_class: High
physical_risk_priority:
  - heat_stress: CRITICAL  # blast furnace cooling, worker safety
  - water_stress: CRITICAL  # process water, cooling towers
  - flood: HIGH            # raw material storage, logistics
  - cyclone: MEDIUM        # coastal plant exposure
transition_risk_priority:
  - carbon_pricing: CRITICAL    # direct EU ETS / India PAT scheme exposure
  - energy_costs: CRITICAL      # 30-40% of production cost
  - technology_shift: HIGH      # DRI-H2, electric arc furnace transition
  - regulation: HIGH            # BIS standards, export quality requirements
  - market_demand_shift: MEDIUM # green steel premium market emerging
material_esg_factors:
  - GHG_emissions_intensity: weight=0.25
  - energy_management: weight=0.20
  - water_management: weight=0.15
  - waste_hazardous: weight=0.10
  - worker_health_safety: weight=0.15
  - supply_chain_management: weight=0.10
  - community_impact: weight=0.05
required_disclosure_frameworks: [BRSR, TCFD, GRI, IFRS_S2, CDP]
benchmark_peer_group: Steel-India-Large / Steel-India-Mid / Steel-Global
```

#### BANKING SECTOR

```yaml
sector: Banking
gics_code: "40101010"
carbon_intensity_class: Low Direct / Very High Financed
physical_risk_priority:
  - flood: HIGH              # collateral asset exposure, branch network
  - heat_stress: MEDIUM      # branch operations, agricultural loan exposure
  - water_stress: LOW_DIRECT # high via financed portfolio
  - cyclone: MEDIUM          # coastal branch/ATM exposure
transition_risk_priority:
  - stranded_asset_risk: CRITICAL   # fossil fuel loan book
  - regulatory: CRITICAL            # RBI climate risk circular, NGFS alignment
  - credit_risk: HIGH               # borrower climate risk migration
  - market_risk: HIGH               # carbon-exposed equity portfolio
  - reputational: HIGH              # green finance commitments
material_esg_factors:
  - financed_emissions_scope3: weight=0.30
  - climate_risk_governance: weight=0.20
  - green_finance_portfolio: weight=0.15
  - physical_risk_exposure_loans: weight=0.15
  - data_privacy_security: weight=0.10
  - financial_inclusion: weight=0.10
required_disclosure_frameworks: [BRSR, TCFD, GRI, IFRS_S1, IFRS_S2, RBI_Climate_Circular]
benchmark_peer_group: Banking-India-PSU / Banking-India-Private / Banking-Global-Emerging
```

#### REAL ESTATE SECTOR

```yaml
sector: Real Estate
gics_code: "60102010"
carbon_intensity_class: High (Scope 2) / Very High (Scope 3 - tenant operations)
physical_risk_priority:
  - flood: CRITICAL         # property value, insurance, mortgage
  - sea_level_rise: CRITICAL # coastal asset portfolio
  - heat_stress: HIGH       # cooling demand, habitability
  - cyclone: HIGH           # structural damage, insurance gaps
  - wildfire: MEDIUM        # peri-urban exposure
transition_risk_priority:
  - energy_efficiency_regulation: CRITICAL  # BEE ratings, green building codes
  - carbon_pricing: HIGH                    # embodied carbon in construction
  - technology_shift: HIGH                  # EV charging, smart building requirements
  - market_preference: HIGH                 # green premium / brown discount
material_esg_factors:
  - energy_efficiency_buildings: weight=0.25
  - embodied_carbon: weight=0.15
  - physical_risk_asset_mapping: weight=0.20
  - green_certification_coverage: weight=0.15
  - tenant_emissions: weight=0.10
  - water_efficiency: weight=0.10
  - social_impact: weight=0.05
```

*(Full materiality matrices exist for all 26 sectors. Abbreviated here for document scope. Full sector definitions stored in `backend/services/industry_ontology.py`.)*

### 3.3 Question Pool Architecture

Each sector has a **question pool** of 100–250 questions. Questions are tagged and selected dynamically based on the company's risk profile.

```
QUESTION POOL SIZES:
─────────────────────────────────────────────────────────────────
Manufacturing (General):   180 questions
Cement:                    165 questions
Steel:                     175 questions
Mining:                    190 questions
Power Generation:          200 questions
Oil & Gas:                 220 questions
Logistics:                 150 questions
Ports:                     160 questions
Aviation:                  170 questions
Shipping:                  165 questions
Automotive:                175 questions
Construction:              160 questions
Real Estate:               155 questions
FMCG:                      150 questions
Retail:                    130 questions
Pharmaceuticals:           145 questions
Banking:                   180 questions
Insurance:                 175 questions
Asset Management:          165 questions
Information Technology:    140 questions
Data Centers:              145 questions
Telecommunications:        135 questions
Agriculture:               200 questions
Food Processing:           155 questions
Hospitality:               130 questions
Government Agencies:       150 questions
```

### 3.4 Dynamic Question Selection Algorithm

Not all questions are presented to every company. The engine selects a **targeted assessment set** based on the company's risk profile.

```python
def select_question_set(company: CompanyProfile, risk_profile: CompanyRiskProfile) -> List[Question]:
    """
    Returns ordered, weighted question set for this company.
    Selection logic:
    1. All MANDATORY questions for the sector (always included)
    2. All CRITICAL materiality questions matching company's top risk priorities
    3. HIGH materiality questions where company has indicated exposure
    4. STANDARD questions up to assessment_complexity limit
    5. OPTIONAL questions triggered by prior answers (conditional logic)
    """
    base_set = QuestionBank.get_mandatory(sector=company.industry_code)

    for risk in risk_profile.physical_risk_priority[:3]:
        base_set += QuestionBank.get_by_risk(risk, materiality="CRITICAL")

    for risk in risk_profile.transition_risk_priority[:3]:
        base_set += QuestionBank.get_by_risk(risk, materiality="CRITICAL")

    # Add HIGH materiality questions
    high_mat = QuestionBank.get_by_materiality("HIGH", sector=company.industry_code)
    base_set += [q for q in high_mat if q not in base_set]

    # Complexity gate
    limits = {"Standard": 80, "Enhanced": 130, "Full-Spectrum": 200}
    max_q = limits[risk_profile.assessment_complexity]

    return deduplicate(base_set)[:max_q]
```

---

## 4. QUESTION DESIGN ARCHITECTURE

### 4.1 Question Schema

Every question in the platform's 4,000+ question bank follows this schema:

```sql
CREATE TABLE questions (
    question_id         VARCHAR(20) PRIMARY KEY,    -- Q-STEEL-GHG-001
    question_text       TEXT NOT NULL,
    question_type       ENUM NOT NULL,              -- quantitative / categorical / boolean / text / upload
    category            VARCHAR(50) NOT NULL,       -- Energy / Emissions / Water / Governance / etc.
    sub_category        VARCHAR(50),
    materiality_level   ENUM NOT NULL,              -- MANDATORY / CRITICAL / HIGH / STANDARD / OPTIONAL
    sector_codes        JSONB NOT NULL,             -- Array of applicable GICS codes
    sub_sector_codes    JSONB,
    geography_scope     JSONB,                      -- null = global, else specific countries
    framework_mappings  JSONB NOT NULL,             -- {BRSR: "B1.2", GRI: "302-1", TCFD: "Metrics.a", ...}
    risk_categories     JSONB NOT NULL,             -- [{risk_type, risk_class, weight_in_scoring}]
    evidence_required   BOOLEAN,
    evidence_types      JSONB,                      -- Accepted evidence document types
    evidence_strength_multiplier FLOAT,             -- Score multiplier when evidence is provided
    scoring_logic       JSONB NOT NULL,             -- Full scoring formula for this question
    weight_in_category  FLOAT NOT NULL,             -- 0.0 to 1.0, sum per category = 1.0
    weight_global       FLOAT NOT NULL,             -- Weight in overall score (sector-adjusted)
    confidence_impact   FLOAT NOT NULL,             -- How much this question affects confidence score
    benchmark_category  VARCHAR(50),               -- Which benchmark peer group this feeds
    conditional_logic   JSONB,                      -- Show only if prior answer = X
    answer_options      JSONB,                      -- For categorical questions
    unit               VARCHAR(20),                -- For quantitative (tCO2, MWh, m3, %)
    normalization_base  VARCHAR(50),               -- Per revenue / per employee / per tonne produced
    data_year_required  BOOLEAN,                   -- Must specify which year data is for
    version             INTEGER DEFAULT 1,
    last_updated        TIMESTAMP,
    framework_version_refs JSONB                   -- {GRI: "2021", BRSR: "2023", ...}
);
```

### 4.2 Question Design Examples — Steel Sector

```
Q-STEEL-GHG-001
───────────────────────────────────────────────────────────────────────────
TEXT:      What is your total direct CO2 equivalent emissions (Scope 1) for
           the most recent fiscal year, normalized per tonne of crude steel
           produced? (tCO2e/t)
TYPE:      Quantitative
CATEGORY:  Emissions Management
MATERIALITY: MANDATORY
FRAMEWORKS: BRSR→B1.ii, GRI→305-1, TCFD→Metrics.a, IFRS_S2→29(a),
            CDP→C6.1, SASB→EM-IS-110a.1
RISK_REL:  carbon_pricing:CRITICAL, transition_risk:HIGH
EVIDENCE:  Required — Carbon inventory, audited emissions report, BEE PAT certificate
SCORING:   Benchmarked against sector median (1.85 tCO2/t global avg).
           Score = 100 - (50 × (value / sector_median))
           Capped 0–100. Evidence multiplier: ×1.25 if third-party verified.
WEIGHT:    0.25 in Emissions category; 0.08 in Overall Score
CONFIDENCE IMPACT: 0.12 (high-materiality question)
───────────────────────────────────────────────────────────────────────────

Q-STEEL-PHY-001
───────────────────────────────────────────────────────────────────────────
TEXT:      What percentage of your manufacturing capacity (by installed
           capacity MW or annual tonne output) is located in districts with
           a WRI Aqueduct water stress score of "High" or "Extremely High"?
TYPE:      Quantitative (percentage)
CATEGORY:  Physical Risk — Water
MATERIALITY: CRITICAL
FRAMEWORKS: TCFD→Risk.a, IFRS_S2→16(a), CDP→W5.1, GRI→303-1
RISK_REL:  water_stress:CRITICAL, operational_risk:HIGH
EVIDENCE:  Optional — Site location map, water audit report
SCORING:   >75% capacity in high stress → score 0–20 (Critical)
           50–75% → score 20–45 (High Risk)
           25–50% → score 45–65 (Moderate)
           10–25% → score 65–80 (Low-Moderate)
           <10% → score 80–100 (Resilient)
WEIGHT:    0.20 in Physical Risk category; 0.04 in Overall Score
───────────────────────────────────────────────────────────────────────────

Q-STEEL-GOV-001
───────────────────────────────────────────────────────────────────────────
TEXT:      Does your Board of Directors include a designated committee or
           board member with explicit responsibility for climate risk
           oversight? (Yes / No / In Progress)
TYPE:      Categorical
CATEGORY:  Governance
MATERIALITY: CRITICAL
FRAMEWORKS: TCFD→Governance.a, BRSR→A2, GRI→2-12, IFRS_S2→6(a)
RISK_REL:  governance:CRITICAL, transition_risk:MEDIUM
EVIDENCE:  Required — Board charter, committee terms of reference
SCORING:   Yes + Evidence → 100
           Yes, No Evidence → 60
           In Progress → 40
           No → 0
WEIGHT:    0.25 in Governance category; 0.03 in Overall Score
───────────────────────────────────────────────────────────────────────────
```

### 4.3 Conditional Question Logic

Questions can trigger follow-ups dynamically:

```python
# Example: If company answers "Yes" to having a net-zero target,
# the following questions are unlocked:
CONDITIONAL_CHAIN = {
    "Q-GOV-NZ-001": {  # Do you have a net-zero target?
        "Yes": ["Q-GOV-NZ-002",  # What is your target year?
                "Q-GOV-NZ-003",  # Is it SBTi validated?
                "Q-GOV-NZ-004",  # Does it cover Scope 3?
                "Q-GOV-NZ-005"], # What is the interim 2030 target?
        "No": ["Q-GOV-NZ-006"]  # Do you plan to set one within 24 months?
    }
}
```

---

## 5. FRAMEWORK MAPPING ENGINE

### 5.1 Architecture

The Framework Mapping Engine maintains a **Crosswalk Database** that links every question and answer to the specific disclosure requirements of 10 frameworks simultaneously.

```
ONE QUESTION → MULTIPLE FRAMEWORK OUTPUTS

Q-STEEL-GHG-001 (Scope 1 emissions intensity)
     │
     ├── BRSR: Section B, Principle 6, Essential Indicator 1(ii)
     ├── GRI: 305-1 (Direct GHG Emissions)
     ├── IFRS S2: Para 29(a) — Scope 1 absolute + intensity
     ├── TCFD: Metrics & Targets (a) — GHG emissions and targets
     ├── CDP: C6.1 — Scope 1 gross global emissions
     ├── SASB: EM-IS-110a.1 — Gross global Scope 1 emissions
     ├── CSRD: ESRS E1-6 — GHG emissions
     ├── UN SDG: Goal 13 (Climate Action), Goal 9 (Industry)
     ├── TNFD: Core metric — emissions intensity
     └── GHG Protocol: Scope 1 inventory
```

### 5.2 Crosswalk Database Schema

```sql
CREATE TABLE framework_crosswalk (
    crosswalk_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id         VARCHAR(20) REFERENCES questions(question_id),
    framework_code      VARCHAR(20) NOT NULL,      -- BRSR / GRI / IFRS_S2 / TCFD / etc.
    framework_version   VARCHAR(10) NOT NULL,      -- 2021 / 2023 / etc.
    disclosure_reference VARCHAR(100) NOT NULL,    -- B-P6-EI-1ii / 305-1 / etc.
    disclosure_title    TEXT,
    disclosure_text     TEXT,                       -- Exact disclosure requirement text
    answer_field_mapping JSONB,                    -- How answer maps to this disclosure field
    mandatory_for_geography JSONB,                 -- Countries where this is legally required
    disclosure_frequency VARCHAR(20),              -- Annual / Quarterly / As-occurred
    reporting_boundary  VARCHAR(50),               -- Organizational / Operational / Financial control
    last_framework_update TIMESTAMP,
    notes               TEXT
);

CREATE TABLE framework_versions (
    framework_code      VARCHAR(20) PRIMARY KEY,
    current_version     VARCHAR(10) NOT NULL,
    effective_date      DATE NOT NULL,
    changelog_summary   TEXT,
    auto_update_enabled BOOLEAN DEFAULT TRUE,
    last_sync           TIMESTAMP
);

-- Index for fast framework-specific queries
CREATE INDEX idx_crosswalk_framework ON framework_crosswalk(framework_code, framework_version);
CREATE INDEX idx_crosswalk_question ON framework_crosswalk(question_id);
```

### 5.3 Framework Coverage Matrix

```
                    BRSR  GRI  IFRS_S1  IFRS_S2  TCFD  CDP  SASB  SDG  CSRD  TNFD
─────────────────────────────────────────────────────────────────────────────────────
Governance           ✓    ✓      ✓        ✓       ✓     ✓    ✓    ✓     ✓     ✓
Strategy             ✓    ✓      ✓        ✓       ✓     ✓    ✓         ✓     ✓
Risk Management      ✓    ✓      ✓        ✓       ✓     ✓    ✓    ✓     ✓     ✓
Metrics & Targets    ✓    ✓      ✓        ✓       ✓     ✓    ✓    ✓     ✓     ✓
GHG Emissions        ✓    ✓               ✓       ✓     ✓    ✓    ✓     ✓
Energy               ✓    ✓                             ✓    ✓    ✓     ✓
Water                ✓    ✓                             ✓    ✓    ✓     ✓     ✓
Biodiversity         ✓    ✓                                        ✓    ✓     ✓
Supply Chain         ✓    ✓               ✓             ✓    ✓    ✓     ✓     ✓
Social / HR          ✓    ✓      ✓                           ✓    ✓     ✓
Physical Risk              ✓               ✓       ✓     ✓         ✓    ✓     ✓
Transition Risk            ✓               ✓       ✓     ✓         ✓    ✓
Scenario Analysis    ✓         ✓           ✓       ✓     ✓              ✓
Nature/Ecosystem                                                         ✓     ✓
```

### 5.4 Framework Update Management

```python
class FrameworkUpdateManager:
    """
    Handles framework versioning and backward compatibility.
    When IFRS S2 is updated, existing assessments are NOT retroactively
    rescored. They retain their framework version tag. New assessments
    use the new version. Comparisons across versions are flagged.
    """

    def handle_framework_update(self, framework_code: str, new_version: str):
        # 1. Create new version entry in framework_versions
        # 2. Clone existing crosswalk entries, tag with new version
        # 3. Apply diff — add new required disclosures, mark deprecated ones
        # 4. Flag all existing company reports as "assessed under v{old}"
        # 5. Generate upgrade diff report: what's new, what changed
        # 6. Send notification to companies needing reassessment

        diff = self.compute_framework_diff(framework_code, new_version)
        affected_companies = self.get_companies_with_framework(framework_code)

        for company in affected_companies:
            if diff.has_new_mandatory_questions:
                self.create_reassessment_request(company, diff.new_questions)
```

---

## 6. EVIDENCE VERIFICATION ENGINE

### 6.1 Evidence Architecture

```
EVIDENCE FLOW:
Company uploads document → S3 storage → AI extraction pipeline →
Claim extraction → Cross-reference with assessment answers →
Contradiction detection → Evidence Quality Score assignment →
Score multiplier applied to relevant answers
```

### 6.2 Accepted Evidence Types and AI Extraction Logic

```python
EVIDENCE_TYPES = {
    "annual_report": {
        "extract": ["revenue", "total_employees", "energy_consumption",
                    "emissions_data", "governance_commitments", "risk_disclosures"],
        "quality_weight": 0.70,  # Base quality — not third-party verified
        "ai_prompt": "Extract all climate, energy, emissions, and sustainability metrics..."
    },
    "esg_report": {
        "extract": ["ghg_scope1", "ghg_scope2", "ghg_scope3", "energy_mix",
                    "water_consumption", "waste_generated", "social_metrics"],
        "quality_weight": 0.75,
        "assurance_upgrade": 0.20  # Additional weight if third-party assured
    },
    "third_party_audit_report": {
        "extract": ["audited_metrics", "audit_scope", "material_findings",
                    "audit_standards", "auditor_name", "audit_date"],
        "quality_weight": 0.95,  # Highest weight — independently verified
    },
    "carbon_inventory": {
        "extract": ["scope1_breakdown", "scope2_market_based", "scope2_location_based",
                    "scope3_categories", "base_year", "methodology"],
        "quality_weight": 0.85,
        "ghg_protocol_compliance_check": True
    },
    "energy_audit_certificate": {
        "extract": ["certified_consumption", "efficiency_rating", "certification_body",
                    "validity_period"],
        "quality_weight": 0.90,
        "cross_reference": ["Q-ENERGY-001", "Q-ENERGY-002"]
    },
    "water_audit": {
        "quality_weight": 0.85,
        "cross_reference": ["Q-WATER-001", "Q-WATER-002", "Q-WATER-003"]
    },
    "supplier_audit_report": {
        "quality_weight": 0.80,
        "cross_reference": ["Q-SUPPLY-*"]
    },
    "policy_document": {
        "extract": ["policy_scope", "commitments", "targets", "effective_date",
                    "board_approval_date", "review_frequency"],
        "quality_weight": 0.55  # Intent, not performance data
    },
    "certification": {
        "extract": ["certification_type", "certifying_body", "scope", "expiry_date"],
        "quality_weight": 0.85
    }
}
```

### 6.3 AI Contradiction Detection

```python
class EvidenceVerificationEngine:

    def detect_contradictions(self, assessment_answers: dict, extracted_claims: dict) -> List[Contradiction]:
        """
        Compares what company stated in assessment vs. what documents actually show.
        Flags:
        - Stated Scope 1 emissions lower than calculated from energy data
        - Claimed renewable energy % not matching utility bills
        - Net-zero target year claimed in assessment not found in any uploaded document
        - Revenue stated doesn't match annual report
        """
        contradictions = []

        # Rule-based checks
        if assessment_answers.get("scope1_emissions"):
            doc_emissions = extracted_claims.get("ghg_scope1")
            if doc_emissions and abs(assessment_answers["scope1_emissions"] - doc_emissions) / doc_emissions > 0.10:
                contradictions.append(Contradiction(
                    type="QUANTITATIVE_MISMATCH",
                    field="scope1_emissions",
                    stated_value=assessment_answers["scope1_emissions"],
                    documented_value=doc_emissions,
                    severity="HIGH",
                    greenwashing_flag=True
                ))

        # AI-powered semantic contradiction check
        ai_analysis = self.claude_api.analyze_contradictions(
            assessment_text=self.format_assessment_summary(assessment_answers),
            document_text=self.format_document_summary(extracted_claims)
        )
        contradictions.extend(ai_analysis.contradictions)
        return contradictions
```

### 6.4 Evidence Quality Score Formula

```
EQS = (Σ(document_quality_weight × coverage_score × freshness_factor)) / N

WHERE:
  document_quality_weight: Intrinsic quality of document type (0.55–0.95)
  coverage_score: % of relevant questions this document provides evidence for
  freshness_factor: 1.0 if ≤1 year old, 0.85 if 1-2 years, 0.70 if 2-3 years, 0.50 if >3 years

EQS Bands:
  0.00 – 0.25: Insufficient (red flag — no meaningful evidence)
  0.25 – 0.50: Weak (self-reported only)
  0.50 – 0.70: Moderate (partial documentation)
  0.70 – 0.85: Strong (well-documented)
  0.85 – 1.00: Institutional Grade (audited, verified, comprehensive)
```

---

## 7. SCORING ENGINE

### 7.1 Score Architecture

The platform produces 11 distinct scores, each independently auditable, plus one composite score.

```
SCORE HIERARCHY:
─────────────────────────────────────────────────────────────────
Level 1 — Sub-component scores (question-level)
Level 2 — Category scores (e.g., Energy within Carbon Mgmt)
Level 3 — Domain scores (11 primary scores below)
Level 4 — Overall Climate Intelligence Score (CIS)
```

### 7.2 Domain Score Definitions and Weights

```
DOMAIN SCORE               WEIGHT IN CIS    DESCRIPTION
─────────────────────────────────────────────────────────────────
Governance Score           0.12             Board oversight, ESG policy, leadership accountability
Physical Risk Score        0.15             Hazard exposure, asset vulnerability, resilience measures
Transition Risk Score      0.15             Carbon exposure, regulation, technology, market shifts
Carbon Management Score    0.18             Emissions data, reduction targets, decarbonization pathway
Supply Chain Score         0.08             Supplier exposure, Scope 3, supply chain resilience
Compliance Score           0.07             Framework adherence, regulatory compliance, disclosures filed
Adaptation Score           0.08             CAPEX for adaptation, physical risk mitigation measures
Disclosure Quality Score   0.07             Completeness, accuracy, frequency of disclosures
Greenwashing Risk Score    0.05             Claim-evidence alignment, target credibility (inverted)
Climate Resilience Score   0.05             Strategic planning, scenario use, resilience investment
─────────────────────────────────────────────────────────────────
                    TOTAL  1.00
```

### 7.3 Scoring Formulas

#### Governance Score

```
G_score = (w1 × board_oversight) + (w2 × esg_policy_quality) + 
           (w3 × executive_accountability) + (w4 × audit_verification) +
           (w5 × stakeholder_engagement)

WHERE weights:
  board_oversight: 0.30        (Does board own climate risk? Committee? Expertise?)
  esg_policy_quality: 0.25    (Policy scope, board approval, review frequency)
  executive_accountability: 0.20 (C-suite KPIs linked to climate targets?)
  audit_verification: 0.15    (Third-party assurance of sustainability data?)
  stakeholder_engagement: 0.10 (Materiality assessment frequency, disclosure channels)

SECTOR ADJUSTMENT:
  Finance: board_oversight weight → 0.35 (regulatory expectation is higher)
  Mining: audit_verification → 0.25 (community accountability standard)

EVIDENCE MULTIPLIER:
  Policy uploaded + board charter confirmed → ×1.15 on policy_quality sub-score
  No evidence for any governance claim → confidence penalty -0.20
```

#### Physical Risk Score

```
PRS = Σ(hazard_weight_i × hazard_exposure_i × resilience_factor_i)

HAZARD EXPOSURES (quantitative inputs):
  flood_exposure:        % assets in 100-yr flood zone × asset_value_concentration
  heat_exposure:         WBGT threshold exceedance days per year at primary sites
  water_stress:          WRI Aqueduct score (0–5) at operational locations
  cyclone_exposure:      % revenue assets in cyclone-prone zones (IBTrACS classification)
  sea_level_exposure:    % assets within IPCC SLR 2050 inundation projection
  drought_exposure:      SPEI-12 drought frequency at agricultural/water-dependent sites

HAZARD WEIGHTS (default, sector-overridden):
  flood:       0.25
  heat:        0.20
  water_stress: 0.25
  cyclone:     0.15
  sea_level:   0.10
  drought:     0.05

RESILIENCE FACTOR (0.5 – 1.0):
  1.0: No mitigation measures in place
  0.85: Basic awareness, no capital deployed
  0.70: Early-stage adaptation CAPEX
  0.55: Moderate resilience investment, business continuity plans
  0.50: Comprehensive climate adaptation strategy, tested BCDR

SECTOR OVERRIDE (Ports):
  sea_level: 0.30, flood: 0.25, cyclone: 0.25, water_stress: 0.10, heat: 0.10
```

#### Carbon Management Score

```
CMS = (emissions_performance × 0.35) + (target_credibility × 0.25) +
      (data_quality × 0.20) + (reduction_trajectory × 0.15) +
      (scope3_coverage × 0.05)

emissions_performance:
  Benchmark: sector median tCO2e per unit of output
  score = 100 × (1 - (company_intensity / sector_p50_intensity))
  Capped: score cannot exceed 100. If company_intensity > 2× sector median → score = 0.

target_credibility:
  No target: 0
  Internal target, no validation: 20
  2°C-aligned target, self-declared: 45
  SBTi committed: 65
  SBTi approved (1.5°C): 85
  SBTi approved + interim milestones verified: 100

data_quality:
  Self-reported, no evidence: 30
  Annual report disclosure: 50
  Third-party reviewed: 70
  ISO 14064 verified: 85
  ISAE 3000 limited assurance: 90
  ISAE 3000 reasonable assurance: 100

reduction_trajectory:
  Emissions increasing: 0
  Emissions flat: 25
  Emissions declining <2%/yr: 50
  Declining 2-7%/yr (Paris-aligned): 80
  Declining >7%/yr with evidence: 100

scope3_coverage:
  No Scope 3 data: 0
  Partial categories only: 30
  All 15 GHG Protocol categories estimated: 60
  Material categories verified: 85
  Full verified + third-party audited: 100
```

#### Greenwashing Risk Score (INVERTED — higher = more greenwash risk)

```
GRS_raw = (claim_evidence_gap × 0.35) + 
           (target_credibility_gap × 0.25) +
           (language_intensity_excess × 0.20) +
           (missing_proof_rate × 0.20)

claim_evidence_gap: % of positive claims with zero supporting evidence
target_credibility_gap: Ambitious targets with no roadmap / interim milestones / CAPEX
language_intensity_excess: AI NLP score of superlative/unverifiable language density
missing_proof_rate: # mandatory evidence items not uploaded / total mandatory

GRS Bands (for display):
  0–20: Low Greenwash Risk (Credible)
  20–40: Moderate Concern
  40–60: Elevated Risk — Review Required
  60–80: High Greenwash Risk — Institutional Alert
  80–100: Critical — Regulatory Disclosure Risk

In CIS: GRS is INVERTED before being weighted
  CIS_contribution_from_GRS = (100 - GRS_raw) × 0.05
```

#### Overall Climate Intelligence Score (CIS)

```
CIS = Σ(domain_score_i × domain_weight_i) × sector_adjustment × geography_adjustment

SECTOR ADJUSTMENT FACTORS:
  Steel, Cement, Coal Mining, Oil & Gas: × 0.95
    (Higher baseline exposure means same actions are harder → normalizes for effort)
  Banking (direct ops only): × 1.05
    (Lower direct exposure → stricter standard on governance and financed emissions)
  IT, Software: × 1.05
  Agriculture: × 0.97

GEOGRAPHY ADJUSTMENT FACTORS:
  India (high physical risk, emerging policy): × 1.00 (baseline)
  EU (CSRD mandatory, ETS active): × 0.98 (stricter standard)
  USA: × 1.00
  Southeast Asia (high physical risk): × 0.99
  MENA (extreme heat/water): × 0.99

CIS → LETTER RATING MAPPING:
  90–100: AAA  (Best-in-Class — Institutional Grade)
  80–89:  AA   (Excellent Climate Intelligence)
  70–79:  A    (Strong — Above Sector Average)
  60–69:  BBB  (Moderate — Sector Average)
  50–59:  BB   (Below Average — Material Concerns)
  40–49:  B    (Weak — Significant Risk Exposure)
  30–39:  CCC  (Critical — Urgent Remediation Required)
  <30:    D    (Default — Institutional Disqualification)
```

---

## 8. CONFIDENCE ENGINE

### 8.1 Confidence Score Architecture

The Confidence Score answers a critical institutional question: **How much should I trust this rating?**

A company with CIS = BBB and Confidence = Very High is more actionable for a lender than a company with CIS = A and Confidence = Low.

### 8.2 Confidence Score Components

```
CONFIDENCE SCORE (CS) = (DC × 0.30) + (EQ × 0.25) + (DF × 0.20) + 
                         (CD × 0.10) + (CC × 0.10) + (VS × 0.05)

COMPONENT DEFINITIONS:

DC — Data Completeness (0–100)
  = (questions_answered / total_applicable_questions) × 100
  CRITICAL questions not answered → DC cannot exceed 60
  MANDATORY questions not answered → DC cannot exceed 40

EQ — Evidence Quality (0–100)
  = Evidence Quality Score × 100 (see Section 6.4)

DF — Data Freshness (0–100)
  All data current year:       100
  1 year old:                   85
  2 years old:                  65
  3 years old:                  45
  >3 years old:                 20
  Mix of years:               Weighted average

CD — Coverage Depth (0–100)
  All 11 domain scores have ≥5 contributing questions: 100
  Any domain score based on <3 questions:              60
  Any domain score based on <2 questions:              30

CC — Consistency Score (0–100)
  No detected contradictions between answers:   100
  1–2 minor inconsistencies:                    80
  1+ major contradiction flagged:               50
  Multiple significant contradictions:          20
  AI greenwashing flag triggered:               ≤30

VS — Verification Status (0–100)
  Third-party limited assurance on sustainability data: 75
  Third-party reasonable assurance (ISAE 3000):        100
  Self-reported only:                                   0
  Regulatory filing (MCA, SEBI, BSE):                 50

CONFIDENCE BANDS:
  CS ≥ 80: VERY HIGH — Institutional Grade (suitable for credit decisions)
  CS 60–79: HIGH — Strong (suitable for investment screening)
  CS 40–59: MEDIUM — Adequate (suitable for internal benchmarking)
  CS 20–39: LOW — Indicative (requires additional due diligence)
  CS < 20: INSUFFICIENT — Not actionable (do not use for decisions)
```

### 8.3 Confidence Display in Outputs

Every score output in the platform carries a confidence envelope:

```
CLIMATE INTELLIGENCE SCORE: BBB+ (64.2)
CONFIDENCE: HIGH (CS = 71)
─────────────────────────────────────────────
Data Completeness:    89% ████████████░░ 
Evidence Quality:     0.72 (Strong)
Data Freshness:       FY2024 (current)
Coverage Depth:       All 11 domains ≥5 questions
Consistency:          2 minor flags
Verification Status:  Annual Report + 3rd party energy audit
─────────────────────────────────────────────
INTERPRETATION: Score is reliable for investment screening.
For credit-grade decision making, recommend requesting
third-party ESG assurance to upgrade confidence to VERY HIGH.
```

---

## 9. BENCHMARKING ENGINE

### 9.1 Benchmark Architecture

The Benchmarking Engine maintains a **dynamic peer comparison layer** that provides context for every score. A CIS of 65 means something different for a coal miner than for an IT company.

### 9.2 Benchmark Cohort Construction

```python
def assign_benchmark_cohort(company: CompanyProfile) -> BenchmarkCohort:
    """
    Assigns company to most specific applicable peer group.
    Falls back to broader group if population < 5 companies.
    """
    cohort_hierarchy = [
        f"{industry_code}__{sub_industry_code}__{size_band}__{geography}",
        f"{industry_code}__{sub_industry_code}__{size_band}",
        f"{industry_code}__{sub_industry_code}",
        f"{industry_code}__{size_band}",
        f"{industry_code}",
        f"sector_group__{geography}",
    ]

    for cohort_id in cohort_hierarchy:
        cohort = BenchmarkCohortDB.get(cohort_id)
        if cohort and cohort.population >= 5:
            return cohort

    return BenchmarkCohortDB.get("global_all_sectors")
```

### 9.3 Benchmark Statistics Generated

```sql
CREATE TABLE benchmark_statistics (
    cohort_id           VARCHAR(100) NOT NULL,
    score_domain        VARCHAR(50) NOT NULL,     -- CIS / Governance / Physical / etc.
    period              VARCHAR(10) NOT NULL,      -- 2024Q4
    population          INTEGER NOT NULL,
    mean                FLOAT,
    median              FLOAT,
    p25                 FLOAT,                     -- 25th percentile
    p75                 FLOAT,                     -- 75th percentile
    p90                 FLOAT,                     -- 90th percentile (best-in-class)
    std_dev             FLOAT,
    best_in_class       FLOAT,
    worst_in_class      FLOAT,
    quartile_labels     JSONB,                     -- {Q1: "Laggard", Q2: "Developing", Q3: "Advanced", Q4: "Leader"}
    maturity_thresholds JSONB,                     -- Defined thresholds for maturity labels
    last_updated        TIMESTAMP,
    PRIMARY KEY (cohort_id, score_domain, period)
);
```

### 9.4 Maturity Levels

```
MATURITY LEVEL    PERCENTILE RANGE    INTERPRETATION
─────────────────────────────────────────────────────────────────────────
Laggard           < P25               Material gap vs. sector. Institutional red flag.
Developing        P25–P50             Below sector average. Improvement underway.
Progressing       P50–P75             At or above sector median. Adequate baseline.
Advanced          P75–P90             Top quartile. Credible climate leadership.
Leader            > P90               Best-in-class. Benchmark-setting performance.
```

### 9.5 Benchmark Output Format

```
BENCHMARK POSITION — STEEL SECTOR — INDIA — LARGE CAP
───────────────────────────────────────────────────────────────────────
                    Company    Sector Median    P75    Best-in-Class
───────────────────────────────────────────────────────────────────────
CIS (Overall)         64.2        59.1          71.3      88.4
Governance            71.0        55.0          68.0      91.0
Physical Risk         58.0        52.0          65.0      82.0
Carbon Management     61.0        61.0          74.0      91.0
Transition Risk       55.0        58.0          69.0      85.0
Supply Chain          48.0        44.0          56.0      79.0
───────────────────────────────────────────────────────────────────────
OVERALL PERCENTILE: 58th
MATURITY: PROGRESSING
KEY GAPS: Carbon Management (at median), Transition Risk (below median)
```

---

## 10. CLIMATE RISK SIMULATION ENGINE

### 10.1 Simulation Architecture

The Risk Simulation Engine uses the company's physical footprint, financial profile, and assessed risk exposures to generate forward-looking financial impact estimates under multiple climate scenarios.

### 10.2 Scenario Framework (NGFS-Aligned)

```
SCENARIO NAME              TEMP PATHWAY   TRANSITION      PHYSICAL RISK
─────────────────────────────────────────────────────────────────────────
Orderly — Net Zero 2050      1.5°C        Early, smooth    Low
Orderly — Below 2°C          <2°C         Gradual          Low-Medium
Disorderly — Divergent        ~2°C         Late, abrupt     Medium
Disorderly — Delayed          ~3°C         Very late        High
Hot House — NDCs only         ~2.5°C       Insufficient     High
Hot House — Current Policies  ~4°C+        No change        Very High
```

### 10.3 Physical Risk Simulation Methodology

#### Step 1: Hazard Probability Curves

For each physical hazard, the engine applies probabilistic projections from IPCC AR6 and regional downscaling:

```python
class PhysicalHazardEngine:

    def compute_flood_revenue_at_risk(self, company, scenario, year) -> float:
        """
        Formula:
        Revenue_at_Risk_flood = Σ_sites(
            asset_value_i × flood_damage_factor_i × business_interruption_factor_i ×
            flood_probability_increase_factor(scenario, year)
        )
        """
        total_risk = 0

        for site in company.asset_locations:
            # Get current flood return period at this lat/lon from flood database
            current_100yr_depth = FloodDB.get_depth(site.lat, site.lon, return_period=100)

            # Apply scenario and year projection from IPCC AR6 RCP pathway
            projected_depth = current_100yr_depth * ScenarioFactors.flood_amplification(
                scenario=scenario,
                year=year,
                region=site.region
            )

            # Damage factor from depth-damage curve (JRC Global Flood Database)
            damage_factor = DepthDamageCurve.get(
                asset_type=site.asset_type,
                flood_depth=projected_depth
            )

            # Business interruption: Days_offline × (Revenue/365)
            bi_factor = BusinessInterruptionDB.get(
                asset_type=site.asset_type,
                damage_factor=damage_factor
            )

            site_risk = site.asset_value × damage_factor + (company.annual_revenue / 365 * bi_factor)
            total_risk += site_risk

        return total_risk
```

#### Step 2: Heat Stress Productivity Loss

```python
def compute_heat_revenue_impact(company, scenario, year) -> float:
    """
    Methodology: Kjellstrom et al. (2016) labor productivity loss model
    Based on WBGT (Wet Bulb Globe Temperature) thresholds

    Light work threshold: WBGT > 29°C → productivity decline begins
    Moderate work: WBGT > 26°C
    Heavy outdoor work: WBGT > 23°C
    """
    productivity_loss = 0

    for site in company.manufacturing_sites:
        wbgt_current = ClimateDB.get_wbgt_percentile(site.lat, site.lon, percentile=95)
        wbgt_projected = wbgt_current + TemperatureProjection.delta(scenario, year, site.region)

        loss_factor = KjellstromCurve.get_loss(
            wbgt=wbgt_projected,
            work_intensity=site.work_intensity_class  # Light/Moderate/Heavy
        )

        affected_labor_cost = company.labor_cost * (site.headcount / company.total_headcount)
        productivity_loss += affected_labor_cost * loss_factor

    # Also model cooling capex increase
    cooling_cost_increase = compute_cooling_demand_increase(company, scenario, year)

    return productivity_loss + cooling_cost_increase
```

### 10.4 Transition Risk Simulation Methodology

#### Carbon Pricing Impact

```python
def compute_carbon_pricing_impact(company, scenario, year) -> float:
    """
    Carbon price trajectory from NGFS scenarios (USD/tCO2e):
    Net Zero 2050:    2030→$67,  2040→$162, 2050→$250
    Below 2°C:        2030→$45,  2040→$100, 2050→$175
    Delayed Transition: 2030→$15, 2040→$60,  2050→$150
    Current Policies:  2030→$5,  2040→$10,  2050→$20

    Direct cost = Scope1_emissions × carbon_price(scenario, year)
    Indirect cost = Scope2_emissions × grid_decarbonization_cost(scenario, year)
    Supply chain cost = material_carbon_intensity × procurement_volume × carbon_price × pass-through_rate
    """
    carbon_price = NGFSPriceDB.get(scenario=scenario, year=year, region=company.primary_geography)

    direct_cost = company.scope1_emissions_tco2e * carbon_price
    indirect_cost = company.scope2_emissions_tco2e * grid_cost_factor(scenario, year, company.primary_geography)
    supply_chain_cost = compute_scope3_carbon_cost(company, carbon_price)

    # Revenue at risk from customer demand shift (low-carbon product premium/discount)
    demand_shift_revenue = compute_demand_shift(company, scenario, year)

    return direct_cost + indirect_cost + supply_chain_cost + demand_shift_revenue
```

### 10.5 Simulation Output Format

```
CLIMATE RISK SIMULATION SUMMARY
Company: [REDACTED] | Sector: Steel | Scenario: Disorderly Transition (~3°C)
─────────────────────────────────────────────────────────────────────────────────────────
                          2030          2040          2050
─────────────────────────────────────────────────────────────────────────────────────────
PHYSICAL RISKS
  Flood damage (asset)    $2.1M         $5.8M         $14.2M
  Heat productivity loss  $8.4M         $19.1M        $41.3M
  Water stress OPEX       $3.2M         $9.4M         $22.0M
  Total Physical          $13.7M        $34.3M        $77.5M

TRANSITION RISKS
  Carbon pricing cost     $18.5M        $51.2M        $94.0M
  Energy cost increase    $7.3M         $22.1M        $45.6M
  Stranded asset risk     $0            $35.0M        $120.0M
  Revenue at risk (demand) $9.1M        $28.0M        $67.0M
  Total Transition        $34.9M        $136.3M       $326.6M

COMBINED RISK
  Total Revenue at Risk   $48.6M        $170.6M       $404.1M
  As % of Revenue         4.9%          17.1%         40.4%
  EBITDA Impact           -8.3%         -28.9%        -68.5%

─────────────────────────────────────────────────────────────────────────────────────────
CONFIDENCE: HIGH | METHODOLOGY: NGFS 2023 + IPCC AR6 | BASE YEAR: FY2024
```

---

## 11. DISCLOSURE GENERATOR

### 11.1 Architecture

The Disclosure Generator transforms structured assessment outputs into formatted, framework-compliant disclosure reports. Each report type uses a different template with AI-powered narrative generation for qualitative sections.

### 11.2 Generation Pipeline

```
                  ┌─────────────────────────────────────────────────┐
                  │           DISCLOSURE GENERATOR PIPELINE          │
                  └─────────────────────────────────────────────────┘

Assessment Output ──► Framework Mapper ──► Data Extractor ──► Template Filler
                                                    │
                                                    ▼
                                         AI Narrative Engine (Claude API)
                                                    │
                                                    ▼
                                         Quality Checker ──► Human Review Flag
                                                    │
                                                    ▼
                                         PDF Renderer ──► Report Output
```

### 11.3 Report Types and Backend Logic

#### BRSR Report

```python
class BRSRGenerator:
    """
    Generates SEBI BRSR Core + Comprehensive report.
    Structure follows SEBI circular dated May 10, 2021 (amended 2023).
    """

    SECTION_MAP = {
        "Section_A": "Company Overview",
        "Section_B": "Management_and_Process_Disclosures",
        "Section_C_P1": "Ethics_Transparency",
        "Section_C_P2": "Products_Services_Lifecycle",
        "Section_C_P3": "Employee_Wellbeing",
        "Section_C_P4": "Stakeholder_Engagement",
        "Section_C_P5": "Human_Rights",
        "Section_C_P6": "Environment",  # Primary climate section
        "Section_C_P7": "Policy_Advocacy",
        "Section_C_P8": "Inclusive_Growth",
        "Section_C_P9": "Consumer_Value"
    }

    def generate_p6_environment(self, assessment_data: dict) -> dict:
        """
        Principle 6 — Environment section
        Maps all energy, emissions, water, waste, and climate answers
        to the exact BRSR table format.
        """
        return {
            "essential_indicators": {
                "E1": self.map_energy_consumption(assessment_data),
                "E2": self.map_water_consumption(assessment_data),
                "E3": self.map_emissions(assessment_data),
                "E4": self.map_waste_management(assessment_data),
                "E5": self.map_environmental_compliance(assessment_data)
            },
            "leadership_indicators": {
                "L1": self.map_lifecycle_assessment(assessment_data),
                "L2": self.map_extended_producer_responsibility(assessment_data)
            }
        }
```

#### TCFD Report

```python
class TCFDGenerator:
    """
    Generates TCFD-aligned climate disclosure covering all 4 pillars.
    Follows TCFD Recommendations (2017) and 2021 guidance update.
    """

    def generate_governance_pillar(self, company, assessment) -> str:
        """AI-narrated governance section"""
        prompt = f"""
        You are writing the Governance section of a TCFD-aligned climate report for {company.name}.
        This is a board-level institutional document. Tone: measured, factual, institutional.

        FACTS FROM ASSESSMENT:
        - Board oversight: {assessment.governance.board_climate_oversight}
        - Management role: {assessment.governance.management_climate_role}
        - Committee: {assessment.governance.climate_committee}
        - KPIs linked: {assessment.governance.executive_climate_kpis}

        Write 3-4 paragraphs covering:
        1. Board-level oversight of climate risks and opportunities
        2. Management's role in assessing and managing climate-related risks
        Do NOT fabricate commitments or metrics not present in the facts above.
        Do NOT use vague sustainability language. Be specific and factual.
        """
        return self.claude_api.generate(prompt, max_tokens=800)
```

### 11.4 Anti-Greenwashing Report Rules

All generated reports are passed through a **Language Quality Filter** before output:

```python
PROHIBITED_PHRASES = [
    "world-class sustainability",
    "industry-leading green initiatives",
    "deeply committed to the planet",
    "passionate about sustainability",
    "fighting climate change every day",
    "net-zero hero",
    "carbon-positive by nature",
    "sustainability-first culture"
]

REQUIRED_CAVEATS = {
    "scenario_analysis": "Results are model-based estimates and subject to significant uncertainty.",
    "scope3": "Scope 3 estimates are based on spend-based calculations and carry higher uncertainty.",
    "targets": "Forward-looking targets are aspirational and not guaranteed."
}
```

---

## 12. COMPANY INTELLIGENCE DASHBOARD

### 12.1 Dashboard Architecture

The Company Intelligence Dashboard is designed at Bloomberg Terminal density — not startup SaaS spaciousness. Every pixel carries data.

### 12.2 Dashboard Panels

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  CLIMACTIX GLOBAL — COMPANY INTELLIGENCE              [COMPANY NAME] [SECTOR]    │
│  CIS: BBB+ (64.2)  ▲2.1  |  CONFIDENCE: HIGH (71)  |  PEER: 58th PCT           │
├───────────────────┬──────────────────────┬──────────────────────────────────────┤
│  SCORE MATRIX     │  PEER BENCHMARKS     │  RISK HEATMAP                        │
│  ─────────────── │  ─────────────────── │  ────────────────────────────────── │
│  Governance  71  │  Cohort: Steel-IN-LG │  Physical     ████████░░  HIGH       │
│  Physical    58  │  CIS Median:    59.1 │  Transition   ██████████  CRITICAL   │
│  Transition  55  │  CIS P75:       71.3 │  Governance   ████░░░░░░  MODERATE   │
│  Carbon Mgmt 61  │  Best-in-Class: 88.4 │  Carbon       ███████░░░  HIGH       │
│  Supply Chain 48 │  Your Position: 58th │  Supply Chain ██████░░░░  HIGH       │
│  Compliance  70  │                      │  Disclosure   ████████░░  MODERATE   │
│  Adaptation  52  │                      │                                       │
│  Disclosure  68  │                      │                                       │
│  Greenwash   22  │                      │                                       │
│  Resilience  59  │                      │                                       │
├───────────────────┴──────────────────────┴──────────────────────────────────────┤
│  SCENARIO SIMULATION: Revenue at Risk                                            │
│  ─────────────────────────────────────────────────────────────────────────────  │
│  Scenario           2030      2040      2050        Source                       │
│  Orderly NZ2050     2.1%      4.8%      8.2%        NGFS 2023                   │
│  Disorderly         4.9%      17.1%     40.4%       NGFS 2023                   │
│  Hot House (~4°C)   6.8%      28.4%     62.1%       NGFS 2023                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│  FRAMEWORK READINESS              │  PRIORITY ACTIONS                           │
│  BRSR:     ████████░░  78%  REQ   │  1. Scope 3 data collection [HIGH]          │
│  TCFD:     ██████░░░░  61%  REQ   │  2. SBTi target validation [HIGH]           │
│  IFRS S2:  █████░░░░░  54%  REQ   │  3. Water audit — Site A [CRITICAL]         │
│  GRI:      ███████░░░  72%  OPT   │  4. Board climate charter update [HIGH]     │
│  CDP:      ████░░░░░░  43%  OPT   │  5. Supply chain emissions mapping [MED]    │
├─────────────────────────────────────────────────────────────────────────────────┤
│  EVIDENCE SUMMARY                 │  CONFIDENCE BREAKDOWN                       │
│  Documents: 7 uploaded            │  Data Completeness:   89%                  │
│  EQS: Strong (0.72)               │  Evidence Quality:    0.72                 │
│  Audited: Energy audit (2024)     │  Data Freshness:      FY2024               │
│  Missing: Carbon inventory,       │  Consistency:         2 minor flags        │
│           Supplier audit report   │  Verification:        Annual Report        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 13. AUDITABILITY ARCHITECTURE

### 13.1 Score Audit Trail

Every score generated must produce a full audit record:

```sql
CREATE TABLE score_audit_log (
    audit_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(id),
    assessment_id       UUID NOT NULL REFERENCES assessments(id),
    score_domain        VARCHAR(50) NOT NULL,
    score_value         FLOAT NOT NULL,
    score_version       INTEGER NOT NULL,         -- Engine version used
    computed_at         TIMESTAMP NOT NULL,
    computed_by         VARCHAR(50) NOT NULL,     -- engine / analyst_id
    formula_version     VARCHAR(10) NOT NULL,     -- Scoring formula version used
    inputs              JSONB NOT NULL,           -- All input values used in formula
    weights_used        JSONB NOT NULL,           -- All weights applied
    sector_adjustment   FLOAT,
    geography_adjustment FLOAT,
    evidence_used       JSONB,                    -- Document IDs and their impact
    benchmark_cohort    VARCHAR(100),
    benchmark_stats     JSONB,
    confidence_score    FLOAT NOT NULL,
    assumptions         TEXT[],
    limitations         TEXT[],
    override_by         UUID REFERENCES users(id),  -- If manually overridden
    override_reason     TEXT,
    override_at         TIMESTAMP
);
```

### 13.2 Explainability Output

Every score object carries a full explanation:

```json
{
  "score": {
    "domain": "Carbon Management",
    "value": 61.0,
    "letter_rating": "BBB+",
    "percentile": 50,
    "confidence": {
      "level": "HIGH",
      "value": 71
    }
  },
  "explanation": {
    "formula": "CMS = (emissions_performance×0.35) + (target_credibility×0.25) + (data_quality×0.20) + (reduction_trajectory×0.15) + (scope3_coverage×0.05)",
    "components": {
      "emissions_performance": {
        "raw_value": 1.92,
        "sector_median": 1.85,
        "unit": "tCO2/t steel",
        "calculated_score": 58.3,
        "weight": 0.35,
        "contribution": 20.4
      },
      "target_credibility": {
        "status": "SBTi committed (not yet approved)",
        "calculated_score": 65,
        "weight": 0.25,
        "contribution": 16.25
      },
      "data_quality": {
        "evidence_type": "Annual Report + Energy Audit",
        "assurance_level": "Third-party reviewed (not ISAE 3000)",
        "calculated_score": 70,
        "weight": 0.20,
        "contribution": 14.0
      },
      "reduction_trajectory": {
        "3yr_avg_decline": "2.8%/year",
        "trend": "Paris-aligned range",
        "calculated_score": 80,
        "weight": 0.15,
        "contribution": 12.0
      },
      "scope3_coverage": {
        "status": "Partial categories (Cat 1, 11 only)",
        "calculated_score": 30,
        "weight": 0.05,
        "contribution": 1.5
      }
    },
    "sector_adjustment": 0.95,
    "final_score": 61.0,
    "assumptions": [
      "Emissions data from Annual Report FY2024 accepted at face value",
      "Energy audit covers 80% of total energy consumption"
    ],
    "limitations": [
      "Scope 3 coverage is partial — full supply chain emissions unknown",
      "SBTi approval status may change; score will be updated upon approval"
    ],
    "questions_used": ["Q-STEEL-GHG-001", "Q-STEEL-GHG-003", "Q-STEEL-GHG-007", "..."],
    "evidence_used": ["doc_annual_report_2024.pdf", "doc_energy_audit_2024.pdf"]
  }
}
```

---

## 14. COMPLETE DATABASE SCHEMA

### 14.1 Core Tables

```sql
-- ═══════════════════════════════════════════════════════════════════════
-- COMPANY LAYER
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE companies (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name            VARCHAR(255) NOT NULL,
    legal_entity_type       VARCHAR(50),
    cin_number              VARCHAR(50) UNIQUE,
    ticker_symbol           VARCHAR(20),
    industry_code           VARCHAR(20) NOT NULL,
    sub_industry_code       VARCHAR(20),
    geography_primary       VARCHAR(10) NOT NULL,
    geographies_operated    JSONB,
    revenue_usd_band        VARCHAR(20),
    employee_count_band     VARCHAR(20),
    fiscal_year_end         DATE,
    founded_year            INTEGER,
    ownership_structure     VARCHAR(50),
    listed_exchanges        JSONB,
    credit_rating           VARCHAR(10),
    website                 VARCHAR(500),
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW(),
    created_by              UUID REFERENCES users(id),
    status                  VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE company_operational_profile (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id),
    asset_locations         JSONB,              -- Array of {lat, lon, asset_type, value}
    manufacturing_sites     JSONB,
    office_locations        JSONB,
    data_center_locations   JSONB,
    port_terminals          JSONB,
    agricultural_land       JSONB,
    tier1_supplier_count    INTEGER,
    tier1_supplier_geos     JSONB,
    key_raw_materials       JSONB,
    supplier_concentration  FLOAT,
    export_market_share     FLOAT,
    key_export_markets      JSONB,
    total_fixed_assets_usd  BIGINT,
    coastal_asset_exposure  FLOAT,
    flood_zone_assets       FLOAT,
    water_stressed_assets   FLOAT,
    profile_version         INTEGER DEFAULT 1,
    as_of_date              DATE,
    created_at              TIMESTAMP DEFAULT NOW()
);

CREATE TABLE company_risk_profiles (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                  UUID NOT NULL REFERENCES companies(id),
    physical_risk_priority      JSONB,
    transition_risk_priority    JSONB,
    material_sectors            JSONB,
    regulatory_jurisdictions    JSONB,
    supply_chain_risk_tier      VARCHAR(20),
    asset_vulnerability_class   VARCHAR(20),
    carbon_exposure_class       VARCHAR(30),
    disclosure_frameworks_req   JSONB,
    peer_benchmark_group_id     VARCHAR(100),
    assessment_complexity       VARCHAR(20),
    question_set_ids            JSONB,
    generated_at                TIMESTAMP DEFAULT NOW(),
    engine_version              VARCHAR(10)
);

-- ═══════════════════════════════════════════════════════════════════════
-- ASSESSMENT LAYER
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE assessments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id),
    assessment_type         VARCHAR(50) NOT NULL,  -- initial / annual / triggered / investor-requested
    status                  VARCHAR(30) NOT NULL DEFAULT 'draft',
    fiscal_year             INTEGER NOT NULL,
    question_set_id         UUID,
    total_questions         INTEGER,
    answered_questions      INTEGER DEFAULT 0,
    completion_percent      FLOAT DEFAULT 0,
    submitted_at            TIMESTAMP,
    reviewed_by             UUID REFERENCES users(id),
    reviewed_at             TIMESTAMP,
    review_notes            TEXT,
    version                 INTEGER DEFAULT 1,
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE TABLE assessment_responses (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id           UUID NOT NULL REFERENCES assessments(id),
    question_id             VARCHAR(20) NOT NULL REFERENCES questions(question_id),
    response_type           VARCHAR(20),           -- quantitative / categorical / boolean / text
    response_value_numeric  FLOAT,
    response_value_text     TEXT,
    response_value_categorical VARCHAR(100),
    response_value_boolean  BOOLEAN,
    data_year               INTEGER,
    unit                    VARCHAR(30),
    normalization_denominator FLOAT,
    normalization_base      VARCHAR(50),
    evidence_ids            JSONB,                 -- Array of evidence document IDs
    confidence_contribution FLOAT,
    notes                   TEXT,
    submitted_at            TIMESTAMP,
    last_modified_at        TIMESTAMP DEFAULT NOW(),
    modified_by             UUID REFERENCES users(id)
);

-- ═══════════════════════════════════════════════════════════════════════
-- EVIDENCE LAYER
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE evidence_documents (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id),
    assessment_id           UUID REFERENCES assessments(id),
    document_type           VARCHAR(50) NOT NULL,
    original_filename       VARCHAR(500),
    s3_key                  VARCHAR(1000) NOT NULL,
    file_size_bytes         BIGINT,
    mime_type               VARCHAR(100),
    document_year           INTEGER,
    fiscal_year_covered     INTEGER,
    third_party_verified    BOOLEAN DEFAULT FALSE,
    verification_body       VARCHAR(200),
    verification_standard   VARCHAR(100),
    ai_extraction_status    VARCHAR(30) DEFAULT 'pending',
    extracted_claims        JSONB,
    extraction_confidence   FLOAT,
    evidence_quality_score  FLOAT,
    freshness_factor        FLOAT,
    contradiction_flags     JSONB,
    uploaded_by             UUID REFERENCES users(id),
    uploaded_at             TIMESTAMP DEFAULT NOW(),
    processed_at            TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════════════════
-- SCORING LAYER
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE company_scores (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id),
    assessment_id           UUID NOT NULL REFERENCES assessments(id),
    score_period            VARCHAR(10) NOT NULL,  -- 2024Q4
    cis_overall             FLOAT,
    cis_letter_rating       VARCHAR(5),
    governance_score        FLOAT,
    physical_risk_score     FLOAT,
    transition_risk_score   FLOAT,
    carbon_mgmt_score       FLOAT,
    supply_chain_score      FLOAT,
    compliance_score        FLOAT,
    adaptation_score        FLOAT,
    disclosure_quality_score FLOAT,
    greenwashing_risk_score FLOAT,
    resilience_score        FLOAT,
    confidence_score        FLOAT,
    confidence_band         VARCHAR(20),
    sector_adjustment_factor FLOAT,
    geo_adjustment_factor   FLOAT,
    score_version           INTEGER DEFAULT 1,
    engine_version          VARCHAR(10),
    computed_at             TIMESTAMP DEFAULT NOW(),
    score_inputs            JSONB,
    UNIQUE (company_id, assessment_id, score_period)
);

CREATE TABLE score_component_detail (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    score_id                UUID NOT NULL REFERENCES company_scores(id),
    domain                  VARCHAR(50) NOT NULL,
    sub_domain              VARCHAR(50),
    question_id             VARCHAR(20),
    raw_answer              JSONB,
    sub_score               FLOAT,
    weight_applied          FLOAT,
    weighted_contribution   FLOAT,
    evidence_multiplier     FLOAT DEFAULT 1.0,
    benchmark_reference     FLOAT,
    explanation_text        TEXT,
    computed_at             TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- BENCHMARK LAYER
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE benchmark_cohorts (
    cohort_id               VARCHAR(100) PRIMARY KEY,
    industry_code           VARCHAR(20),
    sub_industry_code       VARCHAR(20),
    size_band               VARCHAR(20),
    geography               VARCHAR(10),
    climate_exposure_class  VARCHAR(30),
    cohort_name             TEXT NOT NULL,
    population              INTEGER DEFAULT 0,
    last_updated            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE company_benchmark_positions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id),
    score_id                UUID NOT NULL REFERENCES company_scores(id),
    cohort_id               VARCHAR(100) REFERENCES benchmark_cohorts(cohort_id),
    score_domain            VARCHAR(50) NOT NULL,
    company_score           FLOAT,
    cohort_mean             FLOAT,
    cohort_median           FLOAT,
    cohort_p25              FLOAT,
    cohort_p75              FLOAT,
    cohort_p90              FLOAT,
    percentile_rank         FLOAT,
    quartile                INTEGER,
    maturity_level          VARCHAR(30),
    computed_at             TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- SIMULATION LAYER
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE simulation_results (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id),
    assessment_id           UUID NOT NULL REFERENCES assessments(id),
    scenario_code           VARCHAR(30) NOT NULL,
    projection_year         INTEGER NOT NULL,
    physical_risk_total_usd BIGINT,
    flood_risk_usd          BIGINT,
    heat_productivity_loss_usd BIGINT,
    water_stress_cost_usd   BIGINT,
    cyclone_risk_usd        BIGINT,
    sea_level_risk_usd      BIGINT,
    drought_risk_usd        BIGINT,
    transition_risk_total_usd BIGINT,
    carbon_pricing_cost_usd BIGINT,
    energy_cost_increase_usd BIGINT,
    stranded_asset_risk_usd BIGINT,
    revenue_at_risk_usd     BIGINT,
    revenue_at_risk_pct     FLOAT,
    ebitda_impact_pct       FLOAT,
    supply_chain_impact_usd BIGINT,
    methodology_version     VARCHAR(10),
    data_sources            JSONB,
    assumptions             JSONB,
    uncertainty_band        FLOAT,
    computed_at             TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- DISCLOSURE LAYER
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE generated_reports (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id),
    assessment_id           UUID NOT NULL REFERENCES assessments(id),
    report_type             VARCHAR(50) NOT NULL,  -- BRSR / TCFD / GRI / IFRS_S2 / etc.
    report_year             INTEGER NOT NULL,
    framework_version       VARCHAR(10),
    generation_status       VARCHAR(30) DEFAULT 'generating',
    s3_key_pdf              VARCHAR(1000),
    s3_key_docx             VARCHAR(1000),
    s3_key_json             VARCHAR(1000),
    completeness_score      FLOAT,
    quality_check_passed    BOOLEAN,
    quality_issues          JSONB,
    generated_at            TIMESTAMP,
    generated_by            VARCHAR(50),           -- system / analyst_id
    reviewed_by             UUID REFERENCES users(id),
    review_status           VARCHAR(30),
    created_at              TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════
-- FRAMEWORK LAYER
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE company_framework_readiness (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id),
    assessment_id           UUID NOT NULL REFERENCES assessments(id),
    framework_code          VARCHAR(20) NOT NULL,
    framework_version       VARCHAR(10),
    readiness_score         FLOAT,                 -- 0–100
    mandatory_covered       INTEGER,
    mandatory_total         INTEGER,
    optional_covered        INTEGER,
    optional_total          INTEGER,
    missing_disclosures     JSONB,
    computed_at             TIMESTAMP DEFAULT NOW(),
    UNIQUE (company_id, assessment_id, framework_code)
);

-- ═══════════════════════════════════════════════════════════════════════
-- AUDIT & VERSION CONTROL
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE audit_log (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type             VARCHAR(50) NOT NULL,  -- company / assessment / score / report / etc.
    entity_id               UUID NOT NULL,
    action                  VARCHAR(50) NOT NULL,  -- CREATE / UPDATE / DELETE / OVERRIDE / VIEW
    actor_id                UUID REFERENCES users(id),
    actor_type              VARCHAR(30),           -- user / system / api_key
    before_state            JSONB,
    after_state             JSONB,
    change_reason           TEXT,
    ip_address              INET,
    user_agent              TEXT,
    created_at              TIMESTAMP DEFAULT NOW()
);

CREATE TABLE score_version_history (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id),
    score_domain            VARCHAR(50) NOT NULL,
    score_period            VARCHAR(10) NOT NULL,
    version                 INTEGER NOT NULL,
    score_value             FLOAT NOT NULL,
    change_reason           VARCHAR(100),          -- REASSESSMENT / ENGINE_UPDATE / DATA_CORRECTION
    previous_version        INTEGER,
    previous_score          FLOAT,
    delta                   FLOAT,
    created_at              TIMESTAMP DEFAULT NOW()
);
```

---

## 15. API ARCHITECTURE

### 15.1 API Design Principles

- All endpoints versioned at `/api/v1/`
- JWT Bearer token authentication
- RBAC with 4 roles: Enterprise, Investor, Analyst, Admin
- Pydantic schema validation on all inputs
- Structured error responses with error codes
- Rate limiting: 1000 req/hr (Enterprise), 5000 req/hr (Investor), unlimited (Internal)
- OpenAPI 3.0 documentation at `/api/v1/docs`

### 15.2 Core API Endpoints

```
ASSESSMENT ENGINE
─────────────────────────────────────────────────────────────────────────
POST   /api/v1/companies                    Create company profile
GET    /api/v1/companies/{id}               Get company profile
PUT    /api/v1/companies/{id}/profile       Update operational profile
POST   /api/v1/companies/{id}/risk-profile  Generate dynamic risk profile

POST   /api/v1/assessments                  Create new assessment
GET    /api/v1/assessments/{id}             Get assessment with responses
GET    /api/v1/assessments/{id}/questions   Get applicable question set
POST   /api/v1/assessments/{id}/responses   Submit batch responses
PATCH  /api/v1/assessments/{id}/responses/{question_id}  Update single response
POST   /api/v1/assessments/{id}/submit      Submit for scoring

EVIDENCE ENGINE
─────────────────────────────────────────────────────────────────────────
POST   /api/v1/evidence/upload              Upload document (multipart)
GET    /api/v1/evidence/{id}/status         Check extraction status
GET    /api/v1/evidence/{id}/claims         Get extracted claims
GET    /api/v1/evidence/{id}/contradictions Get contradiction flags

SCORING ENGINE
─────────────────────────────────────────────────────────────────────────
POST   /api/v1/scores/compute               Trigger score computation
GET    /api/v1/scores/{company_id}          Get current scores
GET    /api/v1/scores/{company_id}/history  Get score history
GET    /api/v1/scores/{score_id}/audit      Get full audit trail + explanation
GET    /api/v1/scores/{score_id}/export     Export score report PDF

BENCHMARKING ENGINE
─────────────────────────────────────────────────────────────────────────
GET    /api/v1/benchmarks/{company_id}      Get benchmark position
GET    /api/v1/benchmarks/cohorts           List available cohorts
GET    /api/v1/benchmarks/cohort/{id}/stats Get cohort statistics

SIMULATION ENGINE
─────────────────────────────────────────────────────────────────────────
POST   /api/v1/simulations/run              Run scenario simulation
GET    /api/v1/simulations/{company_id}     Get simulation results
GET    /api/v1/simulations/scenarios        List available scenarios

DISCLOSURE ENGINE
─────────────────────────────────────────────────────────────────────────
POST   /api/v1/reports/generate             Generate disclosure report
GET    /api/v1/reports/{id}/status          Check generation status
GET    /api/v1/reports/{id}/download        Download generated report
GET    /api/v1/reports/{company_id}         List company reports

FRAMEWORK ENGINE
─────────────────────────────────────────────────────────────────────────
GET    /api/v1/frameworks                   List supported frameworks
GET    /api/v1/frameworks/{code}/readiness/{company_id}  Get readiness score
GET    /api/v1/frameworks/crosswalk/{question_id}        Get framework mappings
```

### 15.3 Response Schema Standard

```python
class APIResponse(BaseModel):
    success: bool
    data: Optional[Any]
    error: Optional[ErrorDetail]
    meta: ResponseMeta

class ResponseMeta(BaseModel):
    request_id: str = Field(default_factory=lambda: str(uuid4()))
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    version: str = "1.0"
    confidence: Optional[ConfidenceMeta]      # Present on scored responses
    audit_id: Optional[str]                   # Present on scored responses

class ErrorDetail(BaseModel):
    code: str                # E.g., "INSUFFICIENT_DATA", "VALIDATION_ERROR"
    message: str
    field: Optional[str]
    documentation_url: str  # Links to API docs for this error
```

---

## 16. IMPLEMENTATION ROADMAP

### Phase 1 — Foundation (Months 1–3)

**Objective:** Core assessment engine operational for 5 pilot sectors.

```
DELIVERABLES:
  ✓ Company profiling engine + dynamic risk profile generator
  ✓ Question bank: 5 priority sectors (Steel, Banking, Real Estate, IT, FMCG)
  ✓ Framework mapping engine (BRSR, TCFD, GRI as primary)
  ✓ Basic scoring engine (CIS + 5 domain scores)
  ✓ Evidence upload + AI extraction (annual reports, ESG reports)
  ✓ PostgreSQL schema — all core tables deployed
  ✓ FastAPI endpoints for assessment + scoring
  ✓ Enterprise portal — assessment UI
  ✓ Basic company dashboard

QUALITY GATE: First 10 pilot companies assessed. Scores reviewed by internal analysts.
```

### Phase 2 — Intelligence Layer (Months 4–6)

**Objective:** Full scoring engine, confidence engine, benchmarking.

```
DELIVERABLES:
  ✓ Full 11-domain scoring engine with sector adjustments
  ✓ Confidence engine integrated
  ✓ Benchmarking engine — 5 sector cohorts live
  ✓ Evidence contradiction detection
  ✓ Greenwashing risk scoring
  ✓ BRSR report generator (automated)
  ✓ TCFD report generator (automated)
  ✓ Audit trail complete
  ✓ Score explainability API
  ✓ Investor terminal — read access to company scores

QUALITY GATE: Scores reviewed against Moody's ESG / MSCI for 5 listed companies.
```

### Phase 3 — Simulation + Disclosure (Months 7–9)

**Objective:** Risk simulation engine + full disclosure suite.

```
DELIVERABLES:
  ✓ Climate risk simulation engine (3 scenarios, 2030/2040/2050)
  ✓ Revenue at risk + EBITDA impact computation
  ✓ IFRS S2 report generator
  ✓ GRI report generator
  ✓ CDP response generator
  ✓ Full framework crosswalk database (10 frameworks)
  ✓ Question bank expanded to 15 sectors
  ✓ Benchmark cohort expansion — 15 sectors

QUALITY GATE: Full TCFD + BRSR report validated by ESG consulting expert.
```

### Phase 4 — Scale + Institutional Grade (Months 10–12)

**Objective:** All 26 sectors, production infrastructure, institutional-grade reliability.

```
DELIVERABLES:
  ✓ Full 26-sector question bank (4,000+ questions)
  ✓ All 10 frameworks fully mapped
  ✓ Physical risk database integrated (WRI Aqueduct, JRC Flood, IPCC AR6)
  ✓ Real-time carbon price feeds integrated
  ✓ Automated re-scoring on new evidence upload
  ✓ Multi-language report output (English + Hindi + Regional)
  ✓ SOC 2 Type II compliance
  ✓ API rate limiting + SLA guarantees
  ✓ Investor terminal full access with portfolio aggregation
  ✓ Regulator access module

QUALITY GATE: External audit of methodology by Big 4 ESG advisory. SEBI BRSR compliance sign-off.
```

### Phase 5 — Market Position (Year 2+)

```
STRATEGIC MILESTONES:
  ◎ 500+ companies assessed (critical mass for benchmarking credibility)
  ◎ Integration with NSE/BSE company filings API (auto-import annual reports)
  ◎ RBI Climate Risk Circular compliance module for banks
  ◎ SEBI BRSR core auto-population for listed companies
  ◎ Moody's/S&P-grade methodology white paper published
  ◎ India Climate Risk Index — annual publication
  ◎ Global expansion: Southeast Asia (Phase 5A), EU (Phase 5B), MENA (Phase 5C)
  ◎ Bloomberg data terminal integration for investor terminal data feeds
```

---

## APPENDIX A — SCORING FORMULA SUMMARY TABLE

```
DOMAIN                   FORMULA TYPE        PRIMARY INPUTS                    EVIDENCE IMPACT
─────────────────────────────────────────────────────────────────────────────────────────────────
Governance               Weighted sum        Board charter, committee, KPIs    High (×1.15–1.25)
Physical Risk            Hazard-weighted     % assets in hazard zones          Moderate (×1.10)
Transition Risk          Factor-weighted     Emissions, policy, tech exposure  Moderate (×1.10)
Carbon Management        Multi-factor        Intensity, targets, trajectory    Very High (×1.30)
Supply Chain             Composite           Supplier geo, Scope 3 data        Moderate (×1.10)
Compliance               Framework coverage  Framework readiness %             High (×1.20)
Adaptation               CAPEX ratio         Adaptation investment %           High (×1.20)
Disclosure Quality       Completeness        Coverage × accuracy × frequency  High (×1.20)
Greenwashing Risk        Gap analysis        Claim/evidence ratio              Very High (×1.40 penalty)
Resilience               Strategic           BCDR, scenario use, investment    Moderate (×1.10)
```

---

## APPENDIX B — FRAMEWORK CROSSWALK QUICK REFERENCE

```
TOPIC                   BRSR          GRI       IFRS S2   TCFD        CDP
─────────────────────────────────────────────────────────────────────────────
Scope 1 emissions       B-P6-EI-1     305-1     29(a)     Metrics.a   C6.1
Scope 2 emissions       B-P6-EI-1     305-2     29(a)     Metrics.a   C6.3
Scope 3 emissions       B-P6-LI-1     305-3     29(a)     Metrics.a   C6.5
Energy consumption      B-P6-EI-2     302-1     29        —           C8.2
Water consumption       B-P6-EI-3     303-5     —         —           W1.2
Climate governance      B-A2          2-12      6         Gov.a       C1.1
Climate strategy        B-P6          201-2     9         Strategy.a  C2.2
Climate risk mgmt       B-P6          3-1       14        RiskMgmt.a  C2.1
Scenario analysis       —             —         22        Strategy.c  C3.1
Physical risk           B-P6          201-2     15        Risk.a      C2.3
Transition risk         B-P6          201-2     16        Risk.b      C2.3
Net-zero target         B-P6-LI-3     305-5     22(c)     Metrics.d   C4.1
```

---

*Architecture Version 1.0 | Climactix Global | Confidential*  
*Authored by: Climate Intelligence Architecture Team*  
*Review Status: Internal — Not for external distribution*  
*Next Review: Q3 2026*
