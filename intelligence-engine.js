/**
 * Climactix Global — Intelligence Engine v1.0
 * Central intelligence data layer: 20 companies, risk models, scenario engine, portfolio aggregation
 * Powers the Investor Intelligence Terminal (investor-terminal.html)
 */

window.INTELLIGENCE = (function () {
  'use strict';

  // ── Rating scale
  function getRating(score) {
    if (!score || score < 1) return { grade: '—', desc: 'Unrated', color: '#555555' };
    if (score >= 90) return { grade: 'AAA', desc: 'Climate Intelligence Leader', color: '#00CC44' };
    if (score >= 80) return { grade: 'AA',  desc: 'Advanced Climate Resilience', color: '#22CC55' };
    if (score >= 70) return { grade: 'A',   desc: 'Strong Climate Readiness',   color: '#66CC88' };
    if (score >= 60) return { grade: 'BBB', desc: 'Moderate Climate Risk',      color: '#0099CC' };
    if (score >= 50) return { grade: 'BB',  desc: 'Elevated Climate Risk',      color: '#FFB800' };
    if (score >= 35) return { grade: 'B',   desc: 'High Climate Risk',          color: '#FF6600' };
    return              { grade: 'CCC', desc: 'Critical Climate Risk',       color: '#FF3333' };
  }

  function getRiskLabel(score) {
    if (score >= 80) return { label: 'CRITICAL', color: '#FF3333' };
    if (score >= 60) return { label: 'HIGH',     color: '#FF6600' };
    if (score >= 40) return { label: 'MEDIUM',   color: '#FFB800' };
    if (score >= 20) return { label: 'LOW',      color: '#00CC44' };
    return                  { label: 'MINIMAL',  color: '#0099CC' };
  }

  // ── 20-company institutional intelligence database
  const COMPANIES = [
    {
      id: 'CX-IND-ENE-001847', name: 'Tata Power Company Ltd', ticker: 'TATAPOWER',
      industry: 'energy', industryLabel: 'Energy & Utilities', country: 'India', geography: 'South Asia',
      revenue: 14200, marketCap: 18500, employees: 34000,
      cScore: 67, credibilityScore: 72,
      carbonIntensity: 0.82, scope1: 45.2, scope2: 12.4, scope3: 8.9,
      netZeroTarget: 2040, sbtiAligned: true, renewableTarget: '70% by 2030',
      physicalRisk: { overall: 65, flood: 72, heatwave: 85, waterStress: 68, cyclone: 45, seaLevelRise: 38, wildfire: 22 },
      transitionRisk: { overall: 68, carbonTaxExposure: 78, fossilDependency: 85, energyTransition: 65, regulatory: 72, technologyDisruption: 45, strandedAssets: 62 },
      financialImpact: { revenueAtRisk: 2840, ebitdaImpact: 1420, carbonCostExposure: 890, supplyChainLoss: 340, capexBurden: 2100, assetImpairment: 1850 },
      cLayers: { c_core: 72, c_fin: 65, c_risk_p: 55, c_risk_t: 48, c_capital: 70, c_supply: 62, c_adapt: 58, c_truth: 74 },
      compliance: { TCFD: 'aligned', CSRD: 'partial', CDP: 'aligned', SBTi: 'aligned', GHG_P: 'aligned', PCAF: 'n/a' },
      facilities: ['Mumbai', 'Mundra', 'Delhi', 'Chennai', 'Pune'],
      keyRisks: ['Coal asset stranding by 2030', 'Carbon tax INR 50/tCO2e by 2027', 'Coastal facility flood exposure', 'Power demand volatility'],
      greenwashingFlags: ['Renewable capacity targets not backed by proportional Capex commitments'],
      scenarioKey: 'energy_mixed'
    },
    {
      id: 'CX-IND-ENE-002311', name: 'NTPC Ltd', ticker: 'NTPC',
      industry: 'energy', industryLabel: 'Energy & Utilities', country: 'India', geography: 'South Asia',
      revenue: 18600, marketCap: 22100, employees: 20000,
      cScore: 42, credibilityScore: 48,
      carbonIntensity: 1.45, scope1: 180.5, scope2: 8.2, scope3: 22.1,
      netZeroTarget: 2070, sbtiAligned: false, renewableTarget: '50% by 2032',
      physicalRisk: { overall: 71, flood: 65, heatwave: 88, waterStress: 82, cyclone: 52, seaLevelRise: 42, wildfire: 18 },
      transitionRisk: { overall: 88, carbonTaxExposure: 92, fossilDependency: 98, energyTransition: 88, regulatory: 85, technologyDisruption: 72, strandedAssets: 90 },
      financialImpact: { revenueAtRisk: 4200, ebitdaImpact: 2800, carbonCostExposure: 3200, supplyChainLoss: 680, capexBurden: 5800, assetImpairment: 8400 },
      cLayers: { c_core: 38, c_fin: 32, c_risk_p: 45, c_risk_t: 22, c_capital: 35, c_supply: 48, c_adapt: 38, c_truth: 55 },
      compliance: { TCFD: 'partial', CSRD: 'missing', CDP: 'partial', SBTi: 'missing', GHG_P: 'partial', PCAF: 'n/a' },
      facilities: ['Singrauli', 'Korba', 'Ramagundam', 'Farakka', 'Vindhyachal'],
      keyRisks: ['180Mt Scope 1 — highest carbon exposure in portfolio', 'Coal fleet stranding risk $8.4B by 2035', 'Water stress at all major thermal plants', 'No credible net zero pathway'],
      greenwashingFlags: ['2070 net zero target inconsistent with 1.5°C science', 'Renewable pledges with no decommissioning plan', 'CDP disclosure incomplete for 3 consecutive years'],
      scenarioKey: 'energy_coal'
    },
    {
      id: 'CX-GBR-OIL-003124', name: 'Shell plc', ticker: 'SHEL',
      industry: 'oil_gas', industryLabel: 'Oil & Gas', country: 'United Kingdom', geography: 'Global',
      revenue: 316000, marketCap: 188000, employees: 93000,
      cScore: 58, credibilityScore: 55,
      carbonIntensity: 0.38, scope1: 45.2, scope2: 3.8, scope3: 1150.0,
      netZeroTarget: 2050, sbtiAligned: false, renewableTarget: '50% energy products by 2050',
      physicalRisk: { overall: 60, flood: 58, heatwave: 62, waterStress: 55, cyclone: 68, seaLevelRise: 72, wildfire: 45 },
      transitionRisk: { overall: 82, carbonTaxExposure: 85, fossilDependency: 95, energyTransition: 72, regulatory: 88, technologyDisruption: 68, strandedAssets: 82 },
      financialImpact: { revenueAtRisk: 42800, ebitdaImpact: 18600, carbonCostExposure: 12400, supplyChainLoss: 4200, capexBurden: 28500, assetImpairment: 85200 },
      cLayers: { c_core: 65, c_fin: 58, c_risk_p: 55, c_risk_t: 42, c_capital: 60, c_supply: 62, c_adapt: 52, c_truth: 68 },
      compliance: { TCFD: 'aligned', CSRD: 'aligned', CDP: 'aligned', SBTi: 'missing', GHG_P: 'aligned', PCAF: 'n/a' },
      facilities: ['Rotterdam', 'Pernis', 'Gulf of Mexico', 'Nigeria', 'Qatar'],
      keyRisks: ['1.15Gt Scope 3 — systemic value chain exposure', 'SBTi non-aligned 2050 target challenged by courts', 'Deep-sea assets vulnerable to stranding', 'EU CBAM and ETS Phase 4 cost surge'],
      greenwashingFlags: ['Absolute Scope 3 reduction targets absent', 'Carbon capture investments overstated in disclosures', 'Continued upstream oil exploration contradicts net zero narrative'],
      scenarioKey: 'oil_gas'
    },
    {
      id: 'CX-IND-REN-004082', name: 'ReNew Power Ltd', ticker: 'RNW',
      industry: 'renewables', industryLabel: 'Renewable Energy', country: 'India', geography: 'South Asia',
      revenue: 2800, marketCap: 3200, employees: 5800,
      cScore: 84, credibilityScore: 88,
      carbonIntensity: 0.08, scope1: 0.18, scope2: 0.04, scope3: 0.22,
      netZeroTarget: 2040, sbtiAligned: true, renewableTarget: '100% (core business)',
      physicalRisk: { overall: 50, flood: 48, heatwave: 72, waterStress: 62, cyclone: 55, seaLevelRise: 28, wildfire: 18 },
      transitionRisk: { overall: 20, carbonTaxExposure: 15, fossilDependency: 12, energyTransition: 25, regulatory: 18, technologyDisruption: 35, strandedAssets: 12 },
      financialImpact: { revenueAtRisk: 112, ebitdaImpact: 56, carbonCostExposure: 8, supplyChainLoss: 85, capexBurden: 280, assetImpairment: 45 },
      cLayers: { c_core: 82, c_fin: 80, c_risk_p: 72, c_risk_t: 88, c_capital: 85, c_supply: 78, c_adapt: 82, c_truth: 86 },
      compliance: { TCFD: 'aligned', CSRD: 'aligned', CDP: 'aligned', SBTi: 'aligned', GHG_P: 'aligned', PCAF: 'n/a' },
      facilities: ['Rajasthan', 'Gujarat', 'Karnataka', 'Andhra Pradesh', 'Maharashtra'],
      keyRisks: ['Solar irradiance variability under climate projections', 'Supply chain dependency on Chinese PV panels', 'Interest rate sensitivity on capital-intensive projects'],
      greenwashingFlags: [],
      scenarioKey: 'renewables'
    },
    {
      id: 'CX-IND-STL-005218', name: 'Tata Steel Ltd', ticker: 'TATASTEEL',
      industry: 'steel', industryLabel: 'Steel & Metals', country: 'India', geography: 'South Asia / Europe',
      revenue: 28800, marketCap: 15200, employees: 78000,
      cScore: 51, credibilityScore: 62,
      carbonIntensity: 2.34, scope1: 48.2, scope2: 8.6, scope3: 10.4,
      netZeroTarget: 2045, sbtiAligned: true, renewableTarget: '50% energy by 2035',
      physicalRisk: { overall: 62, flood: 62, heatwave: 78, waterStress: 72, cyclone: 38, seaLevelRise: 45, wildfire: 15 },
      transitionRisk: { overall: 77, carbonTaxExposure: 88, fossilDependency: 72, energyTransition: 82, regulatory: 85, technologyDisruption: 78, strandedAssets: 55 },
      financialImpact: { revenueAtRisk: 5200, ebitdaImpact: 2800, carbonCostExposure: 2400, supplyChainLoss: 1200, capexBurden: 4800, assetImpairment: 6500 },
      cLayers: { c_core: 58, c_fin: 52, c_risk_p: 48, c_risk_t: 40, c_capital: 55, c_supply: 50, c_adapt: 48, c_truth: 62 },
      compliance: { TCFD: 'aligned', CSRD: 'aligned', CDP: 'aligned', SBTi: 'aligned', GHG_P: 'aligned', PCAF: 'n/a' },
      facilities: ['Jamshedpur', 'Kalinganagar', 'Port Talbot (UK)', 'IJmuiden (Netherlands)'],
      keyRisks: ['CBAM exposure on European steel exports', 'Green hydrogen availability for DRI transition', 'UK Port Talbot blast furnace transition costs $1.25B', 'Water scarcity at India operations'],
      greenwashingFlags: ['Green steel claims without third-party certification', 'EU operations transition pace inconsistent with SBTi 2030 milestones'],
      scenarioKey: 'steel'
    },
    {
      id: 'CX-IND-STL-006445', name: 'JSW Steel Ltd', ticker: 'JSWSTEEL',
      industry: 'steel', industryLabel: 'Steel & Metals', country: 'India', geography: 'South Asia',
      revenue: 20400, marketCap: 12800, employees: 52000,
      cScore: 44, credibilityScore: 52,
      carbonIntensity: 2.67, scope1: 52.1, scope2: 10.2, scope3: 8.8,
      netZeroTarget: 2050, sbtiAligned: false, renewableTarget: '40% energy by 2035',
      physicalRisk: { overall: 65, flood: 68, heatwave: 82, waterStress: 78, cyclone: 42, seaLevelRise: 38, wildfire: 12 },
      transitionRisk: { overall: 80, carbonTaxExposure: 92, fossilDependency: 78, energyTransition: 88, regulatory: 82, technologyDisruption: 72, strandedAssets: 65 },
      financialImpact: { revenueAtRisk: 4800, ebitdaImpact: 2400, carbonCostExposure: 2800, supplyChainLoss: 1400, capexBurden: 5200, assetImpairment: 7800 },
      cLayers: { c_core: 42, c_fin: 40, c_risk_p: 45, c_risk_t: 35, c_capital: 48, c_supply: 44, c_adapt: 40, c_truth: 55 },
      compliance: { TCFD: 'partial', CSRD: 'missing', CDP: 'partial', SBTi: 'missing', GHG_P: 'partial', PCAF: 'n/a' },
      facilities: ['Vijayanagar', 'Dolvi', 'Toranagallu', 'Salem', 'Vasind'],
      keyRisks: ['Highest carbon intensity in Indian steel sector', 'No SBTi alignment — stranded asset risk accelerating', 'Water-intensive operations in drought-prone regions'],
      greenwashingFlags: ['2050 net zero without interim milestones', 'Scope 3 emissions not disclosed', 'No green capex allocation identified'],
      scenarioKey: 'steel'
    },
    {
      id: 'CX-DNK-SHP-007662', name: 'A.P. Møller-Maersk', ticker: 'MAERSK',
      industry: 'shipping', industryLabel: 'Shipping & Logistics', country: 'Denmark', geography: 'Global',
      revenue: 81500, marketCap: 22800, employees: 110000,
      cScore: 71, credibilityScore: 78,
      carbonIntensity: 0.54, scope1: 28.8, scope2: 0.4, scope3: 15.2,
      netZeroTarget: 2040, sbtiAligned: true, renewableTarget: '0 emissions by 2040',
      physicalRisk: { overall: 52, flood: 38, heatwave: 42, waterStress: 22, cyclone: 75, seaLevelRise: 85, wildfire: 12 },
      transitionRisk: { overall: 66, carbonTaxExposure: 72, fossilDependency: 75, energyTransition: 68, regulatory: 80, technologyDisruption: 58, strandedAssets: 42 },
      financialImpact: { revenueAtRisk: 12800, ebitdaImpact: 4200, carbonCostExposure: 1800, supplyChainLoss: 2800, capexBurden: 6500, assetImpairment: 8200 },
      cLayers: { c_core: 75, c_fin: 70, c_risk_p: 60, c_risk_t: 62, c_capital: 72, c_supply: 68, c_adapt: 70, c_truth: 78 },
      compliance: { TCFD: 'aligned', CSRD: 'aligned', CDP: 'aligned', SBTi: 'aligned', GHG_P: 'aligned', PCAF: 'n/a' },
      facilities: ['Copenhagen HQ', 'Singapore Hub', 'Rotterdam Port', 'Shanghai', 'Los Angeles'],
      keyRisks: ['Fleet transition to green methanol/ammonia requires $18B investment', 'IMO 2050 regulatory pressure accelerating', 'Panama Canal water levels disrupting routes'],
      greenwashingFlags: ['Green methanol availability at scale not proven at transition pace'],
      scenarioKey: 'shipping'
    },
    {
      id: 'CX-IND-REI-008849', name: 'DLF Ltd', ticker: 'DLF',
      industry: 'real_estate', industryLabel: 'Real Estate', country: 'India', geography: 'South Asia',
      revenue: 2100, marketCap: 18400, employees: 5400,
      cScore: 63, credibilityScore: 68,
      carbonIntensity: 0.18, scope1: 0.12, scope2: 0.24, scope3: 2.8,
      netZeroTarget: 2050, sbtiAligned: false, renewableTarget: '60% energy by 2030',
      physicalRisk: { overall: 70, flood: 78, heatwave: 82, waterStress: 72, cyclone: 55, seaLevelRise: 68, wildfire: 12 },
      transitionRisk: { overall: 38, carbonTaxExposure: 28, fossilDependency: 32, energyTransition: 42, regulatory: 55, technologyDisruption: 38, strandedAssets: 35 },
      financialImpact: { revenueAtRisk: 320, ebitdaImpact: 180, carbonCostExposure: 42, supplyChainLoss: 85, capexBurden: 450, assetImpairment: 1200 },
      cLayers: { c_core: 65, c_fin: 62, c_risk_p: 52, c_risk_t: 68, c_capital: 60, c_supply: 58, c_adapt: 62, c_truth: 72 },
      compliance: { TCFD: 'partial', CSRD: 'n/a', CDP: 'partial', SBTi: 'missing', GHG_P: 'partial', PCAF: 'n/a' },
      facilities: ['Gurugram', 'Delhi', 'Chandigarh', 'Mumbai', 'Chennai'],
      keyRisks: ['Asset value decline in flood-risk corridors', 'Extreme heat reducing urban liveability in key markets', 'Green building retrofitting costs $450M+ by 2030'],
      greenwashingFlags: [],
      scenarioKey: 'real_estate'
    },
    {
      id: 'CX-IND-BNK-009035', name: 'HDFC Bank Ltd', ticker: 'HDFCBANK',
      industry: 'banking', industryLabel: 'Banking & Financial Services', country: 'India', geography: 'South Asia',
      revenue: 24800, marketCap: 148000, employees: 188000,
      cScore: 69, credibilityScore: 74,
      carbonIntensity: 0.04, scope1: 0.15, scope2: 0.82, scope3: 85.2,
      netZeroTarget: 2030, sbtiAligned: true, renewableTarget: '100% operations by 2025',
      physicalRisk: { overall: 45, flood: 45, heatwave: 55, waterStress: 38, cyclone: 35, seaLevelRise: 42, wildfire: 8 },
      transitionRisk: { overall: 50, carbonTaxExposure: 35, fossilDependency: 58, energyTransition: 45, regulatory: 65, technologyDisruption: 32, strandedAssets: 62 },
      financialImpact: { revenueAtRisk: 2800, ebitdaImpact: 1400, carbonCostExposure: 42, supplyChainLoss: 0, capexBurden: 0, assetImpairment: 12400 },
      cLayers: { c_core: 72, c_fin: 68, c_risk_p: 62, c_risk_t: 64, c_capital: 70, c_supply: 60, c_adapt: 72, c_truth: 75 },
      compliance: { TCFD: 'aligned', CSRD: 'n/a', CDP: 'aligned', SBTi: 'aligned', GHG_P: 'aligned', PCAF: 'aligned' },
      facilities: ['Mumbai HQ', 'Bengaluru', 'Delhi NCR', '8,500+ branches India-wide'],
      keyRisks: ['Financed emissions 85Mt via fossil-heavy loan portfolio', 'Climate credit risk in agriculture sector exposure', 'Physical risk to collateral assets in coastal zones'],
      greenwashingFlags: ['Financed emissions targets not yet published despite PCAF alignment claim'],
      scenarioKey: 'banking'
    },
    {
      id: 'CX-IND-BNK-010128', name: 'State Bank of India', ticker: 'SBIN',
      industry: 'banking', industryLabel: 'Banking & Financial Services', country: 'India', geography: 'South Asia',
      revenue: 62800, marketCap: 58200, employees: 245000,
      cScore: 48, credibilityScore: 45,
      carbonIntensity: 0.06, scope1: 0.42, scope2: 2.1, scope3: 485.0,
      netZeroTarget: 2055, sbtiAligned: false, renewableTarget: '50% operations by 2030',
      physicalRisk: { overall: 52, flood: 52, heatwave: 62, waterStress: 48, cyclone: 42, seaLevelRise: 45, wildfire: 8 },
      transitionRisk: { overall: 66, carbonTaxExposure: 55, fossilDependency: 78, energyTransition: 65, regulatory: 72, technologyDisruption: 42, strandedAssets: 82 },
      financialImpact: { revenueAtRisk: 8400, ebitdaImpact: 4200, carbonCostExposure: 180, supplyChainLoss: 0, capexBurden: 0, assetImpairment: 85400 },
      cLayers: { c_core: 42, c_fin: 45, c_risk_p: 52, c_risk_t: 38, c_capital: 44, c_supply: 48, c_adapt: 45, c_truth: 55 },
      compliance: { TCFD: 'partial', CSRD: 'n/a', CDP: 'missing', SBTi: 'missing', GHG_P: 'partial', PCAF: 'missing' },
      facilities: ['Mumbai HQ', 'State HQ across India', '22,000+ branches'],
      keyRisks: ['485Mt financed emissions — highest in Indian banking sector', 'Coal sector loans $24B at stranding risk by 2035', 'Agriculture portfolio climate credit risk — 42% of rural loan book'],
      greenwashingFlags: ['2055 net zero target has no disclosed interim milestones', 'No PCAF-aligned financed emissions methodology published', 'Scope 3 estimation methodology not disclosed'],
      scenarioKey: 'banking'
    },
    {
      id: 'CX-IND-CHM-011347', name: 'Reliance Industries Ltd', ticker: 'RELIANCE',
      industry: 'chemicals', industryLabel: 'Chemicals & Petrochemicals', country: 'India', geography: 'South Asia',
      revenue: 124800, marketCap: 218000, employees: 342000,
      cScore: 55, credibilityScore: 52,
      carbonIntensity: 1.92, scope1: 68.2, scope2: 14.4, scope3: 82.5,
      netZeroTarget: 2035, sbtiAligned: false, renewableTarget: '100GW by 2030',
      physicalRisk: { overall: 65, flood: 62, heatwave: 78, waterStress: 72, cyclone: 55, seaLevelRise: 65, wildfire: 18 },
      transitionRisk: { overall: 79, carbonTaxExposure: 85, fossilDependency: 88, energyTransition: 75, regulatory: 82, technologyDisruption: 65, strandedAssets: 78 },
      financialImpact: { revenueAtRisk: 22400, ebitdaImpact: 8800, carbonCostExposure: 5800, supplyChainLoss: 3400, capexBurden: 12800, assetImpairment: 42500 },
      cLayers: { c_core: 55, c_fin: 52, c_risk_p: 50, c_risk_t: 42, c_capital: 58, c_supply: 55, c_adapt: 50, c_truth: 60 },
      compliance: { TCFD: 'partial', CSRD: 'n/a', CDP: 'partial', SBTi: 'missing', GHG_P: 'partial', PCAF: 'n/a' },
      facilities: ['Jamnagar Refinery', 'Hazira', 'Patalganga', 'Nagothane', 'Dahej'],
      keyRisks: ['Jamnagar refinery coastal flood and cyclone exposure', 'Petrochemical assets stranding risk 2035–2045', 'Scope 3 product emissions 82.5Mt subject to CBAM pressure'],
      greenwashingFlags: ['2035 net zero for "new energy" business only — core O&G excluded', '$75B green investment commitment lacks binding Scope 1/2 reduction targets'],
      scenarioKey: 'chemicals'
    },
    {
      id: 'CX-IND-CHM-012580', name: 'BASF India Ltd', ticker: 'BASFINDIA',
      industry: 'chemicals', industryLabel: 'Chemicals & Petrochemicals', country: 'India', geography: 'South Asia',
      revenue: 4200, marketCap: 1800, employees: 6200,
      cScore: 66, credibilityScore: 70,
      carbonIntensity: 1.44, scope1: 2.8, scope2: 1.2, scope3: 4.5,
      netZeroTarget: 2050, sbtiAligned: true, renewableTarget: '25% by 2030',
      physicalRisk: { overall: 55, flood: 52, heatwave: 72, waterStress: 65, cyclone: 38, seaLevelRise: 28, wildfire: 12 },
      transitionRisk: { overall: 63, carbonTaxExposure: 75, fossilDependency: 62, energyTransition: 68, regulatory: 72, technologyDisruption: 55, strandedAssets: 48 },
      financialImpact: { revenueAtRisk: 680, ebitdaImpact: 320, carbonCostExposure: 180, supplyChainLoss: 240, capexBurden: 420, assetImpairment: 580 },
      cLayers: { c_core: 68, c_fin: 65, c_risk_p: 58, c_risk_t: 60, c_capital: 65, c_supply: 62, c_adapt: 62, c_truth: 70 },
      compliance: { TCFD: 'aligned', CSRD: 'aligned', CDP: 'aligned', SBTi: 'aligned', GHG_P: 'aligned', PCAF: 'n/a' },
      facilities: ['Thane', 'Mangalore', 'Turbhe'],
      keyRisks: ['CBAM exposure on specialty chemical imports from EU parent', 'Water-intensive processes in water-stressed Maharashtra regions'],
      greenwashingFlags: [],
      scenarioKey: 'chemicals'
    },
    {
      id: 'CX-GBR-MIN-013714', name: 'Vedanta Resources plc', ticker: 'VED',
      industry: 'mining', industryLabel: 'Mining & Metals', country: 'India', geography: 'South Asia / Africa',
      revenue: 18200, marketCap: 8400, employees: 65000,
      cScore: 38, credibilityScore: 35,
      carbonIntensity: 1.85, scope1: 18.4, scope2: 12.8, scope3: 6.2,
      netZeroTarget: 2050, sbtiAligned: false, renewableTarget: '30% by 2030',
      physicalRisk: { overall: 72, flood: 58, heatwave: 85, waterStress: 88, cyclone: 42, seaLevelRise: 28, wildfire: 35 },
      transitionRisk: { overall: 74, carbonTaxExposure: 82, fossilDependency: 72, energyTransition: 75, regulatory: 78, technologyDisruption: 62, strandedAssets: 72 },
      financialImpact: { revenueAtRisk: 4200, ebitdaImpact: 2800, carbonCostExposure: 1200, supplyChainLoss: 800, capexBurden: 2400, assetImpairment: 5800 },
      cLayers: { c_core: 32, c_fin: 35, c_risk_p: 38, c_risk_t: 30, c_capital: 40, c_supply: 38, c_adapt: 35, c_truth: 42 },
      compliance: { TCFD: 'partial', CSRD: 'missing', CDP: 'partial', SBTi: 'missing', GHG_P: 'partial', PCAF: 'n/a' },
      facilities: ['Lanjigarh (Odisha)', 'Jharsuguda', 'Tuticorin', 'Rampura Agucha', 'Zambia'],
      keyRisks: ['Extreme water stress at 6 major mine sites', 'Governance controversies reducing investor access', 'Human rights allegations at Odisha refinery affecting ESG ratings'],
      greenwashingFlags: ['Net zero target without credible pathway or Capex allocation', 'Continued coal power use in operations', 'ESG controversies — UN Global Compact violations flagged'],
      scenarioKey: 'mining_metals'
    },
    {
      id: 'CX-IND-COL-014882', name: 'Coal India Ltd', ticker: 'COALINDIA',
      industry: 'mining_coal', industryLabel: 'Coal Mining', country: 'India', geography: 'South Asia',
      revenue: 22800, marketCap: 28500, employees: 240000,
      cScore: 22, credibilityScore: 18,
      carbonIntensity: 3.12, scope1: 28.4, scope2: 4.2, scope3: 1850.0,
      netZeroTarget: null, sbtiAligned: false, renewableTarget: 'None disclosed',
      physicalRisk: { overall: 68, flood: 55, heatwave: 82, waterStress: 85, cyclone: 38, seaLevelRise: 25, wildfire: 42 },
      transitionRisk: { overall: 97, carbonTaxExposure: 98, fossilDependency: 100, energyTransition: 98, regulatory: 95, technologyDisruption: 92, strandedAssets: 98 },
      financialImpact: { revenueAtRisk: 18500, ebitdaImpact: 12400, carbonCostExposure: 8200, supplyChainLoss: 2800, capexBurden: 0, assetImpairment: 22800 },
      cLayers: { c_core: 18, c_fin: 20, c_risk_p: 30, c_risk_t: 12, c_capital: 22, c_supply: 28, c_adapt: 20, c_truth: 32 },
      compliance: { TCFD: 'missing', CSRD: 'missing', CDP: 'missing', SBTi: 'missing', GHG_P: 'missing', PCAF: 'n/a' },
      facilities: ['Jharkhand', 'West Bengal', 'Odisha', 'Chhattisgarh', 'Madhya Pradesh'],
      keyRisks: ['1.85Gt Scope 3 product emissions — highest single-entity risk on platform', '$22.8B asset impairment risk under 2°C scenario', 'No disclosed net zero target or transition plan', 'Political dependency creating governance risk'],
      greenwashingFlags: ['No climate disclosures — entity operates outside institutional ESG norms', 'Government protection creating false stability narrative'],
      scenarioKey: 'coal'
    },
    {
      id: 'CX-IND-FCG-015045', name: 'ITC Ltd', ticker: 'ITC',
      industry: 'fmcg', industryLabel: 'FMCG & Consumer', country: 'India', geography: 'South Asia',
      revenue: 8400, marketCap: 52800, employees: 36000,
      cScore: 73, credibilityScore: 76,
      carbonIntensity: 0.28, scope1: 0.88, scope2: 0.64, scope3: 1.8,
      netZeroTarget: 2050, sbtiAligned: true, renewableTarget: '50% by 2030',
      physicalRisk: { overall: 58, flood: 55, heatwave: 72, waterStress: 65, cyclone: 48, seaLevelRise: 35, wildfire: 18 },
      transitionRisk: { overall: 33, carbonTaxExposure: 32, fossilDependency: 35, energyTransition: 42, regulatory: 38, technologyDisruption: 28, strandedAssets: 22 },
      financialImpact: { revenueAtRisk: 580, ebitdaImpact: 280, carbonCostExposure: 82, supplyChainLoss: 420, capexBurden: 180, assetImpairment: 240 },
      cLayers: { c_core: 75, c_fin: 72, c_risk_p: 65, c_risk_t: 78, c_capital: 72, c_supply: 68, c_adapt: 72, c_truth: 76 },
      compliance: { TCFD: 'aligned', CSRD: 'n/a', CDP: 'aligned', SBTi: 'aligned', GHG_P: 'aligned', PCAF: 'n/a' },
      facilities: ['Kolkata HQ', 'Hotels across India', 'Agribusiness sites', 'FMCG manufacturing units'],
      keyRisks: ['Agricultural supply chain climate sensitivity', 'Tobacco portfolio regulatory pressure increasing', 'Hotel assets in coastal/flood-risk zones'],
      greenwashingFlags: [],
      scenarioKey: 'fmcg'
    },
    {
      id: 'CX-IND-FCG-016188', name: 'Hindustan Unilever Ltd', ticker: 'HINDUNILVR',
      industry: 'fmcg', industryLabel: 'FMCG & Consumer', country: 'India', geography: 'South Asia',
      revenue: 7200, marketCap: 64500, employees: 21000,
      cScore: 79, credibilityScore: 82,
      carbonIntensity: 0.19, scope1: 0.42, scope2: 0.48, scope3: 5.8,
      netZeroTarget: 2039, sbtiAligned: true, renewableTarget: '100% by 2030',
      physicalRisk: { overall: 55, flood: 48, heatwave: 68, waterStress: 72, cyclone: 42, seaLevelRise: 32, wildfire: 15 },
      transitionRisk: { overall: 27, carbonTaxExposure: 25, fossilDependency: 28, energyTransition: 35, regulatory: 32, technologyDisruption: 22, strandedAssets: 18 },
      financialImpact: { revenueAtRisk: 420, ebitdaImpact: 185, carbonCostExposure: 58, supplyChainLoss: 380, capexBurden: 120, assetImpairment: 145 },
      cLayers: { c_core: 82, c_fin: 78, c_risk_p: 72, c_risk_t: 82, c_capital: 80, c_supply: 74, c_adapt: 78, c_truth: 84 },
      compliance: { TCFD: 'aligned', CSRD: 'aligned', CDP: 'aligned', SBTi: 'aligned', GHG_P: 'aligned', PCAF: 'n/a' },
      facilities: ['Mumbai HQ', '35 manufacturing sites India-wide', 'Haridwar', 'Silvassa'],
      keyRisks: ['Agricultural supply chain — 5.8Mt Scope 3 from farming inputs', 'Water stress in palm oil supply chain', 'Plastic packaging regulatory pressure'],
      greenwashingFlags: [],
      scenarioKey: 'fmcg'
    },
    {
      id: 'CX-IND-ITS-017322', name: 'Infosys Ltd', ticker: 'INFY',
      industry: 'it', industryLabel: 'IT & Technology Services', country: 'India', geography: 'Global',
      revenue: 18200, marketCap: 82400, employees: 345000,
      cScore: 88, credibilityScore: 90,
      carbonIntensity: 0.03, scope1: 0.12, scope2: 0.42, scope3: 2.8,
      netZeroTarget: 2040, sbtiAligned: true, renewableTarget: '100% (achieved 2023)',
      physicalRisk: { overall: 30, flood: 28, heatwave: 42, waterStress: 35, cyclone: 22, seaLevelRise: 18, wildfire: 8 },
      transitionRisk: { overall: 10, carbonTaxExposure: 8, fossilDependency: 12, energyTransition: 15, regulatory: 12, technologyDisruption: 10, strandedAssets: 5 },
      financialImpact: { revenueAtRisk: 245, ebitdaImpact: 85, carbonCostExposure: 12, supplyChainLoss: 180, capexBurden: 42, assetImpairment: 28 },
      cLayers: { c_core: 90, c_fin: 88, c_risk_p: 82, c_risk_t: 90, c_capital: 88, c_supply: 82, c_adapt: 88, c_truth: 92 },
      compliance: { TCFD: 'aligned', CSRD: 'aligned', CDP: 'aligned', SBTi: 'aligned', GHG_P: 'aligned', PCAF: 'n/a' },
      facilities: ['Bengaluru', 'Pune', 'Hyderabad', 'Chennai', 'Mysuru'],
      keyRisks: ['Water consumption at data centers under stress scenarios', 'Supply chain emissions from hardware procurement', 'Talent concentration risk in climate-stressed geographies'],
      greenwashingFlags: [],
      scenarioKey: 'it'
    },
    {
      id: 'CX-IND-ITS-018445', name: 'Wipro Ltd', ticker: 'WIPRO',
      industry: 'it', industryLabel: 'IT & Technology Services', country: 'India', geography: 'Global',
      revenue: 11200, marketCap: 28500, employees: 258000,
      cScore: 85, credibilityScore: 87,
      carbonIntensity: 0.04, scope1: 0.08, scope2: 0.28, scope3: 1.8,
      netZeroTarget: 2040, sbtiAligned: true, renewableTarget: '100% by 2030',
      physicalRisk: { overall: 26, flood: 25, heatwave: 38, waterStress: 32, cyclone: 18, seaLevelRise: 15, wildfire: 6 },
      transitionRisk: { overall: 8, carbonTaxExposure: 6, fossilDependency: 8, energyTransition: 12, regulatory: 10, technologyDisruption: 8, strandedAssets: 4 },
      financialImpact: { revenueAtRisk: 148, ebitdaImpact: 52, carbonCostExposure: 8, supplyChainLoss: 112, capexBurden: 28, assetImpairment: 18 },
      cLayers: { c_core: 88, c_fin: 84, c_risk_p: 80, c_risk_t: 88, c_capital: 85, c_supply: 80, c_adapt: 85, c_truth: 90 },
      compliance: { TCFD: 'aligned', CSRD: 'aligned', CDP: 'aligned', SBTi: 'aligned', GHG_P: 'aligned', PCAF: 'n/a' },
      facilities: ['Bengaluru', 'Pune', 'Hyderabad', 'Chennai', 'Kolkata'],
      keyRisks: ['Scope 3 from employee commuting and business travel', 'Data center energy intensity under growth scenarios'],
      greenwashingFlags: [],
      scenarioKey: 'it'
    },
    {
      id: 'CX-IND-INF-019558', name: 'Adani Ports & SEZ Ltd', ticker: 'ADANIPORTS',
      industry: 'infrastructure', industryLabel: 'Ports & Infrastructure', country: 'India', geography: 'South Asia',
      revenue: 4800, marketCap: 42800, employees: 15000,
      cScore: 49, credibilityScore: 44,
      carbonIntensity: 0.31, scope1: 0.68, scope2: 0.82, scope3: 8.4,
      netZeroTarget: 2025, sbtiAligned: false, renewableTarget: '100% operations by 2025',
      physicalRisk: { overall: 80, flood: 85, heatwave: 72, waterStress: 55, cyclone: 88, seaLevelRise: 92, wildfire: 12 },
      transitionRisk: { overall: 48, carbonTaxExposure: 42, fossilDependency: 55, energyTransition: 48, regulatory: 62, technologyDisruption: 38, strandedAssets: 45 },
      financialImpact: { revenueAtRisk: 880, ebitdaImpact: 420, carbonCostExposure: 125, supplyChainLoss: 245, capexBurden: 580, assetImpairment: 2800 },
      cLayers: { c_core: 42, c_fin: 48, c_risk_p: 38, c_risk_t: 55, c_capital: 45, c_supply: 52, c_adapt: 42, c_truth: 52 },
      compliance: { TCFD: 'partial', CSRD: 'n/a', CDP: 'missing', SBTi: 'missing', GHG_P: 'partial', PCAF: 'n/a' },
      facilities: ['Mundra (Gujarat)', 'Krishnapatnam', 'Hazira', 'Kattupalli', 'Dhamra'],
      keyRisks: ['Highest sea-level rise exposure on platform — 9 coastal port facilities', 'Cyclone Biparjoy demonstrated $340M loss potential per event', 'ESG controversy — Hindenburg report legacy affecting institutional access'],
      greenwashingFlags: ['2025 net zero operations claim — third-party verification absent', 'Coal handling volumes continue despite "clean energy" positioning'],
      scenarioKey: 'infrastructure'
    },
    {
      id: 'CX-IND-INF-020671', name: 'Larsen & Toubro Ltd', ticker: 'LT',
      industry: 'infrastructure', industryLabel: 'Engineering & Construction', country: 'India', geography: 'South Asia / Middle East',
      revenue: 28200, marketCap: 52400, employees: 143000,
      cScore: 61, credibilityScore: 65,
      carbonIntensity: 0.44, scope1: 5.8, scope2: 2.4, scope3: 14.8,
      netZeroTarget: 2040, sbtiAligned: true, renewableTarget: '80% operations by 2030',
      physicalRisk: { overall: 58, flood: 58, heatwave: 72, waterStress: 62, cyclone: 48, seaLevelRise: 42, wildfire: 15 },
      transitionRisk: { overall: 49, carbonTaxExposure: 48, fossilDependency: 52, energyTransition: 55, regulatory: 58, technologyDisruption: 45, strandedAssets: 38 },
      financialImpact: { revenueAtRisk: 2800, ebitdaImpact: 1200, carbonCostExposure: 480, supplyChainLoss: 800, capexBurden: 1800, assetImpairment: 2200 },
      cLayers: { c_core: 65, c_fin: 60, c_risk_p: 55, c_risk_t: 62, c_capital: 62, c_supply: 58, c_adapt: 60, c_truth: 68 },
      compliance: { TCFD: 'aligned', CSRD: 'n/a', CDP: 'aligned', SBTi: 'aligned', GHG_P: 'aligned', PCAF: 'n/a' },
      facilities: ['Mumbai HQ', 'Hazira', 'Kattupalli', 'Vadodara', 'Riyadh (KSA)'],
      keyRisks: ['Construction operations heat stress — 1.2M worker days at risk above 40°C', 'Middle East water scarcity projects', 'Green infrastructure transition creates new opportunity but requires reskilling'],
      greenwashingFlags: [],
      scenarioKey: 'infrastructure'
    }
  ];

  // ── Industry benchmarks
  const BENCHMARKS = {
    energy:         { avgScore: 52, avgCarbonIntensity: 1.12, avgPhysical: 65, avgTransition: 75, label: 'Energy & Utilities' },
    oil_gas:        { avgScore: 48, avgCarbonIntensity: 0.85, avgPhysical: 58, avgTransition: 80, label: 'Oil & Gas' },
    renewables:     { avgScore: 82, avgCarbonIntensity: 0.09, avgPhysical: 48, avgTransition: 18, label: 'Renewable Energy' },
    steel:          { avgScore: 48, avgCarbonIntensity: 2.50, avgPhysical: 64, avgTransition: 79, label: 'Steel & Metals' },
    shipping:       { avgScore: 68, avgCarbonIntensity: 0.58, avgPhysical: 54, avgTransition: 68, label: 'Shipping & Logistics' },
    real_estate:    { avgScore: 60, avgCarbonIntensity: 0.22, avgPhysical: 72, avgTransition: 40, label: 'Real Estate' },
    banking:        { avgScore: 58, avgCarbonIntensity: 0.05, avgPhysical: 48, avgTransition: 58, label: 'Banking & Financial Services' },
    chemicals:      { avgScore: 55, avgCarbonIntensity: 1.68, avgPhysical: 60, avgTransition: 71, label: 'Chemicals & Petrochemicals' },
    mining:         { avgScore: 42, avgCarbonIntensity: 1.98, avgPhysical: 70, avgTransition: 75, label: 'Mining & Metals' },
    mining_coal:    { avgScore: 25, avgCarbonIntensity: 3.00, avgPhysical: 65, avgTransition: 95, label: 'Coal Mining' },
    fmcg:           { avgScore: 72, avgCarbonIntensity: 0.24, avgPhysical: 56, avgTransition: 30, label: 'FMCG & Consumer' },
    it:             { avgScore: 82, avgCarbonIntensity: 0.04, avgPhysical: 28, avgTransition: 10, label: 'IT & Technology' },
    infrastructure: { avgScore: 55, avgCarbonIntensity: 0.38, avgPhysical: 69, avgTransition: 49, label: 'Infrastructure' }
  };

  // ── NGFS-aligned scenario definitions
  const SCENARIOS = {
    '1.5c': {
      id: '1.5c', label: '1.5°C Pathway', shortLabel: '1.5°C',
      desc: 'Net Zero 2050. Aggressive immediate decarbonisation. Carbon price $250/tCO2e by 2050. Minimal physical damage.',
      color: '#00CC44', textColor: '#00CC44',
      horizon: 2050,
      // Revenue and EBITDA impact multipliers by scenario key (negative = loss)
      impacts: {
        energy_mixed:   { revenue: -0.18, ebitda: -0.28, stranded: 0.42, valuation: -0.30 },
        energy_coal:    { revenue: -0.45, ebitda: -0.60, stranded: 0.72, valuation: -0.58 },
        oil_gas:        { revenue: -0.38, ebitda: -0.50, stranded: 0.65, valuation: -0.55 },
        renewables:     { revenue: +0.28, ebitda: +0.35, stranded: 0.00, valuation: +0.40 },
        steel:          { revenue: -0.14, ebitda: -0.24, stranded: 0.28, valuation: -0.22 },
        shipping:       { revenue: -0.10, ebitda: -0.20, stranded: 0.18, valuation: -0.18 },
        real_estate:    { revenue: -0.12, ebitda: -0.20, stranded: 0.32, valuation: -0.20 },
        banking:        { revenue: -0.08, ebitda: -0.14, stranded: 0.00, valuation: -0.15 },
        chemicals:      { revenue: -0.20, ebitda: -0.30, stranded: 0.32, valuation: -0.28 },
        coal:           { revenue: -0.78, ebitda: -0.92, stranded: 0.95, valuation: -0.88 },
        mining_metals:  { revenue: -0.06, ebitda: -0.14, stranded: 0.12, valuation: -0.10 },
        fmcg:           { revenue: -0.05, ebitda: -0.08, stranded: 0.05, valuation: -0.06 },
        it:             { revenue: +0.02, ebitda: +0.01, stranded: 0.00, valuation: +0.04 },
        infrastructure: { revenue: -0.10, ebitda: -0.18, stranded: 0.16, valuation: -0.15 }
      }
    },
    '2c': {
      id: '2c', label: '2°C Pathway', shortLabel: '2°C',
      desc: 'Below 2°C. Moderate transition with market mechanisms. Carbon price $130/tCO2e by 2050.',
      color: '#FFB800', textColor: '#FFB800',
      horizon: 2050,
      impacts: {
        energy_mixed:   { revenue: -0.10, ebitda: -0.18, stranded: 0.28, valuation: -0.20 },
        energy_coal:    { revenue: -0.28, ebitda: -0.42, stranded: 0.55, valuation: -0.38 },
        oil_gas:        { revenue: -0.22, ebitda: -0.32, stranded: 0.45, valuation: -0.35 },
        renewables:     { revenue: +0.18, ebitda: +0.22, stranded: 0.00, valuation: +0.25 },
        steel:          { revenue: -0.10, ebitda: -0.18, stranded: 0.20, valuation: -0.16 },
        shipping:       { revenue: -0.08, ebitda: -0.15, stranded: 0.14, valuation: -0.12 },
        real_estate:    { revenue: -0.18, ebitda: -0.28, stranded: 0.40, valuation: -0.25 },
        banking:        { revenue: -0.12, ebitda: -0.20, stranded: 0.00, valuation: -0.18 },
        chemicals:      { revenue: -0.14, ebitda: -0.22, stranded: 0.22, valuation: -0.20 },
        coal:           { revenue: -0.52, ebitda: -0.68, stranded: 0.80, valuation: -0.65 },
        mining_metals:  { revenue: -0.15, ebitda: -0.25, stranded: 0.20, valuation: -0.18 },
        fmcg:           { revenue: -0.12, ebitda: -0.18, stranded: 0.12, valuation: -0.14 },
        it:             { revenue: -0.02, ebitda: -0.04, stranded: 0.00, valuation: -0.01 },
        infrastructure: { revenue: -0.18, ebitda: -0.28, stranded: 0.25, valuation: -0.22 }
      }
    },
    '3c': {
      id: '3c', label: '3°C / Current Policies', shortLabel: '3°C',
      desc: 'High physical damage. Weak transition. Catastrophic climate impacts by 2070. Asymmetric sector impacts.',
      color: '#FF3333', textColor: '#FF3333',
      horizon: 2050,
      impacts: {
        energy_mixed:   { revenue: -0.08, ebitda: -0.12, stranded: 0.15, valuation: -0.10 },
        energy_coal:    { revenue: -0.05, ebitda: -0.08, stranded: 0.05, valuation: -0.06 },
        oil_gas:        { revenue: -0.05, ebitda: -0.06, stranded: 0.08, valuation: -0.05 },
        renewables:     { revenue: +0.05, ebitda: +0.08, stranded: 0.02, valuation: +0.06 },
        steel:          { revenue: -0.28, ebitda: -0.40, stranded: 0.32, valuation: -0.30 },
        shipping:       { revenue: -0.38, ebitda: -0.48, stranded: 0.28, valuation: -0.40 },
        real_estate:    { revenue: -0.45, ebitda: -0.60, stranded: 0.65, valuation: -0.55 },
        banking:        { revenue: -0.25, ebitda: -0.38, stranded: 0.00, valuation: -0.30 },
        chemicals:      { revenue: -0.18, ebitda: -0.26, stranded: 0.18, valuation: -0.22 },
        coal:           { revenue: -0.05, ebitda: -0.08, stranded: 0.04, valuation: -0.06 },
        mining_metals:  { revenue: -0.32, ebitda: -0.45, stranded: 0.42, valuation: -0.38 },
        fmcg:           { revenue: -0.25, ebitda: -0.38, stranded: 0.28, valuation: -0.30 },
        it:             { revenue: -0.06, ebitda: -0.10, stranded: 0.02, valuation: -0.05 },
        infrastructure: { revenue: -0.32, ebitda: -0.45, stranded: 0.40, valuation: -0.38 }
      }
    },
    'delayed': {
      id: 'delayed', label: 'Delayed Transition', shortLabel: 'Delayed',
      desc: 'Late-action shock scenario. Sudden policy acceleration after 2030. Carbon price $200/tCO2e compressed into 10-year window.',
      color: '#FF6600', textColor: '#FF6600',
      horizon: 2050,
      impacts: {
        energy_mixed:   { revenue: -0.28, ebitda: -0.42, stranded: 0.55, valuation: -0.45 },
        energy_coal:    { revenue: -0.60, ebitda: -0.78, stranded: 0.85, valuation: -0.72 },
        oil_gas:        { revenue: -0.48, ebitda: -0.62, stranded: 0.72, valuation: -0.68 },
        renewables:     { revenue: +0.32, ebitda: +0.40, stranded: 0.00, valuation: +0.48 },
        steel:          { revenue: -0.22, ebitda: -0.35, stranded: 0.38, valuation: -0.32 },
        shipping:       { revenue: -0.25, ebitda: -0.38, stranded: 0.28, valuation: -0.30 },
        real_estate:    { revenue: -0.22, ebitda: -0.35, stranded: 0.48, valuation: -0.35 },
        banking:        { revenue: -0.18, ebitda: -0.28, stranded: 0.00, valuation: -0.25 },
        chemicals:      { revenue: -0.32, ebitda: -0.46, stranded: 0.45, valuation: -0.42 },
        coal:           { revenue: -0.88, ebitda: -0.98, stranded: 0.98, valuation: -0.95 },
        mining_metals:  { revenue: -0.15, ebitda: -0.28, stranded: 0.22, valuation: -0.20 },
        fmcg:           { revenue: -0.10, ebitda: -0.16, stranded: 0.10, valuation: -0.12 },
        it:             { revenue: +0.04, ebitda: +0.03, stranded: 0.00, valuation: +0.06 },
        infrastructure: { revenue: -0.18, ebitda: -0.30, stranded: 0.28, valuation: -0.25 }
      }
    },
    'carbon_shock': {
      id: 'carbon_shock', label: 'Carbon Tax Shock', shortLabel: 'C-Tax',
      desc: 'Sudden $150/tCO2e global carbon tax. Immediate EBITDA impact proportional to Scope 1+2 emissions.',
      color: '#9966FF', textColor: '#9966FF',
      horizon: 2030,
      impacts: {
        energy_mixed:   { revenue: -0.12, ebitda: -0.35, stranded: 0.22, valuation: -0.28 },
        energy_coal:    { revenue: -0.08, ebitda: -0.55, stranded: 0.32, valuation: -0.42 },
        oil_gas:        { revenue: -0.05, ebitda: -0.28, stranded: 0.20, valuation: -0.22 },
        renewables:     { revenue: +0.10, ebitda: +0.15, stranded: 0.00, valuation: +0.18 },
        steel:          { revenue: -0.08, ebitda: -0.45, stranded: 0.18, valuation: -0.30 },
        shipping:       { revenue: -0.06, ebitda: -0.28, stranded: 0.12, valuation: -0.18 },
        real_estate:    { revenue: -0.04, ebitda: -0.12, stranded: 0.08, valuation: -0.10 },
        banking:        { revenue: -0.02, ebitda: -0.06, stranded: 0.00, valuation: -0.08 },
        chemicals:      { revenue: -0.06, ebitda: -0.38, stranded: 0.16, valuation: -0.25 },
        coal:           { revenue: -0.05, ebitda: -0.82, stranded: 0.45, valuation: -0.65 },
        mining_metals:  { revenue: -0.08, ebitda: -0.32, stranded: 0.14, valuation: -0.22 },
        fmcg:           { revenue: -0.03, ebitda: -0.10, stranded: 0.06, valuation: -0.08 },
        it:             { revenue: -0.01, ebitda: -0.03, stranded: 0.00, valuation: -0.02 },
        infrastructure: { revenue: -0.05, ebitda: -0.22, stranded: 0.10, valuation: -0.14 }
      }
    },
    'nz2050': {
      id: 'nz2050', label: 'Net Zero 2050', shortLabel: 'NZ-2050',
      desc: 'Orderly 1.5°C transition with technology scale-up. Green investment surge. CCS and hydrogen at scale.',
      color: '#0099CC', textColor: '#0099CC',
      horizon: 2050,
      impacts: {
        energy_mixed:   { revenue: -0.14, ebitda: -0.22, stranded: 0.35, valuation: -0.24 },
        energy_coal:    { revenue: -0.55, ebitda: -0.72, stranded: 0.82, valuation: -0.68 },
        oil_gas:        { revenue: -0.32, ebitda: -0.45, stranded: 0.58, valuation: -0.48 },
        renewables:     { revenue: +0.35, ebitda: +0.42, stranded: 0.00, valuation: +0.50 },
        steel:          { revenue: -0.08, ebitda: -0.16, stranded: 0.20, valuation: -0.15 },
        shipping:       { revenue: -0.06, ebitda: -0.14, stranded: 0.12, valuation: -0.12 },
        real_estate:    { revenue: -0.08, ebitda: -0.15, stranded: 0.25, valuation: -0.15 },
        banking:        { revenue: -0.05, ebitda: -0.10, stranded: 0.00, valuation: -0.10 },
        chemicals:      { revenue: -0.15, ebitda: -0.24, stranded: 0.26, valuation: -0.22 },
        coal:           { revenue: -0.82, ebitda: -0.95, stranded: 0.98, valuation: -0.92 },
        mining_metals:  { revenue: +0.04, ebitda: +0.02, stranded: 0.08, valuation: +0.02 },
        fmcg:           { revenue: -0.04, ebitda: -0.06, stranded: 0.04, valuation: -0.05 },
        it:             { revenue: +0.05, ebitda: +0.04, stranded: 0.00, valuation: +0.08 },
        infrastructure: { revenue: -0.06, ebitda: -0.12, stranded: 0.12, valuation: -0.10 }
      }
    }
  };

  // ── Market intelligence feed
  const MARKET_INTEL = [
    { id: 'm001', type: 'POLICY', severity: 'CRITICAL', region: 'EU', date: '2026-05-22',
      headline: 'EU CBAM Phase 2 expansion confirmed — cement, fertilisers, hydrogen added',
      body: 'European Commission confirms Carbon Border Adjustment Mechanism expansion from October 2026. Indian steel, cement, and chemical exporters face immediate cost impact of $8.4B annually.',
      tags: ['CBAM', 'EU', 'Steel', 'Chemicals', 'Carbon Pricing'] },
    { id: 'm002', type: 'CARBON MARKET', severity: 'HIGH', region: 'EU', date: '2026-05-21',
      headline: 'EU ETS carbon price surges to €94/tCO2e following auction undersupply',
      body: 'EU Emissions Trading System carbon allowances hit €94/tCO2e as auction volumes fall short. Industrial operators with high Scope 1 exposure face material cost acceleration.',
      tags: ['EU ETS', 'Carbon Price', 'Carbon Market'] },
    { id: 'm003', type: 'REGULATORY', severity: 'HIGH', region: 'India', date: '2026-05-20',
      headline: 'SEBI mandates BRSR Core for top 1,000 listed companies from FY2026-27',
      body: 'Securities and Exchange Board of India requires Business Responsibility and Sustainability Reporting Core for all BSE/NSE top 1,000 listed companies. Assurance required from FY27.',
      tags: ['SEBI', 'BRSR', 'India', 'Mandatory Reporting'] },
    { id: 'm004', type: 'CLIMATE EVENT', severity: 'HIGH', region: 'South Asia', date: '2026-05-18',
      headline: 'Pre-monsoon heat wave peaks at 48°C across Rajasthan — power demand record',
      body: 'Extreme heat event causes record power demand surge. NTPC capacity constraints triggered. Coal plant efficiency drops 12% above 42°C. Worker safety incidents at 3 industrial facilities.',
      tags: ['Physical Risk', 'India', 'Heatwave', 'Energy'] },
    { id: 'm005', type: 'REGULATORY', severity: 'MEDIUM', region: 'IMO', date: '2026-05-16',
      headline: 'IMO FuelEU Maritime enters force — GHG intensity reduction 6% from Jan 2026',
      body: 'International Maritime Organization\'s FuelEU Maritime Regulation now in force. Shipping companies must reduce GHG intensity by 6% from 2026, escalating to 80% by 2050.',
      tags: ['IMO', 'Shipping', 'FuelEU', 'Maritime'] },
    { id: 'm006', type: 'RESEARCH', severity: 'MEDIUM', region: 'Global', date: '2026-05-15',
      headline: 'NGFS 2026 Climate Scenarios: physical risks re-estimated 40% higher for South Asia',
      body: 'Network for Greening the Financial System revises physical risk projections. South Asian financial institutions face 40% higher climate credit default risk than 2022 estimates under 3°C pathway.',
      tags: ['NGFS', 'Physical Risk', 'South Asia', 'Banking'] },
    { id: 'm007', type: 'CARBON MARKET', severity: 'MEDIUM', region: 'India', date: '2026-05-14',
      headline: 'India Carbon Credit Trading Scheme — BEE releases Phase 2 compliance trajectory',
      body: 'Bureau of Energy Efficiency releases Phase 2 trajectory for India Carbon Credit Trading Scheme (ICCTS). Industrial units above 100,000 tCO2e must purchase credits from FY27.',
      tags: ['India', 'ICCTS', 'Carbon Market', 'BEE'] },
    { id: 'm008', type: 'POLICY', severity: 'MEDIUM', region: 'US', date: '2026-05-12',
      headline: 'SEC climate disclosure rule Phase 2 implementation — large accelerated filers',
      body: 'US Securities and Exchange Commission climate disclosure requirements enter Phase 2. Large accelerated filers must disclose Scope 1, Scope 2, and material Scope 3 emissions from FY2026.',
      tags: ['SEC', 'US', 'Climate Disclosure', 'Mandatory'] },
    { id: 'm009', type: 'RESEARCH', severity: 'LOW', region: 'Global', date: '2026-05-10',
      headline: 'SBTi Corporate Net Zero Standard v2.0 — new Scope 3 requirements for high-emitters',
      body: 'Science Based Targets initiative releases Corporate Net Zero Standard Version 2.0. High-emitting sectors required to set 1.5°C-aligned Scope 3 targets within 24 months.',
      tags: ['SBTi', 'Net Zero', 'Scope 3', 'Corporate'] },
    { id: 'm010', type: 'CLIMATE EVENT', severity: 'CRITICAL', region: 'Global', date: '2026-05-08',
      headline: 'April 2026 confirmed as hottest month in recorded history — WMO',
      body: 'World Meteorological Organization confirms April 2026 exceeded 1.58°C above pre-industrial average. Consecutive record months reinforce accelerated physical risk reassessment across all asset classes.',
      tags: ['WMO', 'Temperature Record', 'Physical Risk', 'Global'] }
  ];

  // ── Carbon market prices (live simulation)
  const CARBON_PRICES = [
    { market: 'EU ETS', price: 94.20, unit: '€/tCO2e', change: +3.40, changePct: +3.74, trend: 'up' },
    { market: 'RGGI (US)', price: 22.85, unit: 'USD/tCO2e', change: +0.55, changePct: +2.47, trend: 'up' },
    { market: 'California CCA', price: 38.90, unit: 'USD/tCO2e', change: -0.85, changePct: -2.14, trend: 'down' },
    { market: 'UK ETS', price: 52.40, unit: '£/tCO2e', change: +1.80, changePct: +3.56, trend: 'up' },
    { market: 'India ICCTS', price: 1485, unit: 'INR/tCO2e', change: +85, changePct: +6.07, trend: 'up' },
    { market: 'China ETS', price: 102.50, unit: 'CNY/tCO2e', change: +4.20, changePct: +4.27, trend: 'up' }
  ];

  // ── C-LAYER definitions (shared with enterprise)
  const C_LAYERS = [
    { id: 'c_core',    label: 'C-CORE',    long: 'Governance & Strategy',    weight: 10, color: '#0099CC' },
    { id: 'c_fin',     label: 'C-FIN',     long: 'Financial Materiality',    weight: 20, color: '#FFB800' },
    { id: 'c_risk_p',  label: 'C-RISK/P',  long: 'Physical Risk Exposure',   weight: 15, color: '#FF6600' },
    { id: 'c_risk_t',  label: 'C-RISK/T',  long: 'Transition Risk Exposure', weight: 15, color: '#FF4400' },
    { id: 'c_capital', label: 'C-CAPITAL', long: 'Carbon & Capital',         weight: 10, color: '#3399FF' },
    { id: 'c_supply',  label: 'C-SUPPLY',  long: 'Supply Chain Fragility',   weight: 10, color: '#9966FF' },
    { id: 'c_adapt',   label: 'C-ADAPT',   long: 'Adaptation & Resilience',  weight: 10, color: '#00CC44' },
    { id: 'c_truth',   label: 'C-TRUTH',   long: 'Disclosure Integrity',     weight: 10, color: '#FF3333' }
  ];

  // ── Functions

  function searchCompanies(query, filters) {
    let results = COMPANIES;
    if (query && query.trim()) {
      const q = query.toLowerCase().trim();
      results = results.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.ticker.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q) ||
        c.industryLabel.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q)
      );
    }
    if (filters) {
      if (filters.industry && filters.industry !== 'all') {
        results = results.filter(c => c.industry === filters.industry || c.industry.startsWith(filters.industry));
      }
      if (filters.rating && filters.rating !== 'all') {
        results = results.filter(c => getRating(c.cScore).grade === filters.rating);
      }
      if (filters.geography && filters.geography !== 'all') {
        results = results.filter(c => c.geography.toLowerCase().includes(filters.geography.toLowerCase()) || c.country.toLowerCase().includes(filters.geography.toLowerCase()));
      }
    }
    return results;
  }

  function getCompany(id) {
    return COMPANIES.find(c => c.id === id) || null;
  }

  function runScenario(company, scenarioId, targetYear) {
    const scenario = SCENARIOS[scenarioId];
    if (!scenario || !company) return null;
    const key = company.scenarioKey;
    const imp = scenario.impacts[key] || scenario.impacts['infrastructure'];
    const yearFactor = targetYear ? Math.min(1, (targetYear - 2026) / (scenario.horizon - 2026)) : 1;
    const revenueImpact = company.revenue * imp.revenue * yearFactor;
    const ebitdaImpact = company.financialImpact.ebitdaImpact * Math.abs(imp.ebitda) * (imp.ebitda < 0 ? 1 : -1) * yearFactor;
    const strandedPct = imp.stranded * yearFactor * 100;
    const valuationImpact = company.marketCap * imp.valuation * yearFactor;
    return {
      company, scenario, targetYear: targetYear || scenario.horizon,
      revenueImpact: Math.round(revenueImpact),
      ebitdaImpact: Math.round(Math.abs(ebitdaImpact)) * (imp.ebitda < 0 ? -1 : 1),
      strandedAssetPct: Math.round(strandedPct * 10) / 10,
      valuationImpact: Math.round(valuationImpact),
      revenueImpactPct: Math.round(imp.revenue * yearFactor * 1000) / 10,
      ebitdaImpactPct: Math.round(imp.ebitda * yearFactor * 1000) / 10,
      valuationImpactPct: Math.round(imp.valuation * yearFactor * 1000) / 10,
      carbonCostIncrease: Math.round(company.financialImpact.carbonCostExposure * (scenarioId === 'carbon_shock' ? 2.5 : scenarioId === '1.5c' ? 1.8 : 1.2) * yearFactor)
    };
  }

  function calculatePortfolioRisk(holdings) {
    // holdings: [{companyId, weight}] where weights sum to 100
    const resolved = holdings.map(h => {
      const c = getCompany(h.companyId);
      return c ? { company: c, weight: h.weight / 100 } : null;
    }).filter(Boolean);
    if (!resolved.length) return null;
    const totalWeight = resolved.reduce((s, h) => s + h.weight, 0);
    const norm = resolved.map(h => ({ ...h, w: h.weight / totalWeight }));

    const weightedScore = norm.reduce((s, h) => s + h.company.cScore * h.w, 0);
    const weightedPhysical = norm.reduce((s, h) => s + h.company.physicalRisk.overall * h.w, 0);
    const weightedTransition = norm.reduce((s, h) => s + h.company.transitionRisk.overall * h.w, 0);
    const weightedCarbonIntensity = norm.reduce((s, h) => s + h.company.carbonIntensity * h.w, 0);
    const totalScope1 = norm.reduce((s, h) => s + h.company.scope1 * h.w * 100, 0);
    const totalRevenueAtRisk = norm.reduce((s, h) => s + h.company.financialImpact.revenueAtRisk * h.w, 0);
    const totalCarbonCost = norm.reduce((s, h) => s + h.company.financialImpact.carbonCostExposure * h.w, 0);

    // Sector breakdown
    const sectors = {};
    norm.forEach(h => {
      const ind = h.company.industryLabel;
      sectors[ind] = (sectors[ind] || 0) + h.w * 100;
    });

    // Top risks
    const byPhysical = [...norm].sort((a, b) => b.company.physicalRisk.overall - a.company.physicalRisk.overall);
    const byTransition = [...norm].sort((a, b) => b.company.transitionRisk.overall - a.company.transitionRisk.overall);

    return {
      holdings: norm,
      portfolioScore: Math.round(weightedScore),
      portfolioRating: getRating(Math.round(weightedScore)),
      physicalRisk: Math.round(weightedPhysical),
      transitionRisk: Math.round(weightedTransition),
      carbonIntensity: Math.round(weightedCarbonIntensity * 100) / 100,
      scope1Exposure: Math.round(totalScope1 * 10) / 10,
      revenueAtRisk: Math.round(totalRevenueAtRisk),
      carbonCostExposure: Math.round(totalCarbonCost),
      sectorBreakdown: sectors,
      highestPhysicalRisk: byPhysical.slice(0, 3).map(h => h.company),
      highestTransitionRisk: byTransition.slice(0, 3).map(h => h.company),
      count: resolved.length
    };
  }

  function runPortfolioScenario(holdings, scenarioId, targetYear) {
    const portfolio = calculatePortfolioRisk(holdings);
    if (!portfolio) return null;
    const scenario = SCENARIOS[scenarioId];
    if (!scenario) return null;
    const results = portfolio.holdings.map(h => {
      const result = runScenario(h.company, scenarioId, targetYear);
      return { company: h.company, weight: h.w * 100, result };
    });
    const totalRevenueImpact = results.reduce((s, r) => s + (r.result ? r.result.revenueImpact * r.weight / 100 : 0), 0);
    const totalValuationImpact = results.reduce((s, r) => s + (r.result ? r.result.valuationImpact * r.weight / 100 : 0), 0);
    const avgStrandedPct = results.reduce((s, r) => s + (r.result ? r.result.strandedAssetPct * r.weight / 100 : 0), 0);
    return { portfolio, scenario, targetYear: targetYear || scenario.horizon, results, totalRevenueImpact: Math.round(totalRevenueImpact), totalValuationImpact: Math.round(totalValuationImpact), avgStrandedPct: Math.round(avgStrandedPct * 10) / 10 };
  }

  return {
    COMPANIES, BENCHMARKS, SCENARIOS, MARKET_INTEL, CARBON_PRICES, C_LAYERS,
    getRating, getRiskLabel,
    searchCompanies, getCompany,
    runScenario, calculatePortfolioRisk, runPortfolioScenario
  };
})();
