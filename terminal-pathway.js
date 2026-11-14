/* ════════════════════════════════════════════════════════════════════
   CLIMACTIX TERMINAL PATHWAY — INGEST → ASSESS → SCORE → ENABLE → IMPACT
   A self-contained, animated system diagram. Drop
       <div data-cx-pathway data-links="site|terminal"></div>
   anywhere; this file injects its own styles and mounts itself.

   What the motion shows: scattered grey fragments (unstructured
   disclosures) enter at INGEST, tighten into ordered lanes through
   ASSESS, become one stream at SCORE, fan out to four institutional
   lanes at ENABLE and resolve at IMPACT. Colour follows the terminal's
   semantics: grey = unstructured, blue = intelligence, emerald = outcome.

   Exports window.CXPathway { mount(root) }. Pauses off-screen, honours
   prefers-reduced-motion (static frame, no auto-advance).
   ════════════════════════════════════════════════════════════════════ */
window.CXPathway = (function () {
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

  var CSS = '.cxp{position:relative;background:#070B14;color:#F4F6F8;border-radius:8px;overflow:hidden;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;text-align:left}' +
    '.cxp *{box-sizing:border-box}' +
    '.cxp-stage{position:relative;height:200px}' +
    '.cxp canvas{position:absolute;inset:0;width:100%;height:100%;display:block}' +
    '.cxp-nodes{list-style:none;margin:0;padding:0}' +
    '.cxp-node{position:absolute;width:56px;height:56px;margin:-28px 0 0 -28px;border:0;background:none;border-radius:50%;cursor:pointer;color:inherit;padding:0}' +
    '.cxp-node:focus-visible{outline:2px solid #7DB4FF;outline-offset:2px}' +
    '.cxp-node i{position:absolute;left:50%;top:-18px;transform:translateX(-50%);font-style:normal;font-size:11px;font-weight:700;color:#6F7E96;letter-spacing:.08em;transition:color .2s ease}' +
    '.cxp-node b{position:absolute;left:50%;top:62px;transform:translateX(-50%);font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#8090A8;white-space:nowrap;transition:color .2s ease}' +
    '.cxp-node:hover b,.cxp-node[aria-pressed="true"] b{color:#F4F6F8}.cxp-node[aria-pressed="true"] i{color:#7DB4FF}' +
    '.cxp-detail{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 24px;align-items:center;padding:16px 24px 24px;border-top:1px solid #18233A;transition:opacity .2s ease}' +
    '.cxp-detail.swap{opacity:0}' +
    '.cxp-detail small{display:block;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#7DB4FF;margin-bottom:4px}' +
    '.cxp-detail h3{font-size:20px;line-height:1.25;margin:0 0 4px;font-weight:700;color:#F4F6F8}' +
    '.cxp-detail p{margin:0;font-size:14px;line-height:1.55;color:#B6C0D2;max-width:760px}' +
    '.cxp-detail a{display:inline-flex;align-items:center;height:36px;padding:0 16px;border-radius:8px;border:1px solid #223049;color:#F4F6F8;text-decoration:none;font-size:14px;font-weight:500;white-space:nowrap;transition:background .18s ease,border-color .18s ease}' +
    '.cxp-detail a:hover{background:#141D30;border-color:#5B93F0}' +
    '.cxp.v .cxp-stage{height:440px}.cxp.v .cxp-node b{left:64px;top:19px;transform:none}.cxp.v .cxp-node i{left:-2px;top:20px;transform:none;display:none}' +
    '.cxp.v .cxp-detail{grid-template-columns:1fr;padding:16px}' +
    '.cxp.light{background:#FFFFFF;color:#0B1F3A}.cxp.light .cxp-node b{color:#7A8799}.cxp.light .cxp-node i{color:#98A3B3}' +
    '.cxp.light .cxp-node:hover b,.cxp.light .cxp-node[aria-pressed="true"] b{color:#0B1F3A}.cxp.light .cxp-node[aria-pressed="true"] i{color:#1D4FD8}' +
    '.cxp.light .cxp-detail{border-top-color:#E3E7ED}.cxp.light .cxp-detail small{color:#1D4FD8}.cxp.light .cxp-detail h3{color:#0B1F3A}.cxp.light .cxp-detail p{color:#4A5B73}' +
    '.cxp.light .cxp-detail a{border-color:#DCE1E8;color:#0B1F3A}.cxp.light .cxp-detail a:hover{background:#F3F5F8;border-color:#1D4FD8}' +
    '.cxp.light .cxp-node:focus-visible{outline-color:#1D4FD8}' +
    '@media (prefers-reduced-motion:reduce){.cxp-detail{transition:none}}';

  var styled = false;
  function style() {
    if (styled) return; styled = true;
    var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
  }
  function smooth(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }
  function lerp(a, b, p) { return a + (b - a) * p; }

  function create(el) {
    el.setAttribute('data-cxp-on', '');
    el.classList.add('cxp');
    var site = el.getAttribute('data-links') !== 'terminal';
    var light = el.getAttribute('data-tone') === 'light' || (!el.hasAttribute('data-tone') && document.documentElement.getAttribute('data-theme') === 'light');
    el.classList.toggle('light', light);
    var K = light ? { bg: '#FFFFFF', spine: 'rgba(11,31,58,0.14)', prog: 'rgba(29,79,216,0.55)', grey: '122,135,153', blue: '29,79,216', hi: '29,79,216', green: '14,159,110', on: '#1D4FD8', done: '#1D4FD8', idle: '#C9D1DC', core: '#1D4FD8', pulse: '29,79,216' }
                  : { bg: '#070B14', spine: 'rgba(128,144,168,0.16)', prog: 'rgba(91,147,240,0.5)', grey: '128,144,168', blue: '91,147,240', hi: '125,180,255', green: '16,185,129', on: '#7DB4FF', done: '#5B93F0', idle: '#3A4A66', core: '#F4F6F8', pulse: '125,180,255' };
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.innerHTML = '<div class="cxp-stage"><canvas aria-hidden="true"></canvas><ol class="cxp-nodes" aria-label="Terminal pathway stages">' +
      STAGES.map(function (s, i) { return '<li><button type="button" class="cxp-node" data-i="' + i + '" aria-pressed="false"><i>0' + (i + 1) + '</i><b>' + s.k + '</b></button></li>'; }).join('') +
      '</ol></div><div class="cxp-detail" aria-live="polite"></div>';
    var stage = el.querySelector('.cxp-stage'), cv = el.querySelector('canvas'), g = cv.getContext('2d');
    var nodes = el.querySelectorAll('.cxp-node'), detail = el.querySelector('.cxp-detail');
    var W = 0, H = 0, vert = false, pts = [], active = -1, hold = 0, visible = true, raf = 0, lastAuto = 0;

    /* deterministic particles */
    var P = [], seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var j = 0; j < 110; j++) P.push({ ph: rnd(), r: rnd() * 2 - 1, sp: 0.8 + rnd() * 0.4, sz: 1.4 + rnd() * 1.2, lane: j % 4, w: rnd() * 6.28 });

    function layout() {
      var r = stage.getBoundingClientRect();
      vert = el.getBoundingClientRect().width < 640;
      el.classList.toggle('v', vert);
      r = stage.getBoundingClientRect();
      W = r.width; H = r.height;
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      pts = STAGES.map(function (_, i) {
        return vert ? { x: 44, y: 52 + (H - 104) * i / 4 } : { x: W * 0.14 + W * 0.72 * i / 4, y: H * 0.46 };
      });
      Array.prototype.forEach.call(nodes, function (n, i) { n.style.left = pts[i].x + 'px'; n.style.top = pts[i].y + 'px'; });
      if (reduced) draw(10000);
    }

    function setActive(i, user) {
      if (i === active) return;
      active = i;
      Array.prototype.forEach.call(nodes, function (n, k) { n.setAttribute('aria-pressed', String(k === i)); });
      var s = STAGES[i];
      detail.classList.add('swap');
      setTimeout(function () {
        detail.innerHTML = '<div><small>0' + (i + 1) + ' · ' + s.k + '</small><h3>' + s.t + '</h3><p>' + s.d + '</p></div>' +
          '<a href="' + (site ? 'terminal-walkthrough.html' : '') + '#/' + s.to + '">' + s.cta + ' →</a>';
        detail.classList.remove('swap');
      }, user === 'init' || reduced ? 0 : 180);
      if (reduced) draw(10000);
    }

    /* position on the pathway for u in [-0.14, 1.08]; lateral offset d */
    function at(u, d) {
      var a = pts[0], b = pts[4];
      return vert ? { x: a.x + d * 0.42, y: lerp(a.y, b.y, u) } : { x: lerp(a.x, b.x, u), y: a.y + d };
    }

    function draw(ms) {
      var t = ms / 1000, i;
      g.clearRect(0, 0, W, H);
      /* spine */
      var a = at(-0.14, 0), b = at(1.08, 0);
      g.strokeStyle = K.spine; g.lineWidth = 1; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      if (active >= 0) {
        g.strokeStyle = K.prog; g.lineWidth = 1.5; g.beginPath(); g.moveTo(pts[0].x, pts[0].y); g.lineTo(pts[active].x, pts[active].y); g.stroke();
      }
      /* particles */
      for (i = 0; i < P.length; i++) {
        var p = P[i], u = ((t * 0.045 * p.sp + p.ph) % 1.22) - 0.14, d, col, al = 0.85, sz = p.sz;
        var wob = Math.sin(t * 1.3 + p.w) * 2;
        if (u < 0) { var e = (u + 0.14) / 0.14; d = p.r * lerp(78, 16, smooth(e)) + wob * 2; col = K.grey; al = 0.25 + 0.45 * e; }
        else if (u < 0.25) { d = lerp(p.r * 16 + wob, (p.lane % 3 - 1) * 9, smooth(u / 0.25)); col = K.blue; al = 0.7; }
        else if (u < 0.5) { d = lerp((p.lane % 3 - 1) * 9, 0, smooth((u - 0.25) / 0.25)); col = K.blue; }
        else if (u < 0.75) { d = 0; col = K.hi; sz = p.sz + 0.5; al = 0.95; }
        else if (u < 1) { var f = (u - 0.75) / 0.25; d = (p.lane - 1.5) * 13 * Math.sin(Math.PI * f); col = f > 0.55 ? K.green : K.hi; }
        else { d = 0; col = K.green; al = 0.85 * (1 - (u - 1) / 0.08); }
        var q = at(u, d);
        g.fillStyle = 'rgba(' + col + ',' + Math.max(0, al).toFixed(3) + ')';
        if (u < 0) g.fillRect(q.x - 1.5, q.y - 2, 3, 4); else { g.beginPath(); g.arc(q.x, q.y, sz, 0, 6.283); g.fill(); }
      }
      /* connection points */
      for (i = 0; i < pts.length; i++) {
        var on = i === active, n = pts[i];
        if (on && !reduced) {
          var ph = (t % 1.8) / 1.8;
          g.strokeStyle = 'rgba(' + K.pulse + ',' + (0.5 * (1 - ph)).toFixed(3) + ')'; g.lineWidth = 1.5;
          g.beginPath(); g.arc(n.x, n.y, 10 + ph * 16, 0, 6.283); g.stroke();
        }
        g.fillStyle = K.bg; g.beginPath(); g.arc(n.x, n.y, on ? 10 : 7, 0, 6.283); g.fill();
        g.strokeStyle = on ? K.on : i < active ? K.done : K.idle; g.lineWidth = on ? 2.5 : 1.5; g.stroke();
        if (on || i < active) { g.fillStyle = on ? K.core : K.done; g.beginPath(); g.arc(n.x, n.y, on ? 4 : 2.5, 0, 6.283); g.fill(); }
      }
    }

    function frame(ms) {
      if (!el.isConnected) { cancelAnimationFrame(raf); window.removeEventListener('resize', layout); return; }
      if (visible && !document.hidden) {
        if (ms - lastAuto > 3800 && ms > hold) { lastAuto = ms; setActive((active + 1) % STAGES.length); }
        draw(ms);
      }
      raf = requestAnimationFrame(frame);
    }

    el.addEventListener('click', function (e) {
      var n = e.target.closest('.cxp-node'); if (!n) return;
      setActive(+n.getAttribute('data-i'), 'user'); hold = performance.now() + 14000; lastAuto = performance.now();
    });
    el.addEventListener('mouseenter', function () { hold = Math.max(hold, performance.now() + 6000); });
    el.addEventListener('mousemove', function () { hold = Math.max(hold, performance.now() + 4000); });
    window.addEventListener('resize', layout);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[en.length - 1].isIntersecting; }, { threshold: 0.05 }).observe(el);

    layout();
    setActive(0, 'init');
    draw(0);                                             // paint once even if the diagram starts off-screen
    if (reduced) draw(10000); else raf = requestAnimationFrame(function (ms) { lastAuto = ms; frame(ms); });
  }

  function mount(root) {
    var list = (root || document).querySelectorAll('[data-cx-pathway]:not([data-cxp-on])');
    if (!list.length) return;
    style();
    Array.prototype.forEach.call(list, create);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mount(); }); else mount();
  return { mount: mount, stages: STAGES };
})();
