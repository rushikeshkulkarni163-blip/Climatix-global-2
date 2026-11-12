/* ════════════════════════════════════════════════════════════════════
   CLIMACTIX TERMINAL — LIVE WALKTHROUGH · CORE
   Shell, hash router, shared components and SVG charts.
   Module views register themselves through CXT.view(id, fn) from
   terminal-walkthrough-modules.js and terminal-walkthrough-audiences.js.
   All data comes from window.CX_TERMINAL_DEMO (terminal-demo-data.js).
   ════════════════════════════════════════════════════════════════════ */
window.CXT = (function () {
  'use strict';
  var D = window.CX_TERMINAL_DEMO;

  var MODULES = [
    { id: 'dashboard', n: '01', title: 'Terminal Dashboard', cap: 'What the terminal holds: companies, disclosures and scores in one place.' },
    { id: 'company', n: '02', title: 'Company Intelligence', cap: 'Search a company and open its consolidated sustainability profile.' },
    { id: 'score', n: '03', title: 'Intelligence Score', cap: 'How the score is built, and what is known versus not yet evidenced.' },
    { id: 'reports', n: '04', title: 'Report Repository', cap: 'Every disclosure document, filterable by company, category and year.' },
    { id: 'assessment', n: '05', title: 'Company Assessment Portal', cap: 'How a company adds information without overwriting the public-data score.' },
    { id: 'bank', n: '06', title: 'Bank Intelligence', cap: 'Borrower screening, disclosure gaps and comparison for due diligence.' },
    { id: 'insurance', n: '07', title: 'Insurance Intelligence', cap: 'Environmental exposure indicators and climate disclosure analysis.' },
    { id: 'investor', n: '08', title: 'Investor Intelligence', cap: 'Portfolio overview, comparisons and net zero commitment analysis.' },
    { id: 'government', n: '09', title: 'Government Intelligence', cap: 'Sector, regional and participation aggregates.' },
    { id: 'plans', n: '10', title: 'Access and Plans', cap: 'Complimentary institutional pilots and company subscriptions.' }
  ];

  var views = {};
  var state = { company: 'tata-motors', ui: {} };
  var route = { id: 'dashboard', param: null, query: {} };
  var $ = function (id) { return document.getElementById(id); };

  /* ── Formatting helpers ────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function signed(n) { return (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n); }

  /* ── Shared components (HTML strings) ──────────────────────────── */
  function demoTag(text) { return '<span class="chip demo">' + esc(text || 'Demo') + '</span>'; }
  function entityTag(c) {
    return c.synthetic ? '<span class="chip demo" title="Entity invented for this demonstration">Synthetic entity</span>'
                       : '<span class="chip demo" title="Recognisable company name with illustrative values">Demo profile</span>';
  }
  function grade(band) { return '<span class="grade" title="' + esc(band.label) + '">' + esc(band.grade) + '</span>'; }
  function meter(v, cls) {
    if (v == null) return '<div class="meter"><div class="meter-t na" title="Not scoreable from available evidence"></div><span class="meter-v muted">—</span></div>';
    return '<div class="meter"><div class="meter-t"><div class="meter-f ' + (cls || '') + '" style="width:' + Math.max(0, Math.min(100, v)) + '%"></div></div><span class="meter-v num">' + v + '</span></div>';
  }
  function stateChip(it) {
    if (it.state === 'missing') return '<span class="chip" title="No public disclosure located. Excluded from the score, not counted as poor performance.">Not disclosed</span>';
    if (it.state === 'insufficient') return '<span class="chip warn" title="A claim was located but could not be traced to evidence. Excluded from the score.">Insufficient evidence</span>';
    if (it.adverse) return '<span class="chip crit" title="Evidenced value below ' + D.adverseBelow + '. This lowers the score.">Adverse performance</span>';
    return '<span class="chip ok" title="Disclosed with traceable evidence. Scored.">Evidenced</span>';
  }
  function confChip(conf) {
    var cls = conf.band === 'High' ? 'ok' : conf.band === 'Moderate' ? 'warn' : '';
    return '<span class="chip ' + cls + '">' + conf.band + ' · ' + conf.value + '</span>';
  }
  function coCell(c, sub) {
    return '<span class="co">' + esc(c.name) + '<small>' + esc(sub || c.industry) + '</small></span>';
  }
  function companyOptions(sel, withAll) {
    return (withAll ? '<option value="">All companies</option>' : '') + D.companies().map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === sel ? ' selected' : '') + '>' + esc(c.name) + (c.synthetic ? ' (synthetic)' : '') + '</option>';
    }).join('');
  }
  function pageHead(n, title, text, actions) {
    return '<div class="ph"><div><div class="ph-eyebrow">' + esc(n) + '</div><h1>' + esc(title) + '</h1><p>' + esc(text) + '</p></div>' +
           (actions ? '<div class="ph-actions">' + actions + '</div>' : '') + '</div>';
  }

  /* Risk indicators shared by the bank, insurance and investor views.
     Each one is derived from an indicator state, never asserted. */
  function riskIndicators(id) {
    var c = D.company(id), s = D.score(id), g = D.gaps(id), out = [];
    g.adverse.forEach(function (it) { out.push({ level: 'crit', text: 'Adverse performance: ' + it.label }); });
    if (s.confidence.band === 'Low') out.push({ level: 'warn', text: 'Low data confidence' });
    var find = function (iid) { var r = null; s.dims.forEach(function (d) { d.indicators.forEach(function (it) { if (it.id === iid) r = it; }); }); return r; };
    if (find('c1').state !== 'evidenced') out.push({ level: 'warn', text: 'Net zero target not evidenced' });
    if (c.netZero.interim !== 'Interim milestones disclosed') out.push({ level: 'warn', text: 'No interim milestones' });
    if (find('c3').state !== 'evidenced') out.push({ level: 'warn', text: 'Physical-risk assessment not evidenced' });
    if (find('d1').state !== 'evidenced') out.push({ level: 'warn', text: 'No external assurance located' });
    return out;
  }
  function riskChips(id, max) {
    var r = riskIndicators(id);
    if (!r.length) return '<span class="muted">None flagged</span>';
    var shown = r.slice(0, max || r.length).map(function (x) { return '<span class="chip ' + x.level + '">' + esc(x.text) + '</span>'; }).join(' ');
    return shown + (max && r.length > max ? ' <span class="muted">+' + (r.length - max) + '</span>' : '');
  }

  /* ── SVG charts ────────────────────────────────────────────────── */
  var SERIES = [
    { color: '#0B3D91', dash: '' }, { color: '#111111', dash: '5 3' },
    { color: '#6B7280', dash: '2 3' }, { color: '#5A7FC0', dash: '8 3 2 3' }
  ];
  function lineChart(o) {
    var W = 640, H = o.h || 220, L = 36, R = 16, T = 12, B = 28;
    var all = [];
    o.series.forEach(function (s) { s.values.forEach(function (v) { if (v != null) all.push(v); }); });
    var min = o.min != null ? o.min : Math.floor((Math.min.apply(null, all) - 4) / 10) * 10;
    var max = o.max != null ? o.max : Math.ceil((Math.max.apply(null, all) + 4) / 10) * 10;
    if (max === min) max = min + 10;
    var n = o.labels.length;
    var x = function (i) { return L + (W - L - R) * (n === 1 ? 0.5 : i / (n - 1)); };
    var y = function (v) { return T + (H - T - B) * (1 - (v - min) / (max - min)); };
    var svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label || 'Time series') + '">';
    for (var k = 0; k <= 4; k++) {
      var gv = min + (max - min) * k / 4, gy = y(gv);
      svg += '<line class="gl" x1="' + L + '" x2="' + (W - R) + '" y1="' + gy + '" y2="' + gy + '"/><text x="' + (L - 6) + '" y="' + (gy + 4) + '" text-anchor="end">' + Math.round(gv) + '</text>';
    }
    o.labels.forEach(function (lb, i) { svg += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(lb.replace('FY20', 'FY')) + '</text>'; });
    o.series.forEach(function (s, si) {
      var st = SERIES[si % SERIES.length], d = '';
      s.values.forEach(function (v, i) { if (v != null) d += (d ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); });
      svg += '<path d="' + d + '" fill="none" stroke="' + st.color + '" stroke-width="2" stroke-dasharray="' + st.dash + '" stroke-linejoin="round"/>';
      s.values.forEach(function (v, i) {
        if (v == null) return;
        svg += '<circle class="pt" cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="4" fill="#fff" stroke="' + st.color + '" stroke-width="2"><title>' + esc(s.name + ' · ' + o.labels[i] + ': ' + v) + '</title></circle>';
      });
    });
    svg += '</svg>';
    if (o.series.length > 1 || o.legend) {
      svg += '<div class="chart-legend">' + o.series.map(function (s, si) {
        var st = SERIES[si % SERIES.length];
        return '<span><i style="border-color:' + st.color + ';border-top-style:' + (st.dash ? 'dashed' : 'solid') + '"></i>' + esc(s.name) + '</span>';
      }).join('') + '</div>';
    }
    return svg;
  }
  function spark(values) {
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    if (max === min) max = min + 1;
    var d = values.map(function (v, i) {
      return (i ? 'L' : 'M') + (4 + 88 * i / (values.length - 1)).toFixed(1) + ' ' + (20 - 16 * (v - min) / (max - min)).toFixed(1);
    }).join('');
    return '<svg class="spark" viewBox="0 0 96 24" aria-hidden="true"><path d="' + d + '" fill="none" stroke="#0B3D91" stroke-width="1.5"/></svg>';
  }

  /* ── Overlay drawer + print ────────────────────────────────────── */
  var lastFocus = null;
  function openDrawer(title, bodyHtml, footHtml) {
    lastFocus = document.activeElement;
    $('tw-overlay').innerHTML =
      '<div class="ov" data-close="1"><div class="drawer" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
      '<div class="drawer-h"><h2>' + esc(title) + '</h2><div class="toolbar">' + (footHtml || '') +
      '<button class="btn" data-close="1" id="tw-drawer-close">Close</button></div></div>' +
      '<div class="drawer-b">' + bodyHtml + '</div></div></div>';
    $('tw-drawer-close').focus();
  }
  function closeDrawer() {
    if (!$('tw-overlay').firstChild) return;
    $('tw-overlay').innerHTML = '';
    if (route.query.doc) { delete route.query.doc; replaceQuery(route.query); }
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }
  function printDoc(html) {
    $('tw-print-root').innerHTML = html;
    document.body.classList.add('tw-printing');
    var done = function () { document.body.classList.remove('tw-printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
  }

  /* Company intelligence summary — used by the bank, insurance and investor views. */
  function summaryDoc(id, audience) {
    var c = D.company(id), s = D.score(id), a = D.score(id, 'assessed'), g = D.gaps(id), h = D.history(id);
    var purpose = {
      bank: 'Prepared as an input to corporate due diligence. It is not a credit rating, a credit score or a lending decision.',
      insurance: 'Prepared as an input to corporate screening. It is not an actuarial estimate or an underwriting decision.',
      investor: 'Prepared as an input to investment research. It is not investment advice or a recommendation.'
    }[audience] || '';
    var list = function (arr, none) { return arr.length ? '<ul>' + arr.map(function (it) { return '<li>' + esc(it.label) + '</li>'; }).join('') + '</ul>' : '<p>' + none + '</p>'; };
    return '<div class="doc"><div class="doc-flag">Demonstration summary · illustrative data · not an assessment of ' + esc(c.name) + '</div>' +
      '<h3>' + esc(c.name) + ' — Corporate sustainability intelligence summary</h3>' +
      '<p>' + esc(c.industry) + ' · ' + esc(c.city) + ', ' + esc(c.state) + ' · Data as of ' + D.meta.asOf + '</p><p>' + purpose + '</p>' +
      '<h4>Position</h4><table><tr><td>Public Data Score</td><td>' + s.overall + ' / 100 (' + s.band.grade + ', ' + s.band.label + ')</td></tr>' +
      '<tr><td>Data confidence</td><td>' + s.confidence.band + ' (' + s.confidence.value + ' / 100)</td></tr>' +
      '<tr><td>Company assessment</td><td>' + esc(c.asm.status) + (a.overall !== s.overall || a.confidence.value !== s.confidence.value ? ' · assessment-informed view ' + a.overall + ', confidence ' + a.confidence.value : '') + '</td></tr>' +
      '<tr><td>Score movement since ' + h[0].fy + '</td><td>' + signed(s.overall - h[0].score) + ' points</td></tr>' +
      '<tr><td>Net zero commitment</td><td>' + esc(c.netZero.target) + '</td></tr></table>' +
      '<h4>Dimension scores</h4><table>' + s.dims.map(function (d) {
        return '<tr><td>' + d.name + ' (weight ' + d.weight + '%)</td><td>' + (d.score == null ? 'Not scoreable — evidence not available' : d.score + ' / 100 · ' + d.scored + ' of ' + d.of + ' indicators evidenced') + '</td></tr>';
      }).join('') + '</table>' +
      '<h4>Adverse performance (evidenced)</h4>' + list(g.adverse, 'No evidenced indicator falls below the adverse threshold.') +
      '<h4>Insufficient evidence</h4>' + list(g.insufficient, 'None.') +
      '<h4>Not disclosed</h4>' + list(g.missing, 'None.') +
      '<p style="margin-top:24px">Indicators that are not disclosed or lack evidence are excluded from the score and reduce data confidence. They are not treated as poor performance.</p></div>';
  }
  function openSummary(id, audience) {
    var html = summaryDoc(id, audience);
    openDrawer('Company intelligence summary', html, '<button class="btn primary" id="tw-print">Print or save as PDF</button>');
    $('tw-print').addEventListener('click', function () { printDoc(html); });
  }

  /* ── Router ────────────────────────────────────────────────────── */
  function parse() {
    var h = location.hash.replace(/^#\/?/, ''), q = {}, qi = h.indexOf('?');
    if (qi !== -1) {
      h.slice(qi + 1).split('&').forEach(function (p) { var kv = p.split('='); if (kv[0]) q[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || ''); });
      h = h.slice(0, qi);
    }
    var parts = h.split('/');
    var id = views[parts[0]] ? parts[0] : 'dashboard';
    return { id: id, param: parts[1] || null, query: q };
  }
  function path(id, param, query) {
    var s = '#/' + id + (param ? '/' + param : ''), qs = [];
    Object.keys(query || {}).forEach(function (k) { if (query[k]) qs.push(encodeURIComponent(k) + '=' + encodeURIComponent(query[k])); });
    return s + (qs.length ? '?' + qs.join('&') : '');
  }
  function go(p) { location.hash = p.charAt(0) === '#' ? p : '#/' + p; }
  function replaceQuery(q) {                      // update the URL without adding a history entry
    route.query = q;
    history.replaceState(null, '', path(route.id, route.param, q));
  }
  function index(id) { for (var i = 0; i < MODULES.length; i++) if (MODULES[i].id === id) return i; return 0; }

  function render(keepScroll) {
    var view = $('tw-view'), top = keepScroll ? view.scrollTop : 0;
    var m = MODULES[index(route.id)];
    if (route.param && D.company(route.param)) state.company = route.param;
    state.ui[route.id] = state.ui[route.id] || {};

    var page = document.createElement('div');
    page.className = 'tw-page';
    view.innerHTML = '';
    view.appendChild(page);
    views[route.id]({ root: page, param: route.param, query: route.query, ui: state.ui[route.id],
                      rerender: function () { render(true); } });
    view.scrollTop = top;

    Array.prototype.forEach.call($('tw-nav').querySelectorAll('a'), function (a) {
      if (a.getAttribute('data-id') === route.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('tw-crumb').innerHTML = '<span class="pre">Climactix Terminal / </span><b>' + m.n + ' ' + esc(m.title) + '</b>';
    var i = index(route.id);
    $('tw-prev').disabled = i === 0;
    $('tw-next').disabled = i === MODULES.length - 1;
    $('tw-tour-mid').innerHTML = '<span class="tw-dots" aria-hidden="true">' + MODULES.map(function (_, k) { return '<i class="' + (k <= i ? 'on' : '') + '"></i>'; }).join('') + '</span>' +
      '<b>Step ' + (i + 1) + ' of ' + MODULES.length + '</b><span class="cap"> · ' + esc(m.cap) + '</span>';
    document.title = m.title + ' — Climactix Terminal walkthrough';
    $('tw-app').classList.remove('nav-open');
    $('tw-menu').setAttribute('aria-expanded', 'false');
  }

  function onRoute() {
    $('tw-overlay').innerHTML = '';
    route = parse();
    render(false);
    if (!location.hash) history.replaceState(null, '', '#/dashboard');
  }

  /* ── Shell wiring ──────────────────────────────────────────────── */
  function start() {
    $('tw-notice-txt').textContent = D.meta.notice;
    $('tw-nav').innerHTML = '<div class="tw-nav-label">Walkthrough</div>' + MODULES.map(function (m, i) {
      return (i === 5 ? '<div class="tw-nav-label">Institutional views</div>' : i === 9 ? '<div class="tw-nav-label">Commercial model</div>' : '') +
        '<a href="#/' + m.id + '" data-id="' + m.id + '"><span class="n">' + m.n + '</span>' + esc(m.title) + '</a>';
    }).join('');

    $('tw-prev').addEventListener('click', function () { var i = index(route.id); if (i > 0) go(MODULES[i - 1].id); });
    $('tw-next').addEventListener('click', function () { var i = index(route.id); if (i < MODULES.length - 1) go(MODULES[i + 1].id); });
    $('tw-menu').addEventListener('click', function () {
      var open = $('tw-app').classList.toggle('nav-open');
      this.setAttribute('aria-expanded', String(open));
    });
    $('tw-scrim').addEventListener('click', function () { $('tw-app').classList.remove('nav-open'); });

    // Global search
    var q = $('tw-q'), box = $('tw-results');
    function showResults() {
      var res = D.search(q.value);
      box.innerHTML = res.length ? res.map(function (c) {
        return '<button type="button" data-go="company/' + c.id + '"><span><b>' + esc(c.name) + '</b></span><small>' + esc(c.industry) + ' · ' + esc(c.city) + (c.synthetic ? ' · synthetic' : '') + '</small></button>';
      }).join('') : '<div class="none">No company in the demonstration dataset matches “' + esc(q.value) + '”.</div>';
      box.hidden = false;
    }
    q.addEventListener('input', showResults);
    q.addEventListener('focus', showResults);
    q.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { box.hidden = true; q.blur(); }
      if (e.key === 'Enter') { var r = D.search(q.value); if (r.length) { box.hidden = true; q.value = ''; go('company/' + r[0].id); } }
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.tw-search')) box.hidden = true;
      var g = e.target.closest('[data-go]');
      if (g) { e.preventDefault(); box.hidden = true; q.value = ''; go(g.getAttribute('data-go')); return; }
      var s = e.target.closest('[data-summary]');
      if (s) { openSummary(s.getAttribute('data-summary'), s.getAttribute('data-audience')); return; }
      if (e.target.getAttribute && e.target.getAttribute('data-close')) closeDrawer();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

    window.addEventListener('hashchange', onRoute);
    onRoute();
  }

  return {
    D: D, modules: MODULES, state: state,
    view: function (id, fn) { views[id] = fn; },
    start: start, go: go, path: path, replaceQuery: replaceQuery,
    esc: esc, fmt: fmt, signed: signed,
    demoTag: demoTag, entityTag: entityTag, grade: grade, meter: meter, stateChip: stateChip, confChip: confChip,
    coCell: coCell, companyOptions: companyOptions, pageHead: pageHead,
    riskIndicators: riskIndicators, riskChips: riskChips,
    lineChart: lineChart, spark: spark,
    openDrawer: openDrawer, closeDrawer: closeDrawer, printDoc: printDoc, openSummary: openSummary
  };
})();
