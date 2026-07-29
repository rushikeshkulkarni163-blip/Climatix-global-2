// ── Climactix Global · Risk OS Data Layer ───────────────────────────────────
// Firestore persistence for climate-risk-os.html — replaces the old
// localStorage['iro_answers_v4'] / ['iro_entity'] model with a real,
// shared, realtime-synced backend. Same dual-mode contract as community.js:
//
// LOCAL MODE  (firebase-config.js still has YOUR_* placeholders)
//   → every function here is a no-op; climate-risk-os.html's existing
//     localStorage read/write paths are untouched and keep working exactly
//     as before this file existed.
//
// FIREBASE MODE (real config — the live default, see firebase-config.js)
//   → companies/assessments/answers/clayer scores live in Firestore
//     (ros_*_v1 collections, see RISK_OS_COLLABORATION_ARCHITECTURE.md),
//     gated by firestore.rules. Answers are subscribed live via onSnapshot
//     so collaborators editing the same assessment see each other's
//     changes without a refresh.
//
// This module intentionally does NOT try to be synchronous like
// community.js's getters — Risk OS's caller (climate-risk-os.html) already
// has an async init path (it awaits the auth.js session before deciding
// CX_MEMBER), so every export here is a real Promise / subscription
// callback instead of an in-memory-cache-with-fallback.

'use strict';

import { firebaseConfig } from './firebase-config.js';
import { getSession } from './auth.js';

const _USE_FIREBASE = !firebaseConfig.apiKey.startsWith('YOUR_');
const _FS_APP_URL        = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
const _FS_FIRESTORE_URL  = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
const _FS_AUTH_URL       = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
const _FS_STORAGE_URL    = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
const _FS_FUNCTIONS_URL  = 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

function _fsImport(url, ms = 8000) {
  return Promise.race([
    import(url),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timed out loading ${url}`)), ms)),
  ]);
}

let _fsApiPromise = null;
function _firestore() {
  if (!_fsApiPromise) {
    _fsApiPromise = Promise.all([_fsImport(_FS_APP_URL), _fsImport(_FS_FIRESTORE_URL), _fsImport(_FS_AUTH_URL)])
      .then(async ([{ initializeApp, getApps }, fs, authFs]) => {
        const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
        const auth = authFs.getAuth(app);
        await Promise.race([
          new Promise(resolve => { const unsub = authFs.onAuthStateChanged(auth, () => { unsub(); resolve(); }); }),
          new Promise(resolve => setTimeout(resolve, 8000)),
        ]);
        return { app, db: fs.getFirestore(app), auth, ...fs };
      });
  }
  return _fsApiPromise;
}

let _storageApiPromise = null;
function _storage() {
  if (!_storageApiPromise) {
    _storageApiPromise = Promise.all([_firestore(), _fsImport(_FS_STORAGE_URL)])
      .then(([{ app }, st]) => ({ storage: st.getStorage(app), ...st }));
  }
  return _storageApiPromise;
}

let _functionsApiPromise = null;
function _functionsApi() {
  if (!_functionsApiPromise) {
    _functionsApiPromise = Promise.all([_firestore(), _fsImport(_FS_FUNCTIONS_URL)])
      .then(([{ app }, fn]) => ({ functions: fn.getFunctions(app), ...fn }));
  }
  return _functionsApiPromise;
}

function _uid() {
  const s = getSession();
  return s ? s.uid : null;
}

// ── Climactix internal/backend team check ────────────────────────────────
// The Evidence Intelligence Agent (analysis panel, entity-level rollup,
// analyst review actions) is a Backend-team-only tool — the entity being
// assessed must never see how its own evidence was scored (see
// firestore.rules' isClimactixStaff()). cx_staff_v1 is Admin-SDK-managed
// only; this is a read-only membership check, never a self-service toggle.
export async function checkClimactixStaff() {
  if (!_USE_FIREBASE) return false;
  const uid = _uid();
  if (!uid) return false;
  const { db, doc, getDoc } = await _firestore();
  try {
    const snap = await getDoc(doc(db, 'cx_staff_v1', uid));
    return snap.exists();
  } catch (e) {
    return false; // denied read (not staff) resolves here too — fail closed
  }
}

// ── Internal Analyst System — cross-company staff queries ────────────────
// Unlike every other subscribe*() in this file (all scoped to one already-
// known assessmentId/companyId), these are unfiltered collection-wide
// queries — only readable at all because firestore.rules grants
// isClimactixStaff() a bypass on these collections' isCompanyMember() checks
// (see cx-portal-dashboard.html, the Internal Analyst System's cross-
// company landing dashboard). A non-staff caller's listener just receives a
// permission-denied error, never partial/wrong data.

export function subscribeAllAssessmentsForStaff(onChange) {
  if (!_USE_FIREBASE) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, onSnapshot }) => {
    unsub = onSnapshot(
      collection(db, 'ros_assessments_v1'),
      snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('[risk-os-data] all-assessments (staff) subscription failed', err),
    );
  });
  return () => unsub();
}

export function subscribeAllCompaniesForStaff(onChange) {
  if (!_USE_FIREBASE) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, onSnapshot }) => {
    unsub = onSnapshot(
      collection(db, 'ros_companies_v1'),
      snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('[risk-os-data] all-companies (staff) subscription failed', err),
    );
  });
  return () => unsub();
}

// Entity-level Evidence Intelligence rollup for EVERY assessment at once —
// powers the dashboard's rating/greenwashing-risk distributions without
// recomputing anything client-side (every number here already comes from
// recompute_entity_intelligence, see functions/main.py).
export function subscribeAllEntityIntelligenceForStaff(onChange) {
  if (!_USE_FIREBASE) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, onSnapshot }) => {
    unsub = onSnapshot(
      collection(db, 'ros_entity_intelligence_v1'),
      snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('[risk-os-data] all-entity-intelligence (staff) subscription failed', err),
    );
  });
  return () => unsub();
}

// Real replacement for cx-internal.js's fake `ANALYSTS` localStorage array
// (Analyst Roster widget) — the actual cx_staff_v1 roster.
export function subscribeStaffRoster(onChange) {
  if (!_USE_FIREBASE) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, onSnapshot }) => {
    unsub = onSnapshot(
      collection(db, 'cx_staff_v1'),
      snap => onChange(snap.docs.map(d => ({ uid: d.id, ...d.data() }))),
      err => console.error('[risk-os-data] staff roster subscription failed', err),
    );
  });
  return () => unsub();
}

// Approve/Reject/Request Clarification in the Internal Analyst System move
// the assessment itself through the review-tier states of the status state
// machine (firestore.rules' rosTransitionAllowed()) — mirrors
// markAssessmentSubmitted()'s "walk one legal step at a time" discipline,
// just for the reviewer-side transitions instead of the company-side ones.
export async function updateAssessmentStatus(assessmentId, newStatus) {
  if (!_USE_FIREBASE || !assessmentId) return;
  const { db, doc, setDoc, serverTimestamp } = await _firestore();
  await setDoc(doc(db, 'ros_assessments_v1', assessmentId), {
    status: newStatus, updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ── Report Engine — generated report snapshots (ros_reports_v1) ──────────
// Append-only, same reasoning as saveDeclaration(): a saved report is a
// point-in-time record of what was true when generated, not a live view —
// re-generating produces a NEW doc/id rather than overwriting the old one.

export async function saveReportSnapshot(report) {
  if (!_USE_FIREBASE) return null;
  const uid = _uid();
  if (!uid) throw new Error('Not signed in.');
  const { db, collection, addDoc, serverTimestamp } = await _firestore();
  const docRef = await addDoc(collection(db, 'ros_reports_v1'), {
    ...report, generatedBy: uid, createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export function subscribeReport(reportId, onChange) {
  if (!_USE_FIREBASE || !reportId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, doc, onSnapshot }) => {
    unsub = onSnapshot(
      doc(db, 'ros_reports_v1', reportId),
      snap => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      err => console.error('[risk-os-data] report subscription failed', err),
    );
  });
  return () => unsub();
}

// ── Companies & membership ──────────────────────────────────────────────────

// Finds the caller's first active company membership. Returns
// { companyId, role, company } or null (new user, no company yet).
export async function findMyCompany() {
  if (!_USE_FIREBASE) return null;
  const uid = _uid();
  if (!uid) return null;
  const { db, collection, query, where, getDocs, doc, getDoc } = await _firestore();
  const q = query(collection(db, 'ros_members_v1'), where('userId', '==', uid), where('status', '==', 'active'));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const membership = snap.docs[0].data();
  const companySnap = await getDoc(doc(db, 'ros_companies_v1', membership.companyId));
  return {
    companyId: membership.companyId,
    role: membership.role,
    company: companySnap.exists() ? companySnap.data() : null,
  };
}

// Creates a new company (caller becomes administrator) or updates an
// existing one the caller already owns, then finds-or-creates a draft
// assessment for the given year. Returns { companyId, assessmentId }.
export async function saveEntityAndGetAssessment(entity, year, existingCompanyId) {
  if (!_USE_FIREBASE) return null;
  const uid = _uid();
  if (!uid) throw new Error('Not signed in.');
  const { db, doc, setDoc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } = await _firestore();

  const companyFields = {
    name: entity.name,
    sector: entity.sector,
    entityType: entity.entityType || null,
    hqCountry: entity.hq || null,
    jurisdictions: entity.jurisdiction ? entity.jurisdiction.split(',').map(s => s.trim()) : [],
    revenueBand: entity.revenue || null,
    employeeBand: entity.employees || null,
    countriesBand: entity.countries || null,
    ticker: entity.ticker || null,
  };

  let companyId = existingCompanyId;
  if (companyId) {
    await setDoc(doc(db, 'ros_companies_v1', companyId), { ...companyFields, updatedAt: serverTimestamp() }, { merge: true });
  } else {
    const companyRef = doc(collection(db, 'ros_companies_v1'));
    companyId = companyRef.id;
    await setDoc(companyRef, { ...companyFields, createdBy: uid, createdAt: serverTimestamp() });
    // Founding administrator — see firestore.rules ros_members_v1 create rule,
    // which verifies this against ros_companies_v1's own createdBy field.
    await setDoc(doc(db, 'ros_members_v1', `${companyId}_${uid}`), {
      companyId, userId: uid, role: 'administrator', department: null,
      status: 'active', createdAt: serverTimestamp(),
    });
  }

  const yearNum = parseInt(year, 10) || new Date().getFullYear();
  const existingQ = query(
    collection(db, 'ros_assessments_v1'),
    where('companyId', '==', companyId), where('year', '==', yearNum),
  );
  const existing = await getDocs(existingQ);
  const openAssessment = existing.docs.find(d => d.data().status !== 'archived');
  if (openAssessment) return { companyId, assessmentId: openAssessment.id };

  const assessmentRef = await addDoc(collection(db, 'ros_assessments_v1'), {
    companyId, ownerId: uid, year: yearNum, status: 'draft',
    overallScore: null, rating: null, greenwashingProbability: null,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return { companyId, assessmentId: assessmentRef.id };
}

// ── Answers ──────────────────────────────────────────────────────────────────

// One-time read of every answer for an assessment — used to hydrate STATE on
// load/resume. Returns { [questionId]: rawValue }.
export async function loadAnswers(assessmentId) {
  if (!_USE_FIREBASE || !assessmentId) return {};
  const { db, collection, query, where, getDocs } = await _firestore();
  const snap = await getDocs(query(collection(db, 'ros_answers_v1'), where('assessmentId', '==', assessmentId)));
  const out = {};
  snap.forEach(d => { const a = d.data(); out[a.questionId] = a.rawAnswer; });
  return out;
}

// Live subscription — fires with the same shape as loadAnswers() every time
// ANY collaborator changes an answer on this assessment, including the
// caller's own writes echoing back. Returns an unsubscribe function.
export function subscribeAnswers(assessmentId, onChange) {
  if (!_USE_FIREBASE || !assessmentId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, query, where, onSnapshot }) => {
    unsub = onSnapshot(
      query(collection(db, 'ros_answers_v1'), where('assessmentId', '==', assessmentId)),
      snap => {
        const out = {};
        snap.forEach(d => { const a = d.data(); out[a.questionId] = a.rawAnswer; });
        onChange(out);
      },
      err => console.error('[risk-os-data] answers subscription failed', err),
    );
  });
  return () => unsub();
}

// Separate from subscribeAnswers() above (which only surfaces rawAnswer,
// the DECLARED value) so a caller can tell Declared apart from Assessed
// without the two ever being conflated into one field. Keyed by questionId
// -> {assessedStatus, assessedConfidence, assessedBasis, assessedAt} |
// undefined (undefined = no human has accepted a recommendation yet).
export function subscribeAssessedStatuses(assessmentId, onChange) {
  if (!_USE_FIREBASE || !assessmentId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, query, where, onSnapshot }) => {
    unsub = onSnapshot(
      query(collection(db, 'ros_answers_v1'), where('assessmentId', '==', assessmentId)),
      snap => {
        const out = {};
        snap.forEach(d => {
          const a = d.data();
          if (a.assessedStatus) {
            out[a.questionId] = {
              assessedStatus: a.assessedStatus, assessedConfidence: a.assessedConfidence,
              assessedBasis: a.assessedBasis, assessedAt: a.assessedAt,
            };
          }
        });
        onChange(out);
      },
      err => console.error('[risk-os-data] assessed-status subscription failed', err),
    );
  });
  return () => unsub();
}

// ── Facility link per question (spec §7) ──────────────────────────────────
// Stored on the same ros_answers_v1 doc as the declared answer (doc id
// `${assessmentId}_${questionId}`) rather than only in client STATE — a
// server-side auto-trigger (onEvidenceCreated, functions/main.py) has no
// live client to source a facilityId from, so the link must be persisted,
// not just held in memory. Also fixes linkFacilityToQuestion() silently
// resetting on every page reload.
export async function saveFacilityLink(assessmentId, questionId, facilityId) {
  if (!_USE_FIREBASE || !assessmentId) return;
  const uid = _uid();
  if (!uid) return;
  const { db, doc, setDoc, serverTimestamp } = await _firestore();
  await setDoc(doc(db, 'ros_answers_v1', `${assessmentId}_${questionId}`), {
    assessmentId, questionId, facilityId: facilityId || null, updatedAt: serverTimestamp(),
  }, { merge: true });
}

export function subscribeFacilityLinks(assessmentId, onChange) {
  if (!_USE_FIREBASE || !assessmentId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, query, where, onSnapshot }) => {
    unsub = onSnapshot(
      query(collection(db, 'ros_answers_v1'), where('assessmentId', '==', assessmentId)),
      snap => {
        const out = {};
        snap.forEach(d => { const a = d.data(); if (a.facilityId) out[a.questionId] = a.facilityId; });
        onChange(out);
      },
      err => console.error('[risk-os-data] facility-link subscription failed', err),
    );
  });
  return () => unsub();
}

// ── Generic Management Response / Supporting Narrative ───────────────────
// For every NON-select5 question type (yesno/dropdown/number/text/upload).
// select5 questions already carry their write-up inside rawAnswer.justification
// via saveAnswer() above — this is the parallel field for every other type,
// stored on the same ros_answers_v1 doc so a question's declared answer and
// its narrative always live together. assessmentId/questionId are written
// explicitly on every call (not left to merge from a prior saveAnswer) so a
// narrative typed before the structured answer is ever saved still shows up
// in assessmentId-scoped queries.
export async function saveNarrative(assessmentId, questionId, text) {
  if (!_USE_FIREBASE || !assessmentId) return;
  const uid = _uid();
  if (!uid) return;
  const { db, doc, setDoc, serverTimestamp } = await _firestore();
  await setDoc(doc(db, 'ros_answers_v1', `${assessmentId}_${questionId}`), {
    assessmentId, questionId, narrative: text,
    narrativeSavedAt: serverTimestamp(), narrativeSavedBy: uid,
  }, { merge: true });
}

export function subscribeNarratives(assessmentId, onChange) {
  if (!_USE_FIREBASE || !assessmentId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, query, where, onSnapshot }) => {
    unsub = onSnapshot(
      query(collection(db, 'ros_answers_v1'), where('assessmentId', '==', assessmentId)),
      snap => {
        const out = {};
        snap.forEach(d => {
          const a = d.data();
          if (a.narrative) out[a.questionId] = a.narrative;
        });
        onChange(out);
      },
      err => console.error('[risk-os-data] narratives subscription failed', err),
    );
  });
  return () => unsub();
}

// Upserts one answer + appends a version-history row. Fire-and-forget from
// the caller's perspective (climate-risk-os.html keeps STATE.answers as the
// source of truth for rendering; this just persists it).
export async function saveAnswer(assessmentId, questionId, { sectionId, clayer, questionType, rawAnswer, scoredValue }) {
  if (!_USE_FIREBASE || !assessmentId) return;
  const uid = _uid();
  if (!uid) return;
  const { db, doc, getDoc, setDoc, collection, addDoc, serverTimestamp } = await _firestore();
  const answerId = `${assessmentId}_${questionId}`;
  const ref = doc(db, 'ros_answers_v1', answerId);
  const prior = await getDoc(ref);
  const previousValue = prior.exists() ? prior.data().rawAnswer : null;

  await setDoc(ref, {
    assessmentId, questionId, sectionId: sectionId || null, clayer, questionType,
    rawAnswer, scoredValue: scoredValue ?? null, answeredBy: uid,
    answeredAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }, { merge: true });

  if (JSON.stringify(previousValue) !== JSON.stringify(rawAnswer)) {
    await addDoc(collection(db, 'ros_answer_versions_v1'), {
      answerId, assessmentId, questionId, previousValue, newValue: rawAnswer,
      changedBy: uid, createdAt: serverTimestamp(),
    });
  }
}

// ── C-LAYER scores ───────────────────────────────────────────────────────────

// Persists the already-computed (client-side) pillar scores so other
// collaborators' rails/reports reflect the latest state without
// recomputing locally. scores: [{ clayerId, weight, rawScore, climactixScore,
// questionsTotal, questionsAnswered }], composite: number|null.
export async function saveClayerScores(assessmentId, scores, composite, rating) {
  if (!_USE_FIREBASE || !assessmentId) return;
  const { db, doc, setDoc, serverTimestamp, writeBatch } = await _firestore();
  const batch = writeBatch(db);
  scores.forEach(s => {
    batch.set(doc(db, 'ros_clayer_scores_v1', `${assessmentId}_${s.clayerId}`), {
      assessmentId, clayerId: s.clayerId, weight: s.weight, rawScore: s.rawScore,
      climactixScore: s.climactixScore, questionsTotal: s.questionsTotal,
      questionsAnswered: s.questionsAnswered, calculatedAt: serverTimestamp(),
    });
  });
  batch.set(doc(db, 'ros_assessments_v1', assessmentId), {
    overallScore: composite ?? null, rating: rating ?? null, updatedAt: serverTimestamp(),
  }, { merge: true });
  await batch.commit();
}

// All 8 C-LAYER pillar scores for one assessment at once — used by the
// Internal Analyst System's review workspace (Overview tab's C-LAYER grid),
// which needs every pillar simultaneously rather than climate-risk-os.html's
// own per-question rendering path.
export function subscribeClayerScores(assessmentId, onChange) {
  if (!_USE_FIREBASE || !assessmentId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, query, where, onSnapshot }) => {
    unsub = onSnapshot(
      query(collection(db, 'ros_clayer_scores_v1'), where('assessmentId', '==', assessmentId)),
      snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('[risk-os-data] clayer scores subscription failed', err),
    );
  });
  return () => unsub();
}

// ── Assessment status (submit) ────────────────────────────────────────────────

export async function markAssessmentSubmitted(assessmentId) {
  if (!_USE_FIREBASE || !assessmentId) return;
  const uid = _uid();
  const { db, doc, getDoc, setDoc, serverTimestamp } = await _firestore();
  const ref = doc(db, 'ros_assessments_v1', assessmentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const status = snap.data().status;
  // Walk the state machine one legal step at a time rather than jumping —
  // mirrors firestore.rules' rosTransitionAllowed().
  const next = status === 'draft' ? 'in_progress' : status === 'in_progress' ? 'submitted' : null;
  if (!next) return;
  await setDoc(ref, { status: next, updatedAt: serverTimestamp(),
    ...(next === 'submitted' ? { submittedAt: serverTimestamp(), submittedBy: uid } : {}) }, { merge: true });
}

// ── Evidence ─────────────────────────────────────────────────────────────────
// File bytes go to Firebase Storage at evidence/{companyId}/{assessmentId}/
// {fileId}_{filename} (see storage.rules); this writes the matching
// ros_evidence_v1 metadata row. Supporting evidence, not a substitute for
// the question's own answer.

export async function uploadEvidence(companyId, assessmentId, questionId, file, meta = {}) {
  if (!_USE_FIREBASE) return null;
  const uid = _uid();
  if (!uid) throw new Error('Not signed in.');
  if (file.size > 20 * 1024 * 1024) throw new Error('File exceeds 20 MB limit.');

  const [{ db, doc, collection, addDoc, serverTimestamp }, { storage, ref, uploadBytes }] =
    await Promise.all([_firestore(), _storage()]);

  const fileId = doc(collection(db, 'ros_evidence_v1')).id;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `evidence/${companyId}/${assessmentId}/${fileId}_${safeName}`;
  await uploadBytes(ref(storage, storagePath), file, { contentType: file.type || 'application/octet-stream' });

  const sha256Hash = await _sha256(file);
  const docRef = await addDoc(collection(db, 'ros_evidence_v1'), {
    companyId, assessmentId, questionId, uploadedBy: uid,
    filename: safeName, originalName: file.name, fileType: file.type || null,
    fileSizeBytes: file.size, storagePath, sha256Hash,
    documentCategory: meta.documentCategory || null, description: meta.description || null,
    confidentialityLevel: meta.confidentialityLevel || 'internal',
    // Richer institutional evidence metadata (spec §4): reporting period,
    // issuing authority, and page/section reference for citing a specific
    // passage in a large document rather than the document as a whole.
    reportingPeriod: meta.reportingPeriod || null,
    issuingAuthority: meta.issuingAuthority || null,
    pageReference: meta.pageReference || null,
    reviewStatus: 'self-reported', version: 1, tags: meta.tags || [],
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

// Reviewer action: moves a piece of evidence through the 6-state verification
// lifecycle (self-reported/pending -> verified/partially-verified/unverified/
// contradictory/expired). firestore.rules already restricts this update to
// rosReviewRoles() and to exactly these fields — no rules change needed.
export async function setEvidenceReviewStatus(evidenceId, reviewStatus, note = null) {
  if (!_USE_FIREBASE || !evidenceId) return;
  const uid = _uid();
  if (!uid) throw new Error('Not signed in.');
  const { db, doc, setDoc, serverTimestamp } = await _firestore();
  await setDoc(doc(db, 'ros_evidence_v1', evidenceId), {
    reviewStatus, verifiedBy: uid, verifiedAt: serverTimestamp(),
    ...(note ? { description: note } : {}),
  }, { merge: true });
}

// Web-source evidence (spec §1/§12: website URLs, regulatory filing pages,
// etc.) — same ros_evidence_v1 collection as file uploads, distinguished by
// sourceType:'url' and no storagePath/sha256Hash. Extraction happens
// server-side per analysis run (see functions/main.py's
// run_evidence_intelligence_analysis, services/extractor.py's
// extract_from_url) rather than at add-time, so the page is re-fetched
// fresh each time the Evidence Intelligence Agent runs instead of trusting
// a possibly-stale snapshot taken once at upload time.
export async function addWebSourceEvidence(companyId, assessmentId, questionId, url, meta = {}) {
  if (!_USE_FIREBASE) return null;
  const uid = _uid();
  if (!uid) throw new Error('Not signed in.');
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('Enter a valid URL, including https://'); }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Only http(s) URLs are supported.');

  const { db, collection, addDoc, serverTimestamp } = await _firestore();
  const docRef = await addDoc(collection(db, 'ros_evidence_v1'), {
    companyId, assessmentId, questionId, uploadedBy: uid,
    sourceType: 'url', sourceUrl: parsed.toString(),
    filename: parsed.hostname + parsed.pathname, originalName: parsed.toString(),
    fileType: 'text/html', fileSizeBytes: null, storagePath: null, sha256Hash: null,
    documentCategory: meta.documentCategory || 'URL / External Reference',
    description: meta.description || null, confidentialityLevel: meta.confidentialityLevel || 'internal',
    reportingPeriod: meta.reportingPeriod || null, issuingAuthority: meta.issuingAuthority || null,
    pageReference: meta.pageReference || null,
    reviewStatus: 'self-reported', version: 1, tags: meta.tags || [],
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

// Assessment-wide evidence stream (all questions at once) — used to compute
// evidence-weighted confidence across the full question bank without waiting
// for each question's Workspace panel to be individually expanded.
export function subscribeAllEvidence(assessmentId, onChange) {
  if (!_USE_FIREBASE || !assessmentId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, query, where, onSnapshot }) => {
    unsub = onSnapshot(
      query(collection(db, 'ros_evidence_v1'), where('assessmentId', '==', assessmentId)),
      snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('[risk-os-data] all-evidence subscription failed', err),
    );
  });
  return () => unsub();
}

async function _sha256(file) {
  try {
    const buf = await file.arrayBuffer();
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch { return null; } // e.g. non-HTTPS localhost without SubtleCrypto — non-fatal
}

// Live list of evidence attached to one question. Returns an unsubscribe fn.
export function subscribeEvidence(assessmentId, questionId, onChange) {
  if (!_USE_FIREBASE || !assessmentId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, query, where, orderBy, onSnapshot }) => {
    unsub = onSnapshot(
      query(collection(db, 'ros_evidence_v1'),
        where('assessmentId', '==', assessmentId), where('questionId', '==', questionId)),
      snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0))),
      err => console.error('[risk-os-data] evidence subscription failed', err),
    );
  });
  return () => unsub();
}

// ── AI evidence review ────────────────────────────────────────────────────────
// The only write path to ros_ai_reviews_v1 is the Cloud Function itself
// (firestore.rules denies client writes) — this just invokes it and
// subscribes to the results it writes back.

export async function requestAIReview(evidenceId, reviewType, questionText = '') {
  if (!_USE_FIREBASE) return null;
  const { functions, httpsCallable } = await _functionsApi();
  const call = httpsCallable(functions, 'request_evidence_ai_review');
  const result = await call({ evidenceId, reviewType, questionText });
  return result.data;
}

export function subscribeAIReviews(evidenceId, onChange) {
  if (!_USE_FIREBASE || !evidenceId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, query, where, onSnapshot }) => {
    unsub = onSnapshot(
      query(collection(db, 'ros_ai_reviews_v1'), where('evidenceId', '==', evidenceId)),
      snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0))),
      err => console.error('[risk-os-data] AI review subscription failed', err),
    );
  });
  return () => unsub();
}

// Assessment-wide AI review stream (mirrors subscribeAllEvidence) — used to
// power the Question Intelligence drawer's per-question review history and
// the compact action bar's "Confidence: N%" badge without waiting for each
// question's Workspace panel to be individually expanded first.
export function subscribeAllAIReviews(assessmentId, onChange) {
  if (!_USE_FIREBASE || !assessmentId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, query, where, onSnapshot }) => {
    unsub = onSnapshot(
      query(collection(db, 'ros_ai_reviews_v1'), where('assessmentId', '==', assessmentId)),
      snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('[risk-os-data] all-AI-reviews subscription failed', err),
    );
  });
  return () => unsub();
}

// ── Climactix Evidence Intelligence Agent ───────────────────────────────────
// The full evidence-verification pipeline (functions/services/evidence_
// intelligence_agent.py) — distinct from requestAIReview() above, which
// runs ONE review type against ONE evidence file. This runs every review
// type against EVERY evidence item attached to the question (plus any
// linked facility) in one pass, and writes ros_claims_v1 +
// ros_evidence_confidence_v1 (both Cloud-Function-only writes — see
// firestore.rules) in addition to the usual ros_ai_reviews_v1 entry.

export async function runEvidenceIntelligenceAnalysis(assessmentId, questionId, questionText = '', facilityId = null) {
  if (!_USE_FIREBASE) return null;
  const { functions, httpsCallable } = await _functionsApi();
  const call = httpsCallable(functions, 'run_evidence_intelligence_analysis');
  const result = await call({ assessmentId, questionId, questionText, facilityId: facilityId || null });
  return result.data;
}

// Extracted claims + metrics for one question (ros_claims_v1 — one doc per
// claim/metric, distinguished by `kind`).
export function subscribeClaims(assessmentId, questionId, onChange) {
  if (!_USE_FIREBASE || !assessmentId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, query, where, onSnapshot }) => {
    unsub = onSnapshot(
      query(collection(db, 'ros_claims_v1'),
        where('assessmentId', '==', assessmentId), where('questionId', '==', questionId)),
      snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('[risk-os-data] claims subscription failed', err),
    );
  });
  return () => unsub();
}

// Every claim/metric across the WHOLE assessment at once (no questionId
// filter) — used by the Internal Analyst System's review workspace for its
// assessment-wide "Quantitative Data Points" view, where subscribing
// per-question (as subscribeClaims() above does) would mean opening one
// listener per question — impractical at 200+ questions.
export function subscribeAllClaimsForAssessment(assessmentId, onChange) {
  if (!_USE_FIREBASE || !assessmentId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, query, where, onSnapshot }) => {
    unsub = onSnapshot(
      query(collection(db, 'ros_claims_v1'), where('assessmentId', '==', assessmentId)),
      snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('[risk-os-data] all-claims subscription failed', err),
    );
  });
  return () => unsub();
}

// Evidence Confidence Score + full breakdown for one question — doc id
// `${assessmentId}_${questionId}`, written only by run_evidence_intelligence_
// analysis (functions/main.py).
export function subscribeEvidenceConfidence(assessmentId, questionId, onChange) {
  if (!_USE_FIREBASE || !assessmentId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, doc, onSnapshot }) => {
    unsub = onSnapshot(
      doc(db, 'ros_evidence_confidence_v1', `${assessmentId}_${questionId}`),
      snap => onChange(snap.exists() ? snap.data() : null),
      err => console.error('[risk-os-data] evidence confidence subscription failed', err),
    );
  });
  return () => unsub();
}

// Entity-level Evidence Intelligence rollup — doc id == assessmentId,
// recomputed by the recompute_entity_intelligence Cloud Function trigger
// every time a question's ros_evidence_confidence_v1 doc is written.
export function subscribeEntityIntelligence(assessmentId, onChange) {
  if (!_USE_FIREBASE || !assessmentId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, doc, onSnapshot }) => {
    unsub = onSnapshot(
      doc(db, 'ros_entity_intelligence_v1', assessmentId),
      snap => onChange(snap.exists() ? snap.data() : null),
      err => console.error('[risk-os-data] entity intelligence subscription failed', err),
    );
  });
  return () => unsub();
}

// ── Facilities — geospatial anchors for location-dependent claims (spec §7) ──
// ros_facilities_v1 already exists in firestore.rules (company-member read,
// rosWriteRoles create/update) but had no client-side wiring until now.
// Mirrors saveEntity()/subscribeEntities()'s pattern exactly.

export function subscribeFacilities(companyId, onChange) {
  if (!_USE_FIREBASE || !companyId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, query, where, onSnapshot }) => {
    unsub = onSnapshot(
      query(collection(db, 'ros_facilities_v1'), where('companyId', '==', companyId)),
      snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('[risk-os-data] facilities subscription failed', err),
    );
  });
  return () => unsub();
}

// facility: { name, country, stateDistrict, latitude, longitude, area,
//             areaUnit, assetIdentifier }. Pass an existing facilityId to
// update that node, omit it to create a new one.
export async function saveFacility(companyId, facility, facilityId = null) {
  if (!_USE_FIREBASE) return null;
  const uid = _uid();
  if (!uid) throw new Error('Not signed in.');
  const { db, doc, collection, setDoc, serverTimestamp } = await _firestore();
  const ref = facilityId ? doc(db, 'ros_facilities_v1', facilityId) : doc(collection(db, 'ros_facilities_v1'));
  await setDoc(ref, {
    companyId,
    name: facility.name || null,
    country: facility.country || null,
    stateDistrict: facility.stateDistrict || null,
    latitude: facility.latitude ?? null,
    longitude: facility.longitude ?? null,
    area: facility.area ?? null,
    areaUnit: facility.areaUnit || null,
    assetIdentifier: facility.assetIdentifier || null,
    ...(facilityId ? { updatedAt: serverTimestamp() } : { createdBy: uid, createdAt: serverTimestamp() }),
  }, { merge: true });
  return ref.id;
}

// ── Comments / internal discussion ──────────────────────────────────────────

export function subscribeComments(assessmentId, questionId, onChange) {
  if (!_USE_FIREBASE || !assessmentId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, query, where, onSnapshot }) => {
    unsub = onSnapshot(
      query(collection(db, 'ros_comments_v1'),
        where('assessmentId', '==', assessmentId), where('questionId', '==', questionId)),
      snap => onChange(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(c => !c.deletedAt)
          .sort((a, b) => (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0))
      ),
      err => console.error('[risk-os-data] comments subscription failed', err),
    );
  });
  return () => unsub();
}

export async function addComment(assessmentId, questionId, body, parentCommentId = null) {
  if (!_USE_FIREBASE) return null;
  const uid = _uid();
  if (!uid) throw new Error('Not signed in.');
  const { db, collection, addDoc, serverTimestamp } = await _firestore();
  const docRef = await addDoc(collection(db, 'ros_comments_v1'), {
    assessmentId, questionId, parentCommentId, authorId: uid, body,
    mentions: [], pinned: false, resolved: false,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function resolveComment(commentId, resolved = true) {
  if (!_USE_FIREBASE) return;
  const uid = _uid();
  const { db, doc, setDoc, serverTimestamp } = await _firestore();
  await setDoc(doc(db, 'ros_comments_v1', commentId), {
    resolved, resolvedBy: resolved ? uid : null, resolvedAt: resolved ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ── Methodology version ─────────────────────────────────────────────────
// Reference data, Admin-SDK/seed-script only (see firestore.rules and
// scripts/seed-questions-firestore.js). Returns null in local mode or if
// no version has been seeded/activated yet — callers should treat that as
// "methodology version unknown", not fall back to inventing one.

export async function getActiveMethodologyVersion() {
  if (!_USE_FIREBASE) return null;
  const { db, collection, query, where, limit, getDocs } = await _firestore();
  const q = query(collection(db, 'ros_methodology_versions_v1'), where('status', '==', 'active'), limit(1));
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// ── Question bank ────────────────────────────────────────────────────────
// Reference data, Admin-SDK/seed-script only. climate-risk-os.html's inline
// TYPED_QUESTIONS/BASE_QUESTIONS stay the local-mode fallback and the seed
// source of truth (see scripts/seed-questions-firestore.js) — this just
// lets every signed-in member see the SAME question bank the server holds,
// a prerequisite for materiality-gated/mandate-driven question selection.
// Returns [] (never throws) so callers can safely keep the inline fallback
// on any failure instead of rendering a blank assessment.

export async function loadQuestionBank() {
  if (!_USE_FIREBASE) return [];
  try {
    const { db, collection, getDocs } = await _firestore();
    const snap = await getDocs(collection(db, 'ros_questions_v1'));
    return snap.docs.map(d => d.data());
  } catch (e) {
    console.error('[risk-os-data] loadQuestionBank failed, keeping local question bank', e);
    return [];
  }
}

// ── Assessment Mandate ───────────────────────────────────────────────────
// Purpose/analyst/methodology fields live on the same ros_assessments_v1
// document (firestore.rules already permits this: any field may change as
// long as status doesn't, for a write-role member) — no new collection.
// assignedAnalyst/assignedSeniorReviewer are populated by the analyst
// portal rebuild (not this pass); left null until then.

export async function saveMandate(assessmentId, mandate) {
  if (!_USE_FIREBASE || !assessmentId) return;
  const { db, doc, setDoc, serverTimestamp } = await _firestore();
  await setDoc(doc(db, 'ros_assessments_v1', assessmentId), {
    purpose: mandate.purpose || null,
    requestedBy: mandate.requestedBy || null,
    decisionContext: mandate.decisionContext || null,
    methodologyVersion: mandate.methodologyVersion || null,
    benchmarkVersion: mandate.benchmarkVersion || null,
    scenarioSet: mandate.scenarioSet || null,
    assignedAnalyst: mandate.assignedAnalyst || null,
    assignedSeniorReviewer: mandate.assignedSeniorReviewer || null,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ── Entities — legal entity / organizational boundary tree ──────────────
// ancestryPath and effectiveOwnershipFromRoot are computed server-side by
// the onRosEntityWritten Cloud Function trigger (functions/main.py) — never
// set them here; firestore.rules denies client writes to those two fields
// outright.

export function subscribeEntities(companyId, onChange) {
  if (!_USE_FIREBASE || !companyId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, query, where, onSnapshot }) => {
    unsub = onSnapshot(
      query(collection(db, 'ros_entities_v1'), where('companyId', '==', companyId)),
      snap => onChange(
        snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.status !== 'inactive')
      ),
      err => console.error('[risk-os-data] entities subscription failed', err),
    );
  });
  return () => unsub();
}

// entity: { name, parentEntityId, legalEntityType, ownershipPct, votingControlPct,
//           controlBasis, boundaryInclusion, consolidationMethod }. Pass an
// existing entityId to update that node, omit it to create a new one.
export async function saveEntity(companyId, entity, entityId = null) {
  if (!_USE_FIREBASE) return null;
  const uid = _uid();
  if (!uid) throw new Error('Not signed in.');
  const { db, doc, collection, setDoc, serverTimestamp } = await _firestore();
  const ref = entityId ? doc(db, 'ros_entities_v1', entityId) : doc(collection(db, 'ros_entities_v1'));
  await setDoc(ref, {
    companyId,
    parentEntityId: entity.parentEntityId || null,
    name: entity.name,
    legalEntityType: entity.legalEntityType || null,
    ownershipPct: entity.ownershipPct ?? null,
    votingControlPct: entity.votingControlPct ?? null,
    controlBasis: entity.controlBasis || null,
    boundaryInclusion: entity.boundaryInclusion
      || { operational: true, financial: true, equityShare: true, reporting: true },
    consolidationMethod: entity.consolidationMethod || null,
    status: 'active',
    ...(entityId ? { updatedAt: serverTimestamp() } : { createdBy: uid, createdAt: serverTimestamp() }),
  }, { merge: true });
  return ref.id;
}

// ── Initial Materiality Scan ─────────────────────────────────────────────
// Written only by the runMaterialityScan Cloud Function (functions/main.py)
// — firestore.rules denies client writes to ros_materiality_scans_v1
// entirely, the same discipline as ros_ai_reviews_v1.

export async function runMaterialityScan(companyId, assessmentId) {
  if (!_USE_FIREBASE) return null;
  const { functions, httpsCallable } = await _functionsApi();
  const call = httpsCallable(functions, 'run_materiality_scan');
  const result = await call({ companyId, assessmentId });
  return result.data;
}

export function subscribeMaterialityScan(assessmentId, onChange) {
  if (!_USE_FIREBASE || !assessmentId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, doc, onSnapshot }) => {
    unsub = onSnapshot(
      doc(db, 'ros_materiality_scans_v1', assessmentId),
      snap => onChange(snap.exists() ? snap.data() : null),
      err => console.error('[risk-os-data] materiality scan subscription failed', err),
    );
  });
  return () => unsub();
}

// ── Financial materiality (spec §10) ──────────────────────────────────────
// One doc per {assessmentId}_{questionId}: revenue/EBITDA/asset exposure,
// expected loss, capex/opex, insurance/carbon/financing cost deltas.

export async function saveFinancialMateriality(assessmentId, questionId, sectionId, data) {
  if (!_USE_FIREBASE || !assessmentId) return;
  const uid = _uid();
  if (!uid) return;
  const { db, doc, setDoc, serverTimestamp } = await _firestore();
  await setDoc(doc(db, 'ros_financial_materiality_v1', `${assessmentId}_${questionId}`), {
    assessmentId, questionId, sectionId: sectionId || null,
    revenueExposureUSD: data.revenueExposureUSD ?? null,
    ebitdaExposureUSD: data.ebitdaExposureUSD ?? null,
    assetValueExposedUSD: data.assetValueExposedUSD ?? null,
    expectedLossUSD: data.expectedLossUSD ?? null,
    capexUSD: data.capexUSD ?? null,
    opexUSD: data.opexUSD ?? null,
    insuranceCostDeltaUSD: data.insuranceCostDeltaUSD ?? null,
    carbonCostUSD: data.carbonCostUSD ?? null,
    financingCostDeltaUSD: data.financingCostDeltaUSD ?? null,
    timeHorizon: data.timeHorizon || null,
    updatedBy: uid, updatedAt: serverTimestamp(),
  }, { merge: true });
}

export function subscribeFinancialMateriality(assessmentId, onChange) {
  if (!_USE_FIREBASE || !assessmentId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, query, where, onSnapshot }) => {
    unsub = onSnapshot(
      query(collection(db, 'ros_financial_materiality_v1'), where('assessmentId', '==', assessmentId)),
      snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('[risk-os-data] financial materiality subscription failed', err),
    );
  });
  return () => unsub();
}

// ── Risk gap notes (spec §3, "NOT ADDRESSED" answers) ────────────────────
// Mirrors the answer-local gap fields into a first-class, trackable risk
// item so gaps surface across the whole assessment, not just on one card.

export async function saveRiskNote(assessmentId, questionId, note) {
  if (!_USE_FIREBASE || !assessmentId) return;
  const uid = _uid();
  if (!uid) return;
  const { db, doc, collection, setDoc, serverTimestamp } = await _firestore();
  const ref = doc(collection(db, 'ros_risk_notes_v1'), `${assessmentId}_${questionId}`);
  await setDoc(ref, {
    assessmentId, questionId, sourceQuestionId: questionId, noteType: note.noteType || 'gap',
    reasonCode: note.reasonCode || null, barrier: note.barrier || null,
    managementAssessed: note.managementAssessed || null, targetTimeline: note.targetTimeline || null,
    likelihood: note.likelihood ?? null, impact: note.impact ?? null,
    updatedBy: uid, updatedAt: serverTimestamp(),
  }, { merge: true });
}

export function subscribeRiskNotes(assessmentId, onChange) {
  if (!_USE_FIREBASE || !assessmentId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, query, where, onSnapshot }) => {
    unsub = onSnapshot(
      query(collection(db, 'ros_risk_notes_v1'), where('assessmentId', '==', assessmentId)),
      snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('[risk-os-data] risk notes subscription failed', err),
    );
  });
  return () => unsub();
}

// ── Review actions (spec §6: flag for review / request additional info) ──
// Create-only / immutable per firestore.rules — "closing" a review action is
// a new action document (actionType:'close'), not a mutation of the old one.

// actionType is one of: flag_for_review | request_evidence | accept_agent_finding |
// reject_agent_finding | request_more_evidence | override_score (spec §13).
// `extra` carries override_score's before/after values ({scoreBefore, scoreAfter})
// — additive, existing actionTypes/callers are unaffected by the new param.
// override_score REQUIRES a non-empty reason: this is checked here (defense-
// in-depth) on top of firestore.rules' reviewer-role requirement, since rules
// can restrict WHO writes but not enforce a non-empty string's semantic
// meaning as "a real reason."
export async function createReviewAction(assessmentId, questionId, actionType, note = null, extra = null) {
  if (!_USE_FIREBASE || !assessmentId) return;
  if (actionType === 'override_score' && (!note || !note.trim())) {
    throw new Error('A reason is required to override the agent-recommended score.');
  }
  const uid = _uid();
  if (!uid) throw new Error('Not signed in.');
  const { db, collection, addDoc, serverTimestamp } = await _firestore();
  await addDoc(collection(db, 'ros_review_actions_v1'), {
    assessmentId, questionId: questionId || null, actionType, note: note || null,
    ...(extra && typeof extra.scoreBefore !== 'undefined' ? { scoreBefore: extra.scoreBefore } : {}),
    ...(extra && typeof extra.scoreAfter !== 'undefined' ? { scoreAfter: extra.scoreAfter } : {}),
    reviewerId: uid, createdAt: serverTimestamp(),
  });
}

export function subscribeReviewActions(assessmentId, onChange) {
  if (!_USE_FIREBASE || !assessmentId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, query, where, onSnapshot }) => {
    unsub = onSnapshot(
      query(collection(db, 'ros_review_actions_v1'), where('assessmentId', '==', assessmentId)),
      snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0))),
      err => console.error('[risk-os-data] review actions subscription failed', err),
    );
  });
  return () => unsub();
}

// ── Assessor Notes (spec §6) ──────────────────────────────────────────────
// Private, reviewer-only — the one collection genuinely new to this schema
// (see firestore.rules: ros_comments_v1 is visible to all company members
// by design, so private analyst notes can't live there or on the answer doc
// itself, since Firestore rules can't redact one field of a doc by role).

export async function saveAssessorNote(assessmentId, questionId, body) {
  if (!_USE_FIREBASE || !assessmentId) return;
  const uid = _uid();
  if (!uid) throw new Error('Not signed in.');
  const { db, collection, addDoc, serverTimestamp } = await _firestore();
  await addDoc(collection(db, 'ros_assessor_notes_v1'), {
    assessmentId, questionId, authorId: uid, body, createdAt: serverTimestamp(),
  });
}

export function subscribeAssessorNotes(assessmentId, questionId, onChange) {
  if (!_USE_FIREBASE || !assessmentId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, query, where, onSnapshot }) => {
    unsub = onSnapshot(
      query(collection(db, 'ros_assessor_notes_v1'),
        where('assessmentId', '==', assessmentId), where('questionId', '==', questionId)),
      snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0))),
      err => console.error('[risk-os-data] assessor notes subscription failed', err),
    );
  });
  return () => unsub();
}

// Every assessor note across the WHOLE assessment at once — same reasoning
// as subscribeAllClaimsForAssessment(): the Internal Analyst System's review
// workspace renders a "+ Note" annotation area on every question card, and
// one Firestore listener per question would not scale to a 200+ question
// assessment. Callers filter by questionId client-side.
export function subscribeAllAssessorNotesForAssessment(assessmentId, onChange) {
  if (!_USE_FIREBASE || !assessmentId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, query, where, onSnapshot }) => {
    unsub = onSnapshot(
      query(collection(db, 'ros_assessor_notes_v1'), where('assessmentId', '==', assessmentId)),
      snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0))),
      err => console.error('[risk-os-data] all-assessor-notes subscription failed', err),
    );
  });
  return () => unsub();
}

// ── Declaration & Acknowledgement (consent gate before submission) ───────
// Append-only, one doc per submission — a re-submission after a
// methodology/questionnaire revision creates a NEW record rather than
// overwriting the last one, so every historical submission stays
// reconstructable as: submitted data + evidence + questionnaire version +
// methodology version + declaration version + timestamp. Never store just
// a boolean "accepted" flag — the exact version strings are what let
// Climactix later establish which terms governed a given assessment.
export async function saveDeclaration(assessmentId, declaration) {
  if (!_USE_FIREBASE || !assessmentId) return null;
  const uid = _uid();
  if (!uid) throw new Error('Not signed in.');
  const { db, collection, addDoc, serverTimestamp } = await _firestore();
  const docRef = await addDoc(collection(db, 'ros_declarations_v1'), {
    assessmentId,
    assessmentRef: declaration.assessmentRef || null,
    organisation: declaration.organisation || null,
    submittedByName: declaration.submittedBy?.fullName || null,
    submittedByDesignation: declaration.submittedBy?.designation || null,
    submittedByEmail: declaration.submittedBy?.email || null,
    submittedByDepartment: declaration.submittedBy?.department || null,
    authorisationRef: declaration.submittedBy?.authRef || null,
    methodologyVersion: declaration.methodologyVersion || null,
    questionnaireVersion: declaration.questionnaireVersion || null,
    declarationVersion: declaration.declarationVersion || null,
    evidenceFilesCount: declaration.evidenceCount ?? 0,
    checks: declaration.checks || {},
    timezone: declaration.timezone || null,
    submittedByUid: uid,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

// ── Audit log (spec §18) ──────────────────────────────────────────────────
// Append-only; pairs with the always-visible ros_answer_versions_v1 for
// events beyond answer-value changes (evidence added/removed, score shifts).
// Note: readable only by reviewer/owner/auditor roles per firestore.rules,
// not by ordinary contributors — supplements, does not replace, the answer
// version trail everyone already sees.

export async function logAuditEvent(assessmentId, eventType, entityId, beforeValue = null, afterValue = null) {
  if (!_USE_FIREBASE || !assessmentId) return;
  const uid = _uid();
  if (!uid) return;
  const { db, collection, addDoc, serverTimestamp } = await _firestore();
  await addDoc(collection(db, 'ros_audit_log_v1'), {
    assessmentId, eventType, entityId: entityId || null,
    beforeValue, afterValue, actorUserId: uid, createdAt: serverTimestamp(),
  });
}

export function subscribeAuditLog(assessmentId, onChange) {
  if (!_USE_FIREBASE || !assessmentId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, query, where, onSnapshot }) => {
    unsub = onSnapshot(
      query(collection(db, 'ros_audit_log_v1'), where('assessmentId', '==', assessmentId)),
      snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0))),
      err => console.error('[risk-os-data] audit log subscription failed', err),
    );
  });
  return () => unsub();
}

// ── Assessed status — Declared / Evidenced / Assessed (spec §8) ──────────
// Written ONLY by an explicit human "Accept Recommendation" click in the
// Question Intelligence drawer — never auto-applied from an AI review, per
// the same "AI must not silently modify scores" discipline already implicit
// in saveClayerScores(). assessedBasis records WHY a human accepted it
// ('ai_review' vs 'human_review'), so the provenance survives alongside the
// declared answer rather than overwriting it.
export async function setAssessedStatus(assessmentId, questionId, { assessedStatus, assessedConfidence, assessedBasis }) {
  if (!_USE_FIREBASE || !assessmentId) return;
  const uid = _uid();
  if (!uid) throw new Error('Not signed in.');
  const { db, doc, setDoc, serverTimestamp } = await _firestore();
  await setDoc(doc(db, 'ros_answers_v1', `${assessmentId}_${questionId}`), {
    assessedStatus: assessedStatus || null,
    assessedConfidence: assessedConfidence ?? null,
    assessedBasis: assessedBasis || null,
    assessedAt: serverTimestamp(),
    assessedBy: uid,
  }, { merge: true });
}

// ── Evidence Library — reuse one upload across multiple questions ────────
// (spec §17). The original ros_evidence_v1 doc and its own questionId are
// never mutated — a link is a separate, append-only join row, so one
// upload can serve many questions without duplicating the file or losing
// track of where it was originally attached.
export async function linkExistingEvidence(assessmentId, evidenceId, questionId) {
  if (!_USE_FIREBASE || !assessmentId) return null;
  const uid = _uid();
  if (!uid) throw new Error('Not signed in.');
  const { db, collection, addDoc, serverTimestamp } = await _firestore();
  const docRef = await addDoc(collection(db, 'ros_evidence_links_v1'), {
    assessmentId, evidenceId, questionId, linkedBy: uid, linkedAt: serverTimestamp(),
  });
  return docRef.id;
}

export function subscribeEvidenceLinks(assessmentId, onChange) {
  if (!_USE_FIREBASE || !assessmentId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, query, where, onSnapshot }) => {
    unsub = onSnapshot(
      query(collection(db, 'ros_evidence_links_v1'), where('assessmentId', '==', assessmentId)),
      snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('[risk-os-data] evidence links subscription failed', err),
    );
  });
  return () => unsub();
}

// ── Contradiction flags — durable, cross-referenced version of what
// detectContradictions() computes ephemerally client-side, plus findings
// from AI evidence review and the evidence-graph traversal (spec §12/§13).
// Cloud-Function-only write (functions/main.py: compute_evidence_graph,
// and the 'contradictions' AI review type) — read-only here by design.
export function subscribeContradictionFlags(assessmentId, onChange) {
  if (!_USE_FIREBASE || !assessmentId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, query, where, onSnapshot }) => {
    unsub = onSnapshot(
      query(collection(db, 'ros_contradiction_flags_v1'), where('assessmentId', '==', assessmentId)),
      snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('[risk-os-data] contradiction flags subscription failed', err),
    );
  });
  return () => unsub();
}

// ── Evidence graph — read-only nodes built by the compute_evidence_graph
// Cloud Function trigger (functions/services/evidence_graph.py). Exposed
// mainly for the Assessment Agent / debugging — the drawer surfaces
// contradiction flags directly rather than walking the graph itself.
export function subscribeEvidenceGraph(assessmentId, onChange) {
  if (!_USE_FIREBASE || !assessmentId) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, collection, query, where, onSnapshot }) => {
    unsub = onSnapshot(
      query(collection(db, 'ros_evidence_graph_v1'), where('assessmentId', '==', assessmentId)),
      snap => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('[risk-os-data] evidence graph subscription failed', err),
    );
  });
  return () => unsub();
}

// ── Persistent Climactix Assessment Agent (spec §16) ──────────────────────
// Both the user's message and the agent's reply are appended server-side by
// the assessment_agent_chat callable (functions/services/assessment_agent.py)
// — the client only ever reads the conversation doc and calls the callable,
// it never writes ros_agent_conversations_v1 directly (firestore.rules
// denies that), so a fake assistant turn can never be injected client-side.
export async function chatWithAssessmentAgent(assessmentId, message) {
  if (!_USE_FIREBASE) return { reply: 'The Assessment Agent requires a connected backend — not available in local/demo mode.', toolCalls: [] };
  const { functions, httpsCallable } = await _functionsApi();
  const fn = httpsCallable(functions, 'assessment_agent_chat');
  const res = await fn({ assessmentId, message });
  return res.data;
}

export function subscribeAgentConversation(assessmentId, onChange) {
  if (!_USE_FIREBASE || !assessmentId) return () => {};
  const uid = _uid();
  if (!uid) return () => {};
  let unsub = () => {};
  _firestore().then(({ db, doc, onSnapshot }) => {
    unsub = onSnapshot(
      doc(db, 'ros_agent_conversations_v1', `${assessmentId}_${uid}`),
      snap => onChange(snap.exists() ? snap.data().messages || [] : []),
      err => console.error('[risk-os-data] agent conversation subscription failed', err),
    );
  });
  return () => unsub();
}
