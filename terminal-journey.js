/* ════════════════════════════════════════════════════════════════════
   CLIMACTIX TERMINAL JOURNEY — INGEST → ASSESS → SCORE → ENABLE → IMPACT
   A live, code-drawn scene (no video). Drop
       <div data-cx-journey data-links="site|terminal"></div>
   anywhere; this file injects its own styles and mounts itself.

   A camera travels through one continuous world. Each stage has its own
   scene, linked by flowing strands of light over a slow topographic
   backdrop that moves in parallax:
     01 Ingest  — disclosures of every type drift into one repository
     02 Assess  — a scan resolves the 20 indicators, gaps stay visible
     03 Score   — weighted dimensions assemble into the score, with data
                  confidence kept separate
     04 Enable  — the result is routed to four institutional views
     05 Impact  — decisions, disclosure gaps, and the next reporting cycle
                  feeding back into Ingest (the world loops seamlessly)

   Figures are the synthetic demonstration company used across the
   Terminal (Corvane Pharma, 67 · A, confidence 89, 19 of 20 indicators
   evidenced). Pauses off-screen and on hover; honours
   prefers-reduced-motion (no auto-advance, stages shown complete).
   Exports window.CXJourney { mount(root) }.
   ════════════════════════════════════════════════════════════════════ */
window.CXJourney = (function () {
  'use strict';

  var STAGES = [
    { k: 'Ingest', t: 'Collect every disclosure', to: 'reports', cta: 'See the report repository',
      d: 'Sustainability, ESG, BRSR, net zero, climate and annual reports, plus information companies submit themselves, are gathered into one repository.' },
    { k: 'Assess', t: 'Check the evidence', to: 'company', cta: 'Open a company profile',
      d: 'Each data point is traced to its source and mapped to 20 indicators. Missing or untraceable information is recorded as a gap, not as poor performance.' },
    { k: 'Score', t: 'Explain the result', to: 'score', cta: 'See how the score works',
      d: 'An independent 0–100 score across five dimensions, reported with a separate measure of data confidence. Every point traces back to an indicator.' },
    { k: 'Enable', t: 'Deliver it to institutions', to: 'bank', cta: 'Open an institutional view',
      d: 'Banks, insurers, investors and government bodies each get a view built around their own questions.' },
    { k: 'Impact', t: 'Support better decisions', to: 'plans', cta: 'See access and plans',
      d: 'Institutions decide with the evidence in front of them, and companies see exactly which disclosures would strengthen their position.' }
  ];
  var N = STAGES.length, SEG = 7, LOOP = N * SEG, MOVE = 1.4;

  /* demonstration company — matches terminal-demo-data.js (Corvane Pharma, synthetic) */
  var DIMS = [['E', 'Environmental', 25, 67], ['S', 'Social', 15, 72], ['G', 'Governance', 20, 72], ['C', 'Climate strategy', 25, 59], ['D', 'Disclosure credibility', 15, 70]];
  var GAP = [3, 1]; /* c2 Scope 3 coverage: insufficient evidence */
  var DOCS = [
    ['Sustainability report', '#0E9F6E', 'Company website'], ['BRSR filing', '#0B1F3A', 'Stock exchange'],
    ['Net zero plan', '#0E9F6E', 'Press release'], ['Annual report', '#1D4FD8', '312 pages'],
    ['Climate report · TCFD', '#1D4FD8', 'Separate publication'], ['ESG data sheet', '#0B1F3A', 'Investor relations'],
    ['Company submission', '#B45309', 'Submitted directly']
  ];
  var INST = [['Banks', 'Lending assessment'], ['Insurers', 'Risk evaluation'], ['Investors', 'Portfolio review'], ['Government', 'Policy planning']];

  var C = { bg: '#FAF8F3', ink: '#0B1F3A', ink2: '#4A5B73', mute: '#7A8799', line: '#E3E7ED', card: '#FFFFFF', blue: '#1D4FD8', blueT: '#EAF0FD', green: '#0E9F6E', greenT: '#E6F5EF', amber: '#B45309', amberT: '#FDF3E7', grey: '#C9D1DC' };
  var FONT = '"Helvetica Neue",Helvetica,Arial,sans-serif';

  var CSS = '.cxj{position:relative;font-family:' + FONT + ';color:#0B1F3A;background:#fff;text-align:left}' +
    '.cxj *{box-sizing:border-box}' +
    '.cxj-stage{position:relative;height:clamp(270px,72vw,470px);background:' + C.bg + ';overflow:hidden;cursor:default}' +
    '.cxj canvas{position:absolute;inset:0;width:100%;height:100%;display:block}' +
    '.cxj-tag{position:absolute;right:16px;top:14px;font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#98A3B3;pointer-events:none}' +
    '.cxj-rail{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border-top:1px solid #E3E7ED}' +
    '.cxj-st{position:relative;display:block;width:100%;padding:14px 16px 12px;border:0;background:none;text-align:left;cursor:pointer;color:#7A8799;font:700 12px/1.2 ' + FONT + ';letter-spacing:.14em;text-transform:uppercase;transition:color .18s ease,background .18s ease}' +
    '.cxj-st:hover{background:#F6F7F9;color:#0B1F3A}' +
    '.cxj-st i{display:block;font-style:normal;font-size:11px;letter-spacing:.08em;margin-bottom:4px;color:#98A3B3}' +
    '.cxj-st u{position:absolute;left:0;right:0;top:-1px;height:2px;background:#1D4FD8;transform-origin:0 50%;transform:scaleX(0)}' +
    '.cxj-st[aria-current="true"]{color:#0B1F3A}.cxj-st[aria-current="true"] i{color:#1D4FD8}' +
    '.cxj-st.done u{transform:scaleX(1);opacity:.3}' +
    '.cxj-st:focus-visible,.cxj-detail a:focus-visible{outline:2px solid #1D4FD8;outline-offset:-2px}' +
    '.cxj-detail{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 24px;align-items:center;padding:18px 24px 24px;border-top:1px solid #E3E7ED;transition:opacity .2s ease}' +
    '.cxj-detail.swap{opacity:0}' +
    '.cxj-detail small{display:block;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#1D4FD8;margin-bottom:4px}' +
    '.cxj-detail h3{font-size:20px;line-height:1.25;margin:0 0 4px;font-weight:700;color:#0B1F3A}' +
    '.cxj-detail p{margin:0;font-size:14px;line-height:1.55;color:#4A5B73;max-width:760px}' +
    '.cxj-detail a{display:inline-flex;align-items:center;height:38px;padding:0 16px;border-radius:8px;border:1px solid #DCE1E8;color:#0B1F3A;text-decoration:none;font-size:14px;font-weight:500;white-space:nowrap;transition:background .18s ease,border-color .18s ease}' +
    '.cxj-detail a:hover{background:#F3F5F8;border-color:#1D4FD8}' +
    '@media (max-width:720px){.cxj-stage{height:400px}.cxj-st{padding:10px 6px 10px 8px;font-size:10px;letter-spacing:.08em}.cxj-detail{grid-template-columns:1fr;padding:16px}.cxj-tag{font-size:9px;right:10px;top:10px}}' +
    '@media (prefers-reduced-motion:reduce){.cxj-detail{transition:none}}';

  /* ── maths ───────────────────────────────────────────────────────── */
  function cl(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ease(x) { x = cl(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function out(x) { x = cl(x); return 1 - Math.pow(1 - x, 3); }
  function seg(t, a, b) { return cl((t - a) / (b - a)); }
  function lerp(a, b, p) { return a + (b - a) * p; }
  function frac(x) { return x - Math.floor(x); }
  function hash(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  /* ── drawing helpers ─────────────────────────────────────────────── */
  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function card(g, x, y, w, h, r, fill, stroke, lift) {
    g.save();
    if (lift) { g.shadowColor = 'rgba(11,31,58,' + (0.10 * lift) + ')'; g.shadowBlur = 28 * lift; g.shadowOffsetY = 10 * lift; }
    rr(g, x, y, w, h, r); g.fillStyle = fill || C.card; g.fill(); g.restore();
    if (stroke) { rr(g, x, y, w, h, r); g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); }
  }
  function txt(g, s, x, y, size, color, weight, align, track) {
    g.font = (weight || 400) + ' ' + size + 'px ' + FONT; g.fillStyle = color; g.textAlign = align || 'left'; g.textBaseline = 'alphabetic';
    if (track && 'letterSpacing' in g) { g.letterSpacing = track + 'px'; g.fillText(s, x, y); g.letterSpacing = '0px'; } else g.fillText(s, x, y);
  }
  function tick(g, x, y, s, color, p) {
    g.save(); g.strokeStyle = color; g.lineWidth = 1.8; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); var a = [x - s * 0.5, y], b = [x - s * 0.12, y + s * 0.38], c = [x + s * 0.55, y - s * 0.42];
    var l1 = 0.4, q = cl(p);
    g.moveTo(a[0], a[1]);
    if (q < l1) g.lineTo(lerp(a[0], b[0], q / l1), lerp(a[1], b[1], q / l1));
    else { g.lineTo(b[0], b[1]); g.lineTo(lerp(b[0], c[0], (q - l1) / (1 - l1)), lerp(b[1], c[1], (q - l1) / (1 - l1))); }
    g.stroke(); g.restore();
  }

  /* ── stage scenes. Local coordinates: origin = stage centre, design units.
        lt = seconds since the stage became active (negative = not reached yet);
        T  = global clock, for perpetual ambient motion. ─────────────── */
  function ingest(g, lt, T) {
    /* repository */
    var rx = 150, rw = 120, rh = 210;
    card(g, rx, -rh / 2, rw, rh, 14, C.card, C.line, 1);
    txt(g, 'REPOSITORY', rx + rw / 2, -rh / 2 + 26, 10, C.mute, 700, 'center', 1.6);
    for (var i = 0; i < 8; i++) {
      var on = frac(T * 0.35 + i * 0.37) < 0.5;
      rr(g, rx + 18, -rh / 2 + 44 + i * 17, rw - 36, 8, 4); g.fillStyle = on ? C.blueT : '#F1F3F6'; g.fill();
      rr(g, rx + 18, -rh / 2 + 44 + i * 17, (rw - 36) * (0.35 + 0.6 * hash(i + 3)), 8, 4); g.fillStyle = on ? 'rgba(29,79,216,.55)' : C.grey; g.fill();
    }
    txt(g, 'One structured record', rx + rw / 2, rh / 2 - 18, 11, C.ink2, 500, 'center');
    /* intake mouth */
    g.save(); g.strokeStyle = 'rgba(29,79,216,.25)'; g.setLineDash([3, 5]); g.lineDashOffset = -T * 24;
    g.beginPath(); g.moveTo(rx - 34, -70); g.quadraticCurveTo(rx - 6, 0, rx - 34, 70); g.stroke(); g.restore();
    /* drifting disclosures — a perpetual conveyor in depth */
    var items = [];
    for (var k = 0; k < 11; k++) {
      var d = DOCS[k % DOCS.length], u = frac(T * 0.075 + k / 11);
      var z = 0.55 + 0.45 * hash(k + 11), sy = (hash(k + 29) - 0.5) * 300, sx = -330 + hash(k + 41) * 60;
      var pu = ease(u);
      var x = lerp(sx, rx - 50, pu), y = lerp(sy, (hash(k) - 0.5) * 40, ease(seg(u, 0.25, 1)));
      y += Math.sin(T * 0.8 + k) * 6 * (1 - u);
      var sc = lerp(z, 0.32, ease(seg(u, 0.55, 1)));
      var a = Math.min(seg(u, 0, 0.12), 1 - seg(u, 0.86, 1));
      items.push({ d: d, x: x, y: y, s: sc, a: a, r: (hash(k + 5) - 0.5) * 0.16 * (1 - u) });
    }
    items.sort(function (p, q) { return p.s - q.s; });
    items.forEach(function (it) {
      if (it.a <= 0.01) return;
      g.save(); g.globalAlpha *= it.a; g.translate(it.x, it.y); g.rotate(it.r); g.scale(it.s, it.s);
      var w = 150, h = 100;
      card(g, -w / 2, -h / 2, w, h, 8, C.card, C.line, it.s);
      g.fillStyle = it.d[1]; g.fillRect(-w / 2, -h / 2 + 0.5, w, 5);
      txt(g, it.d[0], -w / 2 + 12, -h / 2 + 26, 12, C.ink, 700);
      for (var j = 0; j < 3; j++) { rr(g, -w / 2 + 12, -h / 2 + 38 + j * 11, (w - 24) * (0.55 + 0.4 * hash(j + it.d[0].length)), 4, 2); g.fillStyle = '#E8EBF0'; g.fill(); }
      txt(g, it.d[2], -w / 2 + 12, h / 2 - 12, 10, C.mute, 500);
      g.restore();
    });
  }

  function assess(g, lt, T) {
    var cw = 74, ch = 44, gx = 8, gy = 10, x0 = -110, y0 = -150;
    var beam = lerp(x0 - 20, x0 + 4 * (cw + gx) + 10, ease(seg(lt, 0.4, 3.6)));
    var evid = 0, gaps = 0;
    DIMS.forEach(function (dm, r) {
      var y = y0 + r * (ch + gy);
      txt(g, dm[0], x0 - 150, y + ch / 2 + 6, 15, C.ink, 700);
      txt(g, dm[1], x0 - 128, y + ch / 2 + 5, 12, C.ink2, 500);
      for (var c = 0; c < 4; c++) {
        var x = x0 + c * (cw + gx), done = beam > x + cw * 0.6, p = done ? out(seg(beam - x - cw * 0.6, 0, 40)) : 0;
        var gap = r === GAP[0] && c === GAP[1];
        if (done) { if (gap) gaps++; else evid++; }
        if (!done) { card(g, x, y, cw, ch, 8, '#F4F5F7', null, 0); txt(g, dm[0].toLowerCase() + (c + 1), x + 10, y + 18, 10, '#A7B0BD', 600); continue; }
        if (gap) {
          card(g, x, y, cw, ch, 8, C.amberT, null, 0);
          g.save(); g.setLineDash([4, 3]); rr(g, x + 0.5, y + 0.5, cw - 1, ch - 1, 8); g.strokeStyle = C.amber; g.globalAlpha *= p; g.stroke(); g.restore();
          txt(g, 'c2', x + 10, y + 18, 10, C.amber, 700);
          txt(g, 'Gap', x + 10, y + 34, 11, C.amber, 700);
        } else {
          card(g, x, y, cw, ch, 8, C.blueT, null, 0);
          txt(g, dm[0].toLowerCase() + (c + 1), x + 10, y + 18, 10, C.blue, 700);
          tick(g, x + cw - 18, y + 16, 12, C.blue, p);
          rr(g, x + 10, y + 28, (cw - 20) * p * (0.5 + 0.45 * hash(r * 4 + c)), 5, 2.5); g.fillStyle = 'rgba(29,79,216,.5)'; g.fill();
        }
      }
    });
    /* scan beam */
    if (lt > 0.3 && lt < 4.2) {
      var a = Math.min(seg(lt, 0.3, 0.7), 1 - seg(lt, 3.6, 4.2));
      var gr = g.createLinearGradient(beam - 46, 0, beam + 4, 0);
      gr.addColorStop(0, 'rgba(29,79,216,0)'); gr.addColorStop(1, 'rgba(29,79,216,' + 0.16 * a + ')');
      g.fillStyle = gr; g.fillRect(beam - 46, y0 - 14, 50, 5 * (ch + gy) + 18);
      g.fillStyle = 'rgba(29,79,216,' + 0.9 * a + ')'; g.fillRect(beam, y0 - 14, 2, 5 * (ch + gy) + 18);
    }
    /* tally */
    var ty = y0 + 5 * (ch + gy) + 26;
    txt(g, String(evid), x0 - 150, ty, 22, C.blue, 700);
    txt(g, 'evidenced', x0 - 150 + (evid > 9 ? 30 : 18), ty, 12, C.ink2, 500);
    txt(g, String(gaps), x0 + 30, ty, 22, C.amber, 700);
    txt(g, 'insufficient evidence — recorded as a gap, not a zero', x0 + 48, ty, 12, C.ink2, 500);
  }

  function score(g, lt, T) {
    var bx = 0, bw = 290, by = -120, rowH = 30;
    var grow = ease(seg(lt, 0.3, 2.0)), merge = ease(seg(lt, 2.4, 4.0)), conf = out(seg(lt, 4.3, 5.4));
    txt(g, 'WEIGHTED DIMENSIONS', bx, by - 26, 10, C.mute, 700, 'left', 1.6);
    var acc = 0, total = 0;
    DIMS.forEach(function (dm, i) {
      var y = by + i * rowH, contrib = dm[3] * dm[2] / 100;
      g.globalAlpha = 1 - merge * 0.75;
      txt(g, dm[1], bx, y + 13, 12, C.ink2, 500);
      txt(g, dm[2] + '%', bx + 146, y + 13, 11, C.mute, 600, 'right');
      rr(g, bx + 156, y + 4, bw - 156, 10, 5); g.fillStyle = '#EEF1F5'; g.fill();
      rr(g, bx + 156, y + 4, (bw - 156) * dm[3] / 100 * grow, 10, 5); g.fillStyle = 'rgba(29,79,216,.35)'; g.fill();
      txt(g, String(Math.round(dm[3] * grow)), bx + bw + 30, y + 13, 12, C.ink, 700, 'right');
      g.globalAlpha = 1;
      /* contribution segment flying into the composite bar */
      var p = ease(seg(merge, i * 0.12, i * 0.12 + 0.52));
      var sx = lerp(bx + 156, bx + acc / 100 * bw, p), sy = lerp(y + 4, by + 5 * rowH + 34, p);
      var sw = lerp((bw - 156) * dm[3] / 100 * grow, contrib / 100 * bw - 2, p);
      if (grow > 0) { rr(g, sx, sy, Math.max(2, sw), lerp(10, 16, p), lerp(5, 3, p)); g.fillStyle = p > 0 ? 'rgba(29,79,216,' + lerp(0.35, 0.45 + i * 0.11, p) + ')' : 'rgba(0,0,0,0)'; g.fill(); }
      if (p >= 1) total += contrib;
      else if (p > 0) total += contrib * p;
      acc += contrib;
    });
    /* composite bar */
    var cy = by + 5 * rowH + 34;
    g.save(); g.globalAlpha = merge; txt(g, 'WEIGHTED TOTAL', bx, cy - 10, 10, C.mute, 700, 'left', 1.6); rr(g, bx, cy, bw, 16, 3); g.strokeStyle = C.line; g.stroke();
    for (var q = 0; q <= 100; q += 25) { txt(g, String(q), bx + q / 100 * bw, cy + 32, 10, C.mute, 500, 'center'); }
    g.restore();
    /* the score */
    var v = Math.round(total), sxp = -300;
    txt(g, 'CLIMACTIX SCORE', sxp, -100, 10, C.mute, 700, 'left', 1.6);
    txt(g, String(v), sxp - 4, 0, 104, C.ink, 700, 'left', -3);
    g.save(); g.globalAlpha *= seg(lt, 3.9, 4.3);
    card(g, sxp + 2, 18, 46, 30, 8, C.blue, null, 0); txt(g, 'A', sxp + 25, 39, 17, '#fff', 700, 'center');
    txt(g, 'out of 100', sxp + 60, 38, 12, C.ink2, 500);
    g.restore();
    /* confidence, separate */
    var fy = 92;
    txt(g, 'DATA CONFIDENCE', sxp, fy, 10, C.mute, 700, 'left', 1.4);
    rr(g, sxp, fy + 12, 180, 6, 3); g.fillStyle = '#EEF1F5'; g.fill();
    rr(g, sxp, fy + 12, 180 * 0.89 * conf, 6, 3); g.fillStyle = C.green; g.fill();
    txt(g, String(Math.round(89 * conf)), sxp + 192, fy + 19, 13, C.ink, 700);
    txt(g, 'Reported separately from the score', sxp, fy + 42, 11, C.mute, 500);
    txt(g, 'Corvane Pharma · synthetic company', sxp, fy + 60, 11, C.mute, 500);
  }

  function enable(g, lt, T) {
    var ox = -230, ys = [-138, -46, 46, 138], ix = 70, iw = 200, ih = 74;
    /* source token */
    card(g, ox - 85, -38, 170, 76, 12, C.card, C.line, 1);
    txt(g, 'CORVANE · SYNTHETIC', ox - 70, -14, 9, C.mute, 700, 'left', 1.2);
    txt(g, '67', ox - 70, 22, 32, C.ink, 700, 'left', -1);
    card(g, ox - 8, 0, 30, 22, 6, C.blue, null, 0); txt(g, 'A', ox + 7, 16, 13, '#fff', 700, 'center');
    ys.forEach(function (y, i) {
      var on = out(seg(lt, 0.5 + i * 0.45, 1.3 + i * 0.45));
      var x1 = ox + 85, x2 = ix - 6;
      /* strand */
      g.save(); g.strokeStyle = 'rgba(29,79,216,' + (0.12 + 0.18 * on) + ')'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x1, 0); g.bezierCurveTo(x1 + 110, 0, x2 - 110, y, x2, y); g.stroke();
      if (on > 0) {
        g.strokeStyle = 'rgba(29,79,216,.75)'; g.setLineDash([18, 140]); g.lineDashOffset = -(T * 90 + i * 37);
        g.beginPath(); g.moveTo(x1, 0); g.bezierCurveTo(x1 + 110, 0, x2 - 110, y, x2, y); g.stroke();
      }
      g.restore();
      /* institutional view */
      g.save(); g.globalAlpha *= 0.35 + 0.65 * on;
      card(g, ix, y - ih / 2, iw, ih, 10, C.card, on > 0.5 ? 'rgba(29,79,216,.35)' : C.line, on);
      txt(g, INST[i][0].toUpperCase(), ix + 14, y - ih / 2 + 22, 10, C.blue, 700, 'left', 1.4);
      txt(g, INST[i][1], ix + 14, y - ih / 2 + 42, 14, C.ink, 700);
      var mx = ix + 14, my = y + ih / 2 - 18, mw = iw - 28;
      if (i === 0) { rr(g, mx, my, mw, 6, 3); g.fillStyle = C.amberT; g.fill(); rr(g, mx, my, mw * 0.95 * on, 6, 3); g.fillStyle = 'rgba(29,79,216,.55)'; g.fill(); }
      if (i === 1) { for (var b = 0; b < 8; b++) { var h = 6 + 12 * hash(b + 7); g.fillStyle = b === 5 ? 'rgba(180,83,9,.6)' : 'rgba(29,79,216,.35)'; g.fillRect(mx + b * 14, my + 6 - h * on, 9, h * on); } }
      if (i === 2) { g.strokeStyle = C.blue; g.lineWidth = 1.5; g.beginPath(); for (var s = 0; s <= 12; s++) { var px = mx + s / 12 * mw * on, py = my + 2 - (s * 0.6 + 4 * Math.sin(s * 1.3)) ; if (s) g.lineTo(px, py); else g.moveTo(px, py); } g.stroke(); }
      if (i === 3) { for (var dI = 0; dI < 16; dI++) { g.beginPath(); g.arc(mx + 4 + dI * 11, my + 2, 3.2, 0, Math.PI * 2); g.fillStyle = hash(dI + 3) < 0.7 * on ? 'rgba(29,79,216,.55)' : '#DDE2E9'; g.fill(); } }
      g.restore();
    });
  }

  function impact(g, lt, T) {
    var rows = [
      ['INSTITUTIONS', 'Decide with the evidence in view', C.green, C.greenT],
      ['COMPANY', 'Sees which disclosure would strengthen it', C.amber, C.amberT],
      ['NEXT CYCLE', 'New disclosures re-enter the repository', C.blue, C.blueT]
    ];
    var x = -270, w = 350, h = 78;
    rows.forEach(function (r, i) {
      var p = out(seg(lt, 0.4 + i * 0.7, 1.2 + i * 0.7)), y = -140 + i * 98 + (1 - p) * 18;
      g.save(); g.globalAlpha *= p;
      card(g, x, y, w, h, 12, C.card, C.line, p);
      g.fillStyle = r[3]; g.beginPath(); g.arc(x + 36, y + h / 2, 18, 0, Math.PI * 2); g.fill();
      tick(g, x + 36, y + h / 2, 14, r[2], seg(lt, 0.8 + i * 0.7, 1.4 + i * 0.7));
      txt(g, r[0], x + 68, y + 30, 10, r[2], 700, 'left', 1.4);
      txt(g, r[1], x + 68, y + 52, 14, C.ink, 700);
      g.restore();
    });
    /* gap chip from Assess, carried through */
    var cp = out(seg(lt, 1.6, 2.4));
    g.save(); g.globalAlpha *= cp;
    card(g, x + w + 26, -140 + 98 + 22, 168, 34, 17, C.amberT, null, 0);
    txt(g, 'c2 · Scope 3 coverage', x + w + 42, -140 + 98 + 44, 12, C.amber, 700);
    g.restore();
    /* loop arrow toward the next Ingest */
    var lp = ease(seg(lt, 2.6, 4.2));
    if (lp > 0) {
      var ax = x + w, ay = -140 + 2 * 98 + h / 2;
      g.save(); g.strokeStyle = C.blue; g.lineWidth = 1.6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + 190 * lp, ay); g.stroke();
      if (lp > 0.95) { g.beginPath(); g.moveTo(ax + 182, ay - 6); g.lineTo(ax + 190, ay); g.lineTo(ax + 182, ay + 6); g.stroke(); }
      g.restore();
      txt(g, 'loops to Ingest', ax + 20, ay - 10, 11, C.mute, 500);
    }
  }
  var SCENES = [ingest, assess, score, enable, impact];

  /* ── component ───────────────────────────────────────────────────── */
  var styled = false;
  function create(el) {
    el.setAttribute('data-cxj-on', '');
    if (!styled) { styled = true; var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }
    var site = el.getAttribute('data-links') !== 'terminal';
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.innerHTML = '<div class="cxj"><div class="cxj-stage"><canvas role="img" aria-label="Animated pathway: disclosures are collected, checked against 20 indicators, scored, delivered to institutions and support decisions. Demonstration data."></canvas><span class="cxj-tag">Demonstration data · illustrative</span></div>' +
      '<ol class="cxj-rail" aria-label="Terminal pathway stages">' + STAGES.map(function (s, i) {
        return '<li><button type="button" class="cxj-st" data-i="' + i + '"><u></u><i>0' + (i + 1) + '</i>' + s.k + '</button></li>';
      }).join('') + '</ol><div class="cxj-detail" aria-live="polite"></div></div>';
    var stage = el.querySelector('.cxj-stage'), cv = el.querySelector('canvas'), g = cv.getContext('2d');
    var btns = el.querySelectorAll('.cxj-st'), detail = el.querySelector('.cxj-detail');
    var W = 0, H = 0, dpr = 1, t = reduced ? SEG - MOVE - 0.01 : 0, cam = 0, camS = 0, cur = -1, visible = false, hover = false, raf = 0, last = 0;

    function size() {
      var r = stage.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    function target(tt) { var k = Math.floor(tt / SEG), lt = tt - k * SEG; return k + ease(seg(lt, SEG - MOVE, SEG)); }
    function setDetail(k) {
      var s = STAGES[k];
      detail.classList.add('swap');
      setTimeout(function () {
        detail.innerHTML = '<div><small>0' + (k + 1) + ' · ' + s.k + '</small><h3>' + s.t + '</h3><p>' + s.d + '</p></div>' +
          '<a href="' + (site ? 'terminal-walkthrough.html' : '') + '#/' + s.to + '">' + s.cta + ' →</a>';
        detail.classList.remove('swap');
      }, cur === -1 ? 0 : 180);
    }
    function rail() {
      var k = Math.round(camS) % N; if (k < 0) k += N;
      if (k !== cur) {
        setDetail(k); cur = k;
        Array.prototype.forEach.call(btns, function (b, i) {
          if (i === k) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
          b.classList.toggle('done', i < k); if (i !== k) b.firstChild.style.transform = '';
        });
      }
      var lt = t - k * SEG; if (lt < 0) lt += LOOP;
      btns[k].firstChild.style.transform = 'scaleX(' + (reduced ? 1 : cl(lt / SEG)).toFixed(3) + ')';
    }

    function backdrop(s, ox) {
      g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
      /* topographic contours, slow parallax */
      g.save(); g.strokeStyle = 'rgba(11,31,58,0.055)'; g.lineWidth = 1;
      var px = ox * 0.35;
      for (var i = 0; i < 9; i++) {
        var base = H * (0.12 + i * 0.1);
        g.beginPath();
        for (var x = -10; x <= W + 10; x += 14) {
          var wx = (x + px) / 140;
          var y = base + Math.sin(wx + i * 0.9) * 14 + Math.sin(wx * 0.43 + i * 1.7 + t * 0.05) * 22;
          if (x < 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();
      }
      g.restore();
      /* fine dot grid, mid parallax */
      g.fillStyle = 'rgba(11,31,58,0.07)';
      var step = 26, offx = -((ox * 0.6) % step);
      for (var gx = offx; gx < W; gx += step) for (var gy = 13; gy < H; gy += step) g.fillRect(gx, gy, 1.2, 1.2);
    }

    function draw() {
      var narrow = W < 720, s = narrow ? H / 450 : Math.min(H / 450, W / 640), D = Math.max(W / s * 0.64, 700);
      var ox = camS * D * s;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      backdrop(s, ox);
      var span = (W / s / 2) / D + 1, a = Math.floor(camS - span), b = Math.ceil(camS + span);
      for (var idx = a; idx <= b; idx++) {
        var k = ((idx % N) + N) % N, lt = t - idx * SEG;
        var f = cl(1 - Math.abs(idx - camS) * 1.25), cx = W / 2 + (idx - camS) * D * s, cy = H / 2 + 8 * s;
        /* narrow screens: the scene is wider than the view, so the camera tracks across it */
        if (narrow) { var ov = Math.max(0, 650 * s - W + 32); var pp = ease(seg(reduced ? 0 : lt, 0.4, SEG - MOVE - 0.3)); if (k === 2) pp = 1 - pp; /* Score builds right to left */ cx += ov / 2 - ov * pp; }
        /* strands to the next stage */
        if (idx < b) {
          var nx = cx + D * s, green = k >= 3;
          g.save(); g.translate(0, cy); g.lineWidth = 1;
          for (var j = 0; j < 4; j++) {
            var off = (j - 1.5) * 9 * s, x1 = cx + 285 * s, x2 = nx - 290 * s;
            if (x2 <= x1) continue;
            g.strokeStyle = green ? 'rgba(14,159,110,.16)' : 'rgba(29,79,216,.14)'; g.setLineDash([]);
            g.beginPath(); g.moveTo(x1, off * 0.3); g.bezierCurveTo(x1 + (x2 - x1) * 0.35, off * 1.6 - 34 * s, x1 + (x2 - x1) * 0.65, off * 1.6 + 34 * s, x2, off * 0.3); g.stroke();
            g.strokeStyle = green ? 'rgba(14,159,110,.7)' : 'rgba(29,79,216,.65)'; g.setLineDash([22 * s, 160 * s]); g.lineDashOffset = -(t * 120 + j * 47) * s;
            g.beginPath(); g.moveTo(x1, off * 0.3); g.bezierCurveTo(x1 + (x2 - x1) * 0.35, off * 1.6 - 34 * s, x1 + (x2 - x1) * 0.65, off * 1.6 + 34 * s, x2, off * 0.3); g.stroke();
          }
          g.restore();
        }
        if (cx < -400 * s || cx > W + 400 * s) continue;
        g.save();
        g.globalAlpha = 0.07 + 0.93 * f * f;
        /* huge background numeral, deeper parallax */
        g.save(); g.globalAlpha *= 0.07; txt(g, '0' + (k + 1), cx - 300 * s + (camS - idx) * 60 * s, cy + 190 * s, 230 * s, C.ink, 700, 'left', -10); g.restore();
        var zs = s * (0.94 + 0.06 * f);
        g.translate(cx, cy); g.scale(zs, zs);
        txt(g, '0' + (k + 1) + '  ' + STAGES[k].k.toUpperCase(), -280, -196, 11, f > 0.5 ? C.blue : C.mute, 700, 'left', 2);
        SCENES[k](g, reduced ? (lt < 0 ? lt : Math.max(lt, SEG - MOVE - 0.01)) : lt, t);
        g.restore();
      }
    }

    function frame(now) {
      raf = 0;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
      if (!reduced && !hover) {
        t += dt;
        if (t >= LOOP) { t -= LOOP; camS -= N; }
      }
      cam = target(t);
      camS += (cam - camS) * Math.min(1, dt * 7 || 1);
      if (Math.abs(cam - camS) < 0.0005) camS = cam;
      draw(); rail();
      if (visible) raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }

    el.addEventListener('click', function (e) {
      var bt = e.target.closest('.cxj-st'); if (!bt) return;
      var i = +bt.getAttribute('data-i');
      var nt = i * SEG + (reduced ? SEG - MOVE - 0.01 : 0.01);
      /* travel the short way round the loop */
      var d = i - Math.round(camS); if (d > N / 2) camS += N; else if (d < -N / 2) camS -= N;
      t = nt;
      if (reduced) camS = target(t);
      start();
    });
    stage.addEventListener('mouseenter', function () { hover = true; });
    stage.addEventListener('mouseleave', function () { hover = false; });

    size();
    if ('ResizeObserver' in window) new ResizeObserver(function () { size(); if (!raf) { draw(); } }).observe(stage);
    else window.addEventListener('resize', function () { size(); draw(); });
    camS = target(t);
    draw(); rail();
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[en.length - 1].isIntersecting; if (visible) start(); }, { threshold: 0.15 }).observe(el);
    } else { visible = true; start(); }
    document.addEventListener('visibilitychange', function () { if (!document.hidden && visible) start(); });
  }

  function mount(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('[data-cx-journey]:not([data-cxj-on])'), create);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mount(); }); else mount();
  return { mount: mount };
})();
