/**
 * frics-scene.js — the stylised geospatial farmland used in steps 01–04 of the FRICS™ story.
 *
 * A synthetic isometric parcel model (8 × 6 parcels, a river, a soil cross-section) drawn on
 * Canvas 2D. It is a pure renderer: draw(ctx, p) paints one frame from the parameters
 *   p.t        seconds (only drives shimmer / dash / ripple phase)
 *   p.reveal   0–1   parcels build in from the back
 *   p.stress   0–1   climate-pressure overlays (heat, drought, flood, rain variability, soil loss)
 *   p.recover  0–1   how far interventions have offset that pressure
 *   p.iv       0–1   intervention progress (irrigation → pond → agroforestry → weather mast)
 *   p.dim      0–1   fades the whole scene back while later steps take the stage
 *   p.extras   0–1   (optional, default 1) shows the agroforestry line + weather mast
 * Everything is illustrative — no real parcel, hazard or agronomic data.
 */
(function () {
  'use strict';
  if (window.FRICSScene) return;

  var N = 8, M = 6;                                   // parcels along i and j
  var C = {
    ground: '#0C1830', edge: 'rgba(91,163,245,0.16)', row: [79, 143, 214], rowDry: [201, 122, 43],
    sand: [120, 96, 60], water: [27, 110, 235], sky: [91, 163, 245], amber: [232, 119, 34]
  };

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function sm(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function mix(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')'; }
  function hash(i, j, k) { var s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return s - Math.floor(s); }

  function stressAt(i, j) {                           // where pressure concentrates (hot patch + a dry pocket)
    var a = (i - 6.2) * (i - 6.2) + (j - 1.4) * (j - 1.4), b = (i - 2.4) * (i - 2.4) + (j - 4.6) * (j - 4.6);
    return clamp(Math.exp(-a / 9) + 0.6 * Math.exp(-b / 6), 0, 1);
  }
  function coverAt(i, j) {                            // where interventions land
    var a = Math.max(0, 1 - Math.hypot(i - 2.5, j - 1.5) / 3.1), b = Math.max(0, 1 - Math.hypot(i - 6.4, j - 4.4) / 2.6);
    return clamp(Math.max(a, b) * 1.25, 0, 1);
  }

  function create() {
    var W = 0, H = 0, tw = 0, th = 0, ox = 0, oy = 0, depth = 0;

    function resize(w, h) {
      W = w; H = h;
      tw = Math.min(W * 0.58 / (N + M), H * 0.74 / ((N + M) * 0.5 + 1.1));
      th = tw * 0.5; depth = tw * 0.55;
      ox = W / 2 - (N - M) / 2 * tw;
      oy = (H - ((N + M) * th + depth)) / 2 + H * 0.02;
    }
    function P(i, j, z) { return [ox + (i - j) * tw, oy + (i + j) * th - (z || 0)]; }
    function poly(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (var k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]); g.closePath(); }

    function strata(g, a, b, p) {                     // one visible soil face: topsoil / subsoil / water table
      var top = 0.34 - 0.13 * p.stress + 0.11 * p.recover, aq = 0.66 + 0.11 * p.stress - 0.11 * p.recover;
      var cuts = [0, top, aq, 1], cols = [[74, 54, 34], [44, 32, 22], [16, 52, 96]];
      for (var s = 0; s < 3; s++) {
        var y0 = cuts[s] * depth, y1 = cuts[s + 1] * depth;
        poly(g, [[a[0], a[1] + y0], [b[0], b[1] + y0], [b[0], b[1] + y1], [a[0], a[1] + y1]]);
        g.fillStyle = rgba(cols[s], 1); g.fill();
      }
      g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(a[0], a[1] + 0.5); g.lineTo(b[0], b[1] + 0.5); g.stroke();
    }

    function drawCell(g, i, j, p) {
      var appear = (i + j) / (N + M) * 0.55, a = sm((p.reveal - appear) / 0.45);
      if (a <= 0.01) return;
      var w = stressAt(i, j) * p.stress, cov = coverAt(i, j), rec = p.recover * cov, hlt = clamp(w * (1 - rec * 0.9), 0, 1);
      var lift = (1 - a) * 8, g0 = 0.05;
      var pts = [P(i + g0, j + g0), P(i + 1 - g0, j + g0), P(i + 1 - g0, j + 1 - g0), P(i + g0, j + 1 - g0)];
      pts.forEach(function (q) { q[1] += lift; });
      g.globalAlpha = a * (1 - 0.93 * p.dim);
      poly(g, pts);
      g.fillStyle = rgba(mix(mix([12, 24, 48], C.sand, hlt * 0.55), [16, 58, 104], rec * 0.6), 1); g.fill();
      g.strokeStyle = C.edge; g.lineWidth = 1; g.stroke();
      if (hlt > 0.02) { poly(g, pts); g.fillStyle = rgba(C.amber, 0.16 * hlt); g.fill(); }   // heat tint
      var col = mix(C.row, C.rowDry, hlt);
      g.lineWidth = 1.2; g.strokeStyle = rgba(col, 0.55 + 0.3 * rec);
      g.beginPath();
      for (var f = 0.2; f < 0.9; f += 0.2) {
        var s0 = P(i + 0.12, j + f, 0), s1 = P(i + 0.88, j + f, 0); g.moveTo(s0[0], s0[1] + lift); g.lineTo(s1[0], s1[1] + lift);
      }
      g.stroke();
      if (w > 0.45) {                                                                      // drought cracks
        g.strokeStyle = rgba(C.sand, 0.55 * (w - 0.3)); g.lineWidth = 1; g.beginPath();
        for (var k = 0; k < 3; k++) {
          var cx = i + 0.25 + hash(i, j, k) * 0.5, cy = j + 0.25 + hash(j, i, k + 3) * 0.5, s = P(cx, cy), e = P(cx + 0.22 * (hash(i, k, 9) - 0.5), cy + 0.26 * hash(k, j, 5));
          g.moveTo(s[0], s[1] + lift); g.lineTo((s[0] + e[0]) / 2 + 3, (s[1] + e[1]) / 2 + lift - 2); g.lineTo(e[0], e[1] + lift);
        }
        g.stroke();
      }
      g.globalAlpha = 1;
    }

    function draw(g, p) {
      g.clearRect(0, 0, W, H);
      g.save();
      g.lineJoin = g.lineCap = 'round';
      var sceneA = 1 - 0.93 * p.dim;

      /* faint survey grid beyond the parcels */
      g.globalAlpha = 0.5 * sceneA * clamp(p.reveal * 2, 0, 1); g.strokeStyle = 'rgba(91,163,245,0.07)'; g.lineWidth = 1; g.beginPath();
      for (var k = -3; k <= N + 3; k++) { var a0 = P(k, -3), a1 = P(k, M + 3); g.moveTo(a0[0], a0[1]); g.lineTo(a1[0], a1[1]); }
      for (var m = -3; m <= M + 3; m++) { var b0 = P(-3, m), b1 = P(N + 3, m); g.moveTo(b0[0], b0[1]); g.lineTo(b1[0], b1[1]); }
      g.stroke(); g.globalAlpha = 1;

      /* soil cross-section on the two visible faces */
      var sa = sm(p.reveal * 1.4) * sceneA; g.globalAlpha = sa;
      strata(g, P(0, M), P(N, M), p); strata(g, P(N, M), P(N, 0), p);
      g.globalAlpha = 1;

      /* parcels, back to front */
      for (var d = 0; d <= N + M - 2; d++) for (var i = 0; i < N; i++) { var j = d - i; if (j >= 0 && j < M) drawCell(g, i, j, p); }

      /* river; widens under flood pressure */
      var rw = 0.13 + 0.2 * p.stress * (1 - p.recover * 0.6), ra = sm(p.reveal * 1.3) * sceneA;
      poly(g, [P(0, 3 - rw), P(N, 3 - rw), P(N, 3 + rw), P(0, 3 + rw)]);
      g.globalAlpha = ra; g.fillStyle = rgba(C.water, 0.55); g.fill(); g.strokeStyle = rgba(C.sky, 0.45); g.lineWidth = 1; g.stroke();
      g.globalAlpha = 1;

      var A = sceneA;
      /* heat shimmer over the hot patch */
      if (p.stress > 0.02) {
        g.strokeStyle = rgba(C.amber, 0.3 * p.stress * (1 - p.recover * 0.8) * A); g.lineWidth = 1.2;
        for (var h = 0; h < 4; h++) {
          g.beginPath();
          for (var x = 0; x <= 1; x += 0.05) {
            var q = P(5 + x * 3, 0.6 + h * 0.5, 18 + h * 9), yy = q[1] + Math.sin(x * 9 + p.t * 2.2 + h) * 3;
            if (x === 0) g.moveTo(q[0], yy); else g.lineTo(q[0], yy);
          }
          g.stroke();
        }
        /* rainfall variability: sparse, irregular streaks over the west side */
        var pulse = clamp(Math.sin(p.t * 1.7) * 0.6 + 0.5, 0, 1);
        g.strokeStyle = rgba(C.sky, 0.32 * p.stress * pulse * A); g.lineWidth = 1;
        g.beginPath();
        for (var r = 0; r < 12; r++) {
          var o = P(0.4 + hash(r, 1, 2) * 3.2, 0.2 + hash(r, 3, 4) * 3, 0), fall = ((p.t * 60 + r * 37) % 40);
          g.moveTo(o[0] - 2, o[1] - 34 + fall); g.lineTo(o[0] - 5, o[1] - 24 + fall);
        }
        g.stroke();
      }

      /* interventions */
      var ir = sm(clamp(p.iv / 0.5, 0, 1)), po = sm(clamp((p.iv - 0.15) / 0.5, 0, 1)), ex = p.extras === undefined ? 1 : p.extras, tr = clamp((p.iv - 0.3) / 0.5, 0, 1) * ex, ma = sm(clamp((p.iv - 0.45) / 0.5, 0, 1)) * ex;
      if (ir > 0) {                                                                       // water-efficient irrigation
        g.strokeStyle = rgba([156, 198, 255], 0.9 * ir * A); g.lineWidth = 1.5;
        g.beginPath(); var t0 = P(0.9, 2.85), t1 = P(0.9, 0.15); g.moveTo(t0[0], t0[1]); g.lineTo(t1[0], t1[1]); g.stroke();
        g.setLineDash([3, 5]); g.lineDashOffset = -p.t * 14; g.strokeStyle = rgba(C.sky, 0.95 * ir * A); g.lineWidth = 1.3; g.beginPath();
        for (var ci = 1; ci < 5; ci++) for (var cj = 0; cj < 3; cj++) for (var f = 0.2; f < 0.9; f += 0.2) {
          var u0 = P(ci + 0.12, cj + f), u1 = P(ci + 0.88, cj + f); g.moveTo(u0[0], u0[1]); g.lineTo(u1[0], u1[1]);
        }
        g.stroke(); g.setLineDash([]);
      }
      if (po > 0) {                                                                       // rainwater harvesting pond
        var pc = P(6.4, 4.4);
        g.save(); g.translate(pc[0], pc[1]); g.scale(1, 0.5);
        g.globalAlpha = po * A; g.fillStyle = rgba(C.water, 0.7); g.beginPath(); g.arc(0, 0, tw * 0.95 * po, 0, 6.2832); g.fill();
        g.strokeStyle = rgba([156, 198, 255], 0.8); g.lineWidth = 1.5; g.stroke();
        for (var q2 = 0; q2 < 2; q2++) {
          var ph = (p.t * 0.5 + q2 * 0.5) % 1; g.strokeStyle = rgba([156, 198, 255], (1 - ph) * 0.5 * po * A);
          g.beginPath(); g.arc(0, 0, tw * (0.2 + 0.7 * ph), 0, 6.2832); g.stroke();
        }
        g.restore(); g.globalAlpha = 1;
      }
      for (var tI = 0; tI < M; tI++) {                                                    // agroforestry line
        var ta = sm(clamp(tr * 1.6 - tI * 0.12, 0, 1)); if (ta <= 0) continue;
        var tp = P(0.05, tI + 0.5), th2 = tw * 0.42 * ta;
        g.globalAlpha = A; g.strokeStyle = 'rgba(160,190,200,0.8)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(tp[0], tp[1]); g.lineTo(tp[0], tp[1] - th2); g.stroke();
        g.fillStyle = 'rgba(76,143,134,0.92)'; g.beginPath(); g.arc(tp[0], tp[1] - th2 - tw * 0.12 * ta, tw * 0.17 * ta, 0, 6.2832); g.fill();
        g.globalAlpha = 1;
      }
      if (ma > 0) {                                                                       // weather-intelligence mast
        var mp = P(7.3, 1.2), mh = tw * 1.1 * ma;
        g.globalAlpha = A; g.strokeStyle = 'rgba(200,214,232,0.9)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(mp[0], mp[1]); g.lineTo(mp[0], mp[1] - mh); g.stroke();
        g.fillStyle = rgba(C.sky, 1); g.beginPath(); g.arc(mp[0], mp[1] - mh, 3, 0, 6.2832); g.fill();
        for (var w2 = 0; w2 < 2; w2++) {
          var wp = (p.t * 0.6 + w2 * 0.5) % 1; g.strokeStyle = rgba(C.sky, (1 - wp) * 0.7 * ma);
          g.beginPath(); g.arc(mp[0], mp[1] - mh, 6 + wp * 24, -2.4, -0.74); g.stroke();
        }
        g.globalAlpha = 1;
      }
      g.restore();
    }

    return { resize: resize, draw: draw, project: P, metrics: function () { return { tw: tw, th: th, ox: ox, oy: oy, depth: depth }; } };
  }

  window.FRICSScene = { create: create };
})();
