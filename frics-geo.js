/**
 * frics-geo.js — orthographic Earth for the FRICS™ story, drawn from the existing
 * window.CX_RIM_GEO data (Natural Earth land, India, Maharashtra) that rim-geo.js already ships
 * for the Risk Intelligence Map. No new geometry, no new library: a globe whose radius grows
 * until it reads as a local map — world → India → Maharashtra → the farming area.
 *
 *   FRICSGeo.create() → { resize(W,H), draw(g, cam), proj(lon, lat, cam) → [x, y, visible] }
 *   cam = { lon, lat, R (px), cx, cy (px), a (alpha), stress (0–1 tint on Maharashtra) }
 */
(function () {
  'use strict';
  if (window.FRICSGeo) return;

  var D2R = Math.PI / 180, TAU = Math.PI * 2;

  function asRings(x) { return !x ? [] : (x[0] && typeof x[0][0] === 'number') ? [x] : x; }

  function prep(rings) {                                   // per-ring centre + angular radius, for culling
    return rings.map(function (pts) {
      var sx = 0, sy = 0, sz = 0, i, n = pts.length, lam = new Float32Array(n), phi = new Float32Array(n);
      for (i = 0; i < n; i++) {
        lam[i] = pts[i][0] * D2R; phi[i] = pts[i][1] * D2R;
        var cp = Math.cos(phi[i]); sx += cp * Math.cos(lam[i]); sy += cp * Math.sin(lam[i]); sz += Math.sin(phi[i]);
      }
      var l = Math.hypot(sx, sy, sz) || 1; sx /= l; sy /= l; sz /= l;
      var rad = 0;
      for (i = 0; i < n; i += Math.max(1, (n / 40) | 0)) {
        var cp2 = Math.cos(phi[i]), d = sx * cp2 * Math.cos(lam[i]) + sy * cp2 * Math.sin(lam[i]) + sz * Math.sin(phi[i]);
        rad = Math.max(rad, Math.acos(Math.max(-1, Math.min(1, d))));
      }
      return { lam: lam, phi: phi, n: n, c: [sx, sy, sz], r: rad };
    });
  }

  function create() {
    var GEO = window.CX_RIM_GEO, W = 0, H = 0;
    if (!GEO) return { resize: function () {}, draw: function () {}, proj: function () { return [0, 0, false]; }, ok: false };
    var land = prep(asRings(GEO.land)), india = prep(asRings(GEO.india)), maha = prep(asRings(GEO.maha));

    function setup(cam) {
      var l0 = cam.lon * D2R, p0 = cam.lat * D2R;
      return { l0: l0, sp: Math.sin(p0), cp: Math.cos(p0), c0: [Math.cos(p0) * Math.cos(l0), Math.cos(p0) * Math.sin(l0), Math.sin(p0)] };
    }
    function project(lam, phi, cam, s, clampHidden) {
      var dl = lam - s.l0, cph = Math.cos(phi), sph = Math.sin(phi), cd = Math.cos(dl);
      var cosc = s.sp * sph + s.cp * cph * cd;
      var x = cph * Math.sin(dl), y = s.cp * sph - s.sp * cph * cd;
      if (cosc < 0 && clampHidden) { var l = Math.hypot(x, y) || 1; x /= l; y /= l; }
      return [cam.cx + cam.R * x, cam.cy - cam.R * y, cosc >= 0];
    }

    function ringPath(g, r, cam, s, close) {
      var i, first = true;
      for (i = 0; i < r.n; i++) {
        var q = project(r.lam[i], r.phi[i], cam, s, true);
        if (first) { g.moveTo(q[0], q[1]); first = false; } else g.lineTo(q[0], q[1]);
      }
      if (close) g.closePath();
    }

    function visible(r, s, cmax) {
      var d = s.c0[0] * r.c[0] + s.c0[1] * r.c[1] + s.c0[2] * r.c[2];
      return Math.acos(Math.max(-1, Math.min(1, d))) - r.r < cmax;
    }

    function graticule(g, cam, s, step, cmax) {            // only the window the camera can see
      var span = Math.min(180, cmax / D2R * 1.25 + step), lat0 = cam.lat, lon0 = cam.lon, dens = Math.max(step / 4, span / 30);
      var lo, la, q, pen;
      g.beginPath();
      for (lo = Math.floor((lon0 - span) / step) * step; lo <= lon0 + span; lo += step) {
        pen = false;
        for (la = Math.max(-80, lat0 - span); la <= Math.min(80, lat0 + span); la += dens) { q = project(lo * D2R, la * D2R, cam, s, false); if (q[2]) { if (!pen) { g.moveTo(q[0], q[1]); pen = true; } else g.lineTo(q[0], q[1]); } else pen = false; }
      }
      for (la = Math.max(-80, Math.floor((lat0 - span) / step) * step); la <= Math.min(80, lat0 + span); la += step) {
        pen = false;
        for (lo = lon0 - span; lo <= lon0 + span; lo += dens) { q = project(lo * D2R, la * D2R, cam, s, false); if (q[2]) { if (!pen) { g.moveTo(q[0], q[1]); pen = true; } else g.lineTo(q[0], q[1]); } else pen = false; }
      }
      g.stroke();
    }

    function draw(g, cam) {
      if (cam.a <= 0.002) return;
      var s = setup(cam), diag = Math.hypot(W, H) / 2 + 40, discVisible = cam.R < diag * 1.4;
      var cmax = cam.R > diag ? Math.asin(Math.min(1, diag / cam.R)) : Math.PI / 2;
      g.save(); g.globalAlpha = cam.a; g.lineJoin = 'round';
      if (discVisible) {
        g.beginPath(); g.arc(cam.cx, cam.cy, cam.R, 0, TAU); g.fillStyle = '#04070F'; g.fill();
        g.save(); g.clip();
      }
      var step = cam.R > 30000 ? 0.5 : cam.R > 6000 ? 1 : cam.R > 1500 ? 5 : 15;
      g.strokeStyle = 'rgba(91,163,245,0.10)'; g.lineWidth = 1; graticule(g, cam, s, step, cmax);
      g.fillStyle = '#0B1526'; g.strokeStyle = 'rgba(91,163,245,0.42)'; g.lineWidth = 0.9;
      land.forEach(function (r) { if (visible(r, s, cmax)) { g.beginPath(); ringPath(g, r, cam, s, true); g.fill(); g.stroke(); } });
      india.forEach(function (r) { if (visible(r, s, cmax)) { g.beginPath(); ringPath(g, r, cam, s, true); g.fillStyle = '#111F3A'; g.fill(); g.strokeStyle = 'rgba(91,163,245,0.75)'; g.lineWidth = 1.1; g.stroke(); } });
      maha.forEach(function (r) {
        if (!visible(r, s, cmax)) return;
        g.beginPath(); ringPath(g, r, cam, s, true);
        var sx = cam.stress || 0;
        g.fillStyle = sx > 0.03 ? 'rgba(232,119,34,' + (0.06 + 0.34 * sx).toFixed(3) + ')' : 'rgba(91,163,245,0.05)'; g.fill();
        g.strokeStyle = sx > 0.03 ? 'rgba(232,119,34,' + (0.35 + 0.5 * sx).toFixed(3) + ')' : 'rgba(91,163,245,0.55)'; g.lineWidth = 1.2; g.stroke();
      });
      if (discVisible) {
        g.restore();
        g.beginPath(); g.arc(cam.cx, cam.cy, cam.R, 0, TAU); g.strokeStyle = 'rgba(43,95,168,0.75)'; g.lineWidth = 1.5; g.stroke();
        g.beginPath(); g.arc(cam.cx, cam.cy, cam.R + 5, 0, TAU); g.strokeStyle = 'rgba(91,163,245,0.16)'; g.lineWidth = 3; g.stroke();
      }
      g.restore();
    }

    return {
      ok: true,
      resize: function (w, h) { W = w; H = h; },
      draw: draw,
      proj: function (lon, lat, cam) { return project(lon * D2R, lat * D2R, cam, setup(cam), false); }
    };
  }

  window.FRICSGeo = { create: create };
})();
