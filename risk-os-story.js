/**
 * risk-os-story.js — Risk OS™ assessment walkthrough (≈13 s, simulated data).
 *
 * One clock drives everything. frame(t) is a pure function of time: it derives
 * every visible state — input status, question level, module phase, score, rail
 * step — and paints the wire/packet canvas. That makes the walkthrough
 * deterministic, scrubbable (seek), pausable when off-screen, and cheap: DOM
 * writes only happen when a value actually changes.
 *
 * Pipeline shown: ingest → validate → structure → analyse → correlate →
 *                 classify → score → rate, then monitoring.
 *
 * Presentation lives in story-sections.css; the layout is unchanged from the
 * original three-column stage (entity + inputs → engine → modules + outputs).
 * All entities and values are illustrative.
 */
(function () {
  'use strict';

  /* ═══ timeline (seconds) ═══ */
  var END = 12.8;
  var STEPS = [[0.1, 1], [0.9, 2], [2.4, 3], [4.4, 4], [9.2, 5], [10.4, 6], [11.8, 7]];
  var SRC_T0 = 0.9, SRC_GAP = 0.3;                     // input i starts at SRC_T0 + i * SRC_GAP
  var SRC_DOCS = [6, 9, 5, 4, 7, 8, 3, 6, 4];          // evidence items linked when a source validates
  var Q_T = [3.2, 4.4, 5.6];                           // representative questions
  var MORE_T = [6.9, 7.2, 7.5, 7.8];                   // remaining question groups resolving
  var RAIL_T = [0.9, 2.0, 3.2, 4.7, 7.0, 8.6, 9.4, 10.4];
  var CORR_T0 = 7.0, LOCK_T = 9.6, RATE_T0 = 10.5, GRADE_T = 11.3, MONITOR_T = 11.8;
  var CORR = [[0, 3], [0, 6], [1, 2], [2, 4], [1, 4], [0, 7], [3, 7]];

  /* illustrative module outputs — weights sum to 1, weighted score = 78.0 */
  var MODS = [
    { w: 0.18, v: 62, t0: 4.7, d: 2.4, exp: 'HIGH', sev: 'HIGH', conf: 92 },
    { w: 0.14, v: 70, t0: 5.3, d: 2.2, exp: 'MOD', sev: 'MOD', conf: 88 },
    { w: 0.12, v: 76, t0: 5.6, d: 2.3, exp: 'MOD', sev: 'LOW', conf: 90 },
    { w: 0.12, v: 72, t0: 6.0, d: 2.6, exp: 'ELEV', sev: 'MOD', conf: 84 },
    { w: 0.12, v: 92, t0: 6.2, d: 2.0, exp: 'LOW', sev: 'LOW', conf: 93 },
    { w: 0.10, v: 94, t0: 6.5, d: 2.1, exp: 'LOW', sev: 'LOW', conf: 94 },
    { w: 0.08, v: 78, t0: 6.9, d: 2.4, exp: 'MOD', sev: 'LOW', conf: 81 },
    { w: 0.14, v: 90, t0: 7.1, d: 2.4, exp: 'LOW', sev: 'MOD', conf: 89 }
  ];
  var DETAIL_SPAN = 1.5;                               // exposure / severity / confidence readout

  /* ═══ math ═══ */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function seg(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function easeOut(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function easeIO(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  CXStory.register('riskos', function (root) {
    function $(s, c) { return (c || root).querySelector(s); }
    function $$(s, c) { return Array.prototype.slice.call((c || root).querySelectorAll(s)); }

    var grid = $('.ros-grid');
    var cv = $('.ros-fx');
    var ctx = cv.getContext('2d');
    var progressEl = $('.cxs-progress i');

    var srcEls = $$('.ros-src');
    var srcState = srcEls.map(function (r) { return $('.ros-src-state', r); });
    var srcBar = srcEls.map(function (r) { return $('.ros-src-bar i', r); });
    var engineEl = $('.ros-engine');
    var engPill = $('[data-eng-state]');
    var evEl = $('[data-ev]');
    var qEls = $$('.ros-q');
    var qState = qEls.map(function (q) { return $('.ros-q-state', q); });
    var qBar = qEls.map(function (q) { return $('.ros-q-bar i', q); });
    var morePills = $$('.ros-q-pill');
    var modEls = $$('.ros-mod');
    var modR = modEls.map(function (m) { return $('.ros-mod-r', m); });
    var modSigs = modEls.map(function (m) { return $$('.ros-mod-sigs > span', m); });
    var modDet = modEls.map(function (m) { return $('.ros-mod-det', m); });
    var modBar = modEls.map(function (m) { return $('.ros-mod-bar i', m); });
    var scoreEl = $('.ros-score');
    var ratingEl = $('.ros-rating');
    var countEl = $('[data-ros-count]');
    var scoreState = $('[data-score-state]');
    var rateState = $('[data-rate-state]');
    var confEl = $('[data-conf]');
    var dqEl = $('[data-dq]');
    var scaleEls = $$('.ros-scale li');
    var railEls = $$('.ros-rail li');
    var stSys = $('[data-st-sys]');
    var stSrc = $('[data-st-src]');
    var stAsm = $('[data-st-asm]');

    var TARGET_SCORE = Math.round(MODS.reduce(function (a, m) { return a + m.w * m.v; }, 0));
    var TARGET_CONF = Math.round(MODS.reduce(function (a, m) { return a + m.w * m.conf; }, 0));

    var t = 0, playing = false, visible = true, raf = 0, lastNow = 0;
    var observers = [], listeners = [];

    /* ── colours come from the panel tokens so the canvas follows the CSS ── */
    var cs = getComputedStyle(root);
    function hex(name) {
      var h = cs.getPropertyValue(name).trim().replace('#', '');
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
    }
    var COL = { blue: hex('--cxs-blue'), deep: hex('--cxs-blue-deep'), text: hex('--cxs-text'), text2: hex('--cxs-text-2') };
    function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a < 0 ? 0 : a > 1 ? 1 : a.toFixed(3)) + ')'; }

    /* ── write-on-change helpers (keeps per-frame DOM work near zero) ── */
    function setText(el, s) { if (el.__t !== s) { el.__t = s; el.textContent = s; } }
    function setAttr(el, n, v) { if (el.__a !== v) { el.__a = v; el.setAttribute(n, v); } }
    function setCls(el, c, on) { on = !!on; if (el['__c' + c] !== on) { el['__c' + c] = on; el.classList.toggle(c, on); } }
    function setScale(el, v) { v = Math.round(v * 1000) / 1000; if (el.__s !== v) { el.__s = v; el.style.transform = 'scaleX(' + v + ')'; } }

    /* ═══ geometry + canvas (desktop only; stacked layouts skip the canvas) ═══ */
    var fxOn = false, gw = 0, gh = 0, dpr = 1;
    var wires = [], packets = [], arcs = [];

    function box(el) {
      var x = 0, y = 0, n = el;
      while (n && n !== grid) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
      return { x: x, y: y, w: el.offsetWidth, h: el.offsetHeight };
    }
    function bez(p0, c1, c2, p3, n) {
      var out = [];
      for (var i = 0; i <= n; i++) {
        var u = i / n, v = 1 - u;
        out.push([
          v * v * v * p0[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * p3[0],
          v * v * v * p0[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * p3[1]
        ]);
      }
      return out;
    }
    function link(a, b) {
      var dx = (b[0] - a[0]) * 0.5;
      return bez(a, [a[0] + dx, a[1]], [b[0] - dx, b[1]], b, 32);
    }
    function addWire(pts, t0, dur, group) {
      var w = { pts: pts, t0: t0, dur: dur, group: group };
      wires.push(w);
      return w;
    }
    function addPacket(w, t0, dur) { packets.push({ w: w, t0: t0, dur: dur }); }

    function build() {
      var w = grid.offsetWidth, h = grid.offsetHeight;
      fxOn = window.innerWidth > 1100 && w > 0;
      wires = []; packets = []; arcs = [];
      if (!fxOn) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);   // crisp on 2x/2.5x, bounded fill-rate on 4K
      gw = w; gh = h;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var eng = box(engineEl), sc = box(scoreEl), i, b, port, w0, t0;
      var nS = srcEls.length, nM = modEls.length;

      /* source → engine input ports */
      for (i = 0; i < nS; i++) {
        b = box(srcEls[i]);
        port = [eng.x, eng.y + 22 + (eng.h - 44) * i / (nS - 1)];
        t0 = SRC_T0 + SRC_GAP * i;
        w0 = addWire(link([b.x + b.w, b.y + b.h / 2], port), t0 + 0.15, 0.6, 'src');
        addPacket(w0, t0 + 0.9, 0.75); addPacket(w0, t0 + 1.25, 0.75); addPacket(w0, t0 + 1.6, 0.75);
      }
      /* engine → module ports, then module → score (weighted contribution) */
      for (i = 0; i < nM; i++) {
        b = box(modEls[i]);
        var m = MODS[i];
        port = [eng.x + eng.w, eng.y + 22 + (eng.h - 44) * i / (nM - 1)];
        w0 = addWire(link(port, [b.x, b.y + b.h / 2]), m.t0 - 0.3, 0.5, 'mod');
        addPacket(w0, m.t0 + 0.1, 0.6); addPacket(w0, m.t0 + 0.8, 0.6); addPacket(w0, m.t0 + 1.5, 0.6);
        w0 = addWire(link([b.x + b.w, b.y + b.h / 2], [sc.x, sc.y + sc.h / 2]), m.t0 + 0.3, 0.6, 'out');
        addPacket(w0, m.t0 + 0.7, 0.8); addPacket(w0, m.t0 + 1.4, 0.8);
      }
      /* correlation arcs, drawn in the gap left of the module list */
      CORR.forEach(function (pair, k) {
        var a = box(modEls[pair[0]]), c = box(modEls[pair[1]]);
        var ya = a.y + a.h / 2, yc = c.y + c.h / 2, x = a.x - 3;
        var bulge = Math.min(30, 10 + Math.abs(yc - ya) * 0.16);
        arcs.push({ x: x, ya: ya, yc: yc, bulge: bulge, t0: CORR_T0 + k * 0.22 });
      });
    }

    function pointAt(pts, fi, out) {
      var n = pts.length - 1;
      fi = clamp(fi, 0, n);
      var i = Math.min(n - 1, Math.floor(fi)), f = fi - i;
      out[0] = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f;
      out[1] = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f;
      return out;
    }
    var tmp = [0, 0];

    function drawFx(tt) {
      if (!fxOn) return;
      var i, k, w, p, pts, n, fi, u, a;
      ctx.clearRect(0, 0, gw, gh);

      /* faint coordinate grid, drifting slowly with the clock */
      var step = 32, ox = (tt * 1.6) % step, oy = (tt * 2.4) % step;
      ctx.strokeStyle = rgba(COL.text, 0.035); ctx.lineWidth = 1;
      ctx.beginPath();
      for (var x = -ox; x < gw; x += step) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, gh); }
      for (var y = -oy; y < gh; y += step) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(gw, Math.round(y) + 0.5); }
      ctx.stroke();

      /* wires: drawn progressively, brightest while data is moving through them */
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 1;
      for (k = 0; k < wires.length; k++) {
        w = wires[k];
        u = easeOut(seg(tt, w.t0, w.t0 + w.dur));
        if (u <= 0) continue;
        pts = w.pts; n = pts.length - 1; fi = u * n;
        a = 0.24 + 0.32 * (1 - smooth(seg(tt, w.t0 + w.dur, w.t0 + w.dur + 1.6)));
        ctx.strokeStyle = rgba(w.group === 'out' ? COL.text2 : COL.deep, a);
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        for (i = 1; i <= Math.floor(fi); i++) ctx.lineTo(pts[i][0], pts[i][1]);
        if (fi < n) { pointAt(pts, fi, tmp); ctx.lineTo(tmp[0], tmp[1]); }
        ctx.stroke();
      }

      /* correlation arcs between related modules */
      ctx.setLineDash([2, 3]);
      for (k = 0; k < arcs.length; k++) {
        var ar = arcs[k];
        a = smooth(seg(tt, ar.t0, ar.t0 + 0.5));
        if (a <= 0) continue;
        a *= 0.55 - 0.3 * smooth(seg(tt, LOCK_T, LOCK_T + 1));
        ctx.strokeStyle = rgba(COL.text2, a);
        ctx.beginPath(); ctx.moveTo(ar.x, ar.ya);
        ctx.quadraticCurveTo(ar.x - ar.bulge * 1.6, (ar.ya + ar.yc) / 2, ar.x, ar.yc);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      /* data packets: short trail + head, eased along the wire */
      for (k = 0; k < packets.length; k++) {
        p = packets[k];
        u = (tt - p.t0) / p.dur;
        if (u <= 0 || u >= 1) continue;
        pts = p.w.pts; n = pts.length - 1;
        var e = easeIO(u), fade = Math.sin(u * Math.PI);
        for (i = 4; i >= 0; i--) {
          pointAt(pts, clamp(e - i * 0.018, 0, 1) * n, tmp);
          ctx.fillStyle = rgba(COL.blue, (i === 0 ? 0.95 : 0.34 - i * 0.06) * Math.min(1, fade * 1.6));
          ctx.beginPath(); ctx.arc(tmp[0], tmp[1], i === 0 ? 1.9 : 1.5 - i * 0.18, 0, 6.2832); ctx.fill();
        }
      }
    }

    /* ═══ state derivation ═══ */
    var lastStep = -1;
    function applySteps(tt) {
      var s = 0;
      for (var i = 0; i < STEPS.length; i++) if (tt >= STEPS[i][0]) s = STEPS[i][1];
      if (s === lastStep) return;
      lastStep = s;
      for (var n = 1; n <= 7; n++) root.classList.toggle('is-s' + n, s >= n);
    }

    function applySources(tt) {
      var active = 0, docs = 0;
      for (var i = 0; i < srcEls.length; i++) {
        var local = tt - (SRC_T0 + SRC_GAP * i), st, label, p;
        if (local < 0) { st = 'queued'; label = 'Queued'; p = 0; }
        else if (local < 0.9) { p = easeOut(local / 0.9); st = 'ingest'; label = 'Ingesting ' + Math.round(p * 100) + '%'; }
        else if (local < 1.3) { st = 'validate'; label = 'Validating'; p = 1; }
        else if (local < 1.65) { st = 'map'; label = 'Mapping'; p = 1; }
        else { st = 'done'; label = '✓ Validated'; p = 1; active++; docs += SRC_DOCS[i]; }
        setAttr(srcEls[i], 'data-state', st);
        setText(srcState[i], label);
        setScale(srcBar[i], p);
      }
      setText(stSrc, String(active));
      setText(evEl, String(docs));
    }

    var Q_STATE = ['Pending', 'Reading', 'Mapping inputs', 'Evaluating', 'Resolved'];
    function applyQuestions(tt) {
      for (var k = 0; k < qEls.length; k++) {
        var local = tt - Q_T[k];
        var lvl = local < 0 ? 0 : local < 0.5 ? 1 : local < 1.1 ? 2 : local < 1.9 ? 3 : 4;
        for (var j = 1; j <= 4; j++) setCls(qEls[k], 'is-q' + j, lvl >= j);
        setText(qState[k], Q_STATE[lvl]);
        setScale(qBar[k], lvl === 0 ? 0 : seg(local, 0.3, 1.9));
      }
      for (var m = 0; m < morePills.length; m++) setCls(morePills[m], 'is-on', tt >= MORE_T[m]);
    }

    function applyModules(tt) {
      var sum = 0, done = 0;
      for (var i = 0; i < MODS.length; i++) {
        var m = MODS[i], local = tt - m.t0, phase, right, prog = 0;
        if (local < 0) { phase = 'queue'; right = 'Queued'; }
        else if (local < m.d) {
          phase = 'scan'; prog = easeIO(local / m.d); right = 'Scanning';
        } else {
          prog = 1; done++;
          phase = local < m.d + DETAIL_SPAN ? 'detail' : 'done';
          right = String(m.v);
        }
        sum += m.w * m.v * prog;
        setAttr(modEls[i], 'data-phase', phase);
        setText(modR[i], right);
        setScale(modBar[i], (m.v / 100) * prog);
        if (phase === 'scan') {
          var sigs = modSigs[i], cur = Math.min(sigs.length - 1, Math.floor(seg(local, 0, m.d) * sigs.length));
          for (var s = 0; s < sigs.length; s++) { setCls(sigs[s], 'is-cur', s === cur); setCls(sigs[s], 'is-done', s < cur); }
          setText(modDet[i], '');
        } else if (phase === 'detail') {
          setText(modDet[i], 'Exp ' + m.exp + ' · Sev ' + m.sev + ' · Conf ' + m.conf + '%');
        } else if (phase === 'done') {
          setText(modDet[i], 'Complete · Conf ' + m.conf + '% · Verified');
        } else {
          for (var q = 0; q < modSigs[i].length; q++) { setCls(modSigs[i][q], 'is-cur', false); setCls(modSigs[i][q], 'is-done', false); }
          setText(modDet[i], '');
        }
      }
      return { sum: sum, done: done };
    }

    function applyOutput(tt, agg) {
      var locked = tt >= LOCK_T;
      setText(countEl, String(locked ? TARGET_SCORE : Math.round(agg.sum)));
      setText(scoreState, locked ? 'Computed · 8 / 8 weighted' : 'Weighting · ' + agg.done + ' / 8 modules');
      setCls(scoreEl, 'is-locked', locked);
      setText(confEl, locked ? TARGET_CONF + '%' : '—');
      setText(dqEl, locked ? 'High' : '—');

      /* rating: scale sweeps CCC → A before the grade is generated */
      var sweep = tt < RATE_T0 ? -1 : Math.min(6 - Math.floor((tt - RATE_T0) / 0.15), 6);
      var settled = tt >= RATE_T0 + 0.15 * 4 + 0.05;
      for (var i = 0; i < scaleEls.length; i++) {
        setCls(scaleEls[i], 'is-scan', sweep >= 0 && !settled && i === Math.max(2, sweep));
        setCls(scaleEls[i], 'is-on', settled && i === 2);
      }
      var gen = tt >= GRADE_T;
      setCls(ratingEl, 'is-gen', gen);
      setText(rateState, gen ? 'Generated · rating engine' : 'Mapping ' + TARGET_SCORE + ' to scale');
    }

    var ENG_STATES = [[0, 'Standby'], [0.9, 'Ingesting'], [3.0, 'Assessing'], [7.0, 'Correlating'], [8.6, 'Classifying'], [9.4, 'Scoring'], [10.4, 'Rating'], [MONITOR_T, 'Monitoring']];
    function applyStatus(tt) {
      var es = 'Standby';
      for (var i = 0; i < ENG_STATES.length; i++) if (tt >= ENG_STATES[i][0]) es = ENG_STATES[i][1];
      setText(engPill, es);
      setCls(root, 'is-live', tt >= 0.1);
      setCls(root, 'is-complete', tt >= GRADE_T);
      setCls(root, 'is-monitor', tt >= MONITOR_T);
      setText(stSys, tt < 0.1 ? 'Standby' : tt >= MONITOR_T ? 'Monitoring' : 'System active');
      setText(stAsm, tt < 0.9 ? 'Awaiting data' : tt < GRADE_T ? 'Assessment in progress' : 'Assessment complete');
      var cur = -1;
      for (var r = 0; r < RAIL_T.length; r++) if (tt >= RAIL_T[r]) cur = r;
      for (var k = 0; k < railEls.length; k++) {
        setCls(railEls[k], 'is-on', k <= cur);
        setCls(railEls[k], 'is-cur', k === cur && tt < MONITOR_T);
      }
    }

    function frame(tt) {
      applySteps(tt);
      applySources(tt);
      applyQuestions(tt);
      applyOutput(tt, applyModules(tt));
      applyStatus(tt);
      setScale(progressEl, clamp(tt / END, 0, 1));
      drawFx(tt);
    }

    /* ═══ clock ═══ */
    function loop(now) {
      raf = 0;
      if (!visible || document.hidden) { lastNow = 0; return; }
      var dt = lastNow ? Math.min(0.1, (now - lastNow) / 1000) : 0;
      lastNow = now;
      if (playing) {
        t += dt;
        if (t >= END) { t = END; playing = false; root.classList.add('is-done'); }
      }
      frame(t);
      if (playing) raf = requestAnimationFrame(loop);
    }
    function kick() { if (!raf) { lastNow = 0; raf = requestAnimationFrame(loop); } }

    function hardReset(tt) {
      root.classList.add('no-anim');
      lastStep = -1;
      frame(tt);
      void root.offsetWidth;                            // commit without transitions
    }

    function play() {
      t = 0; playing = true;
      root.classList.remove('is-done');
      hardReset(0);
      root.classList.remove('no-anim');
      kick();
    }
    function showFinal() {
      playing = false; t = END;
      root.classList.add('is-done');
      hardReset(END);
    }
    function seek(x) {                                  // QA / deep-link hook
      playing = false; t = clamp(x, 0, END);
      root.classList.toggle('is-done', t >= END);
      hardReset(t);
    }
    function destroy() {
      cancelAnimationFrame(raf); raf = 0; playing = false;
      observers.forEach(function (o) { o(); });
      listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2]); });
      observers = []; listeners = [];
    }

    /* ═══ lifecycle: resize, visibility ═══ */
    var rTimer = 0;
    function onResize() {
      clearTimeout(rTimer);
      rTimer = setTimeout(function () { build(); if (!playing) frame(t); }, 120);
    }
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(onResize); ro.observe(grid);
      observers.push(function () { ro.disconnect(); });
    } else {
      window.addEventListener('resize', onResize); listeners.push([window, 'resize', onResize]);
    }
    observers.push(CXStory.watchVisible(root, function (v) {
      visible = v;
      root.classList.toggle('is-offscreen', !v);
      if (v && playing) kick();
    }));
    var onVis = function () { if (!document.hidden && playing) kick(); };
    document.addEventListener('visibilitychange', onVis); listeners.push([document, 'visibilitychange', onVis]);

    build();
    hardReset(0);                                       // first paint: the stage at rest
    root.classList.remove('no-anim');

    return { play: play, replay: play, showFinal: showFinal, seek: seek, destroy: destroy };
  });
})();
