/* ════════════════════════════════════════════════════════════════════
   CLIMACTIX TERMINAL — LIVE WALKTHROUGH · MODULES 06–10
   06 Bank · 07 Insurance · 08 Investor · 09 Government · 10 Access and Plans
   Every institutional view presents intelligence inputs. None of them
   outputs a credit, underwriting or investment decision.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var X = window.CXT, D = X.D, esc = X.esc, fmt = X.fmt;
  var on = function (root, type, sel, fn) {
    root.addEventListener(type, function (e) { var t = e.target.closest(sel); if (t && root.contains(t)) fn(t, e); });
  };
  function indicator(id, iid) {
    var r = null;
    D.score(id).dims.forEach(function (d) { d.indicators.forEach(function (it) { if (it.id === iid) r = it; }); });
    return r;
  }
  function industryAvg(name) {
    var r = null;
    D.platform().industries.forEach(function (i) { if (i.name === name) r = i.avg; });
    return r;
  }
  function toggle(arr, id, max) {
    var i = arr.indexOf(id);
    if (i !== -1) arr.splice(i, 1); else { if (arr.length >= max) arr.shift(); arr.push(id); }
  }
  function industryOptions(sel) {
    var list = D.companies().map(function (c) { return c.industry; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();
    return '<option value="">All industries</option>' + list.map(function (i) { return '<option' + (i === sel ? ' selected' : '') + '>' + esc(i) + '</option>'; }).join('');
  }
  var HEAT = ['#F3F6FB', '#DCE6F5', '#B9C8E2', '#7F9CCB', '#0B3D91'];
  function heatPct(v) {
    var k = v >= 70 ? 4 : v >= 50 ? 3 : v >= 30 ? 2 : v >= 15 ? 1 : 0;
    return '<td class="h" style="background:' + HEAT[k] + ';color:' + (k >= 3 ? '#fff' : '#111') + '">' + v + '%</td>';
  }

  /* ── 06 · BANK INTELLIGENCE ────────────────────────────────────── */
  X.view('bank', function (ctx) {
    var ui = ctx.ui;
    ui.q = ui.q || ''; ui.ind = ui.ind || ''; ui.band = ui.band || '';
    ui.sel = ui.sel || ['tata-motors', 'mnm', 'arvalis'];
    ui.focus = ui.focus || X.state.company;

    ctx.root.innerHTML =
      X.pageHead('Module 06 · Bank intelligence dashboard', 'Corporate borrower sustainability screening',
        'Search corporate borrowers, review sustainability profiles, identify disclosure gaps and compare companies as an input to due diligence.') +
      '<div class="callout" style="margin-bottom:16px"><b>Intelligence input, not a credit decision.</b> The Climactix Score supports corporate due diligence and sustainability-related credit assessment. It is not a credit rating, and the terminal does not hold or use any confidential lending or financial information.</div>' +

      '<section class="panel" style="margin-bottom:16px"><div class="panel-h"><div class="toolbar" style="flex:1">' +
        '<label style="flex:1;min-width:200px">Search borrowers<input class="input" id="b-q" type="search" value="' + esc(ui.q) + '" placeholder="Company, industry or city"></label>' +
        '<label>Industry<select class="select" id="b-ind">' + industryOptions(ui.ind) + '</select></label>' +
        '<label>Score band<select class="select" id="b-band"><option value="">All scores</option><option value="hi"' + (ui.band === 'hi' ? ' selected' : '') + '>65 and above</option><option value="mid"' + (ui.band === 'mid' ? ' selected' : '') + '>45 to 64</option><option value="lo"' + (ui.band === 'lo' ? ' selected' : '') + '>Below 45</option><option value="gap"' + (ui.band === 'gap' ? ' selected' : '') + '>Five or more disclosure gaps</option></select></label>' +
        '</div>' + X.demoTag('Illustrative') + '</div><div class="panel-b flush tblw" id="b-table"></div></section>' +

      '<div class="grid"><section class="panel c7" id="b-compare"></section><section class="panel c5" id="b-focus"></section></div>';

    var $t = ctx.root.querySelector('#b-table'), $c = ctx.root.querySelector('#b-compare'), $f = ctx.root.querySelector('#b-focus');

    function table() {
      var rows = D.search(ui.q).filter(function (c) {
        var s = D.score(c.id), g = s.counts.missing + s.counts.insufficient;
        return (!ui.ind || c.industry === ui.ind) &&
          (!ui.band || (ui.band === 'hi' && s.overall >= 65) || (ui.band === 'mid' && s.overall >= 45 && s.overall < 65) || (ui.band === 'lo' && s.overall < 45) || (ui.band === 'gap' && g >= 5));
      });
      $t.innerHTML = rows.length ? '<table class="tbl"><thead><tr><th>Compare</th><th>Borrower</th><th class="r">Score</th><th>Grade</th><th>Data confidence</th><th class="r">Not disclosed</th><th class="r">Insufficient evidence</th><th>Risk indicators</th></tr></thead><tbody>' +
        rows.map(function (c) {
          var s = D.score(c.id);
          return '<tr class="click' + (c.id === ui.focus ? ' sel' : '') + '" data-focus="' + c.id + '"><td><input type="checkbox" data-cmp="' + c.id + '"' + (ui.sel.indexOf(c.id) !== -1 ? ' checked' : '') + ' aria-label="Compare ' + esc(c.name) + '"></td><td>' + X.coCell(c) + '</td><td class="n">' + s.overall + '</td><td>' + X.grade(s.band) + '</td><td>' + X.confChip(s.confidence) + '</td><td class="n">' + s.counts.missing + '</td><td class="n">' + s.counts.insufficient + '</td><td>' + X.riskChips(c.id, 1) + '</td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">No borrower in the demonstration dataset matches these filters.</div>';
    }

    function compare() {
      var cs = ui.sel.map(D.company), ss = ui.sel.map(function (id) { return D.score(id); });
      var row = function (label, fn, plain) { return '<tr><td>' + label + '</td>' + ss.map(function (s, i) { return '<td class="' + (plain ? '' : 'n') + '">' + fn(s, cs[i]) + '</td>'; }).join('') + '</tr>'; };
      $c.innerHTML = '<div class="panel-h"><h2>Compare companies</h2><span class="note">' + ui.sel.length + ' of 4 selected</span><div class="sub">Tick borrowers in the table above to add or remove them.</div></div>' +
        (cs.length < 2 ? '<div class="empty">Select at least two borrowers to compare.</div>' :
        '<div class="panel-b flush tblw"><table class="tbl"><thead><tr><th>Measure</th>' + cs.map(function (c) { return '<th class="r">' + esc(c.name) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        row('Climactix Score', function (s) { return s.overall; }) +
        row('Rating grade', function (s) { return X.grade(s.band); }) +
        D.dimensions.map(function (d, i) { return row(d.name, function (s) { return s.dims[i].score == null ? '<span class="muted" title="Not scoreable from available evidence">—</span>' : s.dims[i].score; }); }).join('') +
        row('Data confidence', function (s) { return s.confidence.value; }) +
        row('Indicators not disclosed', function (s) { return s.counts.missing; }) +
        row('Insufficient evidence', function (s) { return s.counts.insufficient; }) +
        row('Adverse performance', function (s) { return s.counts.adverse; }) +
        '</tbody></table></div>');
    }

    function focus() {
      var c = D.company(ui.focus), s = D.score(c.id), g = D.gaps(c.id);
      var li = function (arr) { return arr.map(function (it) { return '<li>' + esc(it.label) + '</li>'; }).join(''); };
      $f.innerHTML = '<div class="panel-h"><h2>Borrower review · ' + esc(c.name) + '</h2>' + X.entityTag(c) + '</div><div class="panel-b">' +
        '<div class="toolbar" style="margin-bottom:16px"><span class="kpi-v md num">' + s.overall + '</span>' + X.grade(s.band) + X.confChip(s.confidence) + '</div>' +
        '<h3 style="font-size:14px;margin-bottom:8px">Sustainability-related risk indicators</h3><p style="display:flex;flex-wrap:wrap;gap:8px">' + X.riskChips(c.id) + '</p>' +
        '<h3 style="font-size:14px;margin:16px 0 8px">Disclosure gaps</h3>' +
        (g.missing.length + g.insufficient.length === 0 ? '<p class="note">No gaps: all twenty indicators are evidenced.</p>' :
          (g.missing.length ? '<p><span class="chip">Not disclosed</span></p><ul style="margin:8px 0 16px 24px">' + li(g.missing) + '</ul>' : '') +
          (g.insufficient.length ? '<p><span class="chip warn">Insufficient evidence</span></p><ul style="margin:8px 0 0 24px">' + li(g.insufficient) + '</ul>' : '')) +
        '<p class="note" style="margin-top:16px">Gaps are questions to raise with the borrower. They reduce data confidence and are not scored as poor performance.</p>' +
        '<div class="toolbar" style="margin-top:16px"><button class="btn primary" data-summary="' + c.id + '" data-audience="bank">Generate intelligence summary</button><button class="btn" data-go="company/' + c.id + '">Open profile</button><button class="btn" data-go="score/' + c.id + '">Score breakdown</button></div></div>';
    }

    ctx.root.querySelector('#b-q').addEventListener('input', function () { ui.q = this.value; table(); });
    ctx.root.querySelector('#b-ind').addEventListener('change', function () { ui.ind = this.value; table(); });
    ctx.root.querySelector('#b-band').addEventListener('change', function () { ui.band = this.value; table(); });
    on($t, 'click', '[data-focus]', function (t, e) {
      var cb = e.target.closest('[data-cmp]');
      if (cb) { toggle(ui.sel, cb.getAttribute('data-cmp'), 4); table(); compare(); return; }
      ui.focus = t.getAttribute('data-focus'); X.state.company = ui.focus; table(); focus();
    });
    table(); compare(); focus();
  });

  /* ── 07 · INSURANCE INTELLIGENCE ───────────────────────────────── */
  var EXPOSURE = [['e1', 'GHG intensity trend'], ['e3', 'Water stress management'], ['e4', 'Waste and circularity'], ['c3', 'Physical-risk assessment'], ['c1', 'Net zero target'], ['d1', 'External assurance']];
  X.view('insurance', function (ctx) {
    var ui = ctx.ui;
    ui.ind = ui.ind || ''; ui.focus = ui.focus || X.state.company;
    var rows = D.companies().filter(function (c) { return !ui.ind || c.industry === ui.ind; });
    var c = D.company(ui.focus), s = D.score(c.id), hist = D.history(c.id), p = D.platform();
    var cell = function (it) {
      if (it.state === 'missing') return '<td class="h st-mis" title="Not disclosed">ND</td>';
      if (it.state === 'insufficient') return '<td class="h st-ins" title="Insufficient evidence">IE</td>';
      var cls = it.adverse ? 'st-adv' : it.value >= 65 ? 'st-strong' : 'st-mod';
      return '<td class="h ' + cls + '" title="' + (it.adverse ? 'Adverse performance' : it.value >= 65 ? 'Strong' : 'Moderate') + '">' + it.value + '</td>';
    };
    var climateDocs = D.reports({ company: c.id, category: 'CL' }), nzDocs = D.reports({ company: c.id, category: 'NZ' });
    var maxAvg = 100;

    ctx.root.innerHTML =
      X.pageHead('Module 07 · Insurance intelligence dashboard', 'Corporate sustainability screening for insurers',
        'Environmental exposure indicators, climate disclosure analysis and industry comparison for corporate accounts.') +
      '<div class="callout" style="margin-bottom:16px"><b>Intelligence inputs, not actuarial outputs.</b> These indicators describe what a company has disclosed and evidenced. They are not loss estimates, pricing signals or underwriting decisions.</div>' +

      '<section class="panel" style="margin-bottom:16px"><div class="panel-h"><h2>Environmental exposure indicators</h2><div class="toolbar"><label>Industry<select class="select" id="i-ind">' + industryOptions(ui.ind) + '</select></label></div>' +
        '<div class="sub">Indicator score by company. Select a row to analyse the account below.</div></div>' +
        '<div class="panel-b flush tblw"><table class="tbl heat"><thead><tr><th>Company</th><th class="r">Score</th>' + EXPOSURE.map(function (e) { return '<th style="text-align:center">' + e[1] + '</th>'; }).join('') + '</tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr class="click' + (r.id === c.id ? ' sel' : '') + '" data-focus="' + r.id + '"><td>' + X.coCell(r) + '</td><td class="n">' + D.score(r.id).overall + '</td>' + EXPOSURE.map(function (e) { return cell(indicator(r.id, e[0])); }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="panel-b" style="border-top:1px solid var(--border-soft)"><div class="legend"><span><i class="st-strong"></i>Strong (65 and above)</span><span><i class="st-mod"></i>Moderate (40–64)</span><span><i class="st-adv"></i>Adverse performance (below 40)</span><span><i class="st-ins"></i>IE · Insufficient evidence</span><span><i class="st-mis"></i>ND · Not disclosed</span></div></div></section>' +

      '<div class="grid">' +
        '<section class="panel c6"><div class="panel-h"><h2>Climate disclosure analysis · ' + esc(c.name) + '</h2>' + X.entityTag(c) + '</div><div class="panel-b flush tblw"><table class="tbl"><tbody>' +
          '<tr><td>Climate reports held</td><td class="r">' + (climateDocs.length ? climateDocs.length + ' (' + climateDocs[climateDocs.length - 1].fy + ' onward)' : '<span class="chip">None located</span>') + '</td></tr>' +
          '<tr><td>Net zero reports held</td><td class="r">' + (nzDocs.length ? nzDocs.length + ' (' + nzDocs[nzDocs.length - 1].fy + ' onward)' : '<span class="chip">None located</span>') + '</td></tr>' +
          s.dims[3].indicators.map(function (it) { return '<tr><td>' + esc(it.label) + '</td><td class="r">' + X.stateChip(it) + (it.value != null ? ' <b class="num">' + it.value + '</b>' : '') + '</td></tr>'; }).join('') +
          '<tr><td>Climate strategy dimension</td><td class="r">' + (s.dims[3].score == null ? '<span class="chip">Not scoreable</span>' : '<b class="num">' + s.dims[3].score + ' / 100</b>') + '</td></tr>' +
          '</tbody></table></div><div class="panel-b" style="border-top:1px solid var(--border-soft)"><p style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">' + X.riskChips(c.id) + '</p>' +
          '<div class="toolbar"><button class="btn primary" data-summary="' + c.id + '" data-audience="insurance">Generate intelligence summary</button><button class="btn" data-go="company/' + c.id + '">Open profile</button></div></div></section>' +

        '<div class="c6 stack">' +
          '<section class="panel"><div class="panel-h"><h2>Historical sustainability performance</h2>' + X.demoTag('Simulated') + '</div><div class="panel-b">' +
            X.lineChart({ labels: D.years, series: [{ name: c.name, values: hist.map(function (h) { return h.score; }) }], h: 180, legend: true, label: 'Score history for ' + c.name }) + '</div></section>' +
          '<section class="panel"><div class="panel-h"><h2>Industry-wise comparison</h2>' + X.demoTag('Illustrative') + '<div class="sub">Average Climactix Score by industry. ' + esc(c.name) + ' scores ' + s.overall + ' against an industry average of ' + industryAvg(c.industry) + '.</div></div><div class="panel-b"><div class="barlist">' +
            p.industries.slice().sort(function (a, b) { return b.avg - a.avg; }).map(function (i) {
              return '<div class="barrow' + (i.name === c.industry ? ' hl' : '') + '"><span class="lbl">' + esc(i.name) + '</span><div class="meter-t"><div class="meter-f' + (i.name === c.industry ? '' : ' mut') + '" style="width:' + (i.avg / maxAvg * 100) + '%"></div></div><span class="num" style="text-align:right">' + i.avg + '</span></div>';
            }).join('') + '</div></div></section>' +
        '</div></div>';

    ctx.root.querySelector('#i-ind').addEventListener('change', function () { ui.ind = this.value; ctx.rerender(); });
    on(ctx.root, 'click', '[data-focus]', function (t) { ui.focus = t.getAttribute('data-focus'); X.state.company = ui.focus; ctx.rerender(); });
  });

  /* ── 08 · INVESTOR INTELLIGENCE ────────────────────────────────── */
  X.view('investor', function (ctx) {
    var ui = ctx.ui, pf = D.portfolio();
    ui.min = ui.min || '';
    ui.sel = ui.sel || pf.holdings.slice(0, 2).map(function (h) { return h.company.id; });
    var weight = {}; pf.holdings.forEach(function (h) { weight[h.company.id] = h.weight; });
    var rows = D.companies().filter(function (c) { return !ui.min || D.score(c.id).overall >= +ui.min; })
      .sort(function (a, b) { return (weight[b.id] || 0) - (weight[a.id] || 0); });

    var series = [{ name: pf.name, values: pf.history.map(function (h) { return h.score; }) }].concat(ui.sel.map(function (id) {
      return { name: D.company(id).name, values: D.history(id).map(function (h) { return h.score; }) };
    }));

    ctx.root.innerHTML =
      X.pageHead('Module 08 · Investor intelligence dashboard', 'Portfolio sustainability intelligence',
        'Screen companies, compare scores, review net zero commitments and disclosure credibility across a portfolio.',
        '<button class="btn primary" id="v-report">Generate portfolio intelligence report</button>') +
      '<div class="callout plain" style="margin-bottom:16px"><b>Research input, not investment advice.</b> The model portfolio and its weights are a demonstration. No holdings, prices or returns data are used.</div>' +

      '<div class="grid">' +
        kpi('Portfolio Climactix Score', pf.score + '<small> / 100</small>', 'Weighted by holding · grade ' + D.band(pf.score).grade) +
        kpi('Disclosure credibility', pf.credibility + '<small> / 100</small>', 'Weighted dimension score') +
        kpi('Data confidence', pf.confidence + '<small> / 100</small>', 'Weighted across holdings') +
        kpi('Dated net zero target', pf.targetWeight + '<small>% of weight</small>', pf.interimWeight + '% also disclose interim milestones') +
      '</div>' +

      '<section class="panel" style="margin-bottom:16px"><div class="panel-h"><h2>Company screening and holdings</h2><div class="toolbar"><label>Minimum score<select class="select" id="v-min"><option value="">No minimum</option>' +
        [55, 65, 75].map(function (v) { return '<option value="' + v + '"' + (+ui.min === v ? ' selected' : '') + '>' + v + ' and above</option>'; }).join('') + '</select></label></div>' +
        '<div class="sub">Tick up to three companies to plot their score history against the portfolio.</div></div>' +
        '<div class="panel-b flush tblw">' + (rows.length ? '<table class="tbl"><thead><tr><th>Chart</th><th>Company</th><th class="r">Weight</th><th class="r">Score</th><th>Grade</th><th class="r">Credibility</th><th class="r">Confidence</th><th class="r">vs industry</th><th class="r">Since ' + D.years[0].replace('FY20', 'FY') + '</th><th></th></tr></thead><tbody>' +
          rows.map(function (c) {
            var s = D.score(c.id), h = D.history(c.id), w = weight[c.id];
            return '<tr><td><input type="checkbox" data-plot="' + c.id + '"' + (ui.sel.indexOf(c.id) !== -1 ? ' checked' : '') + ' aria-label="Plot ' + esc(c.name) + '"></td><td>' + X.coCell(c) + '</td><td class="n">' + (w ? w + '%' : '<span class="muted" title="Not held in the model portfolio">—</span>') + '</td><td class="n">' + s.overall + '</td><td>' + X.grade(s.band) + '</td><td class="n">' + s.dims[4].score + '</td><td class="n">' + s.confidence.value + '</td><td class="n">' + X.signed(s.overall - industryAvg(c.industry)) + '</td><td class="n">' + X.signed(s.overall - h[0].score) + '</td><td class="r"><button class="linkbtn" data-summary="' + c.id + '" data-audience="investor">Report</button></td></tr>';
          }).join('') + '</tbody></table>' : '<div class="empty">No company meets this minimum score.</div>') + '</div></section>' +

      '<div class="grid">' +
        '<section class="panel c6"><div class="panel-h"><h2>Historical score movement</h2>' + X.demoTag('Simulated') + '</div><div class="panel-b">' +
          X.lineChart({ labels: D.years, series: series, h: 240, label: 'Score history: portfolio and selected companies' }) + '</div></section>' +
        '<section class="panel c6"><div class="panel-h"><h2>Net zero commitment analysis</h2>' + X.demoTag('Illustrative') + '</div><div class="panel-b flush tblw"><table class="tbl"><thead><tr><th>Company</th><th>Commitment</th><th>Target evidence</th><th>Scope 3 coverage</th></tr></thead><tbody>' +
          pf.holdings.map(function (h) {
            var c = h.company;
            return '<tr><td><button class="linkbtn" data-go="company/' + c.id + '">' + esc(c.name) + '</button></td><td>' + esc(c.netZero.target) + '<br><span class="note">' + esc(c.netZero.interim) + '</span></td><td>' + X.stateChip(indicator(c.id, 'c1')) + '</td><td>' + X.stateChip(indicator(c.id, 'c2')) + '</td></tr>';
          }).join('') + '</tbody></table></div></section>' +
      '</div>';

    function kpi(label, value, sub) {
      return '<div class="panel kpi c3"><div class="kpi-l">' + label + X.demoTag() + '</div><div class="kpi-v md num">' + value + '</div><div class="kpi-s">' + sub + '</div></div>';
    }
    function report() {
      var html = '<div class="doc"><div class="doc-flag">Demonstration report · illustrative data · not investment advice</div>' +
        '<h3>Portfolio sustainability intelligence report</h3><p>' + esc(pf.name) + ' · Data as of ' + D.meta.asOf + '</p>' +
        '<h4>Portfolio position</h4><table><tr><td>Weighted Climactix Score</td><td>' + pf.score + ' / 100 (' + D.band(pf.score).grade + ')</td></tr><tr><td>Weighted disclosure credibility</td><td>' + pf.credibility + ' / 100</td></tr><tr><td>Weighted data confidence</td><td>' + pf.confidence + ' / 100</td></tr><tr><td>Weight with a dated net zero target</td><td>' + pf.targetWeight + '%</td></tr><tr><td>Score movement since ' + D.years[0] + '</td><td>' + X.signed(pf.score - pf.history[0].score) + ' points</td></tr></table>' +
        '<h4>Holdings</h4><table><tr><th>Company</th><th>Weight · Score · Grade</th></tr>' + pf.holdings.map(function (h) { return '<tr><td>' + esc(h.company.name) + '</td><td>' + h.weight + '% · ' + h.score + ' · ' + D.band(h.score).grade + '</td></tr>'; }).join('') + '</table>' +
        '<h4>Points for engagement</h4><ul>' + pf.holdings.filter(function (h) { return X.riskIndicators(h.company.id).length; }).map(function (h) {
          return '<li><b>' + esc(h.company.name) + '</b>: ' + X.riskIndicators(h.company.id).map(function (r) { return esc(r.text); }).join('; ') + '.</li>'; }).join('') + '</ul>' +
        '<p style="margin-top:24px">Indicators that are not disclosed or lack evidence are excluded from scores and reduce data confidence. They are not treated as poor performance.</p></div>';
      X.openDrawer('Portfolio intelligence report', html, '<button class="btn primary" id="tw-print">Print or save as PDF</button>');
      document.getElementById('tw-print').addEventListener('click', function () { X.printDoc(html); });
    }

    ctx.root.querySelector('#v-min').addEventListener('change', function () { ui.min = this.value; ctx.rerender(); });
    ctx.root.querySelector('#v-report').addEventListener('click', report);
    on(ctx.root, 'change', '[data-plot]', function (t) { toggle(ui.sel, t.getAttribute('data-plot'), 3); ctx.rerender(); });
  });

  /* ── 09 · GOVERNMENT INTELLIGENCE ──────────────────────────────── */
  X.view('government', function (ctx) {
    var ui = ctx.ui, p = D.platform();
    ui.sort = ui.sort || 'companies';
    var inds = p.industries.slice().sort(function (a, b) { return ui.sort === 'name' ? (a.name < b.name ? -1 : 1) : b[ui.sort] - a[ui.sort]; });
    var cov = Math.round(p.industries.reduce(function (a, i) { return a + i.coverage * i.companies; }, 0) / p.companies);
    var brsr = p.participation.BRSR[4];
    var maxReg = Math.max.apply(null, p.regions.map(function (r) { return r.companies; }));
    var th = function (k, label) { return '<th class="' + (k === 'name' ? '' : 'r') + '"><button class="linkbtn" data-sort="' + k + '" style="font-weight:' + (ui.sort === k ? 700 : 500) + '">' + label + (ui.sort === k ? ' ↓' : '') + '</button></th>'; };

    ctx.root.innerHTML =
      X.pageHead('Module 09 · Government intelligence dashboard', 'Sector and regional sustainability intelligence',
        'Aggregated views of corporate disclosure coverage, reporting participation and sector-level environmental indicators.') +
      '<div class="callout plain" style="margin-bottom:16px"><b>Synthetic aggregates.</b> Every figure on this page is demonstration data. Climactix has no integration with, data feed from, or approval by any government body, and none is implied.</div>' +

      '<div class="grid">' +
        kpi('Companies indexed', fmt(p.companies), p.regions.length + ' regions · ' + p.industries.length + ' industries') +
        kpi('BRSR reporting participation', brsr + '<small>%</small>', 'Of indexed companies, ' + D.meta.currentFy) +
        kpi('Companies assessed', fmt(p.assessed), Math.round(p.assessed / p.companies * 100) + '% of indexed companies') +
        kpi('Average disclosure coverage', cov + '<small>%</small>', 'Share of scoring indicators disclosed') +
      '</div>' +

      '<section class="panel" style="margin-bottom:16px"><div class="panel-h"><h2>Industry-wise sustainability intelligence</h2>' + X.demoTag('Synthetic') + '<div class="sub">Select a column heading to sort.</div></div>' +
        '<div class="panel-b flush tblw"><table class="tbl"><thead><tr>' + th('name', 'Industry') + th('companies', 'Companies') + th('assessed', 'Assessed') + th('avg', 'Average score') + th('participation', 'Reporting participation') + th('coverage', 'Disclosure coverage') + '</tr></thead><tbody>' +
        inds.map(function (i) {
          return '<tr><td>' + esc(i.name) + '</td><td class="n">' + i.companies + '</td><td class="n">' + i.assessed + '</td><td>' + X.meter(i.avg) + '</td><td>' + X.meter(i.participation, 'mut') + '</td><td>' + X.meter(i.coverage, 'mut') + '</td></tr>';
        }).join('') + '</tbody></table></div></section>' +

      '<div class="grid">' +
        '<section class="panel c6"><div class="panel-h"><h2>Sustainability reporting participation</h2>' + X.demoTag('Synthetic') + '<div class="sub">Share of indexed companies publishing each disclosure type (%).</div></div><div class="panel-b">' +
          X.lineChart({ labels: D.years, min: 0, max: 100, h: 240, label: 'Reporting participation by disclosure type', series: [
            { name: 'BRSR', values: p.participation.BRSR }, { name: 'Sustainability report', values: p.participation.SR },
            { name: 'Climate report', values: p.participation.CL }, { name: 'Net zero report', values: p.participation.NZ }] }) + '</div></section>' +

        '<section class="panel c6"><div class="panel-h"><h2>Regional company assessment distribution</h2>' + X.demoTag('Synthetic') + '</div><div class="panel-b"><div class="barlist">' +
          p.regions.map(function (r) {
            return '<div class="barrow" style="grid-template-columns:minmax(96px,160px) 1fr 144px"><span class="lbl">' + esc(r.name) + '</span><div class="meter-t" style="height:16px"><div class="meter-f mut" style="width:' + (r.companies / maxReg * 100) + '%;position:absolute;inset:0 auto 0 0"></div><div class="meter-f" style="width:' + (r.assessed / maxReg * 100) + '%;position:absolute;inset:0 auto 0 0"></div></div><span style="text-align:right"><b class="num">' + r.companies + '</b> <span class="note">· ' + r.assessed + ' assessed</span></span></div>';
          }).join('') + '</div><div class="legend" style="margin-top:16px"><span><i style="background:#8A93A0"></i>Companies indexed</span><span><i style="background:#0B3D91"></i>Companies assessed</span></div></div></section>' +
      '</div>' +

      '<div class="grid">' +
        '<section class="panel c7"><div class="panel-h"><h2>Sector-level environmental indicators</h2>' + X.demoTag('Synthetic') + '<div class="sub">Share of companies in each sector, for emissions-intensive and reference sectors.</div></div>' +
          '<div class="panel-b flush tblw"><table class="tbl heat"><thead><tr><th>Sector</th><th style="text-align:center">Disclose GHG emissions</th><th style="text-align:center">Disclose water data</th><th style="text-align:center">Dated net zero target</th><th style="text-align:center">Avg renewable electricity</th></tr></thead><tbody>' +
          p.sectorEnv.map(function (s) { return '<tr><td>' + esc(s.name) + '</td>' + heatPct(s.ghgDisclosed) + heatPct(s.waterDisclosed) + heatPct(s.targets) + heatPct(s.renewables) + '</tr>'; }).join('') +
          '</tbody></table></div></section>' +

        '<section class="panel c5"><div class="panel-h"><h2>Corporate disclosure coverage</h2>' + X.demoTag('Synthetic') + '<div class="sub">Documents held by category across all indexed companies.</div></div><div class="panel-b"><div class="barlist">' +
          D.categories.map(function (c) {
            var v = p.reportTotals[c.key];
            return '<div class="barrow"><span class="lbl">' + esc(c.name) + '</span><div class="meter-t"><div class="meter-f" style="width:' + (v / p.reportTotals.AR * 100) + '%"></div></div><span class="num" style="text-align:right">' + fmt(v) + '</span></div>';
          }).join('') + '</div>' +
          '<p class="note" style="margin-top:16px">Aggregated insight: participation is highest where reporting is mandatory. Climate and net zero disclosure remain voluntary and concentrated in a few sectors.</p></div></section>' +
      '</div>';

    function kpi(label, value, sub) {
      return '<div class="panel kpi c3"><div class="kpi-l">' + label + X.demoTag() + '</div><div class="kpi-v md num">' + value + '</div><div class="kpi-s">' + sub + '</div></div>';
    }
    on(ctx.root, 'click', '[data-sort]', function (t) { ui.sort = t.getAttribute('data-sort'); ctx.rerender(); });
  });

  /* ── 10 · ACCESS AND PLANS ─────────────────────────────────────── */
  var CAPS = [
    ['Company intelligence search', 1, 1, 1, 0], ['Climactix Score and breakdown', 1, 1, 1, 1], ['Report repository access', 1, 1, 1, 1],
    ['Corporate screening and comparison', 1, 1, 1, 0], ['Institutional dashboard', 1, 1, 1, 0], ['Portfolio intelligence', 0, 0, 1, 0],
    ['Hosted company profile', 0, 0, 0, 1], ['Report hosting', 0, 0, 0, 1], ['Additional company assessment workflow', 0, 0, 0, 1]
  ];
  X.view('plans', function (ctx) {
    ctx.root.innerHTML =
      X.pageHead('Access and plans', 'Who uses the terminal, and on what terms',
        'Institutions that use the intelligence join on a complimentary pilot. Companies that host their disclosures subscribe.') +
      '<div class="plans" style="margin-bottom:16px">' + D.plans.map(function (pl) {
        var paid = pl.type === 'paid';
        return '<section class="panel plan' + (paid ? ' paid' : '') + '"><div class="panel-h"><h3>' + esc(pl.audience) + '</h3></div><div class="panel-b">' +
          '<div><span class="chip ' + (paid ? '' : 'acc') + '">' + (paid ? 'Paid subscription' : 'Complimentary pilot') + '</span><div class="term" style="margin-top:8px">' + (paid ? 'Report hosting subscription' : 'Six months, no charge') + '</div>' +
          '<div class="note">' + (paid ? 'Annual subscription. Pricing shared on enquiry.' : 'Institutional access for the pilot period.') + '</div></div>' +
          '<ul>' + pl.features.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' +
          '<div class="toolbar"><a class="btn primary" href="index.html#contact">' + (paid ? 'Enquire about hosting' : 'Request pilot access') + '</a><button class="btn" data-go="' + pl.route + '">' + (paid ? 'See the portal' : 'Open this view') + '</button></div></div></section>';
      }).join('') + '</div>' +

      '<section class="panel" style="margin-bottom:16px"><div class="panel-h"><h2>What each participant receives</h2></div><div class="panel-b flush tblw"><table class="tbl"><thead><tr><th>Capability</th><th style="text-align:center">Banks</th><th style="text-align:center">Insurers</th><th style="text-align:center">Investment firms</th><th style="text-align:center">Companies</th></tr></thead><tbody>' +
        '<tr><td><b>Commercial terms</b></td><td style="text-align:center">Complimentary pilot</td><td style="text-align:center">Complimentary pilot</td><td style="text-align:center">Complimentary pilot</td><td style="text-align:center">Paid subscription</td></tr>' +
        CAPS.map(function (r) { return '<tr><td>' + r[0] + '</td>' + r.slice(1).map(function (v) { return '<td style="text-align:center">' + (v ? '<span aria-label="Included">●</span>' : '<span class="muted" aria-label="Not included">—</span>') + '</td>'; }).join('') + '</tr>'; }).join('') +
        '</tbody></table></div></section>' +

      '<div class="grid"><div class="callout c6"><b>A subscription does not buy a score.</b> A company subscription pays for hosting, a profile and the assessment workflow. It does not buy a score: the Public Data Score is generated from public information whether or not a company subscribes.</div>' +
      '<div class="callout plain c6"><b>Status of this walkthrough.</b> No payment is collected here and no account is created. Pilot terms and subscription pricing are confirmed directly with Climactix. Live disclosure ingestion and the production scoring engine connection are in development.</div></div>';
  });
})();
