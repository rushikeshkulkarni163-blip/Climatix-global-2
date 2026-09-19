/**
 * frics-story.js — the FRICS™ marketplace film (18 s).
 *
 *   01 discovery · 02 marketplace · 03 project selection · 04 buy FRICS · 05 acquisition
 *   06 capital allocation · 07 project deployment · 08 food chain · 09 impact · 10 lifecycle
 *
 * FRICS is a standalone marketplace: any eligible company explores resilience projects, selects a
 * project, buys FRICS and allocates capital to resilience action. Nothing in the film depends on a
 * Green Rating, and nothing in it is a real project, place or result.
 *
 * Single clock, pure frame(t): canvas layers come from frics-paint.js (Earth + signals, unit
 * matrices, capital streams, allocation connectors, farm, food-chain pulses); DOM state is derived
 * from t here (data-show="a-b" step ranges, data-at="t" reveal times); the 3D coin (frics-coin.js)
 * is posed by a keyframe track whose positions come from layout slots, so panels can move without
 * re-tuning the film. Deterministic and scrubbable: root.__cxStory.seek(t). Steps in the rail are
 * keyboard-focusable and jump to that step's end state — also the way through the film under
 * prefers-reduced-motion.
 *
 * Registered with CXStory as 'fricsstory'; loads only when the panel nears the viewport and stops
 * rendering when it is off-screen.
 */
(function () {
  'use strict';

  var D = 18.0, B = [0, 2.0, 3.7, 5.2, 6.9, 8.2, 9.7, 11.9, 13.5, 15.0, 18.0];   // step k spans B[k-1]…B[k]
  var NAMES = [
    ['Discovery', 'Resilience need across water, soil, crop and food systems'],
    ['FRICS Marketplace', 'Explore resilience projects'],
    ['Project selection', 'Water resilience · FRICS available · price'],
    ['Buy FRICS', 'Quantity × price = total value'],
    ['FRICS acquisition', 'Marketplace → company'],
    ['Capital allocation', 'Company → FRICS → resilience project'],
    ['Project deployment', 'Water management · soil resilience · crop adaptation'],
    ['Food chain', 'Farmer → farm → food → supply chain → company → consumer'],
    ['Impact monitoring', 'Indicators reported from project records'],
    ['FRICS lifecycle', 'Project listed → … → completed / retired']
  ];
  /* coin track: [t, slot, diameter (× stage height), alpha, spin-in boost, state-chip alpha]
     slot = a named layout slot, optionally 'name:dy' (px offset) — resolved from the DOM on resize */
  var TRACK = [
    [0, 'start', 0.1, 0, 1, 0], [0.7, 'start', 0.1, 0, 1, 0], [1.6, 'start', 0.25, 1, 0, 1], [2.0, 'start', 0.25, 1, 0, 1],
    [2.8, 'hdr', 0.085, 1, 0, 0], [3.7, 'hdr', 0.085, 1, 0, 0], [4.3, 'row', 0.085, 1, 0, 0], [7.0, 'row', 0.085, 1, 0, 0],
    [7.75, 'co', 0.12, 1, 0, 0], [8.4, 'co', 0.12, 1, 0, 0], [9.2, 'node', 0.115, 1, 0, 0], [9.7, 'node', 0.115, 1, 0, 0],
    [10.5, 'dep', 0.14, 1, 0, 1], [13.6, 'dep', 0.14, 1, 0, 1], [14.2, 'imp', 0.13, 1, 0, 1], [15.0, 'imp', 0.13, 1, 0, 1],
    [15.5, 'life0:-58', 0.11, 1, 0, 0], [15.7, 'life0:-58', 0.11, 1, 0, 0], [16.0, 'life1:-58', 0.11, 1, 0, 0], [16.3, 'life2:-58', 0.11, 1, 0, 0],
    [16.6, 'life3:-58', 0.11, 1, 0, 0], [16.9, 'life4:-58', 0.11, 1, 0, 0], [17.2, 'life5:-58', 0.11, 1, 0, 0], [18, 'life5:-58', 0.11, 1, 0, 0]
  ];
  var LIFE_AT = [15.45, 15.75, 16.05, 16.35, 16.65, 16.95, 17.25, 17.5];
  /* the coin faces front at every hold (a slow sway shows the relief) and turns over as it travels */
  var FLIPS = [[2.0, 2.8], [3.7, 4.3], [7.0, 7.75], [8.4, 9.2], [9.7, 10.5], [13.6, 14.2], [15.0, 15.5]];
  var COIN_BASE = 375;                                     // coin diameter (px) inside the 440px coin canvas at scale 1

  function stepAt(t) { for (var k = 10; k > 1; k--) if (t >= B[k - 1]) return k; return 1; }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }

  function factory(root) {
    var stage = root.querySelector('.fx-stage'), canvas = root.querySelector('.fx-canvas'), g = canvas.getContext('2d'), canvasTop = root.querySelector('.fx-canvas-top'), gt = canvasTop.getContext('2d');
    var Art = window.FRICSArt, P = window.FRICSPaint, geo = FRICSGeo.create(), scene = FRICSScene.create();
    var q = function (s) { return root.querySelector(s); }, qa = function (s) { return [].slice.call(root.querySelectorAll(s)); };
    var nameEl = q('[data-fx-name]'), subEl = q('[data-fx-sub]'), coinBox = q('.fx-coinbox'), coinStateEl = q('[data-fx-cstate]');
    var els = {
      rowGutter: q('.fx-tr[data-r="water"] .fx-gutter'), coSlot: q('[data-slot="co"]'), coUnits: q('.fx-co .fx-units'), buyUnits: q('.fx-buy .fx-units'),
      chainv: qa('.fx-chainv > li'), food: qa('.fx-food ol li')
    };
    var shows = qa('[data-show]').map(function (el) { var r = el.getAttribute('data-show').split('-'); return { el: el, a: +r[0], b: +r[1], from: +el.getAttribute('data-from') || 0, until: +el.getAttribute('data-until') || 1e9 }; });
    var ats = qa('[data-at]').map(function (el) { return { el: el, t: +el.getAttribute('data-at') }; });
    var stepEls = qa('.fx-steps li'), mflow = qa('.fx-mflow li'), lifeEls = qa('.fx-life li'), rows = qa('.fx-tr[data-r]'), waterRow = q('.fx-tr[data-r="water"]');
    var qtyEl = q('[data-fx-qty]'), fmEl = q('[data-fx-fm]'), totEl = q('[data-fx-total]'), heldEl = q('[data-fx-held]'), invEl = q('[data-fx-inv]'), rowSt = q('[data-fx-rowst]');
    var coSt = q('[data-fx-cost]'), ledSt = q('[data-fx-ledst]'), mcoin = q('.fx-mcoin'), btnView = q('[data-fx-view]'), btnBuy = q('[data-fx-buy]'), bars = qa('.fx-imp li');
    var W = 0, H = 0, dpr = 1, mcoinDrawn = false, memo = {}, uid = 0, slots = {}, st = { step: 0, t: 0, playing: false, visible: true, raf: 0, last: 0, done: false };

    var mono = (getComputedStyle(document.documentElement).getPropertyValue('--mono') || '').trim() || '"IBM Plex Mono", monospace';
    var coin = FRICSCoin.create(q('.fx-coin'), { size: 1024, shadow: false, dprCap: 2 });
    root.__fricsCoin = coin;                                // QA hook
    function rect(el) {
      if (!el) return { x: 0, y: 0, w: 0, h: 0 };
      var x = 0, y = 0, e = el;
      while (e && e !== stage) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
      return { x: x, y: y, w: el.offsetWidth, h: el.offsetHeight };
    }
    var paint = P.create({ g: g, gt: gt, W: function () { return W; }, H: function () { return H; }, dpr: function () { return dpr; }, Art: Art, geo: geo, scene: scene, rect: rect, els: els, mono: mono });

    function on(el, cls, v, key) { var k = key || (cls + (el.__id || (el.__id = ++uid))); if (memo[k] !== v) { memo[k] = v; el.classList.toggle(cls, !!v); } }
    function txt(el, v) { if (!el) return; var k = 'T' + (el.__id || (el.__id = ++uid)); if (memo[k] !== v) { memo[k] = v; el.textContent = v; } }
    function css(el, prop, v) { var k = prop + (el.__id || (el.__id = ++uid)); if (memo[k] !== v) { memo[k] = v; el.style[prop] = v; } }

    /* layout slots the coin can occupy — centres in stage px, read from the DOM after layout */
    function measure() {
      var c = function (sel) { var r = rect(q(sel)); return r.w ? [r.x + r.w / 2, r.y + r.h / 2] : null; };
      slots = {
        start: [W * 0.27, H * 0.7], hdr: c('.fx-mkt-h .fx-gutter'), row: c('.fx-tr[data-r="water"] .fx-gutter'), co: c('[data-slot="co"]'),
        node: c('[data-slot="node"]'), dep: [W * 0.085, H * 0.24], imp: [W * 0.095, H * 0.34]
      };
      lifeEls.forEach(function (li, i) { slots['life' + i] = c('.fx-life li:nth-child(' + (i + 1) + ') .fx-lm'); });
    }
    function slotPos(s) {
      var p = s.split(':'), a = slots[p[0]] || [W * 0.5, H * 0.5];
      return [a[0], a[1] + (+p[1] || 0)];
    }
    function coinKeys(t) {                                  // smoothstep-eased between track rows, positions resolved from slots
      var n = TRACK.length, i, a, b, k;
      if (t <= TRACK[0][0]) a = b = TRACK[0]; else if (t >= TRACK[n - 1][0]) a = b = TRACK[n - 1];
      else { for (i = 0; i < n - 1; i++) if (t < TRACK[i + 1][0]) { a = TRACK[i]; b = TRACK[i + 1]; break; } }
      k = a === b ? 0 : P.sm((t - a[0]) / (b[0] - a[0]));
      var pa = slotPos(a[1]), pb = slotPos(b[1]), L = P.lerp;
      return { x: L(pa[0], pb[0], k), y: L(pa[1], pb[1], k), d: L(a[2], b[2], k), a: L(a[3], b[3], k), boost: L(a[4], b[4], k), chip: L(a[5], b[5], k) };
    }

    function isMobile() { return window.innerWidth < 720 || !stage.offsetWidth; }
    function resize() {
      if (isMobile()) return;
      dpr = Math.min(window.devicePixelRatio || 1, CXStory.tier() === 'tablet' ? 2 : 2.5);
      W = stage.clientWidth; H = stage.clientHeight;
      canvas.width = canvasTop.width = Math.round(W * dpr); canvas.height = canvasTop.height = Math.round(H * dpr);
      geo.resize(W, H); scene.resize(W, H); coin.resize(); measure();
      paintAt(st.t);
    }

    function stateLabel(t, s) {
      if (s === 1) return 'Credit unit';
      if (s === 6) return 'Allocated';
      if (s === 7 || s === 8) return 'Capital deployed';
      return 'Impact monitored';
    }
    function coinAt(t, s) {
      var k = coinKeys(t), sc = k.d * H / COIN_BASE;
      css(coinBox, 'transform', 'translate3d(' + k.x.toFixed(1) + 'px,' + k.y.toFixed(1) + 'px,0) scale(' + sc.toFixed(4) + ')');
      css(coinBox, 'opacity', k.a.toFixed(3));
      css(coinStateEl, 'transform', 'translate3d(' + k.x.toFixed(1) + 'px,' + (k.y + k.d * H / 2 + 12).toFixed(1) + 'px,0) translateX(-50%)');
      css(coinStateEl, 'opacity', (k.a * k.chip).toFixed(3));
      txt(coinStateEl, stateLabel(t, s));
      if (k.a > 0.01 && coin.isReady) {
        var y = 0.28 + 0.34 * Math.sin(t * 0.9) + k.boost * Math.PI * 2.4; FLIPS.forEach(function (f) { y += Math.PI * 2 * P.sm(P.seg(t, f[0], f[1])); });
        coin.pose.ry = y; coin.pose.rx = Math.sin(t * 0.6) * 0.05; coin.pose.rz = 0;
        coin.render();
      }
    }

    function paintAt(t) {
      if (isMobile() || !W) return;
      paint.frame(t, stepAt(t));
      coinAt(t, stepAt(t));
    }

    /* ── DOM state, derived from t ── */
    function domAt(t, s) {
      if (st.step !== s) {
        st.step = s;
        if (nameEl) { txt(nameEl, NAMES[s - 1][0]); txt(subEl, NAMES[s - 1][1]); }
      }
      shows.forEach(function (o, i) { on(o.el, 'is-shown', s >= o.a && s <= o.b && t >= o.from && t < o.until, 'sh' + i); });
      ats.forEach(function (o, i) { on(o.el, 'is-on', t >= o.t, 'at' + i); });
      stepEls.forEach(function (li, i) { on(li, 'is-done', i + 1 < s); on(li, 'is-cur', i + 1 === s); });

      /* 03 · the Water listing is selected */
      rows.forEach(function (r, i) { on(r, 'is-sel', i === 0 && t >= 3.95 && s < 6); on(r, 'is-dim', i > 0 && t >= 4.2, 'dim' + i); });
      /* the listing's status follows the acquisition: available → acquired */
      var got = t >= 7.75;
      if (rowSt) { txt(rowSt, got ? 'Acquired' : 'Available'); on(rowSt, 'is-acq', got, 'racq'); }
      if (invEl) txt(invEl, got ? '24,000' : '25,000');
      /* 03 → 04 · VIEW PROJECT, then the order */
      if (btnView) on(btnView, 'is-press', t >= 4.95 && t < 5.15, 'vpress');
      if (qtyEl) {
        var digits = t < 5.4 ? '' : t < 5.55 ? '1' : t < 5.7 ? '10' : t < 5.85 ? '100' : '1,000';
        txt(qtyEl, digits); on(qtyEl.parentNode, 'is-typing', t >= 5.35 && t < 5.9, 'typing');
      }
      if (btnBuy) { on(btnBuy, 'is-press', t >= 6.15 && t < 6.3, 'bpress'); on(btnBuy, 'is-done', t >= 6.3, 'bdone'); }
      /* 05 · holding */
      if (heldEl) txt(heldEl, fmt(1000 * P.sm(P.seg(t, 7.7, 8.15))));
      if (coSt) { txt(coSt, t >= 7.72 ? 'Acquired' : 'Awaiting FRICS'); on(coSt, 'is-acq', t >= 7.72, 'coacq'); }
      /* 06 · allocation */
      if (ledSt) { txt(ledSt, t >= 9.3 ? 'Allocated' : 'Pending'); on(ledSt, 'is-acq', t >= 9.3, 'ledacq'); }
      /* 09 · monitoring bars sweep, values stay unreported */
      bars.forEach(function (li, k) { var v = P.seg(t, 13.75 + 0.12 * k, 14.55 + 0.12 * k).toFixed(3); if (memo['p' + k] !== v) { memo['p' + k] = v; li.style.setProperty('--p', v); } });
      /* 10 · lifecycle: the coin carries the credit through each stage */
      var cur = -1;
      lifeEls.forEach(function (li, i) { var lit = t >= LIFE_AT[i]; on(li, 'is-on', lit, 'life' + i); if (lit && i < 6) cur = i; });
      lifeEls.forEach(function (li, i) { on(li, 'is-cur', i === cur, 'lcur' + i); });

      var m = s === 1 ? 1 : s <= 3 ? 2 : s <= 5 ? 3 : s === 6 ? 4 : s <= 8 ? 5 : 6;
      mflow.forEach(function (li, k) { on(li, 'is-on', k + 1 <= m, 'm' + k); });
      if (m >= 3 && !mcoinDrawn && mcoin && Art) {
        mcoinDrawn = true;
        Art.loadLogo().then(function () { var c = mcoin.getContext('2d'); c.clearRect(0, 0, 96, 96); c.drawImage(Art.sprite('front', 256), 0, 0, 96, 96); });
      }
    }

    function frame(t) { st.t = t; domAt(t, stepAt(t)); paintAt(t); }

    /* ── clock ── */
    function loop(now) {
      st.raf = 0;
      if (!st.playing || !st.visible) return;
      var dt = Math.min(0.25, (now - st.last) / 1000); st.last = now;
      var t = st.t + dt;
      if (!st.done && t >= D) { st.done = true; root.classList.remove('is-run'); root.classList.add('is-done'); }
      frame(t);
      st.raf = requestAnimationFrame(loop);
    }
    function kick() { if (!st.raf && st.playing && st.visible) { st.last = performance.now(); st.raf = requestAnimationFrame(loop); } }

    function play() {                                       // the first run waits (briefly) for the 3D coin so the film never opens without it
      if (coin.isReady) return start();
      var go = function () { if (go.done) return; go.done = true; start(); };
      coin.ready(go); setTimeout(go, 2500);
    }
    function start() {
      cancelAnimationFrame(st.raf); st.raf = 0; st.done = false;
      root.classList.remove('is-done'); root.classList.add('is-run'); root.style.setProperty('--cxs-dur', D + 's');
      void root.offsetWidth; st.playing = true; frame(0); kick();
    }
    function seek(t) { cancelAnimationFrame(st.raf); st.raf = 0; st.playing = false; root.classList.remove('is-run'); root.classList.add('is-done'); frame(t); }
    function showStep(k) { seek(k >= 10 ? D + 0.05 : B[k] - 0.02); }

    stepEls.forEach(function (li, i) {
      li.setAttribute('tabindex', '0'); li.setAttribute('role', 'button'); li.setAttribute('aria-label', 'Show step ' + (i + 1) + ': ' + li.querySelector('.fx-st').textContent);
      li.addEventListener('click', function () { showStep(i + 1); });
      li.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showStep(i + 1); } });
    });

    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(stage); else window.addEventListener('resize', resize);
    var unwatch = CXStory.watchVisible(root, function (v) { st.visible = v; if (v) kick(); });
    resize();
    coin.ready(function () { root.classList.add('fx-coin-ready'); paintAt(st.t); });
    if (Art) Art.loadLogo().then(function () { paintAt(st.t); });

    return {
      play: play, replay: play, seek: seek,
      showFinal: function () { root.classList.add('no-anim', 'is-done'); st.done = true; frame(D + 0.05); },
      destroy: function () { cancelAnimationFrame(st.raf); unwatch(); if (ro) ro.disconnect(); coin.dispose(); }
    };
  }

  function reg() { if (window.CXStory) CXStory.register('fricsstory', factory); else setTimeout(reg, 30); }
  reg();
})();
