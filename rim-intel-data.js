/**
 * rim-intel-data.js — the Risk Intelligence Object (RIO) behind the Risk Intelligence Map layers.
 *
 * Carbon exposure, narrative intelligence and NGFS scenario modelling each resolve into ONE
 * common object per entity, so the map, the panels and the financial-materiality chain read the
 * same data:
 *
 *   RIO = { entity, physical, carbon, narrative, scenario, synthesis, provenance }
 *
 * Every layer has an ADAPTER (CX_RIO.adapter('carbon' | 'narrative' | 'scenario', fn)). The defaults
 * below are the platform's simulation architecture — internally coherent, clearly marked
 * provenance.live === false, and never presented as live external data. To connect production
 * data, register an adapter that returns the same shape:
 *
 *   carbon    → { scope1, scope2, valueChain, intensity, exposure, costExposure, regulatory, assets[], clusters[], trend }
 *   narrative → { documents[], claims[{ id, text, doc, status, evidence[] }], stats, signal }
 *   scenario  → { pathways[{ id, label, short, horizon, desc, drivers{ y2030, y2050 } }], current }
 *
 * Scenario pathways are read from the platform's own scenario definitions
 * (window.INTELLIGENCE.SCENARIOS, "NGFS-aligned scenario definitions"). Driver values are RELATIVE
 * indices (0–1) mapped from those definitions — they are not official NGFS outputs; an NGFS dataset
 * is mapped in by replacing the 'scenario' adapter.
 */
(function () {
  'use strict';
  if (window.CX_RIO) return;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  var LEVELS = ['Low', 'Moderate', 'High', 'Severe'];
  function level(v) { return v < 0.25 ? 0 : v < 0.5 ? 1 : v < 0.75 ? 2 : 3; }

  /* ── the fictional entity used throughout the existing Risk OS / Risk Intelligence Map stories ── */
  var ENTITY = { id: 'abc-industries', name: 'ABC Industries', facility: 'Pune facility', lat: 18.605, lon: 73.779, sector: 'Manufacturing', sectorKey: 'infrastructure' };

  /* ══ carbon ══ */
  var CARBON_BY_SITE = {                       // relative emissions weight, intensity band, regulatory carbon exposure
    Pune: [0.86, 'high', 'high'], Chennai: [0.70, 'high', 'mod'], Ahmedabad: [0.52, 'mod', 'mod'], Visakhapatnam: [0.56, 'mod', 'mod'],
    Kolkata: [0.60, 'high', 'mod'], Stuttgart: [0.30, 'low', 'high'], Hamburg: [0.34, 'low', 'high'], Houston: [0.66, 'high', 'mod'],
    Detroit: [0.28, 'low', 'low'], 'Ho Chi Minh City': [0.48, 'mod', 'low'], Hanoi: [0.36, 'mod', 'low'], 'São Paulo': [0.40, 'mod', 'mod'],
    Curitiba: [0.22, 'low', 'low'], Durban: [0.38, 'mod', 'mod']
  };
  var CLUSTERS = [                             // facility groups whose combined emissions concentration is shown on the map
    { id: 'south-asia', label: 'South Asia', members: ['Pune', 'Chennai', 'Ahmedabad', 'Visakhapatnam', 'Kolkata'] },
    { id: 'europe', label: 'Central Europe', members: ['Stuttgart', 'Hamburg'] },
    { id: 'gulf-us', label: 'US Gulf', members: ['Houston', 'Detroit'] },
    { id: 'se-asia', label: 'South-East Asia', members: ['Ho Chi Minh City', 'Hanoi'] }
  ];
  function carbonDefault(entity, fac) {
    var assets = fac.map(function (f) {
      var c = CARBON_BY_SITE[f.n] || [0.2 + 0.5 * (f.fin || 0.3), f.risk === 'high' ? 'high' : f.risk === 'mod' ? 'mod' : 'low', 'mod'];
      return { n: f.n, lat: f.lat, lon: f.lon, emis: c[0], intensity: c[1], regulatory: c[2], hero: !!f.hero };
    });
    var clusters = CLUSTERS.map(function (cl) {
      var m = assets.filter(function (a) { return cl.members.indexOf(a.n) >= 0; });
      var w = m.reduce(function (s, a) { return s + a.emis; }, 0) || 1;
      var lat = m.reduce(function (s, a) { return s + a.lat * a.emis; }, 0) / w, lon = m.reduce(function (s, a) { return s + a.lon * a.emis; }, 0) / w;
      var conc = clamp(w / 3.2, 0, 1);                                  // emissions concentration (0–1)
      var hi = m.filter(function (a) { return a.intensity === 'high'; }).length / Math.max(1, m.length);
      return { id: cl.id, label: cl.label, members: cl.members, lat: lat, lon: lon, concentration: conc, exposure: conc > 0.6 || hi > 0.5 ? 'high' : conc > 0.3 ? 'mod' : 'low' };
    });
    return {
      scope1: { value: 38, unit: 'kt CO₂e' }, scope2: { value: 52, unit: 'kt CO₂e' }, valueChain: { value: 610, unit: 'kt CO₂e' },
      intensity: { value: 210, unit: 'tCO₂e / $M revenue', band: 'above sector reference' },
      exposure: 'high', costExposure: 'high', regulatory: 'high', assets: assets, clusters: clusters,
      trend: { periods: 5, intensity: [1.0, 0.99, 1.01, 0.99, 1.0] }      // relative to first period: broadly flat
    };
  }

  /* ══ narrative ══ */
  function narrativeDefault(entity) {
    return {
      documents: ['Sustainability report', 'Climate disclosure', 'Annual report', 'Public statements'],
      claims: [
        { id: 'exposure', text: 'Reducing climate-related operational exposure.', doc: 'Climate disclosure', status: 'partial',
          evidence: [{ kind: 'Facility data', lat: 18.605, lon: 73.779, match: 'partial' }, { kind: 'Climate signal', lat: 19.6, lon: 75.6, match: 'partial' }, { kind: 'Operational data', lat: 18.605, lon: 73.779, match: 'gap' }] },
        { id: 'supply', text: 'Climate-resilient supply chain.', doc: 'Sustainability report', status: 'gap',
          evidence: [{ kind: 'Supply chain data', lat: 25.0, lon: 55.1, match: 'gap' }, { kind: 'Climate signal', lat: 22.5, lon: 72.6, match: 'partial' }] },
        { id: 'water', text: 'Water resilience across our operations.', doc: 'Annual report', status: 'supported',
          evidence: [{ kind: 'Facility data', lat: 18.605, lon: 73.779, match: 'supported' }, { kind: 'Water exposure', lat: 18.2, lon: 74.9, match: 'supported' }] },
        { id: 'carbon', text: 'Reducing carbon intensity.', doc: 'Sustainability report', status: 'partial',
          evidence: [{ kind: 'Emissions data', lat: 18.605, lon: 73.779, match: 'partial' }] }
      ],
      stats: { claimsAnalysed: 248, climateClaims: 42, evidenceMatches: 31, evidenceGaps: 11, consistency: 0.82, confidence: 0.89 },
      signal: { level: 'mod', text: 'Partial alignment · evidence gaps on supply chain and carbon trend' }
    };
  }

  /* ══ NGFS scenario modelling ══ */
  /* Relative driver indices (0–1) per pathway and horizon, mapped from the descriptions in
     INTELLIGENCE.SCENARIOS. p = physical pressure · t = transition pressure · c = carbon-price pressure. */
  var DRIVERS = {
    '1.5c':         { y2030: { p: 0.10, t: 0.65, c: 0.70 }, y2050: { p: 0.25, t: 0.85, c: 0.90 } },
    '2c':           { y2030: { p: 0.12, t: 0.40, c: 0.45 }, y2050: { p: 0.40, t: 0.60, c: 0.65 } },
    '3c':           { y2030: { p: 0.18, t: 0.10, c: 0.10 }, y2050: { p: 0.95, t: 0.20, c: 0.15 } },
    'delayed':      { y2030: { p: 0.15, t: 0.20, c: 0.25 }, y2050: { p: 0.55, t: 1.00, c: 1.00 } },
    'carbon_shock': { y2030: { p: 0.10, t: 0.90, c: 1.00 }, y2050: { p: 0.30, t: 0.95, c: 1.00 } },
    'nz2050':       { y2030: { p: 0.10, t: 0.50, c: 0.55 }, y2050: { p: 0.30, t: 0.70, c: 0.75 } }
  };
  var FALLBACK = [                                                  // only used if intelligence-engine.js is absent
    { id: 'nz2050', label: 'Net Zero 2050', short: 'NZ-2050' }, { id: 'delayed', label: 'Delayed Transition', short: 'Delayed' },
    { id: '3c', label: '3°C / Current Policies', short: '3°C' }
  ];
  function scenarioDefault() {
    var S = window.INTELLIGENCE && window.INTELLIGENCE.SCENARIOS, list = [];
    if (S) Object.keys(S).forEach(function (k) { if (DRIVERS[k]) list.push({ id: k, label: S[k].label, short: S[k].shortLabel, horizon: S[k].horizon, desc: S[k].desc }); });
    if (!list.length) list = FALLBACK.slice();
    list.forEach(function (p) { p.drivers = DRIVERS[p.id]; });
    return { pathways: list, source: S ? 'platform scenario definitions' : 'default pathway set', current: { p: 0.62, t: 0.42, c: 0.45 } };
  }

  var ADAPTERS = { carbon: carbonDefault, narrative: narrativeDefault, scenario: scenarioDefault };
  function adapter(layer, fn) { if (ADAPTERS[layer] && typeof fn === 'function') ADAPTERS[layer] = fn; }

  /* Evaluate one (pathway, horizon, risk type) against the entity → relative outputs + map drivers. */
  function evaluate(scenario, pathwayId, horizon, riskType) {
    var pw = scenario.pathways.filter(function (p) { return p.id === pathwayId; })[0] || scenario.pathways[0];
    var d = pw.drivers[horizon >= 2050 ? 'y2050' : 'y2030'], cur = scenario.current;
    var w = riskType === 'physical' ? [1, 0] : riskType === 'transition' ? [0, 1] : [0.5, 0.5];
    var phys = d.p, trans = d.t, carbon = riskType === 'physical' ? d.c * 0.35 : d.c;
    var exposure = clamp(w[0] * phys + w[1] * trans, 0, 1);
    var asset = clamp(w[0] * phys * 0.95 + w[1] * trans * 0.55 + 0.05, 0, 1);
    var supply = clamp(w[0] * phys * 0.85 + w[1] * trans * 0.45 + 0.08, 0, 1);
    var base = { exposure: w[0] * cur.p + w[1] * cur.t, carbon: cur.c, asset: w[0] * cur.p * 0.95 + w[1] * cur.t * 0.55 + 0.05, supply: w[0] * cur.p * 0.85 + w[1] * cur.t * 0.45 + 0.08 };
    function out(v, b) { return { v: v, level: level(v), label: LEVELS[level(v)], dir: v > b + 0.05 ? 'up' : v < b - 0.05 ? 'down' : 'flat' }; }
    return {
      pathway: pw, horizon: horizon, riskType: riskType, drivers: { physical: phys, transition: trans, carbon: carbon },
      map: { physical: w[0] * phys, transition: w[1] * trans, carbon: carbon, supply: supply },
      outputs: { exposure: out(exposure, base.exposure), carbon: out(carbon, base.carbon), asset: out(asset, base.asset), supply: out(supply, base.supply) }
    };
  }

  /* One object for the whole intelligence chain. facilities = the map's own asset list. */
  function build(facilities) {
    var fac = facilities || [];
    var carbon = ADAPTERS.carbon(ENTITY, fac), narrative = ADAPTERS.narrative(ENTITY), scenario = ADAPTERS.scenario(ENTITY);
    var rio = {
      entity: ENTITY,
      physical: { level: 'high', label: 'Physical exposure', text: 'Heat · water stress · flood' },
      carbon: carbon, narrative: narrative, scenario: scenario,
      provenance: { source: 'platform simulation architecture', live: false, note: 'Values are simulated product data; no external feed is connected.' }
    };
    rio.evaluate = function (id, horizon, type) { return evaluate(scenario, id, horizon, type); };
    rio.synthesis = function (id, horizon) {
      var ev = evaluate(scenario, id, horizon, 'combined'), ex = ev.outputs.exposure;
      return {
        inputs: [
          { k: 'Current exposure', v: 'High', tone: 'high' }, { k: 'Carbon exposure', v: carbon.exposure === 'high' ? 'High' : 'Moderate', tone: carbon.exposure },
          { k: 'Narrative signal', v: 'Evidence gaps', tone: narrative.signal.level }, { k: 'Scenario ' + horizon, v: ex.label, tone: ex.level >= 2 ? 'high' : 'mod' }
        ],
        intelligence: 'Elevated', materiality: 'High', action: 'Priority 1 · Pune facility', evaluation: ev
      };
    };
    return rio;
  }

  window.CX_RIO = { build: build, adapter: adapter, evaluate: evaluate, entity: ENTITY, levels: LEVELS };
})();
