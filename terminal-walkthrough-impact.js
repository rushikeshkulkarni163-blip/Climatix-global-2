/* ════════════════════════════════════════════════════════════════════
   CLIMACTIX TERMINAL — MODULE 10 · SUSTAINABILITY IMPACT INTELLIGENCE
   "Transforming Sustainability Commitments into Measurable Business Intelligence."

   Seven sections, addressed as #/impact/<section>:
     benefits · netzero · finance · climate · resilience · benchmark · evidence

   External research (CX_IMPACT, cited from SBTi 2025) and Climactix's own
   synthetic company examples are never mixed on one chart, and every chart
   states its evidence class and source.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var X = window.CXT, D = X.D, R = window.CX_IMPACT, C = window.CXChart, esc = X.esc;
  var on = function (root, type, sel, fn) {
    root.addEventListener(type, function (e) { var t = e.target.closest(sel); if (t && root.contains(t)) fn(t, e); });
  };
  var TABS = [['benefits', 'Business benefits'], ['netzero', 'Net zero target intelligence'], ['finance', 'Financial and investment impact'], ['climate', 'Climate performance'],
              ['resilience', 'Resilience and preparedness'], ['benchmark', 'Industry benchmarking'], ['evidence', 'Research and evidence']];

  /* source line under every chart: where the number comes from, and a way to open the evidence */
  function src(pages, extra) {
    return 'Source: ' + esc(R.source.cite) + ', p. ' + pages + (extra ? ' · ' + esc(extra) : '') + ' · <button class="linkbtn" data-go="impact/evidence">Open evidence</button>';
  }
  var SURVEY_METHOD = 'SBTi survey of 171 companies with validated targets held for more than two years, 22 September to 6 October 2025. Five-point scale. These are companies’ perceptions, not measured outcomes.';
  function synth(text) { return 'Synthetic demonstration data · ' + (text || 'not a real company’s figures'); }
  function stat(id, label) {
    var f = R.finding(id);
    return '<button class="panel cx-stat" data-go="impact/evidence?f=' + id + '" data-tip="' + esc(f.value + f.unit + ' ' + f.text + '. ' + f.studyCite + ', p. ' + f.page + '. Select to open the evidence.') + '">' +
      X.gauge(typeof f.value === 'number' && f.unit === '%' ? f.value : null, { size: 92, stroke: 8, big: 0.27, sub: false }) + '<span><b>' + esc(label) + '</b><small>' + esc(f.clsName) + ' · p. ' + f.page + '</small></span></button>';
  }
  function bigStat(id, label) {
    var f = R.finding(id);
    return '<button class="panel cx-big" data-go="impact/evidence?f=' + id + '" data-tip="' + esc(f.studyCite + ', p. ' + f.page + '. ' + f.method) + '"><small>' + esc(label) + '</small><b class="num">' + (typeof f.value === 'number' && f.unit === '%' ? X.count(f.value) : f.value) + '<i>' + esc(f.unit) + '</i></b><span>' + esc(f.text) + '.</span><em>' + esc(f.clsName) + ' · ' + esc(f.studyCite) + '</em></button>';
  }
  function evChip(f) { return '<span class="chip ev-' + f.cls + '">' + esc(f.clsName) + '</span>'; }
  function note(ids, title) {
    return '<section class="panel"><div class="panel-h"><h3>' + esc(title) + '</h3></div><div class="panel-b flush">' + ids.map(function (id) {
      var f = R.finding(id);
      return '<button class="cx-ev" data-go="impact/evidence?f=' + id + '"><span>' + (f.value != null ? '<b class="num">' + f.value + (f.unit === '%' ? '%' : ' ' + esc(f.unit)) + '</b> ' : '') + esc(f.text) + (f.value != null ? '.' : '') + '</span><small>' + esc(f.studyCite) + ' · p. ' + f.page + '</small></button>';
    }).join('') + '</div></section>';
  }
  function statusChip(z) { return '<span class="chip dot ' + z.statusInfo.tone + '" data-tip="' + esc(z.statusInfo.tip) + '">' + esc(z.statusInfo.label) + '</span>'; }
  X.nzChip = function (id) { return statusChip(R.netZero(id)); };

  var SECTIONS = {};

  /* ── 1 · Corporate sustainability business benefits ────────────── */
  SECTIONS.benefits = function (ctx) {
    var ui = ctx.ui; ui.dom = ui.dom || 'reputation';
    var eight = ['b_rep', 'b_overall', 'b_ambition', 'b_cohesion', 'b_investor', 'b_supply', 'b_reg', 'b_compete'];
    var names = { b_rep: 'Reputation', b_overall: 'Overall business impact', b_ambition: 'Climate ambition', b_cohesion: 'Strategic cohesion', b_investor: 'Investor confidence', b_supply: 'Supply-chain alignment', b_reg: 'Regulatory resilience', b_compete: 'Competitiveness' };
    var o = R.dist('overall');
    return '<div class="cx-stats">' + eight.map(function (id) { return stat(id, names[id]); }).join('') + '</div>' +
      '<div class="grid">' +
        C.card({ cls: 'c5', title: 'Overall impact of setting targets', sub: 'How companies with validated targets describe the effect on their business.', evidence: 'Survey finding', evidenceKey: 'survey', method: SURVEY_METHOD,
          body: C.donut([{ v: o.vp, label: 'Very positive', tone: 'pos' }, { v: o.sp, label: 'Somewhat positive', tone: 'sp' }, { v: o.neu, label: 'Neutral', tone: 'neu' }, { v: o.neg, label: 'Negative', tone: 'neg', note: 'no company reported a negative overall impact' }], { center: X.count(o.positive) + '%', centerSub: 'positive', label: 'Overall impact' }),
          source: src(9, 'n = 171') }) +
        C.card({ cls: 'c7', title: 'Where companies report a positive impact', sub: 'Share reporting a somewhat or very positive impact. Select a bar to open the evidence.', evidence: 'Survey finding', evidenceKey: 'survey', method: SURVEY_METHOD,
          body: C.hbars(eight.map(function (id) { var f = R.finding(id); return { label: names[id], v: f.value, tone: f.value >= 80 ? 'pos' : 'acc', go: 'impact/evidence?f=' + id, tip: f.value + '% ' + f.text + ' (p. ' + f.page + ')' }; })),
          legend: [['pos', '80% and above'], ['acc', 'Below 80%']], source: src('9–14', 'response counts vary by question, 148 to 171') }) +
      '</div>' +
      C.card({ title: 'The full picture, question by question', sub: 'Every response category, so the neutral and negative shares are visible as well as the positive.', evidence: 'Survey finding', evidenceKey: 'survey', method: SURVEY_METHOD + ' The negative share combines somewhat and very negative.',
        body: '<div class="seg" role="group" aria-label="Survey domain" style="margin-bottom:16px"><button data-dom="reputation" aria-pressed="' + (ui.dom === 'reputation') + '">Reputation and relationships</button><button data-dom="strategy" aria-pressed="' + (ui.dom === 'strategy') + '">Strategy and competitiveness</button></div>' +
              C.likert(R.group(ui.dom)), legend: C.likertLegend('impact'), source: src(ui.dom === 'reputation' ? 11 : 12) }) +
      '<section class="panel" style="margin-top:16px"><div class="panel-h"><h3>Why each benefit matters to an institution</h3><span class="chip ev-climactix">Climactix-generated analysis</span><div class="sub">Our reading of the survey for institutional users. These are interpretations, not findings of the report.</div></div><div class="panel-b flush">' +
        eight.map(function (id) { var f = R.finding(id), r = R.relevance[id]; return '<div class="cx-why"><b class="num">' + f.value + '%</b><span><b>' + names[id] + '</b>' + esc(r[0]) + '</span><button class="btn sm" data-go="' + r[1] + '">Open the ' + r[1] + ' view</button></div>'; }).join('') +
      '</div></section>';
  };

  /* ── 2 · Net zero target intelligence ──────────────────────────── */
  SECTIONS.netzero = function (ctx) {
    var ui = ctx.ui;
    if (ctx.query.c && D.company(ctx.query.c)) ui.co = ctx.query.c;
    ui.co = ui.co || 'corvane';
    var z = R.netZero(ui.co), c = z.company, p = z.profile;
    var dl = function (rows) { return '<dl class="meta">' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>'; };
    var nr = '<span class="muted" data-tip="Not reported. Recorded as missing, never as zero or as poor performance.">Not reported</span>';
    var pct = function (v) { return v == null ? nr : v + '%'; };
    var kt = function (v) { return v == null ? nr : C.fmt(v) + ' kt CO₂e'; };
    var last = R.nzYears.length - 1;

    var research =
      '<div class="grid">' +
        C.card({ cls: 'c4', title: 'Which targets surveyed companies hold', sub: 'All respondents hold a validated near-term target. About a third also hold a validated net zero target.', evidence: 'Survey finding', evidenceKey: 'survey', method: SURVEY_METHOD,
          body: C.donut([{ v: 68, label: 'Near-term target only', tone: 'acc', note: '118 companies' }, { v: 32, label: 'Near-term and net zero', tone: 'pos', note: '53 companies' }], { pie: true, size: 180, label: 'Target type' }), source: src('15, 27', 'n = 171') }) +
        C.card({ cls: 'c8', title: 'Net zero targets and reported business impact', sub: 'Companies holding a net zero target as well were more likely to report a positive, and a very positive, impact.', evidence: 'Survey finding', evidenceKey: 'survey', method: SURVEY_METHOD + ' Groups: 118 near-term only, 53 with both.',
          body: C.dumbbell([{ label: 'Positive overall impact', a: 88, b: 96 }, { label: 'Very positive impact', a: 39, b: 56 }], { a: 'Near-term target only', b: 'Near-term and net zero' }) +
                '<div style="margin-top:24px">' + C.likert(R.group('target')) + '</div>', legend: C.likertLegend('impact'), source: src(15) }) +
      '</div>' +
      C.card({ title: 'Commitment versus implementation', sub: 'Holding a target and acting on it are different things. The survey asked about both.', evidence: 'Survey finding', evidenceKey: 'survey', method: SURVEY_METHOD + ' Agreement scale; the disagree share is the remainder.',
        body: C.likert(R.group('agree'), { scale: 'agree' }), legend: C.likertLegend('agree'), source: src(10, 'n = 169') });

    var engine;
    if (!z.synthetic) {
      engine = '<div class="callout plain"><b>No company figures shown for ' + esc(c.name) + '.</b> ' + esc(z.note) + '</div>' +
        '<div class="grid" style="margin-top:16px"><section class="panel c6"><div class="panel-h"><h3>Company profile</h3>' + X.entityTag(c) + '</div><div class="panel-b">' + dl([['Company', esc(c.name)], ['Industry', esc(c.industry)], ['Country', 'India'], ['Reporting year', nr]]) + '</div></section>' +
        '<section class="panel c6"><div class="panel-h"><h3>Net zero target profile</h3>' + statusChip(z) + '</div><div class="panel-b">' + dl([['Commitment', '<b>' + esc(z.target) + '</b>'], ['Validation status', 'Not connected'], ['Emissions and progress', 'Not connected']]) +
        '<p class="note" style="margin-top:16px">Shown as publicly stated by the company and not verified in this demonstration.</p></div></section></div>';
    } else {
      engine =
        '<div class="grid">' +
          '<section class="panel c3"><div class="panel-h"><h3>Company profile</h3></div><div class="panel-b">' + dl([['Company', esc(c.name)], ['Industry', esc(c.industry)], ['Country', 'India'], ['Reporting year', String(z.reportingYear)]]) + '</div></section>' +
          '<section class="panel c5"><div class="panel-h"><h3>Net zero target profile</h3>' + statusChip(z) + '</div><div class="panel-b">' + dl([
            ['Commitment status', esc(z.statusInfo.label)], ['Target year', p.nzYear || nr], ['Baseline year', p.base || nr],
            ['Near-term target', p.near ? '−' + p.near.pct + '% by ' + p.near.year + ' (' + p.near.scope + ')' : nr], ['Long-term target', p.long ? esc(p.long) : nr],
            ['Scope coverage', 'S1 ' + pct(p.cover.s1) + ' · S2 ' + pct(p.cover.s2) + ' · S3 ' + pct(p.cover.s3)], ['Target documentation', p.docs ? esc(p.docs) : nr]]) + '</div></section>' +
          '<section class="panel c4"><div class="panel-h"><h3>Progress tracking</h3><span class="chip dot ' + z.progress.tone + '">' + esc(z.progress.label) + '</span></div><div class="panel-b">' + dl([
            ['Baseline emissions', kt(z.baseline)], ['Current emissions', kt(z.current)], ['Actual reduction', z.actualCut == null ? nr : z.actualCut.toFixed(1) + '%'],
            ['Required by now', z.requiredCut == null ? nr : z.requiredCut.toFixed(1) + '%'], ['Remaining to target', z.remaining == null ? nr : z.remaining.toFixed(1) + ' pts'], ['Data confidence', X.confChip(z.confidence)]]) +
            '<p class="note" style="margin-top:8px">' + esc(z.progress.why) + '</p></div></section>' +
        '</div>' +
        '<div class="grid">' +
          (p.base && p.nzYear && z.hasData
            ? C.card({ cls: 'c8', title: 'Net zero pathway: declared target against reported progress', sub: 'Scope 1 and 2 emissions, thousand tonnes CO₂e. The dashed line is what the company declared; the solid line is what it has reported.', evidence: 'Synthetic demonstration data', evidenceKey: 'synthetic',
                method: z.trajectoryBasis + ' Progress compares the reported reduction with the reduction the trajectory requires by the latest reported year.',
                body: C.pathway(z), legend: [['line', 'Reported emissions'], ['dash', 'Declared target trajectory'], ['gap', 'Gap at latest year']], source: synth('Climactix calculation on an invented company') })
            : '<section class="panel c8"><div class="panel-h"><h3>Net zero pathway</h3></div><div class="empty">' + esc(z.progress.why) + ' No pathway is drawn, and none is assumed.</div></section>') +
          C.card({ cls: 'c4', title: 'Emissions by scope', sub: 'Thousand tonnes CO₂e by reporting year.', evidence: 'Synthetic demonstration data', evidenceKey: 'synthetic', method: 'Scopes are stacked where reported. A scope that was not reported is marked as missing and is never drawn as zero.',
            body: C.scopes(z) + dl([['Scope 1', kt(p.s1[last])], ['Scope 2', kt(p.s2[last])], ['Scope 3', kt(p.s3[last])], ['Intensity', z.intensity[last] == null ? nr : z.intensity[last] + ' t per ₹ crore'], ['Year on year', z.yoy == null ? nr : (z.yoy > 0 ? '+' : '') + z.yoy.toFixed(1) + '%']]),
            legend: [['s1', 'Scope 1'], ['s2', 'Scope 2'], ['s3', 'Scope 3']], source: synth() }) +
        '</div>';
    }

    return research +
      '<div class="cx-div"><div><div class="ph-eyebrow">Climactix Net Zero Intelligence Engine</div><h2>From a declared target to reported progress</h2><p>The same structure for every company: profile, target, emissions and progress. Until live company data is connected, figures are shown only for synthetic entities.</p></div>' +
        '<div class="toolbar"><label>Company<select class="select" id="nz-co">' + X.companyOptions(ui.co) + '</select></label></div></div>' +
      engine +
      '<section class="panel" style="margin-top:16px"><div class="panel-h"><h3>How target status is classified</h3><span class="chip ev-climactix">Climactix-generated analysis</span></div><div class="panel-b"><div class="cx-ladder">' +
        Object.keys(R.status).map(function (k) { var s = R.status[k]; return '<div><span class="chip dot ' + s.tone + '">' + esc(s.label) + '</span><p>' + esc(s.tip) + '</p></div>'; }).join('') + '</div></div></section>' +
      note(['c_valid', 'c_assure', 'c_offtrack'], 'What the research says about target quality');
  };

  /* ── 3 · Financial and investment impact ───────────────────────── */
  SECTIONS.finance = function () {
    var f = R.dist('fin_overall');
    return '<div class="cx-bigs">' + bigStat('f_conf', 'Investor confidence') + bigStat('f_percep', 'Investor perception') + bigStat('f_longnp', 'Long-term performance') + bigStat('f_cost', 'Operating costs') + '</div>' +
      '<div class="grid">' +
        C.card({ cls: 'c5', title: 'Overall financial impact', sub: 'Mostly neutral, with a third reporting a benefit.', evidence: 'Survey finding', evidenceKey: 'survey', method: SURVEY_METHOD + ' ' + f.rounding,
          body: C.donut([{ v: f.vp, label: 'Very positive', tone: 'pos' }, { v: f.sp, label: 'Somewhat positive', tone: 'sp' }, { v: f.neu, label: 'Neutral', tone: 'neu' }, { v: f.neg, label: 'Negative', tone: 'neg' }], { center: f.neu + '%', centerSub: 'neutral', label: 'Financial impact' }), source: src(13, 'n = 171') }) +
        C.card({ cls: 'c7', title: 'Access to capital', sub: 'Share reporting a positive impact, by area.', evidence: 'Survey finding', evidenceKey: 'survey', method: SURVEY_METHOD,
          body: C.hbars(R.group('capital').map(function (r) { return { label: r.label, v: r.positive, tone: r.positive >= 50 ? 'pos' : 'acc', tip: r.label + ': ' + r.positive + '% positive, ' + r.neu + '% neutral, ' + r.neg + '% negative (n = ' + r.n + ')' }; })) +
                '<div class="callout" style="margin-top:16px"><b>16 basis points.</b> In a European Central Bank empirical analysis, banks that had committed to set SBTi targets offered firms with declared emissions targets interest rates discounted by 16 basis points more than banks with no such commitment, and charged high emitters a premium 2 basis points greater. This describes European bank lending in the period studied. It is not a rate any borrower should expect.</div>',
          source: src('13, 20', 'Altavilla et al. (2024)') }) +
      '</div>' +
      C.card({ title: 'Financial outcomes, costs and efficiency', sub: 'Operating costs are the one area with a notable negative share. Efficiency and long-term performance lean positive.', evidence: 'Survey finding', evidenceKey: 'survey', method: SURVEY_METHOD + ' The negative share combines somewhat and very negative.',
        body: C.likert(R.group('finance')), legend: C.likertLegend('impact'), source: src(13, 'response counts 144 to 171') }) +
      '<div class="grid" style="margin-top:16px">' +
        C.card({ cls: 'c6', title: 'Investment now, estimated savings later', sub: 'One study’s estimates for companies that set targets. Ranges, not guarantees.', evidence: 'Academic research', evidenceKey: 'academic', method: 'Freiberg, Grewal and Serafeim (2021), on data up to 2019, compared adopters with non-adopters. The savings are the study’s estimates of expected future annual savings; the report notes they depend on the company and region.',
          body: C.range([{ label: 'Additional annual climate spend', sub: 'compared with firms without targets', lo: 60, hi: 64, tone: 'warn' }, { label: 'Estimated future annual cost savings', sub: 'from those investments', lo: 22, hi: 33, tone: 'pos' }, { label: 'Estimated future annual CO₂ savings', sub: 'from those investments', lo: 17, hi: 19, tone: 'pos' }], { max: 70 }),
          legend: [['warn', 'Cost'], ['pos', 'Estimated saving']], source: src(19, 'Freiberg et al. (2021)') }) +
        '<div class="c6">' + note(['f_margin', 'f_roa', 'r_longup', 'r_longdown'], 'What the academic studies found') + '</div>' +
      '</div>' +
      '<div class="callout plain" style="margin-top:16px"><b>How to read this page.</b> The survey reports perceptions and the studies report associations in specific samples. Neither establishes that a target will lower a given company’s cost of capital or raise its returns.</div>';
  };

  /* ── 4 · Climate performance and decarbonisation ───────────────── */
  SECTIONS.climate = function () {
    var z = R.netZero('corvane');
    return '<div class="cx-bigs">' + bigStat('c_abs', 'Absolute emissions') + bigStat('c_int', 'Emissions intensity') + bigStat('c_co2', 'Estimated CO₂ savings') + bigStat('c_pace', 'Pace of climate action') + '</div>' +
      '<div class="grid">' +
        C.card({ cls: 'c7', title: 'Scope 1 emissions: with and without targets', sub: 'Median annual change in Scope 1 emissions, by target status.', evidence: 'Industry research', evidenceKey: 'industry',
          method: 'Analysis of over 8,500 listed companies from 2018 to 2023, as described on p. 17 of the report, which attributes the related finding to MSCI (Lee et al., 2025). Medians for groups of companies; an individual company may differ.',
          body: C.diverge([{ label: 'SBTi net zero target', v: -0.5, tip: 'Median annual Scope 1 change: −0.5%' }, { label: 'Self-declared net zero target', v: 0.2, tip: 'Median annual Scope 1 change: +0.2%' }, { label: 'No target', v: 4.3, tip: 'Median annual Scope 1 change: +4.3%' }], { min: -1, max: 5, unit: '% a year' }),
          source: src(17, 'Lee et al. (2025)') }) +
        C.card({ cls: 'c5', title: 'Additional reduction four years after validation', sub: 'Compared with companies without targets, in one study.', evidence: 'Academic research', evidenceKey: 'academic', method: 'Zhang (2022), a master’s thesis using a quasi-experimental comparison of adopters and non-adopters over the four years after validation. Intensity is measured relative to total sales.',
          body: C.hbars([{ label: 'Absolute Scope 1 and 2 emissions', v: 5.3, tone: 'pos', tip: '5.3% more reduction than companies without targets' }, { label: 'Emissions intensity', v: 8.7, tone: 'pos', tip: '8.7% more reduction than companies without targets' }], { max: 10 }),
          source: src(17, 'Zhang (2022)') }) +
      '</div>' +
      '<div class="grid">' +
        C.card({ cls: 'c7', title: 'Climate ambition and pace of action', sub: 'What companies say targets changed.', evidence: 'Survey finding', evidenceKey: 'survey', method: SURVEY_METHOD, body: C.likert(R.group('climate')), legend: C.likertLegend('impact'), source: src(14, 'n = 171') }) +
        '<div class="c5">' + note(['c_scope3', 'c_offtrack', 'c_conc', 'c_assure'], 'Limits the research identifies') + '</div>' +
      '</div>' +
      '<div class="cx-div"><div><div class="ph-eyebrow">Company level</div><h2>Scopes, intensity and target progress for one company</h2><p>The research describes groups. The terminal applies the same questions to an individual company, shown here for a synthetic entity.</p></div><button class="btn primary" data-go="impact/netzero?c=corvane">Open the Net Zero Intelligence Engine</button></div>' +
      '<div class="grid">' +
        C.card({ cls: 'c7', title: esc(z.company.name) + ': declared target against reported progress', sub: 'Scope 1 and 2, thousand tonnes CO₂e.', evidence: 'Synthetic demonstration data', evidenceKey: 'synthetic', method: z.trajectoryBasis,
          body: C.pathway(z), legend: [['line', 'Reported emissions'], ['dash', 'Declared target trajectory'], ['gap', 'Gap at latest year']], source: synth('Climactix calculation on an invented company') }) +
        C.card({ cls: 'c5', title: 'Carbon intensity trend', sub: 'Tonnes CO₂e (Scope 1 and 2) per ₹ crore of revenue.', evidence: 'Synthetic demonstration data', evidenceKey: 'synthetic', method: 'Scope 1 and 2 emissions divided by revenue for each reporting year.',
          body: X.lineChart({ labels: z.years.map(String), series: [{ name: 'Intensity', values: z.intensity }], h: 220, label: 'Carbon intensity' }) + '<div style="margin-top:16px">' + C.scopes(z) + '</div>',
          legend: [['s1', 'Scope 1'], ['s2', 'Scope 2'], ['s3', 'Scope 3']], source: synth() }) +
      '</div>';
  };

  /* ── 5 · Corporate resilience and regulatory preparedness ──────── */
  SECTIONS.resilience = function () {
    var USE = [
      ['bank', 'Banks', ['Borrower sustainability profiles', 'Net zero commitment status', 'Climate disclosure gaps', 'Sector comparison and transition preparedness'], 'banker'],
      ['insurance', 'Insurance companies', ['Environmental exposure indicators', 'Climate disclosure analysis', 'Disclosure credibility', 'Historical environmental performance'], 'engineers'],
      ['investor', 'Investment firms', ['Company sustainability comparisons', 'Portfolio net zero alignment', 'Climate commitments', 'Performance trends'], 'analyst'],
      ['government', 'Government institutions', ['Corporate reporting adoption', 'Industry-level indicators', 'Regional intelligence', 'Aggregated reporting coverage'], 'skyline']];
    return '<div class="cx-bigs">' + bigStat('r_reg', 'Regulatory change') + bigStat('r_carbon', 'Carbon-constrained economy') + bigStat('r_trans', 'Transition risk') + bigStat('b_supply', 'Supply-chain alignment') + '</div>' +
      C.card({ title: 'Resilience and preparedness, question by question', sub: 'Regulatory and transition preparedness lead. Physical-risk resilience and new opportunities are reported less often.', evidence: 'Survey finding', evidenceKey: 'survey',
        method: SURVEY_METHOD + ' ' + R.dist('str_reg').rounding, body: C.likert(R.group('resilience')), legend: C.likertLegend('impact'), source: src(12, 'response counts 156 to 160') }) +
      '<div class="grid" style="margin-top:16px"><div class="c6">' + note(['r_crash', 'r_vol', 'r_lending'], 'Evidence pointing to resilience') + '</div><div class="c6">' + note(['r_short', 'r_longup', 'r_longdown'], 'Where the evidence is limited or mixed') + '</div></div>' +
      '<section class="panel"><div class="panel-h"><h3>Case studies in the report</h3><span class="chip ev-case">Case study</span><div class="sub">Individual companies’ accounts, as published in the report. Not representative of companies in general.</div></div><div class="panel-b"><div class="cx-cases">' +
        R.cases.map(function (k) { return '<div><small>' + esc(k.kind) + ' · p. ' + k.page + '</small><h4>' + esc(k.name) + '</h4><p>' + esc(k.title) + '</p><ul>' + k.facts.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>'; }).join('') + '</div></div></section>' +
      '<div class="cx-div"><div><div class="ph-eyebrow">For institutions</div><h2>How each institution uses this intelligence</h2><p>Practical inputs to a professional’s own judgement. The terminal does not make credit, underwriting or investment decisions.</p></div></div>' +
      '<div class="cx-use">' + USE.map(function (u) {
        return '<button class="panel" data-go="' + u[0] + '"><img src="terminal-film-assets/' + u[3] + '.jpg" alt="" loading="lazy"><div><h4>' + u[1] + '</h4><ul>' + u[2].map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul><span class="linkbtn">Open this view →</span></div></button>';
      }).join('') + '</div>';
  };

  /* ── 6 · Industry benchmarking ─────────────────────────────────── */
  SECTIONS.benchmark = function (ctx) {
    var ui = ctx.ui; ui.co = ui.co || 'corvane';
    var cs = D.companies(), s = D.score(ui.co), c = D.company(ui.co);
    var mean = D.dimensions.map(function (_, i) { var t = 0, n = 0; cs.forEach(function (x) { var v = D.score(x.id).dims[i].score; if (v != null) { t += v; n++; } }); return Math.round(t / n); });
    var cell = function (v, tip) { return v == null ? '<td class="h st-mis" data-tip="Not reported. Missing, not poor.">n/r</td>' : '<td class="h ' + (v >= 100 ? 'st-strong' : 'st-mod') + '" data-tip="' + tip + '">' + v + '%</td>'; };
    return '<div class="callout plain" style="margin-bottom:16px"><b>What the report does and does not contain.</b> It publishes no industry-level results. The only breakdown is the regional mix of respondents. The company comparisons below are therefore Climactix demonstration data, not research findings.</div>' +
      '<div class="grid">' +
        C.card({ cls: 'c5', title: 'Who answered the survey', sub: 'Regional mix of the 171 valid responses.', evidence: 'Survey finding', evidenceKey: 'survey', method: R.survey.method + ' 95% of responses came from corporates and 92% from high-income countries.',
          body: C.hbars(R.survey.regions.map(function (r) { return { label: r[0], v: r[1], tone: 'acc' }; })) + '<p class="note" style="margin-top:16px">' + esc(R.survey.limits[1]) + '</p>', source: src(27) }) +
        C.card({ cls: 'c7', title: 'Company against the demonstration universe', sub: 'Five scoring dimensions for one company, against the mean of the ten demonstration profiles.', evidence: 'Synthetic demonstration data', evidenceKey: 'synthetic', method: 'Dimension scores from the Climactix demonstration scoring engine. A dimension with no evidenced indicator is left unscored, and the company’s shape is then not drawn.',
          body: '<div class="toolbar" style="margin-bottom:8px"><label>Company<select class="select" id="bm-co">' + X.companyOptions(ui.co) + '</select></label></div><div class="cx-radarw">' +
                C.radar(D.dimensions.map(function (d) { return d.name.replace(' performance', '').replace('Disclosure credibility', 'Credibility').replace('Climate strategy', 'Climate'); }),
                  [{ name: 'Demonstration mean', values: mean }, { name: c.name, values: s.dims.map(function (d) { return d.score; }) }], { label: 'Dimension profile' }) +
                '<div class="barlist">' + s.dims.map(function (d, i) { return '<div class="barrow" style="grid-template-columns:minmax(96px,160px) 1fr"><span class="lbl">' + d.name + '</span>' + X.meter(d.score) + '<span class="note" style="grid-column:1/-1;margin-top:-4px">Mean ' + mean[i] + '</span></div>'; }).join('') + '</div></div>',
          legend: [['r1', c.name], ['r0', 'Mean of ten demonstration profiles']], source: synth('Climactix-generated scores') }) +
      '</div>' +
      C.card({ title: 'Net zero target status across the demonstration universe', sub: 'Status, scope coverage and progress. Emissions data is held only for synthetic entities.', evidence: 'Synthetic demonstration data', evidenceKey: 'synthetic', method: 'Target status follows the Climactix classification. Scope coverage is the share of each scope covered by the target. A blank is missing information and is never scored as poor performance.',
        body: '<div class="tblw"><table class="tbl heat"><thead><tr><th>Company</th><th>Industry</th><th>Target status</th><th style="text-align:center">Scope 1</th><th style="text-align:center">Scope 2</th><th style="text-align:center">Scope 3</th><th>Progress</th><th class="r">Score</th></tr></thead><tbody>' +
          cs.map(function (x) {
            var z = R.netZero(x.id), p = z.profile;
            return '<tr class="click" data-go="impact/netzero?c=' + x.id + '"><td>' + X.coCell(x, x.synthetic ? 'Synthetic entity' : 'Demo profile') + '</td><td>' + esc(x.industry) + '</td><td>' + statusChip(z) + '</td>' +
              (p ? cell(p.cover.s1, 'Scope 1 covered by the target') + cell(p.cover.s2, 'Scope 2 covered by the target') + cell(p.cover.s3, 'Scope 3 covered by the target') + '<td><span class="chip dot ' + z.progress.tone + '">' + esc(z.progress.label) + '</span></td>'
                 : '<td class="h st-mis" colspan="3" data-tip="Company data is not connected for recognisable company names in this demonstration.">not connected</td><td><span class="muted">Not connected</span></td>') +
              '<td class="n">' + D.score(x.id).overall + '</td></tr>';
          }).join('') + '</tbody></table></div>', source: synth('select a row to open the company in the Net Zero Intelligence Engine') });
  };

  /* ── 7 · Research and evidence repository ──────────────────────── */
  SECTIONS.evidence = function (ctx) {
    var ui = ctx.ui; ui.cls = ui.cls || ''; ui.sec = ui.sec || ''; ui.q = ui.q || '';
    if (ctx.query.f) ui.open = ctx.query.f;
    var S = R.source, all = R.findings();
    var counts = {}; all.forEach(function (f) { counts[f.cls] = (counts[f.cls] || 0) + 1; });
    setTimeout(function () {                                   // wire the live filter once the HTML is in place
      var list = ctx.root.querySelector('#ev-list'); if (!list) return;
      function draw() {
        var rows = R.findings({ cls: ui.cls, section: ui.sec, q: ui.q });
        list.innerHTML = rows.length ? rows.map(function (f) {
          var open = ui.open === f.id, st = R.studies[f.study];
          return '<div class="cx-fr' + (open ? ' open' : '') + '" id="ev-' + f.id + '"><button class="cx-fh" data-f="' + f.id + '" aria-expanded="' + open + '"><span class="car" aria-hidden="true">▸</span><b class="num">' + (f.value == null ? '—' : f.value + (f.unit === '%' ? '%' : '')) + '</b><span>' + (f.value != null && f.unit !== '%' && f.unit ? esc(f.unit) + ' ' : '') + esc(f.text) + '</span>' + evChip(f) + '<small>p. ' + f.page + '</small></button>' +
            (open ? '<div class="cx-fb"><dl class="meta"><dt>Finding</dt><dd>' + (f.value != null ? f.value + (f.unit === '%' ? '%' : ' ' + esc(f.unit)) + ' ' : '') + esc(f.text) + '</dd><dt>Research organisation or study</dt><dd>' + esc(f.studyCite) + (st.title ? ', “' + esc(st.title) + '”' : '') + '</dd><dt>Publication year</dt><dd>' + f.year + '</dd><dt>Sample</dt><dd>' + esc(f.sample) + '</dd><dt>Methodology</dt><dd>' + esc(f.method) + '</dd><dt>Page in source</dt><dd>p. ' + f.page + '</dd><dt>Source document</dt><dd>' + esc(S.cite) + '</dd><dt>Evidence class</dt><dd>' + evChip(f) + '</dd><dt>Data layer</dt><dd>' + esc(R.layers[f.layer]) + '</dd>' +
              (f.rounding ? '<dt>Rounding note</dt><dd>' + esc(f.rounding) + '</dd>' : '') + '</dl></div>' : '') + '</div>';
        }).join('') : '<div class="empty">No finding matches these filters.</div>';
        ctx.root.querySelector('#ev-n').textContent = rows.length + ' of ' + all.length + ' findings';
      }
      ctx.root.querySelector('#ev-q').addEventListener('input', function () { ui.q = this.value; draw(); });
      on(ctx.root, 'click', '[data-f]', function (t) { var id = t.getAttribute('data-f'); ui.open = ui.open === id ? null : id; draw(); });
      draw();
      if (ctx.query.f) { var el = ctx.root.querySelector('#ev-' + ctx.query.f); if (el) el.scrollIntoView({ block: 'center' }); }
    }, 0);
    var sec = TABS.slice(0, 6);
    return '<div class="grid"><section class="panel c7"><div class="panel-h"><h3>Source document</h3><span class="chip ev-academic">External research</span></div><div class="panel-b"><dl class="meta"><dt>Title</dt><dd><b>' + esc(S.title) + '</b></dd><dt>Publisher</dt><dd>' + esc(S.org) + '</dd><dt>Year</dt><dd>' + S.year + '</dd><dt>Length</dt><dd>' + S.pages + ' pages: company survey, literature review of 22 studies, three case studies</dd><dt>Publisher’s site</dt><dd><a href="' + S.home + '" target="_blank" rel="noopener">sciencebasedtargets.org</a></dd></dl>' +
        '<div class="callout plain" style="margin-top:16px"><b>How this research is used here.</b> Figures are cited from the report with page references and shown in Climactix’s own charts. ' + esc(S.terms) + ' ' + esc(S.stance) + ' None of it is Climactix research.</div></div></section>' +
      '<section class="panel c5"><div class="panel-h"><h3>How to read the survey</h3></div><div class="panel-b"><dl class="meta">' + R.survey.funnel.map(function (x) { return '<dt>' + x[0] + '</dt><dd class="num">' + x[1] + '</dd>'; }).join('') + '<dt>Fieldwork</dt><dd>' + esc(R.survey.period) + '</dd></dl><ul class="cx-lim">' + R.survey.limits.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul></div></section></div>' +

      '<section class="panel" style="margin-bottom:16px"><div class="frow"><span>Evidence class</span><div class="pills" role="group" aria-label="Evidence class"><button class="pill" data-cls="" aria-pressed="' + (ui.cls === '') + '">All<span class="ct">' + all.length + '</span></button>' +
        Object.keys(R.classes).map(function (k) { var n = counts[k] || 0; return '<button class="pill" data-cls="' + k + '" aria-pressed="' + (ui.cls === k) + '"' + (n ? '' : ' disabled data-tip="No finding of this class is held yet. Company disclosures and Climactix analysis are added as live data is connected."') + '>' + esc(R.classes[k]) + '<span class="ct">' + n + '</span></button>'; }).join('') + '</div></div>' +
        '<div class="frow"><span>Section</span><div class="pills" role="group" aria-label="Section"><button class="pill" data-sec="" aria-pressed="' + (ui.sec === '') + '">All sections</button>' + sec.map(function (t) { return '<button class="pill" data-sec="' + t[0] + '" aria-pressed="' + (ui.sec === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div></div>' +
        '<div class="frow"><span>Search</span><div class="toolbar"><input class="input" id="ev-q" type="search" placeholder="Search findings, studies or figures" value="' + esc(ui.q) + '" style="flex:1;min-width:200px" aria-label="Search findings"><span class="note" id="ev-n"></span></div></div>' +
        '<div id="ev-list"></div></section>' +

      '<section class="panel" style="margin-bottom:16px"><div class="panel-h"><h3>Studies cited in the report</h3><div class="sub">As listed in the report’s bibliography (p. 26). Where the report does not state a sample, none is given here.</div></div><div class="panel-b flush tblw"><table class="tbl"><thead><tr><th>Study</th><th>Year</th><th>Type</th><th>Sample, as described in the report</th><th>Approach</th></tr></thead><tbody>' +
        Object.keys(R.studies).filter(function (k) { return k !== 'survey'; }).map(function (k) { var st = R.studies[k]; return '<tr><td><span class="co">' + esc(st.cite) + (st.title ? '<small>' + esc(st.title) + '</small>' : '') + '</span></td><td>' + st.year + '</td><td>' + esc(st.type) + '</td><td class="muted">' + esc(st.sample) + '</td><td class="muted">' + esc(st.method) + '</td></tr>'; }).join('') +
        '</tbody></table></div></section>' +
      '<section class="panel"><div class="panel-h"><h3>Data layers used in this module</h3></div><div class="panel-b"><div class="cx-ladder">' + Object.keys(R.layers).map(function (k) {
        var txt = { research: 'Figures cited from a named external source, with page references.', reported: 'What a company states about itself, including the report’s case studies.', 'public': 'A company’s public statement, such as an announced target. Not verified here.', climactix: 'Climactix’s own reading, classification or calculation.', synthetic: 'Invented entities and figures, used until live data is connected.' }[k];
        return '<div><span class="chip ev-' + (k === 'research' ? 'academic' : k === 'reported' ? 'case' : k === 'public' ? 'disclosure' : k) + '">' + esc(R.layers[k]) + '</span><p>' + txt + '</p></div>'; }).join('') + '</div></div></section>';
  };

  /* ── View ──────────────────────────────────────────────────────── */
  X.view('impact', function (ctx) {
    var tab = SECTIONS[ctx.param] ? ctx.param : 'benefits', ui = ctx.ui;
    ctx.root.innerHTML =
      '<div class="photo-hero"><img src="terminal-film-assets/harvest.jpg" alt=""><div><small>Module 10 · Climactix Sustainability Impact Intelligence</small><b>Transforming Sustainability Commitments into Measurable Business Intelligence.</b></div></div>' +
      '<div class="callout plain" style="margin-bottom:16px"><b>Research-backed, and clearly attributed.</b> Survey and study figures on these pages are cited from ' + esc(R.source.cite) + '. ' + esc(R.source.stance) + ' Company-level examples are synthetic until live data is connected.</div>' +
      '<div class="tabs" role="tablist">' + TABS.map(function (t, i) { return '<button role="tab" data-go="impact/' + t[0] + '" aria-selected="' + (t[0] === tab) + '"><span class="ct" style="margin:0 4px 0 0">0' + (i + 1) + '</span>' + t[1] + '</button>'; }).join('') + '</div>' +
      SECTIONS[tab](ctx);

    on(ctx.root, 'click', '[data-dom]', function (t) { ui.dom = t.getAttribute('data-dom'); ctx.rerender(); });
    on(ctx.root, 'change', '#nz-co', function (t) { ui.co = t.value; X.replaceQuery({}); ctx.query.c = null; ctx.rerender(); });
    on(ctx.root, 'change', '#bm-co', function (t) { ui.co = t.value; ctx.rerender(); });
    on(ctx.root, 'click', '[data-cls]', function (t) { if (!t.disabled) { ui.cls = t.getAttribute('data-cls'); ctx.rerender(); } });
    on(ctx.root, 'click', '[data-sec]', function (t) { ui.sec = t.getAttribute('data-sec'); ctx.rerender(); });
  });
})();
