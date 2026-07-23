#!/usr/bin/env node
// ── Climactix Global · Risk OS question bank + methodology seed script ──
//
// Populates ros_questions_v1 — the assessment question bank must be
// server-side, not hardcoded in a <script> tag, before question selection
// can be gated by mandate purpose or materiality scan (see risk-os-data.js
// loadQuestionBank() and the Initial Materiality Scan in functions/main.py)
// — and seeds the first ros_methodology_versions_v1 doc.
//
// climate-risk-os.html's inline TYPED_QUESTIONS/BASE_QUESTIONS stay the
// source of truth AND the local-mode fallback (loadQuestionBank() falls
// back to them on any failure) — this script extracts them directly from
// that file rather than hand-duplicating 220+ proprietary questions into a
// second source, which would drift the moment either copy changed. Re-run
// this script whenever the inline arrays change — same "known limitation,
// kept in sync by hand" tradeoff already accepted for functions/services/*
// vs backend/services/* (see RISK_OS_COLLABORATION_ARCHITECTURE.md §4).
//
// Setup: same as scripts/seed-firestore.js —
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json npm run seed:questions
//
// Safe to re-run: upserts every question by id (overwrites content, never
// duplicates) and only creates the methodology version doc if none exists
// yet, unless --force-methodology is passed.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FORCE_METHODOLOGY = process.argv.includes('--force-methodology');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account key path first — see seed-firestore.js\'s header comment.');
  process.exit(1);
}

// ── Extract TYPED_QUESTIONS / BASE_QUESTIONS directly from climate-risk-os.html ──
// A regex on just the array literal is unsafe here: TYPED_QUESTIONS
// contains nested arrays (dropdown `opts: [...]`), so a naive non-greedy
// match would stop at the first inner `]`, not the outer array's. Instead
// this slices out the whole two-declaration source block (a known-valid,
// self-contained snippet — both are just `const NAME = [...]`) and lets a
// real JS parser (new Function) evaluate it; any accidental truncation
// throws a SyntaxError immediately instead of silently seeding wrong data.
const htmlPath = join(__dirname, '..', 'climate-risk-os.html');
const html = readFileSync(htmlPath, 'utf8');

const START_MARKER = 'const TYPED_QUESTIONS = [';
const END_MARKER = ']; /* ── END BASE ── */';
const startIdx = html.indexOf(START_MARKER);
const endMarkerIdx = html.indexOf(END_MARKER);
if (startIdx === -1 || endMarkerIdx === -1) {
  console.error(
    'Could not find TYPED_QUESTIONS/BASE_QUESTIONS markers in climate-risk-os.html — ' +
    'has the file structure changed? Update START_MARKER/END_MARKER in this script.'
  );
  process.exit(1);
}
const endIdx = endMarkerIdx + '];'.length;
const extractedChunk = html.slice(startIdx, endIdx);

let TYPED_QUESTIONS, BASE_QUESTIONS;
try {
  ({ TYPED_QUESTIONS, BASE_QUESTIONS } =
    new Function(extractedChunk + '\nreturn { TYPED_QUESTIONS, BASE_QUESTIONS };')());
} catch (e) {
  console.error('Failed to parse extracted question arrays — climate-risk-os.html may have changed shape:', e.message);
  process.exit(1);
}

const ALL_QUESTIONS = [...TYPED_QUESTIONS, ...BASE_QUESTIONS];
const seenIds = new Set();
for (const q of ALL_QUESTIONS) {
  if (!q.id) { console.error('Question missing id:', q); process.exit(1); }
  if (seenIds.has(q.id)) { console.error(`Duplicate question id: ${q.id}`); process.exit(1); }
  seenIds.add(q.id);
}
console.log(`Extracted ${ALL_QUESTIONS.length} questions (${TYPED_QUESTIONS.length} typed + ${BASE_QUESTIONS.length} base) from climate-risk-os.html.`);

const METHODOLOGY_VERSION_ID = 'CRX-2026.1';

const app = initializeApp({ credential: applicationDefault() });
const db = getFirestore(app);

async function seedQuestions() {
  const commits = [];
  for (let i = 0; i < ALL_QUESTIONS.length; i += 400) {
    const slice = ALL_QUESTIONS.slice(i, i + 400);
    const batch = db.batch();
    slice.forEach(q => batch.set(db.collection('ros_questions_v1').doc(q.id), {
      ...q,
      methodologyVersion: METHODOLOGY_VERSION_ID,
      active: true,
    }));
    commits.push(batch.commit());
  }
  await Promise.all(commits);
  console.log(`seeded ros_questions_v1 (${ALL_QUESTIONS.length} docs)`);
}

async function seedMethodologyVersion() {
  const ref = db.collection('ros_methodology_versions_v1').doc(METHODOLOGY_VERSION_ID);
  const existing = await ref.get();
  if (existing.exists && !FORCE_METHODOLOGY) {
    console.log(`skip   ros_methodology_versions_v1/${METHODOLOGY_VERSION_ID} (already exists — pass --force-methodology to overwrite)`);
    return;
  }
  // Assumption numbers are deliberately left UNRECONCILED here, not
  // silently picked — backend/services/climate_financial_simulator.py:140
  // uses $130/tCO2e for the 2030 1.5C carbon price, while
  // intelligence_engine/engines/transition_risk_engine.py:96 uses $145.
  // Model Governance (assumptions must carry a real approvedBy sign-off)
  // means inventing a resolution here would be exactly the false precision
  // the methodology itself forbids. The full Base/Low/High assumptions
  // registry with cross-service reads is a later phase — this is only a
  // placeholder recording the conflict for that phase to resolve.
  await ref.set({
    id: METHODOLOGY_VERSION_ID,
    status: 'active',
    effectiveDate: '2026-01-01',
    label: 'Climactix Risk OS Methodology v2026.1',
    assumptionsPendingReconciliation: [{
      assumptionId: 'carbon_price_2030_1_5C',
      conflictingValues: [
        { value: 130, unit: 'USD/tCO2e', source: 'backend/services/climate_financial_simulator.py:140' },
        { value: 145, unit: 'USD/tCO2e', source: 'intelligence_engine/engines/transition_risk_engine.py:96' },
      ],
      approvedBy: null,
      note: 'Not yet reconciled — see the Model Governance + Assumptions Registry phase.',
    }],
    createdAt: new Date().toISOString(),
  });
  console.log(`seeded ros_methodology_versions_v1/${METHODOLOGY_VERSION_ID}`);
}

await seedQuestions();
await seedMethodologyVersion();
console.log('Done.');
