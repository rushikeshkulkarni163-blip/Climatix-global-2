/**
 * frics-market-data.js — FRICS™ marketplace data layer (window.FRICS_MARKET).
 *
 * The FRICS marketplace is a standalone Climactix product: any eligible company can explore
 * resilience projects and acquire FRICS. It does not depend on a Green Rating.
 *
 * Everything the marketplace UI shows comes from this object, so real records can replace the
 * configuration without touching markup:
 *
 *   FRICS_MARKET.update({
 *     reference: { label: 'Benchmark name', value: 18.4, asOf: '2026-09-01', source: 'Feed name' },
 *     projects:  [{ id: 'water', price: 18.4, inventory: 24000, status: 'available' }],
 *     registry:  [{ batch: 'FRICS-000124', project: 'water', quantity: 1000, price: 18.4, issued: '…',
 *                   owner: '…', allocation: '…', status: 'acquired', impact: '…', verification: '…', retirement: null }]
 *   });
 *
 * update() merges by project id, then fires `frics:market-update` on document; the UI re-renders.
 * A project price of null means "not yet connected" and renders as the $XX placeholder; the formula
 * and total stay live (qty × price) as soon as a numeric price arrives. Price is per project — it
 * can be project-linked, methodology-linked or market-benchmark-linked (`priceBasis`).
 *
 * Nothing here is an issued credit, a completed transaction or a verified result. Project records
 * are project TYPES until a real project is connected: no locations, organisations or named farmers.
 */
(function () {
  'use strict';
  if (window.FRICS_MARKET) return;

  var M = {
    currency: 'USD',
    reference: null,                                   // { label, value, asOf, source } once a benchmark feed is connected

    themes: [
      { id: 'water',      name: 'Water resilience',         short: 'Water' },
      { id: 'soil',       name: 'Soil resilience',          short: 'Soil' },
      { id: 'crop',       name: 'Crop resilience',          short: 'Crop' },
      { id: 'livelihood', name: 'Livelihood resilience',    short: 'Livelihood' },
      { id: 'food',       name: 'Food supply resilience',   short: 'Food supply' },
      { id: 'eco',        name: 'Agroecological resilience', short: 'Ecology' }
    ],

    impactTypes: ['Water security', 'Soil health', 'Yield stability', 'Income stability', 'Supply continuity', 'Ecosystem function'],

    priceBases: {
      project:     { name: 'Project-linked',          line: 'Priced from the cost and scope of the individual project.' },
      methodology: { name: 'Methodology-linked',      line: 'Priced from the impact methodology applied to the project.' },
      benchmark:   { name: 'Market benchmark-linked', line: 'Indexed to a published market reference.' }
    },

    /* The eight stages of a FRICS. `field` = the registry field that records the stage. */
    lifecycle: [
      { id: 'listed',    name: 'Project listed',   field: 'Project',        line: 'A resilience project is described and listed.' },
      { id: 'available', name: 'FRICS available',  field: 'Credit quantity', line: 'Inventory is opened for acquisition at the project price.' },
      { id: 'acquired',  name: 'Acquired',         field: 'Owner',          line: 'An eligible company acquires FRICS.' },
      { id: 'allocated', name: 'Allocated',        field: 'Allocation',     line: 'The acquisition is allocated to the project.' },
      { id: 'deployed',  name: 'Capital deployed', field: 'Allocation',     line: 'Capital is released to project interventions.' },
      { id: 'monitored', name: 'Impact monitored', field: 'Impact',         line: 'Project indicators are measured against a baseline.' },
      { id: 'verified',  name: 'Impact verified',  field: 'Verification',   line: 'Independent verification is recorded where evidence exists.', gated: true },
      { id: 'retired',   name: 'Completed / retired', field: 'Retirement',  line: 'The FRICS is completed or retired and can no longer be transferred.', gated: true }
    ],

    /* Project-level integrity layer. Each project page holds these eight records. */
    integrity: [
      { id: 'methodology', name: 'Impact methodology',  line: 'How impact is defined and calculated' },
      { id: 'evidence',    name: 'Evidence',            line: 'Data and documents behind each claim' },
      { id: 'measurement', name: 'Measurement approach', line: 'Baselines, indicators and monitoring cadence' },
      { id: 'verification', name: 'Verification status', line: 'Independent review, where it exists' },
      { id: 'risk',        name: 'Project risk',        line: 'Delivery, climate and counterparty risk' },
      { id: 'confidence',  name: 'Impact confidence',   line: 'Confidence in the measured outcome' },
      { id: 'documents',   name: 'Project documentation', line: 'Design, agreements and reports' },
      { id: 'capital',     name: 'Capital allocation',  line: 'How each unit of capital is applied' }
    ],

    /* How a project's capital is structured. Shares are set per project at listing. */
    fundStructure: [
      { id: 'field',      name: 'Field implementation',      line: 'Interventions on farms and in farm systems' },
      { id: 'monitoring', name: 'Monitoring & measurement',  line: 'Baselines, indicators and evidence' },
      { id: 'delivery',   name: 'Programme delivery',        line: 'Coordination, training and administration' }
    ],

    registry: {
      idFormat: 'FRICS-######',
      fields: [
        { k: 'batch',        name: 'Batch identifier', line: 'Unique, sequential; assigned only at issuance' },
        { k: 'project',      name: 'Project',          line: 'The listed resilience project' },
        { k: 'quantity',     name: 'Credit quantity',  line: 'FRICS in the batch' },
        { k: 'price',        name: 'Price',            line: 'Per-FRICS price at issue' },
        { k: 'issued',       name: 'Issue date',       line: 'Date the batch was issued' },
        { k: 'owner',        name: 'Owner',            line: 'Current holder of the batch' },
        { k: 'allocation',   name: 'Allocation',       line: 'Project and interventions funded' },
        { k: 'status',       name: 'Status',           line: 'Position in the FRICS lifecycle' },
        { k: 'impact',       name: 'Impact',           line: 'Monitored indicators' },
        { k: 'verification', name: 'Verification',     line: 'Verification record, where it exists' },
        { k: 'retirement',   name: 'Retirement',       line: 'Completion or retirement record' }
      ],
      batches: []                                      // empty until FRICS are genuinely issued
    },

    /* Project TYPES awaiting connected inventory. price: null → not yet connected. */
    projects: [
      {
        id: 'water', theme: 'water', name: 'Farmer Water Security', status: 'available', stage: 'available',
        inventory: 25000, price: null, priceBasis: 'project',
        impactTypes: ['Water security', 'Yield stability'], areas: ['Water', 'Crop', 'Food security'], focus: 'Water + food resilience',
        objective: 'Strengthen the reliability of water for farming households, reducing exposure to drought and irregular rainfall.',
        interventions: [
          { n: 'Water efficiency',           d: 'On-farm irrigation and application efficiency' },
          { n: 'Farm water management',      d: 'Storage, harvesting and scheduling of water' },
          { n: 'Resilience infrastructure',  d: 'Shared water assets that buffer dry periods' }
        ],
        metrics: [
          { n: 'Farmers reached',        u: 'households' },
          { n: 'Area supported',         u: 'hectares' },
          { n: 'Water-use efficiency',   u: 'index vs baseline' },
          { n: 'Water storage capacity', u: 'cubic metres' }
        ]
      },
      {
        id: 'soil', theme: 'soil', name: 'Soil Health & Moisture Resilience', status: 'available', stage: 'available',
        inventory: 18000, price: null, priceBasis: 'methodology',
        impactTypes: ['Soil health', 'Water security'], areas: ['Soil', 'Water', 'Crop'], focus: 'Soil + water retention',
        objective: 'Rebuild soil structure and organic matter so farmland holds more moisture and recovers faster from heat and dry spells.',
        interventions: [
          { n: 'Organic matter restoration', d: 'Amendments and cover that rebuild topsoil' },
          { n: 'Moisture retention',         d: 'Mulching and conservation tillage' },
          { n: 'Erosion control',            d: 'Contour and vegetative barriers' }
        ],
        metrics: [
          { n: 'Farmers reached',      u: 'households' },
          { n: 'Area supported',       u: 'hectares' },
          { n: 'Soil organic matter',  u: 'percent' },
          { n: 'Moisture retention',   u: 'index vs baseline' }
        ]
      },
      {
        id: 'crop', theme: 'crop', name: 'Climate-Adapted Crop Systems', status: 'available', stage: 'available',
        inventory: 12500, price: null, priceBasis: 'project',
        impactTypes: ['Yield stability'], areas: ['Crop', 'Food security'], focus: 'Crop + yield stability',
        objective: 'Help farmers move to crops, varieties and practices that hold yield under heat, water stress and shifting seasons.',
        interventions: [
          { n: 'Climate-adapted varieties', d: 'Seed and variety selection for local stress' },
          { n: 'Crop diversification',      d: 'Rotations and intercrops that spread risk' },
          { n: 'Advisory & early warning',  d: 'Agronomic guidance timed to weather signals' }
        ],
        metrics: [
          { n: 'Farmers reached',        u: 'households' },
          { n: 'Area supported',         u: 'hectares' },
          { n: 'Yield stability',        u: 'variance vs baseline' },
          { n: 'Adapted-variety uptake', u: 'percent of area' }
        ]
      },
      {
        id: 'livelihood', theme: 'livelihood', name: 'Farmer Livelihood Stability', status: 'opening', stage: 'listed',
        inventory: 15000, price: null, priceBasis: 'project',
        impactTypes: ['Income stability'], areas: ['Livelihood', 'Food security'], focus: 'Income + household resilience',
        objective: 'Stabilise farm household income against climate shocks through diversified earnings, skills and access to financial protection.',
        interventions: [
          { n: 'Income diversification', d: 'Additional on-farm and off-farm earnings' },
          { n: 'Training & extension',   d: 'Practical skills for resilient farming' },
          { n: 'Risk-transfer access',   d: 'Access to insurance and contingency finance' }
        ],
        metrics: [
          { n: 'Households reached',    u: 'households' },
          { n: 'Income stability',      u: 'index vs baseline' },
          { n: 'Training participation', u: 'participants' },
          { n: 'Risk-transfer access',  u: 'households covered' }
        ]
      },
      {
        id: 'food', theme: 'food', name: 'Food Supply Continuity', status: 'available', stage: 'available',
        inventory: 20000, price: null, priceBasis: 'benchmark',
        impactTypes: ['Supply continuity'], areas: ['Food security', 'Supply chain'], focus: 'Post-harvest + supply chain',
        objective: 'Reduce loss between farm and market and keep supply moving when weather or logistics are disrupted.',
        interventions: [
          { n: 'Post-harvest storage',      d: 'Storage that protects harvested produce' },
          { n: 'Aggregation & market links', d: 'Collective handling and buyer connections' },
          { n: 'Logistics resilience',      d: 'Routes and handling that survive disruption' }
        ],
        metrics: [
          { n: 'Farmers reached',      u: 'households' },
          { n: 'Post-harvest loss',    u: 'percent' },
          { n: 'Supply continuity',    u: 'days of supply' },
          { n: 'Volume aggregated',    u: 'tonnes' }
        ]
      },
      {
        id: 'eco', theme: 'eco', name: 'Agroecological Diversification', status: 'opening', stage: 'listed',
        inventory: 10000, price: null, priceBasis: 'benchmark',
        impactTypes: ['Ecosystem function', 'Soil health'], areas: ['Ecology', 'Soil', 'Crop'], focus: 'Ecosystem function + farm biodiversity',
        objective: 'Restore the ecological functions that farms depend on — pollination, soil life, shade and pest regulation.',
        interventions: [
          { n: 'Agroforestry',            d: 'Trees integrated with crops and pasture' },
          { n: 'Habitat & pollinators',   d: 'Margins and corridors that support beneficial species' },
          { n: 'Integrated pest management', d: 'Lower-input pest regulation' }
        ],
        metrics: [
          { n: 'Farmers reached',          u: 'households' },
          { n: 'Area supported',           u: 'hectares' },
          { n: 'Biodiversity indicator',   u: 'index vs baseline' },
          { n: 'Vegetative cover',         u: 'hectares' }
        ]
      }
    ]
  };

  /* ── formatting: one place, so a connected price flows through every surface ── */
  var F = M.format = {
    int: function (n) { return Math.round(n).toLocaleString('en-US'); },
    price: function (p) { return (p == null || isNaN(p)) ? '$XX' : '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); },
    total: function (qty, p) {
      if (p != null && !isNaN(p)) return '$' + Math.round(qty * p).toLocaleString('en-US');
      var d = Math.max(1, String(Math.round(qty)).length), s = '';                   // masked to the size of the order: 1,000 → $X,XXX
      for (var i = 0; i < d; i++) s = 'X' + s;
      return '$' + s.replace(/\B(?=(X{3})+(?!X))/g, ',');
    },
    priced: function (p) { return p != null && !isNaN(p); }
  };

  M.byId = function (id) { for (var i = 0; i < M.projects.length; i++) if (M.projects[i].id === id) return M.projects[i]; return null; };
  M.theme = function (id) { for (var i = 0; i < M.themes.length; i++) if (M.themes[i].id === id) return M.themes[i]; return null; };
  M.stage = function (id) { for (var i = 0; i < M.lifecycle.length; i++) if (M.lifecycle[i].id === id) return M.lifecycle[i]; return null; };
  M.inventoryTotal = function () { return M.projects.reduce(function (s, p) { return s + (p.status === 'available' ? p.inventory : 0); }, 0); };

  /* connect real records: merge by project id, then tell the UI */
  M.update = function (patch) {
    patch = patch || {};
    if (patch.reference !== undefined) M.reference = patch.reference;
    (patch.projects || []).forEach(function (p) { var t = M.byId(p.id); if (t) for (var k in p) if (k !== 'id') t[k] = p[k]; });
    if (patch.registry) M.registry.batches = patch.registry;
    document.dispatchEvent(new CustomEvent('frics:market-update'));
  };

  window.FRICS_MARKET = M;
})();
