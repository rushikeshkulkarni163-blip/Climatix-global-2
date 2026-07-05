# Climactix Global Design System v4.0

## Vision

Climactix Global is building the world's first Climate Risk Intelligence Operating System designed for governments, investors, financial institutions, insurers, regulators, and enterprises.

This is not an ESG platform.

This is not a sustainability consultancy.

This is a decision intelligence platform that converts climate data into financial, operational, supply-chain, and regulatory insights.

---

## Migration note (v3.2 → v4.0)

v4.0 supersedes v3.2 as the design system of record for all new and rebuilt surfaces, starting with the Enterprise Dashboard. It replaces the v3.2 dark/Royal-Blue/Roboto system with a light, NASA-Earth-Observatory × MSCI-inspired system.

Existing shipped pages built under v3.2 (dark theme, Royal Blue `#0057FF` / Data Cyan `#00C2FF`, Roboto) are **not** retroactively repainted by this change. They keep their current v3.2 styling until they are individually rebuilt. Any net-new page, or any page explicitly brought in for a redesign, must follow v4.0 below. Do not mix v3.2 and v4.0 tokens on the same page.

---

# Brand Positioning

## Category

Climate Risk Intelligence Platform

## Positioning Statement

Climate Risk Intelligence for Capital Allocation

## Mission

Enable organizations to understand, quantify, and act on climate-related risks through real-time intelligence and scenario-driven decision support.

## User Perception

When users visit the platform, they should feel:

* Institutional
* Premium
* Scientific
* Financial-grade
* Trustworthy
* Government-ready
* Investor-ready

The experience should feel closer to NASA's web design system (clarity, precision, scientific communication) and MSCI's structured information density than a sustainability consultancy, AI startup, or Web3 product.

---

# Visual Identity

## Design Personality

* Clean
* Minimal
* Data-first
* Enterprise-grade
* High-trust
* Scientific
* Precise

Avoid startup aesthetics. Avoid AI-gimmick visuals. Avoid crypto/Web3 styling. Avoid glassmorphism. Avoid neon or glow. Avoid generic ESG visuals. Avoid sustainability clichés.

---

# Color System

## Primary Colors (Light Theme)

```css
--bg: #FFFFFF;
--surface: #FAFAFA;
--card: #FFFFFF;
--border: #D9D9D9;
--text: #111111;       /* primary text */
--text-2: #4F4F4F;     /* secondary text */
--text-muted: #6B7280; /* muted/tertiary text */
```

## Accent & Status Colors

```css
--accent: #0B3D91;     /* NASA Blue */
--success: #1E8E3E;
--warning: #B45309;
--critical: #DC2626;
```

## Usage Rules

NASA Blue (`--accent`):

* Primary CTA buttons
* Active navigation state
* Key metrics / primary KPI values
* Links and interactive affordances
* Selected/focused states

Success / Warning / Critical:

* Risk status badges, alert severity, trend indicators, scenario thresholds
* Never used decoratively — only to encode a real status or risk level

Accent + status colors combined must never exceed ~10% of any screen's surface area — color encodes meaning, not decoration.

## Forbidden

* No gradients (text or background)
* No glowing effects or neon
* No glassmorphism or `backdrop-filter: blur()`
* No neumorphism
* No box-shadow used for decorative depth (elevation is conveyed via flat surface steps and 1px borders — see Elevation below)
* No Bloomberg amber (`#FF6600`), no organic green (`#4ADE80`), no Royal Blue (`#0057FF`) / Data Cyan (`#00C2FF`) — those are the retired v3.2 dark-theme accents

## Elevation

Flat surfaces only, conveyed by background-step + thin border, never shadow:

`--bg` (white) → `--surface` (`#FAFAFA`) → `--card` (white panel with `1px solid var(--border)`).

---

## Dark Mode (v4.0 companion theme)

v4.0 is light-first, but pages may offer a dark companion theme via a `data-theme="dark"` attribute on `<html>`, toggled from the nav (see top-nav dark-mode toggle in Layout System below) and persisted in `localStorage`. Default theme is always light.

The dark variant is **not** a revival of the retired v3.2 matte-black/amber terminal look. It never uses pure black (`#000000`) and never uses Bloomberg amber, Royal Blue, or Data Cyan. It is the same NASA Blue / MSCI system rendered on dark-slate surfaces instead of white, with the same rules for typography, radius, motion, and accent budget.

```css
[data-theme="dark"] {
  --bg: #0B0E14;         /* dark slate, never pure black */
  --surface: #11151C;
  --card: #161B24;
  --border: #232935;
  --text: #F4F6F8;
  --text-2: #B8C0CC;
  --text-muted: #7C8794;

  --accent: #3D7BE0;     /* lightened NASA Blue for AA text/link contrast on dark surfaces */
  --accent-fill: #0B3D91; /* solid NASA Blue still used as button/badge fill; pair with white text */
  --success: #22C55E;
  --warning: #F59E0B;
  --critical: #F87171;
}
```

Rules:

* Elevation stays flat + border-based: `--bg` → `--surface` → `--card`, same as light mode — no shadows added for dark mode.
* `--accent` (the lightened blue) is for text links, active nav labels, and focus rings on dark surfaces, where the base NASA Blue `#0B3D91` would fail contrast against dark backgrounds. `--accent-fill` (base NASA Blue) is for solid button/badge/CTA backgrounds with white text, in both themes.
* Status colors are lightened for AA contrast on dark surfaces (`--success`/`--warning`/`--critical` above) — same semantic roles as light mode, never decorative.
* Do not introduce new typography, radius, or motion rules for dark mode — those are theme-agnostic and defined once.

---

# Typography

NASA-inspired hierarchy. Unlike v3.2 (single Roboto typeface), v4.0 uses **role-based font families** — do not substitute one role's font for another's.

```css
--font-heading: 'Helvetica Neue', Helvetica, Arial, sans-serif;
--font-body: 'Source Sans Pro', Arial, sans-serif;
--font-report: 'Merriweather', Georgia, serif;
--font-number: 'Helvetica Neue', Helvetica, Arial, sans-serif; /* bold only */
```

* **Headings** (nav labels, page titles, section titles, card titles): Helvetica.
* **Body** (paragraphs, table cells, form inputs, descriptions, tooltips): Source Sans Pro.
* **Reports** (generated PDF/report bodies — ESG, BRSR, TCFD, CSRD, board summaries): Merriweather, for print-grade readability.
* **Numbers** (KPI values, dashboard metrics, table numeric columns): Bold Helvetica — always bold, never another weight, set in a tabular/monospaced-numeral style where the font supports it.

Load both Helvetica Neue (system font, no load needed — falls back to Arial) and Source Sans Pro / Merriweather via self-hosted `next/font/google` in the Next.js app. Never a runtime `@import`.

## Type Scale

| Role | Size | Weight | Line-height |
|---|---|---|---|
| Page Title | 32px | 700 | 1.2 |
| Section Title | 24px | 700 | 1.2 |
| Card Title | 18px | 700 | 1.3 |
| Large Body | 16px | 400 | 1.6 |
| Standard Body | 14px | 400 | 1.6 |
| Small / Caption | 12px | 400 | 1.5 |
| Label | 12px | 500 | 1.4 |
| Nav Item | 14px | 500 | 1.4 |
| Button | 14px | 500 | 1.4 |

**KPI / metric numbers**: 36px (large), 28px (medium), 20px (small) — always Bold Helvetica, tight letter-spacing (`-0.01em`).

## Text Rules

* Sentence case throughout. No ALL CAPS headings.
* Uppercase reserved for: eyebrow labels, status badges, breadcrumb segments.
* Generous whitespace and clear hierarchy over decoration — let spacing, not font size, carry readability.
* Paragraph measure: 720–780px max width.

---

# Layout System

## Grid

12-column responsive grid. Max content width: **1600px**.

## Spacing Scale

`8 / 16 / 24 / 32 / 48 / 64` px — no arbitrary spacing values outside this scale.

## Desktop Shell

```
--------------------------------------------------------
Top Navigation
--------------------------------------------------------
Left Nav  |  Main Dashboard  |  Right Intelligence Panel
--------------------------------------------------------
Footer
```

* **Left sidebar**: persistent, collapsed/expanded modes, simple line icons only (no gradient icon fills).
* **Top nav**: logo + search (left), breadcrumb (center), notifications/tasks/messages/user/dark-mode toggle/command palette (right).
* **Right intelligence panel**: AI insights — top risks, recent changes, data quality, emerging risks, suggested actions, regulatory alerts. Updates dynamically, never static.

## Border Radius

`8px` on cards, panels, buttons, inputs. No sharp 0px corners, no full pill shapes (status badges/chips may use pill shape — that is the one exception).

---

# Motion

* Hover, elevation-step, fade, slide, expand only.
* Duration: **150–250ms**.
* No bouncing, no floating/decorative motion, no animation longer than 250ms.

---

# Data Visualization Guidelines

Preferred: heatmaps, network graphs, GIS/satellite maps, 5×5 risk matrices, time-series with zoom/hover/compare/export/filter/annotate, Sankey diagrams.

Forbidden: pie charts, donut charts, decorative infographics, screenshots in place of live chart components.

All charts/tables/maps must be data-driven and API-ready — no static images.

---

# Components

One shared design language across: Button, Input, Dropdown/Select, Card, Badge, Table (sticky header, sortable, filterable, pinnable columns, resizable, paginated, CSV/PDF export), Tabs, Accordion, Dialog, Toast/Notification, Tooltip, Progress, Empty State, Loading/Skeleton.

Design tokens (spacing, type, color, radius, elevation) must be defined once as CSS variables / Tailwind theme extensions and consumed everywhere — never hardcoded hex or px values in component files.

---

# Accessibility

WCAG AA minimum. Full keyboard navigation. Visible focus states. ARIA labels on all interactive elements. Semantic HTML. Screen-reader support. Maintain AA contrast ratios on every text/background pairing defined in the Color System above.

---

# UX Principles

Every screen must answer:

1. What is the risk?
2. Where is the exposure?
3. What is the financial impact?
4. What action should be taken?

The user should feel: "I am using a climate risk intelligence terminal built for institutional decision-making."

Not: "I am browsing an AI startup dashboard or a marketing demo."

---

# Competitive Benchmark

Reference inspiration only — never copy layouts, branding, or proprietary elements:

* NASA web design system / NASA Earth Observatory
* MSCI
* Bloomberg Terminal
* BlackRock Aladdin
* Moody's Analytics
* S&P Global

---

# Final Design Philosophy

Climactix Global should read as institutional decision-support infrastructure for governments, banks, insurers, regulators, and global enterprises — scientific rigor plus financial analysis plus operational usability. Every layout decision, component, and interaction reinforces trust, clarity, and analytical depth.
