# Climactix Global — Claude Code Instructions

## Design System

**ALWAYS read `DESIGN.md` before writing or editing any HTML/CSS.**

The Climactix design system is defined in [`DESIGN.md`](./DESIGN.md). Every UI decision — colors, typography, spacing, borders, elevation, motion — must follow that file exactly. Do not deviate, invent new patterns, or fall back to defaults.

### Critical design rules (memorize these):

1. **Background**: `#0C0C0E` warm charcoal. NEVER cold navy (`#060E1C`) or pure black.
2. **Accent**: `#4ADE80` soft organic green. NEVER neon cyan (`#00C896`) or teal.
3. **Borders**: Always `rgba(255,255,255,0.055)` — NEVER hard hex border colors.
4. **Section headers**: Sentence case, `font-weight: 700`. NEVER `text-transform: uppercase`.
5. **Elevation**: Use the surface ladder (`--surface` → `--surface-2` → `--surface-3`). NEVER `box-shadow` on cards.
6. **Nav**: Frosted glass `backdrop-filter: blur(24px)`. NEVER solid opaque background.
7. **Typography**: Inter with negative letter-spacing on all headings ≥18px.
8. **Motion**: `0.16s cubic-bezier(0.4,0,0.2,1)` for all transitions.

### Anti-patterns that make UI look AI-generated:
- Neon/glowing accents → always use `#4ADE80` (soft, organic)
- Hard colored borders → always `rgba` white overlay
- Uppercase widget headers with letter-spacing → use `font-weight: 700` sentence case
- Dashboard card grid feel → use content-first layout, let posts breathe
- JetBrains Mono for score numbers → use Inter weight 800
- Cold navy backgrounds → warm charcoal only

## Project Overview

Climactix Global is a **premium climate intelligence social platform** — combining:
- Social feed (Instagram/X-style posts, reactions, comments)
- Climate scoring + reputation system
- Leaderboard + competitive mechanics
- VC Pitch + Funding Hub
- Solution Hub + Forum
- ESG Dashboard + AI Engine

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS (no framework)
- **State**: `localStorage` via `community.js` (ES module)
- **Auth**: Firebase (auth.js + firebase-config.js)
- **Backend**: FastAPI (Python) in `backend/`
- **Data**: PostgreSQL + Docker Compose

## Key Files

| File | Purpose |
|------|---------|
| `community.html` | Main social feed — the flagship page |
| `community.js` | Full data layer (posts, profiles, scores, battles) |
| `community-profile.html` | User profile page |
| `community-login.html` | Auth page |
| `leaderboard.html` | Global climate rankings |
| `forum.html` | Discussion threads |
| `funding-hub.html` | VC pitch cards |
| `solutions.html` | Solution Hub |
| `battles.html` | Debate/battle mechanics |
| `dashboard.html` | ESG intelligence dashboard |
| `climactix-ai.html` | AI narrative engine |
| `simulation.html` | Risk intelligence map |
| `assessment.html` | Climate score assessment |
| `DESIGN.md` | **Design system — read before any UI work** |

## Coding Rules

- Preserve all JavaScript logic in `community.js` — only touch CSS/HTML for design work
- All CSS variables are defined in `:root` — always use CSS variables, never hardcode colors
- The `--t` variable = `0.16s cubic-bezier(0.4,0,0.2,1)` — use for all transitions
- `--accent-fg: #052E16` is the text color ON green buttons (dark forest green, not black)
- When adding new components, follow the component patterns in `DESIGN.md`
- No external CSS frameworks — keep everything in `<style>` blocks

## Brand Voice

- Platform name: **Climactix** (not Climatix)
- Tone: Premium, institutional, climate-authoritative — NOT startup pitch, NOT AI assistant
- Target users: Climate startup founders, VCs, ESG strategists, researchers, activists
