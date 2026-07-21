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
    reviewStatus: 'pending', version: 1, tags: meta.tags || [],
    createdAt: serverTimestamp(),
  });
  return docRef.id;
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
