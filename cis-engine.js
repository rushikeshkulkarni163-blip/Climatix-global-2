/**
 * Climactix Intelligence Score (CIS) Engine — Frontend Module v1.0
 * Browser-side implementation of the CIS scoring methodology.
 * Mirrors the Python backend engine for real-time score preview.
 *
 * Usage:
 *   const report = window.CIS_ENGINE.generateReport(assessmentInput);
 *   const rating = window.CIS_ENGINE.getRating(68.4); // → { grade: 'A', ... }
 *
 * Proprietary IP of Climactix Global. All rights reserved.
 */

window.CIS_ENGINE = (function () {
  'use strict';

  // ── Rating scale ────────────────────────────────────────────────────────────

  const RATING_BANDS = [
    [95, 100, 'AAA',  'Climate Intelligence Leader',    '#00CC44'],
    [90,  94, 'AA+',  'Climate Excellence',             '#22CC55'],
    [85,  89, 'AA',   'Advanced Climate Resilience',    '#44CC66'],
    [80,  84, 'AA-',  'Strong Climate Preparedness',    '#66CC88'],
    [75,  79, 'A+',   'Above-Average Climate Readiness','#88CCAA'],
    [70,  74, 'A',    'Solid Climate Readiness',        '#0099CC'],
    [65,  69, 'A-',   'Adequate Climate Management',    '#2299BB'],
    [60,  64, 'BBB+', 'Developing Climate Capabilities','#4499AA'],
    [55,  59, 'BBB',  'Baseline Climate Risk',          '#FFB800'],
    [50,  54, 'BBB-', 'Moderate Climate Exposure',      '#FF9900'],
    [45,  49, 'BB',   'Elevated Climate Risk',          '#FF7700'],
    [40,  44, 'B',    'High Climate Risk',              '#FF6600'],
    [30,  39, 'CCC',  'Severe Climate Vulnerability',   '#FF3333'],
    [20,  29, 'CC',   'Critical Climate Exposure',      '#CC2222'],
    [10,  19, 'C',    'Near-Default Climate Risk',      '#AA1111'],
    [ 0,   9, 'D',    'Climate Risk Default',           '#880000'],
  ];

  function getRating(score) {
    for (const [lo, hi, grade, desc, color] of RATING_BANDS) {
      if (score >= lo && score <= hi) return { grade, desc, color, score };
    }
    return { grade: 'D', desc: 'Climate Risk Default', color: '#880000', score };
  }

  // ── Industry weights ────────────────────────────────────────────────────────

  const INDUSTRY_WEIGHTS = {
    banking:         { governance:0.20, physical_risk:0.10, transition_risk:0.25, disclosure:0.20, resilience:0.10, financial_materiality:0.15 },
    insurance:       { governance:0.18, physical_risk:0.25, transition_risk:0.20, disclosure:0.17, resilience:0.10, financial_materiality:0.10 },
    oil_gas:         { governance:0.12, physical_risk:0.15, transition_risk:0.30, disclosure:0.13, resilience:0.12, financial_materiality:0.18 },
    energy:          { governance:0.13, physical_risk:0.18, transition_risk:0.28, disclosure:0.13, resilience:0.15, financial_materiality:0.13 },
    renewables:      { governance:0.15, physical_risk:0.25, transition_risk:0.15, disclosure:0.15, resilience:0.20, financial_materiality:0.10 },
    manufacturing:   { governance:0.14, physical_risk:0.18, transition_risk:0.24, disclosure:0.14, resilience:0.15, financial_materiality:0.15 },
    steel_metals:    { governance:0.12, physical_risk:0.16, transition_risk:0.30, disclosure:0.13, resilience:0.15, financial_materiality:0.14 },
    cement:          { governance:0.12, physical_risk:0.15, transition_risk:0.32, disclosure:0.12, resilience:0.14, financial_materiality:0.15 },
    real_estate:     { governance:0.15, physical_risk:0.30, transition_risk:0.18, disclosure:0.14, resilience:0.15, financial_materiality:0.08 },
    it_technology:   { governance:0.20, physical_risk:0.15, transition_risk:0.20, disclosure:0.20, resilience:0.15, financial_materiality:0.10 },
    automotive:      { governance:0.14, physical_risk:0.14, transition_risk:0.28, disclosure:0.14, resilience:0.15, financial_materiality:0.15 },
    shipping:        { governance:0.13, physical_risk:0.18, transition_risk:0.30, disclosure:0.13, resilience:0.16, financial_materiality:0.10 },
    aviation:        { governance:0.13, physical_risk:0.15, transition_risk:0.30, disclosure:0.14, resilience:0.15, financial_materiality:0.13 },
    agriculture:     { governance:0.12, physical_risk:0.30, transition_risk:0.20, disclosure:0.12, resilience:0.18, financial_materiality:0.08 },
    pharmaceuticals: { governance:0.18, physical_risk:0.15, transition_risk:0.18, disclosure:0.20, resilience:0.15, financial_materiality:0.14 },
    retail_consumer: { governance:0.16, physical_risk:0.16, transition_risk:0.22, disclosure:0.18, resilience:0.14, financial_materiality:0.14 },
    telecom:         { governance:0.18, physical_risk:0.18, transition_risk:0.20, disclosure:0.18, resilience:0.16, financial_materiality:0.10 },
    mining:          { governance:0.13, physical_risk:0.20, transition_risk:0.27, disclosure:0.13, resilience:0.15, financial_materiality:0.12 },
    chemicals:       { governance:0.13, physical_risk:0.16, transition_risk:0.28, disclosure:0.13, resilience:0.15, financial_materiality:0.15 },
    construction:    { governance:0.15, physical_risk:0.22, transition_risk:0.22, disclosure:0.14, resilience:0.15, financial_materiality:0.12 },
    default:         { governance:0.15, physical_risk:0.20, transition_risk:0.20, disclosure:0.15, resilience:0.15, financial_materiality:0.15 },
  };

  function getWeights(industry) {
    return INDUSTRY_WEIGHTS[industry] || INDUSTRY_WEIGHTS.default;
  }

  // ── Industry benchmarks ─────────────────────────────────────────────────────

  const INDUSTRY_BENCHMARKS = {
    banking:         { med:62, p25:52, p75:72, leader:82, laggard:42, n:340 },
    insurance:       { med:60, p25:50, p75:70, leader:80, laggard:40, n:180 },
    oil_gas:         { med:48, p25:38, p75:60, leader:72, laggard:30, n:220 },
    energy:          { med:52, p25:42, p75:65, leader:78, laggard:32, n:280 },
    renewables:      { med:72, p25:62, p75:82, leader:90, laggard:48, n:145 },
    manufacturing:   { med:55, p25:44, p75:66, leader:76, laggard:34, n:520 },
    steel_metals:    { med:44, p25:34, p75:56, leader:68, laggard:24, n:160 },
    cement:          { med:42, p25:32, p75:54, leader:65, laggard:22, n: 95 },
    real_estate:     { med:58, p25:48, p75:70, leader:80, laggard:36, n:310 },
    it_technology:   { med:68, p25:58, p75:78, leader:88, laggard:48, n:420 },
    automotive:      { med:56, p25:45, p75:68, leader:80, laggard:35, n:185 },
    shipping:        { med:46, p25:36, p75:58, leader:70, laggard:26, n:120 },
    aviation:        { med:50, p25:40, p75:62, leader:74, laggard:30, n: 85 },
    agriculture:     { med:48, p25:36, p75:60, leader:72, laggard:28, n:230 },
    pharmaceuticals: { med:63, p25:52, p75:73, leader:82, laggard:42, n:195 },
    retail_consumer: { med:58, p25:48, p75:68, leader:78, laggard:38, n:360 },
    telecom:         { med:62, p25:52, p75:72, leader:82, laggard:40, n:140 },
    mining:          { med:46, p25:36, p75:58, leader:70, laggard:26, n:175 },
    chemicals:       { med:50, p25:40, p75:62, leader:74, laggard:30, n:210 },
    construction:    { med:52, p25:42, p75:64, leader:74, laggard:32, n:240 },
    default:         { med:55, p25:44, p75:66, leader:76, laggard:34, n:3600 },
  };

  function getBenchmark(industry) {
    return INDUSTRY_BENCHMARKS[industry] || INDUSTRY_BENCHMARKS.default;
  }

  // ── Pillar scorers ──────────────────────────────────────────────────────────

  function scoreGovernance(g = {}) {
    const board    = (g.board_climate_committee ? 15 : 0)
                   + (g.cco_or_equivalent ? 10 : 0)
                   + (g.executive_remuneration_linked ? 15 : 0);
    const strategy = (g.climate_strategy_documented ? 10 : 0)
                   + (g.targets_board_approved ? 10 : 0)
                   + (g.climate_in_enterprise_risk ? 10 : 0)
                   + (g.climate_opportunity_strategy ? 5 : 0);
    const freq     = { quarterly:15, biannual:10, annual:5, none:0 }[g.board_agenda_frequency] ?? 0;
    const assurance = (g.external_assurance ? 5 : 0) + (g.climate_board_training ? 5 : 0);
    return clamp(board + strategy + freq + assurance, 0, 100);
  }

  function scorePhysicalRisk(p = {}) {
    const flood    = clamp((p.flood_zone_pct || 0) * 50, 0, 25);
    const heat     = clamp((p.heat_stress_score || 0) / 5, 0, 20);
    const water    = clamp((p.water_stress_score || 0) / 5, 0, 20);
    let   coastal  = clamp((p.coastal_facilities_pct || 0) * 15, 0, 15);
    if (p.sea_level_risk) coastal = clamp(coastal + 5, 0, 15);
    const cyclone  = p.cyclone_exposure ? 10 : 0;
    const wildfire = p.wildfire_exposure ? 8 : 0;
    const supply   = clamp((p.supply_chain_geo_concentration || 0) * 10, 0, 10);
    const exposure = clamp(flood + heat + water + coastal + cyclone + wildfire + supply, 0, 100);
    return { exposure, cisContribution: 100 - exposure };
  }

  function scoreTransitionRisk(t = {}) {
    const ci      = clamp((t.carbon_intensity || 0) / 2 * 30, 0, 30);
    const fossil  = ((t.fossil_fuel_pct || 0) / 100) * 20;
    let   nz = 15;
    if (t.net_zero_target_year) {
      if (t.sbti_aligned) nz = 0;
      else if (t.net_zero_target_year <= 2040) nz = 3;
      else if (t.net_zero_target_year <= 2050) nz = 8;
      else nz = 12;
    }
    const reg   = (t.cbam_exposed ? 8 : 0) + (t.ets_participation ? 7 : 0);
    const sa    = clamp((t.stranded_asset_risk_musd || 0) / 200, 0, 10);
    const cp    = clamp((t.carbon_price_exposure_musd || 0) / 500, 0, 10);
    const exposure = clamp(ci + fossil + nz + reg + sa + cp, 0, 100);
    return { exposure, cisContribution: 100 - exposure };
  }

  function scoreDisclosure(d = {}) {
    const fw = { aligned:1, partial:0.5, missing:0 };
    const frameworks = (fw[d.tcfd_status] || 0) * 10
                     + (fw[d.gri_status]  || 0) * 8
                     + (fw[d.sasb_status] || 0) * 8
                     + (fw[d.issb_status] || 0) * 10
                     + (d.brsr_completeness || 0) * 4;
    const depth = (d.cdp_response ? 15 : 0)
                + ({ complete:10, partial:5, limited:0 }[d.scope_coverage] || 0)
                + clamp((d.data_years_available || 0) * 1.5, 0, 5);
    const quality = Math.max(
      (d.third_party_assurance ? 15 : 0)
      + (d.quantified_targets ? 10 : 0)
      - clamp((d.restatements_count || 0) * 3, 0, 15),
      0
    );
    return clamp(frameworks + depth + quality, 0, 100);
  }

  function scoreResilience(r = {}) {
    const plan = (r.adaptation_plan_documented ? 15 : 0)
               + (r.bcm_includes_climate ? 10 : 0)
               + (r.scenario_analysis_conducted ? 10 : 0)
               + (r.climate_stress_testing ? 5 : 0);
    const capex    = clamp((r.climate_capex_pct || 0) * 3.5, 0, 20);
    const projects = clamp((r.resilience_projects_count || 0) * 3, 0, 15);
    const coverage = (r.supply_chain_resilience_plan ? 10 : 0)
                   + (r.insurance_climate_coverage ? 10 : 0)
                   + (r.risk_quantification_methodology ? 5 : 0);
    return clamp(plan + capex + projects + coverage, 0, 100);
  }

  function scoreFinancialMateriality(f = {}) {
    const exposure = (f.revenue_at_risk_pct || 0) * 0.35
                   + (f.ebitda_sensitivity_pct || 0) * 0.30
                   + (f.asset_impairment_pct || 0) * 0.20
                   + (f.cost_escalation_pct || 0) * 0.15;
    const exPenalty = clamp(exposure / 2, 0, 15);
    const mgmt = Math.max(
      (f.financial_scenarios_modeled ? 35 : 0)
      + (f.climate_in_financial_statements ? 30 : 0)
      + (f.investor_materiality_disclosed ? 20 : 0)
      - exPenalty,
      0
    );
    const qBase = (f.revenue_at_risk_pct > 0 || f.ebitda_sensitivity_pct > 0) ? 15 : 0;
    return clamp(mgmt + qBase, 0, 100);
  }

  // ── Greenwashing detection ──────────────────────────────────────────────────

  function detectGreenwashing(inp) {
    const flags = [];
    const t = inp.transition_risk || {};
    const d = inp.disclosure || {};
    const r = inp.resilience || {};
    const f = inp.financial || {};
    const totalScope = (t.scope1_mtco2e || 0) + (t.scope2_mtco2e || 0) + (t.scope3_mtco2e || 0);

    if (t.net_zero_target_year && !t.sbti_aligned && (t.fossil_fuel_pct || 0) > 60)
      flags.push(`Net-zero ${t.net_zero_target_year} with ${t.fossil_fuel_pct}% fossil dependency, no SBTi`);

    if (t.net_zero_target_year && (d.brsr_completeness || 0) < 0.5)
      flags.push('Climate targets declared but BRSR disclosure <50% complete');

    if (totalScope > 10 && !d.third_party_assurance)
      flags.push(`${totalScope.toFixed(1)} MtCO2e with no third-party assurance`);

    if ((f.revenue_at_risk_pct || 0) > 15 && !f.climate_in_financial_statements)
      flags.push('Revenue-at-risk >15% not reflected in financial statements');

    if (t.net_zero_target_year && (r.climate_capex_pct || 0) < 1)
      flags.push('Net-zero target with <1% CAPEX allocated to climate');

    if (['banking','insurance','oil_gas'].includes(inp.industry) && !r.scenario_analysis_conducted)
      flags.push(`${inp.industry} sector requires ISSB S2 scenario analysis — none conducted`);

    if (totalScope > 5 && !d.cdp_response)
      flags.push('Material emitter with no CDP response');

    if (d.tcfd_status === 'missing' && d.issb_status === 'missing')
      flags.push('No TCFD or ISSB S2 alignment');

    const riskMap = { 0:'Low', 1:'Low', 2:'Moderate', 3:'Elevated', 4:'High' };
    return { risk: riskMap[flags.length] || 'Critical', flags };
  }

  // ── Confidence score ────────────────────────────────────────────────────────

  function calculateConfidence(inp, verificationScore) {
    const checks = [
      !!inp.governance?.board_climate_committee !== undefined,
      !!inp.physical_risk?.country,
      (inp.transition_risk?.carbon_intensity || 0) > 0 || (inp.transition_risk?.scope1_mtco2e || 0) > 0,
      (inp.disclosure?.brsr_completeness || 0) > 0,
      inp.resilience?.adaptation_plan_documented !== undefined,
      inp.financial?.financial_scenarios_modeled !== undefined,
    ];
    const completeness = (checks.filter(Boolean).length / checks.length) * 40;
    const ev = (verificationScore / 100) * 35;
    let consistency = 0;
    if ((inp.disclosure?.data_years_available || 0) >= 3) consistency += 10;
    if (inp.disclosure?.third_party_assurance) consistency += 10;
    if ((inp.disclosure?.restatements_count || 0) === 0) consistency += 5;
    consistency = Math.min(consistency, 25);

    const score = clamp(completeness + ev + consistency, 0, 100);
    let level;
    if (score >= 90) level = 'Very High';
    else if (score >= 80) level = 'High';
    else if (score >= 65) level = 'Moderate';
    else if (score >= 50) level = 'Low';
    else level = 'Insufficient';
    return { score: Math.round(score * 10) / 10, level };
  }

  // ── Benchmarking ────────────────────────────────────────────────────────────

  function pctFromDistribution(score, med, p25, p75) {
    const iqr = p75 - p25;
    if (!iqr) return 50;
    const p95 = p75 + iqr * 0.75;
    const p5  = Math.max(p25 - iqr * 0.75, 0);
    if (score >= p95) return Math.min(99, 95 + (score - p95) / Math.max(p95 * 0.05, 1) * 4);
    if (score >= p75) return 75 + (score - p75) / (p95 - p75) * 20;
    if (score >= med) return 50 + (score - med)  / (p75 - med)  * 25;
    if (score >= p25) return 25 + (score - p25)  / (med - p25)  * 25;
    if (score >= p5)  return  5 + (score - p5)   / Math.max(p25 - p5, 1) * 20;
    return Math.max(1, 5 - (p5 - score) / Math.max(p5, 1) * 4);
  }

  function rankLabel(pct) {
    if (pct >= 99) return 'Top 1%';
    if (pct >= 95) return 'Top 5%';
    if (pct >= 90) return 'Top 10%';
    if (pct >= 75) return 'Top 25%';
    if (pct >= 50) return 'Above Median';
    if (pct >= 25) return 'Below Median';
    return 'Bottom Quartile';
  }

  function benchmarkCompany(industry, cis_score, pillarScores) {
    const bm = getBenchmark(industry);
    const glob = INDUSTRY_BENCHMARKS.default;
    const ind_pct  = pctFromDistribution(cis_score, bm.med,   bm.p25,   bm.p75);
    const glob_pct = pctFromDistribution(cis_score, glob.med, glob.p25, glob.p75);

    const pillarVsPeers = {};
    const factors = { governance:0.85, physical_risk:0.90, transition_risk:0.80,
                      disclosure:0.82, resilience:0.83, financial_materiality:0.85 };
    for (const [k, v] of Object.entries(pillarScores || {})) {
      const peerMedian = bm.med * (factors[k] || 0.85);
      pillarVsPeers[k] = v >= peerMedian * 1.10 ? 'Above Peers'
                       : v >= peerMedian * 0.90 ? 'Inline with Peers'
                       : 'Below Peers';
    }

    return {
      industry_percentile:   Math.round(ind_pct * 10) / 10,
      industry_rank_label:   rankLabel(ind_pct),
      industry_median_cis:   bm.med,
      industry_leader_cis:   bm.leader,
      above_industry_median: cis_score >= bm.med,
      global_percentile:     Math.round(glob_pct * 10) / 10,
      global_rank_label:     rankLabel(glob_pct),
      pillar_vs_peers:       pillarVsPeers,
      improvement_potential: Math.max(0, bm.leader - cis_score),
      peer_universe_size:    bm.n,
    };
  }

  // ── Financial impact ────────────────────────────────────────────────────────

  const SCENARIO_MULT = { '1.5c': 0.85, '2c': 1.00, '3c': 1.45, '4c': 2.10 };

  function buildFinancialImpact(f = {}) {
    const base = f.revenue_at_risk_pct || 0;
    return {
      revenue_at_risk_pct:  base,
      ebitda_impact_pct:    f.ebitda_sensitivity_pct || 0,
      asset_impairment_pct: f.asset_impairment_pct || 0,
      capex_transition_pct: f.capex_transition_pct || 0,
      scenario_1_5c:        Math.round(base * SCENARIO_MULT['1.5c'] * 10) / 10,
      scenario_2c:          Math.round(base * SCENARIO_MULT['2c']   * 10) / 10,
      scenario_3c:          Math.round(base * SCENARIO_MULT['3c']   * 10) / 10,
      scenario_4c:          Math.round(base * SCENARIO_MULT['4c']   * 10) / 10,
    };
  }

  // ── Master report generator ─────────────────────────────────────────────────

  function generateReport(inp = {}) {
    const w  = getWeights(inp.industry);
    const g  = inp.governance     || {};
    const p  = inp.physical_risk  || {};
    const t  = inp.transition_risk || {};
    const d  = inp.disclosure     || {};
    const r  = inp.resilience     || {};
    const f  = inp.financial      || {};

    const govScore  = scoreGovernance(g);
    const physResult = scorePhysicalRisk(p);
    const tranResult = scoreTransitionRisk(t);
    const discScore = scoreDisclosure(d);
    const resScore  = scoreResilience(r);
    const finScore  = scoreFinancialMateriality(f);

    const physScore = physResult.cisContribution;
    const tranScore = tranResult.cisContribution;

    const cis_raw = govScore  * w.governance
                  + physScore * w.physical_risk
                  + tranScore * w.transition_risk
                  + discScore * w.disclosure
                  + resScore  * w.resilience
                  + finScore  * w.financial_materiality;

    const cis_score = Math.round(clamp(cis_raw, 0, 100) * 10) / 10;
    const rating    = getRating(cis_score);
    const gw        = detectGreenwashing(inp);
    const confidence = calculateConfidence(inp, inp._verificationScore || 70);
    const bm        = benchmarkCompany(inp.industry, cis_score, {
      governance: govScore, physical_risk: physScore, transition_risk: tranScore,
      disclosure: discScore, resilience: resScore, financial_materiality: finScore,
    });

    return {
      company_id:          inp.company_id || '',
      company_name:        inp.company_name || '',
      cis_score,
      rating_grade:        rating.grade,
      rating_description:  rating.desc,
      rating_color:        rating.color,

      confidence_score:    confidence.score,
      confidence_level:    confidence.level,

      greenwashing_risk:   gw.risk,
      greenwashing_flags:  gw.flags,

      pillars: {
        governance:           govScore,
        physical_risk:        physScore,
        transition_risk:      tranScore,
        disclosure:           discScore,
        resilience:           resScore,
        financial_materiality: finScore,
      },
      physical_exposure:   physResult.exposure,
      transition_exposure: tranResult.exposure,

      financial_impact:    buildFinancialImpact(f),
      benchmark:           bm,
      industry_weights:    w,
    };
  }

  // ── Utilities ───────────────────────────────────────────────────────────────

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function getRatingColor(grade) {
    const colors = {
      AAA:'#00CC44', 'AA+':'#22CC55', AA:'#44CC66', 'AA-':'#66CC88',
      'A+':'#88CCAA', A:'#0099CC', 'A-':'#2299BB', 'BBB+':'#4499AA',
      BBB:'#FFB800', 'BBB-':'#FF9900', BB:'#FF7700',
      B:'#FF6600', CCC:'#FF3333', CC:'#CC2222', C:'#AA1111', D:'#880000',
    };
    return colors[grade] || '#555555';
  }

  function formatCIS(score) {
    return score.toFixed(1);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  return {
    generateReport,
    getRating,
    getWeights,
    getBenchmark,
    detectGreenwashing,
    calculateConfidence,
    benchmarkCompany,
    scoreGovernance,
    scorePhysicalRisk,
    scoreTransitionRisk,
    scoreDisclosure,
    scoreResilience,
    scoreFinancialMateriality,
    buildFinancialImpact,
    getRatingColor,
    formatCIS,
    RATING_BANDS,
    INDUSTRY_WEIGHTS,
    INDUSTRY_BENCHMARKS,
  };

})();
