// ── Climactix Global · Auth v3 ───────────────────────────────────────────────
//
// Two modes — auto-selected at load time:
//
//   FIREBASE MODE  (when firebase-config.js has real values)
//   → Uses Firebase Authentication SDK (no backend server needed)
//   → Works in production, on any device, anywhere
//
//   LOCAL MODE  (when firebase-config.js still has YOUR_* placeholders)
//   → Uses localStorage directly — works offline, no server needed
//   → Demo accounts pre-seeded automatically
//
// To enable Firebase:
//   1. console.firebase.google.com → new project → web app → copy config
//   2. Authentication → Sign-in method → enable Email/Password
//   3. Paste config values into firebase-config.js

import { firebaseConfig } from './firebase-config.js';

const SESSION_KEY   = 'cx_session_v2';
const _USE_FIREBASE = !firebaseConfig.apiKey.startsWith('YOUR_');

// ─────────────────────────────────────────────────────────────────────────────
// SHARED — session cache (localStorage, synchronous reads)
// ─────────────────────────────────────────────────────────────────────────────
export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s.expires && s.expires < Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function _cache(user, remember) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    uid:         user.uid         || user.id,
    fullName:    user.displayName || user.full_name  || user.fullName  || '',
    email:       user.email,
    companyName: user.companyName || user.company_name || '',
    role:        user.role   || 'user',
    tier:        user.tier   || 'free',
    verified:    user.emailVerified ?? user.verified ?? true,
    expires:     remember ? Date.now() + 30 * 24 * 60 * 60 * 1000 : null,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// FIREBASE MODE
// ─────────────────────────────────────────────────────────────────────────────
let _fb; // lazily initialised Firebase auth instance

async function _fbAuth() {
  if (_fb) return _fb;
  const [{ initializeApp }, { getAuth }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
  ]);
  _fb = getAuth(initializeApp(firebaseConfig));
  return _fb;
}

async function _fbSignUp({ fullName, email, companyName, password }) {
  const { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } =
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
  const auth = await _fbAuth();
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName: fullName });
    // store company name — Firebase has no built-in field for it
    localStorage.setItem('cx_profile_extra', JSON.stringify({ companyName: companyName || '' }));
    try { await sendEmailVerification(user); } catch { /* non-fatal */ }
    return { verifyToken: 'firebase', userId: user.uid, email: email.toLowerCase() };
  } catch (e) { throw _fbMapErr(e); }
}

async function _fbVerifyEmail(_email, _token) {
  // After Firebase signUp the user is already signed in — just cache the session
  const auth = await _fbAuth();
  const user = auth.currentUser;
  if (!user) throw { code: 'not-signed-in', message: 'No active session.' };
  const extra = _extra();
  _cache({ ...user, companyName: extra.companyName }, false);
  return _fbPublic(user);
}

async function _fbSignIn({ email, password, remember }) {
  const { signInWithEmailAndPassword, setPersistence,
          browserLocalPersistence, browserSessionPersistence } =
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
  const auth = await _fbAuth();
  try {
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    const extra = _extra();
    _cache({ ...user, companyName: extra.companyName }, remember);
    return _fbPublic(user);
  } catch (e) { throw _fbMapErr(e); }
}

async function _fbSignOut() {
  clearSession();
  const { signOut } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
  const auth = await _fbAuth();
  try { await signOut(auth); } catch { /* best-effort */ }
}

async function _fbForgotPassword(email) {
  const { sendPasswordResetEmail } =
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
  const auth = await _fbAuth();
  try {
    await sendPasswordResetEmail(auth, email);
    return { token: null, email: email.toLowerCase() };
  } catch (e) { throw _fbMapErr(e); }
}

async function _fbResetPassword(_email, oobCode, newPassword) {
  const { confirmPasswordReset } =
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
  const auth = await _fbAuth();
  try {
    await confirmPasswordReset(auth, oobCode, newPassword);
    return { id: null, email: _email };
  } catch (e) { throw _fbMapErr(e); }
}

async function _fbSyncSession() {
  const { onAuthStateChanged } =
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
  const auth = await _fbAuth();
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, user => {
      unsub();
      if (user) {
        const extra = _extra();
        _cache({ ...user, companyName: extra.companyName }, true);
        resolve(_fbPublic(user));
      } else {
        clearSession();
        resolve(null);
      }
    });
  });
}

function _fbPublic(user) {
  const extra = _extra();
  return {
    id:           user.uid,
    full_name:    user.displayName || '',
    email:        user.email,
    company_name: extra.companyName || '',
    role:         'user',
    tier:         'free',
    status:       'active',
  };
}

function _extra() {
  try { return JSON.parse(localStorage.getItem('cx_profile_extra') || '{}'); } catch { return {}; }
}

function _fbMapErr(e) {
  const map = {
    'auth/email-already-in-use':   { code: 'email-in-use',        message: 'An account with this email already exists.' },
    'auth/invalid-email':          { code: 'invalid-email',        message: 'Please enter a valid email address.' },
    'auth/user-not-found':         { code: 'invalid-credentials',  message: 'No account found with this email.' },
    'auth/wrong-password':         { code: 'invalid-credentials',  message: 'Incorrect password.' },
    'auth/invalid-credential':     { code: 'invalid-credentials',  message: 'Invalid email or password.' },
    'auth/weak-password':          { code: 'weak-password',        message: 'Password must be at least 6 characters.' },
    'auth/too-many-requests':      { code: 'rate-limited',         message: 'Too many attempts. Please wait a moment and try again.' },
    'auth/network-request-failed': { code: 'network-error',        message: 'Network error. Please check your connection.' },
    'auth/user-disabled':          { code: 'account-disabled',     message: 'This account has been disabled.' },
    'auth/expired-action-code':    { code: 'token-expired',        message: 'This link has expired. Please request a new one.' },
    'auth/invalid-action-code':    { code: 'token-invalid',        message: 'This link is invalid or has already been used.' },
    'auth/popup-closed-by-user':   { code: 'cancelled',            message: 'Sign-in cancelled.' },
  };
  return map[e.code] || { code: e.code || 'auth-error', message: e.message || 'Authentication failed.' };
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL STORAGE MODE  (no Firebase config → works fully offline, no server needed)
// ─────────────────────────────────────────────────────────────────────────────

// Stub for secondary API calls (MFA, sessions, API keys) — not supported in local mode
async function _api() {
  throw { code: 'not-supported', message: 'This feature requires a configured backend or Firebase.' };
}

const _LOCAL_USERS_KEY = 'cx_local_users_v1';

function _getLocalUsers() {
  try { return JSON.parse(localStorage.getItem(_LOCAL_USERS_KEY) || '[]'); } catch { return []; }
}
function _saveLocalUsers(users) {
  localStorage.setItem(_LOCAL_USERS_KEY, JSON.stringify(users));
}

// SHA-256 via SubtleCrypto — replaces btoa which is encoding, not hashing
async function _hashPw(password) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(password + 'cx_local_v2')
  );
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Demo accounts — password loaded from window.CX_DEMO_CONFIG to keep credentials out of source
async function _ensureDemoUsers() {
  const cfg = window.CX_DEMO_CONFIG;
  if (!cfg || !cfg.enabled || !cfg.password) return;
  const users = _getLocalUsers();
  const seeds = [
    { id:'demo_admin',   full_name:'Demo Admin',   email:'admin@climactix.com',  company_name:'Climactix Global', role:'admin',  tier:'pro'  },
    { id:'demo_user',    full_name:'Demo User',     email:'demo@climactix.com',   company_name:'Acme Corp',        role:'user',   tier:'free' },
    { id:'demo_analyst', full_name:'Demo Analyst',  email:'analyst@climactix.com',company_name:'Climactix Global', role:'analyst',tier:'pro'  },
  ];
  let changed = false;
  for (const seed of seeds) {
    if (!users.find(u => u.email === seed.email)) {
      users.push({ ...seed, pw: await _hashPw(cfg.password) });
      changed = true;
    }
  }
  if (changed) _saveLocalUsers(users);
}

async function _localSignUp({ fullName, email, companyName, password }) {
  await _ensureDemoUsers();
  const users = _getLocalUsers();
  if (users.find(u => u.email === email.toLowerCase()))
    throw { code: 'email-in-use', message: 'An account with this email already exists.' };
  const user = {
    id: 'local_' + Date.now(),
    full_name: fullName,
    email: email.toLowerCase(),
    company_name: companyName || '',
    role: 'user', tier: 'free',
    pw: await _hashPw(password),
  };
  users.push(user);
  _saveLocalUsers(users);
  return { verifyToken: null, userId: user.id, email: user.email };
}

async function _localVerifyEmail(email, _token) {
  await _ensureDemoUsers();
  const user = _getLocalUsers().find(u => u.email === email.toLowerCase());
  if (!user) throw { code: 'not-found', message: 'Account not found.' };
  _cache(user, false);
  return user;
}

async function _localSignIn({ email, password, remember }) {
  await _ensureDemoUsers();
  const pw = await _hashPw(password);
  const user = _getLocalUsers().find(
    u => u.email === email.toLowerCase() && u.pw === pw
  );
  if (!user) throw { code: 'invalid-credentials', message: 'Invalid email or password.' };
  _cache(user, remember);
  return user;
}

async function _localSignOut() {
  clearSession();
}

async function _localForgotPassword(email) {
  await _ensureDemoUsers();
  const user = _getLocalUsers().find(u => u.email === email.toLowerCase());
  if (!user) throw { code: 'not-found', message: 'No account found with this email.' };
  return { token: 'local_reset_' + Date.now(), email: email.toLowerCase() };
}

async function _localResetPassword(email, _token, newPassword) {
  await _ensureDemoUsers();
  const users = _getLocalUsers();
  const i = users.findIndex(u => u.email === email.toLowerCase());
  if (i < 0) throw { code: 'not-found', message: 'Account not found.' };
  users[i].pw = await _hashPw(newPassword);
  _saveLocalUsers(users);
  _cache(users[i], false);
  return users[i];
}

async function _localSyncSession() {
  return getSession();
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API — routes to the right driver automatically
// ─────────────────────────────────────────────────────────────────────────────
export async function signUp(opts)                      { return _USE_FIREBASE ? _fbSignUp(opts)                     : _localSignUp(opts); }
export async function verifyEmail(email, token)         { return _USE_FIREBASE ? _fbVerifyEmail(email, token)        : _localVerifyEmail(email, token); }
export async function signIn(opts)                      { return _USE_FIREBASE ? _fbSignIn(opts)                     : _localSignIn(opts); }
export async function signOut()                         { return _USE_FIREBASE ? _fbSignOut()                        : _localSignOut(); }
export async function forgotPassword(email)             { return _USE_FIREBASE ? _fbForgotPassword(email)            : _localForgotPassword(email); }
export async function resetPassword(e, t, p)            { return _USE_FIREBASE ? _fbResetPassword(e, t, p)           : _localResetPassword(e, t, p); }
export async function syncSession()                     { return _USE_FIREBASE ? _fbSyncSession()                    : _localSyncSession(); }

// ── Backend-only stubs (not available in local/Firebase mode) ────────────────
export async function completeMfaSignIn(_token, _code) {
  throw { code: 'not-supported', message: 'MFA not configured.' };
}
export async function getMfaStatus()            { return { enabled: false }; }
export async function setupMfa()                { throw { code: 'not-supported', message: 'MFA not configured.' }; }
export async function enableMfa(secret, code)   { if (_USE_FIREBASE) throw { code: 'not-supported', message: 'MFA not configured.' }; return _api('POST', '/mfa/enable', { secret, code }); }
export async function disableMfa(code, pw)      { if (_USE_FIREBASE) throw { code: 'not-supported', message: 'MFA not configured.' }; return _api('POST', '/mfa/disable', { code, password: pw }); }
export async function listSessions()            { if (_USE_FIREBASE) return [];              return _api('GET',    '/auth/sessions'); }
export async function revokeSession(sid)        { if (_USE_FIREBASE) return { ok: true };    return _api('DELETE', `/auth/sessions/${sid}`); }
export async function listApiKeys()             { if (_USE_FIREBASE) return [];              return _api('GET',    '/api-keys'); }
export async function createApiKey(name, perms) { if (_USE_FIREBASE) throw { code: 'not-supported', message: 'API keys not configured.' }; return _api('POST', '/api-keys', { name, permissions: perms || [] }); }
export async function revokeApiKey(id)          { if (_USE_FIREBASE) return { ok: true };    return _api('DELETE', `/api-keys/${id}`); }
