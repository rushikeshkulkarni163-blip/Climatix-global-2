# Climactix Global Design System v3.1

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

Adopted from the NASA Web Design System's typographic principles — clean, authoritative, scientific, institutional. Not a NASA branding copy; a typographic discipline borrowed from it. Inter and Space Grotesk (the v3.0 typefaces) are retired.

## Primary UI Font — Source Sans Pro

```css
--font-ui: 'Source Sans Pro', Helvetica, Arial, sans-serif;
```

Weights: 400, 600, 700 only. Never 100, 200, 300, 500, 800, 900.

Apply to: navigation, buttons, forms, cards, labels, menus, footer, dashboard UI, tables, captions, metadata, sidebars, filters, search, tooltips, modals.

## Heading Font — Helvetica

```css
--font-heading: Helvetica, Arial, sans-serif;
```

Bold weights only (700; 600 for sub-headings). Apply to: hero titles, section titles, card headings, dashboard titles, KPI titles, terminal headings.

## Editorial Font — Merriweather

```css
--font-editorial: Merriweather, Georgia, serif;
```

Apply only to: long-form articles, research papers, climate reports, blog content, publications, whitepapers, documentation. Never inside the dashboard or terminal UI.

## Type Scale

| Role | Size | Weight | Line-height |
|---|---|---|---|
| Hero | 64px (52px tablet / 38px mobile) | 700 | 1.05 |
| Page Heading | 48px | 700 | 1.15 |
| Section Heading | 36px | 700 | 1.15 |
| Sub Heading | 28px | 600 | 1.15 |
| Card Heading | 22px | 600 | 1.15 |
| Body Large | 18px | 400 | 1.6 |
| Body | 16px | 400 | 1.6 |
| Small Text | 14px | 400 | 1.6 |
| Caption | 12px | 400 | 1.5 |

Scale hero/heading sizes proportionally at tablet and mobile breakpoints; never let body/caption sizes shrink below their listed value.

## Letter Spacing

* Headings: `-0.02em`
* Body: `0`
* Buttons: `0.03em`
* Navigation: `0.04em`

Never exaggerate spacing beyond these values.

## Layout Rules

* Paragraph measure: 720–780px max width. Never full-width text blocks.
* Alignment: left-aligned everywhere except the hero, which may center.

## Component Specifics

* **Dashboard**: Source Sans Pro throughout. Numbers 700 weight. Tables 14px. Filters 14px. Sidebar 15px. Metrics 18px. Terminal 16px.
* **Buttons**: Source Sans Pro, 16px, 600 weight, sentence case (no uppercase), letter-spacing `0.03em`.
* **Navigation**: Source Sans Pro, 18px, 600 weight, letter-spacing `0.04em`.
* **Forms**: Labels 14px/600. Input 16px/400. Helper text 13px. Placeholder 15px.
* **Cards**: Title 22px/600 (Helvetica). Body 16px/400 (Source Sans Pro). Metadata 13px.
* **Footer**: Body 15px/400. Links 15px/600.

## Anti-Patterns (typography)

No gradient text, glow effects, neon typography, shadowed text, decorative or futuristic fonts, oversized marketing headlines, or floating text effects. Typography must read as calm, scientific, and institutional — never as an AI-startup display face.

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
