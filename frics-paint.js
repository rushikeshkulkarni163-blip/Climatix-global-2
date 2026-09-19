/**
 * frics-paint.js — canvas painters for the FRICS™ marketplace film.
 *
 * Every painter is a pure function of the film clock t (seconds), so the film can be scrubbed and
 * paused freely. Layers:
 *   Earth (frics-geo.js, the existing Risk Intelligence Map data) with four resilience signals,
 *   unit matrices (the FRICS in an order, in a holding), capital streams, the allocation connectors,
 *   the farm (frics-scene.js) with intervention labels, and the food-chain resilience pulses.
 *
 *   FRICSPaint.create(env) → { frame(t, step) }
 *   env: { g, W(), H(), dpr(), Art, geo, scene, rect(el), els, mono }   (rect = px box inside the stage)
 *
 * No place names anywhere: the Earth is unlabelled and the farm is a generic parcel model.
 */
(function () {
  'use strict';
  if (window.FRICSPaint) return;

  var TAU = Math.PI * 2;
  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function sm(x) { x = clamp(x); return x * x * (3 - 2 * x); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function seg(t, a, b) { return clamp((t - a) / (b - a)); }
  function keys(t, K) {                                    // smoothstep-eased keyframes: [t, v1, v2, …]
    var n = K.length, i;
    if (t <= K[0][0]) return K[0].slice(1);
    if (t >= K[n - 1][0]) return K[n - 1].slice(1);
    for (i = 0; i < n - 1; i++) if (t < K[i + 1][0]) {
      var k = sm((t - K[i][0]) / (K[i + 1][0] - K[i][0])), o = [];
      for (var j = 1; j < K[i].length; j++) o.push(lerp(K[i][j], K[i + 1][j], k));
      return o;
    }
  }
  function bez(a, c, b, u) { var v = 1 - u; return [v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]]; }

  var L = Math.log;
  /* Earth camera: t, lon, lat, ln(R / H), cx, cy (stage fractions), alpha */
  var CAM = [
    [0, 36, 14, L(0.6), 0.68, 0.52, 0], [0.7, 38, 14.5, L(0.62), 0.68, 0.52, 1], [2.0, 47, 15, L(0.66), 0.68, 0.52, 1], [2.8, 51, 15.5, L(0.7), 0.68, 0.52, 0],
    [9.3, 50, 16, L(0.5), 0.5, 0.5, 0], [9.9, 50, 16, L(0.5), 0.5, 0.5, 1], [10.6, 79, 22, L(4.6), 0.5, 0.5, 1], [11.2, 79.2, 22.2, L(9), 0.5, 0.5, 0]
  ];
  /* four resilience signals on the Earth: lon, lat, label, sub, appears at, label side */
  var SIGNALS = [
    [30, 12, 'Water', 'Availability and reliability', 0.55, -1],
    [58, 26, 'Soil', 'Degradation and moisture', 0.85, 1],
    [82, 14, 'Crop', 'Yield under stress', 1.15, -1],
    [100, 4, 'Food system', 'Supply continuity', 1.45, -1]
  ];
  var DIM = [[0, 0], [11.9, 0], [12.4, 0.9], [15.0, 0.9], [15.6, 1]];

  function create(env) {
    var gb = env.g, gt = env.gt || env.g, g = gb, pins = {}, Art = env.Art, geo = env.geo, scene = env.scene, mono = env.mono || 'IBM Plex Mono, monospace';

    function coin(x, y, d, a) {
      var sp = Art.sprite('front', 128);
      g.globalAlpha = a; g.drawImage(sp, x - d / 2, y - d / 2, d, d); g.globalAlpha = 1;
    }
    function dot(x, y, r, col, a) { g.globalAlpha = a; g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.globalAlpha = 1; }
    function ring(x, y, r, col, a, w) { g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = w || 1; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); g.globalAlpha = 1; }
    function txt(s, x, y, size, col, a, align, sp) {
      g.globalAlpha = a; g.fillStyle = col; g.font = '700 ' + size + 'px ' + mono; g.textAlign = align || 'left'; g.textBaseline = 'alphabetic';
      if ('letterSpacing' in g) g.letterSpacing = (sp == null ? 1.2 : sp) + 'px';
      g.fillText(s, x, y); if ('letterSpacing' in g) g.letterSpacing = '0px'; g.globalAlpha = 1;
    }

    /* keys() returns from index 1: [lon, lat, lnR, cx, cy, a] */
    function cam(t) { var k = keys(t, CAM), H = env.H(), W = env.W(); return { lon: k[0], lat: k[1], R: H * Math.exp(k[2]), cx: W * k[3], cy: H * k[4], a: k[5], stress: 0, plain: true }; }

    /* ── Earth + resilience signals ── */
    function earth(t) {
      if (!geo.ok) return;
      var c = cam(t); pins.cam = c;
      if (c.a <= 0.01) return;
      geo.draw(g, c);
      var depth = clamp((Math.log(c.R / env.H()) - 1) / 1.4);
      if (depth > 0.01) {                                             // deep zoom: hold the eye on the centre, hide coarse coastline at the edges
        var Wd = env.W(), Hd = env.H(), vg = g.createRadialGradient(Wd / 2, Hd / 2, Hd * 0.32, Wd / 2, Hd / 2, Math.hypot(Wd, Hd) * 0.55);
        vg.addColorStop(0, 'rgba(5,8,16,0)'); vg.addColorStop(1, 'rgba(5,8,16,' + (0.93 * c.a * depth).toFixed(3) + ')');
        g.fillStyle = vg; g.fillRect(0, 0, Wd, Hd);
      }
      if (t < 2.9) SIGNALS.forEach(function (s) {
        var a = sm(seg(t, s[4], s[4] + 0.35)) * c.a; if (a <= 0.01) return;
        var p = geo.proj(s[0], s[1], c); if (!p[2]) return;
        var x = p[0], y = p[1], side = s[5], pulse = (t * 0.9 + s[4]) % 1;
        dot(x, y, 3.6, '#5BA3F5', a); ring(x, y, 6 + pulse * 14, '#5BA3F5', a * (1 - pulse) * 0.7, 1);
        var lx = x + side * 26, ly = y - 24;
        g.globalAlpha = a * 0.8; g.strokeStyle = 'rgba(91,163,245,0.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + side * 4, y - 4); g.lineTo(lx, ly); g.lineTo(lx + side * 16, ly); g.stroke(); g.globalAlpha = 1;
        var al = side > 0 ? 'left' : 'right', tx = lx + side * 22;
        txt(s[2].toUpperCase(), tx, ly + 3, 10.5, '#FFFFFF', a, al, 1.6);
        txt(s[3], tx, ly + 17, 8.5, '#A3A3A3', a * 0.95, al, 0.4);
      });
    }

    /* ── capital moving between two points, as coins along a curve ── */
    function stream(a, b, lift, t0, n, gap, travel, t, d, prog) {
      var ctl = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - lift], done = 0, i;
      if (prog !== false) {
        g.strokeStyle = 'rgba(91,163,245,0.28)'; g.lineWidth = 1; g.beginPath();
        var last = clamp((t - t0) / (n * gap + travel));
        for (var s = 0; s <= 24; s++) { var q = bez(a, ctl, b, s / 24 * last); if (s) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }
        g.stroke();
      }
      for (i = 0; i < n; i++) {
        var u = (t - t0 - i * gap) / travel;
        if (u >= 1) { done++; continue; }
        if (u <= 0) continue;
        var e = sm(u), q2 = bez(a, ctl, b, e);
        coin(q2[0], q2[1], d, Math.min(1, u * 5) * Math.min(1, (1 - u) * 6 + 0.35));
      }
      return done;
    }

    /* ── the FRICS in an order or a holding: a matrix of 1,000 dots, one per FRICS in the order.
       Panels sit above the stage canvas, so the matrix has its own canvas inside the panel. ── */
    function matrix(el, p) {
      var cv = el && el.firstElementChild; if (!cv || !el.clientWidth) return;
      var w = el.clientWidth, h = el.clientHeight, d = env.dpr();
      if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
      var c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, w, h);
      if (p <= 0) return;
      var total = 1000, rows = Math.max(4, Math.round(Math.sqrt(total * h / w))), cols = Math.ceil(total / rows), px = w / cols, py = h / rows, n = Math.round(p * total), rad = Math.min(px, py) * 0.32, i;
      c.fillStyle = 'rgba(91,163,245,0.16)';
      for (i = 0; i < total; i++) { c.beginPath(); c.arc((i % cols + 0.5) * px, (((i / cols) | 0) + 0.5) * py, rad * 0.7, 0, TAU); c.fill(); }
      c.fillStyle = '#7DB8F8';
      for (i = 0; i < n; i++) { c.beginPath(); c.arc((i % cols + 0.5) * px, (((i / cols) | 0) + 0.5) * py, rad, 0, TAU); c.fill(); }
      if (p < 1 && n < total) { c.globalAlpha = 0.9; c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc((n % cols + 0.5) * px, (((n / cols) | 0) + 0.5) * py, rad * 2.2, 0, TAU); c.fill(); c.globalAlpha = 1; }
    }

    /* ── 05 · FRICS leaving the marketplace listing for the company ── */
    function acquire(t) {
      var a = env.rect(env.els.rowGutter), b = env.rect(env.els.coSlot);
      if (!a.w || !b.w) return;
      stream([a.x + a.w, a.y + a.h / 2], [b.x + b.w / 2, b.y + b.h / 2 + 30], 90, 7.0, 10, 0.07, 0.6, t, 15);
    }

    /* ── 06 · company → FRICS → resilience project ── */
    function allocation(t) {
      var lis = env.els.chainv, i;
      for (i = 0; i < lis.length - 1; i++) {
        var a = env.rect(lis[i]), b = env.rect(lis[i + 1]); if (!a.w || !b.w) continue;
        var x = a.x + a.w / 2, y0 = a.y + a.h + 2, y1 = b.y - 2, p = sm(seg(t, 8.65 + 0.5 * i, 9.15 + 0.5 * i));
        g.strokeStyle = 'rgba(91,163,245,0.55)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y0 + (y1 - y0) * p); g.stroke();
        if (p > 0.98) {
          g.fillStyle = 'rgba(91,163,245,0.95)'; g.beginPath(); g.moveTo(x, y1 + 1); g.lineTo(x - 4.5, y1 - 7); g.lineTo(x + 4.5, y1 - 7); g.closePath(); g.fill();
          for (var k = 0; k < 3; k++) { var u = ((t * 0.9 + k / 3) % 1); coin(x, y0 + (y1 - y0) * u, 12, Math.sin(u * Math.PI) * 0.9); }
        }
      }
    }

    /* ── 07 · farm: interventions + labels ── */
    var fc = null;
    function label(anchor, dx, dy, title, sub, a) {
      if (a <= 0.01) return;
      var x = anchor[0], y = anchor[1], lx = x + dx, ly = y + dy;
      g.globalAlpha = a; g.strokeStyle = 'rgba(91,163,245,0.85)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(lx, ly); g.stroke();
      dot(x, y, 3, '#5BA3F5', a); ring(x, y, 7 + ((env.tnow * 0.8) % 1) * 8, '#5BA3F5', a * 0.45, 1);
      g.font = '700 10px ' + mono; var w = Math.max(g.measureText(title).width * 1.14, 120) + 22, right = dx >= 0, bx = right ? lx : lx - w, by = ly - 20;
      g.fillStyle = 'rgba(10,15,26,0.94)'; g.strokeStyle = 'rgba(255,255,255,0.18)'; g.beginPath();
      if (g.roundRect) g.roundRect(bx, by, w, 40, 6); else g.rect(bx, by, w, 40); g.fill(); g.stroke();
      g.globalAlpha = 1; txt(title, bx + 11, by + 17, 10, '#FFFFFF', a, 'left', 1.4); txt(sub, bx + 11, by + 31, 8.5, '#A3A3A3', a, 'left', 0.3);
    }
    var fl = null;                                                     // offscreen layer: the scene clears its own canvas, so it never draws over the Earth directly
    function layer(key) {
      if (!fl || fl.key !== key) { fl = document.createElement('canvas'); fl.width = Math.round(env.W() * env.dpr()); fl.height = Math.round(env.H() * env.dpr()); fl.key = key; fl.g = fl.getContext('2d'); fl.g.setTransform(env.dpr(), 0, 0, env.dpr(), 0, 0); }
      return fl;
    }
    function farm(t) {
      if (t < 10.4) return;
      var key = env.W() + 'x' + env.H() + '@' + env.dpr(), L = layer(key);
      if (t >= 15.6) {                                                 // dimmed and static: build once, blit after
        if (!fc || fc.key !== key) {
          fc = document.createElement('canvas'); fc.width = L.width; fc.height = L.height; fc.key = key;
          var cg = fc.getContext('2d'); cg.setTransform(env.dpr(), 0, 0, env.dpr(), 0, 0);
          scene.draw(cg, { t: 0, reveal: 1, stress: 0.2, recover: 1, iv: 1, dim: 1, extras: 1 });
        }
        g.drawImage(fc, 0, 0, env.W(), env.H()); return;
      }
      var rec = sm(seg(t, 11.0, 12.2)), dim = keys(t, DIM)[0];
      scene.draw(L.g, { t: t, reveal: seg(t, 10.4, 11.1), stress: 0.72 * (1 - 0.72 * rec), recover: rec, iv: seg(t, 10.9, 12.0), dim: dim, extras: 1 });
      g.globalAlpha = sm(seg(t, 10.5, 11.2)); g.drawImage(L, 0, 0, env.W(), env.H()); g.globalAlpha = 1;
    }
    function farmOver(t) {
      if (t >= 10.4 && t < 11.9) {
        var a = 1 - seg(t, 11.7, 11.95), m = scene.metrics();
        label(scene.project(6.4, 4.4), 52, 44, 'WATER MANAGEMENT', 'Efficiency · storage · infrastructure', sm(seg(t, 10.85, 11.15)) * a);
        label(scene.project(3.4, 6, -m.depth * 0.32), -46, 40, 'SOIL RESILIENCE', 'Moisture retention · soil cover', sm(seg(t, 11.05, 11.35)) * a);
        label(scene.project(2.4, 1.6), -70, -52, 'CROP ADAPTATION', 'Adapted varieties · diversification', sm(seg(t, 11.25, 11.55)) * a);
        /* capital arrives from the company: FRICS enter the project area */
        var pond = scene.project(6.4, 4.4);
        stream([env.W() * 0.08, env.H() * 0.26], [pond[0], pond[1] - 8], -50, 10.35, 7, 0.08, 0.6, t, 15, false);
      }
    }

    /* ── 08 · resilience signal travelling farmer → consumer ── */
    function foodchain(t) {
      var lis = env.els.food, bx = lis.map(function (li) { var r = env.rect(li); return r.w ? r : null; });
      if (bx.some(function (r) { return !r; })) return;
      var pts = bx.map(function (r) { return [r.x + r.w / 2, r.y + r.h / 2]; }), u = seg(t, 12.55, 13.3) * (pts.length - 1) + 0.0001, i;
      for (i = 0; i < pts.length; i++) {                                // each link the signal reaches lifts an outline off its box
        var ph = clamp((u - i) / 1.4); if (u < i || ph >= 1) continue;
        var r = bx[i], o = 3 + ph * 12; g.globalAlpha = (1 - ph) * 0.7; g.strokeStyle = '#5BA3F5'; g.lineWidth = 1.2; g.beginPath();
        if (g.roundRect) g.roundRect(r.x - o, r.y - o, r.w + 2 * o, r.h + 2 * o, 8 + o); else g.rect(r.x - o, r.y - o, r.w + 2 * o, r.h + 2 * o);
        g.stroke(); g.globalAlpha = 1;
      }
      var k = Math.min(pts.length - 2, Math.floor(u)), f = u - k;
      if (u < pts.length - 1 + 0.0001) coin(lerp(pts[k][0], pts[k + 1][0], f), lerp(pts[k][1], pts[k + 1][1], f) - bx[0].h / 2 - 12, 16, 0.95);
      if (t > 13.25) for (i = 0; i < pts.length - 1; i++) { var s2 = ((t * 0.5 + i * 0.19) % 1); dot(lerp(pts[i][0], pts[i + 1][0], s2), pts[i][1], 1.8, '#7DB8F8', 0.85 * Math.sin(s2 * Math.PI)); }
    }

    function frame(t, step) {
      var W = env.W(), H = env.H();
      env.tnow = t;
      [gb, gt].forEach(function (c) { c.setTransform(env.dpr(), 0, 0, env.dpr(), 0, 0); c.clearRect(0, 0, W, H); });
      g = gb;                                                          // base layer: Earth and farm, under the panels
      if (t < 3 || (t > 9.2 && t < 11.3)) earth(t);
      farm(t);
      g = gt;                                                          // top layer: streams, connectors and labels, over the panels
      if (step === 4) matrix(env.els.buyUnits, sm(seg(t, 6.3, 6.8)));
      if (step === 5) { acquire(t); matrix(env.els.coUnits, sm(seg(t, 7.7, 8.15))); }
      if (step === 6) allocation(t);
      if (step === 7) farmOver(t);
      if (step === 8) foodchain(t);
    }

    return { frame: frame, pins: pins };
  }

  window.FRICSPaint = { create: create, keys: keys, seg: seg, sm: sm, clamp: clamp, lerp: lerp };
})();
