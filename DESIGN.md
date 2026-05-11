---
version: 1.0
name: Climactix Global
description: "A premium climate intelligence social platform. Dark warm-charcoal surfaces derived from Linear's surface ladder, Inter typography at negative letter-spacing from Vercel/Linear, a single organic green accent (#4ADE80) inspired by climate/nature (never neon cyan), and content-first editorial layout drawn from Apple + Superhuman. The platform sits between Bloomberg terminal data density and Instagram social warmth — professional enough for VCs, human enough for activists. All UI feels fast, considered, and native — never dashboard-generated, never AI-default."
---

## Overview

Climactix uses a **warm-charcoal dark system** — not cold navy, not true black. The canvas is `#0C0C0E` with a 4-step surface ladder reaching `#232328`. A single organic green accent `#4ADE80` is used scarcely (only for: primary CTAs, active states, score rings, verified badges). The platform blends:

- **Linear** surface ladder + hairline border discipline
- **Inter** with aggressive negative letter-spacing on display
- **Superhuman** premium spacing + single-action CTA discipline  
- **Apple** content-first hierarchy — chrome recedes, content leads
- **Bloomberg** data density for intelligence/scores/rankings

The product must feel like a **premium global social network for climate** — not a SaaS dashboard, not a developer tool, not an AI UI.

---

## colors

```yaml
# Core surfaces
--bg:              "#0C0C0E"    # Warm near-black canvas (not cold navy)
--nav-bg:          "rgba(12,12,14,0.88)"  # Frosted glass nav
--surface:         "#141416"    # Cards, posts, panels (step 1)
--surface-2:       "#1C1C1F"    # Elevated surfaces, comment areas (step 2)
--surface-3:       "#232328"    # Highest elevation, modals bg (step 3)

# Borders — rgba only, never hard hex
--border:          "rgba(255,255,255,0.055)"   # Default: nearly invisible
--border-strong:   "rgba(255,255,255,0.10)"    # Hover, focus states
--border-accent:   "rgba(74,222,128,0.22)"     # Green accent borders

# Brand accent — organic green, NEVER neon cyan
--accent:          "#4ADE80"    # Primary CTAs, active states, score rings
--accent-dim:      "#22C55E"    # Hover state of accent
--accent-glow:     "rgba(74,222,128,0.09)"     # Background tint for active
--accent-fg:       "#052E16"    # Text ON green buttons

# Secondary interactive
--blue:            "#60A5FA"    # Links, mentions, hashtags
--blue-dim:        "#3B82F6"
--blue-glow:       "rgba(96,165,250,0.09)"

# Status / reputation
--gold:            "#FBBF24"    # #1 rank, gold tier
--silver:          "#94A3B8"    # #2 rank
--bronze:          "#CD7C3E"    # #3 rank
--danger:          "#F87171"    # Errors, destructive
--warning:         "#FB923C"    # Warnings, streaks

# Text — warm neutrals, never pure white or pure black
--text:            "#F2F2F3"    # Primary text
--text-2:          "#A0A0A8"    # Secondary text (post body, meta)
--text-muted:      "#505058"    # Placeholder, disabled, labels
--text-faint:      "#38383E"    # Very muted, borders at text scale
```

### Color Rules (DO NOT VIOLATE)

- **NEVER** use `#00C896`, `#00A07A`, or any teal-cyan as the accent. These read as "AI dashboard."
- **NEVER** use `#060E1C`, `#050A16`, or cold navy as the background. These read as "crypto UI."
- **NEVER** use border colors as hex values like `#1A2B40`. Always use `rgba(255,255,255, x)`.
- Accent `#4ADE80` is used for: CTAs, active nav, score ring, verified check, follow button hover, challenge completion. Nothing else.
- Section headers are NEVER uppercase + letter-spacing. That reads as "dashboard widget."

---

## typography

Font: **Inter** (Google Fonts, variable weight range 300–900).
Fallback stack: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`

### Scale

| Token           | Size  | Weight | Line Height | Letter Spacing | Use                                |
|-----------------|-------|--------|-------------|----------------|------------------------------------|
| display-xl      | 48px  | 800    | 1.05        | -2.4px         | Page hero headlines                |
| display-lg      | 36px  | 700    | 1.08        | -1.4px         | Section titles, modal big numbers  |
| display-md      | 28px  | 700    | 1.12        | -0.8px         | Card section headers               |
| heading         | 22px  | 700    | 1.20        | -0.4px         | Sidebar section titles             |
| subheading      | 18px  | 600    | 1.30        | -0.2px         | Card titles, post author name      |
| body-lg         | 15px  | 400    | 1.65        | 0              | Post body text                     |
| body            | 14px  | 400    | 1.60        | 0              | UI labels, sidebar nav             |
| body-sm         | 13px  | 500    | 1.50        | 0              | Meta text, timestamps              |
| caption         | 12px  | 500    | 1.40        | 0              | Tags, badges, pills                |
| micro           | 10px  | 600    | 1.30        | 0.4px          | ALL-CAPS labels (use sparingly)    |
| button          | 13px  | 700    | 1.0         | 0              | All button labels                  |
| score-display   | 22px  | 800    | 1.0         | -1px           | Climate score numbers              |

### Typography Rules

- **Negative tracking on display.** Every heading ≥18px gets negative letter-spacing.
- **No uppercase section headers.** Headers use sentence case with `font-weight: 700`. `text-transform: uppercase` with `letter-spacing` creates dashboard feel — forbidden.
- **Post body is 14–15px / 1.65 line-height / weight 400.** This creates readable editorial content, not cramped dashboard text.
- **Author names are 14px / weight 700 / letter-spacing: -0.2px.** Strong but not loud.
- **Score numbers use font-weight 800 with letter-spacing: -1px.** Numbers should feel designed, not default.

---

## rounded (border-radius)

| Token  | Value  | Use                                             |
|--------|--------|-------------------------------------------------|
| xs     | 4px    | Status chips, tiny badges                       |
| sm     | 6px    | Tab active states, small internal elements      |
| md     | 8px    | Buttons (primary action)                        |
| default | 10px  | Form inputs, comment inputs                     |
| lg     | 14px   | Post cards, sidebar cards, modals               |
| xl     | 20px   | Pill buttons (follow, sign in), search input    |
| full   | 9999px | Avatar circles, tag pills                       |

**Rule:** Post cards use `14px`. Buttons use `8px` (not pill). Follow/join CTAs use `20px` pill. Avatars always `9999px`.

---

## spacing

Base unit: `4px`.

| Token   | Value | Use                               |
|---------|-------|-----------------------------------|
| xxs     | 4px   | Icon-to-text gap, tight inline    |
| xs      | 8px   | Between badge elements            |
| sm      | 12px  | Between nav items                 |
| md      | 14px  | Card internal padding             |
| lg      | 16px  | Standard component gap            |
| xl      | 20px  | Section gap within panel          |
| xxl     | 24px  | Gap between major feed sections   |
| section | 32px  | Gap between layout sections       |

---

## elevation

Linear-inspired surface ladder — depth via background, never drop-shadow on chrome.

| Level | Background    | Border                           | Use                              |
|-------|---------------|----------------------------------|----------------------------------|
| 0     | `--bg`        | none                             | Page background                  |
| 1     | `--surface`   | `rgba(255,255,255,0.055)` 1px   | Cards, posts, panels             |
| 2     | `--surface-2` | `rgba(255,255,255,0.055)` 1px   | Comments, hover states, dropdowns |
| 3     | `--surface-3` | `rgba(255,255,255,0.10)` 1px    | Modals, overlays, pickers        |
| focus | n/a           | `rgba(74,222,128,0.22)` 2px     | Input focus, active selection    |

**Rule:** Never use `box-shadow` on nav, cards, or sidebar items. Elevation = surface color change only.

---

## components

### Navigation (top bar)

```
height: 62px
background: rgba(12,12,14,0.88) with backdrop-filter: blur(24px)
border-bottom: 1px solid rgba(255,255,255,0.055)

Logo: 15px / weight 700 / letter-spacing: -0.3px
Sub-label: 9px / weight 600 / letter-spacing: 2px / uppercase / color: #4ADE80

Search input: height 36px / border-radius 18px / background --surface-2
Nav links: 13.5px / weight 500 / border-radius 9px / horizontal row with gap 6px
  - Default: color --text-muted
  - Hover: background --surface-2 / color --text
  - Active: background rgba(74,222,128,0.09) / color #4ADE80 / weight 600

Sign in: border 1px --border / border-radius 20px / padding 7px 16px
Join: background #4ADE80 / color #052E16 / border-radius 20px / weight 700
```

### Post Card

```
background: --surface
border: 1px solid rgba(255,255,255,0.055)
border-radius: 14px
margin-bottom: 10px

On hover:
  border-color: rgba(255,255,255,0.10)

Header (author row):
  padding: 15px 15px 0
  avatar: 44x44px circle
  author name: 14px / weight 700 / letter-spacing: -0.2px
  meta row: 11.5px / color --text-muted
  verified badge: color #4ADE80

Body:
  padding: 10px 15px 0
  font-size: 14px / line-height: 1.7 / color: --text-2
  clamped at 5 lines with "...see more" in #4ADE80

Tags:
  font-size: 12px / weight 600 / color: --blue

Action bar:
  border-top: 1px solid rgba(255,255,255,0.055)
  buttons: 12.5px / weight 500 / color --text-muted / border-radius 10px
  On hover: background --surface-2

Type badges:
  solution:  background rgba(74,222,128,0.1)   / color #4ADE80
  funding:   background rgba(251,191,36,0.1)   / color #FBBF24
  research:  background rgba(167,139,250,0.1)  / color #A78BFA
  update:    background rgba(160,160,168,0.07) / color --text-muted
```

### Left Sidebar Navigation

```
Each item:
  padding: 9px 11px
  border-radius: 10px
  font-size: 13.5px / weight 500
  color: --text-muted
  NO border, NO background by default

Hover:
  background: --surface-2
  color: --text

Active:
  background: rgba(74,222,128,0.09)
  color: #4ADE80
  weight: 600

Section dividers: NONE — just natural spacing
```

### Right Sidebar Widgets

```
Widget container:
  background: --surface
  border: 1px solid rgba(255,255,255,0.055)
  border-radius: 14px
  padding: 14px

Widget title:
  font-size: 13px / weight 700 / color: --text / letter-spacing: -0.2px
  NOT uppercase, NOT small-caps, NOT muted color

"See all" link:
  font-size: 11.5px / weight 600 / color: #4ADE80

Leaderboard rank medals:
  #1: #FBBF24 (gold)
  #2: #94A3B8 (silver)
  #3: #CD7C3E (bronze)
  4+: --text-muted

Leaderboard tabs (Weekly/Monthly/All Time):
  Default: 1px solid --border / color --text-muted
  Active: background rgba(74,222,128,0.09) / color #4ADE80 / border rgba(74,222,128,0.22)
```

### Buttons

```
Primary CTA (Post, Submit, Confirm):
  background: #4ADE80
  color: #052E16
  border-radius: 8px
  padding: 7px 20px
  font-size: 13px / weight 700

Follow / Join (pill shape):
  background: #4ADE80 on hover
  border: 1px solid rgba(255,255,255,0.10) default
  border-radius: 20px
  padding: 5px 13px
  font-size: 11.5px / weight 600

Secondary (Cancel):
  background: --surface-2
  border: 1px solid --border
  border-radius: 20px

Reaction/action buttons (in post card):
  No background
  border-radius: 10px
  padding: 8px 4px
  color: --text-muted
  Hover: background --surface-2
```

### Feed Filter Tabs

```
Container: background --surface / border --border / border-radius 14px / padding 4px
Each tab: border-radius 10px / font-size 12.5px / weight 500
Default: color --text-muted
Active: background --surface-2 / color --text / weight 600
```

### Modals / Overlays

```
Overlay: background rgba(0,0,0,0.72) with backdrop-filter: blur(4px)
Modal: background --surface / border 1px solid --border-strong
       border-radius 14px
       animation: scale(0.96) → scale(1) + translateY(12px → 0) in 200ms cubic-bezier(0.4,0,0.2,1)
Modal title: 15px / weight 700 / letter-spacing -0.2px
```

### Score Ring (Profile)

```
SVG circle stroke: animates to #4ADE80 (green) at score≥80, #FBBF24 (gold) at score≥50, #F87171 (red) below
Score number: 22px / weight 800 / letter-spacing -1px / color #4ADE80
Score label: 9px / weight 600 / uppercase / letter-spacing 0.9px / color --text-muted
```

---

## layout

### 3-Column Grid

```
max-width: 1200px
columns: 260px | 1fr | 298px
gap: 18px
padding: 0 16px
responsive:
  ≤1100px: 240px | 1fr (right panel hidden)
  ≤720px:  1fr   (left panel hidden, mobile view)
```

### Content Hierarchy Rule

**Content dominates. Chrome recedes.**
- Post text is `--text-2` (secondary color) — the content doesn't compete with UI chrome
- Post author is `--text` (primary) — person > content
- Meta (time, views) is `--text-muted` — lowest priority
- Actions (React, Comment) are `--text-muted` — available but not distracting

---

## motion

All transitions: `0.16s cubic-bezier(0.4, 0, 0.2, 1)` (Material standard easing)

```
Hover states:     background / border-color transition at --t
Modal open:       scale(0.96)→scale(1) + translateY(12px→0) at 200ms
Score ring:       stroke-dashoffset animated at 600ms ease
Challenge bars:   width animated at 500ms ease
Battle bars:      width animated at 600ms ease
Score float:      opacity 0→1→0 + translateY 0→-48px at 1600ms ease
Toast:            translateY(80px)→translateY(0) at 300ms cubic-bezier(0.4,0,0.2,1)
Reaction picker:  scale(1.15) + translateY(-2px) on hover
```

---

## do / don't

### DO

- Use `rgba(255,255,255, x)` borders — never hardcoded hex border colors
- Use `--surface` / `--surface-2` / `--surface-3` for elevation hierarchy
- Use negative letter-spacing on all headings ≥ 18px
- Keep section headers in sentence case, weight 700, `--text` color
- Use `#4ADE80` as the SINGLE accent — scarcely, meaningfully
- Use `backdrop-filter: blur()` on the navigation for frosted glass
- Use `cubic-bezier(0.4, 0, 0.2, 1)` for all transitions
- Make content text `--text-2` (slightly muted) and author/title text `--text` (full brightness)
- Border-radius 14px on cards, 20px on pill buttons, 8px on action buttons

### DON'T

- DON'T use `text-transform: uppercase` + `letter-spacing` on widget headers → reads as dashboard
- DON'T use `#00C896` (neon cyan) → reads as "AI / crypto UI"
- DON'T use `box-shadow` on cards, nav, or sidebar items → use surface ladder instead
- DON'T use `JetBrains Mono` or monospace for score numbers in UI → use Inter weight 800
- DON'T use explicit colored hex borders like `#1A2B40` → use rgba white overlays
- DON'T make the nav bg solid opaque → use backdrop-filter frosted glass
- DON'T use `#060E1C` or cold navy backgrounds → use warm charcoal `#0C0C0E`
- DON'T use gradient backgrounds on cards → flat surface, subtle border only
- DON'T use multiple accent colors → single green accent only
- DON'T make the feed feel like a dashboard with labeled widgets → let content breathe

---

## reference design systems (blended)

This design system draws from the following `awesome-design-md` sources:

| Brand       | What we borrow                                                       |
|-------------|----------------------------------------------------------------------|
| **Linear**  | Surface ladder, hairline borders, near-black canvas philosophy       |
| **Vercel**  | Geist/Inter typography, negative letter-spacing, stark precision     |
| **Superhuman** | Premium whitespace, single-CTA discipline, editorial density     |
| **Apple**   | Content-first hierarchy, chrome-recedes principle, product-screenshot dominant |
| **Notion**  | Warm dark navy hero, workspace feel, collaborative tone             |
| **xAI**     | Near-black canvas, minimal chrome, engineered restraint             |

Source repository: https://github.com/VoltAgent/awesome-design-md
