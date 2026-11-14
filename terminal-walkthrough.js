/* ════════════════════════════════════════════════════════════════════
   CLIMACTIX TERMINAL — LIVE WALKTHROUGH · CORE
   Shell, hash router, motion, shared components and SVG charts.
   Module views register themselves through CXT.view(id, fn) from
   terminal-walkthrough-modules.js and terminal-walkthrough-audiences.js.
   All data comes from window.CX_TERMINAL_DEMO (terminal-demo-data.js).

   Render modes
     route  a different view: view transition, cascade reveal, counters
     soft   same view, new filters: only table rows re-enter
     keep   in-place update after an interaction: no motion, scroll kept
   ════════════════════════════════════════════════════════════════════ */
window.CXT = (function () {
  'use strict';
  var D = window.CX_TERMINAL_DEMO;

  var I = function (d) { return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
  var ICON = {
    dashboard: I('<rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>'),
    company: I('<path d="M3 14V3h7v11M10 7h3v7M2 14h12M5.5 5.5h2M5.5 8h2M5.5 10.5h2"/>'),
    score: I('<path d="M2.5 11a5.5 5.5 0 1 1 11 0"/><path d="M8 11l2.5-4"/>'),
    reports: I('<path d="M4 2h5l3 3v9H4z"/><path d="M9 2v3h3M6 8h4M6 10.5h4"/>'),
    assessment: I('<rect x="3" y="3" width="10" height="11" rx="1"/><path d="M6 3V2h4v1M5.5 9l1.7 1.7L10.5 7.5"/>'),
    bank: I('<path d="M2 6l6-3.5L14 6M3 6v6M6.3 6v6M9.7 6v6M13 6v6M2 13.5h12"/>'),
    insurance: I('<path d="M8 2l5 2v4c0 3-2.2 5-5 6-2.8-1-5-3-5-6V4z"/>'),
    investor: I('<path d="M2 13h12M3 10l3-3 2.5 2L13 4"/><path d="M10.5 4H13v2.5"/>'),
    government: I('<path d="M8 14s4.5-4 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 10 8 14 8 14z"/><circle cx="8" cy="6.5" r="1.6"/>'),
    impact: I('<circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="3"/><path d="M8 8l4.5-4.5M12.5 3.5h-2M12.5 3.5v2"/>'),
    plans: I('<path d="M2 8.5V3h5.5L14 9.5 9.5 14z"/><circle cx="5" cy="6" r="0.9"/>'),
    sun: I('<circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"/>'),
    moon: I('<path d="M13 9.5A5.5 5.5 0 0 1 6.5 3 5.5 5.5 0 1 0 13 9.5z"/>')
  };

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
    { id: 'impact', n: '10', title: 'Sustainability Impact', cap: 'What the research says about targets and climate action, and how companies are progressing.' },
    { id: 'plans', n: '11', title: 'Access and Plans', cap: 'Complimentary institutional pilots and company subscriptions.' }
  ];

  var views = {};
  var state = { company: 'tata-motors', ui: {} };
  var route = { id: 'dashboard', param: null, query: {} }, prevRoute = null;
  var $ = function (id) { return document.getElementById(id); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Formatting helpers ────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function signed(n) { return (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n); }
  /* tone = meaning: emerald positive, blue evidenced/moderate, red significant risk */
  function tone(v) { return v == null ? 'na' : v >= 65 ? 'pos' : v >= 40 ? 'acc' : 'crit'; }

  /* ── Shared components (HTML strings) ──────────────────────────── */
  function demoTag(text) { return '<span class="chip demo">' + esc(text || 'Demo') + '</span>'; }
  function entityTag(c) {
    return c.synthetic ? '<span class="chip demo" data-tip="This entity was invented for the demonstration.">Synthetic entity</span>'
                       : '<span class="chip demo" data-tip="A recognisable company name shown with illustrative values. Not an assessment of the company.">Demo profile</span>';
  }
  function grade(band) { return '<span class="grade" data-tip="Rating grade ' + esc(band.grade) + ': ' + esc(band.label) + '. Grades run from AAA (85 and above) to CCC (below 35).">' + esc(band.grade) + '</span>'; }
  function count(v, dec) { return '<span data-count="' + v + '" data-dec="' + (dec || 0) + '">' + (dec ? Number(v).toFixed(dec) : fmt(v)) + '</span>'; }
  function term(label, tip) { return '<span class="term" tabindex="0" data-tip="' + esc(tip) + '">' + esc(label) + '</span>'; }
  function meter(v, cls) {
    if (v == null) return '<div class="meter"><div class="meter-t na" data-tip="Not scoreable from the evidence available. Not counted as zero."></div><span class="meter-v muted">—</span></div>';
    return '<div class="meter"><div class="meter-t"><div class="meter-f ' + (cls == null ? tone(v) : cls) + '" style="width:' + Math.max(0, Math.min(100, v)) + '%"></div></div><span class="meter-v num">' + v + '</span></div>';
  }
  function stateChip(it) {
    if (it.state === 'missing') return '<span class="chip dot" data-tip="No public disclosure located. Excluded from the score and not counted as poor performance.">Not disclosed</span>';
    if (it.state === 'insufficient') return '<span class="chip dot warn" data-tip="A claim was located but could not be traced to evidence. Excluded from the score until evidence is available.">Insufficient evidence</span>';
    if (it.adverse) return '<span class="chip dot crit" data-tip="Evidenced, and scored below ' + D.adverseBelow + '. This is the only state that lowers the score as poor performance.">Adverse performance</span>';
    if (it.value >= 65) return '<span class="chip dot ok" data-tip="Disclosed with traceable evidence, and scored 65 or above.">Evidenced · strong</span>';
    return '<span class="chip dot acc" data-tip="Disclosed with traceable evidence, and scored between ' + D.adverseBelow + ' and 64.">Evidenced</span>';
  }
  function confChip(conf) {
    var cls = conf.band === 'High' ? 'acc' : conf.band === 'Moderate' ? 'warn' : '';
    return '<span class="chip dot ' + cls + '" data-tip="Data confidence ' + conf.value + ' of 100. How complete, traceable and assured the evidence behind the score is. It is reported separately from the score.">' + conf.band + ' · ' + conf.value + '</span>';
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
  var PHOTO = { bank: 'banker', insurance: 'engineers', investor: 'analyst', government: 'skyline' };
  function idStrip(icon, role, points) {
    return '<section class="panel idstrip"><img class="ph" src="terminal-film-assets/' + PHOTO[icon] + '.jpg" alt="" loading="lazy"><div><b>' + esc(role) + '</b><ul>' +
      points.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div></section>';
  }

  /* One cited external finding, shown in context inside an institutional view. */
  function research(id, lead) {
    var R = window.CX_IMPACT, f = R && R.finding(id);
    if (!f) return '';
    return '<div class="callout plain" style="margin-bottom:16px"><b>Research context.</b> ' + esc(lead) + ' <span class="muted">' + esc(f.studyCite) + ', cited in ' + esc(R.source.cite) + ', p. ' + f.page + '. External research, not a Climactix finding.</span> <button class="linkbtn" data-go="impact/evidence?f=' + id + '">Open the evidence</button></div>';
  }

  /* Plain-language reading of a score, for a non-technical decision-maker. */
  var BAND_TEXT = {
    AAA: 'Leading. Consistently strong performance across the five dimensions, backed by evidence.',
    AA: 'Advanced. Strong performance in most dimensions, with a few areas still developing.',
    A: 'Strong. Solid evidenced performance, with identifiable areas to improve.',
    BBB: 'Established. Sound foundations, but results are uneven across dimensions.',
    BB: 'Developing. Mixed results, with visible gaps in performance or disclosure.',
    B: 'Limited. Weak evidenced performance in several dimensions.',
    CCC: 'Weak. Evidenced performance is poor across most of what could be assessed.',
    NR: 'Not rated. Too little evidence is available to produce a score.'
  };
  var CONF_TEXT = {
    High: 'The evidence base is broad and traceable, so the score is well supported.',
    Moderate: 'Some indicators lack evidence. Read the score together with its disclosure gaps.',
    Low: 'Much is undisclosed. The score reflects only what could be evidenced and should be read with caution.'
  };
  function explain(s) { return BAND_TEXT[s.band.grade] + ' ' + CONF_TEXT[s.confidence.band]; }

  /* Radial score gauge: a 270° arc, so the reader sees position on the 0–100 scale at a glance. */
  function gauge(v, o) {
    o = o || {};
    var s = o.size || 200, sw = o.stroke || Math.round(s * 0.07), r = (s - sw) / 2, c = s / 2, C = 2 * Math.PI * r, len = C * 0.75;
    var ticks = '';
    if (o.ticks) D.bands.forEach(function (b) {
      if (!b.min) return;
      var a = (135 + 270 * b.min / 100) * Math.PI / 180;
      ticks += '<line class="tick" x1="' + (c + (r - sw / 2) * Math.cos(a)).toFixed(1) + '" y1="' + (c + (r - sw / 2) * Math.sin(a)).toFixed(1) + '" x2="' + (c + (r + sw / 2) * Math.cos(a)).toFixed(1) + '" y2="' + (c + (r + sw / 2) * Math.sin(a)).toFixed(1) + '"/>';
    });
    return '<div class="gauge ' + tone(v) + '" role="img" aria-label="Score ' + (v == null ? 'not available' : v + ' out of 100') + '"><svg width="' + s + '" height="' + s + '" viewBox="0 0 ' + s + ' ' + s + '">' +
      '<circle class="trk" cx="' + c + '" cy="' + c + '" r="' + r + '" stroke-width="' + sw + '" stroke-dasharray="' + len.toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(135 ' + c + ' ' + c + ')"/>' +
      '<circle class="arc" cx="' + c + '" cy="' + c + '" r="' + r + '" stroke-width="' + sw + '" style="--len:' + len.toFixed(1) + ';--off:' + (len * (1 - (v || 0) / 100)).toFixed(1) + '" transform="rotate(135 ' + c + ' ' + c + ')"/>' + ticks + '</svg>' +
      '<div class="gauge-c"><b style="font-size:' + Math.round(s * (o.big || 0.3)) + 'px">' + (v == null ? '—' : count(v)) + '</b>' + (o.sub === false ? '' : '<small>' + (o.sub || 'out of 100') + '</small>') + (o.band ? grade(o.band) : '') + '</div></div>';
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
    var shown = r.slice(0, max || r.length).map(function (x) { return '<span class="chip dot ' + x.level + '">' + esc(x.text) + '</span>'; }).join(' ');
    return shown + (max && r.length > max ? ' <span class="muted">+' + (r.length - max) + '</span>' : '');
  }

  /* ── SVG charts (colours come from CSS classes s0–s3) ──────────── */
  function lineChart(o) {
    var W = 640, H = o.h || 220, L = 40, R = 16, T = 12, B = 30;
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
      svg += '<line class="gl" x1="' + L + '" x2="' + (W - R) + '" y1="' + gy + '" y2="' + gy + '"/><text x="' + (L - 8) + '" y="' + (gy + 4) + '" text-anchor="end">' + Math.round(gv) + '</text>';
    }
    o.labels.forEach(function (lb, i) { svg += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(lb.replace('FY20', 'FY')) + '</text>'; });
    o.series.forEach(function (s, si) {
      var d = '';
      s.values.forEach(function (v, i) { if (v != null) d += (d ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); });
      svg += '<path class="ln s' + (si % 4) + '" pathLength="1" d="' + d + '"/>';
      s.values.forEach(function (v, i) {
        if (v == null) return;
        svg += '<circle class="pt s' + (si % 4) + '" style="--k:' + i + '" cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="4" data-tip="' + esc(s.name + ' · ' + o.labels[i] + ': ' + v) + '"/>';
      });
    });
    svg += '</svg>';
    if (o.series.length > 1 || o.legend) {
      svg += '<div class="chart-legend">' + o.series.map(function (s, si) { return '<span><i class="s' + (si % 4) + '"></i>' + esc(s.name) + '</span>'; }).join('') + '</div>';
    }
    return svg;
  }
  function spark(values) {
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    if (max === min) max = min + 1;
    var d = values.map(function (v, i) {
      return (i ? 'L' : 'M') + (4 + 88 * i / (values.length - 1)).toFixed(1) + ' ' + (20 - 16 * (v - min) / (max - min)).toFixed(1);
    }).join('');
    return '<svg class="spark" viewBox="0 0 96 24" aria-hidden="true"><path d="' + d + '"/></svg>';
  }

  /* ── Overlay drawer + print ────────────────────────────────────── */
  var lastFocus = null;
  function openDrawer(title, bodyHtml, footHtml) {
    if (!$('tw-overlay').firstChild) lastFocus = document.activeElement;
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
      '<h4>Reading</h4><p>' + esc(explain(s)) + '</p>' +
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

  /* ── Motion helpers ────────────────────────────────────────────── */
  function runCounters(root) {
    var els = root.querySelectorAll('[data-count]');
    if (!els.length || reduced) return;
    var items = Array.prototype.map.call(els, function (e) { return { e: e, v: +e.getAttribute('data-count'), d: +e.getAttribute('data-dec') }; });
    var t0 = performance.now(), dur = 820;
    items.forEach(function (it) { it.e.textContent = it.d ? (0).toFixed(it.d) : '0'; });
    (function step(now) {
      var p = Math.min(1, (now - t0) / dur), q = 1 - Math.pow(1 - p, 3);
      items.forEach(function (it) { it.e.textContent = it.d ? (it.v * q).toFixed(it.d) : fmt(Math.round(it.v * q)); });
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  function stagger(page) {
    var i = 0;
    Array.prototype.forEach.call(page.children, function (el) {
      var kids = el.classList.contains('grid') || el.classList.contains('dimstrip') || el.classList.contains('tri') || el.classList.contains('plans') ? el.children : [el];
      Array.prototype.forEach.call(kids, function (k) { k.setAttribute('data-r', ''); k.style.setProperty('--i', Math.min(i++, 12)); });
    });
    Array.prototype.forEach.call(page.querySelectorAll('.heat tbody tr, .avail tbody tr'), function (tr, r) {
      Array.prototype.forEach.call(tr.querySelectorAll('td.h, .dot'), function (cell, c) { cell.style.setProperty('--k', Math.min(r + c, 24)); });
    });
    Array.prototype.forEach.call(page.querySelectorAll('tbody'), function (tb) {
      Array.prototype.forEach.call(tb.children, function (tr, r) { tr.style.setProperty('--k', Math.min(r, 18)); });
    });
  }

  /* ── Tooltips: one floating element for every [data-tip] ───────── */
  var tip = null, tipFor = null;
  function showTip(el) {
    if (!tip) { tip = document.createElement('div'); tip.className = 'tw-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
    tipFor = el; tip.textContent = el.getAttribute('data-tip');
    var r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    var x = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    var y = r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8;
    tip.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
    tip.classList.add('on');
  }
  function hideTip() { if (tip) tip.classList.remove('on'); tipFor = null; }

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

  function render(mode) {
    var view = $('tw-view'), top = mode === 'route' ? 0 : view.scrollTop;
    var m = MODULES[index(route.id)];
    if (route.param && D.company(route.param)) state.company = route.param;
    state.ui[route.id] = state.ui[route.id] || {};
    hideTip();

    var page = document.createElement('div');
    page.className = 'tw-page' + (mode === 'route' ? ' anim' : mode === 'soft' ? ' soft' : '');
    view.innerHTML = '';
    view.appendChild(page);
    views[route.id]({ root: page, param: route.param, query: route.query, ui: state.ui[route.id],
                      rerender: function () { render('keep'); } });
    view.scrollTop = top;
    if (mode !== 'keep') stagger(page);
    if (mode === 'route') runCounters(page);
    if (window.CXExplainer) window.CXExplainer.mount(page);

    var cur = null;
    Array.prototype.forEach.call($('tw-nav').querySelectorAll('a'), function (a) {
      if (a.getAttribute('data-id') === route.id) { a.setAttribute('aria-current', 'page'); cur = a; } else a.removeAttribute('aria-current');
    });
    if (cur) $('tw-nav-ind').style.transform = 'translateY(' + cur.offsetTop + 'px)';
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
    var mode = prevRoute && prevRoute.id === route.id && prevRoute.param === route.param ? 'soft' : 'route';
    prevRoute = { id: route.id, param: route.param };
    if (mode === 'route') {
      var bar = $('tw-load'); bar.classList.remove('on'); void bar.offsetWidth; bar.classList.add('on');
    }
    if (mode === 'route' && document.startViewTransition && !reduced) {
      try {
        var vt = document.startViewTransition(function () { render('route'); });
        vt.ready.catch(function () {}); vt.finished.catch(function () {});
      } catch (e) { render('route'); }
    } else render(mode);
    if (!location.hash) history.replaceState(null, '', '#/dashboard');
  }

  /* ── Shell wiring ──────────────────────────────────────────────── */
  function setTheme(t) {
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light'); else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('cx-terminal-theme', t); } catch (e) {}
    var b = $('tw-theme');
    b.innerHTML = t === 'light' ? ICON.moon : ICON.sun;
    b.setAttribute('aria-label', t === 'light' ? 'Switch to the dark theme' : 'Switch to the light theme');
  }

  function start() {
    $('tw-notice-txt').textContent = D.meta.notice;
    $('tw-nav').innerHTML = '<div class="tw-nav-ind" id="tw-nav-ind"></div><div class="tw-nav-label">Walkthrough</div>' + MODULES.map(function (m, i) {
      return (i === 5 ? '<div class="tw-nav-label">Institutional views</div>' : i === 9 ? '<div class="tw-nav-label">Research and evidence</div>' : i === 10 ? '<div class="tw-nav-label">Commercial model</div>' : '') +
        '<a href="#/' + m.id + '" data-id="' + m.id + '">' + ICON[m.id] + m.title + '<span class="n">' + m.n + '</span></a>';
    }).join('');
    setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
    $('tw-theme').addEventListener('click', function () { setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light'); });

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
      if (g) {
        e.preventDefault(); box.hidden = true; q.value = '';
        var dest = g.getAttribute('data-go');
        /* carry the company name across the transition into its profile */
        if (dest.indexOf('company/') === 0 && !document.querySelector('.vt-co')) { var nm = g.querySelector('.co, b'); if (nm) nm.classList.add('vt-co'); }
        go(dest); return;
      }
      var s = e.target.closest('[data-summary]');
      if (s) { openSummary(s.getAttribute('data-summary'), s.getAttribute('data-audience')); return; }
      if (e.target.getAttribute && e.target.getAttribute('data-close')) closeDrawer();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeDrawer(); hideTip(); } });
    document.addEventListener('mouseover', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t) { if (t !== tipFor) showTip(t); } else if (tipFor) hideTip(); });
    document.addEventListener('focusin', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t) showTip(t); });
    document.addEventListener('focusout', hideTip);
    $('tw-view').addEventListener('scroll', hideTip, { passive: true });

    window.addEventListener('hashchange', onRoute);
    onRoute();
  }

  return {
    D: D, modules: MODULES, state: state, icon: ICON,
    view: function (id, fn) { views[id] = fn; },
    start: start, go: go, path: path, replaceQuery: replaceQuery,
    esc: esc, fmt: fmt, signed: signed, tone: tone, count: count, term: term, explain: explain,
    demoTag: demoTag, entityTag: entityTag, grade: grade, meter: meter, stateChip: stateChip, confChip: confChip,
    coCell: coCell, companyOptions: companyOptions, pageHead: pageHead, idStrip: idStrip, gauge: gauge, research: research,
    riskIndicators: riskIndicators, riskChips: riskChips,
    lineChart: lineChart, spark: spark,
    openDrawer: openDrawer, closeDrawer: closeDrawer, printDoc: printDoc, openSummary: openSummary
  };
})();
