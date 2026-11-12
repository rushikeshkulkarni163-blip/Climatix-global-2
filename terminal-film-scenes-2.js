/* ════════════════════════════════════════════════════════════════════
   CLIMACTIX TERMINAL — PRODUCT FILM · SCENES 5–7
   5 Institutional intelligence (55–80 s)  bank · insurance · investor · government
   6 One unified platform (80–98 s)        unify
   7 Closing (98–108 s)                    close
   Each institutional environment is its own scene with its own transition.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var F = window.CXFilm, u = F.u, D = window.CX_TERMINAL_DEMO, chip = F.chip;
  var BORROWER = 'arvalis';

  F.caption(56.0, 61.0, 'Banks: borrower due diligence, with disclosure gaps made visible.');
  F.caption(62.2, 67.2, 'Insurers: environmental exposure indicators for corporate screening.');
  F.caption(68.4, 73.4, 'Investors: portfolio analysis, company comparison and score history.');
  F.caption(74.6, 79.6, 'Government: sector-level disclosure and participation insight.');

  function ind(id, iid) {
    var r = null;
    D.score(id).dims.forEach(function (d) { d.indicators.forEach(function (it) { if (it.id === iid) r = it; }); });
    return r;
  }
  function risks(id) {
    var c = D.company(id), s = D.score(id), out = [];
    D.gaps(id).adverse.forEach(function (it) { out.push(['adv', 'Adverse performance: ' + it.label]); });
    if (s.confidence.band === 'Low') out.push(['ie', 'Low data confidence']);
    if (ind(id, 'c1').state !== 'evidenced') out.push(['ie', 'Net zero target not evidenced']);
    if (c.netZero.interim !== 'Interim milestones disclosed') out.push(['ie', 'No interim milestones']);
    if (ind(id, 'd1').state !== 'evidenced') out.push(['ie', 'No external assurance located']);
    return out;
  }
  function head(ctx, e, title, note) {
    ctx.el(e, 'cxf-ph-head', '<small>Institutional view</small><h2>' + title + '</h2>', 'left:24px;top:14px');
    ctx.el(e, 'cxf-disc', note);
  }
  /* multi-series line chart; returns { paths, ends } for stroke animation */
  var STY = [['#F4F6F8', ''], ['#3D7BE0', ''], ['#7C8794', '6 5'], ['#8FB1EA', '2 5']];
  function lines(ctx, parent, w, h, labels, series, min, max) {
    var X = function (n) { return 46 + (w - 190) * n / (labels.length - 1); }, Y = function (v) { return 14 + (h - 50) * (1 - (v - min) / (max - min)); };
    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '">', i;
    for (i = 0; i <= 4; i++) { var gv = min + (max - min) * i / 4; svg += '<line class="gl" x1="46" x2="' + (w - 144) + '" y1="' + Y(gv) + '" y2="' + Y(gv) + '"/><text x="36" y="' + (Y(gv) + 5) + '" text-anchor="end">' + Math.round(gv) + '</text>'; }
    labels.forEach(function (l, n) { svg += '<text x="' + X(n) + '" y="' + (h - 8) + '" text-anchor="middle">' + l.replace('FY20', 'FY') + '</text>'; });
    series.forEach(function (s, k) {
      var d = s.values.map(function (v, n) { return (n ? 'L' : 'M') + X(n).toFixed(1) + ' ' + Y(v).toFixed(1); }).join('');
      svg += '<path class="ln" pathLength="1" d="' + d + '" style="stroke:' + STY[k][0] + ';' + (STY[k][1] ? 'stroke-dasharray:1;' : '') + '"/>' +
             '<text class="end" x="' + (w - 136) + '" y="' + (Y(s.values[s.values.length - 1]) + 5) + '" style="fill:' + STY[k][0] + '">' + s.name + ' ' + s.values[s.values.length - 1] + '</text>';
    });
    var box = ctx.el(parent, 'cxf-chart', svg + '</svg>');
    return { paths: box.querySelectorAll('.ln'), ends: box.querySelectorAll('.end') };
  }
  function drawLines(ctx, L, t, a, b) {
    for (var i = 0; i < L.paths.length; i++) {
      var p = u.eio(u.seg(t, a + i * 0.35, b + i * 0.35));
      ctx.css(L.paths[i], 'strokeDashoffset', (1 - p).toFixed(4));
      ctx.st(L.ends[i], u.seg(p, 0.92, 1));
    }
  }

  /* ── SCENE 5a · BANKS — lateral wipe ───────────────────────────── */
  F.scene({
    id: 'bank', chapter: 'Institutional intelligence', ranges: [[55, 62.2]],
    build: function (ctx, s) {
      var e = ctx.term.screen('cxf-env'), b = D.company(BORROWER), bs = D.score(BORROWER), g = D.gaps(BORROWER);
      s.els.push(e); s.e = e;
      head(ctx, e, 'Bank Intelligence', 'Intelligence input · not a credit decision');
      s.q = ctx.el(e, 'cxf-field', '<span>Search borrowers</span><b></b><i></i>', 'left:24px;top:112px;width:620px');
      s.qt = s.q.querySelector('b');
      var order = ['tata-motors', 'reliance', BORROWER, 'nordvane', 'solwick', 'infosys', 'lnt', 'corvane'];
      var tb = ctx.el(e, 'cxf-p', '<div class="cxf-pt">Corporate borrowers<span>Score · Grade</span></div>', 'left:24px;top:186px;width:620px;height:614px');
      s.rows = order.map(function (id) {
        var c = D.company(id), x = D.score(id);
        return { e: ctx.el(tb, 'cxf-tr b3', '<span><b>' + c.name + '</b><small>' + c.industry + '</small></span><span class="n">' + x.overall + '</span><span><em class="cxf-grade">' + x.band.grade + '</em></span>'), hit: id === BORROWER };
      });
      var p = ctx.el(e, 'cxf-p', '<div class="cxf-pt">Borrower review<span>Synthetic entity</span></div>', 'left:668px;top:112px;width:688px;height:688px');
      s.panel = p;
      s.name = ctx.el(p, 'cxf-rv', '<h3>' + b.name + '</h3><span>' + b.industry + ' · ' + b.city + '</span>');
      s.sc = ctx.el(p, 'cxf-rs', '<b>0</b><span>/ 100</span><em class="cxf-grade lg">' + bs.band.grade + '</em><em class="cxf-chip ie">Confidence ' + bs.confidence.band + ' · ' + bs.confidence.value + '</em>');
      s.num = s.sc.querySelector('b'); s.val = bs.overall;
      ctx.el(p, 'cxf-sub', 'Sustainability-related risk indicators');
      var wrap = ctx.el(p, 'cxf-chips');
      s.chips = risks(BORROWER).slice(0, 5).map(function (r) { return ctx.el(wrap, 'cxf-chip ' + r[0], r[1]); });
      ctx.el(p, 'cxf-sub', 'Disclosure gaps · of 20 indicators');
      s.gaps = [['Not disclosed', g.missing.length], ['Insufficient evidence', g.insufficient.length]].map(function (r) {
        var x = ctx.el(p, 'cxf-brow', '<span>' + r[0] + '</span><i><em class="mut"></em></i><b>0</b>');
        return { f: x.querySelector('em'), n: x.querySelector('b'), v: r[1] };
      });
      s.foot = ctx.el(p, 'cxf-foot', 'Gaps reduce data confidence. They are not scored as poor performance.');
    },
    frame: function (t, ctx) {
      var s = this, v = t - 55, p = u.eio(u.seg(v, 0, 0.8)), i;
      ctx.css(s.e, 'clipPath', 'inset(0 ' + ((1 - p) * 100).toFixed(2) + '% 0 0)');
      ctx.tx(s.qt, 'Arvalis'.slice(0, Math.ceil(u.seg(v, 0.9, 1.7) * 7)));
      for (i = 0; i < s.rows.length; i++) {
        var r = s.rows[i];
        ctx.st(r.e, u.seg(v, 0.4 + i * 0.07, 0.9 + i * 0.07) * (r.hit ? 1 : 1 - 0.78 * u.seg(v, 1.7, 2.2)));
        if (r.hit) ctx.css(r.e, 'background', v >= 2.7 ? '#1B3A73' : 'transparent');
      }
      ctx.st(s.panel, 0.35 + 0.65 * u.seg(v, 2.8, 3.3));
      ctx.rise(s.name, u.seg(v, 2.9, 3.4)); ctx.rise(s.sc, u.seg(v, 3.1, 3.6));
      ctx.tx(s.num, String(Math.round(s.val * u.eo(u.seg(v, 3.1, 4.2)))));
      for (i = 0; i < s.chips.length; i++) ctx.rise(s.chips[i], u.seg(v, 3.7 + i * 0.26, 4.1 + i * 0.26), 10);
      for (i = 0; i < s.gaps.length; i++) {
        var gp = u.eo(u.seg(v, 4.5 + i * 0.25, 5.4 + i * 0.25));
        ctx.st(s.gaps[i].f, undefined, 'scaleX(' + (s.gaps[i].v / 20 * gp).toFixed(4) + ')');
        ctx.tx(s.gaps[i].n, String(Math.round(s.gaps[i].v * gp)));
      }
      ctx.st(s.foot, u.seg(v, 5.2, 5.8));
    }
  });

  /* ── SCENE 5b · INSURANCE — vertical scan ──────────────────────── */
  var EXPO = [['e1', 'GHG intensity'], ['e3', 'Water stress'], ['e4', 'Waste'], ['c3', 'Physical risk'], ['c1', 'Net zero target'], ['d1', 'Assurance']];
  F.scene({
    id: 'insurance', ranges: [[61.25, 68.5]],
    build: function (ctx, s) {
      var e = ctx.term.screen('cxf-env');
      s.els.push(e); s.e = e;
      head(ctx, e, 'Insurance Intelligence', 'Intelligence inputs · not actuarial outputs');
      var p = ctx.el(e, 'cxf-p', '<div class="cxf-pt">Environmental exposure indicators<span>Indicator score by company</span></div>', 'left:24px;top:112px;width:900px;height:688px');
      var g = ctx.el(p, 'cxf-ex', '<span></span>' + EXPO.map(function (x) { return '<span class="h">' + x[1] + '</span>'; }).join(''));
      s.cells = []; s.names = [];
      D.companies().forEach(function (c, r) {
        s.names.push(ctx.el(g, 'l', c.name));
        EXPO.forEach(function (x, k) {
          var it = ind(c.id, x[0]);
          var cls = it.state === 'missing' ? 'nd' : it.state === 'insufficient' ? 'ie' : it.adverse ? 'adv' : it.value >= 65 ? 'hi' : 'mid';
          s.cells.push({ e: ctx.el(g, 'c ' + cls, it.state === 'missing' ? 'ND' : it.state === 'insufficient' ? 'IE' : String(it.value)), at: 1.0 + (r + k) * 0.16 });
        });
      });
      s.scan = ctx.el(p, 'cxf-scan');
      var side = ctx.el(e, 'cxf-p', '<div class="cxf-pt">Reading the screen</div>', 'left:948px;top:112px;width:408px;height:688px');
      s.side = side;
      s.leg = [['hi', 'Strong', '65 and above'], ['mid', 'Moderate', '40 to 64'], ['adv', 'Adverse performance', 'Evidenced, below 40'], ['ie', 'Insufficient evidence', 'Claim not traceable'], ['nd', 'Not disclosed', 'No public information']].map(function (l) {
        return ctx.el(side, 'cxf-leg', '<i class="c ' + l[0] + '"></i><div><b>' + l[1] + '</b><span>' + l[2] + '</span></div>');
      });
      s.foot = ctx.el(side, 'cxf-foot', 'Only evidenced values below 40 are reported as adverse. Missing data is shown as missing.');
      for (var i = 0; i < 14; i++) ctx.cue(61.25 + 1.0 + i * 0.16, 'tick');
    },
    frame: function (t, ctx) {
      var s = this, v = t - 61.25, p = u.eio(u.seg(v, 0, 0.8)), i;
      ctx.css(s.e, 'clipPath', 'inset(0 0 ' + ((1 - p) * 100).toFixed(2) + '% 0)');
      for (i = 0; i < s.names.length; i++) ctx.st(s.names[i], u.seg(v, 0.5 + i * 0.07, 1 + i * 0.07));
      for (i = 0; i < s.cells.length; i++) { var cp = u.eo(u.seg(v, s.cells[i].at, s.cells[i].at + 0.32)); ctx.st(s.cells[i].e, cp, 'scale(' + (0.6 + 0.4 * cp).toFixed(3) + ')'); }
      var sp = u.seg(v, 0.9, 3.5);
      ctx.st(s.scan, Math.sin(sp * Math.PI) * 0.8, 'translate3d(0,' + (sp * 560).toFixed(1) + 'px,0)');
      ctx.st(s.side, 0.35 + 0.65 * u.seg(v, 3.2, 3.7));
      for (i = 0; i < s.leg.length; i++) ctx.rise(s.leg[i], u.seg(v, 3.4 + i * 0.25, 3.9 + i * 0.25), 12);
      ctx.st(s.foot, u.seg(v, 4.9, 5.5));
    }
  });

  /* ── SCENE 5c · INVESTORS — depth push ─────────────────────────── */
  F.scene({
    id: 'investor', ranges: [[67.5, 74.7]],
    build: function (ctx, s) {
      var e = ctx.term.screen('cxf-env'), pf = D.portfolio();
      s.els.push(e); s.e = e;
      head(ctx, e, 'Investor Intelligence', 'Research input · not investment advice');
      s.kpi = [['Portfolio Climactix Score', pf.score, ''], ['Disclosure credibility', pf.credibility, ''], ['Weight with a dated net zero target', pf.targetWeight, '%']].map(function (k, n) {
        var b = ctx.el(e, 'cxf-p cxf-kpi', '<span>' + k[0] + '</span><b>0</b>', 'left:' + (24 + n * 448) + 'px;top:112px;width:436px;height:124px');
        return { e: b, n: b.querySelector('b'), v: k[1], sfx: k[2] };
      });
      var cp = ctx.el(e, 'cxf-p', '<div class="cxf-pt">Historical score movement<span>Model portfolio and holdings</span></div>', 'left:24px;top:252px;width:820px;height:548px');
      s.L = lines(ctx, cp, 780, 440, D.years, [
        { name: 'Portfolio', values: pf.history.map(function (h) { return h.score; }) },
        { name: D.company(F.featured).name.split(' ')[0], values: D.history(F.featured).map(function (h) { return h.score; }) },
        { name: 'Solwick', values: D.history('solwick').map(function (h) { return h.score; }) }], 40, 80);
      var bp = ctx.el(e, 'cxf-p', '<div class="cxf-pt">Company comparison<span>Score · Grade</span></div>', 'left:860px;top:252px;width:496px;height:548px');
      s.bars = pf.holdings.slice().sort(function (a, b) { return b.score - a.score; }).slice(0, 8).map(function (h) {
        var x = ctx.el(bp, 'cxf-brow cmp', '<span>' + h.company.name + '</span><i><em></em></i><b>0</b>');
        return { f: x.querySelector('em'), n: x.querySelector('b'), v: h.score };
      });
    },
    frame: function (t, ctx) {
      var s = this, v = t - 67.5, p = u.eio(u.seg(v, 0, 0.9)), i;
      ctx.st(s.e, u.seg(v, 0, 0.35), 'scale(' + (1.14 - 0.14 * p).toFixed(4) + ')');
      for (i = 0; i < s.kpi.length; i++) {
        ctx.rise(s.kpi[i].e, u.seg(v, 0.5 + i * 0.15, 1.1 + i * 0.15), 20);
        ctx.tx(s.kpi[i].n, Math.round(s.kpi[i].v * u.eo(u.seg(v, 0.7 + i * 0.15, 2.1 + i * 0.15))) + s.kpi[i].sfx);
      }
      drawLines(ctx, s.L, v, 1.4, 3.6);
      for (i = 0; i < s.bars.length; i++) {
        var bp = u.eo(u.seg(v, 1.7 + i * 0.2, 3 + i * 0.2));
        ctx.st(s.bars[i].f, undefined, 'scaleX(' + (s.bars[i].v / 100 * bp).toFixed(4) + ')');
        ctx.tx(s.bars[i].n, String(Math.round(s.bars[i].v * bp)));
      }
    }
  });

  /* ── SCENE 5d · GOVERNMENT — panel turn ────────────────────────── */
  F.scene({
    id: 'government', ranges: [[73.75, 81.4]],
    build: function (ctx, s) {
      var e = ctx.term.screen('cxf-env'), p = D.platform();
      s.els.push(e); s.e = e;
      head(ctx, e, 'Government Intelligence', 'Synthetic aggregates · no government integration implied');
      s.kpi = [['Companies indexed', p.companies, ''], ['BRSR reporting participation', p.participation.BRSR[4], '%'], ['Companies assessed', p.assessed, '']].map(function (k, n) {
        var b = ctx.el(e, 'cxf-p cxf-kpi', '<span>' + k[0] + '</span><b>0</b>', 'left:' + (24 + n * 448) + 'px;top:112px;width:436px;height:124px');
        return { e: b, n: b.querySelector('b'), v: k[1], sfx: k[2] };
      });
      var ip = ctx.el(e, 'cxf-p', '<div class="cxf-pt">Average score by industry<span>' + p.industries.length + ' sectors</span></div>', 'left:24px;top:252px;width:660px;height:548px');
      s.bars = p.industries.slice().sort(function (a, b) { return b.avg - a.avg; }).map(function (i) {
        var x = ctx.el(ip, 'cxf-brow tight', '<span>' + i.name + '</span><i><em></em></i><b>0</b>');
        return { f: x.querySelector('em'), n: x.querySelector('b'), v: i.avg };
      });
      var lp = ctx.el(e, 'cxf-p', '<div class="cxf-pt">Reporting participation<span>% of indexed companies</span></div>', 'left:700px;top:252px;width:656px;height:300px');
      s.L = lines(ctx, lp, 620, 226, D.years, [
        { name: 'BRSR', values: p.participation.BRSR }, { name: 'Sustainability', values: p.participation.SR },
        { name: 'Climate', values: p.participation.CL }, { name: 'Net zero', values: p.participation.NZ }], 0, 100);
      var rp = ctx.el(e, 'cxf-p', '<div class="cxf-pt">Regional distribution<span>Companies indexed</span></div>', 'left:700px;top:568px;width:656px;height:232px');
      var cols = ctx.el(rp, 'cxf-cols'), max = Math.max.apply(null, p.regions.map(function (r) { return r.companies; }));
      s.cols = p.regions.map(function (r) {
        var x = ctx.el(cols, 'col', '<b>0</b><i><em></em></i><span>' + r.name.replace('Rest of India', 'Other') + '</span>');
        return { f: x.querySelector('em'), n: x.querySelector('b'), v: r.companies, h: r.companies / max };
      });
    },
    frame: function (t, ctx) {
      var s = this, v = t - 73.75, p = u.eio(u.seg(v, 0, 0.9)), i;
      ctx.st(s.e, u.seg(v, 0, 0.5) * (1 - u.seg(t, 80, 81.2)), 'perspective(1800px) rotateY(' + ((1 - p) * -62).toFixed(2) + 'deg)');
      for (i = 0; i < s.kpi.length; i++) {
        ctx.rise(s.kpi[i].e, u.seg(v, 0.6 + i * 0.15, 1.2 + i * 0.15), 20);
        ctx.tx(s.kpi[i].n, Math.round(s.kpi[i].v * u.eo(u.seg(v, 0.8 + i * 0.15, 2.3 + i * 0.15))).toLocaleString('en-US') + s.kpi[i].sfx);
      }
      for (i = 0; i < s.bars.length; i++) {
        var bp = u.eo(u.seg(v, 1.1 + i * 0.13, 2.4 + i * 0.13));
        ctx.st(s.bars[i].f, undefined, 'scaleX(' + (s.bars[i].v / 100 * bp).toFixed(4) + ')');
        ctx.tx(s.bars[i].n, String(Math.round(s.bars[i].v * bp)));
      }
      drawLines(ctx, s.L, v, 1.6, 3.6);
      for (i = 0; i < s.cols.length; i++) {
        var cp = u.eo(u.seg(v, 2.6 + i * 0.14, 3.9 + i * 0.14));
        ctx.st(s.cols[i].f, undefined, 'scaleY(' + (s.cols[i].h * cp).toFixed(4) + ')');
        ctx.tx(s.cols[i].n, String(Math.round(s.cols[i].v * cp)));
      }
    }
  });

  /* ── SCENE 6 · One unified platform ────────────────────────────── */
  var SRC = ['ESG reports', 'Sustainability disclosures', 'BRSR documents', 'Net zero commitments', 'Climate reports', 'Environmental data'];
  var APPS = [['Banks', 'Borrower due diligence'], ['Insurers', 'Corporate screening'], ['Investors', 'Portfolio intelligence'], ['Government', 'Sector and regional insight']];
  F.scene({
    id: 'unify', chapter: 'One platform', ranges: [[80, 98.6]],
    build: function (ctx, s) {
      s.hs = ctx.el(s.root, 'cxf-colh', 'Public disclosures and company assessments', 'left:110px;top:150px');
      s.ha = ctx.el(s.root, 'cxf-colh', 'Institutional applications', 'left:1470px;top:150px');
      s.src = SRC.map(function (n, i) { return ctx.el(s.root, 'cxf-src', '<i></i>' + n, 'left:110px;top:' + (204 + i * 78) + 'px'); });
      s.apps = APPS.map(function (a, i) { return ctx.el(s.root, 'cxf-app', '<b>' + a[0] + '</b><span>' + a[1] + '</span><i></i><i></i><i></i><i></i>', 'left:1470px;top:' + (204 + i * 122) + 'px'); });
      s.core = ctx.el(s.root, 'cxf-corel', 'CLIMACTIX TERMINAL<span>One intelligence layer</span>', 'left:660px;top:690px;width:600px');
      s.words = ['One Platform.', 'One Intelligence Layer.', 'Multiple Institutional Applications.'].map(function (w) { return w; });
      var line = ctx.el(s.root, 'cxf-claim');
      s.w = s.words.map(function (w) { return ctx.el(line, 'w', w); });
      ctx.cue(87.4, 'soft'); ctx.cue(89.4, 'soft'); ctx.cue(91.4, 'soft');
    },
    frame: function (t, ctx) {
      var s = this, out = 1 - u.seg(t, 96.6, 98.3), g = ctx.bg, i, k;
      ctx.st(s.hs, u.seg(t, 82.6, 83.4) * out); ctx.st(s.ha, u.seg(t, 84.4, 85.2) * out);
      ctx.st(s.core, u.seg(t, 84, 85) * out);
      for (i = 0; i < s.src.length; i++) { var sp = u.seg(t, 82.8 + i * 0.22, 83.6 + i * 0.22); ctx.st(s.src[i], sp * out, 'translate3d(' + ((1 - u.eo(sp)) * -40).toFixed(1) + 'px,0,0)'); }
      for (i = 0; i < s.apps.length; i++) { var ap = u.seg(t, 84.6 + i * 0.3, 85.5 + i * 0.3); ctx.st(s.apps[i], ap * out, 'translate3d(' + ((1 - u.eo(ap)) * 40).toFixed(1) + 'px,0,0)'); }
      for (i = 0; i < s.w.length; i++) ctx.rise(s.w[i], u.seg(t, 87.4 + i * 2, 88.3 + i * 2) * out, 22);
      /* streams: sources → terminal → applications */
      function stream(x0, y0, x1, y1, a, seed) {
        if (a <= 0.01) return;
        var mx = (x0 + x1) / 2;
        g.strokeStyle = 'rgba(61,123,224,' + (0.34 * a).toFixed(3) + ')'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(x0, y0); g.bezierCurveTo(mx, y0, mx, y1, x1, y1); g.stroke();
        for (k = 0; k < 3; k++) {
          var q = (t * 0.32 + k / 3 + seed * 0.17) % 1, iq = 1 - q;
          var x = iq * iq * iq * x0 + 3 * iq * iq * q * mx + 3 * iq * q * q * mx + q * q * q * x1;
          var y = iq * iq * iq * y0 + 3 * iq * iq * q * y0 + 3 * iq * q * q * y1 + q * q * q * y1;
          g.fillStyle = 'rgba(244,246,248,' + (0.85 * a * Math.sin(q * Math.PI)).toFixed(3) + ')';
          g.beginPath(); g.arc(x, y, 2.6, 0, 6.283); g.fill();
        }
      }
      for (i = 0; i < SRC.length; i++) stream(452, 228 + i * 78, 606, 385 + i * 30, u.seg(t, 83.4 + i * 0.22, 84.4 + i * 0.22) * out, i);
      for (i = 0; i < APPS.length; i++) stream(1314, 400 + i * 40, 1468, 256 + i * 122, u.seg(t, 85 + i * 0.3, 86 + i * 0.3) * out, i + 7);
    }
  });

  /* ── SCENE 7 · Closing ─────────────────────────────────────────── */
  F.scene({
    id: 'close', chapter: 'Closing', ranges: [[98, 109]],
    build: function (ctx, s) {
      s.logo = ctx.el(s.root, 'cxf-logo', '<img src="Climatix_logo.png" alt="Climactix Global">');
      s.title = ctx.el(s.root, 'cxf-title', 'CLIMACTIX TERMINAL');
      s.rule = ctx.el(s.root, 'cxf-rule');
      s.sub = ctx.el(s.root, 'cxf-subt', 'Corporate Sustainability Intelligence. All in One Place.');
      ctx.cue(100, 'hit');
    },
    frame: function (t, ctx) {
      var lp = u.eo(u.seg(t, 98.8, 100.4)), tp = u.eo(u.seg(t, 100, 102));
      ctx.st(this.logo, lp, 'translate(-50%,0) scale(' + (0.94 + 0.06 * lp).toFixed(4) + ')');
      ctx.st(this.title, tp);
      ctx.css(this.title, 'letterSpacing', (0.42 - 0.24 * tp).toFixed(4) + 'em');
      ctx.st(this.rule, u.seg(t, 101.2, 101.6), 'translate(-50%,0) scaleX(' + u.eio(u.seg(t, 101.2, 102.6)).toFixed(4) + ')');
      ctx.rise(this.sub, u.seg(t, 101.8, 102.8), 18);
    }
  });
})();
