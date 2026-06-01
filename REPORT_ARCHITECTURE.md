# CLIMACTIX GLOBAL — REPORT GENERATION ARCHITECTURE
## How Assessment Results Map to the Institutional Intelligence Report
### Reference Format: Diageo Climate Transition Plan 2026

---

## DESIGN PHILOSOPHY

The Climactix report format mirrors institutional-grade climate transition plans
(Diageo, BP, Unilever, HSBC) — not ESG questionnaire outputs. The report is
structured around five narrative pillars that correspond directly to scored domains
from the assessment engine.

---

## ASSESSMENT → REPORT MAPPING

```
ASSESSMENT DOMAIN              REPORT SECTION
──────────────────────────────────────────────────────────────────────
Company Profile                 Cover + Company Overview
Carbon Management Score         01. AMBITION & TARGETS
Physical Risk Score             02. CLIMATE RISK EXPOSURE
Transition Risk Score           03. TRANSITION READINESS
Supply Chain Score              04. VALUE CHAIN INTELLIGENCE
Governance Score                05. GOVERNANCE & ACCOUNTABILITY
Disclosure Quality Score        06. DISCLOSURE READINESS
Greenwashing Risk Score         Cross-cutting → Credibility Panel
Confidence Score                Footer of every scored section
Climate Resilience Score        Strategy Resilience callout
Simulation Results              Financial Risk appendix
Benchmark Position              Peer context panel in each section
Framework Readiness             Appendix → Framework Coverage Matrix
Evidence Quality                Evidence Quality panel per section
```

---

## REPORT STRUCTURE (7 Sections + Appendices)

### COVER
- Company name, sector, geography, fiscal year
- Overall CIS rating badge (letter + numeric)
- Four key metrics: Peer Rank, Confidence, Outlook, Assessment Year
- Report metadata strip

### SECTION 01 — AMBITION & TARGETS
**Source domains:** Carbon Management, Climate Resilience
**Content:**
- Emission baseline (Scope 1, 2, 3)
- Current trajectory (3-year trend)
- Target status (SBTi, internal, none)
- Target credibility gap assessment
- Near-term and long-term mitigation pathway chart
- Action: What must change

### SECTION 02 — CLIMATE RISK EXPOSURE
**Source domains:** Physical Risk, Adaptation
**Content:**
- Hazard exposure map by site
- Physical risk priority matrix
- Water stress assessment
- Heat stress labor impact
- Coastal/cyclone exposure
- Adaptation CAPEX ratio vs sector
- Resilience measures in place

### SECTION 03 — TRANSITION READINESS
**Source domains:** Transition Risk, Carbon Management
**Content:**
- Carbon pricing cost projections (3 scenarios × 3 horizons)
- Energy intensity vs sector median
- Technology lock-in analysis
- Regulatory compliance status
- Market demand readiness (green premium)
- Decarbonisation lever analysis

### SECTION 04 — VALUE CHAIN INTELLIGENCE
**Source domain:** Supply Chain
**Content:**
- Scope 3 emissions profile
- Supplier engagement coverage
- Critical material concentration
- Supply chain decarbonisation levers
- Recommended engagement actions

### SECTION 05 — GOVERNANCE & ACCOUNTABILITY
**Source domain:** Governance
**Content:**
- Board oversight structure
- Executive climate KPI linkage
- Third-party assurance status
- Stakeholder engagement maturity
- Climate risk integration

### SECTION 06 — DISCLOSURE READINESS
**Source domains:** Disclosure Quality, Compliance, Framework Readiness
**Content:**
- Framework coverage matrix (BRSR/TCFD/IFRS S2/GRI/CDP)
- Mandatory vs filed disclosure gaps
- Evidence quality summary
- Greenwashing risk flags

### APPENDIX A — PRIORITY ACTION PLAN
Tier 1 / Tier 2 / Tier 3 actions (from Priority Action Plan engine)

### APPENDIX B — FINANCIAL RISK SIMULATION
Scenario matrix (Physical + Transition × 3 scenarios × 2030/2040/2050)

### APPENDIX C — FULL SCORECARD
All 11 domain scores with sub-component breakdowns

### APPENDIX D — FRAMEWORK CROSSWALK
Question-level framework mapping detail

---

## VISUAL DESIGN SPECIFICATION

### Color Palette (Diageo-inspired institutional)
```
Background:        #FFFFFF  (pure white)
Page alt:          #F8F6F2  (warm cream for alternating sections)
Text primary:      #1C1C1C  (near-black)
Text secondary:    #4A4A4A  (dark grey)
Text light:        #7A7A7A  (medium grey)
Text muted:        #AAAAAA  (light grey)

Section 01 Ambition:    #2A5C45  (deep forest green)
Section 02 Physical:    #6B4E8A  (deep purple)
Section 03 Transition:  #8B4513  (burnt sienna / dark amber)
Section 04 Supply Chain: #2E5F8A  (deep blue)
Section 05 Governance:  #C8736A  (warm rose)
Section 06 Disclosure:  #5A7A3A  (olive green)

Accent warm:   #D4A853   (institutional gold)
Accent cool:   #4A7BAF   (institutional blue)
Border light:  #E8E4DC   (warm grey border)
Border strong: #C8C0B0   (medium warm grey)

Risk Critical: #C0392B  (deep red)
Risk High:     #E67E22  (burnt orange)
Risk Medium:   #F1C40F  (amber)
Risk Low:      #27AE60  (green)
```

### Typography
```
Display Title:     Georgia Bold Italic, 28-36pt
Section Number:    Arial Bold, 10pt, letterSpacing 3, uppercase
Section Title:     Georgia Bold, 22-26pt
Body:              Arial, 9-10pt, leading 16
Pull Quote:        Georgia Italic, 13pt
Table Header:      Arial Bold, 7.5pt, uppercase, letterSpacing 1
Data Value:        Arial Bold or Courier New Bold, 10-14pt
Caption:           Arial, 7.5pt, italic
```

### Layout Principles
```
Section Dividers:  Full-page colored rectangle + large white Georgia title
                   Color bar top = section accent color (8pt height)
Text Pages:        Two-column layout where content allows
                   Left column: 62% width (main text)
                   Right column: 38% width (data, callouts, charts)
Callout Boxes:     Soft cream background (#F5F2EC) with left accent border
                   Border color = section accent color
Data Tables:       No heavy gridlines — only horizontal rules
                   Header row: light grey background
                   Alternating rows: white / very light cream
Charts:            Simple bar charts with section accent color fill
                   Clean axes, no chartjunk
Case Studies:      Full-width boxes with cream background, accent left border
Score Bars:        Thin (6px), section accent color fill on light grey track
```

### Section Divider Page Design (matches Diageo photo pages)
```
Full page:      Section accent color background (solid, no gradient)
Top strip:      White bar 12mm — "CLIMACTIX GLOBAL INTELLIGENCE REPORT"
Section number: Large, white, Georgia Bold, 48pt, bottom-left
Section title:  White, Georgia Bold, 36pt, below number
Visual element: Abstract geometric shape (white, low opacity) — top right
```

---

## DATA FLOW: ASSESSMENT → REPORT

```
AssessmentResult object
    │
    ├── company_profile        → Cover, Section headers
    ├── scores{}               → Score panels in each section
    │     ├── carbon_management → Section 01
    │     ├── physical_risk     → Section 02
    │     ├── transition_risk   → Section 03
    │     ├── supply_chain      → Section 04
    │     ├── governance        → Section 05
    │     ├── disclosure_quality → Section 06
    │     ├── greenwashing_risk  → Cross-section callouts
    │     └── confidence_score  → Footer badges
    ├── simulation_results{}   → Appendix B + Section 03 callouts
    ├── benchmark_position{}   → Peer panels in each section
    ├── framework_readiness{}  → Section 06 + Appendix D
    ├── evidence_quality{}     → Evidence panels per section
    ├── priority_actions[]     → Appendix A
    └── contradictions[]       → Greenwashing flags
```

---

## REPORT GENERATION PIPELINE

```
1. AssessmentResult.validate()
      → Check confidence >= MEDIUM before generating
      → Flag any CRITICAL contradictions for disclosure

2. ReportBuilder.build(assessment)
      → CoverPage(company, scores)
      → For each section:
            SectionDivider(number, title, accent_color)
            SectionContent(domain_scores, narrative, data_tables, charts)
      → AppendixBuilder(actions, simulation, full_scorecard)

3. NarrativeEngine.generate(section, scores, benchmark)
      → Claude API call per section
      → Institutional tone: measured, factual, no ESG buzzwords
      → Anti-greenwashing filter applied before final output

4. QualityChecker.validate(report)
      → Prohibited phrases filter
      → Required caveats check
      → Data consistency check (report numbers match assessment)

5. PDFRenderer.render(report)
      → ReportLab-based rendering
      → Font: Georgia (display) + Arial (body) + Courier New (data)
      → Page size: A4
      → Output: company_cis_report_FY2024.pdf
```
