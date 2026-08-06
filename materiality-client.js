/**
 * Materiality Client — talks to the backend Dynamic Materiality Engine
 * (backend/routers/materiality.py) and provides a synchronous local
 * fallback so enterprise-assessment.html never depends on the backend
 * being up. Self-registers onto window.MATERIALITY_CLIENT.
 */
(function () {
  'use strict';

  const API_BASE = window.MATERIALITY_API_BASE || 'http://localhost:8000';

  async function fetchMaterialityProfile(industryKey, opts) {
    opts = opts || {};
    const timeoutMs = opts.timeoutMs || 4000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${API_BASE}/api/v1/materiality/profile/${encodeURIComponent(industryKey)}`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timer);
      if (!res.ok) return { ok: false, reason: `http_${res.status}` };
      const profile = await res.json();
      return { ok: true, profile };
    } catch (e) {
      clearTimeout(timer);
      return { ok: false, reason: e && e.name === 'AbortError' ? 'timeout' : 'network_error' };
    }
  }

  // Reproduces pre-materiality-engine behavior: every category applicable,
  // equal weight, base tier only, no adaptive questions. Used whenever the
  // backend is unreachable so the assessment never breaks or blocks.
  function localFallbackProfile(industryKey, ASPECT_CATEGORIES) {
    const categories = ASPECT_CATEGORIES || [];
    const n = categories.length || 1;
    const equalWeight = Math.round((100 / n) * 100) / 100;
    return {
      industryKey,
      source: 'local_fallback',
      categories: categories.map(cat => ({
        categoryId: cat.id,
        label: cat.label,
        applicable: true,
        significance: { score: null, band: null, source: 'fallback' },
        weightPct: equalWeight,
        subAspects: (cat.subAspects || []).map(sa => ({
          id: sa.id, label: sa.label, applicable: true,
          tier: 'base', contentStatus: 'pending_authoring', questions: []
        }))
      })),
      frameworkCrosswalk: {},
      contentAuthoring: Object.fromEntries(categories.map(c => [c.id, false]))
    };
  }

  window.MATERIALITY_CLIENT = { API_BASE, fetchMaterialityProfile, localFallbackProfile };
})();
