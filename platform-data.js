/**
 * Climactix Enterprise Platform — Data orchestration layer.
 * NOT a new data source: wraps window.INTELLIGENCE (20-company demo dataset,
 * already used by investor-terminal.html/simulation.html) for company +
 * scenario data, and calls existing, already-live backend endpoints for
 * Regulatory Intelligence and Greenwashing/Narrative Intelligence.
 * No company data is duplicated here.
 */
window.PLATFORM = (function () {
  'use strict';

  const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : '';

  function intel() {
    if (!window.INTELLIGENCE) throw new Error('intelligence-engine.js must be loaded before platform-data.js');
    return window.INTELLIGENCE;
  }

  // ── Company + scenario passthrough (single source of truth: INTELLIGENCE) ──

  function getCompanies(query, filters) { return intel().searchCompanies(query, filters); }
  function getCompany(id) { return intel().getCompany(id); }
  function getRating(score) { return intel().getRating(score); }
  function getRiskLabel(score) { return intel().getRiskLabel(score); }
  function getScenarios() { return intel().SCENARIOS; }
  function runScenario(company, scenarioId, targetYear) { return intel().runScenario(company, scenarioId, targetYear); }

  // ── Executive summary — 8 KPI aggregation, computed from the demo company set.
  // This is a transparent in-browser aggregation, not a live regulatory feed —
  // labeled as such in the UI ("Across 20 tracked companies").
  function computeExecutiveSummary() {
    const companies = intel().COMPANIES;
    const n = companies.length;
    const avg = (fn) => Math.round(companies.reduce((s, c) => s + fn(c), 0) / n);

    const avgPhysical = avg(c => c.physicalRisk.overall);
    const avgTransition = avg(c => c.transitionRisk.overall);
    const avgCredibility = avg(c => c.credibilityScore);
    const avgCarbonIntensity = companies.reduce((s, c) => s + c.carbonIntensity, 0) / n;

    // Regulatory exposure: % of compliance fields across all companies that are 'partial' or 'missing'
    let totalFields = 0, exposedFields = 0;
    companies.forEach(c => {
      Object.values(c.compliance).forEach(status => {
        if (status === 'n/a') return;
        totalFields++;
        if (status === 'partial' || status === 'missing') exposedFields++;
      });
    });
    const regulatoryExposure = totalFields ? Math.round((exposedFields / totalFields) * 100) : 0;

    // Supply chain risk proxy: facility-geography concentration + transition risk blend.
    // Explicitly a proxy — no dedicated supply chain module exists yet (Phase 2).
    const avgFacilityCount = companies.reduce((s, c) => s + c.facilities.length, 0) / n;
    const concentrationProxy = Math.max(0, 100 - avgFacilityCount * 8); // fewer facilities = more concentrated = higher proxy risk
    const supplyChainRiskProxy = Math.round((concentrationProxy * 0.5) + (avgTransition * 0.5));

    // Carbon exposure: normalize avg carbon intensity (tCO2e/$rev, demo range ~0.02-1.6) to 0-100
    const carbonExposure = Math.round(Math.min(100, (avgCarbonIntensity / 1.6) * 100));

    // Scenario readiness: % SBTi-aligned + inverse transition risk, blended
    const sbtiPct = Math.round((companies.filter(c => c.sbtiAligned).length / n) * 100);
    const scenarioReadiness = Math.round((sbtiPct * 0.5) + ((100 - avgTransition) * 0.5));

    // Climate Risk Score: blended physical + transition (higher = more risk)
    const climateRiskScore = Math.round((avgPhysical + avgTransition) / 2);

    return {
      sampleSize: n,
      climateRiskScore,        // 0-100, higher = more risk
      physicalRiskScore: avgPhysical,
      transitionRiskScore: avgTransition,
      disclosureQuality: avgCredibility,   // 0-100, higher = better
      regulatoryExposure,                  // 0-100, higher = more exposure
      supplyChainRiskProxy,                // 0-100, higher = more risk (proxy, Phase 2 will replace)
      carbonExposure,                      // 0-100, higher = more exposure
      scenarioReadiness,                   // 0-100, higher = more ready
    };
  }

  // ── Backend calls — reuse existing, already-live endpoints ──────────────────

  async function fetchFrameworkRegistry() {
    const res = await fetch(`${API_BASE}/api/esg-intelligence/frameworks`);
    if (!res.ok) throw new Error('Failed to load framework registry');
    return res.json();
  }

  async function analyzeReport(file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API_BASE}/api/esg-intelligence/analyze`, { method: 'POST', body: fd });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || 'Framework analysis failed');
    }
    return res.json();
  }

  async function scanCredibility(file, companyName) {
    const fd = new FormData();
    fd.append('file', file);
    if (companyName) fd.append('company_name', companyName);
    const res = await fetch(`${API_BASE}/api/v2/credibility/scan`, { method: 'POST', body: fd });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || 'Credibility scan failed');
    }
    return res.json();
  }

  return {
    API_BASE,
    getCompanies, getCompany, getRating, getRiskLabel,
    getScenarios, runScenario,
    computeExecutiveSummary,
    fetchFrameworkRegistry, analyzeReport, scanCredibility,
  };
})();
