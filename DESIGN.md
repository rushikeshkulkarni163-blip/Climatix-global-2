---
version: 2.0
name: Climactix Global — Institutional Design System
description: "Bloomberg Terminal-grade climate intelligence platform. Matte black surfaces, institutional amber accent, IBM Plex Mono data typography, and maximum information density. The platform competes visually with Bloomberg Terminal, BlackRock Aladdin, Reuters Eikon, MSCI Climate, and Palantir Gotham — not startup SaaS, not AI demos, not fintech templates. Every decision communicates institutional authority, financial trust, and sovereign-grade analytical capability."
---

## Philosophy

Climactix is a **financial operating system for climate intelligence** — trusted by institutional investors, governments, banks, regulators, and multinational corporations.

The platform must communicate:
- **Trust** through precision, not decoration
- **Authority** through data density, not spaciousness  
- **Credibility** through restraint, not visual complexity
- **Operationality** through functional chrome, not polish

Design references (ranked by influence):
1. Bloomberg Terminal — data density, amber accent, monospace numbers
2. BlackRock Aladdin — institutional dark palette, professional hierarchy
3. Reuters Eikon — news + data integration, clean dividers
4. MSCI Climate Analytics — risk visualization, analytical layouts
5. Palantir Gotham — intelligence workspace, panel systems

---

## Color System

```yaml
# ── Backgrounds — Institutional Matte Black
--bg:          "#000000"    # Pure matte black canvas
--bg-alt:      "#0A0A0A"    # Slight lift for alternating sections
--surface:     "#0F0F0F"    # Primary surface — panels, cards
--surface-2:   "#1A1A1A"    # Elevated surface — dropdowns, hover states
--surface-3:   "#242424"    # High elevation — tooltips, modals, active panels
--surface-4:   "#2E2E2E"    # Maximum elevation — focused inputs, selected rows

# ── Borders — graphite system (NOT rgba white overlays)
--border:         "#2C2C2C"   # Default border — table rows, card edges
--border-strong:  "#333333"   # Emphasized borders — section dividers
--border-accent:  "rgba(255,102,0,0.30)"  # Amber-tinted accent borders

# ── PRIMARY ACCENT — Bloomberg Amber
--amber:       "#FF6600"    # Bloomberg orange-amber — CTAs, active states, live data
--amber-dim:   "#CC5200"    # Hover state
--amber-glow:  "rgba(245,158,11,0.10)"   # Subtle tint background
--amber-fg:    "#000000"    # Text ON amber buttons

# ── DATA ACCENT SYSTEM — institutional, muted
--cyan:        "#0099CC"    # Professional cyan — links, data highlights, secondary metrics
--cyan-glow:   "rgba(6,182,212,0.10)"
--green:       "#00CC44"    # Institutional green — positive values, up metrics
--green-glow:  "rgba(16,185,129,0.10)"
--red:         "#FF3333"    # Risk red — negative values, critical alerts, down metrics
--red-glow:    "rgba(239,68,68,0.10)"
--blue:        "#3399FF"    # Deep blue — secondary data, scenario markers

# ── RANK COLORS
--gold:        "#FF6600"    # #1 position (Bloomberg amber)
--silver:      "#888888"    # #2 position (institutional gray)
--bronze:      "#CC5200"    # #3 position (dark amber)

# ── TEXT HIERARCHY — white-to-graphite scale
--text:        "#FFFFFF"    # Primary text — titles, key data
--text-2:      "#888888"    # Secondary text — descriptions, sub-labels
--text-muted:  "#555555"    # Muted text — timestamps, metadata
--text-faint:  "#222222"    # Faint text — borders at text scale, disabled

# ── STATUS COLORS
--danger:      "#FF3333"    # Errors, critical risk, destructive
--warning:     "#FF6600"    # Warnings, caution indicators (same as amber)
--success:     "#00CC44"    # Positive outcomes, green metrics
```

### Light Theme (Bloomberg Day Mode)

```yaml
--bg:          "#FFFFFF"
--bg-alt:      "#F5F5F5"
--surface:     "#FFFFFF"
--surface-2:   "#EBEBEB"
--surface-3:   "#E0E0E0"
--surface-4:   "#D5D5D5"
--border:         "#D0D0D0"
--border-strong:  "#BBBBBB"
--text:        "#000000"
--text-2:      "#333333"
--text-muted:  "#666666"
--text-faint:  "#999999"
```

### Color Rules (Non-Negotiable)

- **NEVER** use warm charcoal (#0C0C0E) or cold navy (#060E1C) as background — pure institutional black only
- **NEVER** use organic green (#4ADE80) — that was the old system; amber is the primary accent
- **NEVER** use glassmorphism, frosted glass, or `backdrop-filter: blur()` on panels
- **NEVER** use gradient backgrounds on cards or panels — flat surface with border
- **NEVER** use `box-shadow` on cards — elevation = surface color change only
- **Amber (#FF6600)** is used for: CTAs, active nav state, live data values, accent borders, Bloomberg-style metric highlights, "LIVE" indicators
- **Cyan (#0099CC)** is used for: links, secondary data points, geography highlights, globe data badges
- **Green (#00CC44)** is used for: positive financial values, up-arrows, score improvements
- **Red (#FF3333)** is used for: negative values, critical risk, down-arrows, alerts

---

## Typography

**Primary**: Inter (Google Fonts, 300–900 weight)
**Data/Numbers**: IBM Plex Mono (400–700 weight)

```
font: 'Inter', 'IBM Plex Sans', -apple-system, 'Helvetica Neue', system-ui, sans-serif
mono: 'IBM Plex Mono', 'JetBrains Mono', 'Courier New', monospace
```

### Type Scale (Bloomberg Terminal Hierarchy)

| Role              | Size    | Weight | Font    | Tracking    | Use                                   |
|-------------------|---------|--------|---------|-------------|---------------------------------------|
| Page title        | 28–34px | 800    | Inter   | -0.04em     | Hero headlines, page H1               |
| Section heading   | 20–24px | 700    | Inter   | -0.025em    | Panel headers, section titles         |
| Card title        | 14–16px | 700    | Inter   | -0.015em    | Card headers, entity names            |
| Body text         | 12–13px | 400    | Inter   | 0           | Descriptions, body content            |
| Label / Meta      | 11px    | 500    | Inter   | 0           | UI labels, secondary info             |
| Table row         | 12px    | 400    | Inter   | 0           | Table body text                       |
| Caption           | 10px    | 600    | Inter   | +0.08em     | Tags, chip labels, micro-categories   |
| Bloomberg label   | 8–10px  | 700    | IBM Plex Mono | +0.10em | ALL-CAPS section eyebrows, data labels |
| Data value        | 13–18px | 700    | IBM Plex Mono | +0.01em | KPI values, prices, metrics           |
| Score number      | 18–28px | 800    | IBM Plex Mono | -0.03em | Climate scores, large display numbers |
| Terminal text     | 11–12px | 500    | IBM Plex Mono | 0       | Code, IDs, table data columns         |

### Typography Rules

- **ALL-CAPS labels in IBM Plex Mono** for eyebrows, section categories, data table headers — this is Bloomberg DNA
- **Negative letter-spacing on headings ≥18px** — tighter tracking = institutional weight
- **Data numbers ALWAYS in IBM Plex Mono** — never Inter for prices, scores, metrics
- **Body text 12–13px at 1.5–1.6 line-height** — maximum density without sacrificing readability
- **No decorative typography** — no mixed case word-art, no gradient text, no glowing text

---

## Geometry (Border Radius)

Bloomberg Terminal aesthetic: **sharp or minimal radius only**.

| Token    | Value | Use                                                    |
|----------|-------|--------------------------------------------------------|
| Zero     | 0px   | Table cells, data grids, ticker strips                 |
| xs       | 1px   | Nothing visible                                        |
| sm       | 2px   | Micro badges, tiny chips                               |
| default  | 3px   | All standard components — cards, panels, buttons       |
| md       | 4px   | Dropdowns, nav items                                   |
| lg       | 6px   | Only for interactive elements that benefit from softness |

**Rule**: Maximum `3px` on all cards, panels, buttons. The `border-radius: 0 !important` override in style.css enforces this globally. Only override with explicit justification.

---

## Spacing

Base unit: `4px`. Bloomberg-style density.

| Token   | Value | Use                                      |
|---------|-------|------------------------------------------|
| xxs     | 4px   | Icon-to-text gap, inline tight           |
| xs      | 8px   | Between badge elements                   |
| sm      | 10px  | Nav item internal padding                |
| md      | 14px  | Card internal padding                    |
| lg      | 16px  | Standard gap between components          |
| xl      | 20px  | Between major card sections              |
| xxl     | 24px  | Page section internal gap                |
| section | 40px  | Between major page sections (not 80px+)  |

**Rule**: No section has `padding: 80px 0` unless it's a homepage hero. Inner pages use `24–40px` section gaps. Information density is a feature.

---

## Elevation

Surface ladder — no drop shadows on chrome.

| Level  | Background    | Border         | Use                                          |
|--------|---------------|----------------|----------------------------------------------|
| 0      | `--bg`        | none           | Page canvas                                  |
| 1      | `--surface`   | `--border` 1px | Cards, panels, nav, sidebar items            |
| 2      | `--surface-2` | `--border` 1px | Hovered rows, expanded items, sub-panels     |
| 3      | `--surface-3` | `--border-strong` 1px | Tooltips, dropdowns, active panels |
| 4      | `--surface-4` | `--border-strong` 1px | Focused inputs, selected table rows |

**Rule**: NEVER `box-shadow` on UI chrome. Elevation = background darkening. Only allowable `box-shadow`: deep overlay modals (0 16px 48px rgba(0,0,0,0.6)) and they should be rare.

---

## Components

### Navigation (Top Bar)

```
height: 44px
background: var(--bg) — SOLID BLACK, no glass
border-bottom: 1px solid var(--border)
position: sticky; top: 0; z-index: 200

Logo: IBM Plex Mono / 11px / weight 700 / letter-spacing 0.06em / uppercase
Accent label: IBM Plex Mono / 9px / weight 700 / letter-spacing 1.2px / uppercase / color: --amber

Nav links:
  font-size: 11px / weight 500 / color: --text-muted
  padding: 4px 10px / border-radius: 2px
  hover: background --surface-2 / color --text
  active: color --amber / border-bottom: 2px solid --amber

Right side: Avatar 28×28 / border-radius 2px
Theme toggle: simple icon button
```

### Cards / Panels

```
background: var(--surface)
border: 1px solid var(--border)
border-radius: 3px (or 0 for table-style panels)
NO box-shadow

Accent left-border variant:
  border-left: 3px solid var(--amber)  — used for hero panels, featured items

Hover state:
  background: var(--surface-2)
  border-color: var(--border-strong)

Table inside card:
  width: 100%
  header: 10px / IBM Plex Mono / weight 700 / ALL-CAPS / --text-muted / letter-spacing 0.08em
  row: 12px / Inter / border-bottom: 1px solid var(--border)
  row hover: background --surface-2
```

### Data Tables (Bloomberg Style)

```
table { width: 100%; border-collapse: collapse; }

thead th {
  font-family: IBM Plex Mono
  font-size: 10px
  font-weight: 700
  letter-spacing: 0.08em
  text-transform: uppercase
  color: --text-muted
  padding: 8px 14px
  border-bottom: 1px solid --border
  background: --surface
  text-align: left
}

tbody tr {
  border-bottom: 1px solid --border
  transition: background 0.12s ease
}

tbody tr:hover { background: --surface-2 }

tbody td {
  padding: 8px 14px
  font-size: 12px
  color: --text
}

Data value cells: IBM Plex Mono / 12px / --amber or --cyan
```

### Buttons

```
Primary (CTA):
  background: --amber (#FF6600)
  color: #000000
  padding: 7px 20px
  border-radius: 2px (NOT rounded pill)
  font-family: IBM Plex Mono
  font-size: 11px / weight 700
  letter-spacing: 0.06em
  text-transform: uppercase
  border: none
  hover: background --amber-dim

Outline:
  background: none
  border: 1px solid --border-strong
  color: --text-2
  padding: 6px 18px
  border-radius: 2px
  font-family: IBM Plex Mono
  font-size: 11px / weight 600
  letter-spacing: 0.06em
  text-transform: uppercase
  hover: border-color --amber / color --amber

Destructive / Alert:
  background: rgba(255,51,51,0.08)
  border: 1px solid rgba(255,51,51,0.25)
  color: --red
```

### KPI / Metric Cards

```
background: --surface
border: 1px solid --border
border-radius: 0 (table-grid style)

Label: IBM Plex Mono / 9px / weight 500 / letter-spacing 0.08em / uppercase / --text-muted
Value: IBM Plex Mono / 18–24px / weight 700 / letter-spacing -0.03em / --amber or --cyan
Delta: 11px / weight 700 / --green (positive) or --red (negative)

Grid layout: adjacent KPIs separated by 1px --border vertical lines (not gaps)
```

### Status Badges / Chips

```
Default: background --surface-3 / color --text-2 / border 1px solid --border
Positive: background rgba(0,204,68,0.08) / color --green / border rgba(0,204,68,0.2)
Negative: background rgba(255,51,51,0.08) / color --red / border rgba(255,51,51,0.2)
Amber: background rgba(255,102,0,0.08) / color --amber / border rgba(255,102,0,0.2)

Font: IBM Plex Mono / 8–9px / weight 700 / letter-spacing 0.1em / uppercase
Padding: 2px 7px
Border-radius: 2px (NEVER pill)
```

### Form Inputs

```
background: --surface (dark) or #fff (light)
border: 1px solid --border
border-radius: 2px
padding: 8px 12px
font-size: 13px
color: --text

focus:
  outline: none
  border-color: --amber
  box-shadow: none (no glow ring)

placeholder: color --text-muted
```

### Progress / Score Indicators

```
Bar:
  height: 3px (thin, terminal style)
  background: --border (track)
  fill: --amber or --green or --red based on value
  NO border-radius on bar

Ring (SVG):
  stroke: --amber (>75%), --green (50-75%), --red (<50%)
  value text: IBM Plex Mono / 16–22px / weight 800 / letter-spacing -0.03em
```

### Live / Alert Indicators

```
Live dot:
  width: 5px / height: 5px / border-radius: 50%
  background: --green
  animation: pulse (box-shadow only, no scale, no glow)

Alert banner:
  background: rgba(255,51,51,0.07)
  border-bottom: 1px solid rgba(255,51,51,0.2)
  font-size: 11px / IBM Plex Mono

Ticker strip:
  height: 36px
  background: --surface
  border-top/bottom: 1px solid --border
  Label tag: background --amber / color #000 / IBM Plex Mono / 9px / uppercase
  Items: IBM Plex Mono / 11px / --text-2
  Values: --amber / weight 700
```

---

## Layout System

### Page Architecture

```
Standard page:
  max-width: 1160–1560px depending on content density
  margin: 0 auto
  padding: 0 20px

Terminal / Dashboard:
  Full-width workspace
  Left rail: 220px (collapsible)
  Main panel: 1fr
  Right panel: 240–320px (optional)

Three-column:
  Left sidebar: 220–260px
  Main: 1fr
  Right panel: 280–320px
  gap: 16–20px

Two-column:
  Left: 220–280px
  Main: 1fr
  gap: 16–20px
```

### Section Spacing

- **Homepage hero**: 80–100px vertical padding
- **Homepage sections**: 60–80px vertical padding  
- **Inner page heroes**: 28–40px vertical padding
- **Dashboard panels**: 14–20px internal padding
- **Table rows**: 8–10px vertical padding
- **Card internal**: 14–20px padding

**Rule**: Inner pages are WORKSPACES, not landing pages. They use terminal-style spacing, not marketing-site spacing.

---

## Information Architecture Principles

### Bloomberg DNA Rules

1. **Data at 12px or smaller is acceptable** — professionals read dense screens
2. **Monospace numbers always** — IBM Plex Mono for every metric, score, price, stat
3. **ALL-CAPS labels in mono** — section eyebrows, table headers, metric labels
4. **Amber for live/active** — anything "live" or "active" should be amber
5. **No empty state decorations** — no cute SVG illustrations for empty states; use simple text
6. **Borders create structure** — use 1px lines to separate zones, not margins/padding alone
7. **Left-border accent** — `border-left: 3px solid --amber` on featured/pinned items is acceptable; it's Bloomberg style
8. **Ticker strips** — scrolling data tickers are a Bloomberg staple; use them where relevant

### Anti-Patterns (Absolutely Forbidden)

- Rounded corners > 6px anywhere except avatar circles
- `backdrop-filter: blur()` on any surface
- Gradient text effects
- `transform: scale()` hover effects
- Glowing box-shadows on cards
- Startup-style "pill" buttons (border-radius > 6px)
- Emoji icons in UI (SVG icons or IBM Plex Mono symbols only)
- Large hero sections with 100vh full-screen takeovers on inner pages
- Marketing-site section padding (80px+) on analytics/dashboard pages
- Colorful gradient hero backgrounds
- Social-media card aesthetics for community features
- Rounded avatar squares (use 2px radius, not 50% except community profile avatars)

---

## Theme System

### Dark Mode (Bloomberg Terminal — Default)

The canonical institutional terminal experience.
- Canvas: `#000000` pure matte black
- Primary accent: Bloomberg Amber `#FF6600`

### Light Mode (Bloomberg Day Mode)

Financial report / executive presentation aesthetic.
- Canvas: `#FFFFFF` pure white
- Surfaces: `#EBEBEB`, `#E0E0E0`
- Text: `#000000` and `#333333`
- Accent: Bloomberg Amber `#FF6600` (consistent across themes)

### Fixed-Dark Zones (Do Not Theme)

A small set of "instrument panel" zones stay permanently dark in both modes — they are chrome/masthead/hero elements, not body content, the same way a terminal's title bar never goes white:

- Utility bar, site header/nav, and nav dropdown menus
- The live alert banner and live metrics ticker strip directly under the nav
- The hero section (sits on satellite/space imagery — headline text is intentionally pinned white via `!important`)
- Footer (top and bottom bars) — kept dark as a frame bookending the white body, mirroring the nav at the top
- Self-contained "device frame" mock UI cards that preview the dark terminal product inside a lighter page (e.g. the "Sample Output" and "AI Output Preview" cards on the homepage) and floating HUD widgets (e.g. the corner globe widget) — these carry their own explicit dark background independent of the page theme, like a screenshot embedded in a document

Everything else (section content, grids, cards, forms, data viz chrome) must use the `--bg`/`--surface`/`--text`/`--border` variables so it flips correctly with the toggle.

### Theme Persistence

```javascript
// On load (before first paint):
(function(){
  var t = localStorage.getItem('cx-theme') || 'dark';
  if(t === 'light') document.documentElement.setAttribute('data-theme','light');
})();

// On toggle:
function toggleTheme() {
  const t = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('cx-theme', t);
}
```

---

## Motion

All transitions: `0.12s ease` (faster than typical — terminal responsiveness)

```
Hover states:       background / border-color at 0.12s ease
Row highlights:     background at 0.10s ease
Toast / alerts:     translateY(20px→0) at 0.20s ease
Modal open:         opacity(0→1) + translateY(8px→0) at 0.18s ease
Score animations:   stroke-dashoffset at 0.6s ease
Chart animations:   0.4–0.8s ease
Live data update:   color flash 0.3s ease (--amber flashes --text, returns to --amber)

FORBIDDEN:
- transform: translateY on hover (no lift effects)
- transform: scale on hover
- Any animation > 1s for UI interactions
- Keyframe glow / pulse on cards
- Floating / levitating elements
```

---

## Data Visualization

### Chart Standards

- Background: `--surface` (not transparent, not white)
- Grid lines: `--border` at 0.5–1px
- Axes: `--text-muted` / 10px IBM Plex Mono
- Legend: 10px IBM Plex Mono / --text-muted
- Primary line/bar: `--amber` or `--cyan`
- Secondary: `--blue`, `--green`, `--red`
- Annotations: IBM Plex Mono / 10px

### Risk Color Scale

```
Critical:  --red    (#FF3333) — >80% risk score
High:      --amber  (#FF6600) — 60–80% risk score  
Medium:    #92400E            — 40–60% risk score
Low:       --green  (#00CC44) — <40% risk score
```

### Globe / Map Standards

- Base map: dark institutional palette, no bright country fills
- Overlays: amber/red/cyan for risk layers
- Country hover tooltips: `--surface-3` background, `--amber` data values
- Asset markers: `--amber` for primary, `--cyan` for secondary
- Status bar below map: IBM Plex Mono / 9px / ALL-CAPS / --text-muted

---

## Reference Implementation

The canonical implementation files:
- `style.css` — Global design tokens and base styles
- `institutional.css` — Component library and shared patterns
- `dashboard.html` — Reference terminal implementation
- `simulation.html` — Reference full-screen workspace implementation
- `community.html` — Reference three-column institutional layout
- `leaderboard.html` — Reference data table implementation

All new pages must match the visual standard of these reference implementations.
