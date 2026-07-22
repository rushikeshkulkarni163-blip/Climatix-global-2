/* ═══════════════════════════════════════════════════════════════
   CX CARD MOTION ENGINE
   Shared premium micro-interaction layer for every card / tile /
   benefit / feature / capability / report component site-wide.

   Drop-in usage: <script src="card-motion.js" defer></script>
   Optional per-page hooks (declare BEFORE the script tag):
     window.CX_CARD_MOTION_EXTRA    = ['.pl-feature', '.report-item'];
     window.CX_CARD_MOTION_EXCLUDE  = ['.modal-card'];
     window.CX_CARD_MOTION_SOUND    = false; // disable the hover tick on this page
   Opt a single element out: class="no-card-motion" or data-no-motion.
   Scale down tilt on an oversized card: data-tilt-scale="0.35" (0–1).

   Only animates transform / opacity / filter / box-shadow — never
   layout properties. Colors, borders, spacing, typography untouched.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__cxCardMotion) return;
  window.__cxCardMotion = true;

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var STYLE_ID = 'cx-card-motion-style';

  /* ── Sound ──────────────────────────────────────────────────────
     A soft breath-of-wind gust per deliberate hover-enter — on-theme
     for a climate/atmospheric platform (filtered noise, not a UI
     "tick"). Never on tilt/move, never on scroll-entrance (would
     spam while scrolling past a grid). Disable per page with
     window.CX_CARD_MOTION_SOUND = false before the script tag. Off
     automatically under reduced motion, the closest signal we have
     for "less sensory feedback, please" (no prefers-reduced-sound
     media feature exists). */
  var soundEnabled = window.CX_CARD_MOTION_SOUND !== false && !reduceMotion;
  var audioCtx = null;
  var windBuffer = null;
  var lastSoundAt = 0;
  var SOUND_COOLDOWN_MS = 150;

  function ensureAudioCtx() {
    if (audioCtx) return audioCtx;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try { audioCtx = new Ctx(); } catch (e) { audioCtx = null; }
    return audioCtx;
  }

  function primeAudio() {
    if (!soundEnabled) return;
    var ctx = ensureAudioCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function getWindBuffer(ctx) {
    if (windBuffer) return windBuffer;
    var len = Math.round(ctx.sampleRate * 0.4);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    windBuffer = buf;
    return windBuffer;
  }

  function playHoverWind() {
    if (!soundEnabled) return;
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    if (now - lastSoundAt < SOUND_COOLDOWN_MS) return;
    var ctx = ensureAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') { ctx.resume(); return; }
    lastSoundAt = now;

    try {
      var t0 = ctx.currentTime;
      var src = ctx.createBufferSource();
      src.buffer = getWindBuffer(ctx);

      var filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.setValueAtTime(0.7, t0);
      filter.frequency.setValueAtTime(1150, t0);
      filter.frequency.exponentialRampToValueAtTime(380, t0 + 0.24);

      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.05, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start(t0);
      src.stop(t0 + 0.28);
    } catch (e) { /* never let audio break the page */ }
  }

  if (soundEnabled) {
    document.addEventListener('pointerdown', primeAudio, { once: true, passive: true });
    document.addEventListener('keydown', primeAudio, { once: true });
  }

  /* .cx-cm repeated 3x is a deliberate specificity boost (0,3,0): many pages
     carry legacy "kill hover motion" rules like `.some-card:hover{transform:
     none!important}` (specificity 0,2,0). Both are !important, so the higher-
     specificity selector wins regardless of source order — this engine has
     to out-specify those, not just out-order them. */
  var S = '.cx-cm.cx-cm.cx-cm';

  var CSS = [
    S + '{',
    '  transition:',
    '    background-color 200ms cubic-bezier(0.4,0,0.2,1) !important,',
    '    border-color 200ms cubic-bezier(0.4,0,0.2,1) !important,',
    '    color 200ms cubic-bezier(0.4,0,0.2,1) !important,',
    '    opacity 620ms cubic-bezier(0.16,1,0.3,1) !important,',
    '    transform 620ms cubic-bezier(0.16,1,0.3,1) !important,',
    '    box-shadow 260ms cubic-bezier(0.22,1,0.36,1) !important,',
    '    filter 260ms cubic-bezier(0.22,1,0.36,1) !important;',
    '  transform: perspective(900px) rotateX(var(--cx-rx,0deg)) rotateY(var(--cx-ry,0deg)) translateY(var(--cx-ty,0px)) translateZ(0) !important;',
    '  filter: brightness(var(--cx-bright,1)) !important;',
    '  box-shadow: 0 0 0 1px rgba(140,140,140,var(--cx-glow-o,0)), 0 20px 36px -18px rgba(0,0,0,var(--cx-shadow-o,0)) !important;',
    '  opacity: var(--cx-op,1) !important;',
    '}',
    S + '.cx-cm-tracking{',
    '  transition:',
    '    background-color 200ms cubic-bezier(0.4,0,0.2,1) !important,',
    '    border-color 200ms cubic-bezier(0.4,0,0.2,1) !important,',
    '    color 200ms cubic-bezier(0.4,0,0.2,1) !important,',
    '    box-shadow 260ms cubic-bezier(0.22,1,0.36,1) !important,',
    '    filter 260ms cubic-bezier(0.22,1,0.36,1) !important;',
    '}',
    S + '.cx-cm-pre{ --cx-op:0; --cx-ty:16px; }',
    S + '.cx-cm-hover{ --cx-ty:-3px; --cx-shadow-o:0.20; --cx-glow-o:0.5; --cx-bright:1.03; }',
    '.cx-cm-sheen{',
    '  position:absolute; inset:0; border-radius:inherit;',
    '  pointer-events:none; z-index:3; opacity:0;',
    '  background:radial-gradient(circle 240px at var(--cx-mx,50%) var(--cx-my,50%), rgba(var(--cx-sheen-rgb,255,255,255),0.09), rgba(var(--cx-sheen-rgb,255,255,255),0) 72%);',
    '  transition:opacity 260ms cubic-bezier(0.22,1,0.36,1) !important;',
    '}',
    S + '.cx-cm-hover > .cx-cm-sheen{ opacity:1; }',
    S + ' [class*="icon" i]{ transition:transform 240ms cubic-bezier(0.22,1,0.36,1) !important, filter 240ms cubic-bezier(0.22,1,0.36,1) !important, opacity 240ms ease !important; }',
    S + '.cx-cm-hover [class*="icon" i]{ transform:translateY(-2px) scale(1.045) !important; }',
    S + ' [class*="tag" i],' + S + ' [class*="chip" i],' + S + ' [class*="badge" i],' + S + ' [class*="pill" i]{ transition:transform 220ms cubic-bezier(0.22,1,0.36,1) !important, filter 220ms ease !important; }',
    S + '.cx-cm-hover [class*="tag" i],' + S + '.cx-cm-hover [class*="chip" i],' + S + '.cx-cm-hover [class*="badge" i],' + S + '.cx-cm-hover [class*="pill" i]{ transform:translateY(-1px) !important; filter:brightness(1.08) !important; }',
    '@media (prefers-reduced-motion: reduce){',
    '  ' + S + ',' + S + '.cx-cm-hover,.cx-cm-sheen{ transition:opacity 200ms linear !important; transform:none !important; filter:none !important; box-shadow:none !important; }',
    '}'
  ].join('\n');

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var tag = document.createElement('style');
    tag.id = STYLE_ID;
    tag.textContent = CSS;
    document.head.appendChild(tag);
  }

  function isCardToken(token) {
    return /(^|-)(card|tile)$/i.test(token);
  }

  function selectAll(selectors) {
    var set = new Set();
    (selectors || []).forEach(function (sel) {
      try {
        document.querySelectorAll(sel).forEach(function (el) { set.add(el); });
      } catch (e) { /* invalid selector on this page, ignore */ }
    });
    return set;
  }

  function collectCards() {
    var found = new Set();
    var candidates = document.querySelectorAll('[class*="card" i], [class*="tile" i]');
    candidates.forEach(function (el) {
      var raw = el.getAttribute('class') || '';
      var tokens = raw.split(/\s+/);
      for (var i = 0; i < tokens.length; i++) {
        if (isCardToken(tokens[i])) { found.add(el); break; }
      }
    });

    selectAll(window.CX_CARD_MOTION_EXTRA).forEach(function (el) { found.add(el); });

    var excludeSet = selectAll(window.CX_CARD_MOTION_EXCLUDE);
    var list = Array.from(found).filter(function (el) {
      if (el.classList.contains('cx-cm')) return false; // already processed
      if (excludeSet.has(el)) return false;
      if (el.classList.contains('no-card-motion')) return false;
      if (el.hasAttribute('data-no-motion')) return false;
      if (el.closest('.no-card-motion, [data-no-motion]')) return false;
      return true;
    });

    // Keep only the outermost card when one qualifying card nests another.
    return list.filter(function (el) {
      for (var i = 0; i < list.length; i++) {
        if (list[i] !== el && list[i].contains(el)) return false;
      }
      return true;
    });
  }

  function luminanceOf(el) {
    var node = el;
    for (var i = 0; i < 6 && node; i++) {
      var bg = getComputedStyle(node).backgroundColor;
      var m = bg && bg.match(/rgba?\(([^)]+)\)/);
      if (m) {
        var parts = m[1].split(',').map(function (v) { return parseFloat(v); });
        var a = parts.length > 3 ? parts[3] : 1;
        if (a > 0.05) {
          var r = parts[0] / 255, g = parts[1] / 255, b = parts[2] / 255;
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        }
      }
      node = node.parentElement;
    }
    return 0.12;
  }

  function initEntrance(cards) {
    if (reduceMotion) {
      cards.forEach(function (el) { el.classList.add('cx-cm-in'); });
      return;
    }

    var perParent = new Map();
    cards.forEach(function (el) {
      var p = el.parentElement;
      var idx = perParent.get(p) || 0;
      perParent.set(p, idx + 1);
      el.style.transitionDelay = (Math.min(idx, 7) * 55) + 'ms';
      el.classList.add('cx-cm-pre');
    });

    var revealed = new WeakSet();
    function reveal(el) {
      if (revealed.has(el)) return;
      revealed.add(el);
      el.classList.remove('cx-cm-pre');
      el.classList.add('cx-cm-in');
    }

    if (!('IntersectionObserver' in window)) {
      cards.forEach(reveal);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          reveal(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    cards.forEach(function (el) { io.observe(el); });

    // Safety net: never leave a card permanently invisible.
    setTimeout(function () { cards.forEach(reveal); }, 4000);
  }

  function initTracking(cards) {
    if (reduceMotion) return;

    cards.forEach(function (el) {
      if (getComputedStyle(el).position === 'static') {
        el.style.setProperty('position', 'relative', 'important');
      }

      var sheen = document.createElement('div');
      sheen.className = 'cx-cm-sheen';
      sheen.setAttribute('aria-hidden', 'true');
      el.appendChild(sheen);

      var raf = null, lastX = 0, lastY = 0;
      // Large panels (e.g. a full-width product-preview card) get a
      // proportionally smaller tilt so the effect stays "calm" instead of
      // warping visibly at the edges. Opt in with data-tilt-scale="0.35".
      var tiltScale = parseFloat(el.dataset.tiltScale);
      if (!(tiltScale > 0) || tiltScale > 1) tiltScale = 1;

      function apply() {
        raf = null;
        var r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var px = Math.min(1, Math.max(0, (lastX - r.left) / r.width));
        var py = Math.min(1, Math.max(0, (lastY - r.top) / r.height));
        var maxTilt = 2.4 * tiltScale;
        el.style.setProperty('--cx-ry', ((px - 0.5) * 2 * maxTilt).toFixed(2) + 'deg');
        el.style.setProperty('--cx-rx', ((0.5 - py) * 2 * maxTilt).toFixed(2) + 'deg');
        el.style.setProperty('--cx-mx', (px * 100).toFixed(1) + '%');
        el.style.setProperty('--cx-my', (py * 100).toFixed(1) + '%');
      }

      function onMove(e) {
        if (e.pointerType === 'touch') return;
        lastX = e.clientX; lastY = e.clientY;
        if (!raf) raf = requestAnimationFrame(apply);
      }

      function onEnter(e) {
        el.style.setProperty('--cx-sheen-rgb', luminanceOf(el) > 0.55 ? '0,0,0' : '255,255,255');
        el.classList.add('cx-cm-hover');
        if (e.pointerType === 'touch') return;
        el.classList.add('cx-cm-tracking');
        lastX = e.clientX; lastY = e.clientY;
        apply();
        playHoverWind();
      }

      function onLeave() {
        el.classList.remove('cx-cm-hover', 'cx-cm-tracking');
        el.style.removeProperty('--cx-rx');
        el.style.removeProperty('--cx-ry');
        if (raf) { cancelAnimationFrame(raf); raf = null; }
      }

      el.addEventListener('pointerenter', onEnter);
      el.addEventListener('pointermove', onMove, { passive: true });
      el.addEventListener('pointerleave', onLeave);
      el.addEventListener('pointercancel', onLeave);
    });
  }

  function scan() {
    try {
      injectStyle();
      var cards = collectCards();
      if (!cards.length) return;
      cards.forEach(function (el) { el.classList.add('cx-cm'); });
      initEntrance(cards);
      initTracking(cards);
    } catch (err) {
      // Never let the motion layer break the page — force everything visible.
      document.querySelectorAll('.cx-cm-pre').forEach(function (el) { el.classList.remove('cx-cm-pre'); el.classList.add('cx-cm-in'); });
      if (window.console && console.warn) console.warn('card-motion: ' + err.message);
    }
  }

  // Many pages here render cards client-side after load (feeds, dashboards,
  // async fragments) — rescan on DOM mutations, debounced, so those still
  // get the same treatment without every render path having to call in.
  function watchForLateCards() {
    if (!('MutationObserver' in window)) return;
    var timer = null;
    var mo = new MutationObserver(function (mutations) {
      var relevant = mutations.some(function (m) { return m.addedNodes && m.addedNodes.length; });
      if (!relevant) return;
      clearTimeout(timer);
      timer = setTimeout(scan, 180);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  window.cxCardMotionRefresh = scan;

  function boot() {
    scan();
    watchForLateCards();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
