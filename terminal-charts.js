/* ════════════════════════════════════════════════════════════════════
   CLIMACTIX TERMINAL — CHART LIBRARY
   Exports window.CXChart. Every function returns an HTML/SVG string and
   takes plain data, so charts can be reused in any module. Colours come
   from CSS classes (terminal-walkthrough.css), so both themes work.

   Tones: pos (emerald) · sp (emerald, soft) · acc (blue) · neu (grey) ·
          neg / warn (amber) · crit (red)

   card()      title, evidence class, methodology tooltip, legend, source
   donut()     composition with a centre label; pie:true fills the disc
   likert()    100% stacked rows for survey response distributions
   hbars()     ranked horizontal bars
   dumbbell()  two-group comparison on one scale
   diverge()   bars either side of zero
   range()     low–high estimate bars
   radar()     multi-dimension profile
   pathway()   declared target trajectory against reported emissions
   scopes()    Scope 1, 2 and 3 by year
   ════════════════════════════════════════════════════════════════════ */
window.CXChart = (function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }

  /* A chart never appears without its title, evidence class, method and source. */
  function card(o) {
    return '<section class="panel cx-card ' + (o.cls || '') + '"><div class="panel-h"><h3>' + esc(o.title) + '</h3><span class="toolbar">' +
      (o.evidence ? '<span class="chip ev-' + o.evidenceKey + '">' + esc(o.evidence) + '</span>' : '') +
      (o.method ? '<button type="button" class="cx-info" data-tip="' + esc(o.method) + '" aria-label="Methodology">i</button>' : '') + '</span>' +
      (o.sub ? '<div class="sub">' + esc(o.sub) + '</div>' : '') + '</div><div class="panel-b">' + o.body + '</div>' +
      '<div class="cx-foot">' + (o.legend ? '<div class="legend">' + o.legend.map(function (l) { return '<span><i class="lg-' + l[0] + '"></i>' + esc(l[1]) + '</span>'; }).join('') + '</div>' : '') +
      '<div class="cx-src">' + (o.source || '') + '</div></div></section>';
  }

  function donut(segs, o) {
    o = o || {};
    var size = o.size || 200, sw = o.pie ? size / 2 : (o.stroke || 30), r = (size - sw) / 2, c = size / 2, C = 2 * Math.PI * r, acc = 0, svg = '';
    segs.forEach(function (s, i) {
      if (!s.v) return;
      var len = C * s.v / 100;
      svg += '<circle class="seg t-' + s.tone + '" style="--k:' + i + '" cx="' + c + '" cy="' + c + '" r="' + r + '" stroke-width="' + sw + '" stroke-dasharray="' + Math.max(0, len - (o.pie ? 0 : 2)).toFixed(2) + ' ' + C.toFixed(2) +
             '" stroke-dashoffset="' + (-acc).toFixed(2) + '" transform="rotate(-90 ' + c + ' ' + c + ')" tabindex="0" data-tip="' + esc(s.label + ': ' + s.v + '%' + (s.note ? ' · ' + s.note : '')) + '"/>';
      acc += len;
    });
    return '<div class="cx-donut"><div class="dn" style="width:' + size + 'px;height:' + size + 'px"><svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="' + esc(o.label || 'Composition') + '">' + svg + '</svg>' +
      (o.pie || o.center == null ? '' : '<div class="cc"><b class="num">' + o.center + '</b><small>' + esc(o.centerSub || '') + '</small></div>') + '</div>' +
      '<ul class="dl">' + segs.map(function (s) { return '<li><i class="lg-' + s.tone + '"></i><span>' + esc(s.label) + (s.note ? '<small>' + esc(s.note) + '</small>' : '') + '</span><b class="num">' + s.v + '%</b></li>'; }).join('') + '</ul></div>';
  }

  var SCALE = { impact: ['Negative', 'Neutral', 'Somewhat positive', 'Very positive', 'Positive'], agree: ['Disagree', 'Neutral', 'Agree', 'Strongly agree', 'Agree'] };
  function likert(rows, o) {
    o = o || {};
    var L = SCALE[o.scale || 'impact'];
    return '<div class="cx-likert">' + rows.map(function (r) {
      var parts = [['neg', r.neg, L[0]], ['neu', r.neu, L[1]], ['sp', r.sp, L[2]], ['pos', r.vp, L[3]]];
      return '<div class="lr"><div class="ll">' + esc(r.label) + '<small>n = ' + r.n + '</small></div><div class="lb">' + parts.map(function (p) {
        return p[1] ? '<i class="lk-' + p[0] + '" style="width:' + p[1] + '%" tabindex="0" data-tip="' + esc(r.label + ' · ' + p[2] + ': ' + p[1] + '%') + '">' + (p[1] >= 6 ? p[1] : '') + '</i>' : '';
      }).join('') + '</div><div class="lv" data-tip="' + esc(r.rounding || (L[4] + ' share: ' + L[2].toLowerCase() + ' plus ' + L[3].toLowerCase())) + '"><b class="num">' + r.positive + '%</b><small>' + L[4].toLowerCase() + '</small></div></div>';
    }).join('') + '</div>';
  }
  function likertLegend(scale) { var L = SCALE[scale || 'impact']; return [['neg', L[0]], ['neu', L[1]], ['sp', L[2]], ['pos', L[3]]]; }

  function hbars(items, o) {
    o = o || {};
    var max = o.max || 100;
    return '<div class="cx-hbars">' + items.map(function (it) {
      return '<' + (it.go ? 'button type="button" data-go="' + it.go + '"' : 'div') + ' class="hb"' + (it.tip ? ' data-tip="' + esc(it.tip) + '"' : '') + '><span class="hl">' + esc(it.label) + '</span><span class="ht"><i class="meter-f ' + (it.tone || 'acc') + '" style="width:' + (it.v / max * 100) + '%"></i></span><b class="num">' + it.v + (o.unit == null ? '%' : o.unit) + '</b></' + (it.go ? 'button' : 'div') + '>';
    }).join('') + '</div>';
  }

  function dumbbell(rows, o) {
    o = o || {};
    return '<div class="cx-db"><div class="dbk"><span><i class="lg-neu"></i>' + esc(o.a) + '</span><span><i class="lg-pos"></i>' + esc(o.b) + '</span></div>' + rows.map(function (r) {
      var lo = Math.min(r.a, r.b), hi = Math.max(r.a, r.b);
      return '<div class="dbr"><div class="dbl">' + esc(r.label) + '</div><div class="dbt"><i class="dbs" style="left:' + lo + '%;width:' + (hi - lo) + '%"></i>' +
        '<b class="dba" style="left:' + r.a + '%" data-tip="' + esc(o.a + ': ' + r.a + '%') + '">' + r.a + '</b><b class="dbb" style="left:' + r.b + '%" data-tip="' + esc(o.b + ': ' + r.b + '%') + '">' + r.b + '</b></div>' +
        '<div class="dbd num">+' + (r.b - r.a) + ' pts</div></div>';
    }).join('') + '</div>';
  }

  function diverge(items, o) {
    var min = o.min, max = o.max, z = (0 - min) / (max - min) * 100;
    return '<div class="cx-dv">' + items.map(function (it) {
      var w = Math.abs(it.v) / (max - min) * 100, left = it.v < 0 ? z - w : z;
      return '<div class="dvr"><div class="dvl">' + esc(it.label) + '</div><div class="dvt"><i class="dvz" style="left:' + z + '%"></i><i class="dvb ' + (it.v < 0 ? 'pos' : it.v < 1 ? 'warn' : 'crit') + '" style="left:' + left + '%;width:' + w + '%" data-tip="' + esc(it.tip || '') + '"></i></div><b class="num">' + (it.v > 0 ? '+' : '') + it.v + (o.unit || '') + '</b></div>';
    }).join('') + '<div class="dvx"><span>Emissions falling</span><span>Emissions rising</span></div></div>';
  }

  function range(items, o) {
    var max = o.max;
    return '<div class="cx-rg">' + items.map(function (it) {
      return '<div class="rgr"><div class="rgl">' + esc(it.label) + '<small>' + esc(it.sub || '') + '</small></div><div class="rgt"><i class="' + (it.tone || 'acc') + '" style="left:' + (it.lo / max * 100) + '%;width:' + Math.max(1.5, (it.hi - it.lo) / max * 100) + '%" data-tip="' + esc(it.tip || '') + '"></i></div><b class="num">' + it.lo + '–' + it.hi + '%</b></div>';
    }).join('') + '</div>';
  }

  function radar(axes, series, o) {
    o = o || {};
    var S = o.size || 320, c = S / 2, R = S / 2 - 54, n = axes.length, svg = '';
    var pt = function (i, v) { var a = -Math.PI / 2 + i * 2 * Math.PI / n; return [c + R * v / 100 * Math.cos(a), c + R * v / 100 * Math.sin(a)]; };
    [25, 50, 75, 100].forEach(function (g) { svg += '<polygon class="rg" points="' + axes.map(function (_, i) { return pt(i, g).map(function (x) { return x.toFixed(1); }).join(','); }).join(' ') + '"/>'; });
    axes.forEach(function (a, i) {
      var e = pt(i, 100), l = pt(i, 122);
      svg += '<line class="rg" x1="' + c + '" y1="' + c + '" x2="' + e[0].toFixed(1) + '" y2="' + e[1].toFixed(1) + '"/><text x="' + l[0].toFixed(1) + '" y="' + (l[1] + 4).toFixed(1) + '" text-anchor="middle">' + esc(a) + '</text>';
    });
    series.forEach(function (s, k) {
      var has = s.values.every(function (v) { return v != null; });
      if (!has) return;
      svg += '<polygon class="rp r' + k + '" points="' + s.values.map(function (v, i) { return pt(i, v).map(function (x) { return x.toFixed(1); }).join(','); }).join(' ') + '"/>';
      s.values.forEach(function (v, i) { var p = pt(i, v); svg += '<circle class="rd r' + k + '" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4" data-tip="' + esc(s.name + ' · ' + axes[i] + ': ' + v) + '"/>'; });
    });
    return '<svg class="cx-radar" viewBox="0 0 ' + S + ' ' + S + '" role="img" aria-label="' + esc(o.label || 'Radar chart') + '">' + svg + '</svg>';
  }

  /* Declared target trajectory (dashed) against reported Scope 1 + 2 emissions (solid). */
  function pathway(z) {
    var p = z.profile, W = 640, H = 300, L = 56, R = 20, T = 20, B = 36;
    var y0 = p.base, y1 = p.nzYear, pts = [], tr = [], max = 0, i;
    z.years.forEach(function (y, k) { if (z.s12[k] != null) { pts.push([y, z.s12[k]]); max = Math.max(max, z.s12[k]); } });
    for (i = y0; i <= y1; i++) tr.push([i, z.trajectoryAt(i)]);
    max = Math.max(max, tr[0][1]) * 1.12;
    var X = function (y) { return L + (W - L - R) * (y - y0) / (y1 - y0); }, Y = function (v) { return T + (H - T - B) * (1 - v / max); };
    var svg = '<svg class="chart cx-path" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Net zero pathway: declared target trajectory against reported emissions">';
    for (i = 0; i <= 4; i++) { var gv = max * i / 4; svg += '<line class="gl" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(gv) + '" y2="' + Y(gv) + '"/><text x="' + (L - 8) + '" y="' + (Y(gv) + 4) + '" text-anchor="end">' + fmt(Math.round(gv)) + '</text>'; }
    var step = (y1 - y0) > 16 ? 5 : 2;
    for (i = y0; i <= y1; i += step) svg += '<text x="' + X(i) + '" y="' + (H - 12) + '" text-anchor="middle">' + i + '</text>';
    var now = z.reportingYear;
    svg += '<line class="now" x1="' + X(now) + '" x2="' + X(now) + '" y1="' + T + '" y2="' + (H - B) + '"/><text class="nowt" x="' + (X(now) + 6) + '" y="' + (T + 10) + '">Latest reported · ' + now + '</text>';
    svg += '<path class="tgt" d="' + tr.map(function (q, k) { return (k ? 'L' : 'M') + X(q[0]).toFixed(1) + ' ' + Y(q[1]).toFixed(1); }).join('') + '"/>';
    if (p.near) svg += '<circle class="tgd" cx="' + X(p.near.year) + '" cy="' + Y(z.trajectoryAt(p.near.year)) + '" r="5" data-tip="Near-term target: ' + p.near.pct + '% reduction by ' + p.near.year + '"/><text x="' + X(p.near.year) + '" y="' + (Y(z.trajectoryAt(p.near.year)) - 12) + '" text-anchor="middle">−' + p.near.pct + '% by ' + p.near.year + '</text>';
    svg += '<circle class="tgd" cx="' + X(y1) + '" cy="' + Y(tr[tr.length - 1][1]) + '" r="5" data-tip="Net zero year: ' + y1 + '"/><text x="' + (X(y1) - 6) + '" y="' + (Y(tr[tr.length - 1][1]) - 12) + '" text-anchor="end">Net zero ' + y1 + '</text>';
    svg += '<path class="ln s0" pathLength="1" d="' + pts.map(function (q, k) { return (k ? 'L' : 'M') + X(q[0]).toFixed(1) + ' ' + Y(q[1]).toFixed(1); }).join('') + '"/>';
    pts.forEach(function (q, k) {
      var t = z.trajectoryAt(q[0]);
      svg += '<circle class="pt s0" style="--k:' + k + '" cx="' + X(q[0]).toFixed(1) + '" cy="' + Y(q[1]).toFixed(1) + '" r="4.5" data-tip="' + q[0] + ' · reported ' + fmt(q[1]) + ' kt CO₂e' + (t != null ? ' · trajectory ' + fmt(Math.round(t)) + ' kt' : '') + '"/>';
    });
    /* the gap between what was declared and what was reported, at the latest year */
    var last = pts[pts.length - 1], want = z.trajectoryAt(last[0]);
    if (want != null && Math.abs(want - last[1]) / max > 0.015) svg += '<line class="gap ' + (last[1] > want ? 'warn' : 'pos') + '" x1="' + X(last[0]) + '" x2="' + X(last[0]) + '" y1="' + Y(last[1]) + '" y2="' + Y(want) + '"/>';
    return svg + '</svg>';
  }

  function scopes(z) {
    var p = z.profile, max = 0;
    z.years.forEach(function (_, i) { max = Math.max(max, (p.s1[i] || 0) + (p.s2[i] || 0) + (p.s3[i] || 0)); });
    return '<div class="cx-scopes">' + z.years.map(function (y, i) {
      var any = p.s1[i] != null || p.s2[i] != null || p.s3[i] != null;
      var seg = function (k, v, name) { return v == null ? '' : '<i class="sc-' + k + '" style="height:' + (v / max * 100) + '%" data-tip="' + y + ' · ' + name + ': ' + fmt(v) + ' kt CO₂e"></i>'; };
      return '<div class="scy"><div class="scb">' + (any ? seg('s3', p.s3[i], 'Scope 3') + seg('s2', p.s2[i], 'Scope 2') + seg('s1', p.s1[i], 'Scope 1') : '<span class="scn" data-tip="No emissions reported for ' + y + '. Shown as missing, not as zero.">not reported</span>') +
        '</div>' + (any && p.s3[i] == null ? '<small data-tip="Scope 3 was not reported for ' + y + '. It is missing, not zero.">S3 n/r</small>' : '<small>&nbsp;</small>') + '<span>' + y + '</span></div>';
    }).join('') + '</div>';
  }

  return { card: card, donut: donut, likert: likert, likertLegend: likertLegend, hbars: hbars, dumbbell: dumbbell, diverge: diverge, range: range, radar: radar, pathway: pathway, scopes: scopes, esc: esc, fmt: fmt };
})();
