/* ════════════════════════════════════════════════════════════════════
   CLIMACTIX TERMINAL — PRODUCT FILM · SCENES 5–7
   5 Institutional applications (59–87 s)  bank · insurance · investor · government
     Each sequence pairs real footage of the institution's world with the
     terminal view built for it, and one sentence on why it matters.
   6 The bigger picture (87–100.5 s)       network
   7 Brand reveal (100–110 s)              close
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var F = window.CXFilm, u = F.u, D = window.CX_TERMINAL_DEMO;
  var SH = 4, LEN = 7, BORROWER = 'arvalis';

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

  /* The human side of each sequence: footage, role and the point of it. */
  function story(ctx, s, side, clip, rate, tag, role, line, sub, cls) {
    var box = ctx.el(s.root, 'cxf-story ' + side, '<span class="tag">' + tag + '</span>');
    s.story = { box: box, clip: ctx.video(box, clip, cls), rate: rate, side: side,
                say: ctx.el(s.root, 'cxf-say ' + side, '<small>' + role + '</small><p>' + line + '</p><span>' + sub + '</span>') };
    s.story.parts = s.story.say.children;
  }
  function storyFrame(ctx, s, v) {
    var st = s.story, p = u.eio(u.seg(v, 0.1, 1.1)), out = 1 - u.seg(v, LEN - 0.5, LEN + 0.3), r = ((1 - p) * 100).toFixed(2) + '%';
    ctx.css(st.box, 'clipPath', (st.side === 'l' ? 'inset(0 ' + r + ' 0 0 round 28px)' : 'inset(0 0 0 ' + r + ' round 28px)'));
    ctx.st(st.box, out, 'translate3d(' + ((1 - p) * (st.side === 'l' ? -40 : 40)).toFixed(1) + 'px,0,0)');
    ctx.st(st.clip.v, undefined, 'scale(' + (1.14 - 0.1 * u.seg(v, 0, LEN)).toFixed(4) + ')');
    ctx.clip(st.clip, Math.max(0, v - 0.15) * st.rate, st.rate);
    for (var i = 0; i < st.parts.length; i++) ctx.rise(st.parts[i], u.seg(v, 0.8 + i * 0.35, 1.5 + i * 0.35) * out, 20);
  }

  var STY = ['#0B1F3A', '#1D4FD8', '#0E9F6E', '#98A3B3'];
  function lines(ctx, parent, w, h, labels, series, min, max) {
    var X = function (n) { return 46 + (w - 190) * n / (labels.length - 1); }, Y = function (v) { return 14 + (h - 50) * (1 - (v - min) / (max - min)); };
    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '">', i;
    for (i = 0; i <= 4; i++) { var gv = min + (max - min) * i / 4; svg += '<line class="gl" x1="46" x2="' + (w - 144) + '" y1="' + Y(gv) + '" y2="' + Y(gv) + '"/><text x="36" y="' + (Y(gv) + 5) + '" text-anchor="end">' + Math.round(gv) + '</text>'; }
    labels.forEach(function (l, n) { svg += '<text x="' + X(n) + '" y="' + (h - 8) + '" text-anchor="middle">' + l.replace('FY20', 'FY') + '</text>'; });
    series.forEach(function (s, k) {
      var d = s.values.map(function (v, n) { return (n ? 'L' : 'M') + X(n).toFixed(1) + ' ' + Y(v).toFixed(1); }).join('');
      svg += '<path class="ln" pathLength="1" d="' + d + '" style="stroke:' + STY[k] + '"/>' +
             '<text class="end" x="' + (w - 136) + '" y="' + (Y(s.values[s.values.length - 1]) + 5) + '" style="fill:' + STY[k] + '">' + s.name + ' ' + s.values[s.values.length - 1] + '</text>';
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

  /* ── SCENE 5a · BANKS ──────────────────────────────────────────── */
  var T_BANK = 55;
  F.scene({
    id: 'bank', chapter: 'Institutional applications', ranges: [[T_BANK + SH, T_BANK + SH + LEN + 0.9]],
    build: function (ctx, s) {
      story(ctx, s, 'l', 'banker', 0.72, 'Banks', 'Lending assessment', 'See what a borrower has disclosed, and what it has not, before the credit decision.', 'Climactix organises a company’s sustainability record and flags the gaps worth asking about.');
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
      ctx.el(p, 'cxf-sub', 'Points to raise with the borrower');
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
      var s = this, v = t - SH - T_BANK, p = u.eio(u.seg(v, 0, 0.8)), i;
      storyFrame(ctx, s, v);
      ctx.css(s.e, 'clipPath', 'inset(0 ' + ((1 - p) * 100).toFixed(2) + '% 0 0)');
      ctx.tx(s.qt, 'Arvalis'.slice(0, Math.ceil(u.seg(v, 1.2, 2.0) * 7)));
      for (i = 0; i < s.rows.length; i++) {
        var r = s.rows[i];
        ctx.st(r.e, u.seg(v, 0.5 + i * 0.07, 1.0 + i * 0.07) * (r.hit ? 1 : 1 - 0.78 * u.seg(v, 2.0, 2.5)));
        if (r.hit) ctx.css(r.e, 'background', v >= 3.1 ? '#DCE7FF' : 'transparent');
      }
      ctx.st(s.panel, 0.4 + 0.6 * u.seg(v, 3.2, 3.7));
      ctx.rise(s.name, u.seg(v, 3.3, 3.8)); ctx.rise(s.sc, u.seg(v, 3.5, 4.0));
      ctx.tx(s.num, String(Math.round(s.val * u.eo(u.seg(v, 3.5, 4.6)))));
      for (i = 0; i < s.chips.length; i++) ctx.rise(s.chips[i], u.seg(v, 4.0 + i * 0.24, 4.4 + i * 0.24), 10);
      for (i = 0; i < s.gaps.length; i++) {
        var gp = u.eo(u.seg(v, 4.8 + i * 0.25, 5.7 + i * 0.25));
        ctx.st(s.gaps[i].f, undefined, 'scaleX(' + (s.gaps[i].v / 20 * gp).toFixed(4) + ')');
        ctx.tx(s.gaps[i].n, String(Math.round(s.gaps[i].v * gp)));
      }
      ctx.st(s.foot, u.seg(v, 5.5, 6.1));
    }
  });

  /* ── SCENE 5b · INSURANCE ──────────────────────────────────────── */
  var T_INS = 62;
  var EXPO = [['e1', 'GHG intensity'], ['e3', 'Water stress'], ['e4', 'Waste'], ['c3', 'Physical risk'], ['c1', 'Net zero target'], ['d1', 'Assurance']];
  F.scene({
    id: 'insurance', ranges: [[T_INS + SH, T_INS + SH + LEN + 0.9]],
    build: function (ctx, s) {
      story(ctx, s, 'r', 'engineers', 0.68, 'Insurers', 'Risk evaluation', 'Environmental exposure, organised for every corporate account.', 'Evidenced strengths, evidenced concerns and missing information are shown separately.');
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
          s.cells.push({ e: ctx.el(g, 'c ' + cls, it.state === 'missing' ? 'ND' : it.state === 'insufficient' ? 'IE' : String(it.value)), at: 1.3 + (r + k) * 0.16 });
        });
      });
      s.scan = ctx.el(p, 'cxf-scan');
      var side = ctx.el(e, 'cxf-p', '<div class="cxf-pt">Reading the screen</div>', 'left:948px;top:112px;width:408px;height:688px');
      s.side = side;
      s.leg = [['hi', 'Strong', '65 and above'], ['mid', 'Moderate', '40 to 64'], ['adv', 'Adverse performance', 'Evidenced, below 40'], ['ie', 'Insufficient evidence', 'Claim not traceable'], ['nd', 'Not disclosed', 'No public information']].map(function (l) {
        return ctx.el(side, 'cxf-leg', '<i class="c ' + l[0] + '"></i><div><b>' + l[1] + '</b><span>' + l[2] + '</span></div>');
      });
      s.foot = ctx.el(side, 'cxf-foot', 'Only evidenced values below 40 are reported as adverse. Missing data is shown as missing.');
      for (var i = 0; i < 14; i++) ctx.cue(T_INS + SH + 1.3 + i * 0.16, 'tick');
    },
    frame: function (t, ctx) {
      var s = this, v = t - SH - T_INS, p = u.eio(u.seg(v, 0, 0.8)), i;
      storyFrame(ctx, s, v);
      ctx.css(s.e, 'clipPath', 'inset(0 0 ' + ((1 - p) * 100).toFixed(2) + '% 0)');
      for (i = 0; i < s.names.length; i++) ctx.st(s.names[i], u.seg(v, 0.8 + i * 0.07, 1.3 + i * 0.07));
      for (i = 0; i < s.cells.length; i++) { var cp = u.eo(u.seg(v, s.cells[i].at, s.cells[i].at + 0.32)); ctx.st(s.cells[i].e, cp, 'scale(' + (0.6 + 0.4 * cp).toFixed(3) + ')'); }
      var sp = u.seg(v, 1.2, 3.8);
      ctx.st(s.scan, Math.sin(sp * Math.PI) * 0.8, 'translate3d(0,' + (sp * 560).toFixed(1) + 'px,0)');
      ctx.st(s.side, 0.4 + 0.6 * u.seg(v, 3.5, 4.0));
      for (i = 0; i < s.leg.length; i++) ctx.rise(s.leg[i], u.seg(v, 3.7 + i * 0.25, 4.2 + i * 0.25), 12);
      ctx.st(s.foot, u.seg(v, 5.2, 5.8));
    }
  });

  /* ── SCENE 5c · INVESTORS ──────────────────────────────────────── */
  var T_INV = 69;
  F.scene({
    id: 'investor', ranges: [[T_INV + SH, T_INV + SH + LEN + 0.9]],
    build: function (ctx, s) {
      story(ctx, s, 'l', 'analyst', 0.6, 'Investors', 'Portfolio review', 'Compare companies and see how a portfolio’s score is moving.', 'Scores, disclosure credibility and net zero commitments, side by side.', 'lift');
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
      var bp = ctx.el(e, 'cxf-p', '<div class="cxf-pt">Company comparison<span>Score</span></div>', 'left:860px;top:252px;width:496px;height:548px');
      s.bars = pf.holdings.slice().sort(function (a, b) { return b.score - a.score; }).slice(0, 8).map(function (h) {
        var x = ctx.el(bp, 'cxf-brow cmp', '<span>' + h.company.name + '</span><i><em></em></i><b>0</b>');
        return { f: x.querySelector('em'), n: x.querySelector('b'), v: h.score };
      });
    },
    frame: function (t, ctx) {
      var s = this, v = t - SH - T_INV, p = u.eio(u.seg(v, 0, 0.9)), i;
      storyFrame(ctx, s, v);
      ctx.st(s.e, u.seg(v, 0, 0.35), 'scale(' + (1.14 - 0.14 * p).toFixed(4) + ')');
      for (i = 0; i < s.kpi.length; i++) {
        ctx.rise(s.kpi[i].e, u.seg(v, 0.8 + i * 0.15, 1.4 + i * 0.15), 20);
        ctx.tx(s.kpi[i].n, Math.round(s.kpi[i].v * u.eo(u.seg(v, 1.0 + i * 0.15, 2.4 + i * 0.15))) + s.kpi[i].sfx);
      }
      drawLines(ctx, s.L, v, 1.7, 3.9);
      for (i = 0; i < s.bars.length; i++) {
        var bp = u.eo(u.seg(v, 2.0 + i * 0.2, 3.3 + i * 0.2));
        ctx.st(s.bars[i].f, undefined, 'scaleX(' + (s.bars[i].v / 100 * bp).toFixed(4) + ')');
        ctx.tx(s.bars[i].n, String(Math.round(s.bars[i].v * bp)));
      }
    }
  });

  /* ── SCENE 5d · GOVERNMENT ─────────────────────────────────────── */
  var T_GOV = 76;
  F.scene({
    id: 'government', ranges: [[T_GOV + SH, T_GOV + SH + LEN + 0.8]],
    build: function (ctx, s) {
      story(ctx, s, 'r', 'skyline', 0.56, 'Government', 'Policy planning', 'A sector and regional view of who is disclosing, and how well.', 'Aggregated corporate information to inform policy priorities.');
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
      var s = this, v = t - SH - T_GOV, p = u.eio(u.seg(v, 0, 0.9)), i;
      storyFrame(ctx, s, v);
      ctx.st(s.e, u.seg(v, 0, 0.5), 'perspective(1800px) rotateY(' + ((1 - p) * -62).toFixed(2) + 'deg)');
      for (i = 0; i < s.kpi.length; i++) {
        ctx.rise(s.kpi[i].e, u.seg(v, 0.8 + i * 0.15, 1.4 + i * 0.15), 20);
        ctx.tx(s.kpi[i].n, Math.round(s.kpi[i].v * u.eo(u.seg(v, 1.0 + i * 0.15, 2.5 + i * 0.15))).toLocaleString('en-US') + s.kpi[i].sfx);
      }
      for (i = 0; i < s.bars.length; i++) {
        var bp = u.eo(u.seg(v, 1.3 + i * 0.13, 2.6 + i * 0.13));
        ctx.st(s.bars[i].f, undefined, 'scaleX(' + (s.bars[i].v / 100 * bp).toFixed(4) + ')');
        ctx.tx(s.bars[i].n, String(Math.round(s.bars[i].v * bp)));
      }
      drawLines(ctx, s.L, v, 1.8, 3.8);
      for (i = 0; i < s.cols.length; i++) {
        var cp = u.eo(u.seg(v, 2.8 + i * 0.14, 4.1 + i * 0.14));
        ctx.st(s.cols[i].f, undefined, 'scaleY(' + (s.cols[i].h * cp).toFixed(4) + ')');
        ctx.tx(s.cols[i].n, String(Math.round(s.cols[i].v * cp)));
      }
    }
  });

  /* ── SCENE 6 · The bigger picture — companies, institutions, one platform ── */
  var HUB = [72.9, 19.1];
  /* [lon, lat, kind] — kind 1 = institution, 0 = company. An illustrative network, not a list of clients. */
  var NODES = [[-74, 40.7, 1], [-79.4, 43.7, 0], [-99.1, 19.4, 0], [-46.6, -23.5, 0], [-0.1, 51.5, 1], [8.7, 50.1, 1], [3.4, 6.5, 0], [28, -26.2, 0], [55.3, 25.2, 1],
               [77.2, 28.6, 1], [77.6, 13, 0], [88.4, 22.6, 0], [103.8, 1.35, 1], [106.8, -6.2, 0], [114.2, 22.3, 0], [139.7, 35.7, 1], [151.2, -33.9, 0], [37.6, 55.7, 0]];
  function PX(lon) { return 210 + (lon + 168) / 346 * 1500; }
  function PY(lat) { return 150 + (78 - lat) / 134 * 620; }
  F.scene({
    id: 'network', chapter: 'The bigger picture', ranges: [[86.6, 100.6]],
    build: function (ctx, s) {
      s.cv = document.createElement('canvas'); s.cv.width = 1920; s.cv.height = 1080; s.cv.className = 'cxf-map'; s.root.appendChild(s.cv); s.g = s.cv.getContext('2d');
      s.k = ctx.el(s.root, 'cxf-mapk', 'One platform, connecting companies and institutions');
      s.leg = ctx.el(s.root, 'cxf-legend', '<span><i style="background:#98A3B3"></i>Companies</span><span><i style="background:#1D4FD8"></i>Institutions</span><span><i style="background:#0E9F6E"></i>Climactix</span><span>Illustrative network</span>');
      var line = ctx.el(s.root, 'cxf-claim');
      s.w = ['One intelligence platform.', 'Multiple institutional applications.', 'Better-informed decisions.'].map(function (w) { return ctx.el(line, 'w', w); });
      s.dots = (window.CX_FILM_GEO || { dots: [] }).dots;
      ctx.cue(91.2, 'soft'); ctx.cue(93.0, 'soft'); ctx.cue(94.8, 'hit');
    },
    frame: function (t, ctx) {
      var s = this, g = s.g, out = 1 - u.seg(t, 99.0, 100.4), i, k;
      g.clearRect(0, 0, 1920, 1080);
      ctx.st(s.cv, out); ctx.st(s.k, u.seg(t, 87.4, 88.2) * out); ctx.st(s.leg, u.seg(t, 88.4, 89.2) * out);
      /* the land appears as a sweep from west to east */
      var sweep = u.seg(t, 86.8, 89.2);
      for (i = 0; i < s.dots.length; i++) {
        var d = s.dots[i], x = PX(d[0]), a = u.seg(sweep, (x - 210) / 1500 * 0.8, (x - 210) / 1500 * 0.8 + 0.2);
        if (a <= 0) continue;
        g.fillStyle = 'rgba(184,193,206,' + (0.85 * a).toFixed(3) + ')';
        g.beginPath(); g.arc(x, PY(d[1]), 2.3, 0, 6.283); g.fill();
      }
      var hx = PX(HUB[0]), hy = PY(HUB[1]);
      for (i = 0; i < NODES.length; i++) {
        var n = NODES[i], nx = PX(n[0]), ny = PY(n[1]), col = n[2] ? '29,79,216' : '122,135,153';
        var np = u.eo(u.seg(t, 88.6 + i * 0.09, 89.2 + i * 0.09)), ap = u.eio(u.seg(t, 89.6 + i * 0.12, 91.4 + i * 0.12));
        if (np <= 0) continue;
        /* arc to the hub, drawn progressively */
        var mx = (nx + hx) / 2, my = (ny + hy) / 2 - Math.abs(nx - hx) * 0.22 - 30;
        if (ap > 0) {
          g.strokeStyle = 'rgba(' + col + ',' + (n[2] ? 0.5 : 0.32) + ')'; g.lineWidth = n[2] ? 1.8 : 1.2;
          g.beginPath(); g.moveTo(nx, ny);
          for (k = 1; k <= 30; k++) { var q = k / 30 * ap, iq = 1 - q; g.lineTo(iq * iq * nx + 2 * iq * q * mx + q * q * hx, iq * iq * ny + 2 * iq * q * my + q * q * hy); }
          g.stroke();
          if (ap >= 1) {                                          // information travelling: companies inward, institutions outward
            var f = (t * 0.28 + i * 0.137) % 1, qq = n[2] ? 1 - f : f, iq2 = 1 - qq;
            g.fillStyle = 'rgba(' + (n[2] ? '14,159,110' : col) + ',' + (0.95 * Math.sin(f * Math.PI)).toFixed(3) + ')';
            g.beginPath(); g.arc(iq2 * iq2 * nx + 2 * iq2 * qq * mx + qq * qq * hx, iq2 * iq2 * ny + 2 * iq2 * qq * my + qq * qq * hy, 3.4, 0, 6.283); g.fill();
          }
        }
        g.fillStyle = '#FAF8F3'; g.beginPath(); g.arc(nx, ny, (n[2] ? 9 : 7) * np, 0, 6.283); g.fill();
        g.fillStyle = 'rgba(' + col + ',1)'; g.beginPath(); g.arc(nx, ny, (n[2] ? 6 : 4.5) * np, 0, 6.283); g.fill();
      }
      var hp = u.eo(u.seg(t, 88.2, 89.2));
      if (hp > 0) {
        var ph = (t % 2) / 2;
        g.strokeStyle = 'rgba(14,159,110,' + (0.5 * (1 - ph)).toFixed(3) + ')'; g.lineWidth = 2;
        g.beginPath(); g.arc(hx, hy, 14 + ph * 30, 0, 6.283); g.stroke();
        g.fillStyle = '#FAF8F3'; g.beginPath(); g.arc(hx, hy, 17 * hp, 0, 6.283); g.fill();
        g.fillStyle = '#0E9F6E'; g.beginPath(); g.arc(hx, hy, 12 * hp, 0, 6.283); g.fill();
      }
      for (i = 0; i < s.w.length; i++) ctx.rise(s.w[i], u.seg(t, 91.2 + i * 1.8, 92.1 + i * 1.8) * out, 22);
    }
  });

  /* ── SCENE 7 · Brand reveal ────────────────────────────────────── */
  F.scene({
    id: 'close', chapter: 'Climactix Terminal', ranges: [[100, 111]],
    build: function (ctx, s) {
      s.logo = ctx.el(s.root, 'cxf-logo', '<img src="Climatix_logo.png" alt="Climactix Global">');
      s.title = ctx.el(s.root, 'cxf-title', 'CLIMACTIX TERMINAL');
      s.rule = ctx.el(s.root, 'cxf-rule');
      s.sub = ctx.el(s.root, 'cxf-subt', 'Corporate Sustainability Intelligence. All in One Place.');
      ctx.cue(101.4, 'hit');
    },
    frame: function (t, ctx) {
      var lp = u.eo(u.seg(t, 100.6, 102)), tp = u.eo(u.seg(t, 101.6, 103.4));
      ctx.st(this.logo, lp, 'translate(-50%,' + ((1 - lp) * 30).toFixed(1) + 'px) scale(' + (0.92 + 0.08 * lp).toFixed(4) + ')');
      ctx.st(this.title, tp);
      ctx.css(this.title, 'letterSpacing', (0.42 - 0.24 * tp).toFixed(4) + 'em');
      ctx.st(this.rule, u.seg(t, 102.6, 103), 'translate(-50%,0) scaleX(' + u.eio(u.seg(t, 102.6, 104)).toFixed(4) + ')');
      ctx.rise(this.sub, u.seg(t, 103.2, 104.2), 18);
    }
  });
})();
