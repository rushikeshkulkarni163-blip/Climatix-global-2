/**
 * Climactix Enterprise Platform — Auth layer
 * Talks to backend/routers/auth.py (cookie-based JWT: cx_access/cx_refresh/cx_csrf).
 * No existing frontend page wires this backend up — this is the first.
 * cx_csrf is set by the backend for future double-submit protection but is not
 * currently verified on any endpoint here, so no header round-trip is needed yet.
 */
window.PLATFORM_AUTH = (function () {
  'use strict';

  const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : '';

  async function api(path, opts) {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    let body = null;
    try { body = await res.json(); } catch (_) { /* no body */ }
    if (!res.ok) {
      const err = new Error((body && body.detail && body.detail.message) || (body && body.detail) || 'Request failed');
      err.status = res.status;
      err.code = body && body.detail && body.detail.code;
      err.body = body;
      throw err;
    }
    return body;
  }

  function me() {
    return api('/auth/me', { method: 'GET' });
  }

  function register({ full_name, email, company_name, password }) {
    return api('/auth/register', { method: 'POST', body: JSON.stringify({ full_name, email, company_name, password }) });
  }

  function verifyEmail({ email, token }) {
    return api('/auth/verify-email', { method: 'POST', body: JSON.stringify({ email, token }) });
  }

  function login({ email, password, remember }) {
    return api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, remember: !!remember }) });
  }

  function logout() {
    return api('/auth/logout', { method: 'POST' });
  }

  /** Gate a platform page: redirect to login if no valid session. Returns the user on success. */
  async function requireSession() {
    try {
      const user = await me();
      return user;
    } catch (err) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `platform-login.html?next=${next}`;
      throw err;
    }
  }

  return { API_BASE, me, register, verifyEmail, login, logout, requireSession };
})();
