/**
 * frics-art.js — procedural artwork for the FRICS™ concept coin.
 *
 * Everything is drawn with Canvas 2D at whatever resolution the caller asks for,
 * so the coin stays sharp on 1440p / 4K / Retina — no raster coin PNGs.
 * The only bitmap is the existing Climactix logo asset, used (luminance → relief)
 * on the reverse.
 *
 * Exports window.FRICSArt:
 *   loadLogo()                       → Promise<HTMLImageElement|null>
 *   buildFace(side, size, done)      → done({ albedo, orm, normal }) canvases (async, sliced)
 *   buildEdge()                      → { normal } canvas for the lettered edge
 *   sprite(side, px)                 → cached 2D canvas of the coin face for flat renderers
 */
(function () {
  'use strict';
  if (window.FRICSArt) return;

  var TAU = Math.PI * 2;
  var FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  var PALETTE = { field: '#10254A', field2: '#1A3A6B', silver: '#E4EAF3', copper: '#C0743A' };

  var logoP = null;
  function loadLogo() {
    if (logoP) return logoP;
    logoP = new Promise(function (res) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { res(null); };
      im.src = 'Climatix_logo.png';
    });
    return logoP;
  }

  function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }
  function tick() { return new Promise(function (r) { setTimeout(r, 0); }); }

  /* ── drawing helpers (all take the coin unit u = size / 2048) ── */
  function ring(c, cx, cy, r, w) { c.lineWidth = w; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke(); }

  function spaced(c, txt, x, y, sp) {
    var i, w = 0, ws = [];
    for (i = 0; i < txt.length; i++) { ws[i] = c.measureText(txt[i]).width; w += ws[i] + (i < txt.length - 1 ? sp : 0); }
    var px = x - w / 2;
    c.textAlign = 'left';
    for (i = 0; i < txt.length; i++) { c.fillText(txt[i], px, y); px += ws[i] + sp; }
  }

  /* text on a circle. top: glyph tops point outward (baseline on r); bottom: tops point inward */
  function arcText(c, txt, cx, cy, r, top, sp) {
    var i, ws = [], tot = 0;
    for (i = 0; i < txt.length; i++) { ws[i] = c.measureText(txt[i]).width + sp; tot += ws[i]; }
    var a = top ? -Math.PI / 2 - tot / r / 2 : Math.PI / 2 + tot / r / 2;
    c.textAlign = 'center';
    for (i = 0; i < txt.length; i++) {
      var half = ws[i] / r / 2, m = top ? a + half : a - half;
      c.save();
      c.translate(cx + r * Math.cos(m), cy + r * Math.sin(m));
      c.rotate(top ? m + Math.PI / 2 : m - Math.PI / 2);
      c.fillText(txt[i], 0, 0);
      c.restore();
      a += top ? ws[i] / r : -ws[i] / r;
    }
  }

  /* five reverse symbols: water · soil · seed · sun · farm (stroke icons, unit ≈ 100px) */
  var ICONS = {
    water: function (c) {
      c.beginPath(); c.moveTo(0, -46); c.bezierCurveTo(10, -26, 30, -10, 30, 12);
      c.arc(0, 12, 30, 0, Math.PI); c.bezierCurveTo(-30, -10, -10, -26, 0, -46); c.stroke();
    },
    soil: function (c) {
      for (var i = 0; i < 3; i++) {
        var y = -22 + i * 22; c.beginPath(); c.moveTo(-44, y);
        c.quadraticCurveTo(-22, y - 10, 0, y); c.quadraticCurveTo(22, y + 10, 44, y); c.stroke();
      }
    },
    seed: function (c) {
      c.beginPath(); c.moveTo(0, 44); c.lineTo(0, -4); c.stroke();
      c.beginPath(); c.moveTo(0, -4); c.quadraticCurveTo(-42, -8, -38, -44); c.quadraticCurveTo(-4, -40, 0, -4); c.stroke();
      c.beginPath(); c.moveTo(0, 10); c.quadraticCurveTo(34, 6, 32, -22); c.quadraticCurveTo(4, -20, 0, 10); c.stroke();
    },
    sun: function (c) {
      c.beginPath(); c.arc(0, 0, 17, 0, TAU); c.stroke();
      for (var i = 0; i < 8; i++) {
        var a = i * TAU / 8; c.beginPath();
        c.moveTo(Math.cos(a) * 29, Math.sin(a) * 29); c.lineTo(Math.cos(a) * 45, Math.sin(a) * 45); c.stroke();
      }
    },
    farm: function (c) {
      c.beginPath(); c.moveTo(-46, -26); c.lineTo(46, -26); c.stroke();
      for (var i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 8, -26); c.lineTo(i * 46, 40); c.stroke(); }
    }
  };

  function emblem(c, cx, hy, u) {              // sun over a horizon, crop rows, soil strata, resilience arch
    c.lineCap = 'round'; c.lineWidth = 14 * u;
    c.beginPath(); c.arc(cx, hy, 200 * u, Math.PI, TAU); c.stroke();                 // resilience arch
    c.lineWidth = 6 * u;
    c.beginPath(); c.arc(cx, hy, 170 * u, Math.PI, TAU); c.stroke();
    c.beginPath(); c.arc(cx, hy - 82 * u, 40 * u, 0, TAU); c.fill();                  // sun
    c.lineWidth = 8 * u;
    for (var i = 0; i < 9; i++) {
      var a = Math.PI + (i + 0.5) * Math.PI / 9;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * 62 * u, hy - 82 * u + Math.sin(a) * 62 * u * 0.9);
      c.lineTo(cx + Math.cos(a) * 92 * u, hy - 82 * u + Math.sin(a) * 92 * u * 0.9); c.stroke();
    }
    c.lineWidth = 10 * u;
    c.beginPath(); c.moveTo(cx - 240 * u, hy); c.lineTo(cx + 240 * u, hy); c.stroke();   // horizon
    c.lineWidth = 7 * u;
    for (var k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(cx + k * 7 * u, hy + 8 * u); c.lineTo(cx + k * 62 * u, hy + 96 * u); c.stroke(); }
    c.lineWidth = 6 * u;                                                                // soil strata
    for (var s = 0; s < 2; s++) {
      var y = hy + (118 + s * 24) * u;
      c.beginPath(); c.moveTo(cx - 200 * u, y); c.quadraticCurveTo(cx - 100 * u, y - 14 * u, cx, y);
      c.quadraticCurveTo(cx + 100 * u, y + 14 * u, cx + 200 * u, y); c.stroke();
    }
  }

  function bands(c, cx, cy, u, topTxt, botTxt) {
    c.strokeStyle = c.fillStyle = '#fff';
    ring(c, cx, cy, 990 * u, 7 * u); ring(c, cx, cy, 950 * u, 3 * u);
    ring(c, cx, cy, 800 * u, 4 * u); ring(c, cx, cy, 782 * u, 2 * u);
    c.font = '700 ' + 64 * u + 'px ' + FONT;
    arcText(c, topTxt, cx, cy, 838 * u, true, 14 * u);
    arcText(c, botTxt, cx, cy, 892 * u, false, 14 * u);
  }

  /* relief mask: white = raised metal. inlay mask: copper ring. */
  function drawRelief(side, S, logo) {
    var c = mk(S), g = c.getContext('2d'), u = S / 2048, cx = S / 2, cy = S / 2;
    g.lineJoin = g.lineCap = 'round';
    if (side === 'front') {
      bands(g, cx, cy, u, 'MEASURABLE  ·  TRACEABLE  ·  VERIFIABLE', 'CLIMACTIX  ·  RESILIENCE UNIT');
      emblem(g, cx, cy - 380 * u, u);
      g.font = '700 ' + 300 * u + 'px ' + FONT; spaced(g, 'FRICS', cx - 26 * u, cy - 6 * u, 10 * u);
      g.font = '700 ' + 64 * u + 'px ' + FONT; g.textAlign = 'left'; g.fillText('™', cx + 500 * u, cy - 190 * u);
      g.lineWidth = 4 * u; g.beginPath(); g.moveTo(cx - 260 * u, cy + 56 * u); g.lineTo(cx - 24 * u, cy + 56 * u);
      g.moveTo(cx + 24 * u, cy + 56 * u); g.lineTo(cx + 260 * u, cy + 56 * u); g.stroke();
      g.beginPath(); g.moveTo(cx, cy + 42 * u); g.lineTo(cx + 13 * u, cy + 56 * u); g.lineTo(cx, cy + 70 * u); g.lineTo(cx - 13 * u, cy + 56 * u); g.closePath(); g.fill();
      g.font = '700 ' + 80 * u + 'px ' + FONT;
      ['FARMER', 'RESILIENCE', 'IMPACT', 'CREDIT'].forEach(function (t, i) { spaced(g, t, cx, cy + (170 + i * 104) * u, 16 * u); });
    } else {
      bands(g, cx, cy, u, 'RESILIENCE  •  FOOD  •  FUTURE', 'SECURING OUR FOOD CHAIN');
      var lw = 940 * u;
      if (logo) {
        var lh = lw * logo.height / logo.width, t = mk(Math.ceil(lw), Math.ceil(lh)), tg = t.getContext('2d');
        tg.drawImage(logo, 0, 0, t.width, t.height);
        var d = tg.getImageData(0, 0, t.width, t.height), p = d.data;
        for (var i = 0; i < p.length; i += 4) {                                           // luminance → alpha
          var l = (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) / 255;
          var a = Math.max(0, Math.min(1, (l - 0.18) / 0.5));
          p[i] = p[i + 1] = p[i + 2] = 255; p[i + 3] = a * 255;
        }
        tg.putImageData(d, 0, 0);
        g.drawImage(t, cx - lw / 2, cy - lh / 2 - 90 * u);
      } else {
        g.font = '700 ' + 190 * u + 'px ' + FONT; spaced(g, 'CLIMACTIX', cx, cy - 60 * u, 10 * u);
      }
      g.lineWidth = 9 * u;
      ['water', 'soil', 'seed', 'sun', 'farm'].forEach(function (n, i) {
        g.save(); g.translate(cx + (i - 2) * 170 * u, cy + 500 * u); g.scale(u * 1.05, u * 1.05); g.lineWidth = 9; ICONS[n](g); g.restore();
      });
    }
    var ic = mk(S), ig = ic.getContext('2d'); ig.strokeStyle = '#fff'; ring(ig, cx, cy, 968 * u, 12 * u);
    return { relief: c, inlay: ic };
  }

  function tint(mask, color) {
    var c = mk(mask.width), g = c.getContext('2d');
    g.drawImage(mask, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  /* tangent-space normal map from a float height field */
  function normalRows(h, W, H, k, out, y0, y1) {
    for (var y = y0; y < y1; y++) {
      var ym = Math.max(0, y - 1), yp = Math.min(H - 1, y + 1);
      for (var x = 0; x < W; x++) {
        var xm = Math.max(0, x - 1), xp = Math.min(W - 1, x + 1);
        var dx = (h[y * W + xp] - h[y * W + xm]) * k, dy = (h[yp * W + x] - h[ym * W + x]) * k;
        var inv = 1 / Math.sqrt(dx * dx + dy * dy + 1), o = (y * W + x) * 4;
        out[o] = (-dx * inv * 0.5 + 0.5) * 255; out[o + 1] = (dy * inv * 0.5 + 0.5) * 255; out[o + 2] = (inv * 0.5 + 0.5) * 255; out[o + 3] = 255;
      }
    }
  }

  function boxBlur(src, W, H, r) {           // separable, edge-clamped
    var tmp = new Float32Array(W * H), dst = new Float32Array(W * H), n = 2 * r + 1, x, y, i, acc;
    for (y = 0; y < H; y++) {
      acc = 0; for (i = -r; i <= r; i++) acc += src[y * W + Math.min(W - 1, Math.max(0, i))];
      for (x = 0; x < W; x++) {
        tmp[y * W + x] = acc / n;
        acc += src[y * W + Math.min(W - 1, x + r + 1)] - src[y * W + Math.max(0, x - r)];
      }
    }
    for (x = 0; x < W; x++) {
      acc = 0; for (i = -r; i <= r; i++) acc += tmp[Math.min(H - 1, Math.max(0, i)) * W + x];
      for (y = 0; y < H; y++) {
        dst[y * W + x] = acc / n;
        acc += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x];
      }
    }
    return dst;
  }

  /* async + sliced so the one-time build never produces a long task */
  function buildFace(side, S, done) {
    loadLogo().then(function (logo) { return tick().then(function () { return logo; }); }).then(function (logo) {
      var m = drawRelief(side, S, logo), u = S / 2048;
      var albedo = mk(S), a = albedo.getContext('2d');
      a.fillStyle = PALETTE.field; a.fillRect(0, 0, S, S);
      var rg = a.createRadialGradient(S / 2, S / 2, S * 0.18, S / 2, S / 2, S / 2);          // baked occlusion toward the rim wall
      rg.addColorStop(0, 'rgba(40,80,150,0.16)'); rg.addColorStop(0.8, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,0.5)');
      a.fillStyle = rg; a.fillRect(0, 0, S, S);
      a.drawImage(tint(m.relief, PALETTE.silver), 0, 0); a.drawImage(tint(m.inlay, PALETTE.copper), 0, 0);
      var orm = mk(S), o = orm.getContext('2d');                                              // G = roughness, B = metalness
      o.fillStyle = 'rgb(255,140,120)'; o.fillRect(0, 0, S, S);
      o.drawImage(tint(m.relief, 'rgb(255,78,235)'), 0, 0); o.drawImage(tint(m.inlay, 'rgb(255,96,255)'), 0, 0);
      return tick().then(function () {
        var rd = m.relief.getContext('2d').getImageData(0, 0, S, S).data, id = m.inlay.getContext('2d').getImageData(0, 0, S, S).data;
        var h = new Float32Array(S * S), i;
        for (i = 0; i < h.length; i++) h[i] = (rd[i * 4 + 3] + id[i * 4 + 3] * 0.35) / 255;
        return tick().then(function () {
          var hb = boxBlur(h, S, S, Math.max(1, Math.round(2.4 * u)));
          for (i = 0; i < hb.length; i++) hb[i] += ((Math.sin(i % S * 0.9) * 0.5 + 0.5) * 0.012);   // faint brushed grain
          var normal = mk(S), n = normal.getContext('2d'), img = n.createImageData(S, S), y = 0, band = 192;
          (function step() {
            normalRows(hb, S, S, 6 * u * 2, img.data, y, Math.min(S, y + band));
            y += band;
            if (y < S) { setTimeout(step, 0); return; }
            n.putImageData(img, 0, 0);
            done({ albedo: albedo, orm: orm, normal: normal });
          })();
        });
      });
    });
  }


  /* shared, memoised face sets: a second coin (or a smaller size) reuses the first build */
  var faceMemo = {};
  function scaled(c, S) { var o = mk(S), g = o.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, S, S); return o; }
  function facesP(S) {
    if (faceMemo[S]) return faceMemo[S];
    var big = 0; Object.keys(faceMemo).forEach(function (k) { if (+k > S && (!big || +k < big)) big = +k; });
    if (big) {
      faceMemo[S] = faceMemo[big].then(function (f) {
        function d(x) { return { albedo: scaled(x.albedo, S), orm: scaled(x.orm, S), normal: scaled(x.normal, S) }; }
        return { front: d(f.front), back: d(f.back) };
      });
    } else {
      faceMemo[S] = new Promise(function (res) {
        buildFace('front', S, function (fr) { buildFace('back', S, function (bk) { res({ front: fr, back: bk }); }); });
      });
    }
    return faceMemo[S];
  }

  function buildEdge() {                     // lettered edge: CLIMACTIX ◆ repeated, plus milled borders
    var W = 4096, H = 128, c = mk(W, H), g = c.getContext('2d'), N = 6, unit = W / N;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.font = '700 70px ' + FONT; g.textBaseline = 'middle';
    for (var i = 0; i < N; i++) { spaced(g, 'CLIMACTIX', i * unit + unit * 0.44, H / 2 + 3, 10); }
    for (var j = 0; j < N; j++) {
      var dx = j * unit + unit * 0.9; g.beginPath(); g.moveTo(dx, H / 2 - 12); g.lineTo(dx + 10, H / 2); g.lineTo(dx, H / 2 + 12); g.lineTo(dx - 10, H / 2); g.fill();
    }
    g.fillRect(0, 6, W, 4); g.fillRect(0, H - 10, W, 4);
    var d = g.getImageData(0, 0, W, H).data, h = new Float32Array(W * H);
    for (var p = 0; p < h.length; p++) h[p] = d[p * 4] / 255;
    var hb = boxBlur(h, W, H, 1), out = mk(W, H), og = out.getContext('2d'), img = og.createImageData(W, H);
    normalRows(hb, W, H, 5, img.data, 0, H); og.putImageData(img, 0, 0);
    return { normal: out };
  }

  /* cheap flat coin for 2D scenes: rim + navy field + silver relief, with a fixed light sweep */
  var spriteCache = {};
  function sprite(side, px) {
    var key = side + px; if (spriteCache[key]) return spriteCache[key];
    var S = px, c = mk(S), g = c.getContext('2d'), r = S / 2;
    g.save(); g.beginPath(); g.arc(r, r, r, 0, TAU); g.clip();
    var rim = g.createLinearGradient(0, 0, S, S);
    rim.addColorStop(0, '#F2F6FB'); rim.addColorStop(0.45, '#9FB0C6'); rim.addColorStop(1, '#5D6E86');
    g.fillStyle = rim; g.fillRect(0, 0, S, S);
    g.beginPath(); g.arc(r, r, r * 0.9, 0, TAU); g.fillStyle = PALETTE.field; g.fill(); g.clip();
    var fg = g.createRadialGradient(r * 0.8, r * 0.7, 0, r, r, r); fg.addColorStop(0, PALETTE.field2); fg.addColorStop(1, PALETTE.field);
    g.fillStyle = fg; g.fillRect(0, 0, S, S);
    var lg = spriteLogo;                                                   // optional, set once loaded
    var m = drawRelief(side, Math.max(256, S * 2), lg);
    g.drawImage(tint(m.relief, PALETTE.silver), 0, 0, S, S); g.drawImage(tint(m.inlay, PALETTE.copper), 0, 0, S, S);
    var sh = g.createLinearGradient(0, 0, S, S);
    sh.addColorStop(0, 'rgba(255,255,255,0.20)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.32)');
    g.fillStyle = sh; g.fillRect(0, 0, S, S);
    g.restore();
    return (spriteCache[key] = c);
  }
  var spriteLogo = null;
  loadLogo().then(function (im) { spriteLogo = im; spriteCache = {}; });

  window.FRICSArt = { loadLogo: loadLogo, buildFace: buildFace, faces: facesP, buildEdge: buildEdge, sprite: sprite, palette: PALETTE };
})();
