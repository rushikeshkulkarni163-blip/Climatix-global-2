/* ═══════════════════════════════════════════════════════════════════════
   CLIMACTIX RISK OS™ — Industry Ontology (client-side JS port)
   Mirrors backend/services/industry_ontology.py's IndustryConfig entries
   and functions/main.py's _SECTOR_LABEL_TO_CODE / _PILLAR_TO_CLAYER maps,
   verbatim, so the client-side industry question gate and the server-side
   materiality scan never diverge on what "banking" or "CRITICAL" mean.

   Classic global-scope script (not an ES module) — loaded via <script src>
   before climate-risk-os.html's inline scripts, matching the page's
   existing convention (every question card handler is a bare `onclick`).

   Only the 5 industries targeted by this build (banking, energy, oil_gas,
   manufacturing, real_estate) have full IndustryConfig ports below.
   Remaining industries fall back to "default" — exactly like the backend's
   materiality scan does for a sector it doesn't recognize — so nothing
   breaks for a non-target sector; they simply see only universal questions
   until their IndustryConfig is ported in a future pass.
   ═══════════════════════════════════════════════════════════════════════ */

const INDUSTRY_ONTOLOGY = {
  banking: {
    code: 'banking', label: 'Banking & Financial Services', sectorGroup: 'Financial',
    pillarWeights: { governance: 0.20, physical_risk: 0.10, transition_risk: 0.25, disclosure: 0.20, resilience: 0.10, financial_materiality: 0.15 },
    materialIndicators: ['financed_emissions', 'portfolio_transition_risk', 'climate_lending_exposure', 'green_finance_ratio', 'climate_stress_test', 'pcaf_alignment'],
    primaryPhysicalHazards: ['flood', 'sea_level', 'heat_stress'],
    primaryTransitionRisks: ['regulatory', 'portfolio_stranding', 'credit_risk'],
    applicableFrameworks: ['TCFD', 'ISSB S2', 'PCAF', 'NGFS', 'RBI Climate Guidelines'],
  },
  oil_gas: {
    code: 'oil_gas', label: 'Oil & Gas', sectorGroup: 'Energy',
    pillarWeights: { governance: 0.12, physical_risk: 0.15, transition_risk: 0.30, disclosure: 0.13, resilience: 0.12, financial_materiality: 0.18 },
    materialIndicators: ['scope3_absolute_emissions', 'stranded_asset_value', 'carbon_price_exposure', 'reserve_life_index', 'capex_fossil_vs_clean', 'methane_intensity', 'flaring_intensity'],
    primaryPhysicalHazards: ['cyclone', 'sea_level', 'flood', 'heat_stress'],
    primaryTransitionRisks: ['carbon_tax', 'demand_destruction', 'stranded_assets', 'CBAM', 'ETS'],
    applicableFrameworks: ['TCFD', 'ISSB S2', 'GRI 305', 'CDP', 'OGCI'],
  },
  energy: {
    code: 'energy', label: 'Energy & Utilities', sectorGroup: 'Energy',
    pillarWeights: { governance: 0.13, physical_risk: 0.18, transition_risk: 0.28, disclosure: 0.13, resilience: 0.15, financial_materiality: 0.13 },
    materialIndicators: ['fuel_mix', 'carbon_intensity_kwh', 'stranded_thermal_assets', 'renewable_capacity_pct', 'water_withdrawal_per_kwh', 'grid_resilience'],
    primaryPhysicalHazards: ['water_stress', 'heat_stress', 'flood', 'cyclone'],
    primaryTransitionRisks: ['carbon_pricing', 'fuel_transition', 'stranded_coal', 'ETS'],
    applicableFrameworks: ['TCFD', 'ISSB S2', 'GRI 302', 'CDP', 'EU Taxonomy'],
  },
  manufacturing: {
    code: 'manufacturing', label: 'Manufacturing & Industrials', sectorGroup: 'Industrial',
    pillarWeights: { governance: 0.14, physical_risk: 0.18, transition_risk: 0.24, disclosure: 0.14, resilience: 0.15, financial_materiality: 0.15 },
    materialIndicators: ['energy_intensity', 'water_consumption', 'supply_chain_disruption_risk', 'scope3_upstream_exposure', 'process_heat_decarbonization', 'CBAM_tariff_exposure'],
    primaryPhysicalHazards: ['flood', 'heat_stress', 'water_stress'],
    primaryTransitionRisks: ['carbon_tax', 'CBAM', 'energy_cost', 'technology'],
    applicableFrameworks: ['TCFD', 'ISSB S2', 'GRI 305', 'BRSR', 'ISO 14001'],
  },
  real_estate: {
    code: 'real_estate', label: 'Real Estate & Infrastructure', sectorGroup: 'Real Estate',
    pillarWeights: { governance: 0.15, physical_risk: 0.30, transition_risk: 0.18, disclosure: 0.14, resilience: 0.15, financial_materiality: 0.08 },
    materialIndicators: ['flood_zone_asset_value', 'building_energy_rating', 'urban_heat_island_exposure', 'green_building_certification_pct', 'sea_level_risk_portfolio', 'tenant_climate_risk'],
    primaryPhysicalHazards: ['flood', 'sea_level', 'heat_stress', 'wildfire'],
    primaryTransitionRisks: ['building_regulation', 'stranded_brown_assets', 'energy_standards'],
    applicableFrameworks: ['TCFD', 'ISSB S2', 'GRESB', 'EU Taxonomy', 'BRSR'],
  },
};

// Verbatim port of functions/main.py's _SECTOR_LABEL_TO_CODE — same label
// strings as the fSector <option> text (climate-risk-os.html ~2340-2359),
// same fallback-to-"default" behavior for sectors with no full ontology
// entry yet. Keeping this identical to the backend map means a company's
// stored `sector` label resolves to the same industry code on the client
// (question gating) and on the server (materiality scan) — never diverges.
const SECTOR_LABEL_TO_CODE = {
  'Banking & Financial Services': 'banking',
  'Insurance': 'insurance',
  'Energy (Oil & Gas)': 'oil_gas',
  'Renewable Energy': 'renewables',
  'Mining & Metals': 'mining',
  'Chemicals & Materials': 'chemicals',
  'Manufacturing & Industrials': 'manufacturing',
  'Real Estate & Infrastructure': 'real_estate',
  'Agriculture & Food': 'agriculture',
  'Technology & Data Centers': 'it_technology',
  'Retail & Consumer': 'retail_consumer',
  'Healthcare & Pharmaceuticals': 'pharmaceuticals',
  'Construction & Engineering': 'construction',
  'Utilities (Water, Waste, Grid)': 'energy', // "Power & Utilities" content maps here
};

// Verbatim port of functions/main.py's _PILLAR_TO_CLAYER.
const PILLAR_TO_CLAYER = {
  governance: 'c_core',
  physical_risk: 'c_risk_p',
  transition_risk: 'c_risk_t',
  disclosure: 'c_truth',
  resilience: 'c_adapt',
  financial_materiality: 'c_fin',
};

// Verbatim port of functions/main.py's _materiality_level() thresholds —
// used by the industry-question authoring template (risk-os-questions-
// industry.js) to derive sev/mat consistently with the server-side scan.
function materialityLevelForWeight(weight) {
  if (weight >= 0.25) return 'CRITICAL';
  if (weight >= 0.18) return 'HIGH';
  if (weight >= 0.12) return 'MEDIUM';
  return 'LOW';
}

function resolveIndustryCode(sectorLabel) {
  return SECTOR_LABEL_TO_CODE[sectorLabel] || null;
}

// Resolves + caches STATE.entity.industryCode from STATE.entity.sector.
// Called from renderSection()'s filter chain and from wherever the entity
// form is (re)saved — cheap to call repeatedly, only does work when the
// cached code is stale relative to the current sector label.
function currentIndustryCode() {
  // STATE is a top-level `const` declared later in climate-risk-os.html's
  // inline <script> — classic (non-module) scripts share one global lexical
  // scope, so the bare identifier resolves fine at call time even though
  // it's never attached to `window` (const/let never are). Guard with
  // `typeof` rather than `window.STATE`, which would always be undefined.
  if (typeof STATE === 'undefined' || !STATE.entity) return null;
  if (STATE.entity._sectorForCode === STATE.entity.sector && STATE.entity.industryCode !== undefined) {
    return STATE.entity.industryCode;
  }
  const code = resolveIndustryCode(STATE.entity.sector);
  STATE.entity.industryCode = code;
  STATE.entity._sectorForCode = STATE.entity.sector;
  return code;
}
