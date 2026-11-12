/* ════════════════════════════════════════════════════════════════════
   CLIMACTIX TERMINAL — PRODUCT FILM · SCENES 1–4
   1 The problem (0–12 s)        fragments · light
   2 The transformation (12–25)  light · term · index
   3 Corporate intelligence (25–40)  profile
   4 Intelligence Score (40–55)  score

   Each scene: { id, ranges:[[start,end],...], build(ctx, scene), frame(t, ctx) }
   frame(t) must paint the complete state for time t (no accumulated state).
   All figures come from window.CX_TERMINAL_DEMO — the same demonstration
   dataset the interactive terminal uses — so the film and the terminal agree.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var F = window.CXFilm, u = F.u, D = window.CX_TERMINAL_DEMO;

  /* The company the film follows. A synthetic entity, so that no real company
     is shown with an invented score. Change this id to feature another profile. */
  var FEATURED = 'corvane';
  var co = D.company(FEATURED), sc = D.score(FEATURED), hist = D.history(FEATURED);
  F.featured = FEATURED;

  F.caption(2.6, 7.0, 'Corporate sustainability information is everywhere.');
  F.caption(7.2, 11.8, 'But meaningful intelligence remains fragmented.');
  F.caption(17.2, 20.6, 'Introducing Climactix Terminal.');
  F.caption(20.8, 24.8, 'A unified intelligence platform bringing corporate sustainability information together.');
  F.caption(29.8, 33.8, 'Search any company. See every disclosure it has published.');
  F.caption(34.4, 39.4, 'Reports, net zero commitments, climate disclosures and history, in one place.');
  F.caption(48.6, 54.6, 'Transforming public disclosures and company assessments into structured, explainable sustainability intelligence.');

  function chip(state) {
    return state === 'missing' ? '<span class="cxf-chip nd">Not disclosed</span>'
         : state === 'insufficient' ? '<span class="cxf-chip ie">Insufficient evidence</span>'
         : state === 'adverse' ? '<span class="cxf-chip adv">Adverse performance</span>'
         : '<span class="cxf-chip ok">Evidenced</span>';
  }
  F.chip = chip;

  /* ── SCENE 1–2 · Fragmented disclosures, then convergence ──────── */
  var TYPES = ['ESG REPORT', 'SUSTAINABILITY DISCLOSURE', 'NET ZERO COMMITMENT', 'CLIMATE REPORT', 'BRSR', 'ENVIRONMENTAL DATA', 'ANNUAL REPORT'];
  F.scene({
    id: 'fragments', chapter: 'The problem', ranges: [[0, 20.2]],
    build: function (ctx, s) {
      var wrap = ctx.el(s.root, 'cxf-space-wrap'), r = u.rng(11), i, k;
      s.space = ctx.el(wrap, 'cxf-space');
      s.sheets = [];
      for (i = 0; i < 30; i++) {
        var type = TYPES[i % TYPES.length], v = i % 4, html = '<i>' + type + '</i><b>' + D.years[4 - (i % 3)] + '</b>';
        for (k = 0; k < 4; k++) html += '<u style="width:' + (48 + Math.floor(r() * 48)) + '%"></u>';
        if (v === 0) { html += '<span class="bars">'; for (k = 0; k < 7; k++) html += '<em style="height:' + (20 + Math.floor(r() * 78)) + '%"></em>'; html += '</span>'; }
        else if (v === 1) { html += '<span class="grid">'; for (k = 0; k < 12; k++) html += '<em></em>'; html += '</span>'; }
        else if (v === 2) html += '<span class="fig">' + (type === 'NET ZERO COMMITMENT' ? ['2040', '2045', '2050'][i % 3] : type === 'ENVIRONMENTAL DATA' ? 'tCO₂e' : 'Scope 3') + '</span>';
        else for (k = 0; k < 4; k++) html += '<u style="width:' + (40 + Math.floor(r() * 56)) + '%"></u>';
        var x = (r() * 2 - 1) * 1700, y = (r() * 2 - 1) * 880, z = -3200 + r() * 3300;
        if (Math.abs(x) < 300 && Math.abs(y) < 230) x += x < 0 ? -460 : 460;
        s.sheets.push({ e: ctx.el(s.space, 'cxf-sheet', html), x: x, y: y, z: z, ry: (r() * 2 - 1) * 28, rx: (r() * 2 - 1) * 10, d: 0.2 + r() * 6.4, c0: 13.2 + r() * 2.6 });
      }
      s.dust = [];
      for (i = 0; i < 170; i++) s.dust.push({ x: r() * 1920, y: r() * 1080, ph: r() * 6.28, a: 0.12 + r() * 0.4, sz: 1 + r() * 1.6, c0: 13.4 + r() * 2.8 });
    },
    frame: function (t, ctx) {
      var s = this, settle = 1 - u.seg(t, 12, 15);
      var cz = 1900 * (1 - Math.pow(1 - u.seg(t, 0, 14), 1.6));
      var cx = Math.sin(t * 0.33) * 140 * settle, cy = Math.cos(t * 0.27) * 50 * settle, ry = Math.sin(t * 0.21 + 0.6) * 7 * settle;
      ctx.st(s.space, undefined, 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,' + cz.toFixed(1) + 'px) rotateY(' + ry.toFixed(2) + 'deg)');
      for (var i = 0; i < s.sheets.length; i++) {
        var h = s.sheets[i], q = u.eio(u.seg(t, h.c0, h.c0 + 2.6));
        var x = u.lerp(h.x, 0, q), y = u.lerp(h.y, 0, q), z = u.lerp(h.z, -700 - cz, q), wz = z + cz;
        var op = u.seg(t, h.d, h.d + 1.4) * (0.3 + 0.7 * u.seg(wz, -3200, -500)) * (1 - u.seg(wz, 650, 1050)) * (1 - u.seg(q, 0.8, 1));
        ctx.st(h.e, op, 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,' + z.toFixed(1) + 'px) rotateY(' + (h.ry * (1 - q)).toFixed(2) + 'deg) rotateX(' + (h.rx * (1 - q)).toFixed(2) + 'deg) scale(' + u.lerp(1, 0.1, q).toFixed(3) + ')');
      }
      var g = ctx.bg, appear = u.seg(t, 0.3, 4);
      g.lineCap = 'round';
      for (var k = 0; k < s.dust.length; k++) {
        var p = s.dust[k], q2 = u.eio(u.seg(t, p.c0, p.c0 + 3)), q1 = u.eio(u.seg(t - 0.09, p.c0, p.c0 + 3));
        var hx = p.x + Math.sin(t * 0.2 + p.ph) * 30, hy = p.y + Math.cos(t * 0.17 + p.ph) * 20;
        var px = u.lerp(hx, 960, q2), py = u.lerp(hy, 500, q2), ox = u.lerp(hx, 960, q1), oy = u.lerp(hy, 500, q1);
        var a = p.a * appear * (1 + q2 * 1.4) * (1 - u.seg(q2, 0.88, 1));
        if (a <= 0.004) continue;
        g.strokeStyle = 'rgba(214,224,240,' + Math.min(1, a).toFixed(3) + ')';
        g.lineWidth = p.sz;
        g.beginPath(); g.moveTo(ox, oy); g.lineTo(px + 0.01, py + 0.01); g.stroke();
      }
    }
  });

  F.scene({
    id: 'light', chapter: 'The transformation', ranges: [[11.6, 21]],
    build: function (ctx, s) {
      s.line = ctx.el(s.root, 'cxf-flare');
      s.dot = ctx.el(s.root, 'cxf-light');
      ctx.cue(12.0, 'soft'); ctx.cue(17.0, 'hit');
    },
    frame: function (t, ctx) {
      var grow = u.eio(u.seg(t, 11.8, 14.6)), swell = u.eio(u.seg(t, 14.6, 17.4)), out = 1 - u.seg(t, 17.4, 19.2);
      var sz = (0.25 + 0.75 * grow) * (1 + swell * 2.2) * (1 + 0.05 * Math.sin(t * 5.2));
      ctx.st(this.dot, grow * out, 'translate(-50%,-50%) scale(' + sz.toFixed(3) + ')');
      ctx.st(this.line, grow * 0.55 * out, 'translate(-50%,-50%) scaleX(' + (0.05 + swell * 0.95).toFixed(3) + ')');
    }
  });

  /* ── The terminal window (persists from scene 2 to scene 6) ────── */
  var RAIL = ['Dashboard', 'Company Intelligence', 'Intelligence Score', 'Report Repository', 'Bank Intelligence', 'Insurance Intelligence', 'Investor Intelligence', 'Government Intelligence'];
  /* camera: [time, scale, focusX, focusY] — focus is relative to the window centre */
  var CAM = [[16.8, 0.03, 0, 0], [19.2, 1, 0, 0], [25, 1, 0, 0], [26.6, 1.7, 0, -330], [28.6, 1.7, 0, -300], [30.2, 1, 0, 0], [32.6, 1, 0, 0],
             [34.4, 1.8, -150, -90], [36.2, 1.8, -150, -90], [38, 1.8, 265, 140], [39.5, 1.8, 265, 140], [40.9, 1, 0, 0], [43, 1, 0, 0],
             [54.8, 1.05, 0, 0], [55.6, 1, 0, 0], [80, 1, 0, 0], [84, 0.44, 0, 90], [96.6, 0.44, 0, 90], [98.6, 0.4, 0, 90]];
  var CUR = [[27.0, 1250, 520, 0], [27.3, 1250, 520, 1], [28.1, 800, 78, 1], [28.9, 800, 78, 1], [29.4, 900, 300, 0],
             [56.5, 1150, 640, 0], [56.8, 1150, 640, 1], [57.6, 444, 445, 1], [58.4, 444, 445, 1], [58.9, 620, 520, 0]];
  var CLICKS = [28.2, 57.7];
  F.scene({
    id: 'term', ranges: [[16.6, 99]],
    build: function (ctx, s) {
      var win = ctx.el(s.root, 'cxf-win');
      ctx.el(win, 'cxf-bar',
        '<img src="Climatix_logo.png" alt=""><b>CLIMACTIX TERMINAL</b><span class="cxf-crumb"></span>' +
        '<div class="cxf-search"><svg width="18" height="18" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.5"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><span class="cxf-q"></span><i class="cxf-caret"></i><span class="cxf-ph">Search company, industry or city</span></div>' +
        '<span class="cxf-bar-r">DEMONSTRATION DATA</span>');
      var rail = ctx.el(win, 'cxf-rail');
      s.items = RAIL.map(function (n, i) { return ctx.el(rail, 'cxf-ri', '<i>' + (i < 9 ? '0' : '') + (i + 1) + '</i>' + n); });
      s.win = win; s.crumb = win.querySelector('.cxf-crumb'); s.q = win.querySelector('.cxf-q'); s.caret = win.querySelector('.cxf-caret'); s.ph = win.querySelector('.cxf-ph');
      var body = ctx.el(win, 'cxf-body');
      s.cur = ctx.el(win, 'cxf-cur', '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M5 3l14 8-6 1.6L10 19z" fill="#fff" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/></svg>');
      s.ring = ctx.el(win, 'cxf-ring');
      ctx.term = { win: win, body: body, screen: function (cls) { return ctx.el(body, 'cxf-screen ' + cls); } };
      for (var i = 0; i < 7; i++) ctx.cue(25.8 + i * 0.21, 'tick');
      ctx.cue(28.2, 'soft'); ctx.cue(57.7, 'soft');
    },
    frame: function (t, ctx) {
      var s = this, c = u.kf(t, CAM);
      ctx.st(s.win, u.seg(t, 16.8, 17.7) * (1 - u.seg(t, 96.8, 98.5)),
        'translate3d(' + (-c[1] * c[0]).toFixed(2) + 'px,' + (-c[2] * c[0]).toFixed(2) + 'px,0) scale(' + c[0].toFixed(4) + ')');
      var act = t < 29 ? 0 : t < 40.4 ? 1 : t < 55.3 ? 2 : t < 61.6 ? 4 : t < 67.8 ? 5 : t < 74.1 ? 6 : t < 80.4 ? 7 : 0;
      for (var i = 0; i < s.items.length; i++) { var on = i === act; if (s.items[i]._a !== on) { s.items[i]._a = on; s.items[i].classList.toggle('on', on); } }
      ctx.tx(s.crumb, '/ ' + RAIL[act]);
      var name = co.name.split(' ')[0];
      var q = t < 25.8 || t >= 80 ? '' : t < 27.3 ? name.slice(0, Math.ceil(u.seg(t, 25.8, 27.3) * name.length)) : t < 28.3 ? name : co.name;
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

  /* ── SCENE 2 · Unified disclosure index (also the hub in scene 6) ── */
  F.scene({
    id: 'index', ranges: [[16.6, 29.2], [79.6, 99]],
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
      for (i = 0; i < 12; i++) ctx.cue(18.8 + i * 0.38, 'tick');
    },
    frame: function (t, ctx) {
      var s = this, hub = t >= 79;
      ctx.st(s.e, hub ? u.seg(t, 80, 81.2) : u.seg(t, 17.6, 18.5) * (1 - u.seg(t, 28.5, 29.1)));
      for (var i = 0; i < s.rows.length; i++) {
        var p = hub ? 1 : u.seg(t, 18.8 + i * 0.38, 19.35 + i * 0.38);
        ctx.st(s.rows[i], p, 'translate3d(' + ((1 - u.eo(p)) * -36).toFixed(1) + 'px,0,0)');
      }
      var c = hub ? 1 : u.eo(u.seg(t, 18.6, 24));
      for (var k = 0; k < s.kpi.length; k++) ctx.tx(s.kpi[k].n, Math.round(s.kpi[k].v * c).toLocaleString('en-US'));
      for (var b = 0; b < s.bars.length; b++) {
        var bp = hub ? 1 : u.eo(u.seg(t, 19.6 + b * 0.3, 22 + b * 0.3));
        ctx.st(s.bars[b].f, undefined, 'scaleX(' + (s.bars[b].w * bp).toFixed(4) + ')');
        ctx.tx(s.bars[b].n, Math.round(s.bars[b].v * bp).toLocaleString('en-US'));
      }
    }
  });

  /* ── SCENE 3 · Company search and intelligence profile ─────────── */
  F.scene({
    id: 'profile', chapter: 'Corporate intelligence', ranges: [[25, 40.9]],
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
      for (i = 0; i < 30; i += 3) ctx.cue(31.2 + i * 0.11, 'tick');
    },
    frame: function (t, ctx) {
      var s = this, i;
      ctx.st(s.drop, u.win(t, 26.0, 26.3, 28.4, 28.7));
      for (i = 0; i < s.alts.length; i++) ctx.st(s.alts[i], 0.5 * (1 - u.seg(t, 26.5, 27)));
      ctx.css(s.hit, 'background', t >= 28.15 ? '#1B3A73' : t >= 27.9 ? '#182233' : 'transparent');
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

  /* ── SCENE 4 · The Climactix Intelligence Score ────────────────── */
  F.scene({
    id: 'score', chapter: 'Intelligence Score', ranges: [[40, 55.8]],
    build: function (ctx, s) {
      var e = ctx.term.screen('cxf-score');
      s.els.push(e); s.e = e;
      s.cv = document.createElement('canvas'); s.cv.width = 1380; s.cv.height = 824; e.appendChild(s.cv); s.g = s.cv.getContext('2d');
      ctx.el(e, 'cxf-ph-head', '<small>Climactix Intelligence Score · analysing public disclosures</small><h2>' + co.name + '</h2>', 'left:24px;top:14px');

      s.lanes = sc.dims.map(function (d, L) {
        var top = 118 + L * 136;
        var lane = ctx.el(e, 'cxf-lane', '<div class="nm"><b>' + d.name + '</b><span>Weight ' + d.weight + '%</span></div><div class="cells"></div><div class="ds">—</div><div class="trk"><i></i></div>', 'top:' + top + 'px');
        var cw = lane.querySelector('.cells');
        var cells = d.indicators.map(function (it, i) {
          var at = 42.6 + L * 0.9 + i * 0.35;
          ctx.cue(at, 'tick');
          return { e: ctx.el(cw, 'cell'), it: it, at: at, seed: L * 7 + i * 13 };
        });
        return { e: lane, cells: cells, ds: lane.querySelector('.ds'), fill: lane.querySelector('.trk i'), d: d, y: top + 60 };
      });
      var ieLane = 3, ieCell = 1;
      s.note = ctx.el(e, 'cxf-note', 'Insufficient evidence. Excluded from the score, not counted as zero.', 'left:' + (322 + ieCell * 100) + 'px;top:' + (118 + ieLane * 136 + 92) + 'px');

      var right = ctx.el(e, 'cxf-p cxf-hero', '<div class="cxf-pt">Climactix Score<span>Public data</span></div><div class="big"><b>0</b><span>/ 100</span><em>' + sc.band.grade + '</em></div><div class="band">' + sc.band.label + '</div>' +
        '<div class="scale"><i></i>' + D.bands.slice().reverse().map(function (b) { return '<span style="left:' + b.min + '%">' + b.grade + '</span>'; }).join('') + '</div><div class="fx"></div>', 'left:880px;top:24px;width:476px;height:452px');
      s.big = right.querySelector('.big b'); s.grade = right.querySelector('.big em'); s.band = right.querySelector('.band'); s.mark = right.querySelector('.scale i'); s.fx = right.querySelector('.fx'); s.hero = right;
      s.formula = '( ' + sc.dims.map(function (d) { return d.score + ' × ' + d.weight; }).join(' + ') + ' )\n÷ ' + sc.weightScored + ' = ' + sc.overall;

      var cf = sc.confidence;
      var conf = ctx.el(e, 'cxf-p cxf-conf', '<div class="cxf-pt">Data confidence<span>Reported separately</span></div><div class="cv"><b>0</b><em class="cxf-chip ok">' + cf.band + '</em></div>', 'left:880px;top:492px;width:476px;height:308px');
      s.conf = conf; s.cn = conf.querySelector('.cv b'); s.cc = conf.querySelector('.cv em');
      s.cb = [['Completeness', cf.completeness], ['Traceability', cf.traceability], ['Reliability', cf.reliability]].map(function (r) {
        var b = ctx.el(conf, 'cxf-brow', '<span>' + r[0] + '</span><i><em></em></i><b>0</b>');
        return { f: b.querySelector('em'), n: b.querySelector('b'), v: r[1] };
      });
      ctx.cue(50.2, 'hit'); ctx.cue(52.9, 'soft');
    },
    frame: function (t, ctx) {
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
        /* data ticks travelling along the lane while it is being analysed */
        var busy = flow * (done < 4 ? 1 : 1 - u.seg(t, ln.cells[3].at, ln.cells[3].at + 0.8));
        if (busy > 0.01) for (i = 0; i < 9; i++) {
          var x = 44 + ((t * 0.34 + i / 9 + L * 0.13) % 1) * 786;
          g.fillStyle = 'rgba(143,177,234,' + (0.55 * busy).toFixed(3) + ')';
          g.fillRect(x, ln.y + 46, 14, 2);
        }
        /* lane result flowing into the score */
        var send = u.seg(t, 46.6 + L * 0.2, 50.2);
        if (send > 0 && send < 1) {
          g.strokeStyle = 'rgba(61,123,224,' + (0.5 * Math.sin(send * Math.PI)).toFixed(3) + ')'; g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(850, ln.y); g.bezierCurveTo(900, ln.y, 860, 190, 908, 190); g.stroke();
          for (i = 0; i < 3; i++) {
            var q = (send * 2.2 + i * 0.33) % 1, iq = 1 - q;
            var bx = iq * iq * iq * 850 + 3 * iq * iq * q * 900 + 3 * iq * q * q * 860 + q * q * q * 908;
            var by = iq * iq * iq * ln.y + 3 * iq * iq * q * ln.y + 3 * iq * q * q * 190 + q * q * q * 190;
            g.fillStyle = 'rgba(244,246,248,' + (0.9 * Math.sin(send * Math.PI)).toFixed(3) + ')';
            g.beginPath(); g.arc(bx, by, 2.6, 0, 6.283); g.fill();
          }
        }
      }
      ctx.st(s.note, u.seg(t, 46.9, 47.5) * (1 - u.seg(t, 53.6, 54.4)));
      ctx.rise(s.hero, u.seg(t, 41.2, 42), 24);
      var cp = u.eo(u.seg(t, 47.6, 50.2)), v = Math.round(sc.overall * cp);
      ctx.tx(s.big, String(v));
      ctx.css(s.mark, 'left', (sc.overall * cp).toFixed(2) + '%');
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
