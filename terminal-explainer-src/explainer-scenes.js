/* ════════════════════════════════════════════════════════════════════
   HOW THE TERMINAL WORKS — EXPLAINER COMPOSITION (48 s, seamless loop)
   Six scenes, each a pure function of time:
     1  0–8   Fragmented information   documents spread across sources
     2  8–16  Centralised intelligence extraction into structured data points
     3 16–24  Assessment               twenty indicators across five dimensions
     4 24–31  Intelligence Score       weighted ring, counter, data confidence
     5 31–41  Institutional decisions  four institutions, footage and their view
     6 41–48  Business impact          three outcomes, brand lock-up, back to ivory
   Frame 0 and frame 48 are the same empty ivory stage, so the video loops.
   window.EX = { dur, seek(t), settle(), renderAudio() } drives the export.
   Figures come from the demonstration dataset (terminal-demo-data.js).
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DUR = 48, A = '../terminal-film-assets/';
  var D = window.CX_TERMINAL_DEMO, CID = 'corvane', sc = D.score(CID);
  var stage = document.getElementById('stage'), g = document.getElementById('bg').getContext('2d');

  /* ── helpers ── */
  var u = {
    seg: function (t, a, b) { var x = (t - a) / (b - a); return x < 0 ? 0 : x > 1 ? 1 : x; },
    lerp: function (a, b, p) { return a + (b - a) * p; },
    eio: function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
    eo: function (x) { return 1 - Math.pow(1 - x, 3); }
  };
  function el(p, cls, html, cssText) { var e = document.createElement('div'); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (cssText) e.style.cssText = cssText; p.appendChild(e); return e; }
  function st(e, op, tr) {
    if (op !== undefined) { op = op < 0.004 ? 0 : op > 0.996 ? 1 : Math.round(op * 1000) / 1000; if (e._o !== op) { e._o = op; e.style.opacity = op; e.style.visibility = op === 0 ? 'hidden' : 'visible'; } }
    if (tr !== undefined && e._t !== tr) { e._t = tr; e.style.transform = tr; }
  }
  function tx(e, s) { if (e._x !== s) { e._x = s; e.textContent = s; } }
  function css(e, p, v) { var k = '_c' + p; if (e[k] !== v) { e[k] = v; e.style[p] = v; } }
  function cl(e, c) { if (e._k !== c) { e._k = c; e.className = c; } }
  function rise(e, p, d) { st(e, p, 'translate3d(0,' + ((1 - u.eo(p)) * (d == null ? 18 : d)).toFixed(2) + 'px,0)'); }
  function attr(e, k, v) { var c = '_a' + k; if (e[c] !== v) { e[c] = v; e.setAttribute(k, v); } }

  var vids = [];
  function video(parent, name, extra) {
    var v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = A + name + '.mp4'; v.className = 'vid' + (extra ? ' ' + extra : '');
    parent.appendChild(v);
    var o = { v: v, req: null }; vids.push(o); return o;
  }
  var scenes = [];
  function scene(a, b, build, frame) { var s = { a: a, b: b, root: el(stage, 'sc'), frame: frame, _on: null }; build(s); scenes.push(s); }
  var ind = function (id, iid) { var r = null; D.score(id).dims.forEach(function (d) { d.indicators.forEach(function (it) { if (it.id === iid) r = it; }); }); return r; };
  var tone = function (it) { return it.state === 'missing' ? 'nd' : it.state === 'insufficient' ? 'ie' : it.adverse ? 'adv' : it.value >= 65 ? 'ok' : 'mid'; };

  /* ── SCENE 1 · Fragmented information ─────────────────────────── */
  var LINES = '<u></u><u></u><u></u><u></u>';
  var BODY = '<u></u><u></u><u></u><u></u><u></u><u></u><u></u><u></u>';
  function docHTML(k) {
    if (k === 0) return '<div class="pg pg-cover"><img src="' + A + 'port.jpg" alt=""><div class="cvt"><small>Corvane Pharma</small><b>Sustainability Report</b><span>FY2025-26</span></div></div>';
    if (k === 1) return '<div class="pg"><div class="pgh navy">BRSR · FY2025-26</div><b class="pgt">Section C · Principle 6</b><span class="pgs">Essential indicators</span>' +
      [['Scope 1 emissions', '96,240'], ['Scope 2 emissions', '1,17,450'], ['Renewable share', '38%'], ['Water withdrawal', '12,14,500'], ['Waste diverted', '74%'], ['Hazardous waste', '1,840'], ['Energy intensity', '0.41']].map(function (r) { return '<div class="pr"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join('') + BODY + '</div>';
    if (k === 2) return '<div class="pg"><div class="pgh green">Net Zero Transition Plan</div><b class="pgt">Pathway to 2045</b><span class="pgs">Scopes 1, 2 and 3</span>' +
      '<svg width="244" height="130" viewBox="0 0 244 130"><line x1="0" y1="124" x2="244" y2="124" stroke="#E3E7ED"/><path d="M6 20 L80 46 L150 82 L238 116" fill="none" stroke="#7A8799" stroke-width="2" stroke-dasharray="5 4"/><path d="M6 20 L30 27 L55 34 L80 40" fill="none" stroke="#0E9F6E" stroke-width="3"/><circle cx="80" cy="40" r="4" fill="#0E9F6E"/></svg>' + BODY + '</div>';
    if (k === 3) return '<div class="pg"><div class="pgh">Annual Report 2025-26</div><b class="pgt">Financial statements</b><span class="pgs">Standalone · ₹ crore</span>' +
      [['Revenue from operations', '6,104', '5,712'], ['Cost of materials', '2,318', '2,201'], ['Employee costs', '1,046', '968'], ['EBITDA', '1,402', '1,251'], ['Profit after tax', '842', '733'], ['Capital expenditure', '512', '466']].map(function (r) { return '<div class="pr"><span>' + r[0] + '</span><b>' + r[1] + '</b><b style="color:#98A3B3">' + r[2] + '</b></div>'; }).join('') + '</div>';
    if (k === 4) return '<div class="pg"><div class="pgh blue">Climate Report · TCFD</div><b class="pgt">Climate-related disclosures</b><span class="pgs">Prepared against TCFD and IFRS S2</span><div class="q4"><i>Governance</i><i>Strategy</i><i>Risk management</i><i>Metrics and targets</i></div>' + BODY + '</div>';
    return '<div class="pg"><div class="pgh">ESG Data Sheet</div><b class="pgt">Performance data</b><span class="pgs">Investor relations page</span><div class="xl">' +
      ['Metric', 'FY24', 'FY25', 'FY26', 'Women in workforce', '27%', '28%', '30%', 'Injury rate', '0.31', '0.27', '0.21', 'Training hours', '18', '21', '24', 'Board independence', '50%', '55%', '55%', 'Water recycled', '22%', '26%', '31%'].map(function (c, i) { return '<i' + (i < 4 || i % 4 === 0 ? ' class="h"' : '') + '>' + c + '</i>'; }).join('') + '</div>' + BODY + '</div>';
  }
  var DOCNAME = ['Sustainability report', 'BRSR disclosure', 'Net zero transition plan', 'Annual report', 'Climate report', 'ESG data sheet'];
  var DOCSRC = ['Company website · PDF', 'Stock exchange filing', 'Press release', 'Annual report · 312 pages', 'Separate publication', 'Investor relations page'];
  var POS = [[96, 292, -4, 1.06], [382, 326, 3, 1.02], [668, 282, -2, 1.08], [954, 332, 4, 1.04], [1240, 292, -3, 1.06], [1526, 322, 2, 1.02]];
  var QT = 250, QROW = function (i) { return QT + 56 + i * 104; };
  scene(0, 8.65, function (s) {
    s.docs = POS.map(function (p, i) { var d = el(s.root, '', docHTML(i)).firstChild; s.root.appendChild(d); d.style.zIndex = 10 + i; return d; });
    s.srcs = DOCSRC.map(function (n) { return el(s.root, 'src', n); });
    var pr = el(s.root, 'pills');
    s.pills = ['Different formats', 'Different reporting years', 'Different definitions', 'Gaps no one has flagged'].map(function (n) { return el(pr, 'pill', n); });
      }, function (t, s) {
    var cam = 1 + 0.035 * u.seg(t, 0, 7);
    for (var i = 0; i < 6; i++) {
      var p = POS[i], ap = u.seg(t, 0.35 + i * 0.32, 0.95 + i * 0.32), f = u.eio(u.seg(t, 6.9 + i * 0.08, 8.2 + i * 0.08));
      var x0 = 960 + (p[0] - 960) * cam, y0 = 560 + (p[1] - 560) * cam + Math.sin(t * 0.7 + i * 1.3) * 6 + (1 - u.eo(ap)) * 34, sc0 = p[3] * cam;
      var x = u.lerp(x0, 114, f), y = u.lerp(y0, QROW(i) + 12, f), r = p[2] * (1 - f), k = u.lerp(sc0, 0.2, f);
      st(s.docs[i], ap, 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) rotate(' + r.toFixed(2) + 'deg) scale(' + k.toFixed(4) + ')');
      st(s.srcs[i], ap * (1 - u.seg(t, 6.4, 6.9)), 'translate3d(' + (x0 + 6).toFixed(1) + 'px,' + (y0 + 396 * sc0 + 22).toFixed(1) + 'px,0)');
    }
    for (var k2 = 0; k2 < s.pills.length; k2++) rise(s.pills[k2], u.seg(t, 3.4 + k2 * 0.45, 4.0 + k2 * 0.45) * (1 - u.seg(t, 6.4, 6.9)), 14);
  });

  /* ── SCENE 2 · Centralised intelligence ───────────────────────── */
  var DOCROWS = [['Total Scope 1 emissions (tCO₂e)', '96,240', '1,01,060'], ['Total Scope 2 emissions (tCO₂e)', '1,17,450', '1,27,300'], ['Renewable share of electricity', '38%', '33%'],
                 ['Total water withdrawal (kL)', '12,14,500', '12,48,200'], ['Waste diverted from disposal', '74%', '71%'], ['Hazardous waste generated (t)', '1,840', '1,910']];
  var XROWS = [['Scope 1 emissions', 'Environmental', '96,240 tCO₂e', 'BRSR · p. 42', 'ok', 1, '96,240'], ['Scope 2 emissions', 'Environmental', '117,450 tCO₂e', 'BRSR · p. 42', 'ok', 1, '1,17,450'],
               ['Renewable electricity', 'Environmental', '38%', 'BRSR · p. 42', 'ok', 1, '38%'], ['Water withdrawal', 'Environmental', '1.21 million kL', 'BRSR · p. 42', 'ok', 1, '12,14,500'],
               ['Waste diverted', 'Environmental', '74%', 'BRSR · p. 42', 'ok', 1, '74%'], ['Board sustainability committee', 'Governance', 'Yes, quarterly', 'Annual report · p. 118', 'ok', 3, 'Committee'],
               ['Net zero target', 'Climate strategy', '2045, Scopes 1–3', 'Net zero plan · p. 6', 'ok', 2, '2045'], ['Scope 3 categories', 'Climate strategy', 'Claimed, not itemised', 'Climate report · p. 14', 'ie', 4, 'Scope 3']];
  var XT = 250, XL = 1046, xrowY = function (i) { return XT + 96 + i * 66; };
  var flightAt = function (i) { return i < 5 ? 9.45 + i * 0.6 : 12.6 + (i - 5) * 0.55; };
  scene(7.6, 16.6, function (s) {
    var q = el(s.root, 'pn', '<div class="pnh">Intake<span>6 documents</span></div>', 'left:96px;top:' + QT + 'px;width:330px;height:680px');
    s.q = q;
    s.rows = DOCNAME.map(function (n, i) {
      var r = el(q, 'qr', '<div class="th">' + docHTML(i) + '</div><b>' + n + '</b><small>' + DOCSRC[i] + '</small><span class="qs">Queued</span>', 'top:' + (56 + i * 104) + 'px');
      return { e: r, th: r.querySelector('.th'), s: r.querySelector('.qs') };
    });
    var bp = el(s.root, 'bp', '<div class="pgh navy">Business Responsibility and Sustainability Report · FY2025-26</div><div class="t">Principle 6 · Environment</div><div class="s">Essential indicators · Corvane Pharma</div>' +
      '<div class="hd"><span style="text-align:left">Indicator</span><span>FY2025-26</span><span>FY2024-25</span></div>' +
      DOCROWS.map(function (r, i) { return '<div class="rw" style="top:' + (180 + i * 70) + 'px"><span>' + r[0] + '</span><b>' + r[1] + '</b><i>' + r[2] + '</i></div>'; }).join('') + '<div class="pgno">p. 42</div>');
    s.bp = bp; s.scan = el(bp, 'scan');
    s.hls = [0, 1, 2, 3, 4].map(function (i) { return el(bp, 'hl', '', 'left:306px;top:' + (180 + i * 70 + 12) + 'px;width:122px;height:46px'); });
    var xt = el(s.root, 'pn xt', '<div class="pnh">Structured data points<span>Demonstration data</span></div><div class="ch"><span style="left:22px">Metric</span><span style="left:300px">Value</span><span style="left:505px">Source</span><span style="left:660px">Status</span></div>', 'left:' + XL + 'px;top:' + XT + 'px;width:778px;height:680px');
    s.xt = xt;
    s.xr = XROWS.map(function (r, i) {
      var e = el(xt, 'xr', '<span class="m">' + r[0] + '</span><span class="d">' + r[1] + '</span><span class="sk"></span><span class="v">' + r[2] + '</span><span class="so">' + r[3] + '</span><span class="stt ' + r[4] + '">' + (r[4] === 'ok' ? 'Evidenced' : 'Insufficient evidence') + '</span>', 'top:' + (96 + i * 66) + 'px');
      return { m: e.querySelector('.m'), d: e.querySelector('.d'), v: e.querySelector('.v'), so: e.querySelector('.so'), stt: e.querySelector('.stt'), sk: e.querySelector('.sk') };
    });
    s.sum = el(xt, 'xsum', '8 data points · 7 evidenced · 1 with insufficient evidence · every value linked to its page');
    s.flies = XROWS.map(function (r) { return el(s.root, 'fly', r[6]); });
    for (var i = 0; i < 8; i++) s.flies[i].style.display = '';
  }, function (t, s) {
    var out = 1 - u.seg(t, 15.6, 16.4), i;
    st(s.root, out);
    rise(s.q, u.seg(t, 7.6, 8.3), 10);
    for (i = 0; i < 6; i++) {
      st(s.rows[i].th, t >= 8.2 + i * 0.08 ? 1 : 0);
      var active = i === 1 ? t >= 8.8 && t < 12.4 : false, src = -1;
      for (var k = 5; k < 8; k++) if (XROWS[k][5] === i && t >= flightAt(k) - 0.4 && t < flightAt(k) + 0.6) src = k;
      var done = i === 1 ? t >= 12.4 : i === 0 ? t >= 13.9 : i === 5 ? t >= 14.2 : (function () { for (var k3 = 5; k3 < 8; k3++) if (XROWS[k3][5] === i) return t >= flightAt(k3) + 0.6; return false; })();
      var state = active || src >= 0 ? 'on' : done ? 'ok' : '';
      cl(s.rows[i].e, 'qr' + (active || src >= 0 ? ' act' : ''));
      cl(s.rows[i].s, 'qs' + (state ? ' ' + state : ''));
      tx(s.rows[i].s, state === 'on' ? 'Extracting' : state === 'ok' ? 'Indexed' : 'Queued');
    }
    st(s.bp, u.seg(t, 8.4, 9.0), 'translate3d(' + ((1 - u.eo(u.seg(t, 8.4, 9.1))) * 40).toFixed(1) + 'px,0,0)');
    var sp = u.seg(t, 9.1, 12.3);
    st(s.scan, Math.sin(sp * Math.PI) * 0.9, 'translate3d(0,' + (170 + sp * 430).toFixed(1) + 'px,0)');
    for (i = 0; i < 5; i++) st(s.hls[i], u.seg(t, 9.3 + i * 0.6, 9.5 + i * 0.6));
    rise(s.xt, u.seg(t, 8.6, 9.2), 10);
    for (i = 0; i < 8; i++) {
      var f0 = flightAt(i), fp = u.seg(t, f0, f0 + 0.6), land = t >= f0 + 0.6, r = s.xr[i];
      var sx = i < 5 ? 456 + 300 : 96 + 18 + 28, sy = i < 5 ? 250 + 180 + i * 70 + 23 : QROW(XROWS[i][5]) + 40, ex = XL + 300, ey = xrowY(i) + 18;
      var e = u.eio(fp), x = u.lerp(sx, ex, e), y = u.lerp(sy, ey, e) - Math.sin(e * Math.PI) * 60;
      st(s.flies[i], fp > 0 && fp < 1 ? 1 : 0, 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + (1 - 0.12 * Math.sin(e * Math.PI)).toFixed(3) + ')');
      var rp = u.seg(t, f0 + 0.55, f0 + 0.85);
      st(r.v, rp); st(r.sk, 1 - rp); st(r.so, rp); st(r.stt, u.seg(t, f0 + 0.8, f0 + 1.0));
      st(r.m, 0.45 + 0.55 * rp); st(r.d, 0.45 + 0.55 * rp);
    }
    rise(s.sum, u.seg(t, 14.3, 14.9), 10);
  });

  /* ── SCENE 3 · Assessment ─────────────────────────────────────── */
  var SHORT = { e1: 'GHG trend', e2: 'Energy mix', e3: 'Water', e4: 'Waste', s1: 'Safety', s2: 'Diversity', s3: 'Supply chain', s4: 'Community', g1: 'Board oversight', g2: 'Ethics', g3: 'Risk management', g4: 'Pay linkage',
                c1: 'Net zero target', c2: 'Scope 3', c3: 'Scenario analysis', c4: 'Transition capex', d1: 'Assurance', d2: 'Consistency', d3: 'Frameworks', d4: 'Traceability' };
  var AX = ['Environmental', 'Social', 'Governance', 'Climate', 'Credibility'];
  var RC = { x: 322, y: 268, r: 190 };
  var rpt = function (i, v) { var a = -Math.PI / 2 + i * 2 * Math.PI / 5; return [RC.x + RC.r * v / 100 * Math.cos(a), RC.y + RC.r * v / 100 * Math.sin(a)]; };
  scene(15.6, 24.4, function (s) {
    s.hd = el(s.root, 'pn cph', '<div class="mono">CP</div><b>Corvane Pharma</b><span>Pharmaceuticals · Hyderabad, Telangana · Synthetic entity</span><em>20 indicators · 5 dimensions · public disclosures</em>', 'left:96px;top:236px;width:1728px;height:96px');
    var p = el(s.root, 'pn', '<div class="pnh">Indicator assessment<span>Evidence status for every indicator</span></div>', 'left:96px;top:352px;width:1060px;height:576px');
    s.p = p;
    s.dims = sc.dims.map(function (d, L) {
      var r = el(p, 'dr', '<div class="n">' + d.name + '</div><div class="w">Weight ' + d.weight + '%</div><div class="ds">—</div><div class="bar"><i></i></div>', 'top:' + (56 + L * 104) + 'px');
      return { cells: d.indicators.map(function (it, i) { return { e: el(r, 'cl', '<small>' + SHORT[it.id] + '</small><b>···</b>', 'left:' + (300 + i * 160) + 'px'), it: it }; }),
               ds: r.querySelector('.ds'), bar: r.querySelector('.bar i'), d: d };
    });
    s.cells = []; s.dims.forEach(function (d) { d.cells.forEach(function (c) { c.b = c.e.querySelector('b'); s.cells.push(c); }); });
    var rp = el(s.root, 'pn', '<div class="pnh">Dimension profile<span>Scored from evidenced indicators</span></div>', 'left:1180px;top:352px;width:644px;height:576px');
    s.rp = rp;
    var svg = '<svg class="rad" width="644" height="500" viewBox="0 0 644 500" style="position:absolute;left:0;top:56px">';
    [25, 50, 75, 100].forEach(function (v) { svg += '<polygon class="gr" points="' + AX.map(function (_, i) { return rpt(i, v).map(function (n) { return n.toFixed(1); }).join(','); }).join(' ') + '"/>'; });
    AX.forEach(function (a, i) { var e = rpt(i, 100), l = rpt(i, 124); svg += '<line class="gr" x1="' + RC.x + '" y1="' + RC.y + '" x2="' + e[0].toFixed(1) + '" y2="' + e[1].toFixed(1) + '"/><text x="' + l[0].toFixed(1) + '" y="' + (l[1] + 5).toFixed(1) + '" text-anchor="middle">' + a + '</text>'; });
    svg += '<polygon class="poly" points=""/></svg>';
    rp.insertAdjacentHTML('beforeend', svg);
    s.poly = rp.querySelector('.poly');
    s.leg = el(rp, 'leg', '<span><i style="background:#BFE6D6"></i>19 evidenced</span><span><i style="background:#F5DFAE"></i>1 insufficient evidence</span><span><i style="background:#EEF1F5;border:1px dashed #C9D1DC"></i>0 not disclosed</span>');
  }, function (t, s) {
    st(s.root, u.seg(t, 15.6, 16.3) * (1 - u.seg(t, 23.6, 24.3)));
    rise(s.hd, u.seg(t, 16.0, 16.6)); rise(s.p, u.seg(t, 16.2, 16.8), 24); rise(s.rp, u.seg(t, 16.4, 17.0), 24);
    var pts = [];
    s.dims.forEach(function (dm, L) {
      var base = 16.9 + L * 1.0;
      dm.cells.forEach(function (c, i) {
        var at = base + i * 0.17, r = t >= at, pop = u.seg(t, at, at + 0.25);
        cl(c.e, 'cl' + (r ? ' ' + tone(c.it) : ''));
        tx(c.b, r ? (c.it.state === 'evidenced' ? String(c.it.value) : c.it.state === 'insufficient' ? 'Insufficient' : 'Not disclosed') : '···');
        st(c.e, undefined, 'scale(' + (r ? 1 + 0.08 * (1 - u.eo(pop)) : 1).toFixed(3) + ')');
      });
      var sp = u.eo(u.seg(t, base + 0.75, base + 1.25));
      tx(dm.ds, sp > 0 ? String(Math.round(dm.d.score * sp)) : '—');
      st(dm.bar, undefined, 'scaleX(' + (dm.d.score / 100 * sp).toFixed(4) + ')');
      var gp = u.eo(u.seg(t, base + 0.7, base + 1.3));
      pts.push(rpt(L, dm.d.score * gp));
    });
    attr(s.poly, 'points', pts.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' '));
    rise(s.leg, u.seg(t, 22.0, 22.6), 10);
  });

  /* ── SCENE 4 · Climactix Intelligence Score ───────────────────── */
  var COLS = ['#0E9F6E', '#6F93E8', '#0B1F3A', '#1D4FD8', '#5FBF97'];
  var RG = { x: 380, y: 380, r: 272, w: 40 }, CIRC = 2 * Math.PI * RG.r;
  scene(23.6, 31.6, function (s) {
    var svg = '<svg width="760" height="760" viewBox="0 0 760 760" style="position:absolute;left:320px;top:270px">', acc = 0;
    s.segs = [];
    sc.dims.forEach(function (d, L) {
      var deg = d.weight * 3.6, len = (deg - 2.2) / 360 * CIRC, rot = -90 + acc + 1.1;
      svg += '<circle cx="380" cy="380" r="' + RG.r + '" fill="none" stroke="#EBEEF2" stroke-width="' + RG.w + '" stroke-dasharray="' + len.toFixed(1) + ' ' + CIRC.toFixed(1) + '" transform="rotate(' + rot.toFixed(2) + ' 380 380)"/>' +
             '<circle class="fill" cx="380" cy="380" r="' + RG.r + '" fill="none" stroke="' + COLS[L] + '" stroke-width="' + RG.w + '" stroke-dasharray="0 ' + CIRC.toFixed(1) + '" transform="rotate(' + rot.toFixed(2) + ' 380 380)"/>';
      s.segs.push({ len: len, mid: acc + deg / 2, d: d });
      acc += deg;
    });
    s.root.insertAdjacentHTML('beforeend', svg + '</svg>');
    var fills = s.root.querySelectorAll('.fill');
    s.segs.forEach(function (g2, L) {
      g2.f = fills[L];
      var a = (g2.mid - 90) * Math.PI / 180, R = RG.r + 62, cx = Math.cos(a);
      g2.lab = el(s.root, 'rl', '<b>' + AX[L] + '</b><span>' + g2.d.score + ' · weight ' + g2.d.weight + '%</span>', 'left:' + (700 + R * cx).toFixed(0) + 'px;top:' + (650 + R * Math.sin(a)).toFixed(0) + 'px;text-align:' + (cx < -0.3 ? 'right' : cx > 0.3 ? 'left' : 'center'));
      g2.ax = cx < -0.3 ? '-100%' : cx > 0.3 ? '0%' : '-50%';
    });
    s.cen = el(s.root, 'cen', '<b>0</b><span>Climactix Score · out of 100</span><em><i>' + sc.band.grade + '</i>' + sc.band.label + '</em>');
    s.num = s.cen.querySelector('b'); s.grade = s.cen.querySelector('em');
    var fx = el(s.root, 'fx', '<h4>How the score adds up</h4>');
    s.fx = fx;
    s.frs = sc.dims.map(function (d, L) { return el(fx, 'fr', '<i style="background:' + COLS[L] + '"></i><b style="text-align:left;font-weight:600">' + d.name + '</b><span>' + d.score + ' × ' + d.weight + '%</span><b>' + (d.score * d.weight / 100).toFixed(1) + '</b>'); });
    s.tot = el(fx, 'ftot', '<span>Climactix Score</span><span>' + sc.overall + '</span>');
    var cf = sc.confidence, c = el(s.root, 'cf', '<h4>Data confidence · reported separately</h4><div class="cv"><b>0</b><em>' + cf.band + '</em></div>');
    s.cf = c; s.cfn = c.querySelector('.cv b');
    s.cbs = [['Completeness', cf.completeness], ['Traceability', cf.traceability], ['Reliability', cf.reliability]].map(function (r) {
      var e = el(c, 'cb', '<span>' + r[0] + '</span><i><em></em></i><b>0</b>'); return { f: e.querySelector('em'), n: e.querySelector('b'), v: r[1] };
    });
  }, function (t, s) {
    st(s.root, u.seg(t, 23.6, 24.3) * (1 - u.seg(t, 30.6, 31.3)));
    s.segs.forEach(function (g2, L) {
      var p = u.eio(u.seg(t, 24.5 + L * 0.42, 25.4 + L * 0.42));
      attr(g2.f, 'stroke-dasharray', (g2.len * g2.d.score / 100 * p).toFixed(1) + ' ' + CIRC.toFixed(1));
      var lp = u.seg(t, 24.7 + L * 0.42, 25.2 + L * 0.42); st(g2.lab, lp, 'translate(' + g2.ax + ',calc(-50% + ' + ((1 - u.eo(lp)) * 10).toFixed(1) + 'px))');
      rise(s.frs[L], u.seg(t, 24.7 + L * 0.42, 25.2 + L * 0.42), 10);
    });
    rise(s.fx, u.seg(t, 24.3, 24.8), 10);
    tx(s.num, String(Math.round(sc.overall * u.eo(u.seg(t, 26.2, 27.9)))));
    st(s.cen, u.seg(t, 25.6, 26.2), 'translate(-50%,-50%) scale(' + (0.94 + 0.06 * u.eo(u.seg(t, 25.6, 26.4))).toFixed(4) + ')');
    var gp = u.seg(t, 27.9, 28.3); st(s.grade, gp, 'scale(' + (1.2 - 0.2 * u.eo(gp)).toFixed(3) + ')');
    rise(s.tot, u.seg(t, 27.8, 28.3), 10);
    rise(s.cf, u.seg(t, 28.3, 28.8), 14);
    tx(s.cfn, String(Math.round(sc.confidence.value * u.eo(u.seg(t, 28.5, 29.8)))));
    s.cbs.forEach(function (b, i) { var p = u.eo(u.seg(t, 28.6 + i * 0.25, 29.6 + i * 0.25)); st(b.f, undefined, 'scaleX(' + (b.v / 100 * p).toFixed(4) + ')'); tx(b.n, String(Math.round(b.v * p))); });
  });

  /* ── SCENE 5 · Institutional decisions ────────────────────────── */
  var TILES = [[96, 240], [972, 240], [96, 624], [972, 624]];
  var focusAt = function (i) { return 32.0 + i * 2.2; };
  scene(30.6, 41.6, function (s) {
    var ar = D.score('arvalis').counts, mxIds = ['corvane', 'solwick', 'nordvane', 'arvalis'], mxInd = ['e1', 'e3', 'e4', 'c3', 'c1', 'd1'];
    var hold = D.portfolio().holdings.slice(0, 4), par = D.platform().participation;
    var CARDS = [
      { tag: 'Banks', clip: 'banker', rate: 0.6, html: '<small>Borrower review</small><h4>Arvalis Cement</h4><div class="sub">Cement · Synthetic entity</div><div class="big"><b>48</b><i>BB</i></div>' +
          '<span class="c2 adv">' + ar.adverse + ' adverse indicators</span><span class="c2 nd">' + ar.missing + ' not disclosed</span><span class="c2 ie">' + ar.insufficient + ' insufficient evidence</span><div class="ft">Points to raise before the credit decision</div>' },
      { tag: 'Insurers', clip: 'engineers', rate: 0.6, html: '<small>Exposure indicators</small><h4>Industrial accounts</h4><div class="mx"><span></span>' + mxInd.map(function () { return '<span></span>'; }).join('') +
          mxIds.map(function (id) { return '<span>' + D.company(id).name.split(' ')[0] + '</span>' + mxInd.map(function (k) { return '<i class="' + (function (it) { var tn = tone(it); return tn === 'ok' ? 'hi' : tn; })(ind(id, k)) + '"></i>'; }).join(''); }).join('') + '</div><div class="ft">Missing information is shown as missing</div>' },
      { tag: 'Investors', clip: 'analyst', rate: 0.6, extra: 'lift', html: '<small>Portfolio comparison</small><h4>Largest holdings</h4>' +
          hold.map(function (h) { return '<div class="bl"><span>' + h.company.name.replace(' Industries', '').replace(' & Toubro', ' & T') + '</span><i><em data-v="' + h.score + '"></em></i><b>' + h.score + '</b></div>'; }).join('') + '<div class="ft">Research input · not investment advice</div>' },
      { tag: 'Government', clip: 'skyline', rate: 0.55, html: '<small>Reporting participation</small><h4>Share of companies, FY2025-26</h4>' +
          [['BRSR', par.BRSR[4]], ['Sustainability report', par.SR[4]], ['Climate report', par.CL[4]], ['Net zero report', par.NZ[4]]].map(function (r) { return '<div class="bl"><span>' + r[0] + '</span><i><em data-v="' + r[1] + '"></em></i><b>' + r[1] + '%</b></div>'; }).join('') + '<div class="ft">Synthetic aggregates</div>' }
    ];
    s.tiles = CARDS.map(function (c, i) {
      var tl = el(s.root, 'tl', '<span class="tg">' + c.tag + '</span>', 'left:' + TILES[i][0] + 'px;top:' + TILES[i][1] + 'px');
      var v = video(tl, c.clip, c.extra);
      var cd = el(tl, 'cd', c.html), rg = el(tl, 'rg');
      return { tl: tl, v: v, rate: c.rate, cd: cd, rg: rg, bars: cd.querySelectorAll('em[data-v]'), parts: Array.prototype.slice.call(cd.children) };
    });
  }, function (t, s) {
    st(s.root, 1 - u.seg(t, 40.9, 41.5));
    s.tiles.forEach(function (T, i) {
      var rv = u.eio(u.seg(t, 31.0 + i * 0.25, 31.7 + i * 0.25)), f0 = focusAt(i), foc = u.seg(t, f0, f0 + 0.4) * (1 - u.seg(t, f0 + 2.0, f0 + 2.4));
      css(T.tl, 'clipPath', 'inset(0 ' + ((1 - rv) * 100).toFixed(2) + '% 0 0 round 20px)');
      st(T.tl, rv > 0 ? 1 : 0, 'scale(' + (1 + 0.012 * foc).toFixed(4) + ')');
      st(T.rg, foc);
      T.tl.style.zIndex = foc > 0 ? 5 : 1;
      st(T.v.v, undefined, 'scale(' + (1.12 - 0.08 * u.seg(t, 31, 41)).toFixed(4) + ')');
      T.v.req = Math.max(0, t - (f0 - 0.8)) * T.rate;
      var cp = u.seg(t, f0 + 0.15, f0 + 0.6);
      st(T.cd, cp, 'translate3d(' + ((1 - u.eo(cp)) * 30).toFixed(1) + 'px,0,0)');
      for (var k = 0; k < T.bars.length; k++) { var b = T.bars[k], bp = u.eo(u.seg(t, f0 + 0.5 + k * 0.12, f0 + 1.3 + k * 0.12)); st(b, undefined, 'scaleX(' + (+b.getAttribute('data-v') / 100 * bp).toFixed(4) + ')'); }
    });
  });

  /* ── SCENE 6 · Business impact, then the brand lock-up ────────── */
  var IMP = [['port', 'Institutions', 'Better-informed decisions', 'Credit, underwriting, investment and policy decisions made with the evidence in view.'],
             ['construction', 'Companies', 'A clearer path to credibility', 'Companies see which disclosures would strengthen their position, and how they compare.'],
             ['harvest', 'Climate action', 'Commitments measured against progress', 'Declared targets are tracked against reported emissions, year by year.']];
  scene(40.9, 48.01, function (s) {
    s.cols = IMP.map(function (c, i) {
      var col = el(s.root, 'col', '', 'left:' + (96 + i * 584) + 'px');
      var ph = el(col, 'ph'); var v = video(ph, c[0], 'lift');
      col.insertAdjacentHTML('beforeend', '<small>' + c[1] + '</small><h3>' + c[2] + '</h3><p>' + c[3] + '</p>' +
        (i === 2 ? '<svg width="300" height="60" viewBox="0 0 300 60"><path d="M4 10 L296 52" stroke="#7A8799" stroke-width="2" stroke-dasharray="5 4" fill="none"/><path d="M4 10 L60 17 L116 25 L150 29" stroke="#0E9F6E" stroke-width="3" fill="none"/><circle cx="150" cy="29" r="4" fill="#0E9F6E"/></svg>' : ''));
      return { col: col, ph: ph, v: v, parts: Array.prototype.slice.call(col.children, 1) };
    });
    s.lg = el(s.root, 'lg', '<img src="../Climatix_logo.png" alt="Climactix Global">');
    s.lt = el(s.root, 'lt', 'CLIMACTIX TERMINAL');
    s.lr = el(s.root, 'lr2');
    s.ls = el(s.root, 'ls', 'Corporate Sustainability Intelligence. All in One Place.');
  }, function (t, s) {
    var out = 1 - u.seg(t, 44.3, 44.9), end = 1 - u.seg(t, 47.2, 47.95);
    s.cols.forEach(function (c, i) {
      var a = 41.3 + i * 0.35, p = u.eio(u.seg(t, a, a + 0.8));
      css(c.ph, 'clipPath', 'inset(' + ((1 - p) * 100).toFixed(2) + '% 0 0 0 round 18px)');
      st(c.col, (p > 0 ? 1 : 0) * out, 'translate3d(0,' + ((1 - out) * -20).toFixed(1) + 'px,0)');
      c.parts.forEach(function (e, k) { rise(e, u.seg(t, a + 0.4 + k * 0.15, a + 0.9 + k * 0.15), 14); });
      c.v.req = Math.max(0, t - a) * 0.8;
      st(c.v.v, undefined, 'scale(' + (1.1 - 0.06 * u.seg(t, a, 45)).toFixed(4) + ')');
    });
    var lp = u.eo(u.seg(t, 45.0, 45.8)), tp = u.eo(u.seg(t, 45.4, 46.6));
    st(s.lg, lp * end, 'translate(-50%,' + ((1 - lp) * 24).toFixed(1) + 'px) scale(' + (0.94 + 0.06 * lp).toFixed(4) + ')');
    st(s.lt, tp * end); css(s.lt, 'letterSpacing', (0.4 - 0.22 * tp).toFixed(4) + 'em');
    st(s.lr, u.seg(t, 46.0, 46.3) * end, 'translate(-50%,0) scaleX(' + u.eio(u.seg(t, 46.0, 47.0)).toFixed(4) + ')');
    rise(s.ls, u.seg(t, 46.2, 47.0) * end, 14);
  });

  /* ── scene titles and the demonstration tag (on top of every scene) ── */
  var TT = [['Fragmented information', 'A company’s sustainability record is spread across reports, filings and web pages, in different formats and years.'],
            ['Centralised intelligence', 'Climactix collects every disclosure, extracts each data point and records the page it came from.'],
            ['Assessment', 'Twenty indicators across five dimensions, each marked evidenced, insufficiently evidenced or not disclosed.'],
            ['Climactix Intelligence Score', 'A weighted, explainable score, reported with a separate measure of data confidence.'],
            ['Institutional decisions', 'Banks, insurers, investors and government each see the intelligence that answers their own questions.'],
            ['Business impact', 'Sustainability information connected to institutional decisions, corporate resilience and climate action.']];
  var SC = [[0, 8], [8, 16], [16, 24], [24, 31], [31, 41], [41, 44.6]];
  var tts = TT.map(function (x, i) { return el(stage, 'ttl', '<small>Step 0' + (i + 1) + '</small><h2>' + x[0] + '</h2><p>' + x[1] + '</p>'); });
  el(stage, 'tag', 'Demonstration data · illustrative');
  function titles(t) {
    tts.forEach(function (e, i) {
      var a = SC[i][0], b = SC[i][1], p = u.seg(t, a + 0.15, a + 0.8) * (1 - u.seg(t, b - 0.55, b - 0.05));
      st(e, p, 'translate3d(0,' + ((1 - u.eo(u.seg(t, a + 0.15, a + 0.8))) * 16).toFixed(1) + 'px,0)');
    });
  }

  /* ── clock ── */
  function want(o) { var d = o.v.duration; return !d || isNaN(d) ? null : Math.max(0, Math.min(o.req, d - 0.05)); }
  function render(t) {
    g.clearRect(0, 0, 1920, 1080);
    vids.forEach(function (o) { o.req = null; });
    scenes.forEach(function (s) { var on = t >= s.a && t < s.b; if (on !== s._on) { s._on = on; s.root.style.display = on ? '' : 'none'; } if (on) s.frame(t, s); });
    titles(t);
    vids.forEach(function (o) { if (o.req == null) return; var w = want(o); if (w != null && !o.v.seeking && Math.abs(o.v.currentTime - w) > 0.02) o.v.currentTime = w; });
  }
  function settle() {
    return new Promise(function (res) {
      var n = 0;
      (function chk() {
        var ok = true;
        vids.forEach(function (o) {
          if (o.req == null) return;
          var w = want(o);
          if (w == null || o.v.readyState < 2 || o.v.seeking) { ok = false; return; }
          if (Math.abs(o.v.currentTime - w) > 0.04) { ok = false; o.v.currentTime = w; }
        });
        if (ok || ++n > 500) res(); else setTimeout(chk, 10);
      })();
    });
  }
  /* a quiet ambient bed with a soft accent at each scene, rendered offline so it loops with the picture */
  function renderAudio(rate) {
    rate = rate || 48000;
    var Ac = new OfflineAudioContext(2, Math.ceil(rate * DUR), rate), m = Ac.createGain(); m.connect(Ac.destination);
    var lp = Ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; var pad = Ac.createGain(); pad.gain.value = 0; lp.connect(pad); pad.connect(m);
    [110, 164.8, 220.4, 329.6].forEach(function (f, i) { var o = Ac.createOscillator(), gn = Ac.createGain(); o.type = i < 2 ? 'sine' : 'triangle'; o.frequency.value = f; gn.gain.value = [0.4, 0.3, 0.12, 0.05][i]; o.connect(gn); gn.connect(lp); o.start(); });
    pad.gain.setValueAtTime(0, 0); pad.gain.linearRampToValueAtTime(0.32, 1.5); pad.gain.setValueAtTime(0.32, DUR - 1.6); pad.gain.linearRampToValueAtTime(0, DUR - 0.05);
    [0.4, 8.1, 16.1, 24.1, 31.1, 41.1, 45.2].forEach(function (at, i) {
      var o = Ac.createOscillator(), gn = Ac.createGain(); o.type = 'sine'; o.frequency.value = i === 6 ? 659.3 : 880; o.connect(gn); gn.connect(m);
      gn.gain.setValueAtTime(0.0001, at); gn.gain.exponentialRampToValueAtTime(i === 6 ? 0.07 : 0.045, at + 0.03); gn.gain.exponentialRampToValueAtTime(0.0005, at + 0.9); o.start(at); o.stop(at + 1);
    });
    for (var k = 0; k < 8; k++) { var at = flightAt(k) + 0.6, o = Ac.createOscillator(), gn = Ac.createGain(); o.type = 'sine'; o.frequency.value = 1320; o.connect(gn); gn.connect(m); gn.gain.setValueAtTime(0.02, at); gn.gain.exponentialRampToValueAtTime(0.0004, at + 0.08); o.start(at); o.stop(at + 0.1); }
    return Ac.startRendering();
  }

  render(0);
  window.EX = { dur: DUR, seek: render, settle: settle, renderAudio: renderAudio };
})();
