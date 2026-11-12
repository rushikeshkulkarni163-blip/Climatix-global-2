/* ════════════════════════════════════════════════════════════════════
   CLIMACTIX TERMINAL — LIVE WALKTHROUGH · DEMONSTRATION DATA LAYER
   Exports window.CX_TERMINAL_DEMO

   Everything in this file is a DEMONSTRATION dataset.
   - Scores, indicator values, report records and aggregates are
     illustrative. They are not assessments of any real company.
   - Five profiles carry the names of recognisable listed companies so the
     interface reads realistically; five are synthetic entities.
   - Nothing here is random: every derived value is computed from the
     tables below, so every module shows the same numbers on every load.

   Integration seam: the UI only calls the methods on CX_TERMINAL_DEMO
   (companies(), company(), score(), reports(), ...). To connect live
   services, replace the bodies of those methods with API-backed
   implementations and keep the return shapes.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var YEARS = ['FY2021-22', 'FY2022-23', 'FY2023-24', 'FY2024-25', 'FY2025-26'];
  var CURRENT_FY = YEARS[YEARS.length - 1];

  /* ── Scoring model ─────────────────────────────────────────────── */
  var DIMENSIONS = [
    { key: 'E', name: 'Environmental performance', weight: 25,
      what: 'Measured environmental outcomes: emissions intensity, energy mix, water and waste.',
      indicators: [
        { id: 'e1', label: 'GHG emissions intensity trend', evidence: 'Scope 1 and 2 intensity over at least three reporting periods' },
        { id: 'e2', label: 'Energy mix and renewable share', evidence: 'Energy consumption tables, renewable electricity share' },
        { id: 'e3', label: 'Water withdrawal and stress management', evidence: 'Water withdrawal, discharge and stress-area disclosure' },
        { id: 'e4', label: 'Waste and circularity', evidence: 'Waste generated, diverted and disposed by category' }
      ] },
    { key: 'S', name: 'Social performance', weight: 15,
      what: 'Workforce, value-chain and community outcomes supported by disclosed data.',
      indicators: [
        { id: 's1', label: 'Occupational health and safety', evidence: 'Injury-rate tables, fatalities, safety management coverage' },
        { id: 's2', label: 'Workforce diversity and inclusion', evidence: 'Workforce composition, pay and progression disclosure' },
        { id: 's3', label: 'Value-chain labour practices', evidence: 'Supplier assessments, grievance and remediation records' },
        { id: 's4', label: 'Community impact', evidence: 'Programme outcomes and impact assessments' }
      ] },
    { key: 'G', name: 'Governance performance', weight: 20,
      what: 'How sustainability is overseen, controlled and linked to accountability.',
      indicators: [
        { id: 'g1', label: 'Board oversight of sustainability', evidence: 'Committee charter, meeting frequency, named responsibility' },
        { id: 'g2', label: 'Ethics and compliance record', evidence: 'Policy coverage, reported cases and resolutions' },
        { id: 'g3', label: 'Risk management integration', evidence: 'Sustainability risks in the enterprise risk register' },
        { id: 'g4', label: 'Executive remuneration linkage', evidence: 'Sustainability metrics in variable pay' }
      ] },
    { key: 'C', name: 'Climate strategy', weight: 25,
      what: 'Targets, value-chain coverage, scenario analysis and capital committed to transition.',
      indicators: [
        { id: 'c1', label: 'Net zero target and interim milestones', evidence: 'Target year, base year, interim milestones, boundary' },
        { id: 'c2', label: 'Scope 3 coverage', evidence: 'Categories measured and share of value-chain emissions covered' },
        { id: 'c3', label: 'Scenario analysis and physical-risk assessment', evidence: 'Scenarios used, sites assessed, findings disclosed' },
        { id: 'c4', label: 'Transition capital allocation', evidence: 'Capital expenditure aligned to the stated transition plan' }
      ] },
    { key: 'D', name: 'Disclosure credibility', weight: 15,
      what: 'Whether what is disclosed can be relied on: assurance, consistency, alignment, traceability.',
      indicators: [
        { id: 'd1', label: 'External assurance', evidence: 'Assurance statement, level and scope' },
        { id: 'd2', label: 'Consistency across reports', evidence: 'Same metric reconciles across annual, BRSR and sustainability reports' },
        { id: 'd3', label: 'Framework alignment', evidence: 'BRSR, GRI, TCFD / ISSB index completeness' },
        { id: 'd4', label: 'Data traceability to source', evidence: 'Metrics traceable to a page, table and methodology note' }
      ] }
  ];

  /* Rating bands — a graded scale, never pass / fail. */
  var BANDS = [
    { min: 85, grade: 'AAA', label: 'Leading' },
    { min: 75, grade: 'AA', label: 'Advanced' },
    { min: 65, grade: 'A', label: 'Strong' },
    { min: 55, grade: 'BBB', label: 'Established' },
    { min: 45, grade: 'BB', label: 'Developing' },
    { min: 35, grade: 'B', label: 'Limited' },
    { min: 0, grade: 'CCC', label: 'Weak' }
  ];

  /* Indicator states.
     number  → evidenced: disclosed with traceable evidence, scored 0–100
     'i'     → insufficient evidence: a claim exists but cannot be traced; not scored
     'm'     → not disclosed: no public information located; not scored
     A low evidenced value (< 40) is the only state reported as adverse performance. */
  var ADVERSE_BELOW = 40;

  /* ── Report taxonomy ───────────────────────────────────────────── */
  var CATEGORIES = [
    { key: 'SR', name: 'Sustainability Reports', single: 'Sustainability Report', month: 'Aug', pages: 96,
      frameworks: 'GRI Standards', sections: ['Materiality assessment', 'Environmental performance', 'People and communities', 'Governance', 'GRI content index'] },
    { key: 'ESG', name: 'ESG Reports', single: 'ESG Report', month: 'Sep', pages: 64,
      frameworks: 'GRI · SASB', sections: ['ESG strategy', 'Performance data tables', 'Targets and progress', 'Assurance statement'] },
    { key: 'BRSR', name: 'BRSR Reports', single: 'Business Responsibility and Sustainability Report', month: 'Jul', pages: 58,
      frameworks: 'SEBI BRSR format', sections: ['Section A · General disclosures', 'Section B · Management and process', 'Section C · Principle-wise performance', 'Leadership indicators'] },
    { key: 'NZ', name: 'Net Zero Reports', single: 'Net Zero Report', month: 'Nov', pages: 32,
      frameworks: 'Target and transition-plan disclosure', sections: ['Target boundary', 'Interim milestones', 'Decarbonisation levers', 'Capital plan'] },
    { key: 'CL', name: 'Climate Reports', single: 'Climate Report', month: 'Oct', pages: 44,
      frameworks: 'TCFD · IFRS S2', sections: ['Governance', 'Strategy and scenario analysis', 'Risk management', 'Metrics and targets'] },
    { key: 'AR', name: 'Annual Reports', single: 'Annual Report', month: 'Jul', pages: 312,
      frameworks: 'Statutory annual report', sections: ['Management discussion', 'Board report', 'Sustainability section', 'Financial statements'] }
  ];

  /* ── Companies ─────────────────────────────────────────────────────
     ind:  indicator states in DIMENSIONS order (4 per dimension)
     rel:  reliability — share of evidence under external assurance (0–100)
     hist: public-score change vs the current year for the four prior years
     cov:  indicators disclosed in each of the four prior years
     rep:  availability by category, one character per year in YEARS
     env:  illustrative environmental series parameters (null = not evidenced)
     asm:  company-submitted assessment (never merged into the public score)
     pf:   weight in the demonstration model portfolio (%)                */
  var COMPANIES = [
    { id: 'tata-motors', name: 'Tata Motors', synthetic: false, industry: 'Automobiles', city: 'Mumbai', state: 'Maharashtra',
      overview: 'Automotive manufacturer of passenger, commercial and electric vehicles, headquartered in Mumbai.',
      ind: { E: [68, 64, 71, 66], S: [74, 61, 'i', 72], G: [80, 76, 72, 'm'], C: [76, 58, 'i', 70], D: [72, 70, 78, 'i'] },
      rel: 70, hist: [-9, -6, -4, -2], cov: [13, 14, 15, 16],
      rep: { SR: '01111', ESG: '00111', BRSR: '11111', NZ: '00011', CL: '00111', AR: '11111' },
      env: { ghg: -4, re: [34, 5], water: -3, waste: [78, 3] },
      netZero: { target: 'Net zero by 2040 (passenger vehicles) and 2045 (commercial vehicles)', stated: true, interim: 'Interim milestones disclosed', boundary: 'Scopes 1, 2 and 3' },
      asm: { status: 'Validated', submitted: '14 Sep 2026', items: { s3: [70, 'validated'], g4: [64, 'validated'], d4: [74, 'validated'], c3: [68, 'review'] } },
      pf: 12 },
    { id: 'reliance', name: 'Reliance Industries', synthetic: false, industry: 'Oil, Gas and Chemicals', city: 'Mumbai', state: 'Maharashtra',
      overview: 'Diversified group with businesses across oil-to-chemicals, retail, digital services and new energy.',
      ind: { E: [58, 62, 60, 'i'], S: [70, 58, 'm', 76], G: [74, 72, 70, 62], C: [72, 'i', 64, 78], D: [66, 'i', 74, 62] },
      rel: 64, hist: [-8, -6, -3, -1], cov: [14, 15, 16, 17],
      rep: { SR: '11111', ESG: '00011', BRSR: '11111', NZ: '00111', CL: '00011', AR: '11111' },
      env: { ghg: -2, re: [22, 4], water: -2, waste: null },
      netZero: { target: 'Net carbon zero by 2035', stated: true, interim: 'Interim milestones not located', boundary: 'Scopes 1 and 2' },
      asm: { status: 'Not submitted', items: {} },
      pf: 20 },
    { id: 'infosys', name: 'Infosys', synthetic: false, industry: 'IT Services', city: 'Bengaluru', state: 'Karnataka',
      overview: 'Information technology services and consulting company, headquartered in Bengaluru.',
      ind: { E: [88, 91, 84, 80], S: [82, 86, 'i', 79], G: [90, 88, 85, 74], C: [92, 78, 81, 'i'], D: [90, 86, 88, 84] },
      rel: 86, hist: [-6, -4, -2, -1], cov: [16, 17, 18, 18],
      rep: { SR: '11111', ESG: '11111', BRSR: '11111', NZ: '00111', CL: '01111', AR: '11111' },
      env: { ghg: -6, re: [68, 4], water: -4, waste: [90, 2] },
      netZero: { target: 'Carbon neutral since 2020; net zero by 2040', stated: true, interim: 'Interim milestones disclosed', boundary: 'Scopes 1, 2 and 3' },
      asm: { status: 'Not submitted', items: {} },
      pf: 18 },
    { id: 'lnt', name: 'Larsen & Toubro', synthetic: false, industry: 'Engineering and Construction', city: 'Mumbai', state: 'Maharashtra',
      overview: 'Engineering, construction, manufacturing and services group, headquartered in Mumbai.',
      ind: { E: [66, 60, 74, 62], S: [78, 56, 'i', 70], G: [82, 78, 76, 'm'], C: [70, 'm', 66, 'i'], D: [74, 72, 76, 68] },
      rel: 72, hist: [-7, -5, -3, -1], cov: [14, 15, 16, 16],
      rep: { SR: '11111', ESG: '00011', BRSR: '11111', NZ: '00001', CL: '00011', AR: '11111' },
      env: { ghg: -3, re: [28, 4], water: -5, waste: [70, 3] },
      netZero: { target: 'Carbon neutral by 2040; water neutral by 2035', stated: true, interim: 'Interim milestones disclosed', boundary: 'Scopes 1 and 2' },
      asm: { status: 'Under review', submitted: '02 Nov 2026', items: { c2: [58, 'review'], g4: [70, 'review'], s3: [66, 'review'] } },
      pf: 14 },
    { id: 'mnm', name: 'Mahindra & Mahindra', synthetic: false, industry: 'Automobiles', city: 'Mumbai', state: 'Maharashtra',
      overview: 'Automotive and farm-equipment manufacturer and flagship company of the Mahindra Group.',
      ind: { E: [76, 74, 80, 72], S: [76, 66, 64, 82], G: [84, 80, 74, 68], C: [82, 62, 72, 74], D: [80, 76, 82, 'i'] },
      rel: 78, hist: [-8, -5, -3, -1], cov: [16, 17, 18, 19],
      rep: { SR: '11111', ESG: '01111', BRSR: '11111', NZ: '00111', CL: '00111', AR: '11111' },
      env: { ghg: -5, re: [46, 6], water: -6, waste: [86, 2] },
      netZero: { target: 'Carbon neutral by 2040', stated: true, interim: 'Interim milestones disclosed', boundary: 'Scopes 1 and 2' },
      asm: { status: 'Validated', submitted: '21 Aug 2026', items: { d4: [80, 'validated'] } },
      pf: 10 },
    { id: 'arvalis', name: 'Arvalis Cement', synthetic: true, industry: 'Cement', city: 'Hyderabad', state: 'Telangana',
      overview: 'Synthetic entity created for this demonstration: a mid-sized cement producer with limited public disclosure.',
      ind: { E: [34, 42, 'i', 48], S: [58, 'm', 'm', 60], G: [62, 54, 'i', 'm'], C: ['i', 'm', 38, 'm'], D: ['m', 52, 56, 'i'] },
      rel: 38, hist: [-3, -2, -2, 1], cov: [10, 11, 12, 13],
      rep: { SR: '00011', ESG: '00000', BRSR: '01111', NZ: '00000', CL: '00000', AR: '11111' },
      env: { ghg: 2, re: [9, 1], water: null, waste: [41, 2] },
      netZero: { target: 'Ambition statement without target year', stated: false, interim: 'No interim milestones', boundary: 'Not specified' },
      asm: { status: 'Invited', items: {} },
      pf: 4 },
    { id: 'nordvane', name: 'Nordvane Steel', synthetic: true, industry: 'Metals and Steel', city: 'Kolkata', state: 'West Bengal',
      overview: 'Synthetic entity created for this demonstration: an integrated steel producer with partial climate disclosure.',
      ind: { E: [38, 46, 52, 'i'], S: [44, 50, 'm', 58], G: [66, 60, 58, 'm'], C: [54, 'm', 'i', 48], D: [58, 'i', 62, 50] },
      rel: 52, hist: [-5, -4, -2, -1], cov: [12, 13, 14, 15],
      rep: { SR: '00111', ESG: '00001', BRSR: '01111', NZ: '00001', CL: '00000', AR: '11111' },
      env: { ghg: -1, re: [12, 2], water: -1, waste: null },
      netZero: { target: 'Net zero by 2050', stated: false, interim: 'No interim milestones', boundary: 'Scopes 1 and 2' },
      asm: { status: 'Invited', items: {} },
      pf: 6 },
    { id: 'solwick', name: 'Solwick Power', synthetic: true, industry: 'Power and Utilities', city: 'Ahmedabad', state: 'Gujarat',
      overview: 'Synthetic entity created for this demonstration: a power generator with a thermal-heavy portfolio and a growing renewable base.',
      ind: { E: [36, 58, 44, 50], S: [66, 54, 'i', 62], G: [70, 64, 66, 52], C: [60, 'i', 58, 64], D: [64, 60, 68, 'i'] },
      rel: 58, hist: [-6, -4, -3, -1], cov: [14, 15, 16, 17],
      rep: { SR: '01111', ESG: '00011', BRSR: '01111', NZ: '00011', CL: '00001', AR: '11111' },
      env: { ghg: -2, re: [24, 5], water: -1, waste: [55, 2] },
      netZero: { target: 'Net zero by 2050', stated: false, interim: 'Interim milestones disclosed', boundary: 'Scopes 1 and 2' },
      asm: { status: 'Not submitted', items: {} },
      pf: 8 },
    { id: 'tessara', name: 'Tessara Textiles', synthetic: true, industry: 'Textiles', city: 'Coimbatore', state: 'Tamil Nadu',
      overview: 'Synthetic entity created for this demonstration: a textile manufacturer that publishes very little sustainability information.',
      ind: { E: ['m', 52, 'm', 'i'], S: [60, 'm', 'i', 64], G: [58, 'm', 50, 'm'], C: ['m', 'm', 'm', 'i'], D: ['m', 'i', 44, 'm'] },
      rel: 30, hist: [-2, -1, -1, 0], cov: [6, 7, 8, 9],
      rep: { SR: '00000', ESG: '00000', BRSR: '00111', NZ: '00000', CL: '00000', AR: '11111' },
      env: { ghg: null, re: [14, 2], water: null, waste: null },
      netZero: { target: 'No public commitment located', stated: false, interim: 'Not applicable', boundary: 'Not applicable' },
      asm: { status: 'In validation', submitted: '06 Nov 2026', items: { e1: [56, 'validated'], e3: [48, 'validated'], s2: [62, 'validated'], c1: [50, 'review'] } },
      pf: 0 },
    { id: 'corvane', name: 'Corvane Pharma', synthetic: true, industry: 'Pharmaceuticals', city: 'Hyderabad', state: 'Telangana',
      overview: 'Synthetic entity created for this demonstration: a pharmaceutical manufacturer with consistent, moderately detailed disclosure.',
      ind: { E: [72, 66, 58, 70], S: [78, 74, 66, 70], G: [76, 82, 70, 60], C: [62, 'i', 56, 58], D: [70, 68, 74, 66] },
      rel: 68, hist: [-6, -4, -2, -1], cov: [15, 16, 18, 19],
      rep: { SR: '01111', ESG: '00111', BRSR: '11111', NZ: '00001', CL: '00011', AR: '11111' },
      env: { ghg: -3, re: [38, 5], water: -2, waste: [74, 3] },
      netZero: { target: 'Net zero by 2045', stated: false, interim: 'Interim milestones disclosed', boundary: 'Scopes 1 and 2' },
      asm: { status: 'Not submitted', items: {} },
      pf: 8 }
  ];

  /* Date of the most recent public-data assessment run (day in October 2026). */
  var ASSESSED_DAY = { infosys: 28, mnm: 27, 'tata-motors': 24, lnt: 22, corvane: 20, reliance: 17, solwick: 15, nordvane: 13, tessara: 9, arvalis: 6 };
  COMPANIES.forEach(function (c) {
    c.assessedDay = ASSESSED_DAY[c.id];
    c.assessedOn = (c.assessedDay < 10 ? '0' : '') + c.assessedDay + ' Oct 2026';
  });

  /* ── Platform-level demonstration aggregates ───────────────────────
     bands: share of companies per score band [<40, 40–54, 55–69, 70–84, 85+] */
  var INDUSTRIES = [
    { name: 'Financial Services', companies: 168, assessed: 62, avg: 66, participation: 78, coverage: 64, bands: [3, 14, 44, 33, 6] },
    { name: 'Diversified and Consumer', companies: 158, assessed: 54, avg: 59, participation: 66, coverage: 55, bands: [7, 27, 43, 20, 3] },
    { name: 'IT Services', companies: 142, assessed: 52, avg: 74, participation: 84, coverage: 73, bands: [1, 7, 28, 49, 15] },
    { name: 'Pharmaceuticals', companies: 132, assessed: 44, avg: 62, participation: 70, coverage: 58, bands: [5, 22, 45, 24, 4] },
    { name: 'Textiles', companies: 126, assessed: 30, avg: 51, participation: 41, coverage: 36, bands: [16, 42, 32, 9, 1] },
    { name: 'Engineering and Construction', companies: 118, assessed: 40, avg: 61, participation: 68, coverage: 56, bands: [6, 23, 46, 22, 3] },
    { name: 'Automobiles', companies: 96, assessed: 34, avg: 63, participation: 74, coverage: 61, bands: [4, 20, 45, 27, 4] },
    { name: 'Metals and Steel', companies: 88, assessed: 26, avg: 49, participation: 58, coverage: 47, bands: [20, 44, 28, 7, 1] },
    { name: 'Oil, Gas and Chemicals', companies: 84, assessed: 28, avg: 54, participation: 72, coverage: 57, bands: [11, 38, 38, 12, 1] },
    { name: 'Power and Utilities', companies: 74, assessed: 24, avg: 52, participation: 65, coverage: 52, bands: [14, 41, 34, 10, 1] },
    { name: 'Cement', companies: 62, assessed: 18, avg: 47, participation: 55, coverage: 44, bands: [23, 46, 25, 5, 1] }
  ];
  var BAND_LABELS = ['Below 40', '40–54', '55–69', '70–84', '85 and above'];

  var REGIONS = [
    { name: 'Maharashtra', companies: 312, assessed: 118 },
    { name: 'Delhi NCR', companies: 172, assessed: 58 },
    { name: 'Gujarat', companies: 158, assessed: 46 },
    { name: 'Karnataka', companies: 148, assessed: 52 },
    { name: 'Tamil Nadu', companies: 136, assessed: 40 },
    { name: 'Telangana', companies: 96, assessed: 30 },
    { name: 'West Bengal', companies: 64, assessed: 16 },
    { name: 'Rest of India', companies: 162, assessed: 52 }
  ];

  var REPORT_TOTALS = { SR: 1180, ESG: 742, BRSR: 1964, NZ: 318, CL: 486, AR: 2242 };

  /* Share of indexed companies publishing each disclosure type, by year (%). */
  var PARTICIPATION = {
    BRSR: [38, 71, 76, 79, 81],
    SR: [22, 26, 31, 35, 39],
    CL: [4, 7, 11, 15, 19],
    NZ: [3, 5, 8, 11, 13]
  };

  /* Sector-level environmental indicators (illustrative aggregates). */
  var SECTOR_ENV = [
    { name: 'Cement', ghgDisclosed: 52, renewables: 11, waterDisclosed: 38, targets: 21 },
    { name: 'Metals and Steel', ghgDisclosed: 57, renewables: 13, waterDisclosed: 44, targets: 26 },
    { name: 'Power and Utilities', ghgDisclosed: 68, renewables: 27, waterDisclosed: 51, targets: 34 },
    { name: 'Oil, Gas and Chemicals', ghgDisclosed: 71, renewables: 18, waterDisclosed: 55, targets: 37 },
    { name: 'Textiles', ghgDisclosed: 33, renewables: 16, waterDisclosed: 29, targets: 9 },
    { name: 'Automobiles', ghgDisclosed: 76, renewables: 39, waterDisclosed: 66, targets: 48 },
    { name: 'IT Services', ghgDisclosed: 86, renewables: 58, waterDisclosed: 72, targets: 61 }
  ];

  var PLANS = [
    { id: 'bank', audience: 'Banks and financial institutions', type: 'pilot', route: 'bank',
      term: 'Six-month complimentary pilot',
      features: ['Institutional dashboard', 'Company intelligence search', 'Corporate screening by industry and score', 'Disclosure-gap and risk-indicator views', 'Company intelligence summaries'] },
    { id: 'insurance', audience: 'Insurance companies', type: 'pilot', route: 'insurance',
      term: 'Six-month complimentary pilot',
      features: ['Sustainability intelligence', 'Company screening', 'Environmental exposure indicators', 'Climate disclosure analysis', 'Industry comparison'] },
    { id: 'investor', audience: 'Investment firms', type: 'pilot', route: 'investor',
      term: 'Six-month complimentary pilot',
      features: ['Portfolio intelligence', 'Company comparisons', 'Net zero commitment analysis', 'Disclosure credibility view', 'Intelligence reports'] },
    { id: 'company', audience: 'Companies', type: 'paid', route: 'assessment',
      term: 'Report hosting subscription',
      features: ['Company profile', 'Report repository hosting', 'Public-data assessment', 'Additional company assessment workflow', 'Assessment status tracking'] }
  ];

  /* ── Helpers ───────────────────────────────────────────────────── */
  function hash(str) {            // deterministic, stable across loads
    var h = 7;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100003;
    return h;
  }
  function round(n) { return Math.round(n); }
  function band(score) {
    if (score == null) return { grade: 'NR', label: 'Not rated' };
    for (var i = 0; i < BANDS.length; i++) if (score >= BANDS[i].min) return BANDS[i];
    return BANDS[BANDS.length - 1];
  }
  function byId(id) {
    for (var i = 0; i < COMPANIES.length; i++) if (COMPANIES[i].id === id) return COMPANIES[i];
    return null;
  }

  /* ── Scoring engine (transparent, deterministic) ───────────────────
     view: 'public'   — publicly available information only
           'assessed' — public information plus VALIDATED company-submitted
                        items. Items under review are listed, never counted.
     The public score is always computed from public inputs alone.       */
  var cache = {};
  function score(id, view) {
    view = view || 'public';
    var key = id + '|' + view;
    if (cache[key]) return cache[key];
    var c = byId(id);
    if (!c) return null;

    var total = 0, disclosed = 0, evidenced = 0, missing = 0, insufficient = 0, adverse = 0;
    var weightSum = 0, weighted = 0;

    var dims = DIMENSIONS.map(function (d) {
      var sum = 0, n = 0;
      var inds = d.indicators.map(function (def, i) {
        var raw = c.ind[d.key][i];
        var sub = c.asm.items[def.id] || null;
        var item = { id: def.id, label: def.label, evidence: def.evidence, dim: d.key,
                     state: null, value: null, source: 'Public disclosure', submission: null };
        if (typeof raw === 'number') { item.state = 'evidenced'; item.value = raw; }
        else if (raw === 'i') { item.state = 'insufficient'; item.source = 'Claim located, evidence not traceable'; }
        else { item.state = 'missing'; item.source = 'No public disclosure located'; }

        if (sub) {
          item.submission = { value: sub[0], status: sub[1] };
          if (view === 'assessed' && sub[1] === 'validated' && item.state !== 'evidenced') {
            item.state = 'evidenced'; item.value = sub[0];
            item.source = 'Company submission, validated';
            item.fromAssessment = true;
          }
        }
        item.adverse = item.state === 'evidenced' && item.value < ADVERSE_BELOW;

        total++;
        if (item.state === 'evidenced') { evidenced++; disclosed++; sum += item.value; n++; if (item.adverse) adverse++; }
        else if (item.state === 'insufficient') { insufficient++; disclosed++; }
        else missing++;
        return item;
      });
      var s = n ? sum / n : null;                       // unscored items are excluded, never counted as zero
      if (s != null) { weightSum += d.weight; weighted += s * d.weight; }
      return { key: d.key, name: d.name, weight: d.weight, what: d.what,
               score: s == null ? null : round(s), scored: n, of: inds.length, indicators: inds };
    });

    var overall = weightSum ? round(weighted / weightSum) : null;
    var completeness = round(disclosed / total * 100);
    var traceability = disclosed ? round(evidenced / disclosed * 100) : 0;
    var reliability = c.rel;
    var conf = round(0.4 * completeness + 0.3 * traceability + 0.3 * reliability);

    var out = {
      id: id, view: view, overall: overall, band: band(overall), dims: dims,
      counts: { total: total, evidenced: evidenced, insufficient: insufficient, missing: missing, adverse: adverse, disclosed: disclosed },
      confidence: { value: conf, band: conf >= 75 ? 'High' : conf >= 55 ? 'Moderate' : 'Low',
                    completeness: completeness, traceability: traceability, reliability: reliability },
      weightScored: weightSum
    };
    cache[key] = out;
    return out;
  }

  function history(id) {
    var c = byId(id), now = score(id).overall;
    return YEARS.map(function (fy, i) {
      return { fy: fy, score: i < 4 ? now + c.hist[i] : now,
               disclosed: i < 4 ? c.cov[i] : score(id).counts.disclosed };
    });
  }

  function gaps(id) {
    var out = { missing: [], insufficient: [], adverse: [] };
    score(id).dims.forEach(function (d) {
      d.indicators.forEach(function (it) {
        if (it.state === 'missing') out.missing.push(it);
        else if (it.state === 'insufficient') out.insufficient.push(it);
        else if (it.adverse) out.adverse.push(it);
      });
    });
    return out;
  }

  function envSeries(id) {
    var c = byId(id), e = c.env;
    function index(rate) {                               // FY2021-22 = 100
      return YEARS.map(function (_, i) { return round(100 * Math.pow(1 + rate / 100, i)); });
    }
    function share(p) {
      return YEARS.map(function (_, i) { return Math.max(0, p[0] - p[1] * (4 - i)); });
    }
    return [
      { key: 'ghg', indicator: 'e1', label: 'GHG intensity index', unit: 'FY2021-22 = 100', lowerBetter: true, series: e.ghg == null ? null : index(e.ghg) },
      { key: 're', indicator: 'e2', label: 'Renewable electricity share', unit: '%', lowerBetter: false, series: e.re == null ? null : share(e.re) },
      { key: 'water', indicator: 'e3', label: 'Water intensity index', unit: 'FY2021-22 = 100', lowerBetter: true, series: e.water == null ? null : index(e.water) },
      { key: 'waste', indicator: 'e4', label: 'Waste diverted from disposal', unit: '%', lowerBetter: false, series: e.waste == null ? null : share(e.waste) }
    ];
  }

  /* ── Report records (generated once, deterministically) ────────── */
  var REPORTS = [];
  COMPANIES.forEach(function (c) {
    CATEGORIES.forEach(function (cat) {
      YEARS.forEach(function (fy, y) {
        if (c.rep[cat.key].charAt(y) !== '1') return;
        var id = c.id + '-' + cat.key + '-' + fy;
        var h = hash(id);
        var pages = cat.pages + (h % 37) - 12 + y * 3;
        var assured = (cat.key === 'SR' || cat.key === 'BRSR' || cat.key === 'ESG') && typeof c.ind.D[0] === 'number' && y >= 2;
        var endYear = 2022 + y;
        REPORTS.push({
          id: id, companyId: c.id, company: c.name, category: cat.key, categoryName: cat.single, fy: fy, yearIndex: y,
          title: cat.single + ' ' + fy,
          pages: pages, sizeMb: (pages * 0.11 + 0.8).toFixed(1),
          frameworks: cat.frameworks, sections: cat.sections,
          assurance: assured ? 'Limited assurance statement located' : 'No assurance statement located',
          published: (3 + h % 24) + ' ' + cat.month + ' ' + endYear,
          sortKey: endYear * 10000 + ['Jul', 'Aug', 'Sep', 'Oct', 'Nov'].indexOf(cat.month) * 100 + (3 + h % 24),
          dataPoints: 40 + (h % 140) + y * 12,
          source: c.synthetic ? 'Synthetic record' : 'Demonstration record'
        });
      });
    });
  });

  function reports(filter) {
    filter = filter || {};
    return REPORTS.filter(function (r) {
      return (!filter.company || r.companyId === filter.company) &&
             (!filter.category || r.category === filter.category) &&
             (!filter.fy || r.fy === filter.fy);
    }).sort(function (a, b) { return b.sortKey - a.sortKey || (a.company < b.company ? -1 : 1); });
  }

  function search(q) {
    q = (q || '').trim().toLowerCase();
    if (!q) return COMPANIES.slice();
    return COMPANIES.filter(function (c) {
      return (c.name + ' ' + c.industry + ' ' + c.city + ' ' + c.state).toLowerCase().indexOf(q) !== -1;
    });
  }

  function platform() {
    var companies = 0, assessed = 0, scoreSum = 0, reportsTotal = 0;
    INDUSTRIES.forEach(function (i) { companies += i.companies; assessed += i.assessed; scoreSum += i.avg * i.companies; });
    Object.keys(REPORT_TOTALS).forEach(function (k) { reportsTotal += REPORT_TOTALS[k]; });
    return { companies: companies, assessed: assessed, reports: reportsTotal,
             avgScore: Math.round(scoreSum / companies * 10) / 10,
             industries: INDUSTRIES, regions: REGIONS, reportTotals: REPORT_TOTALS,
             participation: PARTICIPATION, sectorEnv: SECTOR_ENV, bandLabels: BAND_LABELS };
  }

  function portfolio() {
    var holdings = COMPANIES.filter(function (c) { return c.pf > 0; }).map(function (c) {
      var s = score(c.id);
      return { company: c, weight: c.pf, score: s.overall, confidence: s.confidence.value, credibility: s.dims[4].score };
    }).sort(function (a, b) { return b.weight - a.weight; });
    var ws = 0, wc = 0, wd = 0, stated = 0, interim = 0;
    holdings.forEach(function (h) {
      ws += h.score * h.weight; wc += h.confidence * h.weight; wd += (h.credibility || 0) * h.weight;
      if (h.company.netZero.target.indexOf('by 20') !== -1 || h.company.netZero.target.indexOf('since') !== -1) stated += h.weight;
      if (h.company.netZero.interim === 'Interim milestones disclosed') interim += h.weight;
    });
    var hist = YEARS.map(function (fy, i) {
      var t = 0;
      holdings.forEach(function (h) { t += history(h.company.id)[i].score * h.weight; });
      return { fy: fy, score: Math.round(t / 100) };
    });
    return { name: 'Demonstration model portfolio', holdings: holdings,
             score: Math.round(ws / 100), confidence: Math.round(wc / 100), credibility: Math.round(wd / 100),
             targetWeight: stated, interimWeight: interim, history: hist };
  }

  window.CX_TERMINAL_DEMO = {
    meta: {
      label: 'Demonstration data',
      asOf: '31 October 2026',
      currentFy: CURRENT_FY,
      notice: 'All records, scores and aggregates in this terminal are illustrative demonstration data. They are not assessments of any real company and must not be relied on for any decision.'
    },
    years: YEARS, dimensions: DIMENSIONS, bands: BANDS, categories: CATEGORIES, plans: PLANS,
    adverseBelow: ADVERSE_BELOW,
    companies: function () { return COMPANIES.slice(); },
    company: byId,
    search: search,
    score: score,
    band: band,
    history: history,
    gaps: gaps,
    envSeries: envSeries,
    reports: reports,
    report: function (id) { for (var i = 0; i < REPORTS.length; i++) if (REPORTS[i].id === id) return REPORTS[i]; return null; },
    category: function (k) { for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].key === k) return CATEGORIES[i]; return null; },
    platform: platform,
    portfolio: portfolio
  };
})();
