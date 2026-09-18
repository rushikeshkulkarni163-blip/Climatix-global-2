/**
 * story-core.js — shared runtime for the homepage product stories
 * (Risk OS™ assessment story, Risk Intelligence Map story).
 *
 * Responsibilities:
 *   - viewport detection (desktop / tablet / mobile tier)
 *   - reduced-motion detection
 *   - lazy-loading each story's script when its section nears the viewport
 *   - one-shot "start when in view" wiring
 *
 * Exports window.CXStory. Stories register via CXStory.register(name, factory);
 * a factory receives the root element and returns { play(), replay(), destroy() }.
 */
(function () {
  'use strict';

  var registry = {};
  var pending = {};

  var mqReduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function reducedMotion() {
    return !!(mqReduced && mqReduced.matches);
  }

  /* Tier drives how much work a story does: full / simplified / lightweight. */
  function tier() {
    var w = window.innerWidth;
    if (w < 720) return 'mobile';
    if (w < 1100) return 'tablet';
    return 'desktop';
  }

  function saveData() {
    return !!(navigator.connection && navigator.connection.saveData);
  }

  /* Run fn once when el is at least `threshold` visible. */
  function onceVisible(el, fn, threshold) {
    if (!('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) { io.disconnect(); fn(); return; }
      }
    }, { threshold: threshold || 0.35 });
    io.observe(el);
  }

  /* Track continuous visibility (used to pause canvas rendering off-screen). */
  function watchVisible(el, cb) {
    if (!('IntersectionObserver' in window)) { cb(true); return function () {}; }
    var io = new IntersectionObserver(function (entries) {
      cb(entries[entries.length - 1].isIntersecting);
    }, { threshold: 0.05 });
    io.observe(el);
    return function () { io.disconnect(); };
  }

  function loadScript(src, done) {
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = done;
    s.onerror = function () { console.warn('[CXStory] failed to load', src); };
    document.body.appendChild(s);
  }

  function mount(name, root) {
    var factory = registry[name];
    if (!factory || root.__cxStory) return;
    var api = factory(root);
    root.__cxStory = api;
    var replayBtn = root.querySelector('[data-story-replay]');
    if (replayBtn) {
      replayBtn.addEventListener('click', function () { api.replay(); });
    }
    if (reducedMotion()) {
      /* Static end-state; nothing to replay. */
      if (api.showFinal) api.showFinal();
      if (replayBtn) replayBtn.hidden = true;
      return;
    }
    /* Tall stacked layouts can never reach 40 % visible; scale the bar to what's reachable. */
    var reach = Math.min(0.4, 0.6 * window.innerHeight / Math.max(1, root.offsetHeight));
    onceVisible(root, function () { api.play(); }, Math.max(0.1, reach));
  }

  function register(name, factory) {
    registry[name] = factory;
    var root = pending[name];
    if (root) { delete pending[name]; mount(name, root); }
  }

  /* Fetch a story's script(s) when its root is within `margin` px of the viewport.
     `src` may be a space-separated list, loaded in order (data files first). */
  function lazy(name, root, src, margin) {
    var started = false;
    var queue = String(src).split(/\s+/).filter(Boolean);
    function next() {
      if (!queue.length) {
        /* Last script has run and called register(), which mounts via `pending`. */
        if (pending[name]) { var r = pending[name]; delete pending[name]; mount(name, r); }
        return;
      }
      loadScript(queue.shift(), next);
    }
    function start() {
      if (started) return;
      started = true;
      pending[name] = root;
      next();
    }
    if (!('IntersectionObserver' in window)) { start(); return; }
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) { io.disconnect(); start(); return; }
      }
    }, { rootMargin: (margin || 600) + 'px 0px' });
    io.observe(root);
  }

  window.CXStory = {
    register: register,
    lazy: lazy,
    tier: tier,
    reducedMotion: reducedMotion,
    saveData: saveData,
    onceVisible: onceVisible,
    watchVisible: watchVisible
  };

  function boot() {
    var roots = document.querySelectorAll('[data-story]');
    for (var i = 0; i < roots.length; i++) {
      var el = roots[i];
      lazy(el.getAttribute('data-story'), el, el.getAttribute('data-story-src'), 700);
    }
    /* Architecture connector: draw once when it scrolls into view. */
    var arch = document.querySelectorAll('[data-arch]');
    for (var j = 0; j < arch.length; j++) {
      (function (a) { onceVisible(a, function () { a.classList.add('is-in'); }, 0.3); })(arch[j]);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
