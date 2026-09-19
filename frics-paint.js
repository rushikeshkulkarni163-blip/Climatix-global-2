/**
 * frics-paint.js — canvas painters for the FRICS™ story stage.
 *
 * Every painter is a pure function of the story clock t (seconds): the globe zoom
 * (frics-geo.js, existing Earth data), the farm (frics-scene.js), capital streams, the
 * allocation engine, the impact chart and the feedback loop. Nothing here keeps animation
 * state, so the story can be scrubbed and paused freely.
 *
 *   FRICSPaint.create(env) → { frame(t, step) , pins }
 *   env: { g, W(), H(), dpr(), Art, geo, scene, rect(el), els }   (rect = px box inside the stage)
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
  /* Earth camera: t, lon, lat, ln(R / H), cx, cy (stage fractions), alpha, water-stress tint */
  var CAM = [
    [0, 63, 14, L(0.34), 0.72, 0.56, 0, 0], [0.8, 64, 14.5, L(0.34), 0.72, 0.56, 1, 0], [2.0, 68, 16, L(0.36), 0.72, 0.56, 1, 0],
    [3.2, 77, 17.9, L(1.5), 0.72, 0.58, 1, 0.9], [4.6, 77, 18.1, L(1.9), 0.72, 0.6, 1, 1], [5.2, 77, 18.1, L(2.0), 0.72, 0.6, 0, 1],
    [8.5, 62, 18, L(0.42), 0.5, 0.5, 0, 0], [9.0, 62, 18, L(0.42), 0.5, 0.5, 1, 0], [9.7, 77, 20, L(2.0), 0.5, 0.5, 1, 0.5],
    [10.4, 75.4, 18.8, L(8), 0.5, 0.5, 1, 0.35], [11.0, 74.5, 18.5, L(32), 0.5, 0.5, 1, 0], [11.6, 74.5, 18.5, L(32), 0.5, 0.5, 0, 0]
  ];
  var PUNE = [73.779, 18.605], MAHA = [76.0, 19.4], PROJECT = [74.75, 18.4];   // company facility · region · project area (lon, lat)
  var DIM = [[0, 0], [12.4, 0], [12.8, 0.9], [13.6, 0.9], [14.0, 0.4], [15.1, 0.4], [15.5, 1]];

  function create(env) {
    var g = env.g, pins = {}, Art = env.Art, geo = env.geo, scene = env.scene;

    function coin(x, y, d, a) {
      var sp = Art.sprite('front', 128);
      g.globalAlpha = a; g.drawImage(sp, x - d / 2, y - d / 2, d, d); g.globalAlpha = 1;
    }
    function dot(x, y, r, col, a) { g.globalAlpha = a; g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.globalAlpha = 1; }
    function ring(x, y, r, col, a, w) { g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = w || 1; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); g.globalAlpha = 1; }

    /* keys() returns from index 1: [lon, lat, lnR, cx, cy, a, stress] */
    function cam(t) { var k = keys(t, CAM), H = env.H(), W = env.W(); return { lon: k[0], lat: k[1], R: H * Math.exp(k[2]), cx: W * k[3], cy: H * k[4], a: k[5], stress: k[6] }; }

    /* ── Earth + markers ── */
    function earth(t, step) {
      if (!geo.ok) return;
      var c = cam(t); pins.cam = c;
      if (c.a <= 0.01) { pins.pune = pins.maha = pins.project = null; return; }
      geo.draw(g, c);
      var depth = clamp((Math.log(c.R / env.H()) - 1) / 1.5);
      if (depth > 0.01) {                                             // deep zoom: hold the eye on the centre, hide coarse coastline at the edges
        var Wd = env.W(), Hd = env.H(), vg = g.createRadialGradient(Wd / 2, Hd / 2, Hd * 0.32, Wd / 2, Hd / 2, Math.hypot(Wd, Hd) * 0.55);
        vg.addColorStop(0, 'rgba(5,8,16,0)'); vg.addColorStop(1, 'rgba(5,8,16,' + (0.93 * c.a * depth).toFixed(3) + ')');
        g.fillStyle = vg; g.fillRect(0, 0, Wd, Hd);
      }
      var p = geo.proj(PUNE[0], PUNE[1], c), m = geo.proj(MAHA[0], MAHA[1], c), pr = geo.proj(PROJECT[0], PROJECT[1], c);
      pins.pune = p; pins.maha = m; pins.project = pr;
      var a = c.a;
      if (p[2]) {                                                     // company facility
        var pulse = (t * 0.8) % 1;
        dot(p[0], p[1], 3.4, '#5BA3F5', a); ring(p[0], p[1], 6 + pulse * 10, '#5BA3F5', a * (1 - pulse) * 0.7, 1);
      }
      if (step === 6 && t > 10.3) {                                   // farming area + project
        var za = sm(seg(t, 10.5, 11.0)) * a;
        g.save(); g.globalAlpha = za * 0.9; g.strokeStyle = '#5BA3F5'; g.setLineDash([5, 5]); g.lineWidth = 1;
        g.beginPath(); g.ellipse(pr[0], pr[1], c.R * 0.0075, c.R * 0.0056, -0.25, 0, TAU); g.stroke();
        g.setLineDash([]); g.clip(); g.fillStyle = 'rgba(91,163,245,0.06)'; g.fill();                 // parcel pattern inside the farming area
        g.strokeStyle = 'rgba(91,163,245,0.20)'; g.lineWidth = 1; g.translate(pr[0], pr[1]); g.rotate(-0.25); g.beginPath();
        for (var gx = -320; gx <= 320; gx += 26) { g.moveTo(gx, -240); g.lineTo(gx, 240); g.moveTo(-320, gx * 0.75); g.lineTo(320, gx * 0.75); }
        g.stroke(); g.restore();
        dot(pr[0], pr[1], 3.6, '#E87722', za); ring(pr[0], pr[1], 8, '#E87722', za * 0.7, 1);
      }
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

    /* ── 03 · the allocation engine: priorities in, allocation out ── */
    function engine(t) {
      var eng = env.rect(env.els.engine), pri = env.rect(env.els.prio);
      if (!eng.w) return;
      var a = [pri.x, pri.y + pri.h / 2], b = [eng.x + eng.w, eng.y + eng.h / 2], u = seg(t, 4.65, 5.4);
      g.strokeStyle = 'rgba(91,163,245,' + (0.3 * sm(seg(t, 4.6, 4.9))).toFixed(3) + ')'; g.lineWidth = 1;
      for (var i = 0; i < 3; i++) {
        var y0 = pri.y + pri.h * (0.25 + 0.25 * i), y1 = eng.y + eng.h * (0.3 + 0.2 * i), c = [(a[0] + b[0]) / 2, (y0 + y1) / 2];
        g.beginPath(); g.moveTo(a[0], y0); g.quadraticCurveTo(c[0], c[1], b[0], y1); g.stroke();
        var q = bez([a[0], y0], c, [b[0], y1], (u * 1.4 - i * 0.15 + 1) % 1);
        if (u > 0 && u < 1) dot(q[0], q[1], 2.4, '#5BA3F5', 0.9);
      }
      ring(eng.x + eng.w, eng.y + eng.h / 2, 5 + sm(seg(t, 5.2, 5.6)) * 14, '#5BA3F5', 0.6 * (1 - seg(t, 5.2, 5.7)), 1.2);
    }

    /* ── farm (steps 06–09 backdrop) ── */
    var fc = null;
    function farm(t) {
      if (t < 10.9) return;
      if (t >= 15.6) {                                                 // dimmed and static: build once, blit after
        var key = env.W() + 'x' + env.H() + '@' + env.dpr();
        if (!fc || fc.key !== key) {
          fc = document.createElement('canvas'); fc.width = Math.round(env.W() * env.dpr()); fc.height = Math.round(env.H() * env.dpr()); fc.key = key;
          var cg = fc.getContext('2d'); cg.setTransform(env.dpr(), 0, 0, env.dpr(), 0, 0);
          scene.draw(cg, { t: 0, reveal: 1, stress: 0.21, recover: 1, iv: 1, dim: 1, extras: 0 });
        }
        g.drawImage(fc, 0, 0, env.W(), env.H()); pins.farmer = null; return;
      }
      var rec = sm(seg(t, 11.6, 12.6)), dim = keys(t, DIM)[0];
      scene.draw(g, { t: t, reveal: seg(t, 10.9, 11.7), stress: 0.75 * (1 - 0.72 * rec), recover: rec, iv: seg(t, 11.5, 12.4), dim: dim, extras: 0 });
      var f = scene.project(5.0, 3.7);
      pins.farmer = f;
      var fa = sm(seg(t, 11.4, 11.8)) * (1 - 0.7 * dim);
      if (fa > 0.02) {
        var pulse = (t * 0.7) % 1;
        ring(f[0], f[1], 7 + pulse * 12, '#5BA3F5', fa * (1 - pulse) * 0.7, 1);
        dot(f[0], f[1], 3, '#5BA3F5', fa);
        g.globalAlpha = fa; g.strokeStyle = '#E6EEF9'; g.lineWidth = 1.6; g.lineCap = 'round';
        g.beginPath(); g.arc(f[0], f[1] - 16, 3.6, 0, TAU); g.moveTo(f[0] - 6, f[1] - 4); g.quadraticCurveTo(f[0], f[1] - 12, f[0] + 6, f[1] - 4); g.stroke(); g.globalAlpha = 1;
      }
    }

    /* ── 09 · feedback loop ── */
    function loop(t, RING) {
      var W = env.W(), H = env.H(), u = Math.max(0, t - 15.1), p = sm(u / 1.1), cx = W * RING.cx, cy = H * RING.cy, rx = W * RING.rx, ry = H * RING.ry;
      g.lineWidth = 1; g.strokeStyle = 'rgba(91,163,245,0.4)';
      g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + p * TAU); g.stroke();
      if (p > 0.98) {
        g.fillStyle = 'rgba(91,163,245,0.9)';
        for (var k = 0; k < 7; k++) {
          var m = (-90 + 51.43 * k + 25.7) * Math.PI / 180, x = cx + rx * Math.cos(m), y = cy + ry * Math.sin(m), tx = -rx * Math.sin(m), ty = ry * Math.cos(m), l = Math.hypot(tx, ty), nx = tx / l, ny = ty / l;
          g.beginPath(); g.moveTo(x + nx * 5, y + ny * 5); g.lineTo(x - nx * 4 - ny * 3.5, y - ny * 4 + nx * 3.5); g.lineTo(x - nx * 4 + ny * 3.5, y - ny * 4 - nx * 3.5); g.closePath(); g.fill();
        }
        for (var c = 0; c < 3; c++) { var a = -Math.PI / 2 + (u * 0.09 + c / 3) * TAU; coin(cx + rx * Math.cos(a), cy + ry * Math.sin(a), 24, 0.95); }
      }
    }

    /* ── 08 · impact chart: baseline vs monitored resilience (own canvas, inside the impact panel) ── */
    function chart(t) {
      var host = env.els.chart, cv = host && host.firstElementChild;
      if (!cv || !host.clientWidth) return;
      var w = host.clientWidth, h = host.clientHeight, d = env.dpr();
      if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
      var c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, w, h);
      var p = sm(seg(t, 13.8, 14.9)), mx = w * 0.34, base = h * 0.74;
      c.font = '700 8px "IBM Plex Mono", monospace'; c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 1; c.setLineDash([3, 4]);
      c.beginPath(); c.moveTo(0, base); c.lineTo(w, base); c.moveTo(mx, 6); c.lineTo(mx, h - 6); c.stroke(); c.setLineDash([]);
      c.fillStyle = 'rgba(163,163,163,0.9)'; c.fillText('BASELINE', 6, h - 6); c.fillText('DEPLOYMENT', mx + 6, 14); c.fillText('MONITORING', w - 70, h - 6);
      function line(col, amp, off) {
        c.strokeStyle = col; c.lineWidth = 1.6; c.beginPath();
        var n = 48, up = Math.floor(n * p);
        for (var i = 0; i <= up; i++) {
          var u = i / n, x = w * u, y = u < 0.34 ? base - 3 * Math.sin(u * 30 + off) : base - amp * (1 - Math.exp(-(u - 0.34) * 4.2)) * h * 0.9 + 2 * Math.sin(u * 22 + off);
          if (i) c.lineTo(x, y); else c.moveTo(x, y);
        }
        c.stroke();
      }
      line('#5BA3F5', 0.74, 0); line('rgba(230,238,249,0.75)', 0.5, 2);
    }

    /* ── 05 · units leaving the company allocation for the resilience project ── */
    function units(t) {
      var co = env.rect(env.els.co), tg = env.rect(env.els.ecoTgt);
      if (!co.w || !tg.w) return 0;
      return stream([co.x + co.w, co.y + co.h * 0.62], [tg.x, tg.y + tg.h / 2], 70, 7.65, 12, 0.09, 0.75, t, 22);
    }

    /* ── 06 · capital: company → project on the map, then onto the farm ── */
    function capital(t) {
      if (pins.pune && pins.project && t >= 10.45 && t < 11.7) {
        var a = pins.pune, b = pins.project;
        stream([a[0], a[1]], [b[0], b[1]], 60, 10.5, 6, 0.1, 0.7, t, 14);
      }
      if (pins.farmer && t >= 11.55 && t < 12.6) {
        var top = [env.W() * 0.5, -12], f = pins.farmer;
        stream(top, [f[0], f[1] - 10], -30, 11.6, 6, 0.09, 0.55, t, 16, false);
      }
    }

    function frame(t, step) {
      var W = env.W(), H = env.H();
      g.setTransform(env.dpr(), 0, 0, env.dpr(), 0, 0);
      g.clearRect(0, 0, W, H);
      pins.farmer = null;
      earth(t, step);
      if (step === 3) engine(t);
      farm(t);
      var arrived = 0;
      if (step === 5) arrived = units(t);
      if (step === 6) capital(t);
      if (step === 8) chart(t);
      if (step === 9) loop(t, env.RING);
      pins.arrived = arrived;
    }

    return { frame: frame, pins: pins };
  }

  window.FRICSPaint = { create: create, keys: keys, seg: seg, sm: sm, clamp: clamp, lerp: lerp };
})();
