/**
 * Climactix Enterprise — Institutional Data Layer v1.0
 * Multi-tenant climate intelligence platform backbone
 * Company identity, representative IDs, RBAC, industry-adaptive engine
 */

(function () {
  'use strict';

  // ── Storage keys (namespaced, isolated from community platform)
  const EX = {
    SESSION:     'cx_ent_session',
    COMPANIES:   'cx_ent_companies',
    REPS:        'cx_ent_reps',
    USERS:       'cx_ent_users',
    ASSESSMENTS: 'cx_ent_assessments',
    COUNTERS:    'cx_ent_counters',
    AUDIT:       'cx_ent_audit'
  };

  // ── Country → ISO Alpha-3 mapping
  const COUNTRY_CODES = {
    'India': 'IND', 'United States': 'USA', 'United Kingdom': 'GBR',
    'Singapore': 'SGP', 'UAE': 'ARE', 'Australia': 'AUS',
    'Germany': 'DEU', 'France': 'FRA', 'Japan': 'JPN',
    'Brazil': 'BRA', 'South Africa': 'ZAF', 'Canada': 'CAN',
    'China': 'CHN', 'Indonesia': 'IDN', 'Malaysia': 'MYS',
    'Netherlands': 'NLD', 'Switzerland': 'CHE', 'Sweden': 'SWE',
    'Saudi Arabia': 'SAU', 'Nigeria': 'NGA', 'Kenya': 'KEN',
    'Global / Multinational': 'GLB'
  };

  // ── Industry definitions — full institutional classification
  const INDUSTRIES = {
    banking: {
      label: 'Banking & Financial Services', code: 'BNK',
      riskTier: 'High Transition Exposure', riskColor: '#FF6600',
      sectors: ['Retail Banking', 'Investment Banking', 'Asset Management', 'Insurance', 'Development Finance'],
      climateExposure: 'Financed emissions, portfolio climate stress, climate credit risk, stranded asset exposure',
      regulatoryObligation: 'TCFD, SFDR, Basel IV climate risk, ECB climate stress tests, NGFS scenarios',
      assessmentType: 'Climate Finance Intelligence Assessment',
      keyRisks: ['Financed emissions liability', 'Climate credit defaults', 'Stranded asset exposure', 'Regulatory capital surcharges'],
      industrySections: ['Financed Emissions', 'Portfolio Stress Testing', 'Climate Credit Exposure', 'Green Finance & Alignment']
    },
    manufacturing: {
      label: 'Manufacturing & Industrial', code: 'MFG',
      riskTier: 'High Physical & Transition Risk', riskColor: '#FF3333',
      sectors: ['Heavy Industry', 'Light Manufacturing', 'Chemical', 'Automotive', 'Steel & Cement', 'Electronics'],
      climateExposure: 'Heat stress, energy intensity, water dependency, industrial decarbonisation pathway',
      regulatoryObligation: 'EU ETS, CBAM (carbon border), industrial decarbonisation mandates, CSRD',
      assessmentType: 'Industrial Climate Risk Intelligence Assessment',
      keyRisks: ['Energy price volatility', 'Carbon border tariffs (CBAM)', 'Water scarcity disruption', 'Heat-induced productivity loss'],
      industrySections: ['Heat Stress & Operations', 'Energy Intensity & Efficiency', 'Water Dependency Risk', 'Industrial Transition', 'Carbon Pricing Exposure']
    },
    logistics: {
      label: 'Logistics & Transportation', code: 'LOG',
      riskTier: 'High Transition Exposure', riskColor: '#FF6600',
      sectors: ['Road Freight', 'Air Cargo', 'Maritime Shipping', 'Rail Freight', 'Last-Mile Delivery', 'Cold Chain'],
      climateExposure: 'Fuel transition liability, fleet stranding risk, route disruption, extreme weather downtime',
      regulatoryObligation: 'IMO 2050, EU Fit for 55, FuelEU Maritime, road transport ETS, CSRD',
      assessmentType: 'Logistics Climate Transition Assessment',
      keyRisks: ['Fleet stranded assets', 'Carbon pricing on transport fuels', 'Extreme weather route disruption', 'Infrastructure vulnerability'],
      industrySections: ['Fleet Transition', 'Route & Infrastructure Risk', 'Carbon Pricing Exposure', 'Maritime Compliance', 'Supply Chain Resilience']
    },
    energy: {
      label: 'Energy & Utilities', code: 'ENE',
      riskTier: 'Critical Transition Exposure', riskColor: '#FF3333',
      sectors: ['Oil & Gas', 'Power Generation', 'Renewables', 'Utilities', 'Mining', 'LNG'],
      climateExposure: 'Stranded fossil assets, renewable transition capex, grid resilience, carbon pricing liability',
      regulatoryObligation: 'Paris Agreement NDCs, EU Taxonomy, carbon pricing regimes, IEA Net Zero pathway',
      assessmentType: 'Energy Transition Risk Intelligence Assessment',
      keyRisks: ['Stranded fossil fuel assets', 'Carbon pricing liability', 'Capex reallocation pressure', 'Grid resilience stress'],
      industrySections: ['Stranded Asset Exposure', 'Renewable Transition', 'Grid Resilience', 'Carbon Pricing Liability']
    },
    real_estate: {
      label: 'Real Estate & Infrastructure', code: 'REL',
      riskTier: 'Elevated Physical Exposure', riskColor: '#FFB800',
      sectors: ['Commercial Real Estate', 'Residential', 'Infrastructure', 'REITs', 'Property Development'],
      climateExposure: 'Physical asset stranding, flood/heat risk, green building compliance, retrofit capital burden',
      regulatoryObligation: 'EU Energy Performance Directive, CRREM, green building codes, SFDR real asset rules',
      assessmentType: 'Real Estate Climate Risk Assessment',
      keyRisks: ['Physical asset stranding', 'Flood/heat insurance gaps', 'Green retrofit capex obligations', 'Coastal asset depreciation'],
      industrySections: ['Physical Asset Risk', 'Stranded Asset Risk', 'Green Building Standards', 'Energy Performance', 'Flood & Coastal Exposure']
    },
    data_centers: {
      label: 'Technology & Data Centers', code: 'TEC',
      riskTier: 'Moderate Physical & Transition Risk', riskColor: '#0099CC',
      sectors: ['Hyperscale Data Centers', 'Colocation Facilities', 'Cloud Providers', 'Edge Computing', 'Telecom Infrastructure'],
      climateExposure: 'Cooling water dependency, grid carbon intensity, power grid vulnerability, backup diesel exposure',
      regulatoryObligation: 'EU Data Act, energy efficiency directives, SEC climate disclosure, water use regulations',
      assessmentType: 'Technology Climate Risk Intelligence Assessment',
      keyRisks: ['Cooling water scarcity', 'Grid carbon intensity liability', 'Backup diesel regulatory risk', 'Heat-induced derating losses'],
      industrySections: ['Power Efficiency (PUE)', 'Water Use Efficiency (WUE)', 'Grid Carbon Intensity', 'Backup & Resilience Infrastructure']
    },
    ports: {
      label: 'Ports & Maritime Infrastructure', code: 'PRT',
      riskTier: 'Critical Physical Exposure', riskColor: '#FF3333',
      sectors: ['Container Terminals', 'Bulk Commodity Ports', 'Logistics Hubs', 'Shipyards', 'Inland Waterways'],
      climateExposure: 'Sea-level rise, storm surge, cyclone vulnerability, cargo disruption, coastal infrastructure erosion',
      regulatoryObligation: 'IMO decarbonization, coastal zone management regulations, SOLAS amendments',
      assessmentType: 'Port & Coastal Climate Risk Assessment',
      keyRisks: ['Sea level rise infrastructure damage', 'Cyclone and storm surge disruption', 'Cargo flow interruption', 'Coastal erosion and asset loss'],
      industrySections: ['Sea Level & Coastal Risk', 'Cyclone & Storm Exposure', 'Operational Continuity', 'Maritime Decarbonisation']
    },
    agriculture: {
      label: 'Agriculture & Food Systems', code: 'AGR',
      riskTier: 'High Physical Exposure', riskColor: '#FF6600',
      sectors: ['Crop Production', 'Livestock & Dairy', 'Food Processing', 'Agribusiness', 'Fisheries & Aquaculture'],
      climateExposure: 'Drought risk, crop yield disruption, water scarcity, supply chain climate shock, methane liability',
      regulatoryObligation: 'EU Farm to Fork, EUDR (deforestation regulation), methane pledges, CSRD food sector',
      assessmentType: 'Agricultural Climate Risk Intelligence Assessment',
      keyRisks: ['Crop yield volatility', 'Water stress operational disruption', 'Supply chain climate shock', 'Land use regulatory risk (EUDR)'],
      industrySections: ['Drought & Water Risk', 'Crop Yield Vulnerability', 'Methane & Land Use Emissions', 'Supply Chain Resilience', 'Deforestation Compliance']
    },
    healthcare: {
      label: 'Healthcare & Life Sciences', code: 'HLT',
      riskTier: 'Moderate Physical Exposure', riskColor: '#0099CC',
      sectors: ['Hospitals & Health Systems', 'Pharmaceuticals', 'Medical Devices', 'Life Sciences Research'],
      climateExposure: 'Supply chain climate stress, pharmaceutical cold chain, climate-driven health demand surge',
      regulatoryObligation: 'EU sustainability reporting, pharmaceutical environmental standards, CSRD health sector',
      assessmentType: 'Healthcare Climate Risk Assessment',
      keyRisks: ['Supply chain disruption', 'Pharmaceutical degradation from heat', 'Demand surge from climate health crises', 'Cold chain vulnerability'],
      industrySections: ['Supply Chain Climate Risk', 'Cold Chain & Storage Risk', 'Facility Physical Risk', 'Climate Health Demand']
    },
    retail: {
      label: 'Retail & Consumer Goods', code: 'RET',
      riskTier: 'Moderate Transition Exposure', riskColor: '#FFB800',
      sectors: ['E-commerce', 'Physical Retail', 'FMCG', 'Fashion & Apparel', 'Food & Grocery Retail'],
      climateExposure: 'Supply chain transition risk, packaging regulation, consumer demand shift, store physical risk',
      regulatoryObligation: 'EU CSRD, Extended Producer Responsibility, product environmental footprint rules',
      assessmentType: 'Retail Climate Intelligence Assessment',
      keyRisks: ['Consumer demand shift acceleration', 'Supply chain carbon liability', 'Packaging and EPR regulations', 'Physical store heat and flood risk'],
      industrySections: ['Supply Chain Transition Risk', 'Consumer & Market Shift', 'Packaging & EPR Compliance', 'Physical Infrastructure Risk']
    }
  };

  // ── RBAC Role Definitions — 11 institutional roles
  const ROLES = {
    super_admin: {
      label: 'Super Admin', badge: '#FF3333',
      description: 'Full platform access — Climactix internal only',
      permissions: ['read_all','write_all','delete_all','manage_users','manage_companies','view_audit','export_all','manage_frameworks','approve_assessments','override_scores']
    },
    climactix_analyst: {
      label: 'Climactix Analyst', badge: '#FF6600',
      description: 'Internal analyst — review and annotate all company assessments',
      permissions: ['read_all','write_analysis','view_evidence','export_reports','view_audit','approve_assessments']
    },
    company_admin: {
      label: 'Company Admin', badge: '#0099CC',
      description: 'Full access within company tenant — manage users and assessments',
      permissions: ['read_company','write_company','manage_reps','view_evidence','export_company','submit_assessment','view_scores']
    },
    sustainability_officer: {
      label: 'Sustainability Officer', badge: '#00CC44',
      description: 'Lead assessment completion, ESG disclosure, and evidence upload',
      permissions: ['read_company','write_assessment','upload_evidence','view_scores','export_reports','view_analysis']
    },
    risk_officer: {
      label: 'Risk Officer', badge: '#FF6600',
      description: 'Physical risk, transition risk, and scenario analysis sections',
      permissions: ['read_company','write_risk_sections','view_scores','view_evidence','view_analysis']
    },
    finance_officer: {
      label: 'Finance Officer', badge: '#FFB800',
      description: 'Financial materiality, carbon liability, and climate cost sections',
      permissions: ['read_company','write_finance_sections','view_scores','export_financial']
    },
    board_reviewer: {
      label: 'Board Reviewer', badge: '#888888',
      description: 'Read-only executive dashboard with full institutional report access',
      permissions: ['read_company','view_scores','export_reports','view_summary','view_analysis']
    },
    external_auditor: {
      label: 'External Auditor', badge: '#888888',
      description: 'Evidence review, audit trail access, and verification sign-off only',
      permissions: ['view_evidence','view_audit','read_company','export_audit','sign_evidence']
    },
    investor_access: {
      label: 'Investor Access', badge: '#3399FF',
      description: 'Institutional investor portal — rated company intelligence read-only',
      permissions: ['view_scores','view_summary','export_investor_report','view_analysis']
    },
    regulator_access: {
      label: 'Regulator Access', badge: '#FF3333',
      description: 'Full disclosure read access for regulatory review and investigation',
      permissions: ['read_company','view_evidence','view_audit','view_scores','export_regulatory','request_documents']
    },
    read_only: {
      label: 'Read-Only Stakeholder', badge: '#555555',
      description: 'Minimal read access — public summary and climate rating only',
      permissions: ['view_summary','view_scores']
    }
  };

  // ── Core questions applied to ALL industries (C-LAYER baseline)
  const CORE_QUESTIONS = [
    // C-CORE: Governance & Board Oversight
    { id:'CX-G01', section:'Governance & Board Oversight', clayer:'c_core', type:'yesno', critical:true,
      label:'Does the Board of Directors have formal responsibility for climate risk oversight?',
      sublabel:'Must be documented in board charter, terms of reference, or equivalent governance instrument' },
    { id:'CX-G02', section:'Governance & Board Oversight', clayer:'c_core', type:'dropdown',
      label:'Frequency of climate risk reporting to the Board',
      opts:[
        {label:'Quarterly — integrated into standard board reporting cycle', score:100},
        {label:'Semi-annually', score:75},
        {label:'Annually', score:50},
        {label:'Ad hoc — no fixed schedule', score:20},
        {label:'Not reported to the Board', score:0}
      ]},
    { id:'CX-G03', section:'Governance & Board Oversight', clayer:'c_core', type:'yesno', critical:true,
      label:'Is climate risk formally integrated into the Enterprise Risk Management (ERM) framework?'},
    { id:'CX-G04', section:'Governance & Board Oversight', clayer:'c_core', type:'text', minWords:150,
      label:'Describe the governance structure for climate risk oversight, including executive accountability',
      sublabel:'Include: named roles, committee structures, escalation paths, and board-level expertise'},

    // C-ADAPT: Climate Strategy & Targets
    { id:'CX-S01', section:'Climate Strategy & Net-Zero Targets', clayer:'c_adapt', type:'yesno', critical:true,
      label:'Has the company adopted a net-zero emissions target with a specific target year?'},
    { id:'CX-S02', section:'Climate Strategy & Net-Zero Targets', clayer:'c_adapt', type:'dropdown',
      label:'Net-zero target alignment with science-based methodologies',
      opts:[
        {label:'SBTi-validated net-zero target (1.5°C pathway)', score:100},
        {label:'SBTi near-term target validated (net-zero in progress)', score:80},
        {label:'Internal science-based target (not yet SBTi submitted)', score:55},
        {label:'Aspirational net-zero commitment — no methodology specified', score:25},
        {label:'No net-zero target', score:0}
      ]},
    { id:'CX-S03', section:'Climate Strategy & Net-Zero Targets', clayer:'c_adapt', type:'text', minWords:200, critical:true,
      label:'Describe your transition strategy, including key decarbonisation milestones and capital allocation',
      sublabel:'Include: 2025/2030/2050 milestones, technology investments, business model changes, and financing plan'},
    { id:'CX-S04', section:'Climate Strategy & Net-Zero Targets', clayer:'c_adapt', type:'number', unit:'%',
      label:'Reduction in absolute Scope 1+2 emissions since baseline year (% decrease)'},

    // C-CAPITAL: GHG Emissions Inventory
    { id:'CX-E01', section:'GHG Emissions Inventory', clayer:'c_capital', type:'number', unit:'tCO₂e', critical:true,
      label:'Total Scope 1 emissions (direct, reported in tCO₂e)',
      sublabel:'All owned and controlled emission sources — combustion, process, fugitive'},
    { id:'CX-E02', section:'GHG Emissions Inventory', clayer:'c_capital', type:'number', unit:'tCO₂e', critical:true,
      label:'Total Scope 2 emissions — market-based method (tCO₂e)'},
    { id:'CX-E03', section:'GHG Emissions Inventory', clayer:'c_capital', type:'number', unit:'tCO₂e',
      label:'Total Scope 3 emissions — most material categories (tCO₂e)',
      sublabel:'Include at minimum: Category 1 (purchased goods), Category 11 (use of sold products), Category 15 (financed/invested assets where applicable)'},
    { id:'CX-E04', section:'GHG Emissions Inventory', clayer:'c_capital', type:'dropdown',
      label:'GHG inventory assurance level',
      opts:[
        {label:'Reasonable assurance — third-party verified to GHG Protocol / ISO 14064', score:100},
        {label:'Limited assurance — third-party reviewed', score:75},
        {label:'Internal verification only', score:40},
        {label:'Self-reported, no verification', score:15},
        {label:'No GHG inventory', score:0}
      ]},
    { id:'CX-E05', section:'GHG Emissions Inventory', clayer:'c_capital', type:'upload',
      label:'Upload GHG inventory documentation or third-party verification statement'},

    // C-TRUTH: TCFD Alignment & Disclosure
    { id:'CX-D01', section:'TCFD Alignment & Disclosure', clayer:'c_truth', type:'dropdown', critical:true,
      label:'TCFD disclosure completeness level',
      opts:[
        {label:'Full TCFD disclosure — all 11 recommended disclosures published', score:100},
        {label:'Substantial TCFD disclosure — 8-10 recommendations covered', score:80},
        {label:'Partial TCFD disclosure — 4-7 recommendations', score:50},
        {label:'Preliminary TCFD alignment — <4 recommendations', score:20},
        {label:'No TCFD disclosure', score:0}
      ]},
    { id:'CX-D02', section:'TCFD Alignment & Disclosure', clayer:'c_truth', type:'yesno',
      label:'Has the company published a standalone climate/sustainability report in the last 12 months?'},
    { id:'CX-D03', section:'TCFD Alignment & Disclosure', clayer:'c_truth', type:'upload', critical:true,
      label:'Upload most recent sustainability/climate risk report or TCFD disclosure'},
    { id:'CX-D04', section:'TCFD Alignment & Disclosure', clayer:'c_truth', type:'dropdown',
      label:'External reporting framework(s) used for climate disclosure',
      opts:[
        {label:'ISSB IFRS S2 / GRI + TCFD + CDP (multi-framework)', score:100},
        {label:'TCFD + CDP + one GRI standard', score:80},
        {label:'TCFD aligned (primary framework)', score:65},
        {label:'CDP response only', score:50},
        {label:'GRI or custom framework — no TCFD', score:30},
        {label:'No formal reporting framework', score:0}
      ]},

    // C-RISK/P: Physical Risk Assessment
    { id:'CX-P01', section:'Physical Risk Assessment', clayer:'c_risk_p', type:'text', minWords:200, critical:true,
      label:'Describe your physical climate risk assessment methodology and key findings',
      sublabel:'Include: acute risks (floods, cyclones, wildfires), chronic risks (heat, drought, sea level rise), geographic footprint, and financial exposure quantification'},
    { id:'CX-P02', section:'Physical Risk Assessment', clayer:'c_risk_p', type:'dropdown',
      label:'Physical risk assessment tool or framework used',
      opts:[
        {label:'TCFD-aligned with proprietary climate model / ThinkHazard / Four Twenty Seven', score:100},
        {label:'XDI, Jupiter, or equivalent physical risk platform', score:90},
        {label:'Qualitative assessment with geographic overlay', score:55},
        {label:'Internal qualitative review only', score:25},
        {label:'No formal physical risk assessment', score:0}
      ]},
    { id:'CX-P03', section:'Physical Risk Assessment', clayer:'c_risk_p', type:'number', unit:'USD M',
      label:'Estimated financial exposure to physical climate risks under a 2°C warming scenario'},

    // C-RISK/T: Transition Risk Assessment
    { id:'CX-T01', section:'Transition Risk Assessment', clayer:'c_risk_t', type:'text', minWords:200, critical:true,
      label:'Describe your transition risk assessment and exposure to policy, technology, and market risks',
      sublabel:'Include: carbon pricing exposure, regulatory transition costs, technology disruption, and market demand shifts'},
    { id:'CX-T02', section:'Transition Risk Assessment', clayer:'c_risk_t', type:'dropdown',
      label:'Climate scenarios used in transition risk analysis',
      opts:[
        {label:'NGFS scenarios (Net Zero 2050, Delayed Transition, Hot House World) — all three', score:100},
        {label:'IEA scenarios (NZE, APS, STEPS)', score:90},
        {label:'IPCC scenarios (SSP1-1.9 through SSP5-8.5)', score:85},
        {label:'Proprietary internal scenarios only', score:45},
        {label:'No formal scenario analysis', score:0}
      ]},
    { id:'CX-T03', section:'Transition Risk Assessment', clayer:'c_risk_t', type:'number', unit:'USD M',
      label:'Estimated total transition risk financial exposure over a 10-year horizon'},

    // C-FIN: Financial Materiality
    { id:'CX-F01', section:'Financial Materiality Assessment', clayer:'c_fin', type:'text', minWords:200, critical:true,
      label:'Describe how climate risks and opportunities are quantified and integrated into financial planning',
      sublabel:'Include: internal carbon price, climate risk in capex decisions, climate-adjusted financial forecasts, and impact on cost of capital'},
    { id:'CX-F02', section:'Financial Materiality Assessment', clayer:'c_fin', type:'number', unit:'USD M',
      label:'Total climate-related financial exposure identified across all risk categories',
      sublabel:'Sum of physical risk exposure + transition risk exposure + stranded asset risk'},
    { id:'CX-F03', section:'Financial Materiality Assessment', clayer:'c_fin', type:'yesno',
      label:'Does the company use an internal carbon price for investment decision-making?'},
    { id:'CX-F04', section:'Financial Materiality Assessment', clayer:'c_fin', type:'number', unit:'USD/tCO₂e',
      label:'Internal carbon price used (USD per tCO₂e)',
      sublabel:'IEA guidance for high ambition: USD 130/tCO₂e by 2030'},

    // C-SUPPLY: Supply Chain Due Diligence
    { id:'CX-SC01', section:'Supply Chain Due Diligence', clayer:'c_supply', type:'dropdown',
      label:'Scope 3 Scope 3 supply chain emissions assessment coverage',
      opts:[
        {label:'Full value chain mapped — all 15 Scope 3 categories quantified', score:100},
        {label:'Most material categories mapped (>80% of Scope 3 by value)', score:80},
        {label:'Tier 1 suppliers mapped — Tier 2+ not yet assessed', score:55},
        {label:'Category-level estimates from emission factors only', score:25},
        {label:'No Scope 3 supply chain assessment', score:0}
      ]},
    { id:'CX-SC02', section:'Supply Chain Due Diligence', clayer:'c_supply', type:'yesno',
      label:'Are climate requirements embedded in supplier contracts and procurement criteria?'},
    { id:'CX-SC03', section:'Supply Chain Due Diligence', clayer:'c_supply', type:'text', minWords:150,
      label:'Describe your supplier climate due diligence program and engagement strategy',
      sublabel:'Include: screening criteria, supplier engagement programs, corrective action processes'}
  ];

  // ── Industry-specific questions (loaded dynamically per industry)
  const INDUSTRY_QUESTIONS = {
    banking: [
      { id:'BNK-F01', section:'Financed Emissions', clayer:'c_capital', type:'number', unit:'tCO₂e M', critical:true,
        label:'Total financed emissions across entire loan book and investment portfolio (Scope 3 Cat. 15)',
        sublabel:'PCAF methodology. Include: corporate loans, SME, mortgages, project finance, listed equity, bonds' },
      { id:'BNK-F02', section:'Financed Emissions', clayer:'c_capital', type:'yesno', critical:true,
        label:'Has the bank completed a PCAF-aligned financed emissions inventory across all asset classes?' },
      { id:'BNK-F03', section:'Financed Emissions', clayer:'c_truth', type:'dropdown',
        label:'PCAF data quality score for portfolio-weighted financed emissions (1=highest accuracy)',
        opts:[{label:'Score 1 — Verified company-reported data',score:100},{label:'Score 2 — Reported company data (unverified)',score:80},{label:'Score 3 — Estimated from physical activity data',score:55},{label:'Score 4 — Sector-average proxy data',score:30},{label:'Score 5 — Physical activity-based estimate only',score:15}]},
      { id:'BNK-P01', section:'Portfolio Stress Testing', clayer:'c_fin', type:'text', minWords:200, critical:true,
        label:'Describe your climate scenario analysis methodology for credit portfolio stress testing',
        sublabel:'Include: scenarios used (1.5°C, 2°C, 3°C+), time horizons, asset class coverage, PD/LGD adjustments' },
      { id:'BNK-P02', section:'Portfolio Stress Testing', clayer:'c_fin', type:'yesno',
        label:'Has the bank conducted NGFS-aligned climate stress tests on the full loan and investment portfolio?' },
      { id:'BNK-P03', section:'Portfolio Stress Testing', clayer:'c_risk_t', type:'number', unit:'% of portfolio',
        label:'Percentage of total portfolio exposed to high climate transition risk sectors',
        sublabel:'Oil & gas, thermal coal, cement, steel, automotive (ICE), aviation' },
      { id:'BNK-C01', section:'Climate Credit Exposure', clayer:'c_fin', type:'number', unit:'USD M', critical:true,
        label:'Estimated Climate Credit at Risk (CCaR) under a 2°C transition scenario' },
      { id:'BNK-C02', section:'Climate Credit Exposure', clayer:'c_core', type:'dropdown',
        label:'Integration of climate risk into credit underwriting and loan origination',
        opts:[{label:'Mandatory climate screen on all credit decisions — full integration',score:100},{label:'Applied to all high-risk sector exposures',score:65},{label:'Pilot phase — select business lines only',score:35},{label:'Framework under development',score:15},{label:'Not integrated',score:0}]},
      { id:'BNK-G01', section:'Green Finance & Alignment', clayer:'c_capital', type:'number', unit:'% of new lending',
        label:'Percentage of new lending aligned with EU Taxonomy or equivalent green taxonomy criteria' },
      { id:'BNK-G02', section:'Green Finance & Alignment', clayer:'c_adapt', type:'text', minWords:150,
        label:'Describe your net-zero aligned portfolio strategy, interim targets, and 2030/2050 decarbonisation commitments' }
    ],

    manufacturing: [
      { id:'MFG-H01', section:'Heat Stress & Operations', clayer:'c_risk_p', type:'text', minWords:150,
        label:'How does your company assess and manage heat stress risk across production facilities?',
        sublabel:'Include: geographic exposure mapping, wet bulb temperature thresholds, worker safety protocols, efficiency impact quantification' },
      { id:'MFG-E01', section:'Energy Intensity & Efficiency', clayer:'c_capital', type:'number', unit:'GJ/tonne output', critical:true,
        label:'Energy intensity — gigajoules per tonne of production output (normalised)' },
      { id:'MFG-E02', section:'Energy Intensity & Efficiency', clayer:'c_capital', type:'number', unit:'%',
        label:'Percentage of total energy consumption from renewable sources (on-site generation + PPAs + RECs)' },
      { id:'MFG-W01', section:'Water Dependency Risk', clayer:'c_risk_p', type:'number', unit:'m³/unit output',
        label:'Water intensity — cubic metres consumed per unit of production output' },
      { id:'MFG-W02', section:'Water Dependency Risk', clayer:'c_risk_p', type:'dropdown',
        label:'Share of manufacturing facilities located in high or very high water stress regions (WRI Aqueduct)',
        opts:[{label:'>80% of facilities in high water stress',score:5},{label:'50–80% in high water stress',score:20},{label:'20–50% in high water stress',score:45},{label:'<20% in high water stress',score:75},{label:'All facilities in low water stress regions',score:100}]},
      { id:'MFG-T01', section:'Industrial Transition', clayer:'c_adapt', type:'text', minWords:200, critical:true,
        label:'Describe your industrial decarbonisation pathway and transition investment plan',
        sublabel:'Include: technology investments (electrification, hydrogen, CCS), capital allocation by year, and production continuity plan' },
      { id:'MFG-C01', section:'Carbon Pricing Exposure', clayer:'c_fin', type:'number', unit:'USD M',
        label:'Estimated annual carbon cost at a $130/tCO₂e price point (IEA 2030 high ambition scenario)',
        sublabel:'Multiply current Scope 1 tCO₂e × 130 to estimate 2030 liability' },
      { id:'MFG-C02', section:'Carbon Pricing Exposure', clayer:'c_fin', type:'yesno',
        label:'Are your facilities currently covered by an Emissions Trading Scheme (EU ETS, UK ETS, CORSIA, etc.)?' },
      { id:'MFG-S01', section:'Supply Chain Carbon Liability', clayer:'c_supply', type:'dropdown',
        label:'Level of Scope 3 supply chain emissions mapping and engagement',
        opts:[{label:'Full chain mapped — primary + Tier 2+ suppliers with engagement programme',score:100},{label:'Primary suppliers fully mapped and engaged',score:75},{label:'High-spend / high-emission suppliers mapped only',score:50},{label:'Category-level spend-based estimates only',score:25},{label:'No Scope 3 supply chain mapping',score:0}]}
    ],

    logistics: [
      { id:'LOG-F01', section:'Fleet Transition', clayer:'c_capital', type:'number', unit:'% zero-emission', critical:true,
        label:'Percentage of total fleet (by vehicle count and by tonne-km capacity) that is electric, hydrogen, or zero-emission' },
      { id:'LOG-F02', section:'Fleet Transition', clayer:'c_adapt', type:'text', minWords:150,
        label:'Describe your fleet electrification and fuel transition roadmap',
        sublabel:'Include: vehicle replacement schedule by asset class, charging/refuelling infrastructure investment, capital plan' },
      { id:'LOG-F03', section:'Fleet Transition', clayer:'c_fin', type:'number', unit:'USD M',
        label:'Estimated stranded asset value in diesel/fossil fuel fleet under an accelerated transition scenario' },
      { id:'LOG-R01', section:'Route & Infrastructure Risk', clayer:'c_risk_p', type:'text', minWords:150,
        label:'How does climate change affect your operational routes and logistics infrastructure reliability?',
        sublabel:'Include: flood risk on key corridors, heat-induced road/rail constraints, coastal port vulnerability, extreme weather disruption data' },
      { id:'LOG-C01', section:'Carbon Pricing Exposure', clayer:'c_fin', type:'number', unit:'USD M/year',
        label:'Estimated annual fuel carbon cost under EU ETS extension to road transport (expected 2027)' },
      { id:'LOG-M01', section:'Maritime Compliance', clayer:'c_risk_t', type:'yesno',
        label:'For maritime operations: Is your fleet compliant with IMO 2030 CII rating requirements (Rating C or above)?' },
      { id:'LOG-M02', section:'Maritime Compliance', clayer:'c_risk_t', type:'dropdown',
        label:'Strategy for IMO 2050 net-zero compliance for maritime fleet',
        opts:[{label:'Green ammonia or methanol transition plan — timeline and capex committed',score:100},{label:'LNG as bridge fuel with zero-emission transition plan',score:65},{label:'CII compliance only — no 2050 pathway yet',score:35},{label:'No maritime decarbonisation strategy',score:0}]},
      { id:'LOG-S01', section:'Supply Chain Resilience', clayer:'c_supply', type:'dropdown',
        label:'Integration of climate resilience criteria into logistics partner and supplier selection',
        opts:[{label:'Mandatory climate risk screen for all partners',score:100},{label:'Climate screen for Tier 1 critical partners',score:70},{label:'Voluntary climate questionnaire sent to suppliers',score:40},{label:'Under development',score:20},{label:'Not assessed',score:0}]}
    ],

    energy: [
      { id:'ENE-S01', section:'Stranded Asset Exposure', clayer:'c_fin', type:'number', unit:'USD M', critical:true,
        label:'Book value of fossil fuel reserves and infrastructure assets at risk of economic stranding under IEA NZE scenario by 2040' },
      { id:'ENE-S02', section:'Stranded Asset Exposure', clayer:'c_fin', type:'text', minWords:200,
        label:'Describe your impairment testing methodology for fossil fuel assets under IEA Net Zero and 1.5°C climate scenarios' },
      { id:'ENE-R01', section:'Renewable Transition', clayer:'c_capital', type:'number', unit:'% of total capacity', critical:true,
        label:'Percentage of total power generation installed capacity that is renewable (solar, wind, hydro, geothermal)' },
      { id:'ENE-R02', section:'Renewable Transition', clayer:'c_capital', type:'number', unit:'USD M',
        label:'Annual capital expenditure allocated to renewable energy development and clean technology' },
      { id:'ENE-R03', section:'Renewable Transition', clayer:'c_adapt', type:'text', minWords:150,
        label:'Describe your clean energy transition strategy and capital allocation plan for 2030 and 2050' },
      { id:'ENE-G01', section:'Grid Resilience', clayer:'c_risk_p', type:'text', minWords:150,
        label:'How do physical climate hazards affect your generation assets and grid infrastructure?',
        sublabel:'Include: heat wave impacts on thermal efficiency, cooling water scarcity, flood risk to substations, wildfire exposure' },
      { id:'ENE-C01', section:'Carbon Pricing Liability', clayer:'c_fin', type:'number', unit:'USD M',
        label:'Total annual carbon liability under current/near-term carbon pricing schemes (ETS, carbon tax)' }
    ],

    real_estate: [
      { id:'REL-P01', section:'Physical Asset Risk', clayer:'c_risk_p', type:'number', unit:'% of portfolio value', critical:true,
        label:'Percentage of portfolio value in high flood-risk zones (1-in-100 year event frequency)' },
      { id:'REL-P02', section:'Physical Asset Risk', clayer:'c_risk_p', type:'number', unit:'% of portfolio value',
        label:'Percentage of portfolio value in coastal locations with material sea-level rise exposure' },
      { id:'REL-P03', section:'Physical Asset Risk', clayer:'c_risk_p', type:'dropdown',
        label:'Heat risk exposure — percentage of portfolio in areas with >35°C mean summer temperature by 2050',
        opts:[{label:'>60% of portfolio in high heat risk areas',score:10},{label:'40–60% in high heat risk',score:30},{label:'20–40% in high heat risk',score:55},{label:'<20% in high heat risk',score:80},{label:'Assessed as low heat risk',score:95}]},
      { id:'REL-S01', section:'Stranded Asset Risk', clayer:'c_fin', type:'text', minWords:150, critical:true,
        label:'What is your CRREM (Carbon Risk Real Estate Monitor) alignment status and stranding year analysis?',
        sublabel:'Include: stranding years by asset class and geography, retrofit investment programme, CRREM trajectory compliance pathway' },
      { id:'REL-G01', section:'Green Building Standards', clayer:'c_adapt', type:'dropdown',
        label:'Percentage of total portfolio with recognised green building certification (BREEAM, LEED, DGNB, Green Star)',
        opts:[{label:'>80% certified to Excellent/Gold or above',score:100},{label:'50–80% certified',score:75},{label:'20–50% certified',score:50},{label:'<20% certified',score:25},{label:'No certified assets',score:0}]},
      { id:'REL-E01', section:'Energy Performance', clayer:'c_capital', type:'number', unit:'kWh/m²/year',
        label:'Portfolio-weighted average Energy Use Intensity (EUI) in kWh per square metre per year' }
    ],

    data_centers: [
      { id:'TEC-P01', section:'Power Efficiency (PUE)', clayer:'c_capital', type:'number', unit:'PUE ratio', critical:true,
        label:'Average Power Usage Effectiveness (PUE) across all owned and operated facilities',
        sublabel:'Best practice: <1.2 (excellent), <1.5 (good). >2.0 = critical risk territory' },
      { id:'TEC-W01', section:'Water Use Efficiency (WUE)', clayer:'c_risk_p', type:'number', unit:'L/kWh IT',
        label:'Water Usage Effectiveness (WUE) — litres of cooling water consumed per kWh of IT load' },
      { id:'TEC-W02', section:'Water Use Efficiency (WUE)', clayer:'c_risk_p', type:'dropdown',
        label:'Share of facilities located in water-stressed regions (WRI Aqueduct High/Extremely High)',
        opts:[{label:'>70% in high water stress — critical exposure',score:5},{label:'40–70% in high water stress',score:25},{label:'10–40% in high water stress',score:55},{label:'<10% in high water stress',score:80},{label:'All facilities in low water stress',score:100}]},
      { id:'TEC-G01', section:'Grid Carbon Intensity', clayer:'c_capital', type:'number', unit:'% renewable electricity', critical:true,
        label:'Percentage of total data center electricity consumption sourced from renewables (matching/additionality + on-site)' },
      { id:'TEC-B01', section:'Backup & Resilience Infrastructure', clayer:'c_risk_p', type:'number', unit:'hours of backup',
        label:'Maximum aggregate backup generator runtime (hours) — climate disruption resilience buffer' },
      { id:'TEC-B02', section:'Backup & Resilience Infrastructure', clayer:'c_adapt', type:'text', minWords:150,
        label:'Describe your climate resilience strategy for power grid vulnerability, cooling dependency, and extreme weather events' }
    ],

    ports: [
      { id:'PRT-S01', section:'Sea Level & Coastal Risk', clayer:'c_risk_p', type:'dropdown', critical:true,
        label:'Elevation of primary port quay infrastructure above current mean sea level',
        opts:[{label:'>5m above mean sea level — low structural exposure',score:90},{label:'3–5m — moderate exposure, monitoring recommended',score:65},{label:'1–3m — elevated risk, engineering assessment required',score:35},{label:'<1m — critical infrastructure exposure',score:10}]},
      { id:'PRT-S02', section:'Sea Level & Coastal Risk', clayer:'c_adapt', type:'text', minWords:200,
        label:'Describe your sea level rise adaptation strategy for port infrastructure',
        sublabel:'Include: IPCC AR6 scenarios used, infrastructure investment programme, asset-by-asset adaptation plan, timeline and cost estimates' },
      { id:'PRT-C01', section:'Cyclone & Storm Exposure', clayer:'c_risk_p', type:'dropdown',
        label:'Historical tropical cyclone/typhoon landfall frequency at primary port location (based on IBTrACS data)',
        opts:[{label:'>1 significant event per year historically',score:5},{label:'1 event per 2–5 years',score:25},{label:'1 event per 6–20 years',score:55},{label:'Rare events — less than 1 per 20 years',score:80},{label:'No historical cyclone exposure',score:95}]},
      { id:'PRT-O01', section:'Operational Continuity', clayer:'c_risk_p', type:'number', unit:'days/year',
        label:'Average operational downtime attributable to weather-related disruptions (days per year, 3-year average)' },
      { id:'PRT-O02', section:'Operational Continuity', clayer:'c_fin', type:'number', unit:'USD M',
        label:'Estimated annual revenue impact from climate-related operational disruptions' },
      { id:'PRT-T01', section:'Maritime Decarbonisation', clayer:'c_adapt', type:'text', minWords:150,
        label:'Describe your strategy for supporting vessel decarbonisation — shore power (OPS), green fuel bunkering, and port energy transition' }
    ],

    agriculture: [
      { id:'AGR-D01', section:'Drought & Water Risk', clayer:'c_risk_p', type:'dropdown', critical:true,
        label:'Share of owned/contracted agricultural land in high water stress regions (WRI Aqueduct)',
        opts:[{label:'>80% in high or extremely high water stress',score:5},{label:'50–80% in high water stress',score:20},{label:'20–50% in high water stress',score:50},{label:'<20% in high water stress',score:80},{label:'All land in low water stress',score:100}]},
      { id:'AGR-C01', section:'Crop Yield Vulnerability', clayer:'c_fin', type:'text', minWords:150,
        label:'Describe your crop yield risk quantification under 1.5°C and 2°C warming scenarios',
        sublabel:'Include: key crops, projected yield reduction %, financial impact on revenue, adaptation measures in place' },
      { id:'AGR-M01', section:'Methane & Land Use Emissions', clayer:'c_capital', type:'number', unit:'tCO₂e',
        label:'Estimated agricultural methane emissions (CH₄ from livestock enteric fermentation, manure, rice cultivation)' },
      { id:'AGR-M02', section:'Methane & Land Use Emissions', clayer:'c_capital', type:'yesno',
        label:'Has the company signed the Global Methane Pledge and committed to a 30% methane reduction by 2030?' },
      { id:'AGR-S01', section:'Supply Chain Resilience', clayer:'c_supply', type:'text', minWords:150,
        label:'How are climate risks integrated into agricultural sourcing, supplier selection, and supply chain continuity planning?' },
      { id:'AGR-D02', section:'Deforestation Compliance', clayer:'c_truth', type:'yesno', critical:true,
        label:'Does the company have a deforestation-free supply chain commitment fully compliant with EU Deforestation Regulation (EUDR)?' },
      { id:'AGR-D03', section:'Deforestation Compliance', clayer:'c_truth', type:'upload',
        label:'Upload deforestation due diligence statement or EUDR compliance documentation' }
    ],

    healthcare: [
      { id:'HLT-S01', section:'Supply Chain Climate Risk', clayer:'c_supply', type:'text', minWords:150,
        label:'How does climate risk affect your pharmaceutical and medical device supply chain?',
        sublabel:'Include: API sourcing concentration risk, geographic exposure, climate disruption history, supplier resilience programmes' },
      { id:'HLT-C01', section:'Cold Chain & Storage Risk', clayer:'c_risk_p', type:'dropdown',
        label:'Resilience of cold chain infrastructure to grid outages and heat events',
        opts:[{label:'Full redundant power and cooling systems — climate-tested',score:100},{label:'Primary backup systems in place',score:75},{label:'Basic UPS and generator backup only',score:45},{label:'Minimal resilience — single point of failure',score:15}]},
      { id:'HLT-F01', section:'Facility Physical Risk', clayer:'c_risk_p', type:'text', minWords:150,
        label:'Describe physical climate risk exposure for key hospital and manufacturing facilities',
        sublabel:'Include: flood risk, heat stress, water scarcity, and emergency continuity protocols' },
      { id:'HLT-D01', section:'Climate Health Demand', clayer:'c_fin', type:'text', minWords:100,
        label:'How does climate change affect demand for your products or services?',
        sublabel:'Include: heat-related illness, vector-borne diseases, air quality impacts on respiratory health demand' }
    ],

    retail: [
      { id:'RET-S01', section:'Supply Chain Transition Risk', clayer:'c_supply', type:'text', minWords:150,
        label:'Describe climate-related supply chain risks affecting sourcing, manufacturing partners, and logistics',
        sublabel:'Include: agricultural input disruption, Tier 1 supplier climate exposure, logistics network climate stress' },
      { id:'RET-C01', section:'Consumer & Market Shift', clayer:'c_risk_t', type:'dropdown',
        label:'Assessment of consumer demand shift risk due to climate preferences and low-carbon product transition',
        opts:[{label:'Demand shift fully integrated into product strategy and range',score:100},{label:'Partial integration — sustainability ranges launched',score:65},{label:'Consumer research conducted — product strategy not yet adjusted',score:35},{label:'No assessment of demand shift',score:0}]},
      { id:'RET-P01', section:'Packaging & EPR Compliance', clayer:'c_risk_t', type:'yesno',
        label:'Is your packaging fully compliant with current and anticipated Extended Producer Responsibility (EPR) legislation?' },
      { id:'RET-F01', section:'Physical Infrastructure Risk', clayer:'c_risk_p', type:'dropdown',
        label:'Percentage of retail stores and distribution centres in flood-risk or high heat-stress zones',
        opts:[{label:'>50% of assets in high-risk zones',score:10},{label:'20–50% in high-risk zones',score:35},{label:'<20% in high-risk zones',score:70},{label:'Formally assessed as low risk',score:95}]}
    ]
  };

  // ── ID Counter management
  function _getCounters() {
    return JSON.parse(localStorage.getItem(EX.COUNTERS) || '{"company":847,"rep":9421,"user":1203}');
  }
  function _saveCounters(c) { localStorage.setItem(EX.COUNTERS, JSON.stringify(c)); }

  function generateCompanyID(countryCode, industryCode) {
    const c = _getCounters(); c.company++;
    _saveCounters(c);
    return `CX-${countryCode}-${industryCode}-${String(c.company).padStart(6,'0')}`;
  }

  function generateRepID(countryCode) {
    const c = _getCounters(); c.rep++;
    _saveCounters(c);
    return `CX-REP-${countryCode}-${String(c.rep).padStart(7,'0')}`;
  }

  function generateUserID() {
    const c = _getCounters(); c.user++;
    _saveCounters(c);
    return `CX-USR-${String(c.user).padStart(6,'0')}`;
  }

  // ── Token generation
  function _genToken(len = 32) {
    try { return Array.from(crypto.getRandomValues(new Uint8Array(len))).map(b=>b.toString(16).padStart(2,'0')).join(''); }
    catch { return Math.random().toString(36).slice(2).repeat(3).slice(0,len*2); }
  }

  // ── OTP generation (6-digit)
  function generateOTP() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  // ── User operations
  function createUser(data) {
    const users = JSON.parse(localStorage.getItem(EX.USERS) || '[]');
    if (users.find(u => u.email === data.email)) return { error: 'Email already registered' };
    const id = generateUserID();
    const user = {
      id, email: data.email,
      passwordHash: btoa(data.password + '_cx_salt'),
      name: data.name || '',
      createdAt: new Date().toISOString(),
      lastLogin: null,
      mfaEnabled: false,
      status: 'active'
    };
    users.push(user);
    localStorage.setItem(EX.USERS, JSON.stringify(users));
    return user;
  }

  function getUserByEmail(email) {
    const users = JSON.parse(localStorage.getItem(EX.USERS) || '[]');
    return users.find(u => u.email === email) || null;
  }

  function authenticateUser(email, password) {
    const user = getUserByEmail(email);
    if (!user) return { error: 'No account found for this email address' };
    const hash = btoa(password + '_cx_salt');
    if (user.passwordHash !== hash) return { error: 'Incorrect password' };
    if (user.status !== 'active') return { error: 'Account suspended — contact support' };
    const users = JSON.parse(localStorage.getItem(EX.USERS) || '[]');
    const idx = users.findIndex(u => u.id === user.id);
    users[idx].lastLogin = new Date().toISOString();
    localStorage.setItem(EX.USERS, JSON.stringify(users));
    return user;
  }

  // ── Company operations
  function createCompany(data) {
    const companies = JSON.parse(localStorage.getItem(EX.COMPANIES) || '[]');
    const cc = COUNTRY_CODES[data.country] || 'GLB';
    const ind = INDUSTRIES[data.industryKey] || INDUSTRIES.manufacturing;
    const cxId = generateCompanyID(cc, ind.code);
    const company = {
      id: cxId, name: data.name, legalName: data.legalName || data.name,
      industryKey: data.industryKey, industryLabel: ind.label, industryCode: ind.code,
      country: data.country, countryCode: cc,
      sector: data.sector || (ind.sectors[0] || ''),
      employeeCount: data.employeeCount || null, revenue: data.revenue || null,
      revenueUnit: data.revenueUnit || 'USD M',
      riskTier: ind.riskTier, riskColor: ind.riskColor,
      assessmentType: ind.assessmentType,
      regulatoryObligation: ind.regulatoryObligation,
      createdAt: new Date().toISOString(), status: 'active',
      representatives: [], assessmentIds: [],
      currentScore: null, currentRating: null
    };
    companies.push(company);
    localStorage.setItem(EX.COMPANIES, JSON.stringify(companies));
    _logAudit({ type:'COMPANY_CREATED', entityId:cxId, data:{ name:data.name } });
    return company;
  }

  function getCompany(id) {
    return (JSON.parse(localStorage.getItem(EX.COMPANIES)||'[]')).find(c=>c.id===id)||null;
  }

  function listCompanies() {
    return JSON.parse(localStorage.getItem(EX.COMPANIES)||'[]');
  }

  function updateCompany(id, updates) {
    const companies = JSON.parse(localStorage.getItem(EX.COMPANIES)||'[]');
    const i = companies.findIndex(c=>c.id===id);
    if (i<0) return null;
    companies[i] = { ...companies[i], ...updates, updatedAt:new Date().toISOString() };
    localStorage.setItem(EX.COMPANIES, JSON.stringify(companies));
    return companies[i];
  }

  // ── Representative operations
  function createRepresentative(data) {
    const reps = JSON.parse(localStorage.getItem(EX.REPS)||'[]');
    const company = getCompany(data.companyId);
    const cc = company ? company.countryCode : 'GLB';
    const repId = generateRepID(cc);
    const rep = {
      id: repId, userId: data.userId || null, companyId: data.companyId,
      name: data.name, email: data.email,
      designation: data.designation || '', department: data.department || '',
      role: data.role || 'sustainability_officer',
      authorityLevel: data.authorityLevel || 'standard',
      permissions: (ROLES[data.role] || ROLES.sustainability_officer).permissions,
      approvalAuthority: data.approvalAuthority || false,
      createdAt: new Date().toISOString(), lastActive: null,
      completedAssessments: [], uploadedEvidence: [], status: 'active'
    };
    reps.push(rep);
    localStorage.setItem(EX.REPS, JSON.stringify(reps));
    if (company) {
      const companies = JSON.parse(localStorage.getItem(EX.COMPANIES)||'[]');
      const ci = companies.findIndex(c=>c.id===data.companyId);
      if (ci>=0) { companies[ci].representatives.push(repId); localStorage.setItem(EX.COMPANIES,JSON.stringify(companies)); }
    }
    _logAudit({ type:'REP_CREATED', entityId:repId, data:{ name:data.name, companyId:data.companyId } });
    return rep;
  }

  function getRepresentative(id) {
    return (JSON.parse(localStorage.getItem(EX.REPS)||'[]')).find(r=>r.id===id)||null;
  }

  function getRepByUserId(userId) {
    return (JSON.parse(localStorage.getItem(EX.REPS)||'[]')).find(r=>r.userId===userId)||null;
  }

  function getRepsByCompany(companyId) {
    return (JSON.parse(localStorage.getItem(EX.REPS)||'[]')).filter(r=>r.companyId===companyId);
  }

  // ── Session management
  function createSession(userId, repId, companyId, role) {
    const session = {
      userId, repId, companyId, role,
      permissions: (ROLES[role]||ROLES.read_only).permissions,
      token: _genToken(), createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 8*3600000).toISOString()
    };
    localStorage.setItem(EX.SESSION, JSON.stringify(session));
    _logAudit({ type:'LOGIN', entityId:userId, data:{ role, companyId } });
    return session;
  }

  function getSession() {
    const raw = localStorage.getItem(EX.SESSION);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (new Date(s.expiresAt) < new Date()) { destroySession(); return null; }
    return s;
  }

  function destroySession() {
    const s = getSession();
    if (s) _logAudit({ type:'LOGOUT', entityId:s.userId, data:{} });
    localStorage.removeItem(EX.SESSION);
  }

  function hasPermission(perm) {
    const s = getSession();
    return !!(s && s.permissions.includes(perm));
  }

  // ── Assessment operations
  function createAssessment(data) {
    const list = JSON.parse(localStorage.getItem(EX.ASSESSMENTS)||'[]');
    const id = `CX-ASS-${Date.now()}`;
    const asm = {
      id, companyId:data.companyId, repId:data.repId,
      industryKey:data.industryKey, year:new Date().getFullYear(), version:1,
      status:'in_progress', answers:{}, scores:{},
      overallScore:null, rating:null,
      createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
      submittedAt:null, evidence:[], aiAnalysis:{}, contradictions:[], reviewerComments:[]
    };
    list.push(asm);
    localStorage.setItem(EX.ASSESSMENTS, JSON.stringify(list));
    const companies = JSON.parse(localStorage.getItem(EX.COMPANIES)||'[]');
    const ci = companies.findIndex(c=>c.id===data.companyId);
    if (ci>=0) { companies[ci].assessmentIds.push(id); localStorage.setItem(EX.COMPANIES,JSON.stringify(companies)); }
    _logAudit({ type:'ASSESSMENT_STARTED', entityId:id, data:{ companyId:data.companyId, industry:data.industryKey } });
    return asm;
  }

  function getAssessment(id) {
    return (JSON.parse(localStorage.getItem(EX.ASSESSMENTS)||'[]')).find(a=>a.id===id)||null;
  }

  function getCompanyAssessments(companyId) {
    return (JSON.parse(localStorage.getItem(EX.ASSESSMENTS)||'[]')).filter(a=>a.companyId===companyId);
  }

  function updateAssessment(id, updates) {
    const list = JSON.parse(localStorage.getItem(EX.ASSESSMENTS)||'[]');
    const i = list.findIndex(a=>a.id===id);
    if (i<0) return null;
    list[i] = { ...list[i], ...updates, updatedAt:new Date().toISOString() };
    localStorage.setItem(EX.ASSESSMENTS, JSON.stringify(list));
    return list[i];
  }

  // ── Audit logging
  function _logAudit(entry) {
    const log = JSON.parse(localStorage.getItem(EX.AUDIT)||'[]');
    const s = getSession();
    log.push({ ...entry, timestamp:new Date().toISOString(), sessionToken: s?s.token.slice(0,8):null });
    localStorage.setItem(EX.AUDIT, JSON.stringify(log.slice(-1000)));
  }

  function getAuditLog(filters={}) {
    let log = JSON.parse(localStorage.getItem(EX.AUDIT)||'[]');
    if (filters.entityId) log = log.filter(e=>e.entityId===filters.entityId);
    if (filters.type) log = log.filter(e=>e.type===filters.type);
    return log;
  }

  // ── Demo data initialization
  function initDemoData() {
    if (localStorage.getItem('cx_ent_demo_seeded')) return;

    // Demo user
    const demoUser = createUser({ email:'demo@climactix.com', password:'demo123', name:'Demo User' });

    // Demo company: ABC Logistics Pvt Ltd
    const demoCompany = createCompany({
      name:'ABC Logistics Pvt Ltd', legalName:'ABC Logistics Private Limited',
      industryKey:'logistics', country:'India',
      sector:'Road Freight', employeeCount:'500-1000', revenue:'50', revenueUnit:'USD M'
    });
    // Fix the demo company to the example ID from the brief
    const companies = JSON.parse(localStorage.getItem(EX.COMPANIES)||'[]');
    const ci = companies.findIndex(c=>c.id===demoCompany.id);
    if (ci>=0) { companies[ci].id = 'CX-IND-LOG-000847'; localStorage.setItem(EX.COMPANIES,JSON.stringify(companies)); }
    const fixedId = 'CX-IND-LOG-000847';

    // Demo rep: Rohit Sharma
    const demoRep = createRepresentative({
      userId: demoUser.id, companyId: fixedId,
      name:'Rohit Sharma', email:'demo@climactix.com',
      designation:'Head of Sustainability', department:'ESG & Climate',
      role:'sustainability_officer', approvalAuthority: true
    });
    // Fix rep ID to brief example
    const reps = JSON.parse(localStorage.getItem(EX.REPS)||'[]');
    const ri = reps.findIndex(r=>r.id===demoRep.id);
    if (ri>=0) { reps[ri].id = 'CX-REP-IND-0009421'; localStorage.setItem(EX.REPS,JSON.stringify(reps)); }

    // Link user to rep/company
    const users = JSON.parse(localStorage.getItem(EX.USERS)||'[]');
    const ui = users.findIndex(u=>u.id===demoUser.id);
    if (ui>=0) { users[ui].repId = 'CX-REP-IND-0009421'; users[ui].companyId = fixedId; users[ui].role = 'sustainability_officer'; localStorage.setItem(EX.USERS,JSON.stringify(users)); }

    localStorage.setItem('cx_ent_demo_seeded', '1');
  }

  // ── Export public API
  window.ENTERPRISE = {
    EX, COUNTRY_CODES, INDUSTRIES, ROLES, CORE_QUESTIONS, INDUSTRY_QUESTIONS,
    generateCompanyID, generateRepID, generateOTP,
    createUser, getUserByEmail, authenticateUser,
    createCompany, getCompany, listCompanies, updateCompany,
    createRepresentative, getRepresentative, getRepByUserId, getRepsByCompany,
    createSession, getSession, destroySession, hasPermission,
    createAssessment, getAssessment, getCompanyAssessments, updateAssessment,
    getAuditLog, initDemoData
  };

  // Auto-init demo data
  initDemoData();
})();
