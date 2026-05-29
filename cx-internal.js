/**
 * Climactix Global — Internal Analyst Portal Data Layer v1.0
 * SEPARATE from company portal (enterprise.js)
 * Analyst auth, review workflows, AI engine, framework mapping, report generation
 */

(function () {
  'use strict';

  const CXI = {
    SESSION:      'cx_int_session',
    ANALYSTS:     'cx_int_analysts',
    REVIEWS:      'cx_int_reviews',
    REPORTS:      'cx_int_reports',
    AI_OUTPUTS:   'cx_int_ai_outputs',
    ANNOTATIONS:  'cx_int_annotations',
    COUNTERS:     'cx_int_counters'
  };

  // ── Internal analyst roles (Climactix Global employees only)
  const INTERNAL_ROLES = {
    super_admin: {
      label: 'Super Admin', badge: '#FF3333', clearance: 10,
      description: 'Full platform access — platform governance',
      permissions: ['read_all','write_all','delete_all','override_scores','approve_all','manage_analysts','manage_platform','audit_all','generate_reports','publish_reports']
    },
    climate_analyst: {
      label: 'Climate Analyst', badge: '#FF6600', clearance: 7,
      description: 'Primary assessment reviewer and climate intelligence analyst',
      permissions: ['read_assessments','review_assessments','add_comments','flag_issues','request_clarification','approve_sections','view_evidence','generate_reports','assign_reviews']
    },
    esg_reviewer: {
      label: 'ESG Reviewer', badge: '#0099CC', clearance: 6,
      description: 'ESG framework alignment reviewer and disclosure validator',
      permissions: ['read_assessments','review_assessments','add_comments','flag_issues','request_clarification','view_evidence','framework_mapping']
    },
    financial_risk_analyst: {
      label: 'Financial Risk Analyst', badge: '#FFB800', clearance: 7,
      description: 'Climate financial risk and capital allocation specialist',
      permissions: ['read_assessments','review_assessments','add_comments','flag_issues','view_scores','override_scores_pending','financial_analysis','stress_testing']
    },
    report_validator: {
      label: 'Report Validator', badge: '#00CC44', clearance: 6,
      description: 'Institutional report quality validation and sign-off',
      permissions: ['read_reports','validate_reports','approve_reports','add_comments','publish_reports']
    },
    sector_specialist: {
      label: 'Sector Specialist', badge: '#9966FF', clearance: 6,
      description: 'Industry-specific climate risk domain expert',
      permissions: ['read_assessments','review_assessments','add_comments','flag_issues','sector_analysis']
    },
    compliance_team: {
      label: 'Compliance Team', badge: '#888888', clearance: 5,
      description: 'Regulatory compliance and audit trail oversight',
      permissions: ['read_all','view_audit','compliance_review','export_compliance']
    },
    platform_ops: {
      label: 'Platform Operations', badge: '#3399FF', clearance: 4,
      description: 'Platform infrastructure and data management',
      permissions: ['read_all','manage_data','view_audit','system_health']
    }
  };

  // ── Framework mapping engine — question ID → framework disclosures
  const FRAMEWORK_MAP = {
    // Governance
    'CX-G01': [{fw:'TCFD',ref:'Governance-a'},{fw:'IFRS S2',ref:'GOV-1'},{fw:'GRI',ref:'2-9'},{fw:'CSRD',ref:'ESRS G1-1'},{fw:'BRSR',ref:'Leadership-A'}],
    'CX-G02': [{fw:'TCFD',ref:'Governance-b'},{fw:'IFRS S2',ref:'GOV-2'},{fw:'CSRD',ref:'ESRS G1-1'},{fw:'SASB',ref:'330-1'}],
    'CX-G03': [{fw:'TCFD',ref:'Risk Management-a'},{fw:'IFRS S2',ref:'GOV-3'},{fw:'GRI',ref:'2-12'},{fw:'CSRD',ref:'ESRS E1-1'}],
    'CX-G04': [{fw:'TCFD',ref:'Governance-a/b'},{fw:'IFRS S2',ref:'GOV-1'},{fw:'CSRD',ref:'ESRS G1-2'},{fw:'CDP',ref:'C1.1'}],
    // Strategy & Targets
    'CX-S01': [{fw:'TCFD',ref:'Strategy-a'},{fw:'IFRS S2',ref:'STR-1'},{fw:'SBTi',ref:'Commitment'},{fw:'CDP',ref:'C4.1'},{fw:'CSRD',ref:'ESRS E1-1'}],
    'CX-S02': [{fw:'TCFD',ref:'Strategy-a'},{fw:'SBTi',ref:'Validation'},{fw:'CDP',ref:'C4.1a'},{fw:'CSRD',ref:'ESRS E1-1'}],
    'CX-S03': [{fw:'TCFD',ref:'Strategy-b'},{fw:'IFRS S2',ref:'STR-2'},{fw:'CDP',ref:'C3.1'},{fw:'CSRD',ref:'ESRS E1-6'},{fw:'BRSR',ref:'P6-Q3'}],
    // GHG Emissions
    'CX-E01': [{fw:'GHG Protocol',ref:'Scope 1'},{fw:'TCFD',ref:'Metrics-c'},{fw:'CDP',ref:'C6.1'},{fw:'CSRD',ref:'ESRS E1-6'},{fw:'BRSR',ref:'P6-Q1'},{fw:'IFRS S2',ref:'MTR-5'}],
    'CX-E02': [{fw:'GHG Protocol',ref:'Scope 2'},{fw:'TCFD',ref:'Metrics-c'},{fw:'CDP',ref:'C6.3'},{fw:'CSRD',ref:'ESRS E1-6'},{fw:'BRSR',ref:'P6-Q1'}],
    'CX-E03': [{fw:'GHG Protocol',ref:'Scope 3'},{fw:'TCFD',ref:'Metrics-c'},{fw:'CDP',ref:'C6.5'},{fw:'CSRD',ref:'ESRS E1-6'},{fw:'PCAF',ref:'Financed Emissions'}],
    'CX-E04': [{fw:'TCFD',ref:'Metrics-d'},{fw:'CDP',ref:'C6.7'},{fw:'CSRD',ref:'ESRS E1-6'},{fw:'IFRS S2',ref:'MTR-5'}],
    // TCFD & Disclosure
    'CX-D01': [{fw:'TCFD',ref:'Full Framework'},{fw:'IFRS S2',ref:'All'},{fw:'CSRD',ref:'ESRS E1'},{fw:'SEC Climate',ref:'Reg S-K'},{fw:'SEBI',ref:'BRSR Core'}],
    'CX-D02': [{fw:'GRI',ref:'2-3'},{fw:'CDP',ref:'Annual Disclosure'},{fw:'CSRD',ref:'ESRS 1'},{fw:'BRSR',ref:'Annual Report'}],
    'CX-D03': [{fw:'TCFD',ref:'Evidence'},{fw:'CDP',ref:'Verification'},{fw:'CSRD',ref:'ESRS 1-6'},{fw:'GRI',ref:'2-5'}],
    // Physical Risk
    'CX-P01': [{fw:'TCFD',ref:'Risk Management-a/b'},{fw:'IFRS S2',ref:'RMG-1'},{fw:'TNFD',ref:'LEAP-P'},{fw:'CDP',ref:'C2.1'},{fw:'CSRD',ref:'ESRS E1-9'}],
    'CX-P02': [{fw:'TCFD',ref:'Risk Management'},{fw:'TNFD',ref:'Core Framework'},{fw:'NGFS',ref:'Physical Scenarios'}],
    // Transition Risk
    'CX-T01': [{fw:'TCFD',ref:'Strategy-c'},{fw:'IFRS S2',ref:'STR-3'},{fw:'NGFS',ref:'Transition Scenarios'},{fw:'CDP',ref:'C3.1'},{fw:'CSRD',ref:'ESRS E1-9'}],
    'CX-T02': [{fw:'TCFD',ref:'Strategy-c'},{fw:'NGFS',ref:'Scenarios'},{fw:'IFRS S2',ref:'STR-3'},{fw:'CDP',ref:'C3.2'}],
    // Financial Materiality
    'CX-F01': [{fw:'TCFD',ref:'Metrics-a'},{fw:'IFRS S2',ref:'MTR-1'},{fw:'CSRD',ref:'ESRS E1-9'},{fw:'SEC Climate',ref:'Risk Factors'},{fw:'RBI',ref:'Climate Risk Circular'}],
    'CX-F02': [{fw:'TCFD',ref:'Metrics-b'},{fw:'IFRS S2',ref:'MTR-3'},{fw:'Basel III',ref:'Pillar 3 ESG'},{fw:'CSRD',ref:'ESRS E1-9'}],
    // Supply Chain
    'CX-SC01': [{fw:'GHG Protocol',ref:'Scope 3 Cat 1'},{fw:'CSRD',ref:'ESRS E1-6'},{fw:'CDP',ref:'C6.5'},{fw:'TNFD',ref:'LEAP-D'}],
    'CX-SC02': [{fw:'CSRD',ref:'ESRS G1-2'},{fw:'GRI',ref:'2-6'},{fw:'CDP',ref:'Supply Chain'}],
    // Banking specific
    'BNK-F01': [{fw:'PCAF',ref:'Standard Part A'},{fw:'TCFD',ref:'Financed Emissions'},{fw:'GHG Protocol',ref:'Scope 3 Cat 15'},{fw:'CSRD',ref:'ESRS E1-6'}],
    'BNK-F02': [{fw:'PCAF',ref:'Data Quality'},{fw:'NGFS',ref:'Financial Sector'},{fw:'Basel III',ref:'Climate Risk'}],
    'BNK-P01': [{fw:'NGFS',ref:'Scenario Analysis'},{fw:'TCFD',ref:'Strategy-c'},{fw:'Basel III',ref:'Stress Testing'}],
    'BNK-C01': [{fw:'NGFS',ref:'Climate VaR'},{fw:'Basel III',ref:'Pillar 2'},{fw:'TCFD',ref:'Metrics'},{fw:'PCAF',ref:'Portfolio Alignment'}],
    'BNK-G01': [{fw:'EU Taxonomy',ref:'Green Finance'},{fw:'SFDR',ref:'Art 8/9'},{fw:'CSRD',ref:'Green KPIs'}]
  };

  // ── All 16 frameworks
  const FRAMEWORKS = [
    {code:'TCFD',    label:'Task Force on Climate-related Financial Disclosures', mandatory:['G20','UK','Singapore','Japan'], type:'global'},
    {code:'IFRS S2', label:'IFRS Sustainability Disclosure Standards S2 (Climate)', mandatory:['UK','Australia','Canada'], type:'global'},
    {code:'IFRS S1', label:'IFRS Sustainability Disclosure Standards S1 (General)', mandatory:['UK','Australia'], type:'global'},
    {code:'GRI',     label:'Global Reporting Initiative Standards', mandatory:['EU'], type:'global'},
    {code:'SASB',    label:'Sustainability Accounting Standards Board', mandatory:[], type:'voluntary'},
    {code:'CDP',     label:'Carbon Disclosure Project', mandatory:['EU','Japan'], type:'global'},
    {code:'TNFD',    label:'Taskforce on Nature-related Financial Disclosures', mandatory:[], type:'emerging'},
    {code:'CSRD',    label:'EU Corporate Sustainability Reporting Directive', mandatory:['EU'], type:'regulatory'},
    {code:'ESRS',    label:'European Sustainability Reporting Standards', mandatory:['EU'], type:'regulatory'},
    {code:'BRSR',    label:'Business Responsibility and Sustainability Report', mandatory:['India'], type:'regulatory'},
    {code:'Basel III',label:'Basel III Climate Risk Integration (BCBS)',mandatory:['G20'], type:'financial'},
    {code:'PCAF',    label:'Partnership for Carbon Accounting Financials', mandatory:['Banking'], type:'sector'},
    {code:'NGFS',    label:'Network for Greening the Financial System', mandatory:['Central Banks'], type:'financial'},
    {code:'SEC',     label:'SEC Climate Disclosure Rule (US)', mandatory:['USA'], type:'regulatory'},
    {code:'RBI',     label:'RBI Climate Risk & Sustainable Finance Guidelines', mandatory:['India'], type:'regulatory'},
    {code:'SEBI',    label:'SEBI BRSR Core Framework', mandatory:['India'], type:'regulatory'}
  ];

  // ── AI scoring engine (nonlinear institutional)
  function computeClimateVaR(scores, company){
    if(!scores||!company) return null;
    const ind = (window.ENTERPRISE?.INDUSTRIES||{})[company.industryKey]||{};
    const riskMultiplier = {'Critical Transition Exposure':2.2,'High Transition Exposure':1.8,'High Physical Exposure':1.7,'High Physical & Transition Risk':2.0,'Elevated Physical Exposure':1.5,'Moderate Physical & Transition Risk':1.3,'Moderate Transition Exposure':1.2,'Moderate Physical Exposure':1.1}[ind.riskTier]||1.3;
    const baseScore = scores.overall||50;
    const vuln = (100 - baseScore) / 100;
    const exposure = ((scores.c_risk_p||50) + (scores.c_risk_t||50)) / 200;
    const materiality = (scores.c_fin||50) / 100;
    const confidence = scores.answered ? Math.min(1, scores.answered / 20) : 0.5;
    const climateVaR = Math.round(vuln * exposure * materiality * riskMultiplier * confidence * 100);
    return Math.min(100, Math.max(1, climateVaR));
  }

  function getGreenwashingProbability(scores, answers){
    if(!scores||!answers) return null;
    let score = 0;
    const flags = [];
    // High governance + low truth = greenwashing signal
    if ((scores.c_core||0) > 70 && (scores.c_truth||0) < 40) { score += 30; flags.push('Strong governance claims with weak disclosure'); }
    // High adaptation claims + low evidence
    if ((scores.c_adapt||0) > 75 && Object.values(answers).filter(v=>v==='uploaded'||v==='YES').length < 3) { score += 20; flags.push('Adaptation claims without evidence'); }
    // Strategy without targets
    const hasTarget = Object.values(answers).some(v=>typeof v==='string'&&/net.zero|target|commitment/i.test(v));
    if (hasTarget && (scores.c_truth||0) < 50) { score += 15; flags.push('Net-zero claim without verifiable targets'); }
    // Low supply chain + high overall
    if ((scores.c_supply||0) < 35 && (scores.overall||0) > 65) { score += 15; flags.push('High overall score despite supply chain blindspot'); }
    return { probability: Math.min(95, score), flags, level: score >= 50 ? 'High' : score >= 25 ? 'Moderate' : 'Low' };
  }

  function runAIAssessment(assessment, company){
    if(!assessment||!company) return null;
    const answers = assessment.answers || {};
    const layerScores = assessment.scores || {};
    const overall = assessment.overallScore;
    const gw = getGreenwashingProbability(layerScores, answers);
    const climateVaR = computeClimateVaR({...layerScores, overall, answered:Object.keys(answers).length}, company);
    const ind = (window.ENTERPRISE?.INDUSTRIES||{})[company.industryKey]||{};

    const contradictions = [];
    if ((layerScores.c_core||0) > 70 && (layerScores.c_truth||0) < 35) {
      contradictions.push({type:'disclosure_gap', severity:'high', description:'Board governance score (C-CORE) is significantly higher than disclosure integrity score (C-TRUTH). Suggests governance is claimed but not evidenced.'});
    }
    if ((layerScores.c_adapt||0) > 70 && (layerScores.c_fin||0) < 40) {
      contradictions.push({type:'strategy_gap', severity:'medium', description:'High adaptation readiness claim (C-ADAPT) inconsistent with low financial materiality integration (C-FIN). Climate adaptation plans appear disconnected from financial planning.'});
    }
    if ((layerScores.c_capital||0) < 35 && (layerScores.c_adapt||0) > 60) {
      contradictions.push({type:'carbon_gap', severity:'medium', description:'Elevated adaptation ambition without carbon inventory baseline. C-CAPITAL score indicates Scope 1/2/3 emissions not fully quantified.'});
    }

    const weakSections = Object.entries(layerScores).filter(([,v])=>v&&v<45).map(([k])=>k);
    const strongSections = Object.entries(layerScores).filter(([,v])=>v&&v>75).map(([k])=>k);

    const C_LAYERS = window.ENTERPRISE ? null : [
      {id:'c_core',label:'C-CORE',long:'Governance & Strategy',weight:10},
      {id:'c_fin',label:'C-FIN',long:'Financial Materiality',weight:20}
    ];

    const financialExposure = assessment.answers?.['CX-F02'] ? parseFloat(assessment.answers['CX-F02']) : null;
    const scope1 = assessment.answers?.['CX-E01'] ? parseFloat(assessment.answers['CX-E01']) : null;
    const scope2 = assessment.answers?.['CX-E02'] ? parseFloat(assessment.answers['CX-E02']) : null;

    return {
      analysisId: `CX-AI-${Date.now()}`,
      assessmentId: assessment.id,
      companyId: company.id,
      timestamp: new Date().toISOString(),
      overallScore: overall,
      greenwashingAnalysis: gw,
      climateVaR,
      contradictions,
      weakSections,
      strongSections,
      financialExposure,
      totalGHG: scope1&&scope2 ? scope1+scope2 : null,
      disclosureQuality: layerScores.c_truth||null,
      adaptationReadiness: layerScores.c_adapt||null,
      transitionVulnerability: layerScores.c_risk_t||null,
      physicalExposure: layerScores.c_risk_p||null,
      industryBenchmark: ind.riskTier,
      riskClassification: overall >= 70 ? 'Managed' : overall >= 50 ? 'Elevated' : 'Critical',
      confidenceScore: Math.min(100, Math.round((Object.keys(answers).length / 25) * 100)),
      aiVersion: 'Climactix AI v1.0'
    };
  }

  // ── Framework mapping for an assessment
  function mapAssessmentToFrameworks(assessment){
    const answers = assessment.answers || {};
    const results = {};
    FRAMEWORKS.forEach(fw => { results[fw.code] = {covered:[], missing:[], coverage:0}; });
    Object.keys(answers).forEach(qId => {
      const mappings = FRAMEWORK_MAP[qId] || [];
      mappings.forEach(m => {
        if (results[m.fw]) results[m.fw].covered.push({questionId:qId, ref:m.ref});
      });
    });
    // Calculate coverage scores
    const fwTotals = {};
    Object.values(FRAMEWORK_MAP).forEach(mappings => {
      mappings.forEach(m => { fwTotals[m.fw] = (fwTotals[m.fw]||0)+1; });
    });
    FRAMEWORKS.forEach(fw => {
      const total = fwTotals[fw.code]||1;
      results[fw.code].coverage = Math.round((results[fw.code].covered.length/total)*100);
    });
    return results;
  }

  // ── AI Report Generation Engine
  function generateInstitutionalReport(assessment, company, aiAnalysis){
    if(!assessment||!company) return null;
    const scores = assessment.scores || {};
    const overall = assessment.overallScore || 0;
    const rating = getClimateRating(overall);
    const gw = aiAnalysis?.greenwashingAnalysis||{probability:0,flags:[],level:'Low'};
    const frameworkMapping = mapAssessmentToFrameworks(assessment);
    const ind = (window.ENTERPRISE?.INDUSTRIES||{})[company.industryKey]||{};

    const C_LAYER_DEFS = [
      {id:'c_core',label:'C-CORE',long:'Governance & Strategy',weight:10,color:'#0099CC'},
      {id:'c_fin',label:'C-FIN',long:'Financial Materiality',weight:20,color:'#FFB800'},
      {id:'c_risk_p',label:'C-RISK/P',long:'Physical Risk Exposure',weight:15,color:'#FF6600'},
      {id:'c_risk_t',label:'C-RISK/T',long:'Transition Risk Exposure',weight:15,color:'#FF4400'},
      {id:'c_capital',label:'C-CAPITAL',long:'Carbon & Capital',weight:10,color:'#3399FF'},
      {id:'c_supply',label:'C-SUPPLY',long:'Supply Chain Fragility',weight:10,color:'#9966FF'},
      {id:'c_adapt',label:'C-ADAPT',long:'Adaptation & Resilience',weight:10,color:'#00CC44'},
      {id:'c_truth',label:'C-TRUTH',long:'Disclosure Integrity',weight:10,color:'#FF3333'}
    ];

    function scoreLabel(s){ return !s?'Not Assessed':s>=80?'Strong':s>=60?'Adequate':s>=40?'Developing':'Weak'; }
    function riskLabel(s){ return !s?'Unknown':s>=70?'Low':s>=50?'Moderate':s>=35?'High':'Critical'; }

    const report = {
      reportId: `CX-RPT-${Date.now()}`,
      companyId: company.id,
      assessmentId: assessment.id,
      generatedAt: new Date().toISOString(),
      version: '1.0',
      status: 'draft',

      cover: {
        companyName: company.name,
        entityId: company.id,
        industry: company.industryLabel,
        country: company.country,
        assessmentYear: assessment.year,
        assessmentType: ind.assessmentType||'Climate Risk Assessment',
        overallScore: overall,
        rating: rating.grade,
        ratingDesc: rating.desc,
        ratingColor: rating.color,
        generatedBy: 'Climactix AI Engine v1.0',
        reportTitle: 'Institutional Climate Intelligence Report'
      },

      sections: {
        executiveSummary: {
          title: 'Executive Climate Intelligence Summary',
          content: `${company.name} has completed the Climactix Global institutional climate assessment for ${assessment.year}. The entity has been assigned a Climactix Climate Rating of ${rating.grade} (${rating.desc}) with an overall C-SCORE of ${overall}/100.`,
          keyFindings: [
            `Overall C-SCORE: ${overall}/100 — ${rating.desc}`,
            `Industry Risk Tier: ${company.riskTier}`,
            `Greenwashing Risk: ${gw.level} (${gw.probability}% probability)`,
            `Climate VaR: ${aiAnalysis?.climateVaR||'—'}/100`,
            `Disclosure Integrity: ${scores.c_truth ? scoreLabel(scores.c_truth) : 'Not Assessed'}`,
            `${aiAnalysis?.contradictions?.length||0} internal contradictions detected`
          ],
          confidenceScore: aiAnalysis?.confidenceScore||50,
          riskClassification: aiAnalysis?.riskClassification||'Elevated'
        },

        institutionalRating: {
          title: 'Final Institutional Climate Rating',
          grade: rating.grade,
          score: overall,
          description: rating.desc,
          color: rating.color,
          rationale: `Rating determined through the Climactix C-LAYER framework — 8-dimensional nonlinear institutional scoring architecture weighting Governance (10%), Financial Materiality (20%), Physical Risk (15%), Transition Risk (15%), Carbon & Capital (10%), Supply Chain (10%), Adaptation (10%), and Disclosure Integrity (10%).`,
          clayerScores: C_LAYER_DEFS.map(cl => ({
            id: cl.id, label: cl.label, long: cl.long,
            weight: cl.weight, score: scores[cl.id]||null,
            status: scoreLabel(scores[cl.id]),
            riskLevel: riskLabel(scores[cl.id])
          })),
          benchmarkComparison: `Compared to ${company.industryLabel} industry median, this entity is ${overall >= 55 ? 'performing above' : 'performing below'} sector average.`
        },

        financialExposure: {
          title: 'Climate Financial Exposure Analysis',
          totalExposure: aiAnalysis?.financialExposure ? `USD ${aiAnalysis.financialExposure}M` : 'Not quantified',
          climateVaR: aiAnalysis?.climateVaR ? `${aiAnalysis.climateVaR}/100` : 'Not calculated',
          internalCarbonPrice: assessment.answers?.['CX-F04'] ? `USD ${assessment.answers['CX-F04']}/tCO₂e` : 'Not set',
          carbonPricingExposure: assessment.answers?.['CX-E01'] ? `Estimated at USD ${Math.round(parseFloat(assessment.answers['CX-E01']||0)*0.13)}M at USD 130/tCO₂e (2030 IEA)` : 'Not calculated',
          financialIntegration: scores.c_fin ? scoreLabel(scores.c_fin) : 'Not Assessed',
          keyRisks: [
            scores.c_risk_t && scores.c_risk_t < 50 ? 'Transition risk financial exposure requires urgent quantification' : null,
            !assessment.answers?.['CX-F03'] || assessment.answers['CX-F03'] === 'NO' ? 'No internal carbon price — investment decisions not climate-adjusted' : null,
            scores.c_capital && scores.c_capital < 40 ? 'GHG inventory incomplete — carbon liability underestimated' : null
          ].filter(Boolean)
        },

        physicalRisk: {
          title: 'Physical Climate Risk Exposure',
          score: scores.c_risk_p||null,
          status: riskLabel(scores.c_risk_p),
          methodology: assessment.answers?.['CX-P02'] || 'Not specified',
          financialImpact: assessment.answers?.['CX-P03'] ? `USD ${assessment.answers['CX-P03']}M` : 'Not quantified',
          industrySpecificRisks: ind.keyRisks ? ind.keyRisks.slice(0,3) : [],
          assessmentTool: assessment.answers?.['CX-P02'] || 'Not disclosed',
          materiality: scores.c_risk_p && scores.c_risk_p < 50 ? 'High' : 'Moderate'
        },

        transitionRisk: {
          title: 'Transition Risk Analysis',
          score: scores.c_risk_t||null,
          status: riskLabel(scores.c_risk_t),
          scenarios: assessment.answers?.['CX-T02'] || 'Not disclosed',
          financialImpact: assessment.answers?.['CX-T03'] ? `USD ${assessment.answers['CX-T03']}M` : 'Not quantified',
          regulatoryExposure: ind.regulatoryObligation || 'Not assessed',
          stranded_asset_risk: company.industryKey === 'energy' ? 'High' : company.industryKey === 'manufacturing' ? 'Moderate' : 'Low',
          carbonPricingExposure: assessment.answers?.['CX-F03'] === 'YES' ? 'Internal carbon price in use' : 'No internal carbon price'
        },

        carbonLiability: {
          title: 'Carbon Liability Analysis',
          score: scores.c_capital||null,
          scope1: assessment.answers?.['CX-E01'] ? `${parseFloat(assessment.answers['CX-E01']).toLocaleString()} tCO₂e` : 'Not disclosed',
          scope2: assessment.answers?.['CX-E02'] ? `${parseFloat(assessment.answers['CX-E02']).toLocaleString()} tCO₂e` : 'Not disclosed',
          scope3: assessment.answers?.['CX-E03'] ? `${parseFloat(assessment.answers['CX-E03']).toLocaleString()} tCO₂e` : 'Not disclosed',
          totalGHG: aiAnalysis?.totalGHG ? `${aiAnalysis.totalGHG.toLocaleString()} tCO₂e (Scope 1+2)` : 'Not fully disclosed',
          assuranceLevel: assessment.answers?.['CX-E04'] || 'Not specified',
          netZeroTarget: assessment.answers?.['CX-S01'] === 'YES' ? 'Committed' : 'Not committed',
          targetAlignment: assessment.answers?.['CX-S02'] || 'Not assessed'
        },

        governanceAssessment: {
          title: 'Governance & Board Oversight Assessment',
          score: scores.c_core||null,
          status: scoreLabel(scores.c_core),
          boardOversight: assessment.answers?.['CX-G01'] === 'YES' ? 'Formal board responsibility confirmed' : 'Board oversight not established',
          reportingFrequency: assessment.answers?.['CX-G02'] || 'Not specified',
          ermIntegration: assessment.answers?.['CX-G03'] === 'YES' ? 'ERM integration confirmed' : 'Not integrated into ERM',
          governanceQuality: scores.c_core >= 70 ? 'Institutional grade' : scores.c_core >= 50 ? 'Developing' : 'Pre-institutional'
        },

        supplyChain: {
          title: 'Supply Chain Fragility Assessment',
          score: scores.c_supply||null,
          status: riskLabel(scores.c_supply),
          scope3Coverage: assessment.answers?.['CX-SC01'] || 'Not assessed',
          supplierRequirements: assessment.answers?.['CX-SC02'] === 'YES' ? 'Climate requirements in supplier contracts' : 'No supplier climate requirements',
          fragility: scores.c_supply && scores.c_supply < 45 ? 'High — supply chain represents unquantified climate liability' : 'Moderate — further mapping required'
        },

        adaptation: {
          title: 'Adaptation Capacity & Resilience',
          score: scores.c_adapt||null,
          status: scoreLabel(scores.c_adapt),
          netZeroStrategy: assessment.answers?.['CX-S03'] ? 'Transition strategy documented' : 'Not documented',
          emissionReduction: assessment.answers?.['CX-S04'] ? `${assessment.answers['CX-S04']}% reduction achieved` : 'Not quantified',
          adaptationMaturity: scores.c_adapt >= 70 ? 'Advanced' : scores.c_adapt >= 50 ? 'Developing' : 'Early stage'
        },

        greenwashingAnalysis: {
          title: 'Greenwashing Probability Analysis',
          probability: gw.probability,
          level: gw.level,
          flags: gw.flags,
          disclosureIntegrity: scores.c_truth||null,
          tcfdCompleteness: assessment.answers?.['CX-D01'] || 'Not assessed',
          verificationStatus: assessment.answers?.['CX-E04'] || 'No third-party verification',
          contradictions: aiAnalysis?.contradictions||[]
        },

        climateCreditworthiness: {
          title: 'Climate Creditworthiness Assessment',
          rating: rating.grade,
          score: overall,
          investmentGrade: overall >= 60,
          creditImplication: overall >= 70 ? 'Eligible for green finance instruments — climate risk premium manageable' : overall >= 50 ? 'Climate risk premium applicable — improvement roadmap required' : 'Significant climate risk premium — material credit risk identified',
          cofc: overall >= 70 ? 'Standard' : overall >= 50 ? '+50-100bps climate premium' : '+150-300bps climate risk adjustment',
          basel3Pillar2: scores.c_risk_p && scores.c_risk_t ? `Physical risk: ${scores.c_risk_p}/100 | Transition risk: ${scores.c_risk_t}/100` : 'Incomplete risk quantification'
        },

        capitalAllocationReadiness: {
          title: 'Capital Allocation Readiness',
          score: scores.c_fin||null,
          euTaxonomyAlignment: assessment.answers?.['BNK-G01'] ? `${assessment.answers['BNK-G01']}% of portfolio aligned` : 'Not assessed',
          greenFinanceEligibility: overall >= 65 ? 'Eligible for green bonds/loans under current framework' : 'Additional improvements required for green finance eligibility',
          internalCarbonPrice: assessment.answers?.['CX-F04'] || 'Not implemented',
          readinessLevel: scores.c_fin >= 70 ? 'Investment ready' : scores.c_fin >= 50 ? 'Developing' : 'Pre-readiness'
        },

        climateVaR: {
          title: 'Climate Value at Risk (CVaR)',
          score: aiAnalysis?.climateVaR,
          methodology: 'Nonlinear institutional scoring — Exposure × Vulnerability × Financial Materiality × Probability × Time Sensitivity × Confidence',
          physicalVaR: scores.c_risk_p ? `${Math.round((100-scores.c_risk_p)*0.4)}% portfolio value at risk (physical, 2050)` : 'Not calculated',
          transitionVaR: scores.c_risk_t ? `${Math.round((100-scores.c_risk_t)*0.35)}% portfolio value at risk (transition, 2030)` : 'Not calculated',
          totalVaR: aiAnalysis?.climateVaR ? `${aiAnalysis.climateVaR}/100 Climate VaR Index` : 'Not calculated'
        },

        frameworkCompliance: {
          title: 'Regulatory Framework Compliance Mapping',
          mappings: FRAMEWORKS.map(fw => ({
            code: fw.code, label: fw.label,
            coverage: frameworkMapping[fw.code]?.coverage||0,
            status: (frameworkMapping[fw.code]?.coverage||0)>=70?'Aligned':(frameworkMapping[fw.code]?.coverage||0)>=40?'Partial':'Missing',
            mandatory: fw.mandatory, type: fw.type
          }))
        },

        recommendations: {
          title: 'Strategic Recommendations',
          immediate: [],
          shortTerm: [],
          longTerm: []
        },

        evidenceReliability: {
          title: 'Evidence Reliability Analysis',
          documentsUploaded: (assessment.evidence||[]).length,
          verificationLevel: assessment.answers?.['CX-E04']?.includes('Reasonable')?'High':assessment.answers?.['CX-E04']?.includes('Limited')?'Medium':'Low',
          ghgVerification: assessment.answers?.['CX-E04']||'Not specified',
          tcfdEvidence: assessment.answers?.['CX-D03']?'Report uploaded':'Not uploaded',
          overallReliability: (assessment.evidence||[]).length > 2 ? 'Adequate' : 'Insufficient documentation'
        }
      }
    };

    // Generate recommendations
    const recs = report.sections.recommendations;
    if (!overall || overall < 40) recs.immediate.push('Initiate comprehensive climate risk framework implementation immediately — current C-SCORE indicates critical exposure.');
    if ((scores.c_truth||0) < 40) recs.immediate.push('Establish TCFD-aligned climate disclosure with third-party verification as priority action.');
    if ((scores.c_capital||0) < 40) recs.immediate.push('Complete full GHG inventory (Scope 1, 2, 3) to establish carbon liability baseline.');
    if ((scores.c_core||0) < 50) recs.shortTerm.push('Formalize board-level climate risk governance with documented oversight responsibilities.');
    if ((scores.c_fin||0) < 55) recs.shortTerm.push('Quantify climate-related financial risks and integrate into financial planning and capital allocation.');
    if ((scores.c_supply||0) < 50) recs.shortTerm.push('Map Tier 1 supplier climate risk exposure and establish supplier engagement programme.');
    if (!assessment.answers?.['CX-S01'] || assessment.answers['CX-S01'] === 'NO') recs.shortTerm.push('Set science-based net-zero target aligned with SBTi 1.5°C pathway.');
    recs.longTerm.push('Develop comprehensive climate scenario analysis aligned with NGFS Net Zero 2050, Delayed Transition, and Hot House World scenarios.');
    recs.longTerm.push(`Achieve ${overall >= 60 ? 'AA-C' : 'A-C'} Climactix rating within 24 months through systematic C-LAYER improvement programme.`);
    if (gw.probability > 30) recs.immediate.push(`Address ${gw.flags.length} greenwashing risk flag${gw.flags.length!==1?'s':''}: ${gw.flags.slice(0,2).join('; ')}.`);

    return report;
  }

  function getClimateRating(s){
    if(!s||s<1) return {grade:'—',desc:'No assessment',color:'#555555'};
    if(s>=90) return {grade:'AAA-C',desc:'Climate Intelligence Leader',color:'#00CC44'};
    if(s>=80) return {grade:'AA-C',desc:'Advanced Climate Resilience',color:'#22DD55'};
    if(s>=70) return {grade:'A-C',desc:'Strong Climate Readiness',color:'#66EE88'};
    if(s>=60) return {grade:'BBB-C',desc:'Moderate Climate Risk',color:'#0099CC'};
    if(s>=50) return {grade:'BB-C',desc:'Elevated Climate Risk',color:'#FFB800'};
    if(s>=35) return {grade:'B-C',desc:'High Climate Risk',color:'#FF6600'};
    return {grade:'CCC-C',desc:'Critical Climate Risk',color:'#FF3333'};
  }

  // ── Counter management
  function _getCounters(){ return JSON.parse(localStorage.getItem(`${CXI.COUNTERS}`))||{analyst:101,review:5001}; }
  function _saveCounters(c){ localStorage.setItem(CXI.COUNTERS, JSON.stringify(c)); }
  function generateAnalystID(){ const c=_getCounters(); c.analyst++; _saveCounters(c); return `CX-ANL-${String(c.analyst).padStart(6,'0')}`; }
  function generateReviewID(){ const c=_getCounters(); c.review++; _saveCounters(c); return `CX-REV-${String(c.review).padStart(7,'0')}`; }
  function _genToken(){ try{return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,'0')).join('');}catch{return Math.random().toString(36).repeat(3).slice(2,66);} }

  // SHA-256 via SubtleCrypto — replaces btoa which is encoding, not hashing
  async function _hashCXI(password) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password + '_cx_int_v2'));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ── Analyst user management
  async function createAnalyst(data){
    const analysts = JSON.parse(localStorage.getItem(CXI.ANALYSTS)||'[]');
    if(analysts.find(a=>a.email===data.email)) return {error:'Email already registered'};
    const id = generateAnalystID();
    const analyst = {
      id, email:data.email, name:data.name,
      role:data.role||'climate_analyst',
      passwordHash: await _hashCXI(data.password),
      department:data.department||'Climate Intelligence',
      specialization:data.specialization||null,
      status:'active', createdAt:new Date().toISOString(), lastLogin:null,
      reviewsCompleted:0, reportsGenerated:0
    };
    analysts.push(analyst);
    localStorage.setItem(CXI.ANALYSTS, JSON.stringify(analysts));
    return analyst;
  }

  function getAnalystByEmail(email){ return (JSON.parse(localStorage.getItem(CXI.ANALYSTS)||'[]')).find(a=>a.email===email)||null; }

  async function authenticateAnalyst(email, password){
    const analyst = getAnalystByEmail(email);
    if(!analyst) return {error:'No analyst account found for this email'};
    if(analyst.passwordHash !== await _hashCXI(password)) return {error:'Incorrect password'};
    if(analyst.status!=='active') return {error:'Account suspended'};
    const analysts = JSON.parse(localStorage.getItem(CXI.ANALYSTS)||'[]');
    const i = analysts.findIndex(a=>a.id===analyst.id);
    if(i>=0){analysts[i].lastLogin=new Date().toISOString();localStorage.setItem(CXI.ANALYSTS,JSON.stringify(analysts));}
    return analyst;
  }

  // ── Internal session management (SEPARATE from company sessions)
  function createAnalystSession(analystId, role){
    const session = {
      analystId, role,
      permissions:(INTERNAL_ROLES[role]||INTERNAL_ROLES.climate_analyst).permissions,
      token:_genToken(), createdAt:new Date().toISOString(),
      expiresAt:new Date(Date.now()+8*3600000).toISOString(),
      portalType:'internal'
    };
    localStorage.setItem(CXI.SESSION, JSON.stringify(session));
    return session;
  }

  function getAnalystSession(){
    const raw=localStorage.getItem(CXI.SESSION);
    if(!raw) return null;
    const s=JSON.parse(raw);
    if(new Date(s.expiresAt)<new Date()){destroyAnalystSession();return null;}
    if(s.portalType!=='internal') return null;
    return s;
  }

  function destroyAnalystSession(){ localStorage.removeItem(CXI.SESSION); }

  function hasAnalystPermission(perm){ const s=getAnalystSession(); return !!(s&&s.permissions.includes(perm)); }

  // ── Review workflow
  function createReview(assessmentId, companyId, analystId){
    const reviews = JSON.parse(localStorage.getItem(CXI.REVIEWS)||'[]');
    const existing = reviews.find(r=>r.assessmentId===assessmentId&&r.status!=='rejected'&&r.status!=='approved');
    if(existing) return existing;
    const review = {
      id: generateReviewID(), assessmentId, companyId,
      assignedTo: analystId||null, status:'pending',
      annotations:{}, sectionApprovals:{}, overrideRequest:null,
      comments:[], createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(),
      priority:'normal', dueDate:new Date(Date.now()+7*24*3600000).toISOString()
    };
    reviews.push(review);
    localStorage.setItem(CXI.REVIEWS, JSON.stringify(reviews));
    return review;
  }

  function getReview(id){ return (JSON.parse(localStorage.getItem(CXI.REVIEWS)||'[]')).find(r=>r.id===id)||null; }
  function getReviewByAssessment(assessmentId){ return (JSON.parse(localStorage.getItem(CXI.REVIEWS)||'[]')).find(r=>r.assessmentId===assessmentId)||null; }
  function listReviews(filter={}){
    let reviews=JSON.parse(localStorage.getItem(CXI.REVIEWS)||'[]');
    if(filter.status) reviews=reviews.filter(r=>r.status===filter.status);
    if(filter.assignedTo) reviews=reviews.filter(r=>r.assignedTo===filter.assignedTo);
    return reviews;
  }

  function updateReview(id, updates){
    const reviews=JSON.parse(localStorage.getItem(CXI.REVIEWS)||'[]');
    const i=reviews.findIndex(r=>r.id===id);
    if(i<0) return null;
    reviews[i]={...reviews[i],...updates,updatedAt:new Date().toISOString()};
    localStorage.setItem(CXI.REVIEWS,JSON.stringify(reviews));
    return reviews[i];
  }

  function addAnnotation(reviewId, questionId, type, text, analystId){
    const review = getReview(reviewId);
    if(!review) return null;
    const annotations = review.annotations || {};
    annotations[questionId] = annotations[questionId]||[];
    annotations[questionId].push({type,text,analystId,timestamp:new Date().toISOString()});
    return updateReview(reviewId,{annotations});
  }

  function approveAssessment(reviewId, analystId, comments){
    const s=getAnalystSession();
    if(!s) return {error:'Not authenticated'};
    updateReview(reviewId,{status:'approved',approvedBy:analystId,approvedAt:new Date().toISOString(),comments:[...(getReview(reviewId)?.comments||[]),{type:'approval',text:comments,by:analystId,at:new Date().toISOString()}]});
    return {success:true};
  }

  function requestClarification(reviewId, analystId, questions){
    updateReview(reviewId,{status:'clarification_requested',comments:[...(getReview(reviewId)?.comments||[]),{type:'clarification',text:questions,by:analystId,at:new Date().toISOString()}]});
  }

  function submitScoreOverride(reviewId, newScore, justification, analystId){
    updateReview(reviewId,{overrideRequest:{newScore,justification,requestedBy:analystId,requestedAt:new Date().toISOString(),status:'pending_approval'}});
  }

  // ── Report persistence
  function saveReport(report){
    const reports=JSON.parse(localStorage.getItem(CXI.REPORTS)||'[]');
    const i=reports.findIndex(r=>r.reportId===report.reportId);
    if(i>=0) reports[i]=report; else reports.push(report);
    localStorage.setItem(CXI.REPORTS,JSON.stringify(reports));
    return report;
  }

  function getReport(id){ return (JSON.parse(localStorage.getItem(CXI.REPORTS)||'[]')).find(r=>r.reportId===id)||null; }
  function getCompanyReports(companyId){ return (JSON.parse(localStorage.getItem(CXI.REPORTS)||'[]')).filter(r=>r.companyId===companyId); }

  // ── Demo data seeding — password driven by window.CX_DEMO_CONFIG to keep credentials out of source
  async function initInternalDemo(){
    if(localStorage.getItem('cx_int_demo_seeded')) return;
    const cfg = window.CX_DEMO_CONFIG;
    if(!cfg || !cfg.enabled || !cfg.password) return;
    await createAnalyst({name:'Alexandra Chen',email:'analyst@climactix.global',password:cfg.password,role:'climate_analyst',department:'Climate Intelligence',specialization:'Energy & Industrials'});
    await createAnalyst({name:'James Okafor',email:'risk@climactix.global',password:cfg.password,role:'financial_risk_analyst',department:'Financial Risk',specialization:'Banking & Finance'});
    await createAnalyst({name:'Sarah Mitchell',email:'admin@climactix.global',password:cfg.password,role:'super_admin',department:'Platform Governance'});
    // Create review queue entries for any existing submitted assessments
    if(window.ENTERPRISE){
      const companies=window.ENTERPRISE.listCompanies();
      companies.forEach(c=>{
        const asms=window.ENTERPRISE.getCompanyAssessments(c.id);
        asms.filter(a=>a.status==='submitted').forEach(a=>{
          createReview(a.id,c.id,null);
        });
      });
    }
    localStorage.setItem('cx_int_demo_seeded','1');
  }

  // ── Export
  window.CX_INTERNAL = {
    CXI, INTERNAL_ROLES, FRAMEWORKS, FRAMEWORK_MAP,
    generateAnalystID, generateReviewID,
    createAnalyst, getAnalystByEmail, authenticateAnalyst,
    createAnalystSession, getAnalystSession, destroyAnalystSession, hasAnalystPermission,
    createReview, getReview, getReviewByAssessment, listReviews, updateReview,
    addAnnotation, approveAssessment, requestClarification, submitScoreOverride,
    runAIAssessment, mapAssessmentToFrameworks, generateInstitutionalReport,
    computeClimateVaR, getGreenwashingProbability, getClimateRating,
    saveReport, getReport, getCompanyReports, initInternalDemo
  };

  // Auto-init
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>{if(window.ENTERPRISE)window.CX_INTERNAL.initInternalDemo();});
  } else {
    if(window.ENTERPRISE) initInternalDemo();
  }
})();
