# Climactix Global Design System v3.2

## Vision

Climactix Global is building the world's first Climate Risk Intelligence Operating System designed for governments, investors, financial institutions, insurers, regulators, and enterprises.

This is not an ESG platform.

This is not a sustainability consultancy.

This is a decision intelligence platform that converts climate data into financial, operational, supply-chain, and regulatory insights.

---

# Brand Positioning

## Category

Climate Risk Intelligence Platform

## Positioning Statement

Climate Risk Intelligence for Capital Allocation

## Mission

Enable organizations to understand, quantify, and act on climate-related risks through real-time intelligence and scenario-driven decision support.

## User Perception

When users visit the website, they should feel:

* Institutional
* Premium
* Scientific
* Financial-grade
* Trustworthy
* Government-ready
* Investor-ready

The experience should feel closer to Bloomberg, BlackRock Aladdin, Palantir Foundry, and NASA Earth Observatory than a sustainability consultancy.

---

# Visual Identity

## Design Personality

* Clean
* Minimal
* Data-first
* Enterprise-grade
* High-trust
* Premium

Avoid startup aesthetics.

Avoid excessive animations.

Avoid generic ESG visuals.

Avoid sustainability clichés.

---

# Color System

## Primary Colors

```css
--black: #000000;
--charcoal: #111111;
--graphite: #1A1A1A;
--white: #FFFFFF;
--off-white: #F7F7F7;
```

## Accent Colors

```css
--royal-blue: #0057FF;
--data-cyan: #00C2FF;
```

## Usage Rules

Royal Blue:

* CTA buttons
* Active navigation
* Key metrics
* Important interactions

Data Cyan:

* Live indicators
* Intelligence layers
* GIS overlays
* Climate data visualizations

Accent colors must never exceed 10% of the screen.

---

# Typography

Single institutional typeface system inspired by MSCI — authoritative, timeless, highly readable. Source Sans Pro, Helvetica, and Merriweather (the v3.1 typefaces) are retired. Never mix multiple font families on one page.

## Font — Roboto (the only typeface)

```css
--font: 'Roboto', Arial, sans-serif;
```

Used for every component: navigation, hero, headings, body, cards, reports, tables, charts, forms, buttons, sidebars, popups, modals, tooltips, footer, login/registration, assessment portal, company profiles, climate risk maps, investor reports, government portal.

Weights: **300, 400, 500, 700 only.** Never 100, 200, 600, 800, 900. Avoid unnecessary weights — most UI should sit at 400 (body) or 500 (labels/nav/buttons), with 700 reserved for headings and KPI numbers and 300 for light/large display accents.

In the Next.js app, load via Next.js Font Optimization (`next/font/google`), not a runtime `@import`. On the vanilla HTML site, load via a single Google Fonts `@import`/`<link>` per page.

Color: typography tokens here are font/size/weight/spacing only. Text *color* stays on the existing dark-mode system (`--text`, `--text-2`, `--text-muted` etc. — white/light-grey on black, per the Color System above). Do not introduce light-theme text colors.

## Type Scale

| Role | Size | Weight | Line-height |
|---|---|---|---|
| Display Hero | 56px | 700 | 1.1 |
| Page Title | 40px | 700 | 1.1 |
| Section Title | 32px | 700 | 1.1 |
| Subsection | 24px | 700 | 1.1 |
| Card Title | 20px | 700 | 1.1 |
| Large Body | 18px | 400 | 1.6 |
| Standard Body | 16px | 400 | 1.6 |
| Small Text | 14px | 400 | 1.6 |
| Caption | 12px | 400 | 1.5 |
| Label | 13px | 500 | 1.5 |
| Navigation | 15px | 500 | 1.5 |
| Button | 15px | 600→500* | — |

\* The spec calls for button weight 600, but 600 is outside the allowed Roboto weight set (300/400/500/700) — rounded to 500 to keep strictly within the allowed weights. Same resolution applies anywhere "600" appears below: treated as 500.

**Metric numbers** (dashboard KPIs, scores): 56px / 48px / 36px, always weight 700, letter-spacing `-0.03em`.

Responsive: scale Display Hero proportionally down at tablet/mobile; never shrink body/caption below their listed size.

## Line Height

* Headings: 110% (1.1)
* Paragraphs: 160% (1.6)
* Tables: 150% (1.5)
* Lists: 160% (1.6)

## Letter Spacing

* Headings: `-0.02em`
* Body: `0`
* Buttons: `0.02em`
* Tables: `0.03em`
* Navigation: `0.04em`

## Text Rules

* Never use ALL CAPS for headings. Sentence case throughout the interface.
* Uppercase is permitted only for: small section eyebrow labels, status badges, navigation categories.
* Avoid excessive bold text — bold is for headings, KPI numbers, and table headers only.

## Component Specifics

* **Tables**: row height 48px. Headers 15px/500. Content 15px/400. Numbers right-aligned, text left-aligned. Line-height 150%.
* **Cards**: Title 20px/700. Description 16px/400. Metadata 13px/400. KPIs 48–56px/700.
* **Dashboard metrics**: Large 56px, Medium 40px, Small 28px — always weight 700.
* **Forms**: Labels 13px/500. Input 16px/400. Helper text 13px/400. Error text 13px/400.
* **Buttons**: 15px/500 (rounded from spec's 600), sentence case, letter-spacing `0.02em`.
* **Navigation**: 15px/500, letter-spacing `0.04em`.
* **Reports**: Executive heading 40px. Section heading 24px. Body 16px. Tables 15px. Footnotes 12px.
* **Footer**: Body 15px/400. Links 15px/500.

## Layout Rules

* Maintain generous white space; increase readability through spacing, not larger font sizes.
* Paragraph measure: 720–780px max width. Never full-width text blocks.
* Alignment: left-aligned everywhere except the hero, which may center.

## Anti-Patterns (typography)

No decorative or futuristic fonts, no gradient text, no glow effects, no shadowed text, no oversized marketing headlines, no floating text effects, no mixing of multiple font families. Typography must read as timeless, authoritative, and institutional — comparable to MSCI, Bloomberg, BlackRock, and Moody's.

---

# Website Structure

Maximum 5 Scroll Sections

---

# Section 1 — Hero

## Background

3D Earth Globe

Live rotating globe with climate intelligence overlays.

Layers:

* Flood Risk
* Drought Risk
* Heat Stress
* Cyclone Exposure
* Carbon Exposure
* Supply Chain Risk

## Headline

Climate Risk Intelligence
for Capital Allocation

## Subheadline

Transform climate, supply chain, and regulatory data into decision-grade intelligence.

## CTA

Primary:
Request Enterprise Demo

Secondary:
Explore Platform

---

# Section 2 — The Risk Landscape

## Title

Climate Risk Is Now a Financial Risk

Three Intelligence Cards

### Physical Risk

* Floods
* Heatwaves
* Droughts
* Cyclones

### Transition Risk

* Carbon pricing
* Regulatory shifts
* Decarbonization costs

### Disclosure Risk

* ESG reporting gaps
* Greenwashing exposure
* Compliance risks

Each card should include:

* Financial impact
* Business disruption
* Regulatory exposure

---

# Section 3 — Climactix Intelligence Platform

## Visualization

Interactive Intelligence Network

Do not use separate cards.

Display all modules connected together.

Modules:

* Climate Risk Engine
* Supply Chain Intelligence
* Narrative Intelligence
* Regulatory Intelligence
* Scenario Simulator
* Greenwashing Risk Scanner
* Climate Intelligence Reports
* Climactix Terminal

The network should feel similar to a command center.

---

# Section 4 — Intelligence Outputs

## Title

Decision Intelligence Outputs

Display outputs using Bloomberg-style dashboard panels.

### Metrics

* Climate Risk Score
* Revenue at Risk
* Transition Exposure Index
* Supply Chain Risk Score
* Disclosure Credibility Score
* Carbon Exposure Index
* Climate Resilience Score

### Reports

* Climate Risk Report
* Transition Risk Briefing
* Supply Chain Exposure Report
* Climate Scenario Analysis
* Regulatory Intelligence Note
* Greenwashing Assessment

---

# Section 5 — Trust & Infrastructure

## Title

Powered by Global Climate Intelligence

### Data Sources

* NASA
* Copernicus
* NOAA
* World Bank
* IPCC
* NGFS
* ISSB
* SASB
* GRI
* TCFD

### Closing Statement

Built for Governments.
Designed for Investors.
Trusted by Enterprises.

### CTA

Book Enterprise Demo

---

# Dashboard Design

## Theme

Default: Dark Mode

Optional: Light Mode

---

## Dashboard Colors

```css
background: #0A0A0A;
panel: #151515;
border: #252525;
```

---

## Panel Design

* Minimal
* No shadows
* No glassmorphism
* No neumorphism
* Border radius: 8px
* Thin borders

---

# Core Dashboard Modules

## Executive Intelligence

* Climate Risk Score
* Company Summary
* Key Risks
* Recommendations

## Climate Risk Engine

* Physical Risk Analysis
* Hazard Mapping
* Risk Exposure

## Supply Chain Intelligence

* Vendor Risk
* Geographic Exposure
* Logistics Vulnerability

## Scenario Simulator

* 1.5°C Scenario
* 2°C Scenario
* 3°C Scenario

Outputs:

* Revenue impact
* Cost impact
* Asset impact

## Regulatory Intelligence

Track:

* CSRD
* ISSB
* SEC
* BRSR
* EU ETS
* CBAM

## Narrative Intelligence

Analyze:

* Annual Reports
* Sustainability Reports
* Earnings Calls
* Corporate Websites

Generate:

* Trust Index
* Credibility Score
* Narrative Risk Score

## Greenwashing Risk Scanner

Identify:

* Unsupported claims
* Missing disclosures
* Inconsistencies
* Regulatory exposure

---

# Data Visualization Guidelines

Preferred:

* Heatmaps
* Network Graphs
* GIS Maps
* Risk Matrices
* Time-Series Analysis
* Sankey Diagrams

Avoid:

* Pie Charts
* Donut Charts
* Decorative Infographics

---

# Animation Guidelines

Maximum duration:

300ms

Allowed:

* Fade
* Slide
* Counter animations

Avoid:

* Floating elements
* Excessive movement
* Decorative motion effects

---

# Imagery Guidelines

Use:

* Satellite imagery
* Earth observation imagery
* Climate hazard maps
* Financial intelligence dashboards
* Infrastructure imagery
* Supply chain networks

Never use:

* Generic office photos
* People shaking hands
* Stock sustainability imagery
* Leaves and eco icons
* Cartoon illustrations

---

# UX Principles

Every screen must answer:

1. What is the risk?
2. Where is the exposure?
3. What is the financial impact?
4. What action should be taken?

The user should feel:

"I am using a Climate Intelligence Terminal."

Not:

"I am browsing a sustainability consultancy website."

---

# Competitive Benchmark

Reference Design Inspiration:

* Bloomberg Terminal
* BlackRock Aladdin
* Palantir Foundry
* Climate X
* Moody's Analytics
* S&P Global
* NASA Earth Observatory

Do not copy.

Use only as design inspiration.

---

# Final Design Philosophy

Climactix Global should become the Bloomberg of Climate Risk Intelligence.

Every page, chart, module, report, and interaction should reinforce one message:

"Climate data transformed into decision-grade intelligence."
