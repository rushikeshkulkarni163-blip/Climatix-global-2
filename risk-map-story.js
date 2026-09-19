/**
 * risk-map-story.js — Risk Intelligence Map walkthrough (≈21 s, synthetic data).
 *
 * One 2D-canvas renderer (same engine as before: DPR-scaled, orthographic
 * Earth, continuous world → country → region → city → facility zoom). This
 * revision adds the Earth-observation story on top of it:
 *
 *   Earth  →  CTX-SAT-01 enters orbit  →  scan  →  data acquired  →  downlink
 *   →  nine data streams enter Climactix  →  six layers build  →  main pass
 *   detects a thermal anomaly over Pune  →  zoom to the facility  →  signal to
 *   exposure to risk to materiality  →  illustrative scenarios  →  decision.
 *
 * Earth: a procedurally shaded texture built once from the real coastlines
 * (land/ocean, coastal shelf, relief, clouds) and sampled per screen pixel
 * with a fixed sun for day/night; coastlines and borders are drawn as vectors
 * on top. Terrain shading and clouds are procedural, not survey data.
 *
 * EVERYTHING numeric here is synthetic: signal values, counters, the facility
 * network, risk levels, the satellite and its orbit (not to scale).
 */
(function () {
  'use strict';

  var GEO = window.CX_RIM_GEO;
  if (!GEO) { console.warn('[rim] geometry missing'); return; }

  var D2R = Math.PI / 180;
  var TAU = Math.PI * 2;
  var EARTH_R = 6371000;                               // metres

  /* ═══ timeline (seconds) ═══ */
  var T = {
    earthIn: 1.0,
    scan1: [2.9, 4.6],                                 // swath scan over the Middle East
    layers: [5.2, 6.0, 6.8, 7.6, 8.4, 9.0], layerDur: 0.8,
    scan2: [7.3, 9.2], detect: 8.2,                    // spotlight pass over Pune
    zoom: 9.8,
    brief: 14.1, chain: 14.4, chainStep: 0.35,
    scen: [16.6, 17.2, 17.8], final: 18.9,
    end: 20.8
  };
  var ZOOM_KEYS = [[9.8, 0], [10.8, 1], [11.0, 1], [11.9, 2], [12.05, 2], [12.85, 3], [13.0, 3], [14.0, 4]];
  var LAYER_NAMES = ['Climate signals', 'Earth observation', 'Exposure', 'Risk', 'Financial materiality', 'Decision intelligence'];
  var NLAY = 6;

  /* ═══ extended timeline ═══
     Three analytical layers (carbon exposure · narrative intelligence · NGFS scenario modelling) and a
     closing synthesis are played on the SAME Earth and the SAME facility view. Two holds freeze the
     original ("base") clock at chosen moments; everything else in the original story runs unchanged.
     te = extended clock · tb = base clock. The satellite / detection clock keeps running through the
     first hold so the scan finishes naturally instead of freezing mid-swath. */
  var HOLDS = [{ tb: 8.35, dur: 13.6 }, { tb: 17.9, dur: 3.4 }];
  var PH = { carbon: [8.35, 12.55], narrative: [12.55, 17.15], scenario: [17.15, 21.95], synth: [31.5, 34.9] };
  var TEND = T.end; HOLDS.forEach(function (h) { TEND += h.dur; });
  function baseTime(te) {
    var acc = 0;
    for (var i = 0; i < HOLDS.length; i++) {
      var h = HOLDS[i], s0 = h.tb + acc;
      if (te < s0) return te - acc;
      if (te < s0 + h.dur) return h.tb;
      acc += h.dur;
    }
    return te - acc;
  }
  function teOf(tb) { var acc = 0; for (var i = 0; i < HOLDS.length; i++) { if (tb > HOLDS[i].tb) acc += HOLDS[i].dur; } return tb + acc; }
  /* display order of the nine layers, and the data-layer id each one has in the DOM (base ids 1–6 are unchanged) */
  var LAYER_ORDER = [1, 2, 3, 4, 7, 8, 9, 5, 6];
  var LAYER_TITLES = ['Climate signals', 'Earth observation', 'Exposure', 'Risk', 'Carbon exposure', 'Narrative intelligence', 'Scenario modelling', 'Financial materiality', 'Decision intelligence'];
  var EMPH_N = 9, EMPH_ALL = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  function streamT0(i) { return i === 0 ? 3.0 : 3.6 + (i - 1) * 0.28; }

  /* ═══ synthetic data ═══ */
  var SOURCES = [                                      // label, side, landing (unit-disc offsets), value id
    ['SATELLITE OBSERVATION', 'L', -0.50, 0.42, 'sat'], ['CLIMATE MODEL', 'L', -0.62, 0.16, 'temp'], ['WEATHER', 'L', -0.58, -0.12, 'precip'],
    ['EMISSIONS', 'L', -0.46, -0.36, 'flux'], ['ENVIRONMENTAL DATA', 'L', -0.30, -0.58, 'soil'],
    ['CORPORATE DATA', 'R', 0.32, 0.52, 'corp'], ['SUPPLY CHAIN', 'R', 0.56, 0.24, 'supply'],
    ['REGULATORY SIGNALS', 'R', 0.58, -0.10, 'reg'], ['FINANCIAL DATA', 'R', 0.40, -0.44, 'fin']
  ];
  var FAC = [
    { n: 'Pune', lat: 18.605, lon: 73.779, risk: 'high', fin: 0.95, rank: 1, hero: true },
    { n: 'Chennai', lat: 13.08, lon: 80.27, risk: 'high', fin: 0.72, rank: 2 },
    { n: 'Ahmedabad', lat: 23.02, lon: 72.57, risk: 'mod', fin: 0.45 },
    { n: 'Visakhapatnam', lat: 17.69, lon: 83.22, risk: 'mod', fin: 0.40 },
    { n: 'Kolkata', lat: 22.57, lon: 88.36, risk: 'high', fin: 0.60 },
    { n: 'Stuttgart', lat: 48.78, lon: 9.18, risk: 'low', fin: 0.20 },
    { n: 'Hamburg', lat: 53.55, lon: 9.99, risk: 'low', fin: 0.28 },
    { n: 'Houston', lat: 29.76, lon: -95.37, risk: 'high', fin: 0.80, rank: 3 },
    { n: 'Detroit', lat: 42.33, lon: -83.05, risk: 'low', fin: 0.22 },
    { n: 'Ho Chi Minh City', lat: 10.82, lon: 106.63, risk: 'high', fin: 0.55 },
    { n: 'Hanoi', lat: 21.03, lon: 105.85, risk: 'mod', fin: 0.35 },
    { n: 'São Paulo', lat: -23.55, lon: -46.63, risk: 'mod', fin: 0.42 },
    { n: 'Curitiba', lat: -25.43, lon: -49.27, risk: 'low', fin: 0.18 },
    { n: 'Durban', lat: -29.86, lon: 31.02, risk: 'mod', fin: 0.38 }
  ];
  var SUP = [
    { n: 'Shenzhen', lat: 22.54, lon: 114.06 }, { n: 'Shanghai', lat: 31.23, lon: 121.47 },
    { n: 'Singapore', lat: 1.29, lon: 103.85 }, { n: 'Jebel Ali', lat: 25.0, lon: 55.1 },
    { n: 'Rotterdam', lat: 51.92, lon: 4.48 }, { n: 'Busan', lat: 35.1, lon: 129.04 },
    { n: 'Santos', lat: -23.96, lon: -46.3 }, { n: 'Mumbai', lat: 18.95, lon: 72.95 }
  ];
  var ROUTES = [
    ['s', 0, 0], ['s', 3, 0], ['s', 7, 0], ['s', 2, 1], ['s', 2, 9], ['s', 1, 10], ['s', 0, 9],
    ['s', 4, 5], ['s', 4, 6], ['s', 6, 11], ['s', 6, 12], ['s', 3, 13], ['f', 1, 6], ['f', 0, 7]
  ];
  var CITIES = [[28.61, 77.21], [19.08, 72.88], [12.97, 77.59], [25.2, 55.27], [30.04, 31.24], [6.52, 3.38], [-1.29, 36.82], [41.0, 28.98],
    [55.75, 37.62], [51.5, -0.12], [48.86, 2.35], [40.71, -74.0], [19.43, -99.13], [-34.6, -58.38], [39.9, 116.4], [35.68, 139.69],
    [-6.2, 106.85], [-33.87, 151.21], [-26.2, 28.05], [24.86, 67.0], [23.81, 90.41], [13.76, 100.5], [14.6, 120.98], [24.71, 46.68]];
  var HAZARDS = [
    ['TEMPERATURE', 22, 12], ['PRECIPITATION', -4, -62], ['FLOOD', 24, 90], ['HEAT', 26, 48],
    ['CYCLONE', 14, 88], ['DROUGHT', 6, 40], ['SEA LEVEL', 10, 106]
  ];
  var THERMAL = [[25.5, 49.5], [27.2, 71.2], [15.5, 3.0], [22.4, 80.2], [-24.0, 25.0], [33.5, 44.0], [30.5, -5.0], [12.0, 30.0]];
  var HERO = FAC[0];
  var PUNE_CITY = { lat: 18.5204, lon: 73.8567 };
  var DEG_M = 111320;

  var WP = [
    null,
    { lat: 22.2, lon: 79.6, wFit: 0.52, hFit: 0.50 },
    { lat: 19.0, lon: 76.6, wFit: 0.15, hFit: 0.12 },
    { lat: 18.56, lon: 73.82, wFit: 0.0046, hFit: 0.0042 },
    { lat: HERO.lat, lon: HERO.lon, wFit: 0.00016, hFit: 0.00009 }
  ];

  /* ═══ math ═══ */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function seg(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function easeIO(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hash2(ix, iy) {
    var h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) | 0;
    h = Math.imul(h ^ h >>> 13, 1274126177);
    return ((h ^ h >>> 16) >>> 0) / 4294967295;
  }
  function vnoise(x, y) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    var u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    var a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function hash3(x, y, z) {
    var h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177) | 0;
    h = Math.imul(h ^ h >>> 13, 1103515245);
    return ((h ^ h >>> 16) >>> 0) / 4294967295;
  }
  function vnoise3(x, y, z) {                          // seamless on the sphere when fed unit vectors
    var ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    var fx = x - ix, fy = y - iy, fz = z - iz;
    var u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
    var a = hash3(ix, iy, iz), b = hash3(ix + 1, iy, iz), c = hash3(ix, iy + 1, iz), d = hash3(ix + 1, iy + 1, iz);
    var e = hash3(ix, iy, iz + 1), f = hash3(ix + 1, iy, iz + 1), g = hash3(ix, iy + 1, iz + 1), h = hash3(ix + 1, iy + 1, iz + 1);
    var x0 = a + (b - a) * u, x1 = c + (d - c) * u, x2 = e + (f - e) * u, x3 = g + (h - g) * u;
    var y0 = x0 + (x1 - x0) * v, y1 = x2 + (x3 - x2) * v;
    return y0 + (y1 - y0) * w;
  }
  function fbm3(x, y, z, oct) {
    var s = 0, a = 0.5, n = 0, f = 1;
    for (var i = 0; i < oct; i++) { s += a * vnoise3(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2.03; }
    return s / n;
  }

  /* ═══ illustrative hazard field (screen-sampled) ═══ */
  var OCT = [[0.13, 0.50], [0.55, 0.28], [2.3, 0.16], [9.5, 0.10], [40, 0.07], [170, 0.05], [700, 0.04]];
  var HOT = [];
  FAC.forEach(function (f) { if (f.risk === 'high') HOT.push([f.lat, f.lon, 2.6, 0.22]); });
  HOT.push([PUNE_CITY.lat, PUNE_CITY.lon, 0.07, 0.22]);
  HOT.push([HERO.lat, HERO.lon, 0.09, 0.22]);
  HOT.push([HERO.lat, HERO.lon, 0.0028, 0.16]);
  function field(lat, lon, degPer) {
    var v = 0, a = 0, i, o, w;
    for (i = 0; i < OCT.length; i++) {
      o = OCT[i];
      w = i === 0 ? 1 : 1 - smooth(seg(o[0] * degPer, 0.22, 0.5));
      if (w <= 0) break;
      v += o[1] * w * vnoise(lon * o[0] + 31.7 * i, lat * o[0] + 17.3 * i);
      a += o[1] * w;
    }
    v /= a;
    var tropic = Math.exp(-Math.pow((Math.abs(lat) - 18) / 24, 2));
    var h = (v - 0.5) * 1.7 + 0.32 + tropic * 0.14;
    var cl = Math.cos(lat * D2R), dla, dlo, s2;
    for (i = 0; i < HOT.length; i++) {
      o = HOT[i];
      dla = lat - o[0];
      if (dla > o[2] * 4 || dla < -o[2] * 4) continue;
      dlo = (lon - o[1]) * cl;
      s2 = o[2] * o[2];
      h += o[3] * Math.exp(-(dla * dla + dlo * dlo) / (2 * s2));
    }
    if (h > 0.78) h = 0.78 + (h - 0.78) * 0.5;
    return h < 0 ? 0 : h > 1 ? 1 : h;
  }

  /* ═══ vectors, arcs ═══ */
  function ll2vec(lat, lon) {
    var p = lat * D2R, l = lon * D2R, c = Math.cos(p);
    return [c * Math.cos(l), c * Math.sin(l), Math.sin(p)];
  }
  function vec2ll(v) { return [Math.asin(clamp(v[2], -1, 1)) / D2R, Math.atan2(v[1], v[0]) / D2R]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function norm(a) { var m = Math.sqrt(dot(a, a)) || 1; return [a[0] / m, a[1] / m, a[2] / m]; }
  function arcPoints(la1, lo1, la2, lo2, n) {
    var a = ll2vec(la1, lo1), b = ll2vec(la2, lo2);
    var om = Math.acos(clamp(dot(a, b), -1, 1)), so = Math.sin(om) || 1e-6, out = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, s1 = Math.sin((1 - t) * om) / so, s2 = Math.sin(t * om) / so;
      var x = a[0] * s1 + b[0] * s2, y = a[1] * s1 + b[1] * s2, z = a[2] * s1 + b[2] * s2;
      out.push([Math.asin(clamp(z, -1, 1)) / D2R, Math.atan2(y, x) / D2R, Math.sin(Math.PI * t) * Math.min(0.07, om * 0.09)]);
    }
    return out;
  }

  /* ═══ land, borders → unit vectors (rotation is 9 multiplies per point, no trig) ═══ */
  var LAND = GEO.land.filter(function (r) {
    for (var i = 0; i < r.length; i++) if (r[i][1] > -58) return true;
    return false;                                      // drop Antarctica
  }).map(function (r) {
    var b = [180, 90, -180, -90], i;
    for (i = 0; i < r.length; i++) {
      if (r[i][0] < b[0]) b[0] = r[i][0]; if (r[i][1] < b[1]) b[1] = r[i][1];
      if (r[i][0] > b[2]) b[2] = r[i][0]; if (r[i][1] > b[3]) b[3] = r[i][1];
    }
    return { pts: r, bb: b };
  });
  function toVecs(rings) {
    var n = 0, i, j;
    for (i = 0; i < rings.length; i++) n += rings[i].length;
    var out = { xyz: new Float32Array(n * 3), start: [], len: [] }, k = 0;
    for (i = 0; i < rings.length; i++) {
      out.start.push(k / 3); out.len.push(rings[i].length);
      for (j = 0; j < rings[i].length; j++) {
        var v = ll2vec(rings[i][j][1], rings[i][j][0]);
        out.xyz[k++] = v[0]; out.xyz[k++] = v[1]; out.xyz[k++] = v[2];
      }
    }
    return out;
  }
  var LANDV = toVecs(LAND.map(function (l) { return l.pts; }));
  var BORDV = toVecs(GEO.borders || []);
  function pip(lon, lat, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function onLand(lat, lon) {
    for (var i = 0; i < LAND.length; i++) {
      var b = LAND[i].bb;
      if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue;
      if (pip(lon, lat, LAND[i].pts)) return true;
    }
    return false;
  }
  function makeLights(n) {
    var rnd = mulberry(7), out = [], guard = 0;
    while (out.length < n && guard++ < n * 25) {
      var lat = rnd() * 120 - 55, lon = rnd() * 360 - 180;
      if (vnoise(lon * 0.32 + 5, lat * 0.32 + 9) < 0.56) continue;
      if (!onLand(lat, lon)) continue;
      out.push([lat, lon, 0.35 + rnd() * 0.5]);
    }
    return out;
  }
  var STARS = (function () {
    var r = mulberry(11), s = [];
    for (var i = 0; i < 120; i++) s.push([r(), r(), 0.15 + r() * 0.5, r() < 0.12 ? 1.6 : 1]);
    return s;
  })();

  /* ═══ CTX-SAT-01 orbit (schematic, not to scale) ═══ */
  var ORB = (function () {
    var P0 = ll2vec(18.52, 61.9);                      // sub-satellite point of the Pune pass
    var east = norm(cross([0, 0, 1], P0)), north = cross(P0, east), b = 120 * D2R;
    var vd = norm([north[0] * Math.cos(b) + east[0] * Math.sin(b), north[1] * Math.cos(b) + east[1] * Math.sin(b), north[2] * Math.cos(b) + east[2] * Math.sin(b)]);
    return { P0: P0, vd: vd, n: norm(cross(P0, vd)), ro: 1.24, om: 0.12, tp: 8.2 };
  })();
  function orbVec(th) {
    var c = Math.cos(th), s = Math.sin(th);
    return [c * ORB.P0[0] + s * ORB.vd[0], c * ORB.P0[1] + s * ORB.vd[1], c * ORB.P0[2] + s * ORB.vd[2]];
  }
  function thAt(tt) { return ORB.om * (tt - ORB.tp); }
  var PUNE_V = ll2vec(PUNE_CITY.lat, PUNE_CITY.lon);

  /* observation markers: type, position, time the footprint reaches them */
  var MARKERS = (function () {
    var out = [], k, types = ['THERMAL SIGNAL', 'VEGETATION SIGNAL', 'WATER SIGNAL', 'LAND COVER', 'PRECIPITATION', 'COASTAL EXPOSURE'];
    var offs = [-0.55, 0.45, -0.15, 0.6, -0.5, 0.2];
    for (k = 0; k < 6; k++) {
      var t0 = 3.05 + k * 0.24, q = orbVec(thAt(t0)), rho = 0.075 * offs[k];
      var v = norm([q[0] * Math.cos(rho) + ORB.n[0] * Math.sin(rho), q[1] * Math.cos(rho) + ORB.n[1] * Math.sin(rho), q[2] * Math.cos(rho) + ORB.n[2] * Math.sin(rho)]);
      var ll = vec2ll(v);
      out.push({ lat: ll[0], lon: ll[1], type: types[k], t0: t0, main: false });
    }
    out.push({ lat: 19.1, lon: 72.9, type: 'COASTAL EXPOSURE', t0: 7.55 });
    out.push({ lat: 17.9, lon: 75.3, type: 'WATER SIGNAL', t0: 7.8 });
    out.push({ lat: 19.5, lon: 74.9, type: 'LAND COVER', t0: 8.0 });
    out.push({ lat: HERO.lat, lon: HERO.lon, type: 'THERMAL ANOMALY', t0: T.detect, main: true });
    return out;
  })();

  /* ═══ synthetic signal generators: slow, coherent drifts, never random jumps ═══ */
  function dataTemp(t) { return 29.8 + 2.0 * smooth(seg(t, 3, 20)) + 0.22 * Math.sin(t * 0.85); }
  function dataPrecip(t) { return 12.0 + 0.9 * smooth(seg(t, 3, 20)) + 0.25 * Math.sin(t * 0.6 + 1); }
  function dataFlux(t) { return 1.66 + 0.09 * smooth(seg(t, 3, 20)) + 0.03 * Math.sin(t * 0.7); }
  function dataSoil(t) { return 0.37 - 0.035 * smooth(seg(t, 3, 20)) + 0.004 * Math.sin(t * 0.9); }
  function dataVeg(t) { return -7.6 - 0.9 * smooth(seg(t, 3, 20)) - 0.1 * Math.sin(t * 0.8); }
  function dataFlood(t) { return 0.57 + 0.05 * smooth(seg(t, 8, 20)) + 0.005 * Math.sin(t); }
  function signalsProcessed(t) { return 12780 + 5.2 * t + 1.2 * (1 - Math.cos(1.3 * t)) + 14 * MARKERS.filter(function (m) { return t > m.t0 + 1.1; }).length; }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function fmtInt(n) { var s = String(Math.floor(n)), o = ''; for (var i = 0; i < s.length; i++) { if (i && (s.length - i) % 3 === 0) o += ','; o += s[i]; } return o; }

  /* ═══ illustrative city + site geometry (metres east/north of the facility) ═══ */
  var CITY_OFF = [(PUNE_CITY.lon - HERO.lon) * DEG_M * Math.cos(HERO.lat * D2R), (PUNE_CITY.lat - HERO.lat) * DEG_M];
  function shift(pts, dx, dy) { return pts.map(function (p) { return [p[0] + dx, p[1] + dy]; }); }
  function blob(cx, cy, r, n, seed, wobble) {
    var rnd = mulberry(seed), p1 = rnd() * TAU, p2 = rnd() * TAU, p3 = rnd() * TAU, out = [];
    for (var i = 0; i < n; i++) {
      var a = i / n * TAU;
      var k = 1 + wobble * (0.5 * Math.sin(a * 2 + p1) + 0.3 * Math.sin(a * 3 + p2) + 0.2 * Math.sin(a * 5 + p3));
      out.push([cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * 0.86]);
    }
    return out;
  }
  function rotRect(cx, cy, w, h, deg) {
    var c = Math.cos(deg * D2R), s = Math.sin(deg * D2R), hw = w / 2, hh = h / 2;
    return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(function (p) { return [cx + p[0] * c - p[1] * s, cy + p[0] * s + p[1] * c]; });
  }
  function rotPt(p, deg) {
    var c = Math.cos(deg * D2R), s = Math.sin(deg * D2R);
    return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
  }
  var SCENE = (function () {
    var cx = CITY_OFF[0], cy = CITY_OFF[1], ang = -8;
    var river = shift([[-16000, -3500], [-11000, -1500], [-7000, 500], [-3500, -500], [0, 800], [3000, 300], [6500, 2200], [11000, 1800], [16000, 3800]], cx, cy);
    var roads = [];
    for (var i = 0; i < 7; i++) {
      var a = i / 7 * TAU + 0.3, r1 = 900, r2 = 12000 + (i % 3) * 1800, bend = (i % 2 ? 1 : -1) * 1400;
      roads.push(shift([[Math.cos(a) * r1, Math.sin(a) * r1],
        [Math.cos(a) * r2 * 0.5 - Math.sin(a) * bend, Math.sin(a) * r2 * 0.5 + Math.cos(a) * bend],
        [Math.cos(a) * r2, Math.sin(a) * r2]], cx, cy));
    }
    roads.push([[0, 0], [cx * 0.35, cy * 0.30], [cx * 0.7, cy * 0.66], [cx, cy]]);
    roads.push([[-4000, 300], [-1500, 260], [0, 0], [2600, -240], [6200, -700]]);
    return {
      river: river,
      nala: [[-1600, -700], [-900, -420], [-350, -270], [150, -200], [700, -270], [1400, -100], [2200, 120]],
      urban: [blob(cx, cy, 7600, 72, 3, 0.42), blob(0, 0, 2700, 56, 5, 0.38)],
      lake: blob(cx - 9400, cy - 6600, 1500, 40, 9, 0.3),
      roads: roads,
      parcel: rotRect(0, 0, 480, 300, ang),
      buildings: [rotRect(-70, 30, 200, 80, ang), rotRect(-150, -68, 110, 50, ang), rotRect(75, -58, 120, 62, ang),
        rotRect(158, 58, 70, 62, ang), rotRect(20, 112, 90, 40, ang), rotRect(-170, 78, 60, 40, ang)],
      internal: [[[-240, 0], [240, 0]].map(function (p) { return rotPt(p, ang); }), [[0, -150], [0, 150]].map(function (p) { return rotPt(p, ang); })]
    };
  })();
  function mToLL(e, n) { return [HERO.lat + n / DEG_M, HERO.lon + e / (DEG_M * Math.cos(HERO.lat * D2R))]; }

  /* ═══ satellite model (local axes: X along-track, Y cross-track, Z zenith) ═══ */
  var SAT_ROT = 0;
  function satModel(simple) {
    var F = [], hx = 0.78, hy = 0.54, hz = 0.66;
    function quad(v, kind, two) { F.push({ v: v, kind: kind, two: !!two }); }
    function box(x0, x1, y0, y1, z0, z1, kinds) {
      kinds = kinds || {};
      var k = function (n, d) { return kinds[n] || d; };
      quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], k('pz', 'metal'));
      quad([[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], k('nz', 'metal'));
      quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], k('px', 'metal'));
      quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], k('nx', 'metal'));
      quad([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], k('py', 'metal'));
      quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], k('ny', 'metal'));
    }
    function tilt(vs, cxp, czp, ang) {
      var c = Math.cos(ang), s = Math.sin(ang);
      return vs.map(function (p) { var dx = p[0] - cxp, dz = p[2] - czp; return [cxp + dx * c + dz * s, p[1], czp - dx * s + dz * c]; });
    }
    /* bus */
    box(-hx, hx, -hy, hy, -hz, hz, { pz: 'deck', px: 'mli', nx: 'mli', nz: 'mli' });
    /* solar wings: booms + two panels each side */
    var ang = -0.32, s, p;
    for (s = -1; s <= 1; s += 2) {
      var y0 = s * (hy + 0.05), y1 = s * (hy + 0.42);
      box(-0.05, 0.05, Math.min(y0, y1), Math.max(y0, y1), 0.06, 0.15, { pz: 'dark', py: 'dark', ny: 'dark' });
      for (p = 0; p < (simple ? 1 : 2); p++) {
        var a0 = s * (hy + 0.46 + p * 1.0), a1 = s * (hy + 0.46 + p * 1.0 + 0.95);
        quad(tilt([[-0.74, a0, 0.11], [0.74, a0, 0.11], [0.74, a1, 0.11], [-0.74, a1, 0.11]], 0, 0.11, ang), 'panel', true);
      }
    }
    if (!simple) {
      /* instrument under the bus, tracker + antenna on the deck */
      box(-0.55, 0.55, -0.3, 0.3, -hz - 0.3, -hz, { nz: 'lens', px: 'dark', nx: 'dark', py: 'gray', ny: 'gray', pz: 'gray' });
      box(-0.52, -0.3, -0.3, -0.08, hz, hz + 0.2, { pz: 'dark' });
      box(0.28, 0.34, 0.37, 0.43, hz, hz + 0.32, { pz: 'gray', px: 'gray', nx: 'gray', py: 'gray', ny: 'gray' });      // mast, off the wordmark line
      var N = norm([0.5, 0, 0.86]), e1 = [0, 1, 0], e2 = cross(N, e1), dish = [], q, cxd = 0.31, czd = hz + 0.4, cyd = 0.4;
      for (q = 0; q < 14; q++) { var ph = q / 14 * TAU; dish.push([cxd + 0.26 * (Math.cos(ph) * e1[0] + Math.sin(ph) * e2[0]), cyd + 0.26 * (Math.cos(ph) * e1[1] + Math.sin(ph) * e2[1]), czd + 0.26 * (Math.cos(ph) * e1[2] + Math.sin(ph) * e2[2])]); }
      quad(dish, 'dish', true);
    }
    return F;
  }
  var SAT_MAT = {                                      // base rgb, specular strength
    metal: [[150, 160, 176], 0.35], deck: [[30, 38, 54], 0.2], mli: [[178, 120, 50], 0.5], panel: [[16, 34, 76], 0.55],
    panelBack: [[112, 120, 134], 0.1], dark: [[24, 28, 36], 0.2], gray: [[118, 126, 140], 0.2], lens: [[10, 12, 18], 0.6], dish: [[176, 184, 196], 0.4]
  };

  /* ═══ factory ═══ */
  CXStory.register('riskmap', function (root) {
    var canvas = root.querySelector('.rim-canvas');
    var wrap = root.querySelector('.rim-stagewrap');
    var ctx = canvas.getContext('2d');
    var stageEl = root.querySelector('[data-rim-stage]');
    var subEl = root.querySelector('[data-rim-sub]');
    var crumbEl = root.querySelector('[data-rim-crumb]');
    var crumbItems = crumbEl.querySelectorAll('li');
    var briefEl = root.querySelector('[data-rim-brief]');
    var chainEl = root.querySelector('[data-rim-chain]');
    var chainItems = chainEl.querySelectorAll('li');
    var chainWrap = root.querySelector('.rim-chainwrap');
    var chainNote = root.querySelector('[data-rim-chain-note]');
    var finalEl = root.querySelector('[data-rim-final]');
    var scenEl = root.querySelector('[data-rim-scen]');
    var scenItems = scenEl ? scenEl.querySelectorAll('li') : [];
    var layerEls = root.querySelectorAll('.rim-layer');
    var progressEl = root.querySelector('.cxs-progress i');
    var panelEl = root.querySelector('[data-rim-ingest]');
    var panelRows = panelEl ? Array.prototype.slice.call(panelEl.querySelectorAll('.rim-ingest-rows li')) : [];
    var pStreams = root.querySelector('[data-i-streams]'), pSignals = root.querySelector('[data-i-signals]'), pLast = root.querySelector('[data-i-last]');
    var pQual = root.querySelector('[data-i-q]'), pConf = root.querySelector('[data-i-c]'), pCov = root.querySelector('[data-i-v]'), pStr = root.querySelector('[data-i-s]');

    var tier = CXStory.tier();
    var cs = getComputedStyle(root);
    function tok(name) { return cs.getPropertyValue(name).trim(); }
    function hex(h) {
      h = h.replace('#', '');
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
    }
    var C = {
      bg: hex(tok('--cxs-bg')), ocean: hex(tok('--cxs-ocean')), land: hex(tok('--cxs-land')), rim: hex(tok('--cxs-rim')),
      blue: hex(tok('--cxs-blue')), deep: hex(tok('--cxs-blue-deep')), amber: hex(tok('--cxs-amber')), red: hex(tok('--cxs-red')),
      text: hex(tok('--cxs-text')), text2: hex(tok('--cxs-text-2')), mute: hex(tok('--cxs-text-mute'))
    };
    var MONO = (tok('--mono') || 'monospace');
    function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a < 0 ? 0 : a > 1 ? 1 : +a.toFixed(3)) + ')'; }
    function mix(a, b, t) { return [Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))]; }

    var CELL = tier === 'desktop' ? 6 : tier === 'tablet' ? 8 : 12;           // hazard-field sample size (css px)
    var ECELL = tier === 'desktop' ? 4 : tier === 'tablet' ? 5 : 8;           // Earth-shader sample size
    var DPR_CAP = tier === 'desktop' ? 2.5 : tier === 'tablet' ? 2 : 1.5;
    var SHOW_TEXT = tier !== 'mobile';
    var FULL_SAT = tier !== 'mobile';
    var SAT_SCALE = tier === 'desktop' ? 0.060 : tier === 'tablet' ? 0.064 : 0.074;
    var LIGHTS = [];                                                          // built shortly after first paint (point-in-polygon sampling)
    setTimeout(function () { LIGHTS = makeLights(tier === 'desktop' ? 620 : tier === 'tablet' ? 400 : 220); if (!playing) draw(t); }, 120);
    var SUN = norm([-0.55, 0.42, 0.72]);                                      // fixed in view space

    var ARCS = ROUTES.map(function (r) {
      var a = r[0] === 's' ? SUP[r[1]] : FAC[r[1]], b = FAC[r[2]];
      return { pts: arcPoints(a.lat, a.lon, b.lat, b.lon, 34), sup: r[0] === 's' };
    });
    var RANKED = FAC.filter(function (f) { return f.rank; }).sort(function (a, b) { return a.rank - b.rank; });
    var SATF = satModel(!FULL_SAT);

    var logo = new Image();
    var logoOk = false;
    if (FULL_SAT) { logo.onload = function () { logoOk = true; if (!playing) draw(t); }; logo.src = 'Climatix_logo.png'; }

    /* ── state ── */
    var W = 0, H = 0, dpr = 1, cx = 0, cy = 0, S = 1, S0 = 1, lat0 = 0, lon0 = 0, sinP0 = 0, cosP0 = 1;
    var R00 = 0, R01 = 1, R02 = 0, R10 = 0, R11 = 0, R12 = 1, R20 = 1, R21 = 0, R22 = 0;
    var t = 0, playing = false, visible = true, raf = 0, last = 0, done = false, ambT = 0, ambTimer = 0;
    var stageIdx = '', layerIdx = -1, crumbIdx = -1, briefOn = false, chainLit = -2, noteOn = false, finalOn = false, scenLit = -1, panelStamp = -1;
    var emph = { layer: 0, focus: null };
    var emphA = EMPH_ALL.slice(), emphBusy = false, curTe = 0, intel = null;
    var streams = [], panelPt = { x: 0, y: 0 };
    var scratch = { x: 0, y: 0, z: 0 }, tmpV = { x: 0, y: 0, z: 0 };
    var zView = 4, zFrom = 4, zTo = 4, zT0 = 0, zMoving = false;
    var texA = 0, texReadyAt = 0, curZ = 0;

    /* ── layout ── */
    function resize() {
      var r = wrap.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W / 2; cy = H * 0.52;
      S0 = Math.min(H * 0.41, W * 0.36);
      layoutStreams();
      if (!playing) draw(t);
    }
    function layoutStreams() {
      ctx.font = '600 9.5px ' + MONO;
      var nl = 0, nr = 0;
      SOURCES.forEach(function (s) { if (s[1] === 'L') nl++; else nr++; });
      var il = 0, ir = 0, wr = wrap.getBoundingClientRect(), pr = panelEl && tier !== 'mobile' ? panelEl.getBoundingClientRect() : null;
      panelPt.x = pr ? pr.left - wr.left : W - 20;
      panelPt.y = pr ? pr.top - wr.top + 46 : 24;
      var rTop = pr ? (pr.bottom - wr.top + 26) / H : 0.3;
      streams = SOURCES.map(function (s, i) {
        var left = s[1] === 'L';
        var idx = left ? il++ : ir++;
        var y = left ? H * (0.2 + 0.6 * idx / Math.max(1, nl - 1)) : H * (Math.max(0.3, rTop) + (0.86 - Math.max(0.3, rTop)) * idx / Math.max(1, nr - 1));
        var tw = SHOW_TEXT ? ctx.measureText(s[0]).width : 0;
        var ax = SHOW_TEXT ? (left ? 18 + tw + 10 : W - 18 - tw - 10) : (left ? 0 : W);
        return { label: s[0], left: left, tx: left ? 18 : W - 18, ty: y, ax: ax, ay: y, nx: s[2], ny: s[3], id: s[4], t0: streamT0(i) };
      });
    }

    /* ── projection ── */
    function setView(la, lo, scale) {
      lat0 = la; lon0 = lo; S = scale;
      var p = la * D2R, l = lo * D2R, sp = Math.sin(p), cp = Math.cos(p), sl = Math.sin(l), cl = Math.cos(l);
      sinP0 = sp; cosP0 = cp;
      R00 = -sl; R01 = cl; R02 = 0;
      R10 = -sp * cl; R11 = -sp * sl; R12 = cp;
      R20 = cp * cl; R21 = cp * sl; R22 = sp;
    }
    function proj(lat, lon, alt, out) {
      var p = lat * D2R, dl = (lon - lon0) * D2R;
      var cp = Math.cos(p), sp = Math.sin(p), cd = Math.cos(dl);
      var k = S * (1 + (alt || 0));
      out.x = cx + k * cp * Math.sin(dl);
      out.y = cy - k * (cosP0 * sp - sinP0 * cp * cd);
      out.z = sinP0 * sp + cosP0 * cp * cd;
    }
    function projVec(v, k, out) {                      // world vector (Earth radii) → screen
      var vx = R00 * v[0] + R01 * v[1], vy = R10 * v[0] + R11 * v[1] + R12 * v[2], vz = R20 * v[0] + R21 * v[1] + R22 * v[2];
      out.x = cx + S * (k || 1) * vx; out.y = cy - S * (k || 1) * vy; out.z = vz;
    }
    function mpx() { return S / EARTH_R; }

    /* ── camera ── */
    function zoomAt(tt) {
      if (tt <= ZOOM_KEYS[0][0]) return 0;
      for (var i = 0; i < ZOOM_KEYS.length - 1; i++) {
        var a = ZOOM_KEYS[i], b = ZOOM_KEYS[i + 1];
        if (tt < b[0]) return a[1] === b[1] ? a[1] : a[1] + easeIO(seg(tt, a[0], b[0])) * (b[1] - a[1]);
      }
      return 4;
    }
    function scaleFor(k) {
      if (k === 0) return S0;
      var w = WP[k];
      return Math.min(0.8 * H / w.hFit, 0.9 * W / w.wFit);
    }
    function applyCamera(tt) {
      var z = done ? zView : zoomAt(tt);
      var rot = easeIO(seg(tt, 0, T.zoom));
      var worldLon = lerp(10, 76, rot) + 1.8 * smooth(seg(curTe, PH.carbon[0], PH.scenario[1])) * (1 - smooth(seg(tt, HOLDS[0].tb, T.zoom))), worldLat = 16;
      var k = Math.min(3, Math.floor(z)), u = z >= 4 ? 1 : z - k;
      var aLat, aLon, aS, bLat, bLon, bS;
      if (k === 0) { aLat = worldLat; aLon = worldLon; aS = S0; }
      else { aLat = WP[k].lat; aLon = WP[k].lon; aS = scaleFor(k); }
      bLat = WP[k + 1].lat; bLon = WP[k + 1].lon; bS = scaleFor(k + 1);
      var up = smooth(seg(u, 0, 0.75));
      var la = lerp(aLat, bLat, up), lo = lerp(aLon, bLon, up);
      var sc = Math.exp(lerp(Math.log(aS), Math.log(bS), u));
      var sh = tier === 'mobile' ? 0 : W * 0.10 * smooth(seg(z, 3.2, 4));
      cx = W / 2 - sh; cy = H * 0.52 - H * 0.04 * smooth(seg(z, 3.2, 4));
      setView(la, lo, sc);
      curZ = z;
      return z;
    }

    /* ═══ EARTH TEXTURE (built once, in small slices, from the real coastlines) ═══ */
    var TW = tier === 'mobile' ? 720 : 1280, TH = TW / 2;
    var EARTH = { ready: false, tex: null, cloud: null, cover: null, field: null };
    var earthTimer = 0, earthAlive = true;

    function boxBlur(src, w, h, r) {                   // separable box blur on a Uint8 plane, wrap in x
      var tmp = new Uint8Array(src.length), out = new Uint8Array(src.length), x, y, k, s, n = 2 * r + 1;
      for (y = 0; y < h; y++) {
        s = 0; for (k = -r; k <= r; k++) s += src[y * w + ((k + w) % w)];
        for (x = 0; x < w; x++) { tmp[y * w + x] = s / n; s += src[y * w + ((x + r + 1) % w)] - src[y * w + ((x - r + w) % w)]; }
      }
      for (x = 0; x < w; x++) {
        s = 0; for (k = -r; k <= r; k++) s += tmp[clamp(k, 0, h - 1) * w + x];
        for (y = 0; y < h; y++) { out[y * w + x] = s / n; s += tmp[clamp(y + r + 1, 0, h - 1) * w + x] - tmp[clamp(y - r, 0, h - 1) * w + x]; }
      }
      return out;
    }
    function buildEarth() {
      earthTimer = setTimeout(buildEarthMask, 250);
    }
    function buildEarthMask() {
      if (!earthAlive) return;
      var mc = document.createElement('canvas'); mc.width = TW; mc.height = TH;
      var mx = mc.getContext('2d');
      mx.fillStyle = '#000'; mx.fillRect(0, 0, TW, TH);
      mx.fillStyle = '#fff'; mx.beginPath();
      LAND.forEach(function (l) {
        var r = l.pts;
        for (var i = 0; i < r.length; i++) {
          var x = (r[i][0] + 180) / 360 * TW, y = (90 - r[i][1]) / 180 * TH;
          if (i === 0) mx.moveTo(x, y); else mx.lineTo(x, y);
        }
        mx.closePath();
      });
      mx.fill();
      var md = mx.getImageData(0, 0, TW, TH).data, mask = new Uint8Array(TW * TH), i;
      for (i = 0; i < mask.length; i++) mask[i] = md[i * 4] > 127 ? 255 : 0;
      var shelf = null;
      var elev = new Float32Array(TW * TH), cloud = new Uint8Array(TW * TH), cover = new Uint8Array(TW * TH), fld = new Uint8Array(TW * TH), DEGPX = 180 / TH;
      var tex = new Uint8ClampedArray(TW * TH * 4);
      var row = 0, stage = 0, CH = tier === 'mobile' ? 16 : 10;

      function passA() {                               // elevation, land cover, clouds
        var y1 = Math.min(TH, row + CH), y, x;
        for (y = row; y < y1; y++) {
          var lat = 90 - (y + 0.5) / TH * 180, cl = Math.cos(lat * D2R), sl = Math.sin(lat * D2R), al = Math.abs(lat);
          for (x = 0; x < TW; x++) {
            var lon = (x + 0.5) / TW * TAU - Math.PI, vx = cl * Math.cos(lon), vy = cl * Math.sin(lon), vz = sl, id = y * TW + x;
            var c = fbm3(vx * 3.0 + 11, vy * 3.0 + 3, vz * 3.0 + 7, 5);
            c += 0.10 * Math.exp(-Math.pow(al / 9, 2)) + 0.07 * Math.exp(-Math.pow((al - 50) / 11, 2));
            var q = (c - 0.52) / 0.24; q = q < 0 ? 0 : q > 1 ? 1 : q;
            cloud[id] = 255 * q * q * (3 - 2 * q);
            fld[id] = 255 * field(lat, lon / D2R, DEGPX);
            if (mask[id]) {
              elev[id] = 0.55 * fbm3(vx * 2.4 + 1.3, vy * 2.4 + 5.1, vz * 2.4 + 9.7, 5) + 0.45 * fbm3(vx * 7 + 4, vy * 7 + 2, vz * 7 + 8, 4);
              var m = fbm3(vx * 1.5 + 7, vy * 1.5 + 1, vz * 1.5 + 3, 2);
              cover[id] = al > 66 ? 4 : (m > 0.6 ? 0 : m > 0.5 ? 1 : m > 0.42 ? 2 : 3);
            }
          }
        }
        row = y1;
        if (row >= TH) { fld = boxBlur(boxBlur(fld, TW, TH, 2), TW, TH, 2); stage = 1; row = 0; }
      }
      function passB() {                               // colours, hillshade
        var y1 = Math.min(TH, row + 40), y, x;
        for (y = row; y < y1; y++) {
          var lat = 90 - (y + 0.5) / TH * 180, al = Math.abs(lat);
          for (x = 0; x < TW; x++) {
            var id = y * TW + x, o = id * 4, r, g, b;
            if (mask[id]) {
              var e = elev[id], iE = y * TW + Math.min(TW - 1, x + 1), iW = y * TW + Math.max(0, x - 1), iS = Math.min(TH - 1, y + 1) * TW + x, iN = Math.max(0, y - 1) * TW + x;
              var ex = mask[iE] ? elev[iE] : e, ew = mask[iW] ? elev[iW] : e, ey = mask[iS] ? elev[iS] : e, en = mask[iN] ? elev[iN] : e;
              var hs = ((ew - ex) * 0.6 + (en - ey) * 0.8) * 90;
              var cv = cover[id], base = 14 + (e - 0.5) * 34 + hs;
              r = base * 0.86 + (cv === 3 ? 5 : 0); g = base * 1.08; b = base * 1.62 + 6;
              if (cv === 4) { var ic = smooth(seg(al, 62, 74)); r = lerp(r, 92, ic); g = lerp(g, 108, ic); b = lerp(b, 128, ic); }
            } else {
              var sh = shelf[id] / 255, d = 5 + 5 * sh;
              r = 3 + sh * 4; g = 8 + sh * 15; b = 19 + d * 2.6 + sh * 20;
            }
            tex[o] = r; tex[o + 1] = g; tex[o + 2] = b; tex[o + 3] = mask[id] ? 255 : 0;
          }
        }
        row = y1;
        if (row >= TH) { EARTH.ready = true; EARTH.tex = tex; EARTH.cloud = cloud; EARTH.cover = cover; EARTH.field = fld; texReadyAt = performance.now(); kick(); return true; }
        return false;
      }
      function step() {
        earthTimer = 0;
        if (!earthAlive) return;
        if (!shelf) shelf = boxBlur(boxBlur(mask, TW, TH, 3), TW, TH, 5);
        else if (stage === 0) passA(); else if (passB()) return;
        earthTimer = setTimeout(step, 0);
      }
      step();
    }

    /* ── Earth shader: one sample per ECELL px, smoothed up; fixed sun → day/night ── */
    var earthCv = document.createElement('canvas'), earthCtx = earthCv.getContext('2d');
    var earthImg = null, EW = 0, EH = 0;
    function drawEarthTex(alpha, tt, fA, gain, th) {
      if (!EARTH.ready || alpha < 0.02) return;
      var big = S > 3 * Math.max(W, H);
      if (big) return;
      var x0 = Math.max(0, Math.floor((cx - S) / ECELL)), x1 = Math.min(Math.ceil(W / ECELL) - 1, Math.ceil((cx + S) / ECELL));
      var y0 = Math.max(0, Math.floor((cy - S) / ECELL)), y1 = Math.min(Math.ceil(H / ECELL) - 1, Math.ceil((cy + S) / ECELL));
      var w = x1 - x0 + 1, h = y1 - y0 + 1;
      if (w < 1 || h < 1) return;
      if (w !== EW || h !== EH || !earthImg) { EW = w; EH = h; earthCv.width = w; earthCv.height = h; earthImg = earthCtx.createImageData(w, h); }
      var data = earthImg.data, tex = EARTH.tex, cloud = EARTH.cloud, cover = EARTH.cover, fld = EARTH.field;
      var obsA = obsAlpha, cshift = tt * 0.0009;                        // clouds drift east relative to the surface
      var sx = SUN[0], sy = SUN[1], sz = SUN[2], lon0r = lon0 * D2R, i, j;
      for (j = 0; j < h; j++) {
        var py = cy - (y0 + j + 0.5) * ECELL;
        for (i = 0; i < w; i++) {
          var px = (x0 + i + 0.5) * ECELL - cx, rx = px / S, ry = py / S, r2 = rx * rx + ry * ry;
          if (r2 > 0.9996) { var k = Math.sqrt(0.9996 / r2); rx *= k; ry *= k; r2 = 0.9996; }
          var nz = Math.sqrt(1 - r2);
          var c = cosP0 * ry + sinP0 * nz, a = -sinP0 * ry + cosP0 * nz;
          var lat = Math.asin(c > 1 ? 1 : c < -1 ? -1 : c), lon = lon0r + Math.atan2(rx, a);
          var u = (lon + Math.PI) / TAU; u -= Math.floor(u);
          var v = 0.5 - lat / Math.PI;
          var xi = (u * TW) | 0, yi = (v * TH) | 0; if (yi >= TH) yi = TH - 1;
          var id = yi * TW + xi, ti = id * 4;
          var ndl = rx * sx + ry * sy + nz * sz;
          var dd = (ndl + 0.08) / 0.5; dd = dd < 0 ? 0 : dd > 1 ? 1 : dd; dd = dd * dd * (3 - 2 * dd);
          var shade = 0.34 + 0.66 * dd;
          var rr = tex[ti], gg = tex[ti + 1], bb = tex[ti + 2];
          if (tex[ti + 3]) {                                               // land
            if (obsA > 0.02) {
              var cv = cover[id];
              rr += obsA * (cv === 0 ? -2 : cv === 3 ? 12 : cv === 4 ? 0 : 3);
              gg += obsA * (cv === 0 ? 24 : cv === 1 ? 16 : cv === 3 ? 6 : 8);
              bb += obsA * (cv === 0 ? 22 : cv === 1 ? 20 : cv === 3 ? 0 : 12);
            }
          } else {                                                         // ocean: faint sun glint
            var rf = 2 * ndl * nz - sz; if (rf > 0) { var gl = Math.pow(rf, 70) * 0.5 * dd; rr += 60 * gl; gg += 84 * gl; bb += 110 * gl; }
          }
          rr *= shade; gg *= shade; bb *= shade;
          var cu = u - cshift; cu -= Math.floor(cu);
          var cd = cloud[yi * TW + ((cu * TW) | 0)] * (0.30 / 255);
          if (cd > 0.004) { var cs2 = 0.36 + 0.64 * dd; rr += (206 * cs2 - rr) * cd; gg += (218 * cs2 - gg) * cd; bb += (236 * cs2 - bb) * cd; }
          var hz = 1 - nz; hz = hz * hz * hz * 0.55;                        // atmospheric haze toward the limb
          rr += (46 * shade - rr) * hz; gg += (92 * shade - gg) * hz; bb += (168 * shade - bb) * hz;
          if (fA > 0.02) {                                                 // layer 01 hazard field, blended after lighting
            var fv = fld[id] / 255;
            if (fv >= th) {
              var fq = (fv - th) / (1 - th), fcol = LUT[Math.min(63, (fq * 63) | 0)];
              var fa = Math.min(0.5, gain * 0.42 * Math.pow(fq, 1.2)) * fA * (tex[ti + 3] ? 1 : 0.42) * (nz < 0.4 ? nz / 0.4 : 1);
              rr += (fcol[0] - rr) * fa; gg += (fcol[1] - gg) * fa; bb += (fcol[2] - bb) * fa;
            }
          }
          var o = (j * w + i) * 4;
          data[o] = rr; data[o + 1] = gg; data[o + 2] = bb; data[o + 3] = 255;
        }
      }
      earthCtx.putImageData(earthImg, 0, 0);
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, S, 0, TAU); ctx.clip();
      ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'low';
      ctx.drawImage(earthCv, 0, 0, w, h, x0 * ECELL, y0 * ECELL, w * ECELL, h * ECELL);
      ctx.restore();
    }

    /* ── hazard field (same screen-sampled surface as before) ── */
    var fieldCv = document.createElement('canvas');
    var fieldCtx = fieldCv.getContext('2d');
    var fieldImg = null, FW = 0, FH = 0;
    var LUT = (function () {
      var out = [];
      for (var i = 0; i < 64; i++) {
        var q = i / 63, c;
        if (q < 0.28) c = C.deep;
        else if (q < 0.52) c = mix(C.deep, C.amber, (q - 0.28) / 0.24);
        else if (q < 0.85) c = C.amber;
        else c = mix(C.amber, C.red, (q - 0.85) / 0.15);
        out.push(c);
      }
      return out;
    })();
    function ensureField() {
      var w = Math.ceil(W / CELL), h = Math.ceil(H / CELL);
      if (w === FW && h === FH && fieldImg) return;
      FW = w; FH = h; fieldCv.width = w; fieldCv.height = h;
      fieldImg = fieldCtx.createImageData(w, h);
    }
    function drawField(alpha, gain, th) {
      if (alpha < 0.02) return;
      ensureField();
      var data = fieldImg.data, degPer = CELL / (S * D2R), TH0 = th || 0.46;
      for (var j = 0; j < FH; j++) {
        for (var i = 0; i < FW; i++) {
          var o = (j * FW + i) * 4;
          var rx = ((i + 0.5) * CELL - cx) / S, ry = (cy - (j + 0.5) * CELL) / S;
          var rho = Math.sqrt(rx * rx + ry * ry);
          if (rho >= 0.99) { data[o + 3] = 0; continue; }
          var c = Math.asin(rho), sc = Math.sin(c), cc = Math.cos(c), lat, lon;
          if (rho < 1e-9) { lat = lat0 * D2R; lon = lon0 * D2R; }
          else {
            lat = Math.asin(clamp(cc * sinP0 + ry * sc * cosP0 / rho, -1, 1));
            lon = lon0 * D2R + Math.atan2(rx * sc, rho * cosP0 * cc - ry * sinP0 * sc);
          }
          var v = field(lat / D2R, lon / D2R, degPer);
          if (v < TH0) { data[o + 3] = 0; continue; }
          var q = (v - TH0) / (1 - TH0), col = LUT[Math.min(63, Math.floor(q * 63))];
          data[o] = col[0]; data[o + 1] = col[1]; data[o + 2] = col[2];
          data[o + 3] = 255 * Math.min(0.5, gain * 0.42 * Math.pow(q, 1.2)) * smooth(seg(cc, 0.08, 0.4));
        }
      }
      fieldCtx.putImageData(fieldImg, 0, 0);
      ctx.globalAlpha = alpha;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(fieldCv, 0, 0, FW, FH, 0, 0, FW * CELL, FH * CELL);
      ctx.globalAlpha = 1;
    }

    /* ── drawing primitives ── */
    function fillRing(pts) {                           // lat/lon ring, hidden vertices clamped to the limb
      var p = scratch;
      ctx.beginPath();
      for (var i = 0; i < pts.length; i++) {
        proj(pts[i][1], pts[i][0], 0, p);
        var x = p.x, y = p.y;
        if (p.z < 0) { var dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy) || 1; x = cx + dx / d * S; y = cy + dy / d * S; }
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill();
    }
    function strokeRing(pts) {
      var p = scratch, pen = false;
      ctx.beginPath();
      for (var i = 0; i < pts.length; i++) {
        proj(pts[i][1], pts[i][0], 0, p);
        if (p.z < 0) { pen = false; continue; }
        if (!pen) { ctx.moveTo(p.x, p.y); pen = true; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    /* Rings are culled against the canvas (with a margin): at country/region zoom most of the
       coastline is thousands of pixels off-screen and only costs the rasteriser time. */
    function ringVisible(V, r) {
      var xyz = V.xyz, base = V.start[r] * 3, len = V.len[r], k, x, y, z, sx, sy, M = 240;
      var minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9, any = false;
      for (k = 0; k < len; k += (len > 40 ? 2 : 1)) {
        x = xyz[base + k * 3]; y = xyz[base + k * 3 + 1]; z = xyz[base + k * 3 + 2];
        if (R20 * x + R21 * y + R22 * z < -0.02) continue;
        sx = cx + S * (R00 * x + R01 * y); sy = cy - S * (R10 * x + R11 * y + R12 * z);
        any = true;
        if (sx < minx) minx = sx; if (sx > maxx) maxx = sx; if (sy < miny) miny = sy; if (sy > maxy) maxy = sy;
      }
      return any && maxx > -M && minx < W + M && maxy > -M && miny < H + M;
    }
    function strokeVecs(V) {                           // one batched path for many rings
      var xyz = V.xyz, n = V.start.length, r, k, pen, base, len, x, y, z, vx, vy, vz, sx, sy, M = 200;
      ctx.beginPath();
      for (r = 0; r < n; r++) {
        if (!ringVisible(V, r)) continue;
        base = V.start[r] * 3; len = V.len[r]; pen = false;
        for (k = 0; k < len; k++) {
          x = xyz[base + k * 3]; y = xyz[base + k * 3 + 1]; z = xyz[base + k * 3 + 2];
          vz = R20 * x + R21 * y + R22 * z;
          if (vz < 0) { pen = false; continue; }
          vx = R00 * x + R01 * y; vy = R10 * x + R11 * y + R12 * z;
          sx = cx + S * vx; sy = cy - S * vy;
          if (sx < -M || sx > W + M || sy < -M || sy > H + M) { pen = false; continue; }
          if (!pen) { ctx.moveTo(sx, sy); pen = true; } else ctx.lineTo(sx, sy);
        }
      }
      ctx.stroke();
    }
    function fillVecs(V) {
      var xyz = V.xyz, n = V.start.length, r, k, base, len, x, y, z, vx, vy, vz, sx, sy;
      ctx.beginPath();
      for (r = 0; r < n; r++) {
        if (!ringVisible(V, r)) continue;
        base = V.start[r] * 3; len = V.len[r];
        for (k = 0; k < len; k++) {
          x = xyz[base + k * 3]; y = xyz[base + k * 3 + 1]; z = xyz[base + k * 3 + 2];
          vx = R00 * x + R01 * y; vy = R10 * x + R11 * y + R12 * z; vz = R20 * x + R21 * y + R22 * z;
          sx = cx + S * vx; sy = cy - S * vy;
          if (vz < 0) { var dx = sx - cx, dy = sy - cy, d = Math.sqrt(dx * dx + dy * dy) || 1; sx = cx + dx / d * S; sy = cy + dy / d * S; }
          if (k === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
      }
      ctx.fill();
    }
    function text(str, x, y, col, a, align, size) {
      if (a < 0.02) return;
      ctx.font = '600 ' + (size || 9.5) + 'px ' + MONO;
      ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = rgba(col, a);
      ctx.fillText(str, x, y);
    }
    function riskColor(r) { return r === 'high' ? C.red : r === 'mod' ? C.amber : C.text2; }
    function nightAt(x, y, z) {                        // 0 = full day … 1 = night, from a projected point
      var ndl = ((x - cx) / S) * SUN[0] + ((cy - y) / S) * SUN[1] + z * SUN[2];
      var d = clamp((ndl + 0.08) / 0.5, 0, 1); return 1 - d * d * (3 - 2 * d);
    }

    /* ── scene layers ── */
    var obsAlpha = 0;
    function drawBackdrop(z) {
      ctx.fillStyle = rgba(C.bg, 1);
      ctx.fillRect(0, 0, W, H);
      var sa = 1 - smooth(seg(z, 0.2, 0.9));
      if (sa > 0.01) {
        var ea = smooth(seg(t, 0, T.earthIn));
        for (var i = 0; i < STARS.length; i++) {
          var s = STARS[i];
          ctx.fillStyle = rgba(C.text, s[2] * sa * ea);
          ctx.fillRect(s[0] * W, s[1] * H, s[3], s[3]);
        }
      }
    }
    function drawGlobeBase(ea, z) {
      if (S > 3 * Math.max(W, H)) { ctx.fillStyle = rgba(C.ocean, 1); ctx.fillRect(0, 0, W, H); return; }
      ctx.globalAlpha = ea;
      ctx.beginPath(); ctx.arc(cx, cy, S, 0, TAU);
      ctx.fillStyle = rgba(C.ocean, 1); ctx.fill();
      ctx.globalAlpha = 1;
    }
    function drawAtmosphere(ea, z) {
      if (S > 3 * Math.max(W, H)) return;
      var atmo = (1 - smooth(seg(z, 0.9, 1.7))) * ea;
      if (atmo < 0.01) return;
      var sxv = SUN[0], syv = SUN[1];
      ctx.save();
      /* outer scattering: even glow + a brighter sun-facing half */
      var g = ctx.createRadialGradient(cx, cy, S * 0.985, cx, cy, S * 1.09);
      g.addColorStop(0, rgba(C.blue, 0)); g.addColorStop(0.16, rgba(C.blue, 0.34 * atmo)); g.addColorStop(1, rgba(C.blue, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, S * 1.09, 0, TAU); ctx.fill();
      ctx.save();
      var dx = sxv, dy = -syv, mm = Math.sqrt(dx * dx + dy * dy) || 1; dx /= mm; dy /= mm;
      var px = -dy, py = dx, RR = S * 2;
      ctx.beginPath(); ctx.moveTo(cx + px * RR, cy + py * RR); ctx.lineTo(cx - px * RR, cy - py * RR);
      ctx.lineTo(cx - px * RR + dx * RR, cy - py * RR + dy * RR); ctx.lineTo(cx + px * RR + dx * RR, cy + py * RR + dy * RR); ctx.closePath(); ctx.clip();
      var g2 = ctx.createRadialGradient(cx, cy, S * 0.99, cx, cy, S * 1.06);
      g2.addColorStop(0, rgba([120, 176, 245], 0)); g2.addColorStop(0.2, rgba([120, 176, 245], 0.24 * atmo)); g2.addColorStop(1, rgba([120, 176, 245], 0));
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(cx, cy, S * 1.06, 0, TAU); ctx.fill();
      ctx.restore();
      /* limb: crisp 1px rim, brighter toward the sun */
      var lg = ctx.createLinearGradient(cx + sxv * S, cy - syv * S, cx - sxv * S, cy + syv * S);
      lg.addColorStop(0, rgba([150, 196, 250], 0.78 * atmo)); lg.addColorStop(0.55, rgba(C.blue, 0.42 * atmo)); lg.addColorStop(1, rgba(C.rim, 0.32 * atmo));
      ctx.strokeStyle = lg; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(cx, cy, S, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    function drawGraticule(a) {
      if (a < 0.02) return;
      var p = scratch, la, lo, pen;
      ctx.strokeStyle = rgba(C.deep, 0.16 * a); ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (la = -60; la <= 60; la += 30) {
        pen = false;
        for (lo = -180; lo <= 180; lo += 4) {
          proj(la, lo, 0, p);
          if (p.z < 0) { pen = false; continue; }
          if (!pen) { ctx.moveTo(p.x, p.y); pen = true; } else ctx.lineTo(p.x, p.y);
        }
      }
      for (lo = -180; lo < 180; lo += 30) {
        pen = false;
        for (la = -84; la <= 84; la += 4) {
          proj(la, lo, 0, p);
          if (p.z < 0) { pen = false; continue; }
          if (!pen) { ctx.moveTo(p.x, p.y); pen = true; } else ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
    }
    function drawLand(a, z, texAlpha) {
      var vecA = a * (1 - smooth(seg(z, 2.0, 2.6)));
      var fillA = vecA * (1 - texAlpha);                                   // flat fill only where the shaded texture isn't drawn
      if (fillA > 0.01) { ctx.globalAlpha = fillA; ctx.fillStyle = rgba(C.land, 1); fillVecs(LANDV); ctx.globalAlpha = 1; }
      if (vecA > 0.01) {
        if (texAlpha > 0.02 && z < 2.0) {                                  // borders, very faint
          ctx.strokeStyle = rgba(C.text2, 0.14 * vecA * texAlpha); ctx.lineWidth = 0.5; strokeVecs(BORDV);
        }
        ctx.strokeStyle = rgba(texAlpha > 0.5 ? [132, 176, 226] : C.rim, (texAlpha > 0.5 ? 0.62 : 0.85) * vecA); ctx.lineWidth = 0.7;
        strokeVecs(LANDV);
      }
      var ia = smooth(seg(z, 0.7, 1.3)) * (1 - smooth(seg(z, 2.0, 2.6)));
      if (ia > 0.01) {
        ctx.strokeStyle = rgba(C.blue, 0.8 * ia); ctx.lineWidth = 1.2; strokeRing(GEO.india);
        ctx.fillStyle = rgba(C.blue, 0.05 * ia); fillRing(GEO.india);
      }
      var ma = smooth(seg(z, 1.7, 2.3));
      if (ma > 0.01) {
        ctx.fillStyle = rgba(C.land, ma); fillRing(GEO.maha);
        ctx.strokeStyle = rgba(C.blue, 0.75 * ma * (1 - smooth(seg(z, 3.0, 3.6)) * 0.8)); ctx.lineWidth = 1.2;
        for (var mb = 0; mb < GEO.mahaBorder.length; mb++) strokeRing(GEO.mahaBorder[mb]);
      }
    }
    function drawLights(a, z) {                        // city lights only where it is night
      var la = a * (1 - smooth(seg(z, 0.5, 1.3)));
      if (la < 0.02) return;
      var p = scratch;
      for (var i = 0; i < LIGHTS.length; i++) {
        proj(LIGHTS[i][0], LIGHTS[i][1], 0, p);
        if (p.z < 0.05) continue;
        var nt = nightAt(p.x, p.y, p.z);
        ctx.fillStyle = rgba(C.amber, LIGHTS[i][2] * la * (0.10 + 0.9 * nt) * 0.8);
        ctx.fillRect(p.x, p.y, 1.3, 1.3);
      }
    }
    function drawHazardLabels(a, z) {
      var la = a * (1 - smooth(seg(z, 0.6, 1.2)));
      if (!SHOW_TEXT || la < 0.02) return;
      var p = scratch;
      for (var i = 0; i < HAZARDS.length; i++) {
        proj(HAZARDS[i][1], HAZARDS[i][2], 0, p);
        if (p.z < 0.25) continue;
        if (tagRect && p.x > tagRect[0] - 70 && p.x < tagRect[2] + 8 && p.y > tagRect[1] - 8 && p.y < tagRect[3] + 8) continue;   // keep clear of the satellite tag
        var ha = la * smooth(seg(t, T.layers[0] + 0.15 * i, T.layers[0] + 0.15 * i + 0.5)) * clamp((p.z - 0.25) / 0.3, 0, 1);
        ctx.strokeStyle = rgba(C.text, 0.6 * ha); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, TAU); ctx.stroke();
        text(HAZARDS[i][0], p.x + 8, p.y, C.text, 0.75 * ha, 'left', 8.5);
      }
    }
    /* layer 02 · Earth observation: thermal anomalies (the land-cover tint lives in the Earth shader) */
    function drawObservationLayer(a, z, tt) {
      if (a < 0.02) return;
      var p = scratch, fade = 1 - smooth(seg(z, 0.7, 1.4));
      if (fade < 0.02) return;
      for (var i = 0; i < THERMAL.length; i++) {
        proj(THERMAL[i][0], THERMAL[i][1], 0, p);
        if (p.z < 0.2) continue;
        var vis = a * fade * clamp((p.z - 0.2) / 0.25, 0, 1) * smooth(seg(tt, T.layers[1] + 0.1 * i, T.layers[1] + 0.1 * i + 0.5));
        var ph = (Math.sin(tt * 1.3 + i * 1.7) + 1) / 2;
        ctx.strokeStyle = rgba(C.amber, (0.55 - 0.3 * ph) * vis); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3 + 3.5 * ph, 0, TAU); ctx.stroke();
        ctx.fillStyle = rgba(C.amber, 0.9 * vis); ctx.beginPath(); ctx.arc(p.x, p.y, 1.4, 0, TAU); ctx.fill();
      }
    }

    /* illustrative city + site geometry */
    function pathM(pts, close) {
      var p = scratch, ll;
      ctx.beginPath();
      for (var i = 0; i < pts.length; i++) {
        ll = mToLL(pts[i][0], pts[i][1]);
        proj(ll[0], ll[1], 0, p);
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      if (close) ctx.closePath();
    }
    function drawLocalGrid(a) {
      if (a < 0.02) return;
      var m = mpx(), target = 110 / m, mag = Math.pow(10, Math.floor(Math.log(target) / Math.LN10));
      var g = target / mag < 2 ? mag : target / mag < 5 ? mag * 2 : mag * 5;
      var gp = g * m, x, y;
      ctx.strokeStyle = rgba(C.text, 0.05 * a); ctx.lineWidth = 1;
      ctx.beginPath();
      for (x = cx - Math.floor(cx / gp) * gp; x < W; x += gp) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, H); }
      for (y = cy - Math.floor(cy / gp) * gp; y < H; y += gp) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(W, Math.round(y) + 0.5); }
      ctx.stroke();
      var label = g >= 1000 ? (g / 1000) + ' km' : g + ' m';
      var by = tier === 'mobile' ? H - 16 : H - 92;
      ctx.strokeStyle = rgba(C.text2, 0.8 * a); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(16, by); ctx.lineTo(16 + gp, by); ctx.moveTo(16, by - 3); ctx.lineTo(16, by + 3); ctx.moveTo(16 + gp, by - 3); ctx.lineTo(16 + gp, by + 3); ctx.stroke();
      text(label, 16 + gp + 8, by, C.text2, 0.85 * a, 'left', 9);
    }
    function drawCity(a, z) {
      if (a < 0.02) return;
      var m = mpx(), i;
      ctx.globalAlpha = a;
      for (i = 0; i < SCENE.urban.length; i++) {
        pathM(SCENE.urban[i], true);
        ctx.fillStyle = rgba(C.text2, 0.045); ctx.fill();
        ctx.strokeStyle = rgba(C.text2, 0.18); ctx.lineWidth = 1; ctx.stroke();
      }
      pathM(SCENE.lake, true); ctx.fillStyle = rgba(C.deep, 0.22); ctx.fill();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      pathM(SCENE.river, false); ctx.strokeStyle = rgba(C.deep, 0.10); ctx.lineWidth = Math.max(3, 1400 * m); ctx.stroke();
      pathM(SCENE.river, false); ctx.strokeStyle = rgba(C.blue, 0.55); ctx.lineWidth = Math.max(1.2, 60 * m); ctx.stroke();
      pathM(SCENE.nala, false); ctx.strokeStyle = rgba(C.deep, 0.14); ctx.lineWidth = Math.max(2, 90 * m); ctx.stroke();
      pathM(SCENE.nala, false); ctx.strokeStyle = rgba(C.blue, 0.6); ctx.lineWidth = Math.max(1, 12 * m); ctx.stroke();
      ctx.strokeStyle = rgba(C.text, 0.10); ctx.lineWidth = Math.max(1, 9 * m);
      for (i = 0; i < SCENE.roads.length; i++) { pathM(SCENE.roads[i], false); ctx.stroke(); }
      ctx.lineCap = 'butt';
      ctx.globalAlpha = 1;
    }
    function drawSite(a) {
      if (a < 0.02) return;
      var m = mpx(), i;
      ctx.globalAlpha = a;
      ctx.strokeStyle = rgba(C.text, 0.12); ctx.lineWidth = Math.max(1, 5 * m);
      for (i = 0; i < SCENE.internal.length; i++) { pathM(SCENE.internal[i], false); ctx.stroke(); }
      for (i = 0; i < SCENE.buildings.length; i++) {
        pathM(SCENE.buildings[i], true);
        ctx.fillStyle = rgba(i < 2 ? C.red : C.amber, i < 2 ? 0.30 : 0.20); ctx.fill();
        ctx.strokeStyle = rgba(C.text, 0.42); ctx.lineWidth = 1; ctx.stroke();
      }
      pathM(SCENE.parcel, true);
      ctx.strokeStyle = rgba(C.blue, 0.95); ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
      var p = scratch, ll = mToLL(-250, 205);
      proj(ll[0], ll[1], 0, p);
      if (SHOW_TEXT) {
        text('ABC INDUSTRIES · PUNE FACILITY', p.x, p.y - 4, C.text, 0.95, 'left', 10);
        text('FICTIONAL SITE · SYNTHETIC', p.x, p.y + 10, C.text2, 0.8, 'left', 8);
      }
      ctx.globalAlpha = 1;
    }

    /* facility signal callouts (synthetic) at the zoomed-in scene */
    function drawCallouts(a, dt) {
      if (a < 0.02 || !SHOW_TEXT) return;
      var rows = [
        ['TEMP', dataTemp(dt).toFixed(1) + '°C'], ['SOIL MOISTURE', dataSoil(dt).toFixed(2)],
        ['VEG SIGNAL', dataVeg(dt).toFixed(1).replace('-', '−') + '%'], ['FLOOD PROB', dataFlood(dt).toFixed(2)], ['HEAT SIGNAL', 'HIGH']
      ];
      var x = 16, y0 = 122, i, ll = mToLL(-240, 20), p = scratch;
      proj(ll[0], ll[1], 0, p);
      text('OBSERVED · SYNTHETIC', x, y0 - 14, C.mute, 0.9 * a, 'left', 8);
      for (i = 0; i < rows.length; i++) {
        var yy = y0 + i * 15, ra = a * smooth(seg(t, T.brief + 0.15 * i, T.brief + 0.15 * i + 0.4));
        ctx.fillStyle = rgba(i === 4 ? C.amber : C.blue, ra); ctx.fillRect(x, yy - 2, 3, 3);
        text(rows[i][0], x + 9, yy, C.text2, 0.9 * ra, 'left', 8.5);
        text(rows[i][1], x + 108, yy, i === 4 ? C.amber : C.text, ra, 'left', 8.5);
      }
      ctx.strokeStyle = rgba(C.blue, 0.28 * a); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 150, y0 + 30); ctx.lineTo(p.x, p.y); ctx.stroke();
    }

    /* layers 03–06: exposure, risk, materiality, decision */
    function drawNetwork(tt, z, A) {
      var p = scratch, q = { x: 0, y: 0, z: 0 }, i, j, f;
      var rr = [], k;
      for (k = 0; k < NLAY; k++) rr[k] = smooth(seg(tt, T.layers[k], T.layers[k] + T.layerDur));
      var a3 = rr[2] * A[3], a4 = rr[3] * A[4], a5 = rr[4] * A[5], a6 = rr[5] * A[6];
      var supplyFocus = emph.focus === 'supply';
      var netFade = 1 - smooth(seg(z, 1.3, 2.0));
      var nodeFade = 1 - smooth(seg(z, 3.3, 3.8));
      var lbl = smooth(seg(z, 0.9, 1.6)) * (1 - smooth(seg(z, 2.5, 3.1)));

      if (a3 > 0.02 && netFade > 0.02) {
        /* cities */
        for (i = 0; i < CITIES.length; i++) {
          proj(CITIES[i][0], CITIES[i][1], 0, p);
          if (p.z < 0.12) continue;
          ctx.fillStyle = rgba(C.text, 0.55 * a3 * netFade * clamp((p.z - 0.12) / 0.2, 0, 1));
          ctx.fillRect(p.x - 0.9, p.y - 0.9, 1.8, 1.8);
        }
        /* transport routes + suppliers */
        ctx.lineWidth = supplyFocus ? 1.3 : 1;
        for (i = 0; i < ARCS.length; i++) {
          var pts = ARCS[i].pts, pen = false;
          var grow = smooth(seg(tt, T.layers[2] + i * 0.03, T.layers[2] + 0.9 + i * 0.03));
          var upto = Math.floor(grow * (pts.length - 1));
          ctx.strokeStyle = rgba(ARCS[i].sup ? C.text2 : C.text, (supplyFocus ? 0.6 : 0.2) * a3 * netFade);
          ctx.beginPath();
          for (j = 0; j <= upto; j++) {
            proj(pts[j][0], pts[j][1], pts[j][2], p);
            if (p.z < 0.02) { pen = false; continue; }
            if (!pen) { ctx.moveTo(p.x, p.y); pen = true; } else ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
        }
        for (i = 0; i < SUP.length; i++) {
          proj(SUP[i].lat, SUP[i].lon, 0, p);
          if (p.z < 0.05) continue;
          var sa = a3 * netFade * clamp((p.z - 0.05) / 0.2, 0, 1);
          ctx.strokeStyle = rgba(C.text2, (supplyFocus ? 1 : 0.7) * sa); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(p.x, p.y, supplyFocus ? 3.4 : 2.4, 0, TAU); ctx.stroke();
          if (supplyFocus && SHOW_TEXT) text(SUP[i].n.toUpperCase(), p.x + 7, p.y, C.text2, 0.85 * sa, 'left', 8);
        }
      }

      for (i = 0; i < FAC.length; i++) {
        f = FAC[i];
        if (f.hero && nodeFade < 0.02) continue;
        proj(f.lat, f.lon, 0, p);
        if (p.z < 0.05 || p.x < -30 || p.x > W + 30 || p.y < -30 || p.y > H + 30) continue;
        var vis = clamp((p.z - 0.05) / 0.2, 0, 1) * (f.hero ? nodeFade : 1);
        var col = riskColor(f.risk);
        if (a5 > 0.02) {                                                   // 05 · financial materiality
          var rad = (5 + f.fin * 15) * (0.4 + 0.6 * a5) * (emph.layer === 5 ? 1.25 : 1);
          ctx.setLineDash([2, 3]);
          ctx.strokeStyle = rgba(C.amber, 0.75 * a5 * vis); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = rgba(C.amber, 0.08 * a5 * vis); ctx.fill();
        }
        if (a4 > 0.02 && f.risk !== 'low') {                               // 04 · risk
          ctx.strokeStyle = rgba(col, 0.55 * a4 * vis); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(p.x, p.y, 8.5, 0, TAU); ctx.stroke();
        }
        if (a3 > 0.02 || a4 > 0.02) {                                      // 03 · exposure (risk-filled once 04 lands)
          var ma = Math.max(a3, a4) * vis;
          ctx.strokeStyle = rgba(C.text, 0.9 * ma); ctx.lineWidth = 1;
          ctx.fillStyle = rgba(col, 0.95 * a4 * vis);
          ctx.beginPath(); ctx.rect(p.x - 3, p.y - 3, 6, 6);
          if (a4 > 0.02) ctx.fill();
          ctx.stroke();
        }
        if (SHOW_TEXT && lbl > 0.02 && a3 > 0.3) text(f.n.toUpperCase(), p.x + 10, p.y - 9, C.text, 0.85 * lbl * vis, 'left', 8.5);
        if (f.hero && SHOW_TEXT) {
          var ha = smooth(seg(z, 2.4, 2.9)) * (1 - smooth(seg(z, 3.4, 3.8)));
          text('ABC INDUSTRIES · PUNE FACILITY', p.x + 14, p.y - 12, C.text, 0.9 * ha, 'left', 9);
        }
      }

      if (a6 > 0.02) {                                                     // 06 · decision intelligence
        var pf = 1 - smooth(seg(z, 2.4, 3.0));
        for (i = 0; i < RANKED.length; i++) {
          f = RANKED[i];
          proj(f.lat, f.lon, 0, q);
          if (q.z < 0.15 || pf < 0.02) continue;
          var ba = a6 * pf * clamp((q.z - 0.15) / 0.25, 0, 1) * smooth(seg(tt, T.layers[5] + i * 0.12, T.layers[5] + i * 0.12 + 0.4));
          var bx = q.x + 20, by = q.y - 22;
          ctx.strokeStyle = rgba(C.blue, 0.8 * ba); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(q.x + 4, q.y - 4); ctx.lineTo(bx - 6, by + 5); ctx.stroke();
          ctx.fillStyle = rgba(C.bg, 0.95 * ba); ctx.beginPath(); ctx.arc(bx, by, 8, 0, TAU); ctx.fill();
          ctx.strokeStyle = rgba(C.blue, ba); ctx.stroke();
          text(String(f.rank), bx, by + 0.5, C.text, ba, 'center', 9.5);
          if (SHOW_TEXT && A[6] > 0.6) text(f.rank === 1 ? 'PRIORITY 1 · ACTION SIGNAL' : 'PRIORITY ' + f.rank, bx + 14, by, C.blue, 0.95 * ba, 'left', 8.5);
        }
      }
    }

    /* ── data streams into Climactix: names + live synthetic values ── */
    function streamValue(id, dt, satLL) {
      switch (id) {
        case 'sat': return satLL;
        case 'temp': return 'TEMP ' + dataTemp(dt).toFixed(1) + '°C';
        case 'precip': return 'PRECIP ' + dataPrecip(dt).toFixed(1) + ' mm';
        case 'flux': return 'CARBON FLUX +' + dataFlux(dt).toFixed(2) + ' MtCO₂e';
        case 'soil': return 'SOIL MOISTURE ' + dataSoil(dt).toFixed(2);
        case 'corp': return '14 SITES · 6 COUNTRIES';
        case 'supply': return '212 TIER-1 NODES';
        case 'reg': return '6 FRAMEWORKS MAPPED';
        default: return '14 ASSETS LINKED';
      }
    }
    function satLatLon(tt) {
      var s = spot(tt);
      var ll = s.target ? [PUNE_CITY.lat, PUNE_CITY.lon] : vec2ll(norm(orbVec(thAt(tt))));
      var la = s.target ? ll[0].toFixed(4) : ll[0].toFixed(2), lo = s.target ? ll[1].toFixed(4) : ll[1].toFixed(2);
      return 'LAT ' + Math.abs(+la) + (ll[0] >= 0 ? ' N' : ' S') + ' · LON ' + Math.abs(+lo) + (ll[1] >= 0 ? ' E' : ' W');
    }
    function drawStreams(tt, z, dt) {
      var fade = tt < T.layers[0] ? 1 : lerp(1, 0.3, smooth(seg(tt, T.layers[0], T.layers[0] + 1.6)));
      fade *= 1 - smooth(seg(tt, T.zoom - 0.3, T.zoom + 0.6));
      if (fade < 0.02) return;
      var satLL = SHOW_TEXT ? satLatLon(tt) : '';
      for (var i = 0; i < streams.length; i++) {
        var s = streams[i];
        var lx = cx + S * s.nx, ly = cy - S * s.ny;
        var cxp = lerp(s.ax, lx, 0.58), cyp = s.ay;
        var grow = easeOut(seg(tt, s.t0, s.t0 + 0.75));
        var la = smooth(seg(tt, s.t0 - 0.05, s.t0 + 0.25)) * fade;
        if (la < 0.02) continue;
        if (SHOW_TEXT) {
          ctx.fillStyle = rgba(C.blue, la); ctx.fillRect(s.left ? s.tx - 10 : s.tx + 5, s.ty - 7, 4, 4);
          text(s.label, s.tx, s.ty - 5, C.text, 0.88 * la, s.left ? 'left' : 'right', 9.5);
          text(streamValue(s.id, dt, satLL), s.tx, s.ty + 7, C.text2, 0.78 * la * smooth(seg(tt, s.t0 + 0.4, s.t0 + 0.9)), s.left ? 'left' : 'right', 8);
        }
        ctx.strokeStyle = rgba(C.blue, 0.5 * la); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(s.ax, s.ay);
        var n = Math.max(2, Math.round(24 * grow));
        for (var k = 1; k <= n; k++) {
          var u = grow * k / n, iu = 1 - u;
          ctx.lineTo(iu * iu * s.ax + 2 * iu * u * cxp + u * u * lx, iu * iu * s.ay + 2 * iu * u * cyp + u * u * ly);
        }
        ctx.stroke();
        if (grow < 1) continue;
        var since = tt - s.t0 - 0.75;
        for (var d = 0; d < 2; d++) {
          var pu = (since * 0.5 + d * 0.5) % 1, ipu = 1 - pu;
          var px = ipu * ipu * s.ax + 2 * ipu * pu * cxp + pu * pu * lx;
          var py = ipu * ipu * s.ay + 2 * ipu * pu * cyp + pu * pu * ly;
          ctx.fillStyle = rgba(C.text, 0.9 * la * Math.sin(pu * Math.PI));
          ctx.beginPath(); ctx.arc(px, py, 1.7, 0, TAU); ctx.fill();
        }
        var rf = (since % 1.8) / 1.8;
        ctx.strokeStyle = rgba(C.blue, (1 - rf) * 0.45 * la); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(lx, ly, 3 + 15 * rf, 0, TAU); ctx.stroke();
        ctx.fillStyle = rgba(C.text, 0.85 * la); ctx.beginPath(); ctx.arc(lx, ly, 1.8, 0, TAU); ctx.fill();
      }
    }

    /* ═══ CTX-SAT-01: orbit, scan, observations, downlink ═══ */
    function spot(tt) {                                // what the sensor is doing at tt
      var s1 = smooth(seg(tt, T.scan1[0], T.scan1[0] + 0.35)) * (1 - smooth(seg(tt, T.scan1[1] - 0.35, T.scan1[1])));
      var s2 = smooth(seg(tt, T.scan2[0], T.scan2[0] + 0.35)) * (1 - smooth(seg(tt, T.scan2[1] - 0.35, T.scan2[1])));
      return { a: Math.max(s1, s2), target: s2 > 0.01, swath: s1 > 0.01 };
    }
    function satAlpha(tt, z) {
      return smooth(seg(tt, 1.0, 2.2)) * (1 - smooth(seg(tt, 10.2, 11.4))) * (1 - smooth(seg(z, 0.15, 0.9)));
    }
    function drawOrbitRing(front, a) {
      if (a < 0.02) return;
      var N = 160, p = scratch, pen = false, i, v, th;
      ctx.setLineDash(front ? [4, 4] : [2, 5]);
      ctx.strokeStyle = rgba(C.blue, (front ? 0.30 : 0.13) * a); ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (i = 0; i <= N; i++) {
        th = i / N * TAU; v = orbVec(th);
        v = [v[0] * ORB.ro, v[1] * ORB.ro, v[2] * ORB.ro];
        projVec(v, 1, p);
        if ((p.z >= 0) !== front) { pen = false; continue; }
        if (!pen) { ctx.moveTo(p.x, p.y); pen = true; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
    function groundTrack(tt, a) {                      // sub-satellite track on the surface
      if (a < 0.02) return;
      var th = thAt(tt), p = scratch, pen = false, i, v;
      ctx.setLineDash([1.5, 3]); ctx.strokeStyle = rgba(C.blue, 0.5 * a); ctx.lineWidth = 1;
      ctx.beginPath();
      for (i = 0; i <= 30; i++) {
        v = orbVec(th - 0.55 + 0.55 * i / 30);
        projVec(v, 1, p);
        if (p.z < 0.03) { pen = false; continue; }
        if (!pen) { ctx.moveTo(p.x, p.y); pen = true; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
    function drawSwath(tt, a) {                        // area imaged during scan 1
      var th0 = thAt(T.scan1[0]), th1 = Math.min(thAt(tt), thAt(T.scan1[1]));
      if (th1 <= th0 || a < 0.02) return;
      var rho = 0.075, N = 26, L = [], R = [], p = scratch, ok = true, i;
      for (i = 0; i <= N; i++) {
        var q = norm(orbVec(lerp(th0, th1, i / N)));
        var l = norm([q[0] * Math.cos(rho) + ORB.n[0] * Math.sin(rho), q[1] * Math.cos(rho) + ORB.n[1] * Math.sin(rho), q[2] * Math.cos(rho) + ORB.n[2] * Math.sin(rho)]);
        var r = norm([q[0] * Math.cos(rho) - ORB.n[0] * Math.sin(rho), q[1] * Math.cos(rho) - ORB.n[1] * Math.sin(rho), q[2] * Math.cos(rho) - ORB.n[2] * Math.sin(rho)]);
        projVec(l, 1, p); if (p.z < 0.05) ok = false; L.push([p.x, p.y]);
        projVec(r, 1, p); if (p.z < 0.05) ok = false; R.push([p.x, p.y]);
      }
      if (!ok) return;
      ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
      for (i = 1; i <= N; i++) ctx.lineTo(L[i][0], L[i][1]);
      for (i = N; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
      ctx.closePath(); ctx.fillStyle = rgba(C.blue, 0.07 * a); ctx.fill();
      ctx.strokeStyle = rgba(C.blue, 0.34 * a); ctx.lineWidth = 0.8; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]); for (i = 1; i <= N; i++) ctx.lineTo(L[i][0], L[i][1]);
      ctx.moveTo(R[0][0], R[0][1]); for (i = 1; i <= N; i++) ctx.lineTo(R[i][0], R[i][1]);
      ctx.stroke(); ctx.setLineDash([]);
    }
    function ringAround(f, rho, n) {                   // small circle of angular radius rho about unit vector f
      var a1 = norm(cross(f, Math.abs(f[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1])), a2 = cross(f, a1), out = [];
      for (var i = 0; i < n; i++) {
        var ph = i / n * TAU, c = Math.cos(ph), s = Math.sin(ph), cr = Math.cos(rho), sr = Math.sin(rho);
        out.push([f[0] * cr + (a1[0] * c + a2[0] * s) * sr, f[1] * cr + (a1[1] * c + a2[1] * s) * sr, f[2] * cr + (a1[2] * c + a2[2] * s) * sr]);
      }
      return out;
    }
    var satScr = { x: 0, y: 0, z: 0, ok: false }, tagRect = null;
    function drawScan(tt, sp, satA) {
      if (sp.a < 0.02 || satA < 0.02 || !satScr.ok) return;
      var f, rho, hot = false;
      if (sp.target) {
        f = PUNE_V; rho = lerp(0.09, 0.038, smooth(seg(tt, T.scan2[0], T.detect))); hot = tt >= T.detect;
      } else { f = norm(orbVec(thAt(tt))); rho = 0.075; }
      var pts = ringAround(f, rho, 36), P = [], i, p = scratch, col = hot ? C.amber : C.blue;
      for (i = 0; i < pts.length; i++) { projVec(pts[i], 1, p); if (p.z > 0.02) P.push([p.x, p.y, Math.atan2(p.y - satScr.y, p.x - satScr.x)]); }
      if (P.length < 6) return;
      P.sort(function (a, b) { return a[2] - b[2]; });
      var A = sp.a * satA;
      ctx.beginPath(); ctx.moveTo(satScr.x, satScr.y);
      for (i = 0; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]);
      ctx.closePath(); ctx.fillStyle = rgba(col, 0.055 * A); ctx.fill();
      ctx.strokeStyle = rgba(col, 0.42 * A); ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(satScr.x, satScr.y); ctx.lineTo(P[0][0], P[0][1]); ctx.moveTo(satScr.x, satScr.y); ctx.lineTo(P[P.length - 1][0], P[P.length - 1][1]); ctx.stroke();
      /* footprint outline + a scan line sweeping across it */
      ctx.strokeStyle = rgba(col, 0.7 * A); ctx.lineWidth = 1; ctx.beginPath();
      var first = true, sortedRing = [];
      for (i = 0; i < pts.length; i++) { projVec(pts[i], 1, p); if (p.z > 0.02) { if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y); } }
      ctx.closePath(); ctx.stroke();
      var sw = (tt * 0.9) % 1, ss = sw * 2 - 1, kk = rho * Math.sqrt(Math.max(0, 1 - ss * ss));
      var dvec = norm(cross(f, ORB.n)), bpt = norm([f[0] * Math.cos(rho * ss) + dvec[0] * Math.sin(rho * ss), f[1] * Math.cos(rho * ss) + dvec[1] * Math.sin(rho * ss), f[2] * Math.cos(rho * ss) + dvec[2] * Math.sin(rho * ss)]);
      var e1 = norm(cross(bpt, dvec)), ea = norm([bpt[0] * Math.cos(kk) + e1[0] * Math.sin(kk), bpt[1] * Math.cos(kk) + e1[1] * Math.sin(kk), bpt[2] * Math.cos(kk) + e1[2] * Math.sin(kk)]);
      var eb = norm([bpt[0] * Math.cos(kk) - e1[0] * Math.sin(kk), bpt[1] * Math.cos(kk) - e1[1] * Math.sin(kk), bpt[2] * Math.cos(kk) - e1[2] * Math.sin(kk)]);
      projVec(ea, 1, p); var ax = p.x, ay = p.y, az = p.z; projVec(eb, 1, p);
      if (az > 0.02 && p.z > 0.02) { ctx.strokeStyle = rgba(col, 0.75 * A); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(p.x, p.y); ctx.stroke(); }
      /* brackets locking onto the target during the spotlight pass */
      if (sp.target) {
        projVec(f, 1, p);
        var b = 9 + 10 * (1 - smooth(seg(tt, T.scan2[0], T.detect)));
        ctx.strokeStyle = rgba(col, 0.9 * A); ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(p.x - b, p.y - b + 4); ctx.lineTo(p.x - b, p.y - b); ctx.lineTo(p.x - b + 4, p.y - b);
        ctx.moveTo(p.x + b, p.y - b + 4); ctx.lineTo(p.x + b, p.y - b); ctx.lineTo(p.x + b - 4, p.y - b);
        ctx.moveTo(p.x - b, p.y + b - 4); ctx.lineTo(p.x - b, p.y + b); ctx.lineTo(p.x - b + 4, p.y + b);
        ctx.moveTo(p.x + b, p.y + b - 4); ctx.lineTo(p.x + b, p.y + b); ctx.lineTo(p.x + b - 4, p.y + b);
        ctx.stroke();
      }
    }
    /* observation markers on the surface + the signals they emit toward the platform */
    function drawMarkers(tt, z) {
      var p = scratch, fade = 1 - smooth(seg(z, 0.9, 1.6)), i;
      if (fade < 0.02) return;
      for (i = 0; i < MARKERS.length; i++) {
        var m = MARKERS[i], age = tt - m.t0;
        if (age < 0) continue;
        proj(m.lat, m.lon, 0, p);
        if (p.z < 0.1) continue;
        var vis = fade * clamp((p.z - 0.1) / 0.2, 0, 1), rest = m.main ? 0.9 : 0.42;
        var a = vis * (rest + (1 - rest) * (1 - smooth(seg(age, 0.3, 2.4))));
        var col = m.main || m.type.indexOf('THERMAL') === 0 ? C.amber : C.blue;
        var pr = clamp(age / 0.9, 0, 1);
        if (pr < 1) { ctx.strokeStyle = rgba(col, (1 - pr) * 0.7 * vis); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, 2 + 11 * easeOut(pr), 0, TAU); ctx.stroke(); }
        ctx.strokeStyle = rgba(col, a); ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(p.x - 3.5, p.y); ctx.lineTo(p.x + 3.5, p.y); ctx.moveTo(p.x, p.y - 3.5); ctx.lineTo(p.x, p.y + 3.5); ctx.stroke();
        if (SHOW_TEXT && age < 2.0 && !m.main && m.t0 < 6) text(m.type, p.x + 8, p.y - 7, C.text, 0.85 * vis * (1 - smooth(seg(age, 1.3, 2.0))) * smooth(seg(age, 0.05, 0.3)), 'left', 8);
        /* signal packet toward the ingestion panel */
        var pk = (age - 0.25) / 1.05;
        if (pk > 0 && pk < 1 && panelPt.x > 0) {
          var mx = (p.x + panelPt.x) / 2, my = Math.min(p.y, panelPt.y) - 46, u = easeIO(pk), iu = 1 - u;
          for (var d = 3; d >= 0; d--) {
            var uu = clamp(u - d * 0.035, 0, 1), iuu = 1 - uu;
            var qx = iuu * iuu * p.x + 2 * iuu * uu * mx + uu * uu * panelPt.x, qy = iuu * iuu * p.y + 2 * iuu * uu * my + uu * uu * panelPt.y;
            ctx.fillStyle = rgba(col, (d === 0 ? 0.95 : 0.3 - d * 0.06) * Math.sin(pk * Math.PI) * vis);
            ctx.beginPath(); ctx.arc(qx, qy, d === 0 ? 1.8 : 1.3, 0, TAU); ctx.fill();
          }
        }
      }
    }
    /* thermal-anomaly callout at the detection moment */
    function drawDetection(tt, z) {
      var age = tt - T.detect;
      if (age < 0) return;
      var a = smooth(seg(age, 0, 0.35)) * (1 - smooth(seg(z, 0.7, 1.5))) ;
      if (a < 0.02) return;
      var p = scratch;
      proj(HERO.lat, HERO.lon, 0, p);
      if (p.z < 0.1) return;
      var pr = (age % 1.6) / 1.6;
      ctx.strokeStyle = rgba(C.amber, (1 - pr) * 0.8 * a); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, 4 + 20 * easeOut(pr), 0, TAU); ctx.stroke();
      ctx.fillStyle = rgba(C.amber, 0.95 * a); ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, TAU); ctx.fill();
      if (SHOW_TEXT) {
        var bx = p.x + 30, by = p.y + 40;
        ctx.strokeStyle = rgba(C.amber, 0.7 * a); ctx.beginPath(); ctx.moveTo(p.x + 3, p.y + 3); ctx.lineTo(bx - 4, by - 4); ctx.lineTo(bx + 4, by - 4); ctx.stroke();
        text('THERMAL ANOMALY DETECTED', bx + 8, by - 4, C.amber, a, 'left', 9);
        text('18.5204 N · 73.8567 E · SIGNAL HIGH', bx + 8, by + 8, C.text2, 0.9 * a, 'left', 8);
      } else {
        text('THERMAL ANOMALY', p.x - 40, p.y + 22, C.amber, a, 'left', 8);
      }
    }
    /* downlink: satellite → ingestion panel, encrypted, packets in flight */
    function drawDownlink(tt, satA) {
      var w = Math.max(smooth(seg(tt, 3.0, 3.4)) * (1 - smooth(seg(tt, 5.0, 5.6))), smooth(seg(tt, 7.5, 7.9)) * (1 - smooth(seg(tt, 9.4, 10.0))));
      if (w < 0.02 || satA < 0.02 || !satScr.ok || panelPt.x <= 0) return;
      var A = w * satA, sx = satScr.x, sy = satScr.y, ex = panelPt.x, ey = panelPt.y, mx = (sx + ex) / 2, my = Math.min(sy, ey) - 30, i;
      ctx.strokeStyle = rgba(C.blue, 0.34 * A); ctx.lineWidth = 0.8; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke(); ctx.setLineDash([]);
      for (i = 0; i < 3; i++) {
        var u = ((tt * 0.9) + i / 3) % 1, iu = 1 - u;
        var qx = iu * iu * sx + 2 * iu * u * mx + u * u * ex, qy = iu * iu * sy + 2 * iu * u * my + u * u * ey;
        ctx.fillStyle = rgba(C.text, 0.9 * A * Math.sin(u * Math.PI)); ctx.beginPath(); ctx.arc(qx, qy, 1.8, 0, TAU); ctx.fill();
      }
      if (SHOW_TEXT) text('DOWNLINK · ENCRYPTED', (sx + ex) / 2 - 20, my - 4, C.text2, 0.7 * A, 'left', 7.5);
    }
    /* the satellite itself: painter-sorted faces, lambert + specular, decal from the Climactix logo */
    function drawSatellite(tt, z, satA, sp) {
      if (satA < 0.02) return;
      var th = thAt(tt), c = Math.cos(th), s = Math.sin(th);
      var up = [c * ORB.P0[0] + s * ORB.vd[0], c * ORB.P0[1] + s * ORB.vd[1], c * ORB.P0[2] + s * ORB.vd[2]];
      var vel = [-s * ORB.P0[0] + c * ORB.vd[0], -s * ORB.P0[1] + c * ORB.vd[1], -s * ORB.P0[2] + c * ORB.vd[2]];
      var side = norm(cross(up, vel));                                         // cross-track
      var pos = [up[0] * ORB.ro, up[1] * ORB.ro, up[2] * ORB.ro];
      projVec(pos, 1, tmpV);
      satScr.x = tmpV.x; satScr.y = tmpV.y; satScr.z = tmpV.z; satScr.ok = true;
      var sc = SAT_SCALE, faces = [], i, j, q, v, k;
      var bx = vel, by = side, bz = up;
      for (i = 0; i < SATF.length; i++) {
        var F = SATF[i], V = [], zsum = 0;
        for (j = 0; j < F.v.length; j++) {
          q = F.v[j];
          var wx = pos[0] + sc * (q[0] * bx[0] + q[1] * by[0] + q[2] * bz[0]);
          var wy = pos[1] + sc * (q[0] * bx[1] + q[1] * by[1] + q[2] * bz[1]);
          var wz = pos[2] + sc * (q[0] * bx[2] + q[1] * by[2] + q[2] * bz[2]);
          var vx = R00 * wx + R01 * wy, vy = R10 * wx + R11 * wy + R12 * wz, vz = R20 * wx + R21 * wy + R22 * wz;
          V.push([vx, vy, vz]); zsum += vz;
        }
        var e1 = [V[1][0] - V[0][0], V[1][1] - V[0][1], V[1][2] - V[0][2]], e2 = [V[2][0] - V[0][0], V[2][1] - V[0][1], V[2][2] - V[0][2]];
        var nv = norm(cross(e1, e2)), facing = nv[2] > 0;
        if (!facing && !F.two) continue;
        if (!facing) nv = [-nv[0], -nv[1], -nv[2]];
        faces.push({ F: F, V: V, n: nv, back: !facing, z: zsum / V.length });
      }
      faces.sort(function (a, b) { return a.z - b.z; });
      ctx.save();
      ctx.globalAlpha = satA;
      ctx.lineJoin = 'round';
      for (i = 0; i < faces.length; i++) {
        var fc = faces[i], kind = fc.F.kind === 'panel' && fc.back ? 'panelBack' : fc.F.kind, mat = SAT_MAT[kind];
        var ndl = Math.max(0, dot(fc.n, SUN)), sh = 0.32 + 0.68 * ndl, sp2 = Math.pow(ndl, 6) * mat[1] * 70;
        var col = 'rgb(' + Math.min(255, mat[0][0] * sh + sp2 | 0) + ',' + Math.min(255, mat[0][1] * sh + sp2 | 0) + ',' + Math.min(255, mat[0][2] * sh + sp2 * 1.1 | 0) + ')';
        ctx.beginPath();
        for (j = 0; j < fc.V.length; j++) {
          var X = cx + S * fc.V[j][0], Y = cy - S * fc.V[j][1];
          if (j === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
        }
        ctx.closePath(); ctx.fillStyle = col; ctx.fill();
        ctx.strokeStyle = 'rgba(210,222,240,' + (kind === 'panel' ? 0.34 : 0.22) + ')'; ctx.lineWidth = 0.5; ctx.stroke();
        if (kind === 'panel' && FULL_SAT) {                                    // photovoltaic cell grid
          var A0 = fc.V[0], A1 = fc.V[1], A3 = fc.V[3], g;
          ctx.strokeStyle = 'rgba(120,160,230,0.30)'; ctx.lineWidth = 0.4; ctx.beginPath();
          for (g = 1; g < 6; g++) { var tt2 = g / 6; ctx.moveTo(cx + S * (A0[0] + (A1[0] - A0[0]) * tt2), cy - S * (A0[1] + (A1[1] - A0[1]) * tt2)); ctx.lineTo(cx + S * (A3[0] + (fc.V[2][0] - A3[0]) * tt2), cy - S * (A3[1] + (fc.V[2][1] - A3[1]) * tt2)); }
          for (g = 1; g < 3; g++) { var t3 = g / 3; ctx.moveTo(cx + S * (A0[0] + (A3[0] - A0[0]) * t3), cy - S * (A0[1] + (A3[1] - A0[1]) * t3)); ctx.lineTo(cx + S * (A1[0] + (fc.V[2][0] - A1[0]) * t3), cy - S * (A1[1] + (fc.V[2][1] - A1[1]) * t3)); }
          ctx.stroke();
        }
        if (fc.F.kind === 'deck' && logoOk && FULL_SAT && !fc.back) {           // Climactix wordmark decal on the top deck
          var D0 = fc.V[0], D1 = fc.V[1], D3 = fc.V[3];
          var ux = (D1[0] - D0[0]) * S, uy = -(D1[1] - D0[1]) * S, vx2 = (D3[0] - D0[0]) * S, vy2 = -(D3[1] - D0[1]) * S;
          ctx.save();
          ctx.transform(ux, uy, -vx2, -vy2, cx + S * D0[0] + vx2, cy - S * D0[1] + vy2);      // image y runs down the deck, so flip the cross-track axis
          ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = satA * 0.95;
          ctx.drawImage(logo, 218, 182, 376, 78, 0.10, 0.40, 0.80, 0.20);
          ctx.restore();
        }
      }
      /* whip antenna */
      if (FULL_SAT) {
        var w0 = [-0.45, 0.15, 0.62], w1 = [-0.45, 0.15, 1.55], pp = [], L;
        for (L = 0; L < 2; L++) {
          q = L ? w1 : w0;
          var wx2 = pos[0] + sc * (q[0] * bx[0] + q[1] * by[0] + q[2] * bz[0]), wy2 = pos[1] + sc * (q[0] * bx[1] + q[1] * by[1] + q[2] * bz[1]), wz2 = pos[2] + sc * (q[0] * bx[2] + q[1] * by[2] + q[2] * bz[2]);
          pp.push([cx + S * (R00 * wx2 + R01 * wy2), cy - S * (R10 * wx2 + R11 * wy2 + R12 * wz2)]);
        }
        ctx.strokeStyle = 'rgba(200,212,230,0.7)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(pp[0][0], pp[0][1]); ctx.lineTo(pp[1][0], pp[1][1]); ctx.stroke();
      }
      ctx.restore();
      /* status tag, kept clear of the footprint: up and to the left of the spacecraft */
      tagRect = null;
      if (SHOW_TEXT && z < 0.6) {
        var ta = satA * smooth(seg(tt, 1.2, 2.0));
        var tx = satScr.x - 22, ty = satScr.y - 58;
        ctx.strokeStyle = rgba(C.text2, 0.4 * ta); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(satScr.x - 8, satScr.y - 10); ctx.lineTo(tx + 6, ty + 40); ctx.lineTo(tx + 6, ty + 36); ctx.stroke();
        tagRect = ta > 0.05 ? [tx - 158, ty - 9, tx + 8, ty + 42] : null;
        if (tagRect) { ctx.fillStyle = rgba(C.bg, 0.5 * ta); ctx.fillRect(tagRect[0], tagRect[1], tagRect[2] - tagRect[0], tagRect[3] - tagRect[1]); }
        text('CLIMACTIX · CTX-SAT-01', tx, ty, C.text, 0.92 * ta, 'right', 8.5);
        text('ORBIT 024 · THERMAL + OPTICAL', tx, ty + 11, C.text2, 0.85 * ta, 'right', 7.5);
        text(sp.a > 0.3 ? 'SCANNING · SIGNAL ACTIVE' : 'SIGNAL ACTIVE', tx, ty + 22, sp.a > 0.3 ? C.blue : C.text2, 0.9 * ta, 'right', 7.5);
        text(satLatLon(tt), tx, ty + 33, C.text2, 0.8 * ta, 'right', 7.5);
      }
    }

    /* ── frame ── */
    function targetEmph() {
      var a = EMPH_ALL.slice();
      if (emph.focus === 'supply') { a = [1, 0.25, 0.25, 1, 0.55, 0.25, 0.25, 0.25, 0.25, 0.25]; }
      else if (emph.focus === 'physical') { a = [1, 1, 0.3, 0.3, 1, 0.3, 0.3, 0.3, 0.3, 0.3]; }
      else if (emph.layer) { a = [1, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3]; a[emph.layer] = 1; }
      return a;
    }
    function stepEmph(dt) {
      var tg = targetEmph(), busy = false;
      for (var i = 1; i <= EMPH_N; i++) {
        var d = tg[i] - emphA[i];
        if (Math.abs(d) > 0.004) { emphA[i] += d * Math.min(1, dt * 9); busy = true; } else emphA[i] = tg[i];
      }
      emphBusy = busy;
    }
    function stepCam(now) {
      if (!zMoving) return;
      var u = clamp((now - zT0) / 1100, 0, 1);
      zView = zFrom + (zTo - zFrom) * easeIO(u);
      if (u >= 1) { zView = zTo; zMoving = false; }
      root.classList.toggle('is-away', zView < 3.3);
    }
    function camTo(goal) {
      if (!done || goal === zTo) return;
      zFrom = zView; zTo = goal; zT0 = performance.now(); zMoving = true;
    }
    function dataClock(tt, te) { return done ? TEND + ambT : te; }

    function draw(te) {                                // te = extended clock; the base story is driven by tb
      curTe = te;
      drawBase(baseTime(te), te);
    }
    function satClock(te, tb) {                        // satellite / markers keep running through hold 1, then follow the base clock
      var h = HOLDS[0];
      if (te < h.tb) return tb;
      return Math.max(tb, Math.min(te, h.tb + h.dur));
    }
    function drawBase(tt, te) {
      var z = applyCamera(tt);
      var ts = satClock(te, tt);
      var ea = smooth(seg(tt, 0, T.earthIn));
      var A = emphA, dt = dataClock(tt, te);
      var r1 = smooth(seg(tt, T.layers[0], T.layers[0] + T.layerDur)), r2 = smooth(seg(tt, T.layers[1], T.layers[1] + T.layerDur));
      var a1 = r1 * A[1];
      obsAlpha = r2 * A[2];
      var dimBase = emph.layer || emph.focus ? 1 : 1 - 0.45 * smooth(seg(tt, T.layers[3], T.layers[3] + 1.2));
      var scen = smooth(seg(tt, T.scen[0], T.scen[0] + 0.5)) * 0.4 + smooth(seg(tt, T.scen[1], T.scen[1] + 0.5)) * 0.5 + smooth(seg(tt, T.scen[2], T.scen[2] + 0.5)) * 0.7 + (intel ? intel.physScen(te) : 0);
      var texFade = EARTH.ready ? smooth((performance.now() - texReadyAt) / 700) : 0;
      if (done) texFade = EARTH.ready ? 1 : 0;
      var texAlpha = texFade * (1 - smooth(seg(z, 1.5, 2.2)));
      var satA = FULL_SAT || tier === 'mobile' ? satAlpha(ts, z) : 0, sp = spot(ts);
      var orbA = smooth(seg(ts, 0.9, 2.4)) * (1 - smooth(seg(ts, 10.2, 11.4))) * (1 - smooth(seg(z, 0.2, 0.9)));

      satScr.ok = false;
      drawBackdrop(z);
      drawOrbitRing(false, orbA * ea);
      if (satA > 0.02) {                                                   // behind the planet? draw first, the globe hides it
        var thb = thAt(ts), pb = orbVec(thb); projVec([pb[0] * ORB.ro, pb[1] * ORB.ro, pb[2] * ORB.ro], 1, tmpV);
        if (tmpV.z < 0) drawSatellite(ts, z, satA * ea, sp);
      }
      drawGlobeBase(ea, z);
      var fA = a1 * dimBase * 0.9 * ea, gainNow = (1 + 1.5 * smooth(seg(z, 2.2, 3.6))) * (1 + scen * 0.5), thNow = 0.46 - 0.05 * scen;
      var fShare = EARTH.ready ? 1 - smooth(seg(z, 1.0, 1.6)) : 0;
      drawEarthTex(ea * texAlpha, te, fA * fShare, gainNow, thNow);
      drawAtmosphere(ea, z);
      drawGraticule(ea * (1 - smooth(seg(z, 0.4, 1.2))) * (1 - 0.7 * texAlpha));
      drawLand(ea, z, texAlpha);
      drawLights(ea, z);
      drawField(fA * (1 - fShare), gainNow, thNow);
      drawLocalGrid(smooth(seg(z, 2.3, 3.0)));
      drawCity(smooth(seg(z, 2.4, 3.0)), z);
      drawSite(smooth(seg(z, 3.3, 3.9)));
      drawObservationLayer(obsAlpha * ea, z, tt);
      drawHazardLabels(a1 * ea, z);
      drawNetwork(tt, z, A);
      drawStreams(tt, z, dt);
      /* satellite story on top of the surface */
      if (satA > 0.02) {
        drawSwath(ts, satA * smooth(seg(ts, T.scan1[0], T.scan1[0] + 0.4)) * (1 - 0.6 * smooth(seg(ts, T.scan1[1] + 1, T.scan1[1] + 3))));
        drawOrbitRing(true, orbA * ea);
        groundTrack(ts, satA * ea);
      }
      drawMarkers(ts, z);
      drawDetection(ts, z);
      if (intel) intel.draw(te, tt, z, dt);              // carbon · narrative · scenario layers, on the same Earth
      if (satA > 0.02) {
        var thf = thAt(ts), pf2 = orbVec(thf); projVec([pf2[0] * ORB.ro, pf2[1] * ORB.ro, pf2[2] * ORB.ro], 1, tmpV);
        if (tmpV.z >= 0) drawSatellite(ts, z, satA * ea, sp);
        drawScan(ts, sp, satA);
        drawDownlink(ts, satA);
      }
      drawCallouts(smooth(seg(tt, T.brief, T.brief + 0.4)) * smooth(seg(z, 3.2, 4)) * (1 - smooth(seg(tt, T.final - 0.4, T.final + 0.4)) * 0.6) * (emph.layer || emph.focus ? 0 : 1), dt);
      if (progressEl) progressEl.style.transform = 'scaleX(' + clamp(te / TEND, 0, 1).toFixed(4) + ')';
      syncDom(tt, z, dt, te);
    }

    /* ── DOM sync (only on change) ── */
    var SOURCE_SUB = 'Satellite · Climate models · Weather · Emissions · Environmental data · Corporate data · Supply chain · Regulatory signals · Financial data';
    function stageOf(tt) {
      if (tt < 1.0) return 0;
      if (tt < 2.7) return 1;
      if (tt < 4.2) return 2;
      if (tt < 5.2) return 3;
      if (tt < T.zoom) return 4;
      if (tt < T.brief) return 5;
      if (tt < T.scen[0]) return 6;
      if (tt < T.final) return 7;
      return 8;
    }
    var STAGE_TITLES = ['Global climate signals', 'CTX-SAT-01 enters orbit', 'Earth observation · scan', 'Data acquired · transmitted', '', 'From global to facility', 'Facility risk intelligence', 'Illustrative scenario', 'From Earth data to decision intelligence'];
    function syncDom(tt, z, dt, te) {
      var stage = stageOf(tt);
      var lyr = -1;
      if (stage === 4 || (stage === 3 && tt >= T.layers[0])) { for (var i = T.layers.length - 1; i >= 0; i--) if (tt >= T.layers[i]) { lyr = i; break; } }
      if (lyr >= 0) lyr = lyr < 4 ? lyr : lyr + 3;                                   // base index → display index (fin/decision follow the new layers)
      if (te >= PH.carbon[0] && te < HOLDS[0].tb + HOLDS[0].dur) lyr = te < PH.narrative[0] ? 4 : te < PH.scenario[0] ? 5 : 6;
      if (stage === 3 && lyr >= 0) stage = 4;
      var lvl = stage >= 5 ? Math.min(4, Math.round(z)) : -1;
      var away = done && zView < 3.3;
      var key = stage + ':' + lyr + ':' + away + ':' + (te >= PH.synth[0] && te < PH.synth[1] + 1);
      if (key !== stageIdx) {
        stageIdx = key;
        var synthOn = te >= PH.synth[0] && te < PH.synth[1] + 1;
        var title = synthOn ? 'Intelligence synthesis · facility' : stage === 4 ? 'Layer ' + pad(lyr + 1) + ' · ' + (LAYER_TITLES[lyr] || '') : (away && stage >= 6 ? 'Global exposure view' : STAGE_TITLES[stage]);
        stageEl.textContent = title;
        subEl.textContent = (stage === 3 || stage === 2) && tier !== 'desktop' ? SOURCE_SUB : '';
        crumbEl.classList.toggle('is-on', stage >= 5);
      }
      var lstate = stage >= 5 ? 99 : lyr;
      if (lstate !== layerIdx || stage !== (syncDom.lastStage || 0)) {
        layerIdx = lstate; syncDom.lastStage = stage;
        for (var j = 0; j < layerEls.length; j++) {
          var pos = LAYER_ORDER.indexOf(+layerEls[j].getAttribute('data-layer'));
          layerEls[j].classList.toggle('is-active', stage === 4 && pos === lyr);
          layerEls[j].classList.toggle('is-done', stage >= 5 || (stage === 4 && pos < lyr));
        }
      }
      if (lvl !== crumbIdx) {
        crumbIdx = lvl;
        for (var c = 0; c < crumbItems.length; c++) {
          crumbItems[c].classList.toggle('is-cur', c === lvl);
          crumbItems[c].classList.toggle('is-past', lvl >= 0 && c < lvl);
        }
      }
      var bOn = tt >= T.brief;
      if (bOn !== briefOn) { briefOn = bOn; briefEl.classList.toggle('is-on', bOn); }
      var fin = tt >= T.final;
      var lit = tt < T.chain ? -1 : Math.min(chainItems.length - 1, Math.floor((tt - T.chain) / T.chainStep));
      if (lit !== chainLit) {
        chainLit = lit;
        chainEl.classList.toggle('is-on', lit >= 0);
        for (var m = 0; m < chainItems.length; m++) chainItems[m].classList.toggle('is-lit', m <= lit);
      }
      var nOn = tt >= T.chain + T.chainStep * chainItems.length;
      if (nOn !== noteOn) { noteOn = nOn; chainNote.classList.toggle('is-on', nOn); }
      if (fin !== finalOn) { finalOn = fin; if (finalEl) finalEl.classList.toggle('is-on', fin); chainWrap.classList.toggle('is-final', fin); }
      var sl = tt < T.scen[0] ? -1 : tt < T.scen[1] ? 0 : tt < T.scen[2] ? 1 : 2;
      if (sl !== scenLit) {
        scenLit = sl;
        if (scenEl) scenEl.classList.toggle('is-on', sl >= 0 && tt < T.final + 2);
        for (var sIdx = 0; sIdx < scenItems.length; sIdx++) scenItems[sIdx].classList.toggle('is-lit', sIdx <= sl);
      }
      syncPanel(tt, dt);
      if (intel) intel.sync(te, stage, z);
    }
    function pad(n) { return n < 10 ? '0' + n : String(n); }

    /* ingestion panel: statuses + slow, monotonic counters (4 updates a second at most) */
    function setTxt(el, s) { if (el && el.__t !== s) { el.__t = s; el.textContent = s; } }
    function syncPanel(tt, dt) {
      if (!panelEl) return;
      var stamp = Math.floor(dt / 0.7);
      var on = tt >= 3.0 || done;
      if (on !== panelEl.classList.contains('is-on')) panelEl.classList.toggle('is-on', on);
      var compact = tt >= T.zoom || curTe >= PH.carbon[0];
      if (compact !== panelEl.classList.contains('is-compact')) panelEl.classList.toggle('is-compact', compact);
      if (stamp === panelStamp) return;
      panelStamp = stamp;
      var q = stamp * 0.7, active = 0, i;
      for (i = 0; i < panelRows.length; i++) {
        var t0 = streams[i] ? streams[i].t0 : 99, st = q < t0 ? 'idle' : q < t0 + 0.8 ? 'acq' : 'on';
        if (st === 'on') active++;
        if (panelRows[i].getAttribute('data-st') !== st) { panelRows[i].setAttribute('data-st', st); setTxt(panelRows[i].lastElementChild, st === 'idle' ? 'Queued' : st === 'acq' ? 'Acquiring' : 'Active'); }
      }
      setTxt(pStreams, pad(active));
      setTxt(pSignals, fmtInt(signalsProcessed(q)));
      setTxt(pLast, '00:00:' + pad(1 + Math.floor(q * 1.3) % 6));
      var cov = 58 + 36 * smooth(seg(q, 3, 10)), on2 = q >= 3.6;
      setTxt(pQual, on2 ? (91.6 + 0.6 * Math.sin(q * 0.5) + 0.4 * smooth(seg(q, 4, 12))).toFixed(0) + '%' : '—');
      setTxt(pConf, on2 ? (87.4 + 0.5 * Math.sin(q * 0.4 + 1) + 0.6 * smooth(seg(q, 4, 12))).toFixed(0) + '%' : '—');
      setTxt(pCov, on2 ? cov.toFixed(0) + '%' : '—');
      setTxt(pStr, q < 3.0 ? '—' : q < 4.2 ? 'ACQUIRING' : 'HIGH');
    }

    /* ── loop ── */
    function loop(now) {
      raf = 0;
      if (!visible || document.hidden) return;
      var dtl = Math.min(0.1, (now - last) / 1000); last = now;
      if (playing) {
        t += dtl;
        if (t >= TEND) { t = TEND; playing = false; done = true; root.classList.add('is-done'); startAmbient(); }
      }
      stepEmph(dtl);
      stepCam(now);
      draw(t);
      var settling = EARTH.ready && !done && now - texReadyAt < 800;
      if (playing || emphBusy || zMoving || settling || (EARTH.ready && now - texReadyAt < 800)) raf = requestAnimationFrame(loop);
    }
    function kick() {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
    /* after the story: the feed keeps ticking (panel counters, readouts) at a calm cadence */
    function startAmbient() {
      clearInterval(ambTimer);
      ambTimer = setInterval(function () {
        if (!visible || document.hidden || !done || raf) return;
        ambT += 0.7;
        draw(t);
      }, 700);
    }

    /* ── hover / focus emphasis (only once the layers exist) ── */
    function unlocked() { return t >= teOf(T.layers[NLAY - 1] + T.layerDur) || done; }
    function setEmph(layer, focus) {
      if (!unlocked()) return;
      emph.layer = layer; emph.focus = focus;
      camTo(layer || focus ? 0 : 4);
      for (var i = 0; i < layerEls.length; i++) layerEls[i].classList.toggle('is-focus', layer === +layerEls[i].getAttribute('data-layer'));
      var chips = root.querySelectorAll('.rim-chips li[data-focus]');
      for (var c = 0; c < chips.length; c++) chips[c].classList.toggle('is-focus', !!focus && chips[c].getAttribute('data-focus') === focus);
      kick();
    }
    function clearEmph() { setEmph(0, null); }
    var hoverBound = [];
    function bind(el, ev, fn) { el.addEventListener(ev, fn); hoverBound.push([el, ev, fn]); }
    Array.prototype.forEach.call(layerEls, function (el) {
      var n = +el.getAttribute('data-layer');
      bind(el, 'mouseenter', function () { setEmph(n, null); });
      bind(el, 'mouseleave', clearEmph);
      bind(el, 'focus', function () { setEmph(n, null); });
      bind(el, 'blur', clearEmph);
    });
    Array.prototype.forEach.call(root.querySelectorAll('.rim-chips li[data-focus]'), function (chip) {
      bind(chip, 'mouseenter', function (e) { e.stopPropagation(); setEmph(+chip.closest('.rim-layer').getAttribute('data-layer'), chip.getAttribute('data-focus')); });
      bind(chip, 'mouseleave', function () { setEmph(+chip.closest('.rim-layer').getAttribute('data-layer'), null); });
    });

    /* ── lifecycle ── */
    function resetDom() {
      if (intel) intel.reset();
      stageIdx = ''; layerIdx = -1; crumbIdx = -1; briefOn = false; chainLit = -2; noteOn = false; finalOn = false; scenLit = -2; panelStamp = -1;
      syncDom.lastStage = -1;
      briefEl.classList.remove('is-on'); chainEl.classList.remove('is-on'); chainNote.classList.remove('is-on');
      chainWrap.classList.remove('is-final'); if (finalEl) finalEl.classList.remove('is-on'); if (scenEl) scenEl.classList.remove('is-on');
      if (panelEl) { panelEl.classList.remove('is-on'); panelEl.classList.remove('is-compact'); }
      root.classList.remove('is-done');
    }
    function play() {
      clearInterval(ambTimer);
      done = false; t = 0; ambT = 0; playing = true; zView = zFrom = zTo = 4; zMoving = false; root.classList.remove('is-away');
      emph.layer = 0; emph.focus = null; emphA = EMPH_ALL.slice();
      resetDom();
      kick();
    }
    function showFinal() {
      done = true; playing = false; t = TEND; zView = zFrom = zTo = 4; zMoving = false;
      resetDom();
      draw(TEND);
      root.classList.add('is-done');
      startAmbient();
    }
    function seek(x) {                                 // QA / deep-link hook
      playing = false; clearInterval(ambTimer);
      done = x >= TEND; t = clamp(x, 0, TEND); ambT = 0;
      if (done) { zView = zFrom = zTo = 4; zMoving = false; }
      texA = 1;
      draw(t);
    }
    function destroy() {
      if (intel) intel.destroy();
      earthAlive = false; clearTimeout(earthTimer); clearInterval(ambTimer); cancelAnimationFrame(raf); raf = 0; playing = false;
      hoverBound.forEach(function (b) { b[0].removeEventListener(b[1], b[2]); }); hoverBound = [];
      if (ro) ro.disconnect(); if (stopVis) stopVis();
    }

    /* ── hook for the analytical layers (rim-intel-layers.js): the same projection, palette and clock as the map itself ── */
    function jump(te) {                                // chapter jump while the story is playing: continue from there
      clearInterval(ambTimer); done = false; ambT = 0; t = clamp(te, 0, TEND); playing = true; root.classList.remove('is-done');
      if (zView !== 4 || zMoving) { zView = zFrom = zTo = 4; zMoving = false; root.classList.remove('is-away'); }
      kick();
    }
    if (window.CX_RIM_INTEL) {
      intel = window.CX_RIM_INTEL.create({
        root: root, wrap: wrap, ctx: ctx, tier: tier, C: C, MONO: MONO, TAU: TAU, D2R: D2R, SHOW_TEXT: SHOW_TEXT,
        rgba: rgba, mix: mix, text: text, clamp: clamp, lerp: lerp, seg: seg, smooth: smooth, easeIO: easeIO, easeOut: easeOut,
        proj: proj, size: function () { return { W: W, H: H, cx: cx, cy: cy, S: S, dpr: dpr, z: curZ }; },
        FAC: FAC, SUP: SUP, ARCS: ARCS, field: field, HERO: HERO, PH: PH, TEND: TEND, HOLDS: HOLDS,
        emph: function () { return emph; }, emphA: function () { return emphA; },
        isDone: function () { return done; }, isPlaying: function () { return playing; },
        lens: function (layerId, on) { if (done || !playing && unlocked()) setEmph(on ? layerId : 0, null); else if (on) jump(PH[layerId === 7 ? 'carbon' : layerId === 8 ? 'narrative' : 'scenario'][0]); },
        redraw: function () { if (!playing) draw(t); kick(); }
      });
    }
    resize();
    var ro = null, stopVis = null;
    if ('ResizeObserver' in window) {
      var rTimer = 0;
      ro = new ResizeObserver(function () { clearTimeout(rTimer); rTimer = setTimeout(resize, 80); });
      ro.observe(wrap);
    } else window.addEventListener('resize', resize);
    stopVis = CXStory.watchVisible(root, function (v) { visible = v; if (v && (playing || emphBusy || zMoving)) kick(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden && (playing || emphBusy || zMoving)) kick(); });
    buildEarth();
    draw(0);

    return { play: play, replay: play, showFinal: showFinal, seek: seek, destroy: destroy };
  });
})();
