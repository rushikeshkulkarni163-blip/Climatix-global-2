/**
 * frics-story.js — the FRICS™ walkthrough (~17 s), Green Rating → resilience impact → back into Climactix.
 *
 *   01 Green Rating · 02 gap detection · 03 FRICS recommendation · 04 the credit · 05 company acquires
 *   06 capital flows (company → region → farming area → project → farmer) · 07 food chain
 *   08 impact · 09 feedback into Climactix
 *
 * Single clock, pure frame(t): canvas layers come from frics-paint.js (Earth zoom on the existing
 * rim-geo data, farm, capital streams, loop, chart); DOM state is derived from t here; the 3D coin
 * (frics-coin.js) is posed by a keyframe track. Deterministic and scrubbable:
 * root.__cxStory.seek(t). Steps in the rail are keyboard-focusable and jump to that step's end
 * state — also the way through the story under prefers-reduced-motion.
 *
 * Registered with CXStory as 'fricsstory'; loads only when the panel nears the viewport and stops
 * rendering when it is off-screen.
 */
(function () {
  'use strict';

  var D = 17.2, B = [0, 2.0, 4.6, 6.1, 7.1, 8.6, 12.4, 13.6, 15.1, 17.2];   // step k spans B[k-1]…B[k]
  var NAMES = [
    ['Green Rating', 'Risk OS™ assessment result'],
    ['Gap detection', 'Climate exposure → agricultural value chain → priorities'],
    ['FRICS recommendation', 'Allocation derived from the resilience gaps'],
    ['The FRICS credit', 'An instrument of impact, not a token'],
    ['Company allocation', 'ABC Industries acquires its allocation'],
    ['Capital to resilience', 'Company → region → farming area → project → farmer'],
    ['Food chain', 'Farmer → farm → food → supply chain → company → consumer'],
    ['Impact', 'Pune Water Resilience Program · tracked outcomes'],
    ['Feedback', 'Impact returns to Climactix']
  ];
  var RING = { cx: 0.5, cy: 0.5, rx: 0.3, ry: 0.34 };
  /* coin track: t, x, y (stage fractions), diameter (× stage height), alpha, spin-in boost */
  var COIN = [
    [0, 0.31, 0.44, 0.05, 0, 0], [5.15, 0.31, 0.44, 0.05, 0, 0], [5.3, 0.31, 0.44, 0.1, 1, 1], [6.1, 0.47, 0.42, 0.36, 1, 0], [7.1, 0.5, 0.47, 0.6, 1, 0],
    [8.0, 0.5, 0.4, 0.3, 1, 0], [8.6, 0.5, 0.4, 0.28, 1, 0], [9.4, 0.92, 0.27, 0.15, 1, 0], [13.4, 0.92, 0.27, 0.15, 1, 0],
    [13.9, 0.1, 0.33, 0.2, 1, 0], [15.0, 0.1, 0.33, 0.2, 1, 0], [15.6, 0.5, 0.52, 0.24, 1, 0], [17.2, 0.5, 0.52, 0.24, 1, 0]
  ];
  var COIN_BASE = 375;                                     // coin diameter (px) inside the 440px coin canvas at scale 1

  function stepAt(t) { for (var k = 9; k > 1; k--) if (t >= B[k - 1]) return k; return 1; }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }

  function factory(root) {
    var stage = root.querySelector('.fx-stage'), canvas = root.querySelector('.fx-canvas'), g = canvas.getContext('2d');
    var Art = window.FRICSArt, P = window.FRICSPaint, geo = FRICSGeo.create(), scene = FRICSScene.create();
    var q = function (s) { return root.querySelector(s); }, qa = function (s) { return [].slice.call(root.querySelectorAll(s)); };
    var nameEl = q('[data-fx-name]'), subEl = q('[data-fx-sub]'), coinBox = q('.fx-coinbox'), coinStateEl = q('[data-fx-cstate]');
    var els = { engine: q('.fx-engine'), prio: q('.fx-prio'), co: q('.fx-co'), ecoTgt: q('.fx-eco .is-tgt'), chart: q('[data-fx-chart]') };
    var shows = qa('[data-show]').map(function (el) { var r = el.getAttribute('data-show').split('-'); return { el: el, a: +r[0], b: +r[1], from: +el.getAttribute('data-from') || 0, until: +el.getAttribute('data-until') || 1e9 }; });
    var stepEls = qa('.fx-steps li'), gapEls = qa('.fx-gaps li'), chainEls = qa('.fx-chain2 li'), prioEls = qa('.fx-prio li'), foodEls = qa('.fx-food ol li');
    var crumbEls = qa('.fx-crumb li'), upEls = qa('.fx-up li'), nodeEls = qa('.fx-node'), stateEls = qa('.fx-states li'), mflow = qa('.fx-mflow li');
    var pinEls = { pune: q('[data-fx-plabel]'), maha: q('[data-fx-maptag]'), project: q('[data-fx-geol]'), farmer: q('[data-fx-farmer]') };
    var btn = q('[data-fx-btn]'), engBar = q('.fx-eng-bar i'), foodNote = q('.fx-food-n'), loopf = q('.fx-loopf'), mcoin = q('.fx-mcoin');
    var cnt72 = q('[data-fx-cnt]'), allocEl = q('[data-fx-alloc]'), ecoEl = q('[data-fx-eco]'), nums = qa('[data-fx-num]');
    var W = 0, H = 0, dpr = 1, mcoinDrawn = false, memo = {}, uid = 0, st = { step: 0, t: 0, playing: false, visible: true, raf: 0, last: 0, done: false };

    var coin = FRICSCoin.create(q('.fx-coin'), { size: 1024, shadow: false, dprCap: 2 });
    root.__fricsCoin = coin;                                // QA hook
    function rect(el) {
      if (!el) return { x: 0, y: 0, w: 0, h: 0 };
      var x = 0, y = 0, e = el;
      while (e && e !== stage) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
      return { x: x, y: y, w: el.offsetWidth, h: el.offsetHeight };
    }
    var paint = P.create({ g: g, W: function () { return W; }, H: function () { return H; }, dpr: function () { return dpr; }, Art: Art, geo: geo, scene: scene, rect: rect, els: els, RING: RING });

    function on(el, cls, v, key) { var k = key || (cls + (el.__id || (el.__id = ++uid))); if (memo[k] !== v) { memo[k] = v; el.classList.toggle(cls, !!v); } }
    function txt(el, v) { if (!el) return; var k = 'T' + (el.__id || (el.__id = ++uid)); if (memo[k] !== v) { memo[k] = v; el.textContent = v; } }
    function css(el, prop, v) { var k = prop + (el.__id || (el.__id = ++uid)); if (memo[k] !== v) { memo[k] = v; el.style[prop] = v; } }

    /* ring nodes for the feedback loop sit on the same ellipse the canvas draws */
    nodeEls.forEach(function (n) {
      var a = +n.getAttribute('data-a') * Math.PI / 180;
      n.style.left = (RING.cx + RING.rx * Math.cos(a)) * 100 + '%'; n.style.top = (RING.cy + RING.ry * Math.sin(a)) * 100 + '%';
    });

    function isMobile() { return window.innerWidth < 720 || !stage.offsetWidth; }
    function resize() {
      if (isMobile()) return;
      dpr = Math.min(window.devicePixelRatio || 1, CXStory.tier() === 'tablet' ? 2 : 2.5);
      W = stage.clientWidth; H = stage.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      geo.resize(W, H); scene.resize(W, H); coin.resize();
      paintAt(st.t);
    }

    function pin(key, p, ok) {
      var el = pinEls[key]; if (!el) return;
      if (p && ok) { css(el, 'left', Math.round(p[0]) + 'px'); css(el, 'top', Math.round(p[1]) + 'px'); }
    }

    function coinAt(t, s) {
      var k = P.keys(t, COIN), d = k[2] * H, sc = d / COIN_BASE, a = k[3];
      css(coinBox, 'transform', 'translate3d(' + (k[0] * W).toFixed(1) + 'px,' + (k[1] * H).toFixed(1) + 'px,0) scale(' + sc.toFixed(4) + ')');
      css(coinBox, 'opacity', a.toFixed(3));
      coinBox.style.setProperty('--inv', Math.min(3, 1 / Math.max(sc, 0.2)).toFixed(3));
      txt(coinStateEl, s <= 4 ? 'FRICS created' : s === 5 ? 'FRICS allocated' : s <= 7 ? 'FRICS deployed' : 'Impact tracked');
      if (a > 0.01 && coin.isReady) {
        var boost = k[4];
        coin.pose.ry = 0.6 + t * 0.5 + boost * Math.PI * 2.4; coin.pose.rx = Math.sin(t * 0.6) * 0.05; coin.pose.rz = 0;
        coin.render();
      }
    }

    function paintAt(t) {
      if (isMobile() || !W) return;
      var s = stepAt(t);
      paint.frame(t, s);
      var pn = paint.pins;
      pin('pune', pn.pune, pn.pune && pn.pune[2]); pin('maha', pn.maha, pn.maha && pn.maha[2]); pin('project', pn.project, pn.project && pn.project[2]); pin('farmer', pn.farmer, !!pn.farmer);
      coinAt(t, s);
      if (pinEls.pune) on(pinEls.pune, 'is-off', !(pn.cam && pn.cam.a > 0.5 && pn.pune && pn.pune[2] && (s === 1 || s === 6)), 'poff');
      if (ecoEl) txt(ecoEl, fmt(1250 * Math.min(1, (pn.arrived || 0) / 12) * (s === 5 ? 1 : 0)));
    }

    /* ── DOM state, derived from t ── */
    function domAt(t, s) {
      if (st.step !== s) {
        st.step = s;
        if (nameEl) { txt(nameEl, NAMES[s - 1][0]); txt(subEl, NAMES[s - 1][1]); }
      }
      shows.forEach(function (o, i) { on(o.el, 'is-shown', s >= o.a && s <= o.b && t >= o.from && t < o.until, 'sh' + i); });
      stepEls.forEach(function (li, i) { on(li, 'is-done', i + 1 < s); on(li, 'is-cur', i + 1 === s); });
      stateEls.forEach(function (li) { on(li, 'is-on', s >= +li.getAttribute('data-s')); });

      gapEls.forEach(function (li, k) { on(li, 'is-on', t >= 0.5 + 0.3 * k); on(li, 'is-focus', k === 0 && t >= 3.4); });
      if (cnt72) txt(cnt72, String(Math.round(72 * P.sm(P.seg(t, 0.3, 1.2)))));
      chainEls.forEach(function (li, k) { on(li, 'is-on', t >= 2.2 + 0.36 * k); });
      prioEls.forEach(function (li, k) { on(li, 'is-on', t >= 3.6 + 0.16 * k); });
      if (engBar) engBar.style.setProperty('--p', P.seg(t, 4.7, 5.6).toFixed(3));
      if (allocEl) txt(allocEl, fmt(1250 * P.sm(P.seg(t, 5.2, 6.0))));
      if (btn) { on(btn, 'is-press', t >= 7.55 && t < 7.75, 'press'); on(btn, 'is-done', t >= 7.75, 'bdone'); }
      crumbEls.forEach(function (li, k) { on(li, 'is-on', t >= [8.7, 9.6, 10.4, 10.95, 11.6][k]); });
      foodEls.forEach(function (li, k) { on(li, 'is-on', t >= 12.5 + 0.13 * k); });
      if (foodNote) on(foodNote, 'is-on', t >= 13.2, 'fnote');
      nums.forEach(function (n) { txt(n, fmt(+n.getAttribute('data-fx-num') * P.sm(P.seg(t, 13.7, 14.5)))); });
      upEls.forEach(function (li, k) { on(li, 'is-on', t >= 14.2 + 0.1 * k); });
      nodeEls.forEach(function (n, k) { on(n, 'is-on', t >= 15.2 + 0.2 * k); });
      if (loopf) on(loopf, 'is-on', t >= 16.4, 'lf');

      var m = s === 1 ? 1 : s === 2 ? 2 : s <= 5 ? 3 : s === 6 ? 4 : s === 7 ? 5 : 6;
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

    function play() {
      cancelAnimationFrame(st.raf); st.raf = 0; st.done = false;
      root.classList.remove('is-done'); root.classList.add('is-run'); root.style.setProperty('--cxs-dur', D + 's');
      void root.offsetWidth; st.playing = true; frame(0); kick();
    }
    function seek(t) { cancelAnimationFrame(st.raf); st.raf = 0; st.playing = false; root.classList.remove('is-run'); root.classList.add('is-done'); frame(t); }
    function showStep(k) { seek(k >= 9 ? D + 0.05 : B[k] - 0.02); }

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
