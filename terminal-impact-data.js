/* ════════════════════════════════════════════════════════════════════
   CLIMACTIX SUSTAINABILITY IMPACT INTELLIGENCE — RESEARCH DATA LAYER
   Exports window.CX_IMPACT

   FIVE DATA LAYERS, KEPT SEPARATE (every datum carries its layer):
     research   External research benchmark   — cited from a named source
     reported   Company-reported information   — stated by a company
     public     Publicly available information — a company's public statement
     climactix  Climactix-generated assessment — our reading or calculation
     synthetic  Synthetic demonstration data   — invented, for illustration

   EXTERNAL SOURCE
   Science Based Targets initiative (2025), "The Impact of Setting
   Science-Based Targets on Businesses" (31 pp.). Figures below are cited
   from that report with page references. The report permits citation with
   attribution and does NOT license repackaging or resale; SBTi has not
   reviewed or endorsed Climactix. Nothing here is Climactix research
   unless its class is 'climactix'.

   RULES ENCODED HERE
   - Survey distributions are stored exactly as labelled in the report's
     charts: [neutral, somewhat positive, very positive]. The negative
     share is the remainder to 100 (the report rounds labels to sum to 100).
   - Where the report's text states a headline that differs by one point
     from the sum of the chart labels (rounding), the text figure is kept
     as the headline and the difference is noted.
   - No time series, industry split or response distribution is inferred.
   - Company-level net zero data exists only for synthetic entities.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var SOURCE = {
    id: 'sbti-2025', org: 'Science Based Targets initiative (SBTi)', year: 2025, pages: 31,
    title: 'The Impact of Setting Science-Based Targets on Businesses',
    home: 'https://sciencebasedtargets.org',
    cite: 'SBTi (2025), The Impact of Setting Science-Based Targets on Businesses',
    terms: 'The report may be cited provided SBTi is credited as the source. It does not license repackaging or resale of its contents.',
    stance: 'SBTi has not reviewed, approved or endorsed Climactix or this module.'
  };

  var LAYERS = {
    research: 'External research benchmark', reported: 'Company-reported information', 'public': 'Publicly available company information',
    climactix: 'Climactix-generated assessment', synthetic: 'Synthetic demonstration data'
  };
  var CLASSES = { survey: 'Survey finding', academic: 'Academic research', industry: 'Industry research', 'case': 'Case study', disclosure: 'Company disclosure', climactix: 'Climactix-generated analysis' };

  var SURVEY = {
    n: 171, period: '22 September to 6 October 2025', page: 27,
    who: 'Companies with an SBTi-validated science-based target in place for more than two years',
    method: 'Online survey run by SBTi. Five-point Likert scale covering four domains: climate, financial, strategic and reputational. Not every question was mandatory, so response counts vary by question.',
    funnel: [['Responses received', 256], ['Reported targets for more than two years', 189], ['Confirmed eligible against SBTi records', 171]],
    regions: [['Europe', 63], ['Asia', 23], ['North America', 9], ['Other regions (9 responses)', 5]],
    limits: [
      'The findings are companies’ own perceptions of impact. They are not measured financial or emissions outcomes.',
      '95% of valid responses came from corporates and 92% from high-income countries, so the results largely reflect larger companies in high-income countries.',
      'Respondents already hold validated targets, so the sample does not represent companies without targets.',
      'Labelled percentages are rounded to sum to 100, so a headline in the text can differ by one point from the sum of chart labels.'
    ]
  };

  /* ── Survey response distributions: [neutral, somewhat positive, very positive] ──
     pos: headline stated in the report text, where it differs from sp + vp.       */
  var DIST = {
    overall:      { g: 'overall', label: 'Overall impact on the company', n: 171, d: [9, 46, 45], page: 9 },
    rep_overall:  { g: 'reputation', label: 'Reputation overall', n: 171, d: [5, 59, 36], page: 11 },
    rep_employee: { g: 'reputation', label: 'Employee retention', n: 159, d: [57, 35, 7], page: 11 },
    rep_cred:     { g: 'reputation', label: 'Credibility within sector', n: 159, d: [25, 54, 21], page: 11 },
    rep_consumer: { g: 'reputation', label: 'Consumer perception and brand trust', n: 156, d: [33, 49, 18], page: 11 },
    rep_media:    { g: 'reputation', label: 'Media coverage', n: 154, d: [45, 40, 14], page: 11 },
    rep_investor: { g: 'reputation', label: 'Investor perception and relations', n: 153, d: [20, 55, 25], page: 11 },
    rep_supplier: { g: 'reputation', label: 'Perception as a supplier', n: 157, d: [31, 47, 22], page: 11 },
    rep_chain:    { g: 'reputation', label: 'Supply chain relations', n: 160, d: [41, 44, 12], page: 11 },
    str_overall:  { g: 'strategy', label: 'Strategic outlook overall', n: 171, d: [26, 54, 19], page: 12 },
    str_cohesion: { g: 'strategy', label: 'Strategic cohesion and long-term vision', n: 161, d: [20, 58, 22], page: 12 },
    str_align:    { g: 'strategy', label: 'Alignment with supply chain and customer requirements', n: 160, d: [24, 50, 24], page: 12 },
    str_reg:      { g: 'resilience', label: 'Resilience against future regulatory changes', n: 159, d: [27, 53, 18], pos: 72, page: 12 },
    str_compete:  { g: 'strategy', label: 'Competitiveness compared to peers', n: 160, d: [30, 43, 24], page: 12 },
    str_carbon:   { g: 'resilience', label: 'Preparing for a carbon-constrained world', n: 158, d: [32, 48, 18], page: 12 },
    str_trans:    { g: 'resilience', label: 'Resilience against transition risks', n: 156, d: [36, 47, 15], page: 12 },
    str_phys:     { g: 'resilience', label: 'Resilience against physical risks', n: 160, d: [51, 37, 9], page: 12 },
    str_innov:    { g: 'resilience', label: 'Catalysing innovation', n: 159, d: [47, 43, 8], page: 12 },
    str_newbiz:   { g: 'resilience', label: 'Access to new business opportunities', n: 158, d: [54, 32, 11], page: 12 },
    fin_overall:  { g: 'finance', label: 'Financial performance overall', n: 171, d: [61, 26, 7], pos: 32, page: 13 },
    fin_long:     { g: 'finance', label: 'Long-term financial performance', n: 150, d: [51, 36, 5], page: 13 },
    fin_share:    { g: 'finance', label: 'Share price or company valuation', n: 144, d: [72, 23, 4], page: 13 },
    fin_short:    { g: 'finance', label: 'Short-term financial performance', n: 155, d: [64, 21, 3], page: 13 },
    fin_eff:      { g: 'finance', label: 'Operational efficiency', n: 153, d: [44, 43, 8], page: 13 },
    fin_cost:     { g: 'finance', label: 'Operating costs', n: 156, d: [46, 19, 4], page: 13 },
    fin_shock:    { g: 'finance', label: 'Protection against price shocks', n: 144, d: [87, 9, 1], page: 13 },
    fin_conf:     { g: 'capital', label: 'Investor confidence', n: 148, d: [23, 52, 24], page: 13 },
    fin_loan:     { g: 'capital', label: 'Loan terms or credit ratings', n: 142, d: [52, 38, 10], page: 13 },
    fin_capital:  { g: 'capital', label: 'Access to capital or financing', n: 144, d: [55, 37, 7], page: 13 },
    fin_grants:   { g: 'capital', label: 'Access to government grants', n: 137, d: [79, 18, 2], page: 13 },
    cli_ambition: { g: 'climate', label: 'Level of climate ambition', n: 171, d: [9, 45, 45], page: 14 },
    cli_pace:     { g: 'climate', label: 'Pace of climate action', n: 171, d: [13, 50, 36], page: 14 },
    tt_all:       { g: 'target', label: 'All respondents', n: 171, d: [9, 46, 45], page: 15 },
    tt_near:      { g: 'target', label: 'Near-term target only', n: 118, d: [12, 49, 39], page: 15 },
    tt_netzero:   { g: 'target', label: 'Near-term and net zero targets', n: 53, d: [4, 40, 56], page: 15 },
    /* agreement scale: [neutral, agree, strongly agree]; disagree is the remainder */
    ag_commit:    { g: 'agree', label: 'My company remains committed to its target', n: 169, d: [10, 32, 57], page: 10 },
    ag_implement: { g: 'agree', label: 'My company is actively implementing its target', n: 169, d: [5, 39, 54], page: 10 }
  };
  Object.keys(DIST).forEach(function (k) {
    var r = DIST[k];
    r.id = k; r.neu = r.d[0]; r.sp = r.d[1]; r.vp = r.d[2];
    r.neg = 100 - r.neu - r.sp - r.vp;                 // remainder: 'somewhat' and 'very' negative combined
    r.sum = r.sp + r.vp;                               // as labelled on the chart
    r.positive = r.pos || r.sum;                       // headline as stated in the report text
    r.rounding = r.pos && r.pos !== r.sum ? 'The report text states ' + r.pos + '%. The chart labels sum to ' + r.sum + '% because labels are rounded to total 100.' : null;
  });

  /* ── Studies cited in the report (bibliography, p. 26) ─────────── */
  var STUDIES = {
    survey:    { cite: 'SBTi company survey', year: 2025, type: 'Survey', sample: '171 companies', method: SURVEY.method },
    altavilla: { cite: 'Altavilla, Boucinha, Pagano & Polo', year: 2024, type: 'Working paper', title: 'Climate risk, bank lending and monetary policy', sample: 'European bank lending (described in the report as a European Central Bank empirical analysis)', method: 'Empirical analysis of lending terms' },
    angelico:  { cite: 'Angelico & Bernardini', year: 2024, type: 'Working paper', title: 'New facts on carbon pledges of European banks', sample: 'European banks', method: 'Empirical analysis of sectoral lending' },
    benamar:   { cite: 'Ben-Amar, Comyns & Martinez', year: 2024, type: 'Journal article', title: 'Firm commitments on climate change: effects of science-based targets on financial outcomes during the COVID-19 crisis', sample: 'US companies, 2020 stock market crash', method: 'Comparison of crash-period returns' },
    bendig:    { cite: 'Bendig, Wagner & Lau', year: 2023, type: 'Journal article', title: 'Does it pay to be science-based green?', sample: '465 firms, 2015–2020', method: 'Association between emissions reductions and financial performance' },
    berg:      { cite: 'Berg, Huidobro & Rigobon', year: 2025, type: 'Working paper', title: 'On the Importance of Assurance in Carbon Accounting', sample: 'Not stated in the report', method: 'Analysis of assured versus unassured emissions data' },
    bolay:     { cite: 'Bolay, Bjørn, Patouillard, Weber & Margni', year: 2024, type: 'Journal article', title: 'What drives companies’ progress on their emission reduction targets?', sample: 'Not stated in the report', method: 'Analysis of progress against targets' },
    bolton:    { cite: 'Bolton & Kacperczyk', year: 2023, type: 'Working paper', title: 'Firm Commitments', sample: 'Early adopters before 2019', method: 'Empirical analysis of commitments' },
    dahlstrom: { cite: 'Dahlström, Lööf, Sahamkhadam, Stephan & Lu', year: 2023, type: 'Working paper', title: 'Science-based emission targets and risk-adjusted portfolio return', sample: '1,518 companies with SBTi-validated targets and a matched control group', method: 'Portfolio comparison with matching' },
    freiberg:  { cite: 'Freiberg, Grewal & Serafeim', year: 2021, type: 'Working paper', title: 'Science-based carbon emissions targets', sample: 'Data up to 2019', method: 'Quasi-experimental comparison of adopters and non-adopters' },
    giesekam:  { cite: 'Giesekam, Norman, Garvey & Betts-Davies', year: 2021, type: 'Journal article', title: 'Science-based targets: On target?', sample: 'Early adopters', method: 'Progress assessment' },
    guerrero:  { cite: 'Guerrero-Escobar, Hernández-del-Valle & Hernández-Vega', year: 2025, type: 'Journal article', title: 'The stock market effects of committing and setting GHG targets', sample: 'Not stated in the report', method: 'Event study' },
    ko:        { cite: 'Ko & Prakash', year: 2024, type: 'Journal article', title: 'Stock markets, corporate climate pledges, and the Science-Based Target Initiative', sample: 'Not stated in the report', method: 'Event study' },
    lee:       { cite: 'Lee, Séné & Vanston (MSCI Sustainability Institute)', year: 2025, type: 'Industry report', title: 'Transition Finance Tracker Q2', sample: 'Over 8,500 listed companies, 2018–2023, as described on p. 17', method: 'Comparison of median annual Scope 1 change by target status' },
    jli:       { cite: 'J. Li, Peng & Zhang', year: 2025, type: 'Journal article', title: 'The role of science-based targets on carbon mitigation', sample: 'Not stated in the report', method: 'Quasi-experimental comparison of adopters and non-adopters' },
    qli:       { cite: 'Q. Li', year: 2024, type: 'Conference paper', title: 'The Illusion of Science-Based Targets in Tackling Scope 3 Emissions and Supply Chain Carbon Leakage', sample: 'Not stated in the report', method: 'Empirical analysis' },
    ludemann:  { cite: 'Lüdemann & Radakovic', year: 2025, type: 'Thesis', title: 'Green Targets, Green Gains?', sample: 'Not stated in the report', method: 'Empirical analysis of stock volatility' },
    nicolajsen:{ cite: 'Nicolajsen, Bjørn, Mc Aloone & Pigosso', year: 2025, type: 'Conference paper', title: 'Mind the gap', sample: 'Danish early adopters', method: 'Life-cycle coverage assessment' },
    pineda:    { cite: 'Pineda Pérez & Grijalvo', year: 2025, type: 'Journal article', title: 'Corporate engagement with the Science Based Targets Initiative', sample: 'Panel of 4,000 companies', method: 'Panel regression' },
    romito:    { cite: 'Romito, Vurro & Pogutz', year: 2024, type: 'Journal article', title: 'Joining multi-stakeholder initiatives to fight climate change', sample: 'Not stated in the report', method: 'Matching' },
    ruiz:      { cite: 'Ruiz Manuel & Blok', year: 2023, type: 'Journal article', title: 'Quantitative evaluation of large corporate climate action initiatives shows mixed progress in their first half-decade', sample: 'Not stated in the report', method: 'Quantitative evaluation' },
    zhang:     { cite: 'Zhang', year: 2022, type: 'Thesis', title: 'The impact of science-based targets on GHG emissions and financial performance', sample: 'Four years after validation', method: 'Quasi-experimental comparison of adopters and non-adopters' },
    tracker:   { cite: 'SBTi Trend Tracker', year: 2025, type: 'Industry report', title: 'SBTi Trend Tracker 2025', sample: 'SBTi target data to end of June 2025', method: 'Count of companies setting targets' },
    pai:       { cite: 'PAI Partners case study', year: 2025, type: 'Case study', sample: 'One private equity firm and its portfolio', method: 'Interview-based case study in the report' },
    heineken:  { cite: 'HEINEKEN case study', year: 2025, type: 'Case study', sample: 'One company', method: 'Interview-based case study in the report' },
    renew:     { cite: 'ReNew case study', year: 2025, type: 'Case study', sample: 'One company', method: 'Interview-based case study in the report' }
  };

  /* ── Findings: [id, section, class, study, page, value, unit, statement, dist?] ── */
  var F = [
    ['b_rep', 'benefits', 'survey', 'survey', 11, 95, '%', 'reported a positive impact on reputation and stakeholder relationships', 'rep_overall'],
    ['b_overall', 'benefits', 'survey', 'survey', 9, 91, '%', 'reported a positive overall impact on the business; none reported a negative overall impact', 'overall'],
    ['b_ambition', 'benefits', 'survey', 'survey', 14, 90, '%', 'reported a positive impact on climate ambition', 'cli_ambition'],
    ['b_cohesion', 'benefits', 'survey', 'survey', 12, 80, '%', 'reported a positive impact on strategic cohesion and long-term vision', 'str_cohesion'],
    ['b_investor', 'benefits', 'survey', 'survey', 13, 76, '%', 'reported a positive impact on investor confidence', 'fin_conf'],
    ['b_supply', 'benefits', 'survey', 'survey', 12, 74, '%', 'reported a positive impact on alignment with supply chain and customer requirements', 'str_align'],
    ['b_reg', 'benefits', 'survey', 'survey', 12, 72, '%', 'reported a positive impact on resilience against future regulatory changes', 'str_reg'],
    ['b_compete', 'benefits', 'survey', 'survey', 12, 67, '%', 'reported a positive impact on competitiveness compared with peers', 'str_compete'],
    ['b_cred', 'benefits', 'survey', 'survey', 11, 75, '%', 'reported a positive impact on credibility within their sector', 'rep_cred'],
    ['b_supplier', 'benefits', 'survey', 'survey', 11, 69, '%', 'reported a positive impact on how they are perceived as a supplier', 'rep_supplier'],
    ['b_consumer', 'benefits', 'survey', 'survey', 11, 67, '%', 'reported a positive impact on consumer perception and brand trust', 'rep_consumer'],

    ['n_near', 'netzero', 'survey', 'survey', 27, 68, '%', 'of surveyed companies held validated near-term targets only'],
    ['n_both', 'netzero', 'survey', 'survey', 27, 32, '%', 'held both a validated near-term target and a validated net zero target'],
    ['n_nzpos', 'netzero', 'survey', 'survey', 15, 96, '%', 'of companies with net zero targets reported a positive overall impact', 'tt_netzero'],
    ['n_ntpos', 'netzero', 'survey', 'survey', 15, 88, '%', 'of companies with near-term targets only reported a positive overall impact', 'tt_near'],
    ['n_nzvery', 'netzero', 'survey', 'survey', 15, 56, '%', 'of companies with net zero targets reported a very positive impact'],
    ['n_ntvery', 'netzero', 'survey', 'survey', 15, 39, '%', 'of companies with near-term targets only reported a very positive impact'],
    ['n_implement', 'netzero', 'survey', 'survey', 10, 93, '%', 'agreed or strongly agreed that they are actively implementing their targets', 'ag_implement'],
    ['n_commit', 'netzero', 'survey', 'survey', 10, 89, '%', 'agreed or strongly agreed that they remain committed to their targets', 'ag_commit'],
    ['n_growth', 'netzero', 'industry', 'tracker', 7, 227, '%', 'growth in companies with both near-term and net zero targets between the end of 2023 and June 2025; companies setting science-based targets grew 97% over the same period'],

    ['f_conf', 'finance', 'survey', 'survey', 13, 76, '%', 'reported a positive impact on investor confidence', 'fin_conf'],
    ['f_percep', 'finance', 'survey', 'survey', 11, 80, '%', 'reported a positive impact on investor perception and relations', 'rep_investor'],
    ['f_longnp', 'finance', 'survey', 'survey', 13, 92, '%', 'reported a neutral or positive impact on long-term financial performance', 'fin_long'],
    ['f_longpos', 'finance', 'survey', 'survey', 13, 41, '%', 'reported a positive impact on long-term financial performance', 'fin_long'],
    ['f_cost', 'finance', 'survey', 'survey', 13, 31, '%', 'reported a negative impact on operating costs, the only area with a notable downside', 'fin_cost'],
    ['f_ecb', 'finance', 'academic', 'altavilla', 20, 16, 'bp', 'more discounted interest rates offered by European banks that have committed to set SBTi targets to firms with declared emissions targets, compared with banks with no SBTi commitment. The same banks charged high emitters a premium 2 basis points greater'],
    ['f_spend', 'finance', 'academic', 'freiberg', 19, '60–64', '%', 'more spent annually on climate-related initiatives by companies that set science-based targets, compared with firms that do not, on data up to 2019'],
    ['f_save', 'finance', 'academic', 'freiberg', 19, '22–33', '%', 'estimated future annual cost savings expected from those investments. Exact savings depend on the company and region'],
    ['f_margin', 'finance', 'academic', 'zhang', 19, null, '', 'Two studies found no negative impact on gross margins or profitability from adopting targets and reducing emissions (Zhang, 2022; J. Li et al., 2025)'],
    ['f_roa', 'finance', 'academic', 'bendig', 19, 465, 'firms', 'studied over 2015–2020: a positive association between emissions reductions and return on assets for companies with science-based targets'],

    ['c_abs', 'climate', 'academic', 'zhang', 17, 5.3, '%', 'greater reduction in absolute Scope 1 and 2 emissions over the four years after validation, compared with companies without targets'],
    ['c_int', 'climate', 'academic', 'zhang', 17, 8.7, '%', 'greater reduction in emissions intensity relative to sales over the same four years'],
    ['c_co2', 'climate', 'academic', 'freiberg', 19, '17–19', '%', 'estimated future annual CO₂ savings from climate investments such as solar installation or fleet electrification'],
    ['c_s1nz', 'climate', 'industry', 'lee', 17, -0.5, '% a year', 'median annual change in Scope 1 emissions for companies with SBTi net zero targets'],
    ['c_s1self', 'climate', 'industry', 'lee', 17, 0.2, '% a year', 'median annual change in Scope 1 emissions for companies with self-declared net zero targets'],
    ['c_s1none', 'climate', 'industry', 'lee', 17, 4.3, '% a year', 'median annual change in Scope 1 emissions for companies without targets'],
    ['c_pace', 'climate', 'survey', 'survey', 14, 86, '%', 'reported a positive impact on the pace of climate action', 'cli_pace'],
    ['c_valid', 'climate', 'academic', 'bolay', 17, null, '', 'Companies with ambitious climate targets made stronger progress when the targets were validated; those without validation tended to advance less'],
    ['c_assure', 'climate', 'academic', 'berg', 17, null, '', 'The most reliable emissions reductions are observed where emissions data is externally assured'],
    ['c_scope3', 'climate', 'academic', 'giesekam', 17, null, '', 'Value-chain (Scope 3) decarbonisation has been weaker than operational reductions, and Scope 3 data quality makes progress hard to measure (Giesekam et al., 2021; Nicolajsen et al., 2025; Zhang, 2022)'],
    ['c_offtrack', 'climate', 'academic', 'bolton', 17, null, '', 'A proportion of early adopters that committed or validated targets before 2019 were off-track (Bolton & Kacperczyk, 2023; Giesekam et al., 2021)'],
    ['c_conc', 'climate', 'academic', 'ruiz', 17, null, '', 'Emissions reductions among companies with validated targets are significant but can be concentrated in a few emission-intensive firms'],

    ['r_reg', 'resilience', 'survey', 'survey', 12, 72, '%', 'reported a positive impact on resilience against future regulatory changes', 'str_reg'],
    ['r_carbon', 'resilience', 'survey', 'survey', 12, 66, '%', 'saw benefits in preparing for a carbon-constrained economy', 'str_carbon'],
    ['r_trans', 'resilience', 'survey', 'survey', 12, 62, '%', 'reported greater resilience against transition risks', 'str_trans'],
    ['r_crash', 'resilience', 'academic', 'benamar', 18, null, '', 'US companies with SBTi-validated targets showed higher crash-period returns and less severe losses during the 2020 stock market crash'],
    ['r_vol', 'resilience', 'academic', 'guerrero', 18, null, '', 'Several studies reported lower stock price volatility after target validation, even where average returns did not rise (Guerrero-Escobar et al., 2025; Lüdemann & Radakovic, 2025)'],
    ['r_short', 'resilience', 'academic', 'ko', 18, null, '', 'Studies generally show little to no immediate effect on stock returns when firms commit to or set targets (Guerrero-Escobar et al., 2025; Ko & Prakash, 2024)'],
    ['r_longup', 'resilience', 'academic', 'dahlstrom', 18, 1518, 'companies', 'with validated targets compared with a matched control group: higher stock returns after validation, especially risk-adjusted and in high-emission industries'],
    ['r_longdown', 'resilience', 'academic', 'pineda', 18, 4000, 'companies', 'in a panel study: target validation was associated with a negative impact on stock price. The report notes that results vary with sample, sector and method'],
    ['r_lending', 'resilience', 'academic', 'angelico', 20, null, '', 'SBTi-linked goals appear more influential than other frameworks in steering banks’ sectoral lending away from high-carbon activities, though the effect varies and takes time'],

    ['k_pai1', 'resilience', 'case', 'pai', 22, 56, '%', 'increase in ESG-related investor requests observed by PAI Partners between the first half of 2023 and the first half of 2024'],
    ['k_pai2', 'resilience', 'case', 'pai', 22, 17, '%', 'absolute emissions reduction in two years at SGD Pharma, a PAI portfolio company'],
    ['k_hei', 'resilience', 'case', 'heineken', 23, 34, '%', 'reduction in Scope 1 and 2 emissions at HEINEKEN in 2024 against its 2022 baseline'],
    ['k_ren1', 'resilience', 'case', 'renew', 24, 23, '%', 'of ReNew’s critical supplier base now has its own net zero targets'],
    ['k_ren2', 'resilience', 'case', 'renew', 24, 91, '%', 'of ReNew’s Scope 3 emissions covered by the critical suppliers it assessed in FY2024-25'],

    ['x_scale', 'benchmark', 'industry', 'tracker', 7, 11000, 'businesses', 'worldwide have set or committed to set SBTi-validated targets, accounting for more than 40% of global market capitalisation'],
    ['x_europe', 'benchmark', 'survey', 'survey', 27, 63, '%', 'of survey responses came from European companies, 23% from Asia and 9% from North America'],
    ['x_income', 'benchmark', 'survey', 'survey', 27, 92, '%', 'of valid responses came from high-income countries, and 95% from corporates']
  ];
  var FINDINGS = F.map(function (r) {
    var st = STUDIES[r[3]], dist = r[8] ? DIST[r[8]] : null;
    return { id: r[0], section: r[1], cls: r[2], clsName: CLASSES[r[2]], study: r[3], studyCite: st.cite + ' (' + st.year + ')', year: st.year,
             sample: dist ? dist.n + ' responses to this question' : st.sample, method: st.method, page: r[4], value: r[5], unit: r[6], text: r[7],
             dist: r[8] || null, rounding: dist ? dist.rounding : null,
             layer: r[2] === 'case' ? 'reported' : 'research', source: SOURCE.cite };
  });

  var CASES = [
    { id: 'pai', name: 'PAI Partners', kind: 'Private equity', page: 22, title: 'Using targets to drive portfolio value',
      facts: ['Portfolio of 40 companies with combined sales of €40 billion', '56% rise in ESG-related investor requests, H1 2023 to H1 2024', 'SGD Pharma: 17% absolute emissions reduction in two years'] },
    { id: 'heineken', name: 'HEINEKEN', kind: 'Beverages', page: 23, title: 'Targets as a north star for decarbonisation',
      facts: ['Science-based targets set in 2021', 'Pathway to net zero across the value chain by 2040', 'Scope 1 and 2 emissions down 34% in 2024 against a 2022 baseline'] },
    { id: 'renew', name: 'ReNew', kind: 'Renewable energy, India', page: 24, title: 'Aligning supply chains and strengthening resilience',
      facts: ['Around 22,000 GWh of clean energy generated a year', '23% of critical suppliers now have their own net zero targets', 'Suppliers covering about 91% of Scope 3 emissions assessed in FY2024-25'] }
  ];

  /* ── Climactix reading: why each benefit matters to an institution ──
     Class: Climactix-generated analysis. These are interpretations, not findings. */
  var RELEVANCE = {
    b_rep: ['Reputation is the benefit companies report most. For a lender or insurer, it is a signal about counterparty conduct, not about cash flow.', 'bank'],
    b_overall: ['Nine in ten companies with validated targets see a net benefit. That makes a credible target a reasonable thing to ask a borrower or investee about.', 'investor'],
    b_ambition: ['Targets raise ambition. Whether ambition becomes reduction is a separate question, answered by emissions data.', 'government'],
    b_cohesion: ['A target that organises strategy suggests climate is managed centrally. That is relevant to governance assessment.', 'investor'],
    b_investor: ['Three in four companies report stronger investor confidence. This is the benefit most directly linked to cost and access to capital.', 'investor'],
    b_supply: ['Supply-chain alignment matters to trade finance and to buyers that pass requirements down to suppliers.', 'bank'],
    b_reg: ['Regulatory preparedness lowers the chance of a disclosure or compliance shock. That is useful context for underwriting and credit review.', 'insurance'],
    b_compete: ['Two in three report a competitive gain. It is the least widely reported of the eight, so it should not be assumed.', 'bank']
  };

  /* ── Net zero intelligence: SYNTHETIC company examples ─────────────
     Emissions in thousand tonnes CO₂e. null = not reported (never zero).
     Only synthetic entities carry figures. Real-name demo profiles show
     their publicly stated commitment and no emissions data.             */
  var NZ_YEARS = [2020, 2021, 2022, 2023, 2024, 2025];
  var STATUS = {
    validated:   { label: 'Validated', tone: 'ok', tip: 'The target has been assessed and validated by an independent standard-setter.' },
    committed:   { label: 'Committed', tone: 'acc', tip: 'The company has formally committed to set a target. It has not yet been validated.' },
    declared:    { label: 'Self-declared', tone: 'warn', tip: 'The company has announced a target itself. No independent validation has been located.' },
    unverified:  { label: 'Unverified', tone: 'warn', tip: 'A statement of ambition without a target year, boundary or validation.' },
    none:        { label: 'No target located', tone: '', tip: 'No net zero commitment was found in public information. This is recorded as missing, not as poor performance.' }
  };
  var NZ = {
    corvane:  { status: 'validated', nzYear: 2045, base: 2020, near: { pct: 42, year: 2030, scope: 'Scopes 1 and 2' }, long: '90% reduction across Scopes 1, 2 and 3 by 2045',
                cover: { s1: 100, s2: 100, s3: 67 }, docs: 'Net Zero Report FY2025-26; validation letter',
                s1: [120, 116, 111, 106, 101, 96], s2: [180, 168, 150, 139, 127, 117], s3: [900, null, 890, 880, 872, 860], rev: [4200, 4500, 4900, 5300, 5700, 6100] },
    solwick:  { status: 'committed', nzYear: 2050, base: 2021, near: { pct: 30, year: 2030, scope: 'Scopes 1 and 2' }, long: 'Net zero by 2050, boundary to be confirmed at validation',
                cover: { s1: 100, s2: 100, s3: null }, docs: 'Commitment letter; Net Zero Report FY2025-26',
                s1: [null, 8200, 8150, 8060, 7990, 7900], s2: [null, 150, 146, 140, 133, 128], s3: [null, null, null, null, null, null], rev: [null, 9100, 9600, 10300, 10900, 11500] },
    nordvane: { status: 'declared', nzYear: 2050, base: 2020, near: null, long: 'Net zero by 2050 (company statement)',
                cover: { s1: 100, s2: 100, s3: null }, docs: 'Net Zero Report FY2025-26',
                s1: [5400, 5380, 5420, 5460, 5440, 5450], s2: [900, 880, 870, 860, 850, 845], s3: [null, null, null, null, null, null], rev: [7800, 8100, 8600, 9000, 9300, 9700] },
    arvalis:  { status: 'unverified', nzYear: null, base: null, near: null, long: 'Statement of ambition without a target year',
                cover: { s1: null, s2: null, s3: null }, docs: 'Paragraph in annual report',
                s1: [null, null, null, 3100, 3140, 3180], s2: [null, null, null, 420, 415, 410], s3: [null, null, null, null, null, null], rev: [null, null, null, 2900, 3050, 3200] },
    tessara:  { status: 'none', nzYear: null, base: null, near: null, long: null, cover: { s1: null, s2: null, s3: null }, docs: null,
                s1: [null, null, null, null, null, null], s2: [null, null, null, null, null, null], s3: [null, null, null, null, null, null], rev: [null, null, null, null, null, null] }
  };

  function sum12(p, i) { return p.s1[i] == null || p.s2[i] == null ? null : p.s1[i] + p.s2[i]; }
  /* Target trajectory for Scopes 1 and 2: straight line to the near-term target, then to a 90% cut at the net zero year. */
  function trajectory(p, year) {
    if (p.base == null || p.nzYear == null) return null;
    var b = sum12(p, NZ_YEARS.indexOf(p.base));
    if (b == null) return null;
    if (p.near) {
      if (year <= p.near.year) return b * (1 - p.near.pct / 100 * (year - p.base) / (p.near.year - p.base));
      var at = b * (1 - p.near.pct / 100);
      return at + (b * 0.1 - at) * (year - p.near.year) / (p.nzYear - p.near.year);
    }
    return b * (1 - 0.9 * (year - p.base) / (p.nzYear - p.base));
  }
  function netZero(id) {
    var D = window.CX_TERMINAL_DEMO, c = D.company(id), p = NZ[id];
    if (!p) {
      return { id: id, company: c, synthetic: false, layer: 'public', status: 'declared', statusInfo: STATUS.declared,
               target: c.netZero.target, hasData: false,
               note: 'A publicly stated commitment for a recognisable company name. Emissions, target validation and progress are not connected in this demonstration, so none are shown.' };
    }
    var last = NZ_YEARS.length - 1, cur = sum12(p, last), prev = sum12(p, last - 1), baseIdx = p.base == null ? -1 : NZ_YEARS.indexOf(p.base);
    var base = baseIdx < 0 ? null : sum12(p, baseIdx), req = trajectory(p, NZ_YEARS[last]);
    var actual = base != null && cur != null ? (base - cur) / base * 100 : null;
    var required = base != null && req != null ? (base - req) / base * 100 : null;
    var finalCut = p.nzYear == null ? null : 90;
    var progress = cur == null ? { key: 'nodata', label: 'Not assessable', why: 'No emissions have been disclosed. This is recorded as missing data, not as poor performance.', tone: '' }
      : base == null || required == null ? { key: 'notarget', label: 'Not assessable', why: 'Emissions are reported but there is no dated target to measure them against.', tone: '' }
      : actual >= required ? { key: 'ahead', label: 'On or ahead of trajectory', why: 'Reported reduction of ' + actual.toFixed(1) + '% against ' + required.toFixed(1) + '% required by ' + NZ_YEARS[last] + '.', tone: 'ok' }
      : { key: 'behind', label: 'Behind trajectory', why: 'Reported reduction of ' + actual.toFixed(1) + '% against ' + required.toFixed(1) + '% required by ' + NZ_YEARS[last] + '.', tone: 'warn' };
    return {
      id: id, company: c, synthetic: true, layer: 'synthetic', hasData: cur != null, status: p.status, statusInfo: STATUS[p.status], profile: p, years: NZ_YEARS,
      target: p.long || 'No commitment located', reportingYear: NZ_YEARS[last],
      s12: NZ_YEARS.map(function (_, i) { return sum12(p, i); }),
      traj: NZ_YEARS.map(function (y) { var v = trajectory(p, y); return v == null || y < p.base ? null : Math.round(v); }),
      trajectoryAt: function (y) { return trajectory(p, y); },
      baseline: base, current: cur, yoy: cur != null && prev != null ? (cur - prev) / prev * 100 : null,
      intensity: NZ_YEARS.map(function (_, i) { var e = sum12(p, i); return e == null || p.rev[i] == null ? null : Math.round(e * 1000 / p.rev[i] * 10) / 10; }),
      actualCut: actual, requiredCut: required, remaining: actual != null && finalCut != null ? Math.max(0, finalCut - actual) : null,
      progress: progress, confidence: D.score(id).confidence,
      trajectoryBasis: p.near ? 'Straight line to the near-term target, then to a 90% reduction at the net zero year.' : p.nzYear ? 'No interim target was declared. The line shown is a straight path to a 90% reduction at the net zero year, constructed by Climactix for comparison only.' : null
    };
  }

  function finding(id) { for (var i = 0; i < FINDINGS.length; i++) if (FINDINGS[i].id === id) return FINDINGS[i]; return null; }

  window.CX_IMPACT = {
    source: SOURCE, layers: LAYERS, classes: CLASSES, survey: SURVEY, studies: STUDIES, cases: CASES, relevance: RELEVANCE, status: STATUS, nzYears: NZ_YEARS,
    dist: function (id) { return DIST[id]; },
    group: function (g) { return Object.keys(DIST).filter(function (k) { return DIST[k].g === g; }).map(function (k) { return DIST[k]; }); },
    findings: function (f) {
      f = f || {};
      return FINDINGS.filter(function (x) {
        return (!f.section || x.section === f.section) && (!f.cls || x.cls === f.cls) &&
               (!f.q || (x.text + ' ' + x.studyCite + ' ' + x.value).toLowerCase().indexOf(f.q.toLowerCase()) !== -1);
      });
    },
    finding: finding,
    netZero: netZero,
    hasCompanyData: function (id) { return !!NZ[id]; }
  };
})();
