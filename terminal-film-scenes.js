/* ════════════════════════════════════════════════════════════════════
   CLIMACTIX TERMINAL — PRODUCT FILM · SCENES 1–4
   1 The global challenge (0–14 s)     world · papers   real footage
   2 The Climactix solution (14–25)    papers · identity · term · index
   3 The terminal (25–44)              profile
   4 The intelligence engine (44–60)   score

   Each scene: { id, ranges:[[start,end],...], build(ctx, scene), frame(t, ctx) }
   frame(t) paints the complete state for time t (no accumulated state).
   Footage comes from the Climactix brand reels (terminal-film-assets/).
   All figures come from window.CX_TERMINAL_DEMO, the same demonstration
   dataset the interactive terminal uses.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var F = window.CXFilm, u = F.u, D = window.CX_TERMINAL_DEMO;

  /* The company the film follows. A synthetic entity, so that no real company
     is shown with an invented score. Change this id to feature another profile. */
  var FEATURED = 'corvane';
  var co = D.company(FEATURED), sc = D.score(FEATURED), hist = D.history(FEATURED);
  F.featured = FEATURED;
  /* The product scenes were timed on their own clock; SH places them in the film. */
  var SH = 4;

  F.caption(1.0, 7.2, 'Every day, businesses generate enormous amounts of sustainability information.', true);
  F.caption(7.6, 13.4, 'Yet for institutions making critical decisions, this information remains fragmented.', true);
  F.caption(16.4, 23.6, 'Climactix brings corporate sustainability information together through a unified intelligence platform.');
  F.caption(33.8, 37.8, 'Search any company. See every disclosure it has published.');
  F.caption(38.4, 43.4, 'Reports, net zero commitments, climate disclosures and history, in one place.');
  F.caption(52.4, 58.6, 'From fragmented disclosures to structured, explainable corporate sustainability intelligence.');

  function chip(state) {
    return state === 'missing' ? '<span class="cxf-chip nd">Not disclosed</span>'
         : state === 'insufficient' ? '<span class="cxf-chip ie">Insufficient evidence</span>'
         : state === 'adverse' ? '<span class="cxf-chip adv">Adverse performance</span>'
         : '<span class="cxf-chip ok">Evidenced</span>';
  }
  F.chip = chip;

  /* ── SCENE 1 · The global challenge — a montage of real footage ── */
  /* [clip, start, end, playback rate, wipe direction] */
  var SHOTS = [['plant', 0, 2.8, 0.9, 0], ['port', 2.6, 5.1, 1, 1], ['construction', 4.9, 7.0, 0.9, 2], ['highway', 6.8, 9.2, 0.95, 3], ['harvest', 9.0, 11.2, 1.4, 1], ['orbit', 11.0, 15.2, 1, 0]];
  F.scene({
    id: 'world', chapter: 'The global challenge', ranges: [[0, 15.4]],
    build: function (ctx, s) {
      s.wrap = ctx.el(s.root, 'cxf-world');
      s.shots = SHOTS.map(function (d) {
        var box = ctx.el(s.wrap, 'cxf-shot');
        return { box: box, clip: ctx.video(box, d[0]), a: d[1], b: d[2], rate: d[3], dir: d[4] };
      });
      ctx.el(s.wrap, 'cxf-shade');
    },
    frame: function (t, ctx) {
      var s = this, out = u.eio(u.seg(t, 13.4, 15.2));
      /* the world recedes into a framed picture as the bright environment arrives */
      ctx.css(s.wrap, 'clipPath', 'inset(' + (out * 26).toFixed(2) + '% ' + (out * 30).toFixed(2) + '% round ' + (out * 60).toFixed(1) + 'px)');
      ctx.st(s.wrap, u.seg(t, 0, 0.9) * (1 - u.seg(t, 14.2, 15.3)));
      for (var i = 0; i < s.shots.length; i++) {
        var h = s.shots[i], on = t >= h.a && t < h.b + 0.8;
        if (h.box._d !== on) { h.box._d = on; h.box.style.display = on ? '' : 'none'; }
        if (!on) continue;
        var p = i === 0 ? 1 : u.eio(u.seg(t, h.a, h.a + 0.8)), r = ((1 - p) * 100).toFixed(2) + '%';
        ctx.css(h.box, 'clipPath', h.dir === 0 ? 'none' : h.dir === 1 ? 'inset(0 0 0 ' + r + ')' : h.dir === 2 ? 'inset(0 ' + r + ' 0 0)' : 'inset(' + r + ' 0 0 0)');
        var k = u.seg(t, h.a, h.b + 0.8);                       // slow push through the shot
        ctx.st(h.clip.v, undefined, 'scale(' + (1.04 + 0.08 * k).toFixed(4) + ') translate3d(' + ((1 - p) * (h.dir === 1 ? 3 : h.dir === 2 ? -3 : 0)).toFixed(2) + '%,0,0)');
        ctx.clip(h.clip, Math.max(0, t - h.a) * h.rate, h.rate);
      }
    }
  });

  /* ── SCENE 1–2 · Disclosures: scattered across sources, then brought together ── */
  var PAPERS = [['Sustainability report', 'Company website · PDF'], ['BRSR disclosure', 'Exchange filing'], ['Net zero commitment', 'Press release'], ['Climate report', 'Separate publication'],
    ['ESG report', 'Investor presentation'], ['Annual report', '312 pages'], ['Emissions data', 'Regulatory filing'], ['Water and waste data', 'Site-level report'],
    ['Assurance statement', 'Appendix'], ['Supplier policy', 'Web page'], ['Board charter', 'Governance report'], ['Transition plan', 'Not yet published']];
  F.scene({
    id: 'papers', ranges: [[3.4, 20.6]],
    build: function (ctx, s) {
      var r = u.rng(23);
      s.cards = PAPERS.map(function (p, i) {
        var col = i % 4, row = Math.floor(i / 4);
        return { e: ctx.el(s.root, 'cxf-paper', '<i></i><b>' + p[0] + '</b><span>' + p[1] + '</span><u></u><u></u>'),
                 x: 1160 + (i % 3) * 232 + (r() * 2 - 1) * 60 - (i % 2) * 700 * (i > 5 ? 1 : 0), y: 90 + ((i * 197) % 560) + (r() * 2 - 1) * 30,
                 rot: (r() * 2 - 1) * 9, at: 3.6 + i * 0.62, ph: r() * 6.28,
                 gx: 960 - 2 * 270 + col * 270 + 9, gy: 250 + row * 170, d: i * 0.07 };
      });
      /* keep the scattered layout readable: spread over the right two-thirds, away from the caption */
      var slots = [[1130, 70], [1430, 150], [1620, 60], [1250, 300], [1560, 330], [960, 180], [1380, 500], [1640, 560], [1100, 520], [820, 60], [1500, 730], [1180, 760]];
      s.cards.forEach(function (c, i) { c.x = slots[i][0]; c.y = slots[i][1]; });
      for (var i = 0; i < PAPERS.length; i++) ctx.cue(3.6 + i * 0.62, 'tick');
    },
    frame: function (t, ctx) {
      var s = this, g = ctx.bg, i;
      /* broken links between sources: nothing connects */
      var la = u.seg(t, 9.5, 11) * (1 - u.seg(t, 14.4, 15.6));
      if (la > 0.01) {
        g.setLineDash([3, 9]); g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,' + (0.55 * la).toFixed(3) + ')';
        for (i = 0; i < s.cards.length - 1; i += 1) {
          var a = s.cards[i], b = s.cards[(i + 3) % s.cards.length];
          var mx = (a.x + b.x) / 2 + 126, my = (a.y + b.y) / 2 + 50;
          g.beginPath(); g.moveTo(a.x + 126, a.y + 50); g.lineTo(u.lerp(a.x + 126, mx, 0.7), u.lerp(a.y + 50, my, 0.7)); g.stroke();
        }
        g.setLineDash([]);
      }
      for (i = 0; i < s.cards.length; i++) {
        var c = s.cards[i], ap = u.seg(t, c.at, c.at + 0.6);
        var q = u.eio(u.seg(t, 14.6 + c.d, 16.8 + c.d)), z = u.eio(u.seg(t, 18.0 + c.d * 0.5, 19.4 + c.d * 0.5));
        var dx = Math.sin(t * 0.45 + c.ph) * 10 * (1 - q), dy = Math.cos(t * 0.38 + c.ph) * 8 * (1 - q) + (1 - u.eo(ap)) * 26;
        var x = u.lerp(u.lerp(c.x + dx, c.gx, q), 960 - 126, z), y = u.lerp(u.lerp(c.y + dy, c.gy, q), 470 - 50, z);
        ctx.st(c.e, ap * (1 - u.seg(z, 0.55, 1)), 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) rotate(' + (c.rot * (1 - q)).toFixed(2) + 'deg) scale(' + u.lerp(1, 0.3, z).toFixed(3) + ')');
      }
    }
  });

  F.scene({
    id: 'identity', chapter: 'The Climactix solution', ranges: [[17.8, 23.4]],
    build: function (ctx, s) {
      s.ring = ctx.el(s.root, 'cxf-idring');
      s.tile = ctx.el(s.root, 'cxf-id', '<img src="Climatix_logo.png" alt="Climactix Global">');
      ctx.cue(18.9, 'hit');
    },
    frame: function (t, ctx) {
      var p = u.eo(u.seg(t, 18.4, 19.6)), out = u.eio(u.seg(t, 21.2, 22.8));
      ctx.st(this.tile, p * (1 - out), 'scale(' + ((0.7 + 0.3 * p) * (1 - 0.35 * out)).toFixed(4) + ') translate3d(0,' + (-out * 60).toFixed(1) + 'px,0)');
      var rp = u.seg(t, 19.0, 20.6);
      ctx.st(this.ring, (rp > 0 ? 0.6 * (1 - rp) : 0), 'scale(' + (1 + rp * 0.35).toFixed(4) + ')');
    }
  });

  /* ── The terminal window (scene 2 to the end of scene 5) ───────── */
  var RAIL = ['Dashboard', 'Company Intelligence', 'Intelligence Score', 'Report Repository', 'Bank Intelligence', 'Insurance Intelligence', 'Investor Intelligence', 'Government Intelligence'];
  /* camera on the product clock: [time, scale, focusX, focusY]; focus is relative to the window centre.
     From 55 s the window steps aside, left or right, to share the frame with each institution's footage. */
  var CAM = [[16.8, 0.86, 0, -70], [18.8, 1, 0, 0], [25, 1, 0, 0], [26.6, 1.7, 0, -330], [28.6, 1.7, 0, -300], [30.2, 1, 0, 0], [32.6, 1, 0, 0],
             [34.4, 1.8, -150, -90], [36.2, 1.8, -150, -90], [38, 1.8, 265, 140], [39.5, 1.8, 265, 140], [40.9, 1, 0, 0], [43, 1, 0, 0], [54.4, 1.04, 0, 0],
             [55.6, 0.68, -530, -40], [61.6, 0.68, -530, -40], [62.8, 0.68, 530, -40], [68.6, 0.68, 530, -40], [69.8, 0.68, -530, -40], [75.6, 0.68, -530, -40], [76.8, 0.68, 530, -40], [83.4, 0.68, 530, -40]];
  var CUR = [[27.0, 1250, 520, 0], [27.3, 1250, 520, 1], [28.1, 800, 78, 1], [28.9, 800, 78, 1], [29.4, 900, 300, 0],
             [56.9, 1150, 640, 0], [57.2, 1150, 640, 1], [58.0, 444, 445, 1], [58.8, 444, 445, 1], [59.3, 620, 520, 0]];
  var CLICKS = [28.2, 58.1];
  F.scene({
    id: 'term', ranges: [[16.6 + SH, 83.6 + SH]],
    build: function (ctx, s) {
      var win = ctx.el(s.root, 'cxf-win');
      ctx.el(win, 'cxf-bar',
        '<img src="Climatix_logo.png" alt=""><b>CLIMACTIX TERMINAL</b><span class="cxf-crumb"></span>' +
        '<div class="cxf-search"><svg width="18" height="18" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.5"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><span class="cxf-q"></span><i class="cxf-caret"></i><span class="cxf-ph">Search company, industry or city</span></div>' +
        '<span class="cxf-bar-r">DEMONSTRATION DATA</span>');
      var rail = ctx.el(win, 'cxf-rail');
      s.items = RAIL.map(function (n, i) { return ctx.el(rail, 'cxf-ri', '<i>0' + (i + 1) + '</i>' + n); });
      s.win = win; s.crumb = win.querySelector('.cxf-crumb'); s.q = win.querySelector('.cxf-q'); s.caret = win.querySelector('.cxf-caret'); s.ph = win.querySelector('.cxf-ph');
      var body = ctx.el(win, 'cxf-body');
      s.cur = ctx.el(win, 'cxf-cur', '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M5 3l14 8-6 1.6L10 19z" fill="#0B1F3A" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>');
      s.ring = ctx.el(win, 'cxf-ring');
      ctx.term = { win: win, body: body, screen: function (cls) { return ctx.el(body, 'cxf-screen ' + cls); } };
      for (var i = 0; i < 7; i++) ctx.cue(25.8 + i * 0.21 + SH, 'tick');
      ctx.cue(28.2 + SH, 'soft'); ctx.cue(58.1 + SH, 'soft');
    },
    frame: function (t, ctx) {
      t -= SH;
      var s = this, c = u.kf(t, CAM);
      ctx.st(s.win, u.seg(t, 16.8, 18.2) * (1 - u.seg(t, 82.6, 83.5)),
        'translate3d(' + (-c[1] * c[0]).toFixed(2) + 'px,' + (-c[2] * c[0]).toFixed(2) + 'px,0) scale(' + c[0].toFixed(4) + ')');
      var act = t < 29 ? 0 : t < 40.4 ? 1 : t < 55.3 ? 2 : t < 62.3 ? 4 : t < 69.3 ? 5 : t < 76.3 ? 6 : 7;
      for (var i = 0; i < s.items.length; i++) { var on = i === act; if (s.items[i]._a !== on) { s.items[i]._a = on; s.items[i].classList.toggle('on', on); } }
      ctx.tx(s.crumb, '/ ' + RAIL[act]);
      var name = co.name.split(' ')[0];
      var q = t < 25.8 ? '' : t < 27.3 ? name.slice(0, Math.ceil(u.seg(t, 25.8, 27.3) * name.length)) : t < 28.3 ? name : co.name;
      ctx.tx(s.q, q);
      ctx.st(s.ph, q ? 0 : 1);
      ctx.st(s.caret, t > 25.4 && t < 28.6 && (t * 2) % 1 < 0.55 ? 1 : 0);
      var k = u.kf(t, CUR);
      ctx.st(s.cur, k[2], 'translate3d(' + k[0].toFixed(1) + 'px,' + k[1].toFixed(1) + 'px,0)');
      var rp = 0, rk = 0;
      for (var j = 0; j < CLICKS.length; j++) if (t >= CLICKS[j] && t < CLICKS[j] + 0.6) { rp = (t - CLICKS[j]) / 0.6; rk = 1; }
      ctx.st(s.ring, rk * (1 - rp), 'translate3d(' + k[0].toFixed(1) + 'px,' + k[1].toFixed(1) + 'px,0) scale(' + (0.3 + rp * 1.6).toFixed(3) + ')');
    }
  });

  /* ── SCENE 2 · Unified disclosure index ────────────────────────── */
  F.scene({
    id: 'index', ranges: [[16.6 + SH, 29.2 + SH]],
    build: function (ctx, s) {
      var e = ctx.term.screen('cxf-index'), p = D.platform(), i;
      s.els.push(e); s.e = e;
      var all = D.reports({ fy: D.meta.currentFy }), rows = [];
      for (i = 0; i < all.length && rows.length < 12; i += 4) rows.push(all[i]);
      var left = ctx.el(e, 'cxf-p', '<div class="cxf-pt">Disclosure index<span>Unified · searchable</span></div><div class="cxf-th"><span>Company</span><span>Document</span><span>Year</span><span>Status</span></div>', 'left:24px;top:24px;width:860px;height:776px');
      s.rows = rows.map(function (r) {
        return ctx.el(left, 'cxf-tr', '<span><b>' + r.company + '</b></span><span>' + r.categoryName + '</span><span>' + r.fy + '</span><span><em class="cxf-chip ok">Indexed</em></span>');
      });
      var K = [['Companies indexed', p.companies], ['Reports available', p.reports], ['Companies assessed', p.assessed], ['Disclosure categories', D.categories.length]];
      s.kpi = K.map(function (k, n) {
        var b = ctx.el(e, 'cxf-p cxf-kpi', '<span>' + k[0] + '</span><b>0</b>', 'left:' + (908 + (n % 2) * 228) + 'px;top:' + (24 + Math.floor(n / 2) * 148) + 'px;width:220px;height:136px');
        return { e: b, n: b.querySelector('b'), v: k[1] };
      });
      var right = ctx.el(e, 'cxf-p', '<div class="cxf-pt">Reports by category</div>', 'left:908px;top:320px;width:448px;height:480px');
      var max = p.reportTotals.AR;
      s.bars = D.categories.map(function (c) {
        var b = ctx.el(right, 'cxf-brow', '<span>' + c.name + '</span><i><em></em></i><b>0</b>');
        return { f: b.querySelector('em'), n: b.querySelector('b'), v: p.reportTotals[c.key], w: p.reportTotals[c.key] / max };
      });
      for (i = 0; i < 12; i++) ctx.cue(18.6 + i * 0.36 + SH, 'tick');
    },
    frame: function (t, ctx) {
      t -= SH;
      var s = this;
      ctx.st(s.e, u.seg(t, 17.4, 18.3) * (1 - u.seg(t, 28.5, 29.1)));
      for (var i = 0; i < s.rows.length; i++) {
        var p = u.seg(t, 18.6 + i * 0.36, 19.15 + i * 0.36);
        ctx.st(s.rows[i], p, 'translate3d(' + ((1 - u.eo(p)) * -36).toFixed(1) + 'px,0,0)');
      }
      var c = u.eo(u.seg(t, 18.4, 23.6));
      for (var k = 0; k < s.kpi.length; k++) ctx.tx(s.kpi[k].n, Math.round(s.kpi[k].v * c).toLocaleString('en-US'));
      for (var b = 0; b < s.bars.length; b++) {
        var bp = u.eo(u.seg(t, 19.4 + b * 0.3, 21.8 + b * 0.3));
        ctx.st(s.bars[b].f, undefined, 'scaleX(' + (s.bars[b].w * bp).toFixed(4) + ')');
        ctx.tx(s.bars[b].n, Math.round(s.bars[b].v * bp).toLocaleString('en-US'));
      }
    }
  });

  /* ── SCENE 3 · Company search and intelligence profile ─────────── */
  F.scene({
    id: 'profile', chapter: 'The terminal', ranges: [[25 + SH, 40.9 + SH]],
    build: function (ctx, s) {
      var others = D.companies().filter(function (c) { return c.synthetic && c.id !== co.id; }).slice(0, 2);
      s.drop = ctx.el(ctx.term.win, 'cxf-drop',
        '<div class="hit"><b>' + co.name + '</b><span>' + co.industry + ' · ' + co.city + '</span></div>' +
        others.map(function (o) { return '<div class="alt"><b>' + o.name + '</b><span>' + o.industry + ' · ' + o.city + '</span></div>'; }).join(''));
      s.els.push(s.drop);
      s.hit = s.drop.querySelector('.hit'); s.alts = s.drop.querySelectorAll('.alt');

      var e = ctx.term.screen('cxf-profile'), i;
      s.els.push(e); s.e = e;
      s.head = ctx.el(e, 'cxf-ph-head', '<small>Corporate intelligence profile</small><h2>' + co.name + '</h2>', 'left:24px;top:20px');
      s.tags = ctx.el(e, 'cxf-tags', '<span class="cxf-chip nd">Synthetic entity</span><span class="cxf-chip nd">' + co.industry + '</span><span class="cxf-chip nd">' + co.city + ', ' + co.state + '</span><span class="cxf-chip nd">Assessed ' + co.assessedOn + '</span>', 'left:24px;top:108px');

      s.pMatrix = ctx.el(e, 'cxf-p', '<div class="cxf-pt">Disclosure availability<span>' + D.reports({ company: co.id }).length + ' documents held</span></div>', 'left:24px;top:152px;width:800px;height:322px');
      var grid = ctx.el(s.pMatrix, 'cxf-mx', '<span></span>' + D.years.map(function (y) { return '<span class="h">' + y.replace('FY20', 'FY') + '</span>'; }).join(''));
      s.cells = [];
      D.categories.forEach(function (cat, r) {
        ctx.el(grid, 'l', cat.name);
        D.years.forEach(function (fy, c) {
          var has = D.reports({ company: co.id, category: cat.key, fy: fy }).length > 0;
          s.cells.push({ e: ctx.el(grid, 'c' + (has ? ' has' : ''), has ? '✓' : ''), at: 31.2 + (c * 6 + r) * 0.11 });
        });
      });

      s.pNz = ctx.el(e, 'cxf-p', '<div class="cxf-pt">Net zero commitment</div>', 'left:840px;top:152px;width:516px;height:322px');
      s.nz = [['Commitment', '<b>' + co.netZero.target + '</b>'], ['Boundary', co.netZero.boundary], ['Interim milestones', co.netZero.interim], ['Evidence status', chip('evidenced')]].map(function (r) {
        return ctx.el(s.pNz, 'cxf-kv', '<span>' + r[0] + '</span><div>' + r[1] + '</div>');
      });

      s.pCl = ctx.el(e, 'cxf-p', '<div class="cxf-pt">Climate disclosures</div>', 'left:24px;top:490px;width:560px;height:310px');
      s.cl = sc.dims[3].indicators.map(function (it) {
        return ctx.el(s.pCl, 'cxf-kv wide', '<span>' + it.label + '</span><div>' + chip(it.adverse ? 'adverse' : it.state) + (it.value != null ? '<b class="n">' + it.value + '</b>' : '') + '</div>');
      });

      s.pHist = ctx.el(e, 'cxf-p', '<div class="cxf-pt">Historical assessment record<span>Public Data Score</span></div>', 'left:600px;top:490px;width:756px;height:310px');
      var W = 700, H = 200, min = Math.floor((hist[0].score - 6) / 10) * 10, max = min + 30;
      var X = function (n) { return 40 + (W - 70) * n / 4; }, Y = function (v) { return 16 + (H - 50) * (1 - (v - min) / (max - min)); };
      var d = hist.map(function (h, n) { return (n ? 'L' : 'M') + X(n).toFixed(1) + ' ' + Y(h.score).toFixed(1); }).join('');
      var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '">';
      for (i = 0; i <= 3; i++) svg += '<line x1="40" x2="' + (W - 30) + '" y1="' + Y(min + i * 10) + '" y2="' + Y(min + i * 10) + '" class="gl"/><text x="30" y="' + (Y(min + i * 10) + 5) + '" text-anchor="end">' + (min + i * 10) + '</text>';
      svg += '<path class="ln" pathLength="1" d="' + d + '"/>';
      hist.forEach(function (h, n) {
        svg += '<g class="pt"><circle cx="' + X(n) + '" cy="' + Y(h.score) + '" r="6"/><text class="v" x="' + X(n) + '" y="' + (Y(h.score) - 14) + '" text-anchor="middle">' + h.score + '</text></g><text x="' + X(n) + '" y="' + (H - 6) + '" text-anchor="middle">' + h.fy.replace('FY20', 'FY') + '</text>';
      });
      var box = ctx.el(s.pHist, 'cxf-chart', svg + '</svg>');
      s.line = box.querySelector('.ln'); s.pts = box.querySelectorAll('.pt');
      for (i = 0; i < 30; i += 3) ctx.cue(31.2 + i * 0.11 + SH, 'tick');
    },
    frame: function (t, ctx) {
      t -= SH;
      var s = this, i;
      ctx.st(s.drop, u.win(t, 26.0, 26.3, 28.4, 28.7));
      for (i = 0; i < s.alts.length; i++) ctx.st(s.alts[i], 0.5 * (1 - u.seg(t, 26.5, 27)));
      ctx.css(s.hit, 'background', t >= 28.15 ? '#DCE7FF' : t >= 27.9 ? '#EEF3FF' : 'transparent');
      ctx.st(s.e, u.seg(t, 28.9, 29.5) * (1 - u.seg(t, 40.1, 40.8)));
      ctx.rise(s.head, u.seg(t, 29.0, 29.6)); ctx.rise(s.tags, u.seg(t, 29.3, 29.9));
      ctx.rise(s.pMatrix, u.seg(t, 29.6, 30.3), 28); ctx.rise(s.pNz, u.seg(t, 30.0, 30.7), 28);
      ctx.rise(s.pCl, u.seg(t, 30.4, 31.1), 28); ctx.rise(s.pHist, u.seg(t, 30.8, 31.5), 28);
      for (i = 0; i < s.cells.length; i++) { var p = u.eo(u.seg(t, s.cells[i].at, s.cells[i].at + 0.3)); ctx.st(s.cells[i].e, p, 'scale(' + (0.5 + 0.5 * p).toFixed(3) + ')'); }
      for (i = 0; i < s.nz.length; i++) ctx.rise(s.nz[i], u.seg(t, 31.0 + i * 0.4, 31.6 + i * 0.4));
      for (i = 0; i < s.cl.length; i++) ctx.rise(s.cl[i], u.seg(t, 35.2 + i * 0.4, 35.8 + i * 0.4));
      var lp = u.eio(u.seg(t, 36.8, 39));
      ctx.css(s.line, 'strokeDashoffset', (1 - lp).toFixed(4));
      for (i = 0; i < s.pts.length; i++) ctx.st(s.pts[i], u.seg(lp, i / 4 - 0.02, i / 4 + 0.06));
    }
  });

  /* ── SCENE 4 · The intelligence engine ─────────────────────────── */
  var GR = 132, GLEN = 2 * Math.PI * GR * 0.75;
  F.scene({
    id: 'score', chapter: 'The intelligence engine', ranges: [[40 + SH, 55.8 + SH]],
    build: function (ctx, s) {
      var e = ctx.term.screen('cxf-score');
      s.els.push(e); s.e = e;
      s.cv = document.createElement('canvas'); s.cv.width = 1380; s.cv.height = 824; e.appendChild(s.cv); s.g = s.cv.getContext('2d');
      ctx.el(e, 'cxf-ph-head', '<small>Climactix Intelligence Score · analysing public disclosures</small><h2>' + co.name + '</h2>', 'left:24px;top:14px');

      var ieL = -1, ieC = -1;
      s.lanes = sc.dims.map(function (d, L) {
        var top = 118 + L * 136;
        var lane = ctx.el(e, 'cxf-lane', '<div class="nm"><b>' + d.name + '</b><span>Weight ' + d.weight + '%</span></div><div class="cells"></div><div class="ds">—</div><div class="trk"><i></i></div>', 'top:' + top + 'px');
        var cw = lane.querySelector('.cells');
        var cells = d.indicators.map(function (it, i) {
          var at = 42.6 + L * 0.9 + i * 0.35;
          ctx.cue(at + SH, 'tick');
          if (ieL < 0 && it.state !== 'evidenced') { ieL = L; ieC = i; }
          return { e: ctx.el(cw, 'cell'), it: it, at: at, seed: L * 7 + i * 13 };
        });
        return { e: lane, cells: cells, ds: lane.querySelector('.ds'), fill: lane.querySelector('.trk i'), d: d, y: top + 60 };
      });
      s.note = ctx.el(e, 'cxf-note', 'Not enough evidence. Left out of the score, never counted as zero.', 'left:' + (322 + Math.max(0, ieC) * 100) + 'px;top:' + (118 + Math.max(0, ieL) * 136 + 92) + 'px');
      s.hasNote = ieL >= 0;

      var right = ctx.el(e, 'cxf-p cxf-hero', '<div class="cxf-pt">Climactix Score<span>Public data</span></div>' +
        '<div class="gz"><svg width="300" height="300" viewBox="0 0 300 300"><circle class="trk" cx="150" cy="150" r="' + GR + '" stroke-width="20" stroke-dasharray="' + GLEN.toFixed(1) + ' 2000" transform="rotate(135 150 150)"/>' +
        '<circle class="arc" cx="150" cy="150" r="' + GR + '" stroke-width="20" stroke-dasharray="' + GLEN.toFixed(1) + ' 2000" stroke-dashoffset="' + GLEN.toFixed(1) + '" transform="rotate(135 150 150)"/></svg>' +
        '<div class="big"><b>0</b><span>out of 100</span></div></div>' +
        '<div class="row"><em>' + sc.band.grade + '</em><div class="band">' + sc.band.label + '</div></div><div class="fx"></div>', 'left:880px;top:24px;width:476px;height:452px');
      s.big = right.querySelector('.big b'); s.grade = right.querySelector('.row em'); s.band = right.querySelector('.band'); s.arc = right.querySelector('.arc'); s.fx = right.querySelector('.fx'); s.hero = right;
      s.formula = '( ' + sc.dims.map(function (d) { return d.score + ' × ' + d.weight; }).join(' + ') + ' )\n÷ ' + sc.weightScored + ' = ' + sc.overall;

      var cf = sc.confidence;
      var conf = ctx.el(e, 'cxf-p cxf-conf', '<div class="cxf-pt">Data confidence<span>Reported separately</span></div><div class="cv"><b>0</b><em class="cxf-chip ok">' + cf.band + '</em></div>', 'left:880px;top:492px;width:476px;height:308px');
      s.conf = conf; s.cn = conf.querySelector('.cv b'); s.cc = conf.querySelector('.cv em');
      s.cb = [['Completeness', cf.completeness], ['Traceability', cf.traceability], ['Reliability', cf.reliability]].map(function (r) {
        var b = ctx.el(conf, 'cxf-brow', '<span>' + r[0] + '</span><i><em></em></i><b>0</b>');
        return { f: b.querySelector('em'), n: b.querySelector('b'), v: r[1] };
      });
      ctx.cue(50.2 + SH, 'hit'); ctx.cue(52.9 + SH, 'soft');
    },
    frame: function (t, ctx) {
      t -= SH;
      var s = this, g = s.g, L, i;
      ctx.st(s.e, u.seg(t, 40.4, 41.2) * (1 - u.seg(t, 55.0, 55.7)));
      g.clearRect(0, 0, 1380, 824);
      var flow = u.seg(t, 41.4, 42.2) * (1 - u.seg(t, 50.4, 51.4));
      for (L = 0; L < s.lanes.length; L++) {
        var ln = s.lanes[L], sum = 0, n = 0, done = 0;
        ctx.rise(ln.e, u.seg(t, 41.0 + L * 0.22, 41.7 + L * 0.22), 24);
        for (i = 0; i < ln.cells.length; i++) {
          var c = ln.cells[i], r = t >= c.at, pop = u.seg(t, c.at, c.at + 0.28);
          var label = r ? (c.it.state === 'evidenced' ? String(c.it.value) : c.it.state === 'insufficient' ? 'IE' : 'ND')
                        : String(10 + (Math.floor(t * 16) * 37 + c.seed * 53) % 89);
          ctx.tx(c.e, label);
          var cls = 'cell' + (r ? (c.it.state === 'evidenced' ? (c.it.adverse ? ' adv' : ' ok') : c.it.state === 'insufficient' ? ' ie' : ' nd') : '');
          if (c.e._k !== cls) { c.e._k = cls; c.e.className = cls; }
          ctx.st(c.e, undefined, 'scale(' + (r ? 1 + 0.16 * (1 - u.eo(pop)) : 1).toFixed(3) + ')');
          if (r) { done++; if (c.it.state === 'evidenced') { sum += c.it.value; n++; } }
        }
        var val = n ? Math.round(sum / n) : null;
        ctx.tx(ln.ds, val == null ? '—' : String(val));
        ctx.st(ln.fill, undefined, 'scaleX(' + ((val || 0) / 100 * u.eo(u.seg(t, ln.cells[0].at, ln.cells[3].at + 0.6))).toFixed(4) + ')');
        var busy = flow * (done < 4 ? 1 : 1 - u.seg(t, ln.cells[3].at, ln.cells[3].at + 0.8));
        if (busy > 0.01) for (i = 0; i < 9; i++) {
          var x = 44 + ((t * 0.34 + i / 9 + L * 0.13) % 1) * 786;
          g.fillStyle = 'rgba(29,79,216,' + (0.5 * busy).toFixed(3) + ')';
          g.fillRect(x, ln.y + 45, 14, 3);
        }
        var send = u.seg(t, 46.6 + L * 0.2, 50.2);
        if (send > 0 && send < 1) {
          g.strokeStyle = 'rgba(29,79,216,' + (0.45 * Math.sin(send * Math.PI)).toFixed(3) + ')'; g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(850, ln.y); g.bezierCurveTo(900, ln.y, 860, 230, 908, 230); g.stroke();
          for (i = 0; i < 3; i++) {
            var q = (send * 2.2 + i * 0.33) % 1, iq = 1 - q;
            var bx = iq * iq * iq * 850 + 3 * iq * iq * q * 900 + 3 * iq * q * q * 860 + q * q * q * 908;
            var by = iq * iq * iq * ln.y + 3 * iq * iq * q * ln.y + 3 * iq * q * q * 230 + q * q * q * 230;
            g.fillStyle = 'rgba(14,159,110,' + (0.95 * Math.sin(send * Math.PI)).toFixed(3) + ')';
            g.beginPath(); g.arc(bx, by, 3, 0, 6.283); g.fill();
          }
        }
      }
      ctx.st(s.note, s.hasNote ? u.seg(t, 46.9, 47.5) * (1 - u.seg(t, 53.6, 54.4)) : 0);
      ctx.rise(s.hero, u.seg(t, 41.2, 42), 24);
      var cp = u.eo(u.seg(t, 47.6, 50.2));
      ctx.tx(s.big, String(Math.round(sc.overall * cp)));
      ctx.css(s.arc, 'strokeDashoffset', (GLEN * (1 - sc.overall / 100 * cp)).toFixed(2));
      var gp = u.seg(t, 50.2, 50.6);
      ctx.st(s.grade, gp, 'scale(' + (1.5 - 0.5 * u.eo(gp)).toFixed(3) + ')');
      ctx.st(s.band, u.seg(t, 50.4, 50.9));
      ctx.tx(s.fx, s.formula.slice(0, Math.round(u.seg(t, 48, 50.3) * s.formula.length)));
      ctx.rise(s.conf, u.seg(t, 50.7, 51.3), 24);
      ctx.tx(s.cn, String(Math.round(sc.confidence.value * u.eo(u.seg(t, 51.2, 52.9)))));
      ctx.st(s.cc, u.seg(t, 52.9, 53.2));
      for (i = 0; i < s.cb.length; i++) {
        var bp = u.eo(u.seg(t, 51.1 + i * 0.3, 52.4 + i * 0.3));
        ctx.st(s.cb[i].f, undefined, 'scaleX(' + (s.cb[i].v / 100 * bp).toFixed(4) + ')');
        ctx.tx(s.cb[i].n, String(Math.round(s.cb[i].v * bp)));
      }
    }
  });
})();
