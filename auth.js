// ── Climactix Global · Client-Side Auth ──────────────────
// Stores users in localStorage with SHA-256 hashed passwords.
// No server, no Firebase config needed. Works immediately.
// To upgrade: replace these functions with Firebase/Supabase calls.

const STORE_KEY = 'cx_users_v1';
const SESSION_KEY = 'cx_session';

// ── Crypto helpers ───────────────────────────────────────
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function rand(len = 32) {
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map(b => b.toString(16).padStart(2,'0')).join('');
}

// ── User store ───────────────────────────────────────────
function getUsers() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch { return {}; }
}
function saveUsers(users) {
  localStorage.setItem(STORE_KEY, JSON.stringify(users));
}

// ── Session ──────────────────────────────────────────────
export function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (!s || (s.expires && s.expires < Date.now())) { clearSession(); return null; }
    return s;
  } catch { return null; }
}
export function clearSession() { localStorage.removeItem(SESSION_KEY); }
function setSession(user, remember) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    uid: user.email,
    fullName: user.fullName,
    email: user.email,
    companyName: user.companyName,
    verified: user.verified,
    expires: remember ? Date.now() + 30 * 24 * 60 * 60 * 1000 : null
  }));
}

// ── Auth API ─────────────────────────────────────────────
export async function signUp({ fullName, email, companyName, password }) {
  const users = getUsers();
  const key = email.toLowerCase();
  if (users[key]) throw { code: 'email-in-use', message: 'An account with this email already exists.' };

  const hash = await sha256(password + key); // salted with email
  const verifyToken = rand();

  users[key] = {
    fullName, email: key, companyName: companyName || '',
    passwordHash: hash,
    verified: false,
    verifyToken,
    createdAt: Date.now()
  };
  saveUsers(users);
  return { verifyToken, email: key };
}

export async function verifyEmail(email, token) {
  const users = getUsers();
  const key = email.toLowerCase();
  const user = users[key];
  if (!user) throw { code: 'not-found', message: 'Account not found.' };
  if (user.verifyToken !== token) throw { code: 'invalid-token', message: 'Invalid or expired verification link.' };
  user.verified = true;
  user.verifyToken = null;
  saveUsers(users);
  setSession(user, false);
  return user;
}

export async function signIn({ email, password, remember }) {
  const users = getUsers();
  const key = email.toLowerCase();
  const user = users[key];
  if (!user) throw { code: 'invalid-credentials', message: 'Incorrect email or password.' };

  const hash = await sha256(password + key);
  if (hash !== user.passwordHash) throw { code: 'invalid-credentials', message: 'Incorrect email or password.' };
  if (!user.verified) throw { code: 'not-verified', message: 'Please verify your email before signing in.', email: key, token: user.verifyToken };

  setSession(user, remember);
  return user;
}

export function signOut() { clearSession(); }

export async function forgotPassword(email) {
  const users = getUsers();
  const key = email.toLowerCase();
  const user = users[key];
  // Always succeed — don't leak whether account exists
  if (!user) return { token: null };
  const token = rand();
  user.resetToken = token;
  user.resetExpiry = Date.now() + 30 * 60 * 1000; // 30 min
  saveUsers(users);
  return { token, email: key };
}

export async function resetPassword(email, token, newPassword) {
  const users = getUsers();
  const key = email.toLowerCase();
  const user = users[key];
  if (!user) throw { code: 'not-found', message: 'Account not found.' };
  if (user.resetToken !== token) throw { code: 'invalid-token', message: 'Invalid reset link.' };
  if (user.resetExpiry < Date.now()) throw { code: 'expired', message: 'This reset link has expired. Please request a new one.' };

  user.passwordHash = await sha256(newPassword + key);
  user.resetToken = null;
  user.resetExpiry = null;
  saveUsers(users);
  setSession(user, false);
  return user;
}
