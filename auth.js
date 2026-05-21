// ── Climactix Global · Auth Client v2.1 ────────────────────
// Credentials live in HttpOnly cookies set by the backend.
// localStorage holds only safe public user info for synchronous
// getSession() calls — no tokens, no passwords ever stored here.
//
// Security layers implemented here:
//   • HttpOnly cookie-based auth tokens (no localStorage for tokens)
//   • CSRF double-submit cookie (X-CSRF-Token header on mutations)
//   • Device fingerprint sent with login/register
//   • MFA challenge auto-redirect

const API_BASE = (() => {
  if (typeof window === 'undefined') return 'http://localhost:8000';
  const h = window.location.hostname;
  if (!h || h === 'localhost' || h === '127.0.0.1') return 'http://localhost:8000';
  return '';
})();

const SESSION_KEY = 'cx_session_v2';

// ── Session cache ─────────────────────────────────────────
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

function _cacheSession(user, remember) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    uid:         user.id,
    fullName:    user.full_name,
    email:       user.email,
    companyName: user.company_name,
    role:        user.role,
    tier:        user.tier,
    verified:    user.status === 'active',
    expires:     remember ? Date.now() + 30 * 24 * 60 * 60 * 1000 : null,
  }));
}

// ── CSRF: read the cx_csrf readable cookie ────────────────
function _csrfToken() {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split(';').map(c => c.trim())
    .find(c => c.startsWith('cx_csrf='));
  return match ? decodeURIComponent(match.slice('cx_csrf='.length)) : null;
}

// ── Device fingerprint ────────────────────────────────────
async function _deviceFingerprint() {
  try {
    const parts = [
      navigator.userAgent || '',
      navigator.language || '',
      `${screen.width}x${screen.height}`,
      screen.colorDepth || '',
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
      navigator.deviceMemory || 0,
    ];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FF6600';
      ctx.fillText('cx', 2, 2);
      parts.push(canvas.toDataURL().slice(-40));
    }
    const raw = parts.join('|');
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  } catch {
    return 'unknown';
  }
}

// ── HTTP helper ───────────────────────────────────────────
async function _api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };

  // Attach CSRF token on all state-changing requests (double-submit cookie)
  if (method !== 'GET' && method !== 'HEAD') {
    const csrf = _csrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  const opts = {
    method,
    credentials: 'include',
    headers,
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, opts);
  } catch {
    throw { code: 'network-error', message: 'Cannot reach the Climactix server. Is it running on port 8000?' };
  }

  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }

  if (!res.ok) {
    const detail = data.detail || data;
    let code, message;
    if (Array.isArray(detail)) {
      // 422 Pydantic validation error — detail is an array of field errors
      code    = 'validation-error';
      message = detail.map(e => e.msg || e.message).filter(Boolean).join('. ')
                || 'Invalid input. Please check your details.';
    } else if (detail && typeof detail === 'object') {
      code    = detail.code    || 'error';
      message = detail.message || detail.msg || `Request failed (${res.status}).`;
    } else if (typeof detail === 'string') {
      code    = 'error';
      message = detail;
    } else {
      code    = 'error';
      message = `Request failed (${res.status}). Please try again.`;
    }
    throw { code, message, ...(detail && typeof detail === 'object' && !Array.isArray(detail) ? detail : {}) };
  }

  return data;
}

// ── Auth API ──────────────────────────────────────────────

export async function signUp({ fullName, email, companyName, password }) {
  const data = await _api('POST', '/auth/register', {
    full_name:    fullName,
    email,
    company_name: companyName || '',
    password,
  });
  return {
    verifyToken: data.verify_token || null,
    userId:      data.user_id || null,
    email:       email.toLowerCase(),
  };
}

export async function verifyEmail(email, token) {
  const data = await _api('POST', '/auth/verify-email', { email, token });
  _cacheSession(data.user, false);
  return data.user;
}

export async function signIn({ email, password, remember }) {
  const fingerprint = await _deviceFingerprint();
  const data = await _api('POST', '/auth/login', {
    email,
    password,
    remember: !!remember,
    device_fingerprint: fingerprint,
  });

  // MFA required — redirect to challenge page (login.html needs no changes)
  if (data.mfa_required) {
    const params = new URLSearchParams({
      token:    data.mfa_token,
      email:    data.email || email.toLowerCase(),
      remember: remember ? '1' : '0',
    });
    window.location.href = `mfa-challenge.html?${params}`;
    return null; // Prevent caller from proceeding
  }

  _cacheSession(data.user, remember);
  return data.user;
}

export async function signOut() {
  clearSession();
  try { await _api('POST', '/auth/logout', {}); } catch { /* best-effort */ }
}

export async function forgotPassword(email) {
  const data = await _api('POST', '/auth/forgot-password', { email });
  return {
    token: data.reset_token || null,
    email: (data.email || email).toLowerCase(),
  };
}

export async function resetPassword(email, token, newPassword) {
  const data = await _api('POST', '/auth/reset-password', {
    email,
    token,
    new_password: newPassword,
  });
  _cacheSession(data.user, false);
  return data.user;
}

// ── Session sync (call on protected pages) ────────────────
export async function syncSession() {
  try {
    const user = await _api('GET', '/auth/me');
    _cacheSession(user, !!(getSession()?.expires));
    return user;
  } catch {
    clearSession();
    return null;
  }
}

// ── MFA helpers (used by mfa-challenge.html) ──────────────
export async function completeMfaSignIn(mfaToken, code) {
  const data = await _api('POST', '/mfa/verify', { mfa_token: mfaToken, code });
  const remember = new URLSearchParams(location.search).get('remember') === '1';
  _cacheSession(data.user, remember);
  return data.user;
}

export async function getMfaStatus() {
  return _api('GET', '/mfa/status');
}

export async function setupMfa() {
  return _api('POST', '/mfa/setup', {});
}

export async function enableMfa(secret, code) {
  return _api('POST', '/mfa/enable', { secret, code });
}

export async function disableMfa(code, password) {
  return _api('POST', '/mfa/disable', { code, password });
}

// ── Sessions (used by security.html) ─────────────────────
export async function listSessions() {
  return _api('GET', '/auth/sessions');
}

export async function revokeSession(sessionId) {
  return _api('DELETE', `/auth/sessions/${sessionId}`);
}

// ── API keys (used by security.html) ─────────────────────
export async function listApiKeys() {
  return _api('GET', '/api-keys');
}

export async function createApiKey(name, permissions = []) {
  return _api('POST', '/api-keys', { name, permissions });
}

export async function revokeApiKey(keyId) {
  return _api('DELETE', `/api-keys/${keyId}`);
}
