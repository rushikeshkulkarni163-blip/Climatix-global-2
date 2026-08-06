/**
 * Aspect Impact Assessment — static reference data.
 * Self-registers onto window.ENTERPRISE (loaded after enterprise.js).
 * Categories/sub-aspects, the 6 shared rating dimensions, and the
 * category-level framework crosswalk table live here as pure data —
 * no DOM, no scoring logic (see aspect-impact-engine.js).
 */
(function () {
  'use strict';

  // ── 9 Environmental Aspect Categories ─────────────────────────────
  const ASPECT_CATEGORIES = [
    {
      id: 'climate', label: 'Climate',
      description: 'GHG emissions, energy mix, carbon intensity and internal carbon pricing.',
      subAspects: [
        { id: 'climate_scope1', label: 'Scope 1 Emissions', description: 'Direct emissions from owned/controlled sources.' },
        { id: 'climate_scope2', label: 'Scope 2 Emissions', description: 'Indirect emissions from purchased energy.' },
        { id: 'climate_scope3', label: 'Scope 3 Emissions', description: 'Value-chain emissions across material categories.' },
        { id: 'climate_carbon_intensity', label: 'Carbon Intensity', description: 'Emissions normalized to revenue/output.' },
        { id: 'climate_renewable_energy', label: 'Renewable Energy', description: 'Share of renewable electricity/fuel in energy mix.' },
        { id: 'climate_energy_efficiency', label: 'Energy Efficiency', description: 'Energy consumption per unit of output over time.' },
        { id: 'climate_carbon_pricing', label: 'Internal Carbon Pricing', description: 'Shadow price/carbon fee used in capital allocation decisions.' }
      ]
    },
    {
      id: 'air', label: 'Air',
      description: 'Non-GHG air pollutants and fugitive emissions from operations.',
      subAspects: [
        { id: 'air_nox', label: 'NOx', description: 'Nitrogen oxide emissions from combustion sources.' },
        { id: 'air_sox', label: 'SOx', description: 'Sulphur oxide emissions from combustion/process sources.' },
        { id: 'air_pm', label: 'Particulate Matter (PM)', description: 'PM10/PM2.5 emissions to air.' },
        { id: 'air_voc', label: 'VOC', description: 'Volatile organic compound emissions.' },
        { id: 'air_dust', label: 'Dust', description: 'Fugitive dust from operations, storage and transport.' },
        { id: 'air_fugitive_emissions', label: 'Fugitive Emissions', description: 'Unintentional leaks (process equipment, storage, transfer).' }
      ]
    },
    {
      id: 'water', label: 'Water',
      description: 'Water withdrawal, consumption, discharge and exposure to water stress.',
      subAspects: [
        { id: 'water_withdrawal', label: 'Water Withdrawal', description: 'Total volume withdrawn by source.' },
        { id: 'water_consumption', label: 'Water Consumption', description: 'Withdrawal minus discharge; net consumptive use.' },
        { id: 'water_recycling', label: 'Water Recycling', description: 'Share of water reused/recycled within operations.' },
        { id: 'water_wastewater', label: 'Wastewater', description: 'Wastewater discharge volume and quality management.' },
        { id: 'water_stress_exposure', label: 'Water Stress Exposure', description: 'Operations located in high/extremely-high water-stress basins.' }
      ]
    },
    {
      id: 'waste', label: 'Waste',
      description: 'Waste generation, diversion, circularity and recovery performance.',
      subAspects: [
        { id: 'waste_hazardous', label: 'Hazardous Waste', description: 'Generation and disposal of hazardous waste streams.' },
        { id: 'waste_non_hazardous', label: 'Non-Hazardous Waste', description: 'Generation and disposal of non-hazardous waste streams.' },
        { id: 'waste_circularity', label: 'Circularity', description: 'Share of material inputs/outputs kept in circular loops.' },
        { id: 'waste_recycling', label: 'Recycling', description: 'Share of waste diverted to recycling.' },
        { id: 'waste_recovery', label: 'Recovery', description: 'Share of waste diverted to energy/material recovery.' }
      ]
    },
    {
      id: 'biodiversity', label: 'Biodiversity',
      description: 'Land use, habitat impact and biodiversity restoration.',
      subAspects: [
        { id: 'biodiversity_habitat_disturbance', label: 'Habitat Disturbance', description: 'Operational footprint disturbing natural habitats.' },
        { id: 'biodiversity_restoration', label: 'Restoration', description: 'Active habitat/ecosystem restoration programs.' },
        { id: 'biodiversity_deforestation', label: 'Deforestation', description: 'Direct or supply-chain-linked deforestation exposure.' },
        { id: 'biodiversity_protected_areas', label: 'Protected Areas', description: 'Operations in or adjacent to protected/high-value areas.' },
        { id: 'biodiversity_land_use', label: 'Land Use', description: 'Land use change and net land footprint over time.' }
      ]
    },
    {
      id: 'resource_efficiency', label: 'Resource Efficiency',
      description: 'Material intensity, circular economy adoption and sustainable procurement.',
      subAspects: [
        { id: 'resource_raw_materials', label: 'Raw Materials', description: 'Virgin raw material consumption and sourcing.' },
        { id: 'resource_circular_economy', label: 'Circular Economy', description: 'Design-for-circularity and closed-loop material flows.' },
        { id: 'resource_material_intensity', label: 'Material Intensity', description: 'Material use normalized to output.' },
        { id: 'resource_sustainable_procurement', label: 'Sustainable Procurement', description: 'Share of inputs sourced under sustainability criteria.' }
      ]
    },
    {
      id: 'pollution', label: 'Pollution',
      description: 'Soil, chemical, noise, light, marine and plastic pollution.',
      subAspects: [
        { id: 'pollution_soil', label: 'Soil Pollution', description: 'Soil contamination from operations/spills.' },
        { id: 'pollution_chemical', label: 'Chemical Pollution', description: 'Use and release of hazardous chemical substances.' },
        { id: 'pollution_noise', label: 'Noise Pollution', description: 'Operational noise impact on communities/ecosystems.' },
        { id: 'pollution_light', label: 'Light Pollution', description: 'Artificial light impact on surrounding ecosystems.' },
        { id: 'pollution_marine', label: 'Marine Pollution', description: 'Discharges/spills affecting marine environments.' },
        { id: 'pollution_plastic', label: 'Plastic Pollution', description: 'Plastic packaging/waste leakage into the environment.' }
      ]
    },
    {
      id: 'climate_adaptation', label: 'Climate Adaptation',
      description: 'Physical climate hazard exposure and adaptive resilience.',
      subAspects: [
        { id: 'adaptation_physical_risk', label: 'Physical Risk (Aggregate)', description: 'Overall physical hazard exposure across assets/operations.' },
        { id: 'adaptation_flood', label: 'Flood', description: 'Exposure and resilience to riverine/coastal/pluvial flooding.' },
        { id: 'adaptation_heat', label: 'Heat Stress', description: 'Exposure to extreme heat affecting assets, workforce, operations.' },
        { id: 'adaptation_storm', label: 'Storm', description: 'Exposure to cyclones/severe storm events.' },
        { id: 'adaptation_wildfire', label: 'Wildfire', description: 'Exposure to wildfire risk at owned/leased sites.' },
        { id: 'adaptation_drought', label: 'Drought', description: 'Exposure to drought and chronic water scarcity.' }
      ]
    },
    {
      id: 'supply_chain', label: 'Supply Chain',
      description: 'Upstream emissions, sourcing practices and supplier climate risk.',
      subAspects: [
        { id: 'supply_supplier_emissions', label: 'Supplier Emissions', description: 'Emissions intensity/performance of Tier 1+ suppliers.' },
        { id: 'supply_sustainable_procurement', label: 'Sustainable Procurement', description: 'Climate/ESG criteria embedded in procurement decisions.' },
        { id: 'supply_logistics', label: 'Logistics', description: 'Emissions and climate risk in transport/logistics network.' },
        { id: 'supply_supplier_risk', label: 'Supplier Risk', description: 'Concentration and climate-resilience risk across the supplier base.' }
      ]
    }
  ];

  // ── 6 shared rating dimensions (identical schema across all sub-aspects) ──
  const RATING_DIMENSIONS = [
    {
      key: 'currentImpact', label: 'Current Impact',
      opts: [
        { value: 1, label: 'Very Low', score: 100 },
        { value: 2, label: 'Low', score: 75 },
        { value: 3, label: 'Medium', score: 50 },
        { value: 4, label: 'High', score: 25 },
        { value: 5, label: 'Critical', score: 0 }
      ]
    },
    {
      key: 'materiality', label: 'Materiality', categorical: true,
      opts: [
        { value: 'financial', label: 'Financial Materiality' },
        { value: 'environmental', label: 'Environmental Materiality' },
        { value: 'double', label: 'Double Materiality' }
      ]
    },
    {
      key: 'trend', label: 'Trend',
      opts: [
        { value: 'improving', label: 'Improving', score: 100 },
        { value: 'stable', label: 'Stable', score: 60 },
        { value: 'declining', label: 'Declining', score: 20 },
        { value: 'unknown', label: 'Unknown', score: 40 }
      ]
    },
    {
      key: 'evidenceConfidence', label: 'Evidence Confidence',
      opts: [
        { value: 'verified', label: 'Verified', score: 100 },
        { value: 'audited', label: 'Audited', score: 85 },
        { value: 'document_supported', label: 'Document Supported', score: 60 },
        { value: 'estimated', label: 'Estimated', score: 35 },
        { value: 'not_supported', label: 'Not Supported', score: 0 }
      ]
    },
    {
      key: 'mitigationEffectiveness', label: 'Mitigation Effectiveness',
      opts: [
        { value: 'excellent', label: 'Excellent', score: 100 },
        { value: 'strong', label: 'Strong', score: 75 },
        { value: 'moderate', label: 'Moderate', score: 50 },
        { value: 'weak', label: 'Weak', score: 25 },
        { value: 'none', label: 'None', score: 0 }
      ]
    },
    {
      key: 'residualRisk', label: 'Residual Risk',
      opts: [
        { value: 1, label: 'Very Low', score: 100 },
        { value: 2, label: 'Low', score: 75 },
        { value: 3, label: 'Moderate', score: 50 },
        { value: 4, label: 'High', score: 25 },
        { value: 5, label: 'Critical', score: 0 }
      ]
    }
  ];

  // Evidence-confidence rank, low→high — used by the compliance engine to
  // compare a category's evidence level against each framework row's floor.
  const EVIDENCE_RANK = { not_supported: 0, estimated: 1, document_supported: 2, audited: 3, verified: 4 };

  // ── Category-level framework crosswalk ────────────────────────────
  // Rows store only static reference fields. complianceStatus / gap /
  // recommendation are computed live from the user's own evidence
  // ratings (see aspect-impact-engine.js computeFrameworkCompliance).
  const FRAMEWORK_CROSSWALK = {
    climate: [
      { framework: 'GHG Protocol', clause: 'Corporate Standard — Scope 1, 2 & 3', requirement: 'Full GHG inventory across all three scopes using a defined organizational and operational boundary.', evidenceRequired: 'GHG inventory report, boundary methodology, emission factor sources', minEvidenceForCompliance: 'audited' },
      { framework: 'TCFD', clause: 'Metrics & Targets (c)', requirement: 'Disclosure of Scope 1, 2 and, where appropriate, Scope 3 GHG emissions and related risks.', evidenceRequired: 'TCFD-aligned report section on metrics and targets', minEvidenceForCompliance: 'document_supported' },
      { framework: 'ISSB IFRS S2', clause: 'Para 29(a)–(d)', requirement: 'Cross-industry GHG emissions metrics: Scope 1/2/3, intensity, and measurement approach.', evidenceRequired: 'S2-aligned climate disclosure', minEvidenceForCompliance: 'audited' },
      { framework: 'CSRD / ESRS E1', clause: 'E1-6', requirement: 'Gross Scopes 1, 2 and 3 GHG emissions in tCO2e, plus energy mix under E1-5.', evidenceRequired: 'ESRS E1 datapoints / assurance statement', minEvidenceForCompliance: 'audited' },
      { framework: 'SBTi', clause: 'Near-Term & Net-Zero Standard', requirement: 'Science-based emissions reduction target validated against a 1.5°C pathway.', evidenceRequired: 'SBTi validation letter or published target ID', minEvidenceForCompliance: 'verified' },
      { framework: 'CDP Climate', clause: 'C6 / C7', requirement: 'Full emissions data submission broken out by scope, source and activity.', evidenceRequired: 'CDP Climate response excerpt', minEvidenceForCompliance: 'document_supported' },
      { framework: 'EU Taxonomy', clause: 'Climate Mitigation — substantial contribution', requirement: 'Activity-level alignment against technical screening criteria for climate mitigation.', evidenceRequired: 'Taxonomy alignment/eligibility assessment', minEvidenceForCompliance: 'audited' }
    ],
    air: [
      { framework: 'GRI 305', clause: '305-7', requirement: 'Disclosure of NOx, SOx and other significant air emissions by weight.', evidenceRequired: 'Air emissions monitoring data / permit compliance records', minEvidenceForCompliance: 'document_supported' },
      { framework: 'CSRD / ESRS E2', clause: 'E2-4', requirement: 'Disclosure of air pollutant emissions of regulated substances.', evidenceRequired: 'Pollution inventory, emission monitoring reports', minEvidenceForCompliance: 'document_supported' },
      { framework: 'IFC Performance Standard 3', clause: 'Resource Efficiency & Pollution Prevention', requirement: 'Application of good international industry practice to minimize air emissions.', evidenceRequired: 'Environmental management system records', minEvidenceForCompliance: 'document_supported' }
    ],
    water: [
      { framework: 'GRI 303', clause: '303-3 / 303-4 / 303-5', requirement: 'Water withdrawal, discharge and consumption disclosed by source and destination.', evidenceRequired: 'Water balance data by facility', minEvidenceForCompliance: 'document_supported' },
      { framework: 'CDP Water Security', clause: 'W1 / W4', requirement: 'Water risk assessment and disclosure of withdrawal/consumption at facilities in water-stressed basins.', evidenceRequired: 'CDP Water response excerpt, basin risk mapping', minEvidenceForCompliance: 'document_supported' },
      { framework: 'CSRD / ESRS E3', clause: 'E3-4', requirement: 'Water consumption, withdrawal and discharge, with a focus on water-stressed areas.', evidenceRequired: 'ESRS E3 datapoints', minEvidenceForCompliance: 'audited' },
      { framework: 'EU Taxonomy', clause: 'Sustainable use & protection of water and marine resources', requirement: 'Activity alignment against water-related technical screening criteria.', evidenceRequired: 'Taxonomy alignment assessment', minEvidenceForCompliance: 'audited' }
    ],
    waste: [
      { framework: 'GRI 306', clause: '306-3 / 306-4 / 306-5', requirement: 'Waste generated, and waste diverted from or directed to disposal, by type and method.', evidenceRequired: 'Waste manifests, disposal/recycling records', minEvidenceForCompliance: 'document_supported' },
      { framework: 'CSRD / ESRS E5', clause: 'E5-5', requirement: 'Resource outflows: waste generation, recycling rate and hazardous waste disclosure.', evidenceRequired: 'ESRS E5 datapoints', minEvidenceForCompliance: 'audited' },
      { framework: 'Basel Convention', clause: 'Hazardous Waste Transboundary Movement', requirement: 'Compliant handling/documentation for any transboundary movement of hazardous waste.', evidenceRequired: 'Basel-compliant shipment documentation', minEvidenceForCompliance: 'verified' },
      { framework: 'EU Taxonomy', clause: 'Transition to a Circular Economy', requirement: 'Activity alignment against circularity-related technical screening criteria.', evidenceRequired: 'Taxonomy alignment assessment', minEvidenceForCompliance: 'audited' }
    ],
    biodiversity: [
      { framework: 'GRI 304', clause: '304-1 / 304-2 / 304-3', requirement: 'Operational sites in or near protected areas, significant impacts, and habitats protected/restored.', evidenceRequired: 'Site biodiversity screening, impact assessments', minEvidenceForCompliance: 'document_supported' },
      { framework: 'CSRD / ESRS E4', clause: 'E4-2 / E4-3', requirement: 'Biodiversity and ecosystem impact, dependency and transition-plan disclosure.', evidenceRequired: 'ESRS E4 datapoints', minEvidenceForCompliance: 'audited' },
      { framework: 'TNFD', clause: 'LEAP Approach (Locate–Evaluate–Assess–Prepare)', requirement: 'Nature-related dependency and impact assessment following the LEAP methodology.', evidenceRequired: 'TNFD-aligned nature disclosure', minEvidenceForCompliance: 'document_supported' },
      { framework: 'EU Taxonomy', clause: 'Protection & Restoration of Biodiversity and Ecosystems', requirement: 'Activity alignment against biodiversity-related technical screening criteria.', evidenceRequired: 'Taxonomy alignment assessment', minEvidenceForCompliance: 'audited' }
    ],
    resource_efficiency: [
      { framework: 'GRI 301', clause: '301-1 / 301-2', requirement: 'Materials used by weight/volume and share of recycled input materials.', evidenceRequired: 'Materials/BOM data by facility', minEvidenceForCompliance: 'document_supported' },
      { framework: 'CSRD / ESRS E5', clause: 'E5-4', requirement: 'Resource inflows disclosure, including circular material use rate.', evidenceRequired: 'ESRS E5 datapoints', minEvidenceForCompliance: 'audited' },
      { framework: 'EU Taxonomy', clause: 'Transition to a Circular Economy', requirement: 'Activity alignment against resource-efficiency technical screening criteria.', evidenceRequired: 'Taxonomy alignment assessment', minEvidenceForCompliance: 'audited' }
    ],
    pollution: [
      { framework: 'CSRD / ESRS E2', clause: 'E2-1 – E2-5', requirement: 'Pollution of air, water and soil, and substances of concern, with prevention/control policies.', evidenceRequired: 'Pollution prevention policy, monitoring records', minEvidenceForCompliance: 'document_supported' },
      { framework: 'IFC Performance Standard 3', clause: 'Pollution Prevention', requirement: 'Avoidance/minimization of pollution from operations following good international industry practice.', evidenceRequired: 'Environmental permits, monitoring data', minEvidenceForCompliance: 'document_supported' },
      { framework: 'MARPOL', clause: 'Annexes I / V (oil & garbage discharge)', requirement: 'Prevention of marine pollution from operational discharges where marine operations apply.', evidenceRequired: 'Discharge compliance records', minEvidenceForCompliance: 'verified' }
    ],
    climate_adaptation: [
      { framework: 'TCFD', clause: 'Strategy (b)', requirement: 'Description of climate-related physical risks and resilience of strategy under different scenarios.', evidenceRequired: 'Scenario analysis, physical risk assessment', minEvidenceForCompliance: 'document_supported' },
      { framework: 'ISSB IFRS S2', clause: 'Para 13–21 (Strategy)', requirement: 'Disclosure of climate resilience assessed using scenario analysis.', evidenceRequired: 'S2-aligned resilience disclosure', minEvidenceForCompliance: 'document_supported' },
      { framework: 'CSRD / ESRS E1', clause: 'E1-9', requirement: 'Anticipated financial effects from material physical climate risks.', evidenceRequired: 'Physical risk quantification, adaptation plan', minEvidenceForCompliance: 'audited' },
      { framework: 'EU Taxonomy', clause: 'Climate Adaptation — substantial contribution', requirement: 'Activity alignment against adaptation-related technical screening criteria.', evidenceRequired: 'Taxonomy alignment assessment', minEvidenceForCompliance: 'audited' }
    ],
    supply_chain: [
      { framework: 'CDP Supply Chain', clause: 'Supply Chain Module', requirement: 'Engagement of suppliers on climate risk, emissions data and target-setting.', evidenceRequired: 'Supplier engagement records, CDP supply chain response', minEvidenceForCompliance: 'document_supported' },
      { framework: 'GHG Protocol', clause: 'Scope 3 — Categories 1 & 4', requirement: 'Purchased goods/services and upstream transportation emissions quantified.', evidenceRequired: 'Scope 3 inventory with supplier-specific or average data', minEvidenceForCompliance: 'document_supported' },
      { framework: 'SBTi', clause: 'Scope 3 Target Coverage', requirement: 'Science-based target coverage extended to material Scope 3 categories.', evidenceRequired: 'SBTi target documentation', minEvidenceForCompliance: 'verified' },
      { framework: 'EU CSDDD (CS3D)', clause: 'Value Chain Due Diligence', requirement: 'Human rights and environmental due diligence across the supply chain.', evidenceRequired: 'Supplier due-diligence policy and audit records', minEvidenceForCompliance: 'audited' }
    ]
  };

  window.ENTERPRISE = window.ENTERPRISE || {};
  Object.assign(window.ENTERPRISE, { ASPECT_CATEGORIES, RATING_DIMENSIONS, FRAMEWORK_CROSSWALK, EVIDENCE_RANK });
})();
