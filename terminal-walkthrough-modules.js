/* ════════════════════════════════════════════════════════════════════
   CLIMACTIX TERMINAL — LIVE WALKTHROUGH · MODULES 01–05
   01 Terminal Dashboard · 02 Company Intelligence · 03 Intelligence Score
   04 Report Repository · 05 Company Assessment Portal
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var X = window.CXT, D = X.D, esc = X.esc, fmt = X.fmt;
  var on = function (root, type, sel, fn) {
    root.addEventListener(type, function (e) { var t = e.target.closest(sel); if (t && root.contains(t)) fn(t, e); });
  };
  var HEAT = ['#F3F6FB', '#DCE6F5', '#B9C8E2', '#7F9CCB', '#0B3D91'];
  function heatCell(pct) {
    var k = pct >= 40 ? 4 : pct >= 28 ? 3 : pct >= 16 ? 2 : pct >= 6 ? 1 : 0;
    return '<td class="h" style="background:' + HEAT[k] + ';color:' + (k >= 3 ? '#fff' : '#111') + '">' + pct + '%</td>';
  }

  /* ── 01 · TERMINAL DASHBOARD ───────────────────────────────────── */
  X.view('dashboard', function (ctx) {
    var p = D.platform();
    var recent = D.companies().sort(function (a, b) { return b.assessedDay - a.assessedDay; });
    var latest = [];
    ['NZ', 'CL', 'ESG', 'SR'].forEach(function (k) { latest = latest.concat(D.reports({ category: k }).slice(0, 2)); });
    latest.sort(function (a, b) { return b.sortKey - a.sortKey; });
    var maxRep = Math.max.apply(null, D.categories.map(function (c) { return p.reportTotals[c.key]; }));

    ctx.root.innerHTML =
      X.pageHead('Module 01 · Terminal dashboard', 'Corporate sustainability intelligence overview',
        'Sustainability, ESG, BRSR, net zero, climate and annual disclosures consolidated into one terminal, with an independent score for each company.',
        '<button class="btn primary" data-go="company">Search companies</button><button class="btn" data-go="score">See how the score works</button>') +

      '<div class="grid">' +
        kpi('Companies indexed', fmt(p.companies), 'Across ' + p.industries.length + ' industries') +
        kpi('Reports available', fmt(p.reports), 'Six disclosure categories') +
        kpi('Companies assessed', fmt(p.assessed), Math.round(p.assessed / p.companies * 100) + '% of indexed companies') +
        kpi('Average Climactix Score', p.avgScore + '<small> / 100</small>', 'Company-weighted, ' + D.meta.currentFy) +
      '</div>' +

      '<div class="grid">' +
        '<section class="panel c8"><div class="panel-h"><h2>Industry-wise score distribution</h2>' + X.demoTag('Illustrative') +
          '<div class="sub">Share of companies in each score band. Darker cells hold more companies.</div></div>' +
          '<div class="panel-b flush tblw"><table class="tbl heat"><thead><tr><th>Industry</th><th class="r">Companies</th><th class="r">Avg score</th>' +
          p.bandLabels.map(function (b) { return '<th class="r">' + b + '</th>'; }).join('') + '</tr></thead><tbody>' +
          p.industries.map(function (i) {
            return '<tr><td>' + esc(i.name) + '</td><td class="n">' + i.companies + '</td><td class="n">' + i.avg + '</td>' + i.bands.map(heatCell).join('') + '</tr>';
          }).join('') + '</tbody></table></div></section>' +

        '<div class="c4 stack">' +
          '<section class="panel"><div class="panel-h"><h2>Find a company</h2></div><div class="panel-b">' +
            '<input class="input" id="d-q" type="search" placeholder="Type a company or industry" style="width:100%" aria-label="Find a company" />' +
            '<div id="d-res" style="margin-top:8px"></div></div></section>' +
          '<section class="panel"><div class="panel-h"><h2>Reports by category</h2>' + X.demoTag() + '</div><div class="panel-b"><div class="barlist">' +
            D.categories.map(function (c) {
              var v = p.reportTotals[c.key];
              return '<div class="barrow"><button class="linkbtn lbl" data-go="reports?category=' + c.key + '">' + esc(c.name) + '</button><div class="meter-t"><div class="meter-f" style="width:' + (v / maxRep * 100) + '%"></div></div><span class="num" style="text-align:right">' + fmt(v) + '</span></div>';
            }).join('') + '</div></div></section>' +
        '</div>' +
      '</div>' +

      '<div class="grid">' +
        '<section class="panel c7"><div class="panel-h"><h2>Recent company assessments</h2>' + X.demoTag('Simulated') + '</div>' +
          '<div class="panel-b flush tblw"><table class="tbl"><thead><tr><th>Company</th><th class="r">Score</th><th>Grade</th><th>Data confidence</th><th>Assessed</th></tr></thead><tbody>' +
          recent.map(function (c) {
            var s = D.score(c.id);
            return '<tr class="click" data-go="company/' + c.id + '"><td>' + X.coCell(c) + '</td><td class="n">' + s.overall + '</td><td>' + X.grade(s.band) + '</td><td>' + X.confChip(s.confidence) + '</td><td class="muted">' + c.assessedOn + '</td></tr>';
          }).join('') + '</tbody></table></div></section>' +

        '<section class="panel c5"><div class="panel-h"><h2>Latest uploaded disclosures</h2>' + X.demoTag('Simulated') + '</div>' +
          '<div class="panel-b flush tblw"><table class="tbl"><thead><tr><th>Document</th><th>Published</th></tr></thead><tbody>' +
          latest.map(function (r) {
            return '<tr class="click" data-go="reports?company=' + r.companyId + '&doc=' + r.id + '"><td><span class="co">' + esc(r.title) + '<small>' + esc(r.company) + '</small></span></td><td class="muted">' + r.published + '</td></tr>';
          }).join('') + '</tbody></table></div></section>' +
      '</div>' +

      '<div class="callout plain"><b>What is live in this walkthrough.</b> Every module, filter, comparison and score breakdown works, on a fixed demonstration dataset of ten company profiles. Connection to live disclosure ingestion and the production scoring engine is in development, so platform totals on this page are illustrative.</div>';

    function kpi(label, value, sub) {
      return '<div class="panel kpi c3"><div class="kpi-l">' + label + X.demoTag() + '</div><div class="kpi-v num">' + value + '</div><div class="kpi-s">' + sub + '</div></div>';
    }
    var res = ctx.root.querySelector('#d-res');
    function draw(q) {
      var list = D.search(q).slice(0, 5);
      res.innerHTML = list.length ? '<table class="tbl"><tbody>' + list.map(function (c) {
        return '<tr class="click" data-go="company/' + c.id + '"><td style="padding-left:0">' + X.coCell(c) + '</td><td class="n" style="padding-right:0">' + D.score(c.id).overall + '</td></tr>';
      }).join('') + '</tbody></table>' : '<p class="note">No match in the demonstration dataset.</p>';
    }
    ctx.root.querySelector('#d-q').addEventListener('input', function () { draw(this.value); });
    draw('');
  });

  /* ── 02 · COMPANY INTELLIGENCE ─────────────────────────────────── */
  X.view('company', function (ctx) {
    if (ctx.param && D.company(ctx.param)) return profile(ctx, D.company(ctx.param));
    var ui = ctx.ui;
    ui.q = ui.q || ''; ui.ind = ui.ind || '';
    var industries = D.companies().map(function (c) { return c.industry; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();

    ctx.root.innerHTML =
      X.pageHead('Module 02 · Company intelligence search', 'Find a company',
        'Search the demonstration dataset by company, industry or location, then open a consolidated intelligence profile.') +
      '<section class="panel"><div class="panel-h"><div class="toolbar" style="flex:1">' +
        '<input class="input" id="c-q" type="search" placeholder="Search company, industry or city" value="' + esc(ui.q) + '" style="flex:1;min-width:200px" aria-label="Search companies" />' +
        '<select class="select" id="c-ind" aria-label="Industry"><option value="">All industries</option>' +
        industries.map(function (i) { return '<option' + (i === ui.ind ? ' selected' : '') + '>' + esc(i) + '</option>'; }).join('') + '</select></div></div>' +
        '<div class="panel-b flush tblw" id="c-list"></div></section>' +
      '<p class="note" style="margin-top:16px">Five profiles use the names of recognisable listed companies so the interface reads realistically; five are synthetic entities. In both cases every score and indicator value is illustrative and is not an assessment of the company.</p>';

    var list = ctx.root.querySelector('#c-list');
    function draw() {
      var rows = D.search(ui.q).filter(function (c) { return !ui.ind || c.industry === ui.ind; });
      list.innerHTML = rows.length ? '<table class="tbl"><thead><tr><th>Company</th><th>Record type</th><th>Headquarters</th><th class="r">Score</th><th>Grade</th><th>Data confidence</th><th class="r">Documents</th><th></th></tr></thead><tbody>' +
        rows.map(function (c) {
          var s = D.score(c.id);
          return '<tr class="click" data-go="company/' + c.id + '"><td>' + X.coCell(c) + '</td><td>' + X.entityTag(c) + '</td><td>' + esc(c.city) + ', ' + esc(c.state) + '</td><td class="n">' + s.overall + '</td><td>' + X.grade(s.band) + '</td><td>' + X.confChip(s.confidence) + '</td><td class="n">' + D.reports({ company: c.id }).length + '</td><td class="r"><span class="linkbtn">Open profile</span></td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">No company in the demonstration dataset matches this search.</div>';
    }
    ctx.root.querySelector('#c-q').addEventListener('input', function () { ui.q = this.value; draw(); });
    ctx.root.querySelector('#c-ind').addEventListener('change', function () { ui.ind = this.value; draw(); });
    draw();
  });

  function profile(ctx, c) {
    var s = D.score(c.id), hist = D.history(c.id), env = D.envSeries(c.id);
    var climate = s.dims[3].indicators;
    var indById = {};
    s.dims.forEach(function (d) { d.indicators.forEach(function (it) { indById[it.id] = it; }); });

    ctx.root.innerHTML =
      '<p style="margin-bottom:16px"><button class="linkbtn" data-go="company">← All companies</button></p>' +
      '<div class="ph"><div><div class="ph-eyebrow">Module 02 · Corporate intelligence profile</div>' +
        '<h1>' + esc(c.name) + '</h1>' +
        '<p>' + esc(c.overview) + '</p>' +
        '<div class="toolbar" style="margin-top:16px">' + X.entityTag(c) + '<span class="chip">' + esc(c.industry) + '</span><span class="chip">' + esc(c.city) + ', ' + esc(c.state) + '</span><span class="chip">Assessed ' + c.assessedOn + '</span></div></div>' +
        '<div class="ph-actions"><button class="btn primary" data-go="score/' + c.id + '">Open score breakdown</button><button class="btn" data-go="reports?company=' + c.id + '">View documents</button></div></div>' +

      '<div class="callout plain" style="margin-bottom:16px"><b>Demonstration profile.</b> ' +
        (c.synthetic ? 'This entity was invented for the walkthrough.' : 'The company name, industry and headquarters are public facts. Scores, indicator values and document records are illustrative and are not an assessment of ' + esc(c.name) + '.') + '</div>' +

      '<div class="grid">' +
        '<section class="panel c4"><div class="panel-h"><h2>Climactix Score</h2>' + X.demoTag('Illustrative') + '</div><div class="panel-b">' +
          '<div class="score-big num">' + s.overall + '<small> / 100</small></div>' +
          '<p style="margin:8px 0 16px">' + X.grade(s.band) + ' ' + esc(s.band.label) + ' &nbsp; ' + X.confChip(s.confidence) + '</p>' +
          '<div class="barlist">' + s.dims.map(function (d) {
            return '<div class="barrow"><span class="lbl">' + d.name + '</span>' + X.meter(d.score).replace('class="meter"', 'class="meter" style="grid-column:span 2"') + '</div>';
          }).join('') + '</div>' +
          '<p class="note" style="margin-top:16px">Public Data Score. Company assessment: ' + esc(c.asm.status) + '.</p></div></section>' +

        '<section class="panel c8"><div class="panel-h"><h2>Disclosure availability</h2>' + X.demoTag() +
          '<div class="sub">Sustainability, ESG, BRSR, net zero, climate and annual reports held for each financial year. Select a filled cell to open the document.</div></div>' +
          '<div class="panel-b flush tblw"><table class="tbl avail"><thead><tr><th>Category</th>' + D.years.map(function (y) { return '<th style="text-align:center">' + y + '</th>'; }).join('') + '</tr></thead><tbody>' +
          D.categories.map(function (cat) {
            return '<tr><td>' + esc(cat.name) + '</td>' + D.years.map(function (fy) {
              var r = D.reports({ company: c.id, category: cat.key, fy: fy })[0];
              return '<td class="a">' + (r ? '<button class="dot" data-go="reports?company=' + c.id + '&doc=' + r.id + '" aria-label="Open ' + esc(r.title) + '">✓</button>' : '<span class="dot" title="No document located">–</span>') + '</td>';
            }).join('') + '</tr>';
          }).join('') + '</tbody></table></div></section>' +
      '</div>' +

      '<div class="grid">' +
        '<section class="panel c6"><div class="panel-h"><h2>Net zero commitment</h2>' + (c.synthetic ? X.demoTag('Synthetic') : '<span class="chip">Publicly stated target</span>') + '</div><div class="panel-b">' +
          '<dl class="meta"><dt>Commitment</dt><dd><b>' + esc(c.netZero.target) + '</b></dd><dt>Boundary</dt><dd>' + esc(c.netZero.boundary) + ' ' + X.demoTag('Illustrative') + '</dd><dt>Interim milestones</dt><dd>' + esc(c.netZero.interim) + ' ' + X.demoTag('Illustrative') + '</dd><dt>Evidence status</dt><dd>' + X.stateChip(indById.c1) + '</dd></dl>' +
          (c.synthetic ? '' : '<p class="note" style="margin-top:16px">The commitment is shown as publicly stated by the company and has not been verified in this demonstration. Check the company’s latest disclosure before relying on it.</p>') + '</div></section>' +

        '<section class="panel c6"><div class="panel-h"><h2>Climate disclosures</h2>' + X.demoTag('Illustrative') + '</div><div class="panel-b flush tblw"><table class="tbl"><thead><tr><th>Disclosure element</th><th>Status</th><th class="r">Score</th></tr></thead><tbody>' +
          climate.map(function (it) { return '<tr><td>' + esc(it.label) + '</td><td>' + X.stateChip(it) + '</td><td class="n">' + (it.value == null ? '<span class="muted">—</span>' : it.value) + '</td></tr>'; }).join('') +
          '</tbody></table></div></section>' +
      '</div>' +

      '<div class="grid">' +
        '<section class="panel c7"><div class="panel-h"><h2>Environmental indicators</h2>' + X.demoTag('Illustrative') + '</div><div class="panel-b flush tblw"><table class="tbl"><thead><tr><th>Indicator</th>' +
          D.years.map(function (y) { return '<th class="r">' + y.replace('FY20', 'FY') + '</th>'; }).join('') + '<th>Trend</th></tr></thead><tbody>' +
          env.map(function (e) {
            if (!e.series) return '<tr><td>' + esc(e.label) + '<br><span class="note">' + e.unit + '</span></td><td colspan="5">' + X.stateChip(indById[e.indicator]) + ' <span class="note">No value is shown, and no value is assumed.</span></td><td></td></tr>';
            return '<tr><td>' + esc(e.label) + '<br><span class="note">' + e.unit + '</span></td>' + e.series.map(function (v) { return '<td class="n">' + v + '</td>'; }).join('') + '<td>' + X.spark(e.series) + '</td></tr>';
          }).join('') + '</tbody></table></div></section>' +

        '<section class="panel c5"><div class="panel-h"><h2>Historical assessment records</h2>' + X.demoTag('Simulated') + '</div><div class="panel-b">' +
          X.lineChart({ labels: D.years, series: [{ name: 'Public Data Score', values: hist.map(function (h) { return h.score; }) }], h: 180, label: 'Public Data Score by financial year' }) +
          '<div class="tblw" style="margin-top:8px"><table class="tbl"><thead><tr><th>Year</th><th class="r">Score</th><th>Grade</th><th class="r">Indicators disclosed</th></tr></thead><tbody>' +
          hist.slice().reverse().map(function (h) { return '<tr><td>' + h.fy + '</td><td class="n">' + h.score + '</td><td>' + X.grade(D.band(h.score)) + '</td><td class="n">' + h.disclosed + ' / 20</td></tr>'; }).join('') +
          '</tbody></table></div></div></section>' +
      '</div>';
  }

  /* ── 03 · INTELLIGENCE SCORE ───────────────────────────────────── */
  X.view('score', function (ctx) {
    var c = D.company(X.state.company), ui = ctx.ui;
    ui.view = ui.view || 'public';
    ui.open = ui.open || { E: true };
    var pub = D.score(c.id), asd = D.score(c.id, 'assessed'), s = ui.view === 'assessed' ? asd : pub;
    var hist = D.history(c.id);
    var subs = Object.keys(c.asm.items), validated = subs.filter(function (k) { return c.asm.items[k][1] === 'validated'; }).length;
    var cf = s.confidence, n = s.counts;

    var scoreable = s.dims.filter(function (d) { return d.score != null; });
    var formula = '( ' + scoreable.map(function (d) { return d.score + ' × ' + d.weight; }).join(' + ') + ' ) ÷ ' + s.weightScored + ' = ' + s.overall;

    ctx.root.innerHTML =
      X.pageHead('Module 03 · Climactix Intelligence Score', 'A graded score you can open up',
        'The score runs from 0 to 100 and maps to a rating grade. It is never pass or fail, and every point can be traced to an indicator and its evidence.',
        '<div class="toolbar"><label>Company<select class="select" id="s-co">' + X.companyOptions(c.id) + '</select></label></div>') +

      '<div class="tri">' +
        '<section class="panel"><div class="panel-h"><h3><span class="ix">1</span>Public Data Score</h3>' + X.demoTag('Illustrative') + '</div><div class="panel-b">' +
          '<div class="score-big num">' + pub.overall + '<small> / 100</small></div>' +
          '<p style="margin:8px 0">' + X.grade(pub.band) + ' ' + esc(pub.band.label) + '</p>' +
          '<p class="note">System-generated from publicly available information only. Company submissions never change this number.</p></div></section>' +

        '<section class="panel"><div class="panel-h"><h3><span class="ix">2</span>Company Assessment</h3><span class="chip ' + (c.asm.status === 'Validated' ? 'ok' : subs.length ? 'warn' : '') + '">' + esc(c.asm.status) + '</span></div><div class="panel-b">' +
          (subs.length
            ? '<div class="kpi-v md num ink">' + asd.overall + '<small> / 100 · assessment-informed view</small></div>' +
              '<p style="margin:8px 0">' + subs.length + ' item' + (subs.length > 1 ? 's' : '') + ' submitted · ' + validated + ' validated · ' + (subs.length - validated) + ' under review</p>' +
              '<p class="note">Validated items fill gaps in a separate view shown beside the public score. Items under review are listed but not counted.</p>'
            : '<div class="kpi-v md num ink">—</div><p style="margin:8px 0">No company-submitted information is held for ' + esc(c.name) + '.</p><p class="note">A company can add evidence through the assessment portal. It would appear here, beside the public score.</p>') +
          '<p style="margin-top:8px"><button class="linkbtn" data-go="assessment">Open the assessment portal</button></p></div></section>' +

        '<section class="panel"><div class="panel-h"><h3><span class="ix">3</span>Data Confidence</h3>' + X.confChip(cf) + '</div><div class="panel-b"><div class="barlist">' +
          confRow('Completeness', cf.completeness, n.disclosed + ' of ' + n.total + ' indicators disclosed') +
          confRow('Traceability', cf.traceability, n.evidenced + ' of ' + n.disclosed + ' disclosed indicators traceable to evidence') +
          confRow('Reliability', cf.reliability, 'Share of evidence under external assurance') +
          '</div><div class="formula">0.4 × ' + cf.completeness + ' + 0.3 × ' + cf.traceability + ' + 0.3 × ' + cf.reliability + ' = ' + cf.value + '</div></div></section>' +
      '</div>' +

      '<section class="panel" style="margin-bottom:16px"><div class="panel-h"><h2>Scoring dimensions</h2>' +
        '<div class="seg" role="group" aria-label="Score view"><button data-view="public" aria-pressed="' + (ui.view === 'public') + '">Public data</button><button data-view="assessed" aria-pressed="' + (ui.view === 'assessed') + '">Assessment-informed view</button></div>' +
        '<div class="sub">Open a dimension to see its indicators, their evidence status and the arithmetic.' + (ui.view === 'assessed' ? ' Showing public data plus validated company submissions: overall ' + asd.overall + ', confidence ' + asd.confidence.value + '.' : '') + '</div></div>' +
        '<div class="panel-b flush">' + s.dims.map(dimRow).join('') + '</div></section>' +

      '<div class="grid">' +
        '<section class="panel c7"><div class="panel-h"><h2>How the overall score is generated</h2></div><div class="panel-b">' +
          '<p>Each dimension score is the mean of its evidenced indicators. The overall score is the weighted mean of the dimensions that can be scored.</p>' +
          '<div class="formula">' + formula + '</div>' +
          (s.weightScored < 100 ? '<p class="note" style="margin-top:8px">A dimension with no evidenced indicator is left unscored and its weight is redistributed. It is not counted as zero.</p>' : '') +
          '<div class="three" style="margin-top:16px">' +
            '<div><span class="chip">Not disclosed</span><h4>' + n.missing + ' indicator' + (n.missing === 1 ? '' : 's') + '</h4><p>No public information located. Excluded from the score. Lowers completeness, and so confidence.</p></div>' +
            '<div><span class="chip warn">Insufficient evidence</span><h4>' + n.insufficient + ' indicator' + (n.insufficient === 1 ? '' : 's') + '</h4><p>A claim exists but cannot be traced to evidence. Excluded from the score. Lowers traceability.</p></div>' +
            '<div><span class="chip crit">Adverse performance</span><h4>' + n.adverse + ' indicator' + (n.adverse === 1 ? '' : 's') + '</h4><p>Evidenced and scored below ' + D.adverseBelow + '. This is the only state that lowers the score as poor performance.</p></div>' +
          '</div></div></section>' +

        '<section class="panel c5"><div class="panel-h"><h2>Historical score movement</h2>' + X.demoTag('Simulated') + '</div><div class="panel-b">' +
          X.lineChart({ labels: D.years, series: [{ name: 'Public Data Score', values: hist.map(function (h) { return h.score; }) }], h: 200, label: 'Score history' }) +
          '<p class="note" style="margin-top:8px">' + X.signed(pub.overall - hist[0].score) + ' points since ' + hist[0].fy + '. Indicators disclosed rose from ' + hist[0].disclosed + ' to ' + hist[4].disclosed + ' of 20.</p></div></section>' +
      '</div>' +

      '<section class="panel"><div class="panel-h"><h2>Rating scale</h2></div><div class="panel-b flush tblw"><table class="tbl"><thead><tr>' +
        D.bands.map(function (b) { return '<th style="text-align:center">' + b.grade + '</th>'; }).join('') + '</tr></thead><tbody><tr>' +
        D.bands.map(function (b, i) {
          var hi = i === 0 ? 100 : D.bands[i - 1].min - 1, me = b.grade === s.band.grade;
          return '<td style="text-align:center' + (me ? ';background:var(--accent-tint)' : '') + '"><b>' + b.min + '–' + hi + '</b><br><span class="note">' + b.label + '</span></td>';
        }).join('') + '</tr></tbody></table></div></section>';

    function confRow(label, v, hint) {
      return '<div><div class="barrow" style="grid-template-columns:104px 1fr 32px"><span class="lbl">' + label + '</span><div class="meter-t"><div class="meter-f mut" style="width:' + v + '%"></div></div><span class="num" style="text-align:right">' + v + '</span></div><div class="note">' + hint + '</div></div>';
    }
    function dimRow(d) {
      var open = !!ui.open[d.key];
      var ev = d.indicators.filter(function (it) { return it.state === 'evidenced'; });
      var math = ev.length ? '( ' + ev.map(function (it) { return it.value; }).join(' + ') + ' ) ÷ ' + ev.length + ' = ' + d.score + '   →   contributes ' + d.score + ' × ' + d.weight + '% weight'
                           : 'No evidenced indicator. Dimension left unscored; weight redistributed. Not counted as zero.';
      return '<div class="acc-row"><button class="acc-h" data-dim="' + d.key + '" aria-expanded="' + open + '">' +
        '<span class="car" aria-hidden="true">▸</span><span class="nm">' + d.name + '<small>' + d.what + '</small></span>' +
        '<span class="wt note">Weight ' + d.weight + '%</span>' + X.meter(d.score) + '<span class="cv note">' + d.scored + ' of ' + d.of + ' evidenced</span></button>' +
        (open ? '<div class="acc-b"><div class="tblw"><table class="tbl"><thead><tr><th>Indicator</th><th>Status</th><th class="r">Value</th><th>Source</th><th>Company submission</th></tr></thead><tbody>' +
          d.indicators.map(function (it) {
            var sub = it.submission ? (it.submission.status === 'validated' ? '<span class="chip acc">Validated · ' + it.submission.value + '</span>' : '<span class="chip">Under review · not counted</span>') : '<span class="muted">—</span>';
            return '<tr><td>' + esc(it.label) + '<br><span class="note">Evidence sought: ' + esc(it.evidence) + '</span></td><td>' + X.stateChip(it) + '</td><td class="n">' + (it.value == null ? '<span class="muted">—</span>' : it.value) + '</td><td class="muted">' + esc(it.source) + '</td><td>' + sub + '</td></tr>';
          }).join('') + '</tbody></table></div><div class="formula">' + math + '</div></div>' : '') + '</div>';
    }

    ctx.root.querySelector('#s-co').addEventListener('change', function () { X.go('score/' + this.value); });
    on(ctx.root, 'click', '[data-view]', function (t) { ui.view = t.getAttribute('data-view'); ctx.rerender(); });
    on(ctx.root, 'click', '[data-dim]', function (t) { var k = t.getAttribute('data-dim'); ui.open[k] = !ui.open[k]; ctx.rerender(); });
  });

  /* ── 04 · REPORT REPOSITORY ────────────────────────────────────── */
  X.view('reports', function (ctx) {
    var ui = ctx.ui, q = ctx.query;
    ui.tab = ui.tab || 'repo';
    ui.cmpCo = ui.cmpCo || X.state.company;
    ui.a = ui.a || D.years[2]; ui.b = ui.b || D.years[4];
    var f = { company: q.company || '', category: q.category || '', fy: q.fy || '' };
    var rows = D.reports(f);
    var setFilter = function (k, v) { var n = { company: f.company, category: f.category, fy: f.fy }; n[k] = v; X.go(X.path('reports', null, n)); };

    var repo =
      '<section class="panel"><div class="panel-h"><div class="toolbar">' +
        '<label>Company<select class="select" data-f="company">' + X.companyOptions(f.company, true) + '</select></label>' +
        '<label>Report category<select class="select" data-f="category"><option value="">All categories</option>' + D.categories.map(function (c) { return '<option value="' + c.key + '"' + (c.key === f.category ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></label>' +
        '<label>Financial year<select class="select" data-f="fy"><option value="">All years</option>' + D.years.slice().reverse().map(function (y) { return '<option' + (y === f.fy ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select></label>' +
        '<label>&nbsp;<button class="btn" data-go="reports">Reset</button></label></div>' +
        '<span class="note">' + rows.length + ' of ' + D.reports().length + ' demonstration documents</span></div>' +
        '<div class="panel-b flush tblw">' + (rows.length ? '<table class="tbl"><thead><tr><th>Document</th><th>Category</th><th>Year</th><th>Published</th><th class="r">Pages</th><th>Assurance</th><th></th></tr></thead><tbody>' +
          rows.slice(0, 60).map(function (r) {
            return '<tr class="click" data-doc="' + r.id + '"><td><span class="co">' + esc(r.title) + '<small>' + esc(r.company) + '</small></span></td><td><span class="chip">' + r.category + '</span></td><td>' + r.fy + '</td><td class="muted">' + r.published + '</td><td class="n">' + r.pages + '</td><td class="muted">' + (r.assurance.indexOf('No') === 0 ? 'Not located' : 'Limited') + '</td><td class="r"><span class="linkbtn">Preview</span></td></tr>';
          }).join('') + '</tbody></table>' + (rows.length > 60 ? '<p class="note" style="padding:16px">Showing the 60 most recent. Narrow the filters to see the rest.</p>' : '')
          : '<div class="empty">No document matches these filters. A missing document is recorded as not located, not as a negative finding.</div>') + '</div></section>';

    ctx.root.innerHTML =
      X.pageHead('Module 04 · Sustainability report repository', 'Central disclosure repository',
        'Sustainability, ESG, BRSR, net zero, climate and annual reports in one searchable library, each with metadata and extracted data points.') +
      '<div class="tabs" role="tablist"><button role="tab" data-tab="repo" aria-selected="' + (ui.tab === 'repo') + '">Repository <span class="ct">' + D.reports().length + '</span></button><button role="tab" data-tab="cmp" aria-selected="' + (ui.tab === 'cmp') + '">Compare reporting periods</button></div>' +
      (ui.tab === 'repo' ? repo : compare());

    function compare() {
      var c = D.company(ui.cmpCo), h = D.history(c.id);
      var side = function (fy) {
        var docs = D.reports({ company: c.id, fy: fy }), hh = h[D.years.indexOf(fy)];
        return { fy: fy, score: hh.score, grade: D.band(hh.score).grade, disclosed: hh.disclosed, docs: docs.length,
                 cats: docs.map(function (r) { return r.category; }).join(' · ') || 'None located',
                 pages: docs.reduce(function (a, r) { return a + r.pages; }, 0), points: docs.reduce(function (a, r) { return a + r.dataPoints; }, 0),
                 assured: docs.filter(function (r) { return r.assurance.indexOf('No') !== 0; }).length };
      };
      var A = side(ui.a), B = side(ui.b);
      var row = function (label, k, num) {
        var d = num ? B[k] - A[k] : null;
        return '<tr><td>' + label + '</td><td class="' + (num ? 'n' : '') + '">' + A[k] + '</td><td class="' + (num ? 'n' : '') + '">' + B[k] + '</td><td class="' + (num ? 'n' : 'muted') + '">' + (num ? X.signed(d) : '') + '</td></tr>';
      };
      var yopts = function (sel) { return D.years.map(function (y) { return '<option' + (y === sel ? ' selected' : '') + '>' + y + '</option>'; }).join(''); };
      return '<section class="panel"><div class="panel-h"><div class="toolbar">' +
        '<label>Company<select class="select" data-c="cmpCo">' + X.companyOptions(c.id) + '</select></label>' +
        '<label>Period A<select class="select" data-c="a">' + yopts(ui.a) + '</select></label>' +
        '<label>Period B<select class="select" data-c="b">' + yopts(ui.b) + '</select></label></div>' + X.demoTag('Illustrative') + '</div>' +
        '<div class="panel-b flush tblw"><table class="tbl"><thead><tr><th>' + esc(c.name) + '</th><th class="r">' + A.fy + '</th><th class="r">' + B.fy + '</th><th class="r">Change</th></tr></thead><tbody>' +
        row('Public Data Score', 'score', 1) + row('Rating grade', 'grade') + row('Indicators disclosed (of 20)', 'disclosed', 1) + row('Documents held', 'docs', 1) +
        row('Categories available', 'cats') + row('Total pages', 'pages', 1) + row('Data points extracted', 'points', 1) + row('Documents with assurance statement', 'assured', 1) +
        '</tbody></table></div></section>' +
        '<p class="note" style="margin-top:16px">A rise in documents or indicators disclosed improves data confidence. It changes the score only where the new evidence shows a different level of performance.</p>';
    }

    function preview(id) {
      var r = D.report(id); if (!r) return;
      var c = D.company(r.companyId), cat = D.category(r.category);
      var prior = D.reports({ company: r.companyId, category: r.category }).filter(function (x) { return x.yearIndex === r.yearIndex - 1; })[0];
      X.openDrawer(r.title,
        '<section class="panel" style="margin-bottom:16px"><div class="panel-h"><h3>Document metadata</h3>' + X.demoTag(r.source) + '</div><div class="panel-b"><dl class="meta">' +
        '<dt>Company</dt><dd>' + esc(r.company) + '</dd><dt>Category</dt><dd>' + esc(cat.name) + '</dd><dt>Financial year</dt><dd>' + r.fy + '</dd><dt>Published</dt><dd>' + r.published + '</dd>' +
        '<dt>Framework reference</dt><dd>' + esc(r.frameworks) + '</dd><dt>Assurance</dt><dd>' + esc(r.assurance) + '</dd><dt>Length</dt><dd>' + r.pages + ' pages · ' + r.sizeMb + ' MB</dd>' +
        '<dt>Data points extracted</dt><dd>' + r.dataPoints + '</dd><dt>Previous period</dt><dd>' + (prior ? '<button class="linkbtn" data-doc-open="' + prior.id + '">' + esc(prior.title) + '</button>' : 'Not held') + '</dd></dl></div></section>' +
        '<div class="doc"><div class="doc-flag">Demonstration document · not the company’s actual report</div>' +
        '<h3>' + esc(c.name) + '</h3><p>' + esc(cat.single) + ' · ' + r.fy + '</p>' +
        '<h4>Contents</h4><ol>' + r.sections.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
        '<h4>How the terminal uses this document</h4><p>Each data point is extracted with its page and table reference, mapped to a scoring indicator, and checked against the same metric in the company’s other disclosures for the year. Where the figure cannot be traced or reconciled, the indicator is marked as insufficient evidence instead of being scored.</p>' +
        '<h4>Document preview</h4><p>The original file is not reproduced in this demonstration. In the production terminal this panel displays the source document alongside the extracted values.</p></div>',
        '<button class="btn" data-go="company/' + c.id + '">Company profile</button>');
      X.replaceQuery({ company: f.company, category: f.category, fy: f.fy, doc: id });
      document.querySelector('.drawer').addEventListener('click', function (e) {
        var t = e.target.closest('[data-doc-open]'); if (t) preview(t.getAttribute('data-doc-open'));
      });
    }

    on(ctx.root, 'change', '[data-f]', function (t) { setFilter(t.getAttribute('data-f'), t.value); });
    on(ctx.root, 'click', '[data-tab]', function (t) { ui.tab = t.getAttribute('data-tab'); ctx.rerender(); });
    on(ctx.root, 'click', '[data-doc]', function (t) { preview(t.getAttribute('data-doc')); });
    on(ctx.root, 'change', '[data-c]', function (t) { ui[t.getAttribute('data-c')] = t.value; ctx.rerender(); });
    if (q.doc) { ui.tab = 'repo'; preview(q.doc); }
  });

  /* ── 05 · COMPANY ASSESSMENT PORTAL ────────────────────────────── */
  var STEPS = [
    { t: 'Company registration', fields: [['Legal entity name', 'name'], ['Corporate identification number', 'cin', 'Demonstration value'], ['Authorised representative', 'rep'], ['Work email', 'email']] },
    { t: 'Organisation profile', fields: [['Industry', 'industry'], ['Headquarters', 'hq'], ['Operating sites', 'sites'], ['Reporting boundary', 'boundary', null, ['Standalone', 'Consolidated']]] },
    { t: 'Sustainability questionnaire', fields: [
      ['Is there a board-approved sustainability policy?', 'q1', null, ['Yes', 'In preparation', 'No']],
      ['Are Scope 1 and 2 emissions measured annually?', 'q2', null, ['Yes', 'Partly', 'No']],
      ['Is any sustainability data externally assured?', 'q3', null, ['Yes', 'Planned', 'No']],
      ['Are supplier sustainability assessments carried out?', 'q4', null, ['Yes', 'Partly', 'No']]] },
    { t: 'Environmental performance data', fields: [['Scope 1 and 2 emissions (tCO₂e)', 'ghg'], ['Renewable electricity share (%)', 're'], ['Water withdrawal (kilolitres)', 'water'], ['Waste diverted from disposal (%)', 'waste']] },
    { t: 'Social and governance information', fields: [['Lost-time injury frequency rate', 'ltifr'], ['Women in workforce (%)', 'women'], ['Board committee responsible for sustainability', 'committee'], ['Sustainability metrics in executive pay', 'pay', null, ['Yes', 'No']]] },
    { t: 'Net zero targets', fields: [['Target year', 'nzYear'], ['Base year', 'nzBase'], ['Scopes covered', 'nzScope', null, ['Scopes 1 and 2', 'Scopes 1, 2 and 3']], ['Interim milestone', 'nzInterim']] },
    { t: 'Supporting documents', docs: true },
    { t: 'Review and submit', review: true }
  ];
  var TRACK = ['Submitted', 'Completeness check', 'Evidence validation', 'Analyst review', 'Included in assessment-informed view'];

  X.view('assessment', function (ctx) {
    var ui = ctx.ui;
    if (!ui.co) seed('tessara');
    function seed(id) {
      var c = D.company(id);
      ui.co = id; ui.step = 0; ui.submitted = false; ui.files = ['Energy and emissions workbook FY2025-26.xlsx', 'Water audit summary.pdf'];
      ui.v = { name: c.name, cin: 'DEMO-' + id.toUpperCase().slice(0, 6) + '-0001', rep: 'Head of Sustainability', email: 'sustainability@example.com',
               industry: c.industry, hq: c.city + ', ' + c.state, sites: '6', boundary: 'Consolidated',
               q1: 'Yes', q2: 'Partly', q3: 'Planned', q4: 'Partly', ghg: '', re: '', water: '', waste: '',
               ltifr: '', women: '', committee: 'Risk and Sustainability Committee', pay: 'No', nzYear: '', nzBase: '', nzScope: 'Scopes 1 and 2', nzInterim: '' };
    }
    var c = D.company(ui.co), pub = D.score(c.id), asd = D.score(c.id, 'assessed');
    var step = STEPS[ui.step];
    var subs = Object.keys(c.asm.items);
    var indLabel = {}; D.dimensions.forEach(function (d) { d.indicators.forEach(function (i) { indLabel[i.id] = i.label; }); });

    function fieldHtml(f) {
      var v = ui.v[f[1]] == null ? '' : ui.v[f[1]];
      if (f[3]) return '<div class="fld"><span class="lb">' + f[0] + '</span><div class="opts" role="radiogroup" aria-label="' + esc(f[0]) + '">' + f[3].map(function (o) {
        return '<label><input type="radio" name="' + f[1] + '" value="' + esc(o) + '"' + (o === v ? ' checked' : '') + ' data-k="' + f[1] + '"> ' + o + '</label>'; }).join('') + '</div></div>';
      return '<div class="fld"><label for="f-' + f[1] + '">' + f[0] + '</label><input class="input" id="f-' + f[1] + '" data-k="' + f[1] + '" value="' + esc(v) + '" placeholder="' + (v ? '' : 'Enter a value') + '">' + (f[2] ? '<div class="hint">' + f[2] + '</div>' : '') + '</div>';
    }

    var body;
    if (ui.submitted) body = submittedHtml();
    else if (step.docs) body = '<p>Attach the evidence that supports the figures entered. Every submitted value must point to a document.</p>' +
      '<div class="fld" style="margin-top:16px"><label for="f-file">Add document</label><input class="input" id="f-file" type="file" multiple style="padding:4px;width:100%"><div class="hint">Files stay on your device. Nothing is uploaded in this demonstration; only the file name is listed.</div></div>' +
      '<ul class="filelist">' + ui.files.map(function (n, i) { return '<li><span>' + esc(n) + '</span><button class="linkbtn" data-rm="' + i + '">Remove</button></li>'; }).join('') + '</ul>';
    else if (step.review) {
      var filled = Object.keys(ui.v).filter(function (k) { return ui.v[k] !== ''; }).length, total = Object.keys(ui.v).length;
      body = '<dl class="meta"><dt>Submitting entity</dt><dd>' + esc(ui.v.name) + '</dd><dt>Fields completed</dt><dd>' + filled + ' of ' + total + '</dd><dt>Supporting documents</dt><dd>' + ui.files.length + '</dd><dt>Reporting boundary</dt><dd>' + esc(ui.v.boundary) + '</dd></dl>' +
        '<div class="callout" style="margin-top:16px"><b>What happens on submission.</b> Your information enters a validation queue. It is held separately from the Public Data Score, which continues to be generated from public information only. Validated items appear in an assessment-informed view shown beside the public score.</div>' +
        '<p class="note" style="margin-top:8px">Fields left blank are recorded as not provided. They are not treated as poor performance.</p>';
    } else body = '<div class="form">' + step.fields.map(fieldHtml).join('') + '</div>';

    ctx.root.innerHTML =
      X.pageHead('Module 05 · Company assessment portal', 'How a company adds its own information',
        'Companies register, complete a structured assessment and attach evidence. Submissions are validated and shown alongside the independent public-data score, never in place of it.',
        '<div class="toolbar"><label>Submitting company<select class="select" id="a-co">' + X.companyOptions(c.id) + '</select></label></div>') +
      '<div class="steps"><section class="panel"><ol class="steplist">' + STEPS.map(function (s, i) {
        return '<li class="' + (i < ui.step || ui.submitted ? 'done' : '') + '"><button data-step="' + i + '"' + (i === ui.step && !ui.submitted ? ' aria-current="step"' : '') + '><span class="sn">' + (i + 1) + '</span>' + s.t + '</button></li>';
      }).join('') + '</ol></section>' +
      '<section class="panel"><div class="panel-h"><h2>' + (ui.submitted ? 'Assessment submission status' : 'Step ' + (ui.step + 1) + ' · ' + step.t) + '</h2>' + X.demoTag('Simulated workflow') + '</div>' +
        '<div class="panel-b">' + body + '</div>' +
        '<div class="panel-b" style="border-top:1px solid var(--border-soft);display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">' +
        (ui.submitted ? '<button class="btn" id="a-reset">Start a new submission</button><button class="btn primary" data-go="score/' + c.id + '">Open the score for ' + esc(c.name) + '</button>'
          : '<button class="btn" id="a-back"' + (ui.step === 0 ? ' disabled' : '') + '>Previous step</button>' +
            (step.review ? '<button class="btn primary" id="a-submit">Submit assessment</button>' : '<button class="btn primary" id="a-next">Save and continue</button>')) +
        '</div></section></div>';

    function submittedHtml() {
      var real = subs.length > 0;
      var stage = !real ? 1 : c.asm.status === 'Validated' ? 5 : c.asm.status === 'In validation' ? 3 : 4;
      return '<div class="grid" style="margin-bottom:0"><div class="c5"><ol class="track">' + TRACK.map(function (t, i) {
          return '<li class="' + (i < stage ? 'done' : i === stage ? 'now' : '') + '"><span class="tk"></span><div><b>' + t + '</b><span>' + (i < stage ? 'Complete' : i === stage ? 'In progress' : 'Pending') + '</span></div></li>';
        }).join('') + '</ol></div>' +
        '<div class="c7 stack"><div class="three" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
          '<div><span class="chip">Unchanged</span><h4>Public Data Score</h4><div class="kpi-v md num">' + pub.overall + '</div><p>Generated from public information only. Confidence ' + pub.confidence.value + '.</p></div>' +
          '<div><span class="chip acc">Separate view</span><h4>Assessment-informed view</h4><div class="kpi-v md num ink">' + asd.overall + '</div><p>Public data plus validated submissions. Confidence ' + asd.confidence.value + '.</p></div></div>' +
        (real ? '<div class="tblw"><table class="tbl"><thead><tr><th>Submitted item</th><th>Validation</th><th>Effect</th></tr></thead><tbody>' + subs.map(function (k) {
            var it = c.asm.items[k], ok = it[1] === 'validated';
            return '<tr><td>' + esc(indLabel[k]) + '</td><td>' + (ok ? '<span class="chip acc">Validated</span>' : '<span class="chip">Under review</span>') + '</td><td class="muted">' + (ok ? 'Counted in the assessment-informed view' : 'Listed, not counted') + '</td></tr>';
          }).join('') + '</tbody></table></div>'
          : '<p class="note">This demonstration holds no validated submission for ' + esc(c.name) + ', so both views show the same figures. Submitted items would be listed here with their validation status.</p>') +
        '<p class="note">Validation checks each submitted value against its supporting document. Additional evidence raises data confidence; it changes the score only where it evidences a different level of performance.</p></div></div>';
    }

    ctx.root.querySelector('#a-co').addEventListener('change', function () { seed(this.value); ctx.rerender(); });
    on(ctx.root, 'input', '[data-k]', function (t) { ui.v[t.getAttribute('data-k')] = t.value; });
    on(ctx.root, 'change', '[data-k]', function (t) { ui.v[t.getAttribute('data-k')] = t.value; });
    on(ctx.root, 'click', '[data-step]', function (t) { ui.submitted = false; ui.step = +t.getAttribute('data-step'); ctx.rerender(); });
    on(ctx.root, 'click', '[data-rm]', function (t) { ui.files.splice(+t.getAttribute('data-rm'), 1); ctx.rerender(); });
    on(ctx.root, 'change', '#f-file', function (t) { Array.prototype.forEach.call(t.files, function (f) { ui.files.push(f.name); }); ctx.rerender(); });
    on(ctx.root, 'click', '#a-back', function () { if (ui.step > 0) { ui.step--; ctx.rerender(); } });
    on(ctx.root, 'click', '#a-next', function () { ui.step++; ctx.rerender(); });
    on(ctx.root, 'click', '#a-submit', function () { ui.submitted = true; ctx.rerender(); });
    on(ctx.root, 'click', '#a-reset', function () { seed(ui.co); ctx.rerender(); });
  });
})();
