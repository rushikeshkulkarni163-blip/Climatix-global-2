# Risk OS Collaboration Backend — Architecture & Status

## Confidential Internal Document · Companion to DB_SCHEMA.md

This document covers the backend that turns Risk OS (`climate-risk-os.html`) from a
single-browser, `localStorage`-only assessment into a persisted, multi-user, auditable
Climate Intelligence Due Diligence Workspace.

**This is the Firestore-based rebuild of this architecture.** An earlier pass built the same
thing on Postgres + FastAPI (`backend/routers/risk_os.py`, migration `003_...sql`) — that
version was fully built and verified working, then removed in favor of this one. The reason:
identity. See §1.

**Status at a glance: Firestore schema, security rules, the AI evidence review Cloud Function,
and the core frontend data flow (companies, assessments, answers, C-LAYER scores, realtime
collaboration) are built and verified.** `climate-risk-os.html` now persists to Firestore for
signed-in members instead of `localStorage` alone. Comment threads, tasks, risk notes, and
evidence upload UI are not wired yet — see §6.

---

## 1. Why Firestore, and why this replaced the Postgres version

The first pass built `risk_os.py` (FastAPI) authenticating against `auth_users` / the
`cx_access` JWT cookie (`routers/auth.py`, migration 001). That system is real and working —
but it turned out to be the **wrong** one.

`climate-risk-os.html`, and every other page, gets its session through `auth.js`, which
auto-selects one of two modes:

```js
const _USE_FIREBASE = !firebaseConfig.apiKey.startsWith('YOUR_');
```

`firebase-config.js` has real, non-placeholder credentials (project `climactixglobal`), so
`_USE_FIREBASE` is `true` site-wide. **Firebase Authentication is the identity system actually
in production.** The Postgres `auth_users` / `cx_access` cookie path only activates if someone
resets `firebase-config.js` to placeholders — it's the offline/local-dev fallback, not what real
users hit. A backend that checks `cx_access` cookies would reject every real signed-in user.
That's a real bug the first pass shipped, caught by testing this assumption rather than
building further on it.

Given that, and given the project already has a live, documented Firestore pattern for
multi-user collaborative data (`DB_SCHEMA.md`, powering Community's posts/comments/
notifications), moving Risk OS's *entire* data model there — not just fixing the auth check —
keeps identity, collaboration data, and file storage on one consistent stack (Firebase Auth +
Firestore + Firebase Storage) instead of running a second, mostly-idle Postgres server
alongside it.

**What carried over from the Postgres design, conceptually:** the entity list, the RBAC role
split (system `role` vs. functional `department`), the 9-state assessment workflow, and the
"answers are JSONB so any response shape fits" idea — those were sound; only the storage
engine and the auth check changed.

---

## 2. Data model — Firestore collections

Following the `DB_SCHEMA.md` convention (one document per item, not one blob per type).
All new collections are prefixed `ros_v1` → written as `ros_<noun>_v1`, parallel to
`cx_<noun>_v1` for Community. Full field-level detail lives in `firestore.rules` (the rules
file *is* close to a schema, since every field it reasons about must exist).

| Collection | Doc ID | Purpose |
|---|---|---|
| `ros_companies_v1` | auto | The assessed entity |
| `ros_members_v1` | `${companyId}_${uid}` | Membership: `role` (administrator/assessment_owner/contributor/reviewer/approver/auditor/read_only) **and** `department` (climate_team/finance/risk/operations/legal/procurement/esg_officer/facility_manager/consultant/auditor/government_reviewer) as separate fields |
| `ros_assessments_v1` | auto | One per company per year; `status` drives the review workflow |
| `ros_answers_v1` | `${assessmentId}_${questionId}` | `rawAnswer` is a nested object holding any response shape (choice, number, currency, date, matrix, geo, upload ref, ...) |
| `ros_answer_versions_v1` | auto | Append-only change log — never overwritten |
| `ros_clayer_scores_v1` | `${assessmentId}_${clayerId}` | Server/client-computed C-LAYER pillar scores |
| `ros_evidence_v1` | auto | File metadata; bytes live in Firebase Storage at `evidence/{companyId}/{assessmentId}/{fileName}` |
| `ros_ai_reviews_v1` | auto | AI review output — **written only by the Cloud Function**, never the client |
| `ros_comments_v1` | auto | Threaded (`parentCommentId`), `mentions[]`, `pinned`, `resolved` |
| `ros_tasks_v1` | auto | Assignable to a user and/or department |
| `ros_risk_notes_v1` | auto | Likelihood/impact/financial/operational/regulatory/reputation/mitigation |
| `ros_facilities_v1` | auto | Geospatial anchor (lat/lng); hazard layers are fetched live from `/api/climate-data`, not stored |
| `ros_financial_materiality_v1` | auto | Revenue exposure, capex, opex, expected loss, etc. |
| `ros_framework_mappings_v1` | `${assessmentId}_${frameworkCode}` | Per-framework coverage |
| `ros_review_actions_v1` | auto | Reviewer actions: return-to-author, request-evidence, approve, reject, close |
| `ros_notebook_v1` | auto | Org-level persistent notes (meeting notes, site visits, scenario assumptions) |
| `ros_audit_log_v1` | auto | Content audit trail — append-only |

**Notifications reuse the existing `cx_notifs_v1` collection** — Risk OS just writes new
`type` values (`assignment`, `mention`, `deadline`, ...) into the same per-user capped array
Community already uses. No new collection, no rule change.

---

## 3. Security rules — the real access-control layer

Firestore has no server process, so `firestore.rules` **is** the authorization system (the
equivalent of the Postgres RLS policies in the earlier design). Added to the existing
`firestore.rules` file, alongside the Community rules already there:

- `isCompanyMember(companyId)` / `hasAnyRole(companyId, roles)` — read the caller's
  `ros_members_v1/{companyId}_{uid}` doc via `exists()`/`get()`.
- `companyOfAssessment(assessmentId)` — one hop from an assessment-scoped collection to its
  company, so e.g. `ros_answers_v1` rules can authorize off company membership without
  duplicating `companyId` denormalization everywhere (it's there for reads, but rules re-derive
  it for writes to avoid trusting a client-supplied field).
- `rosTransitionAllowed(from, to)` — the 9-state workflow encoded as boolean logic, since rules
  can't reference an external state machine; heavier states (`validated`/`approved`/`rejected`/
  `under_review`) additionally require `rosReviewRoles()`.

**A real bug was found and fixed while verifying this**, not just designed and assumed
correct: the first version of the `ros_members_v1` create rule let *any* signed-in user
self-assign `role: 'administrator'` on *any* company, by writing a membership doc claiming
`userId == request.auth.uid`. Verified via the Firestore emulator with an unauthenticated
stranger token — it worked, i.e. it was exploitable. Fix: the self-onboarding path now also
checks `get(ros_companies_v1/{companyId}).data.createdBy == request.auth.uid`, so you can only
self-appoint founding-administrator on a company you actually created; joining any other
company requires an existing admin to add you. Re-verified after the fix: stranger denied,
real creator allowed, admin-adds-member still works.

**How this was verified** (not just written): the real Firebase CLI + a real Firestore emulator
(local Java install was needed and added), with genuine HTTP requests —

- Unauthenticated read/write on `ros_companies_v1` → `403 PERMISSION_DENIED`, citing the exact
  rule line.
- A crafted (unsigned, emulator-only) auth token for a real member → `200`, correct data.
- The same for a non-member → `403`.
- The privilege-escalation attempt described above → `403` after the fix (`200`, i.e. broken,
  before it).
- A legitimate admin adding a new member → `200`.

`storage.rules` (new file) gates evidence file bytes the same way, via Storage's cross-service
`firestore.exists()` — confirmed to load without compile errors in the Storage emulator.
(One thing learned along the way: the Storage emulator's raw GCS-JSON-API upload endpoint
bypasses Storage rules entirely, mirroring real GCS behavior — that's expected, not a rules
bug; the Firebase Storage *SDK* path, which the client will actually use, does enforce rules.)

---

## 4. The one server-side piece: AI evidence review

Everything else here is a plain Firestore read/write from the client SDK, authorized by
`firestore.rules` — no backend round-trip needed. AI evidence review is the exception: it needs
`OPENAI_API_KEY`, which can never go to the client.

**`functions/main.py`** — a Python Cloud Function (2nd gen, `firebase-functions` SDK), callable
as `httpsCallable(functions, 'request_evidence_ai_review')({ evidenceId, reviewType, questionText })`.
Firebase verifies the caller's ID token before the function body runs (`req.auth.uid` is already
trustworthy). The function re-checks company membership itself (Admin SDK bypasses rules, so it
must enforce this explicitly), reads the file from Storage, runs the real analysis, and writes
the result to `ros_ai_reviews_v1` — the only path that collection can be written through, per
`firestore.rules`.

The analysis itself reuses the same engines the Postgres version used — `services/
risk_os_ai_review.py` orchestrating `extractor.py` (PDF/DOCX/XLSX/CSV text extraction),
`greenwashing_scanner.py` (claim/data extraction, contradiction flags, framework mapping —
already in production behind `/api/analyze-esg`), and `esg_framework_intelligence.py`
(per-framework coverage, integrity scoring). Every prompt is grounded in the document's own
extracted text and instructed to name gaps rather than infer.

**Known limitation, stated plainly:** Cloud Functions only package files inside `functions/`, so
`functions/services/*.py` are **copies** of `backend/services/*.py` (plus `knowledge_base.py`
and its FAISS index, a transitive dependency of `greenwashing_scanner.py` neither pass initially
accounted for). They will drift unless kept in sync by hand — a real cost of this architecture,
not hidden. A shared internal package (or a build step that copies at deploy time) is the fix,
not done here.

**Verified, not assumed:** `functions/` has its own venv on Python 3.12 (matching the declared
`python312` runtime in `firebase.json`), all dependencies install cleanly from
`requirements.txt` (including `faiss-cpu`/`numpy` for the knowledge-base RAG lookup, added after
the first import attempt surfaced the missing transitive dependency), and `main.py` imports
successfully end-to-end — every `firebase_functions`/`firebase_admin` API used
(`https_fn.on_call`, `CallableRequest`, `HttpsError`, `SecretParam`, `firestore.client()`,
`storage.bucket()`) is confirmed real via `pip show firebase_functions` (v0.6.0) and a
successful import, not guessed from memory.

---

## 5. Frontend integration — what's wired

**`risk-os-data.js`** (new) is the client data layer, following `community.js`'s exact
conventions: same `_fsImport`/`_firestore()` CDN-loading pattern, same dual-mode contract
(no-ops in local mode, real Firestore in Firebase mode — the live default). Unlike
`community.js`'s synchronous-cache-with-fallback getters, every export here is a real Promise or
subscription callback, since `climate-risk-os.html` already has an async init path.

`climate-risk-os.html` changes (`iroScript` stays a classic script — module scripts don't
auto-attach to `window`, which every `onclick="..."` handler needs, so `risk-os-data.js` is
imported from a small separate `<script type="module">` and exposed as `window.RiskOSData`,
same pattern the existing `window.CX_MEMBER` bootstrap already uses):

- `showEntityForm()` now looks up the caller's existing company (`findMyCompany()`) and
  pre-fills the form — revisiting doesn't create a duplicate company.
- `startAssessment()` calls `saveEntityAndGetAssessment()`, hydrates `STATE.answers` from
  Firestore (so resuming shows prior answers, including a collaborator's), and opens a live
  `subscribeAnswers()` subscription.
- `answer()` still updates `STATE.answers` + `localStorage` synchronously (unchanged — that's
  what renders the UI instantly), then fires `_syncAnswerToCloud()`: persists the answer +
  version history, recomputes C-LAYER scores with the existing client-side `calcCLayerScores()`,
  and persists those too.
- The realtime subscription callback merges remote changes into `STATE.answers` and re-renders
  the sidebar/section/rail if the assess screen is active — **this is the actual collaboration
  payoff**: two people on the same assessment see each other's answers appear live.
- `nextSection()` calls `markAssessmentSubmitted()` on reaching the report screen, walking the
  workflow state machine one legal step at a time (mirrors `rosTransitionAllowed()` in the rules).

**Verified against a real Firestore emulator**, not just written: seeded a company + a
`contributor` member + a draft assessment, then confirmed — as the real member — writing an
answer, a C-LAYER score, and an answer-version row all succeed (`200`); an outsider attempting
the same on the identical assessment is denied (`403`); the member can legally advance
`draft → in_progress`; an outsider attempting an illegal `draft → approved` jump is denied. Every
field name `risk-os-data.js` writes was cross-checked against what `firestore.rules` actually
reads for these collections before testing, after the `ros_members_v1` incident earlier made
clear that assuming the two agree isn't good enough.

## 6. Question Workspace — Evidence + Discussion (now wired)

Every question in the assessment screen now has a "Workspace" toggle (`renderQuestion()` in
`climate-risk-os.html`) that lazily expands into two live, Firestore/Storage-backed panels —
supporting evidence, never replacing the question's own answer, per the brief:

- **Evidence** — `handleEvidenceUpload()` uploads the file to Firebase Storage
  (`evidence/{companyId}/{assessmentId}/{fileId}_{filename}`, SHA-256 hashed client-side) and
  writes the `ros_evidence_v1` metadata row; `subscribeEvidence()` keeps the list live. Three AI
  actions per document (Summarize / Check contradictions / Map frameworks) call
  `requestAIReview()` → the `request_evidence_ai_review` Cloud Function → results stream back
  live via `subscribeAIReviews()`. This is the first real use of the Storage rules and Cloud
  Function built in the earlier phase.
- **Discussion** — threaded per-question comments (`ros_comments_v1`), post + resolve/reopen,
  live via `subscribeComments()`.

Subscriptions are torn down on every section change (`_teardownWorkspaceSubs()` in
`renderSection()`) so navigating the assessment doesn't accumulate open listeners.

**Verified against a real emulator**, using the exact document shapes the new code produces:
member can create an evidence record, outsider on the same assessment is denied; member can
post a comment as themselves, but is denied if the `authorId` field doesn't match their own uid
(spoofing another author is blocked); and — the one that matters most for AI review's
integrity — **a client directly writing to `ros_ai_reviews_v1` is denied even for a legitimate
member**, confirming only the Cloud Function's Admin SDK can produce AI review results, exactly
as designed.

## 7. What's still not wired

- **Tasks, risk notes, version history UI.** `ros_tasks_v1` and `ros_risk_notes_v1` have
  collections, security rules, and (for risk notes) role checks ready; `ros_answer_versions_v1`
  is already being written on every answer change. None of the three have a UI panel yet — the
  natural next slice, and structurally similar to the Discussion panel just built.
- **Assignment roles/notifications, confidence badges, framework-mapping panel, embedded
  document viewer, facilities/geospatial UI, financial materiality UI, search/filters,
  activity timeline, autosave status indicator.** None of these exist yet in the UI.
- **Deployed verification.** Everything has been verified locally against real emulators; an
  actual `firebase deploy` (rules + functions + hosting) needs `firebase login` and hasn't run.
- **Keeping `functions/services/*` in sync with `backend/services/*`** — still a manual
  duplication.
- **`ros_facilities_v1`-to-hazard-layer wiring** — the collection exists; joining it to
  `/api/climate-data` by lat/lng is a small next step, not yet built.
- **Question bank in Firestore** — Risk OS's 220 questions still live in
  `climate-risk-os.html`'s inline `QUESTIONS` array. Client-supplied `clayer`/`questionType` on
  answer writes is trusted, same caveat as the Postgres version had.
- **Detecting real-time remote changes while mid-edit on the same question** — the subscription
  merges cleanly between questions, but two people editing the identical field simultaneously
  will still last-write-wins (Firestore's default), not a conflict UI.

None of the above are faked in the meantime — they're simply absent, and everything that exists
does the real thing it claims to do.
