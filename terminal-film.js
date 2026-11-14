/* ════════════════════════════════════════════════════════════════════
   CLIMACTIX TERMINAL — PRODUCT FILM · PLAYER
   A single-clock, frame-accurate film rendered live in the browser.

   Every scene is a pure function of time: render(t) paints the complete
   frame for any t, so the film can be paused, scrubbed, replayed and
   captured to video without drift. Scenes register themselves from
   terminal-film-scenes.js via CXFilm.scene({...}) and are independent
   modules — retime or rewrite one without touching the others.

   Exports window.CXFilm { open(), close(), seek(t), scene(), caption() }
   ════════════════════════════════════════════════════════════════════ */
window.CXFilm = (function () {
  'use strict';

  var DUR = 110, W = 1920, H = 1080, ASSET = 'terminal-film-assets/';
  var scenes = [], caps = [], cues = [], chapters = [];
  var built = false, t = 0, playing = false, lastNow = 0, raf = 0, muted = false, ended = false, scale = 1;
  var root, frameEl, stage, bg, bgx, capIn, capBar, endLayer, ctl, scrub, timeEl, btnPlay, btnMute, hideTimer = 0, returnFocus = null;
  var ctx = null;

  /* ── Maths ─────────────────────────────────────────────────────── */
  var u = {
    c01: function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; },
    seg: function (t, a, b) { var x = (t - a) / (b - a); return x < 0 ? 0 : x > 1 ? 1 : x; },
    lerp: function (a, b, p) { return a + (b - a) * p; },
    eio: function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
    eo: function (x) { return 1 - Math.pow(1 - x, 3); },
    eox: function (x) { return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); },
    /* fade in over [a,b], hold, fade out over [c,d] */
    win: function (t, a, b, c, d) { return Math.min(u.seg(t, a, b), 1 - u.seg(t, c, d)); },
    /* keyframes: [[time, v1, v2, ...], ...] → interpolated array */
    kf: function (t, keys, ease) {
      if (t <= keys[0][0]) return keys[0].slice(1);
      for (var i = 1; i < keys.length; i++) {
        if (t <= keys[i][0]) {
          var a = keys[i - 1], b = keys[i], p = (ease || u.eio)((t - a[0]) / (b[0] - a[0])), out = [];
          for (var k = 1; k < a.length; k++) out.push(a[k] + (b[k] - a[k]) * p);
          return out;
        }
      }
      return keys[keys.length - 1].slice(1);
    },
    rng: function (seed) {                       // deterministic generator (mulberry32)
      return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        var r = Math.imul(seed ^ seed >>> 15, 1 | seed);
        r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r;
        return ((r ^ r >>> 14) >>> 0) / 4294967296;
      };
    }
  };

  /* ── DOM helpers (all writes are cached so idle frames cost nothing) ── */
  function el(parent, cls, html, css) {
    var e = document.createElement('div');
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (css) e.style.cssText = css;
    parent.appendChild(e);
    return e;
  }
  function st(e, op, tr) {
    if (op !== undefined) {
      op = op < 0.004 ? 0 : op > 0.996 ? 1 : Math.round(op * 1000) / 1000;
      if (e._o !== op) { e._o = op; e.style.opacity = op; e.style.visibility = op === 0 ? 'hidden' : 'visible'; }
    }
    if (tr !== undefined && e._t !== tr) { e._t = tr; e.style.transform = tr; }
  }
  function rise(e, p, dist) { st(e, p, 'translate3d(0,' + ((1 - u.eo(p)) * (dist == null ? 16 : dist)).toFixed(2) + 'px,0)'); }
  function tx(e, s) { if (e._x !== s) { e._x = s; e.textContent = s; } }
  function css(e, prop, v) { var k = '_c' + prop; if (e[k] !== v) { e[k] = v; e.style[prop] = v; } }

  /* ── Audio: a restrained procedural score, driven by the same clock ── */
  var ac = null, master, padG, lp, shG, live;
  var PAD = [[0, 0], [2, 0.22], [13, 0.26], [19, 0.42], [27, 0.28], [44, 0.32], [54, 0.44], [59, 0.28], [87, 0.36], [96, 0.42], [102, 0.36], [108, 0.1], [110, 0]];
  var CUT = [[0, 260], [19, 950], [27, 500], [54, 1400], [59, 650], [94, 1200], [110, 300]];
  var SHM = [[0, 0], [16, 0], [19, 0.03], [26, 0.012], [51, 0.012], [54.5, 0.04], [59, 0.01], [88, 0.015], [96, 0.04], [102, 0.03], [109, 0]];
  function graph(A) {
    var g = {};
    g.master = A.createGain(); g.master.gain.value = 0.8; g.master.connect(A.destination);
    g.lp = A.createBiquadFilter(); g.lp.type = 'lowpass'; g.lp.frequency.value = 220;
    g.padG = A.createGain(); g.padG.gain.value = 0; g.lp.connect(g.padG); g.padG.connect(g.master);
    [[55, 'sine', 0.5], [82.5, 'sine', 0.34], [110.4, 'triangle', 0.16], [164.9, 'triangle', 0.07]].forEach(function (v) {
      var o = A.createOscillator(), n = A.createGain();
      o.type = v[1]; o.frequency.value = v[0]; n.gain.value = v[2]; o.connect(n); n.connect(g.lp); o.start();
    });
    g.shG = A.createGain(); g.shG.gain.value = 0; g.shG.connect(g.master);
    [659.3, 987.8, 1318.5].forEach(function (f, i) {
      var o = A.createOscillator(), n = A.createGain();
      o.type = 'sine'; o.frequency.value = f; n.gain.value = [0.5, 0.3, 0.14][i]; o.connect(n); n.connect(g.shG); o.start();
    });
    return g;
  }
  function levels(g, time, when) {
    g.padG.gain.setTargetAtTime(u.kf(time, PAD)[0], when, 0.12);
    g.lp.frequency.setTargetAtTime(u.kf(time, CUT)[0], when, 0.12);
    g.shG.gain.setTargetAtTime(u.kf(time, SHM)[0], when, 0.12);
  }
  function blipAt(A, out, type, now) {
    var o = A.createOscillator(), g = A.createGain();
    o.connect(g); g.connect(out);
    if (type === 'hit') {
      o.type = 'sine'; o.frequency.setValueAtTime(82, now); o.frequency.exponentialRampToValueAtTime(38, now + 0.5);
      g.gain.setValueAtTime(0.4, now); g.gain.exponentialRampToValueAtTime(0.0005, now + 0.9);
      o.start(now); o.stop(now + 0.95);
    } else if (type === 'soft') {
      o.type = 'sine'; o.frequency.setValueAtTime(880, now);
      g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.05, now + 0.02); g.gain.exponentialRampToValueAtTime(0.0005, now + 0.35);
      o.start(now); o.stop(now + 0.4);
    } else {
      o.type = 'sine'; o.frequency.setValueAtTime(1500, now); o.frequency.exponentialRampToValueAtTime(900, now + 0.04);
      g.gain.setValueAtTime(0.028, now); g.gain.exponentialRampToValueAtTime(0.0005, now + 0.05);
      o.start(now); o.stop(now + 0.06);
    }
  }
  function audioInit() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || ac) return;
    try {
      ac = new AC();
      var g = graph(ac);
      master = g.master; padG = g.padG; lp = g.lp; shG = g.shG; live = g;
      master.gain.value = muted ? 0 : 0.8;
    } catch (e) { ac = null; }
  }
  function audioFrame() { if (ac) levels(live, t, ac.currentTime); }
  function blip(type) { if (ac && !muted) blipAt(ac, master, type, ac.currentTime); }
  /* Renders the same score offline (used when exporting the film to a video file). */
  function renderAudio(rate) {
    if (!built) build();
    var A = new OfflineAudioContext(2, Math.ceil((rate || 48000) * DUR), rate || 48000), g = graph(A);
    for (var x = 0; x < DUR; x += 0.1) levels(g, x, x);
    cues.forEach(function (c) { blipAt(A, g.master, c.type, c.t); });
    return A.startRendering();
  }

  /* ── Footage: real video clips slaved to the film clock ──────────
     A scene asks for a clip position each frame with ctx.clip(handle, seconds, rate).
     While the film plays the clip runs natively and is only corrected for drift;
     when paused, scrubbed or captured frame by frame it is seeked exactly. */
  var vids = [];
  function mkVideo(parent, name, cls) {
    var v = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
    v.preload = 'auto'; v.poster = ASSET + name + '.jpg'; v.src = ASSET + name + '.mp4'; v.className = 'cxf-v ' + (cls || '');
    parent.appendChild(v);
    var o = { v: v, req: null, rate: 1 };
    vids.push(o);
    return o;
  }
  function want(o) { var d = o.v.duration; return !d || isNaN(d) ? null : Math.max(0, Math.min(o.req, d - 0.05)); }
  function syncVideos() {
    for (var i = 0; i < vids.length; i++) {
      var o = vids[i], v = o.v;
      if (o.req == null) { if (!v.paused) v.pause(); continue; }
      var w = want(o); if (w == null) continue;
      if (playing && o.req < v.duration - 0.05) {
        if (v.playbackRate !== o.rate) v.playbackRate = o.rate;
        if (Math.abs(v.currentTime - w) > 0.35) v.currentTime = w;
        if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      } else {
        if (!v.paused) v.pause();
        if (!v.seeking && Math.abs(v.currentTime - w) > 0.03) v.currentTime = w;
      }
    }
  }
  /* resolves once every requested clip shows the requested frame (used by the video export) */
  function settle() {
    return new Promise(function (res) {
      var n = 0;
      (function chk() {
        var ok = true;
        vids.forEach(function (o) {
          if (o.req == null) return;
          var w = want(o);
          if (w == null || o.v.readyState < 2 || o.v.seeking) { ok = false; return; }
          if (Math.abs(o.v.currentTime - w) > 0.04) { ok = false; o.v.currentTime = w; }
        });
        if (ok || ++n > 400) res(); else setTimeout(chk, 10);
      })();
    });
  }

  /* ── Build ─────────────────────────────────────────────────────── */
  var ICON = {
    play: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M5 3.5v11l9-5.5z" fill="currentColor"/></svg>',
    pause: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M5 3.5h3v11H5zM10 3.5h3v11h-3z" fill="currentColor"/></svg>',
    replay: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3.5 9a5.5 5.5 0 1 0 1.8-4.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M3 2.8v3.4h3.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    sound: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 7v4h2.6L9 14V4L5.6 7z" fill="currentColor"/><path d="M11.5 6.5a3.5 3.5 0 0 1 0 5M13.3 4.6a6.2 6.2 0 0 1 0 8.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    muted: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 7v4h2.6L9 14V4L5.6 7z" fill="currentColor"/><path d="M12 7l4 4M16 7l-4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    full: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 7V3h4M11 3h4v4M15 11v4h-4M7 15H3v-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
  };
  function button(parent, cls, label, icon, fn) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'cxf-b ' + cls; b.setAttribute('aria-label', label); b.title = label; b.innerHTML = icon;
    b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
    parent.appendChild(b);
    return b;
  }

  function build() {
    root = el(document.body, 'cxf-root');
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Climactix Terminal product walkthrough');
    frameEl = el(root, 'cxf-frame');
    stage = el(frameEl, 'cxf-stage');
    bg = document.createElement('canvas'); bg.width = W; bg.height = H; bg.className = 'cxf-bg'; stage.appendChild(bg);
    bgx = bg.getContext('2d');

    ctx = { stage: stage, bg: bgx, W: W, H: H, D: window.CX_TERMINAL_DEMO, u: u, el: el, st: st, rise: rise, tx: tx, css: css,
            cue: function (time, type) { cues.push({ t: time, type: type || 'tick' }); }, term: null, endLayer: null,
            video: mkVideo, clip: function (o, time, rate) { o.req = time; o.rate = rate || 1; } };

    scenes.forEach(function (s) {
      s.els = [];
      if (!s.noRoot) { s.root = el(stage, 'cxf-s cxf-s-' + s.id); s.els.push(s.root); }
      s.build(ctx, s);
      s._on = null;
    });
    cues.sort(function (a, b) { return a.t - b.t; });

    capIn = el(stage, 'cxf-cap');
    el(stage, 'cxf-demo', 'Demonstration data · illustrative');
    endLayer = el(frameEl, 'cxf-end',
      '<a class="cxf-cta cxf-cta-p" href="terminal-walkthrough.html">Explore the Terminal</a>' +
      '<a class="cxf-cta" href="#contact" data-cxf-contact>Request Institutional Access</a>');
    ctx.endLayer = endLayer;
    endLayer.querySelector('[data-cxf-contact]').addEventListener('click', function (e) {
      var target = document.getElementById('contact');
      if (target) { e.preventDefault(); close(); target.scrollIntoView(); } else this.href = 'index.html#contact';
    });
    capBar = el(root, 'cxf-capbar');

    button(root, 'cxf-x', 'Close walkthrough', ICON.close, close);
    ctl = el(root, 'cxf-ctl');
    btnPlay = button(ctl, 'cxf-pp', 'Pause', ICON.pause, toggle);
    button(ctl, '', 'Replay from the start', ICON.replay, function () { seek(0); play(); });
    timeEl = el(ctl, 'cxf-time', '0:00 / 1:50');
    var track = el(ctl, 'cxf-track');
    scrub = document.createElement('input');
    scrub.type = 'range'; scrub.min = 0; scrub.max = DUR; scrub.step = 0.05; scrub.value = 0; scrub.className = 'cxf-scrub';
    scrub.setAttribute('aria-label', 'Seek');
    scrub.addEventListener('input', function () { seek(+scrub.value); });
    track.appendChild(scrub);
    chapters.forEach(function (c) { if (c.t > 0) el(track, 'cxf-mark', '', 'left:' + (c.t / DUR * 100) + '%'); });
    btnMute = button(ctl, '', 'Mute sound', ICON.sound, function () { setMuted(!muted); });
    if (root.requestFullscreen || root.webkitRequestFullscreen) button(ctl, '', 'Full screen', ICON.full, fullscreen);

    root.addEventListener('click', function (e) { if (e.target.closest('.cxf-ctl, .cxf-end, .cxf-x')) return; toggle(); });
    root.addEventListener('mousemove', wake);
    root.addEventListener('touchstart', wake, { passive: true });
    window.addEventListener('resize', fit);
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', function () { if (document.hidden && playing) pause(); });
    built = true;
  }

  /* ── Layout ────────────────────────────────────────────────────── */
  function fit() {
    if (!root) return;
    var vw = root.clientWidth, vh = root.clientHeight;
    var small = vw < 900 || vh < 520;
    var reserve = small ? 132 : 0;                      // room for the caption bar and controls on small screens
    scale = Math.min(vw / W, (vh - reserve) / H);
    var w = W * scale, h = H * scale;
    frameEl.style.width = w + 'px'; frameEl.style.height = h + 'px';
    frameEl.style.left = (vw - w) / 2 + 'px';
    frameEl.style.top = Math.max(0, (vh - reserve - h) / 2) + 'px';
    stage.style.transform = 'scale(' + scale + ')';
    root.classList.toggle('cxf-small', small);
    endLayer.style.fontSize = Math.max(12, Math.min(22, 24 * scale)) + 'px';
    capBar.style.top = (Math.max(0, (vh - reserve - h) / 2) + h + 12) + 'px';
  }

  /* ── Clock ─────────────────────────────────────────────────────── */
  function fmt(s) { s = Math.floor(s); return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + s % 60; }
  function active(s, time) {
    for (var i = 0; i < s.ranges.length; i++) if (time >= s.ranges[i][0] && time < s.ranges[i][1]) return true;
    return false;
  }
  function render() {
    bgx.clearRect(0, 0, W, H);
    for (var q = 0; q < vids.length; q++) vids[q].req = null;
    for (var i = 0; i < scenes.length; i++) {
      var s = scenes[i], on = active(s, t);
      if (on !== s._on) { s._on = on; for (var k = 0; k < s.els.length; k++) s.els[k].style.display = on ? '' : 'none'; }
      if (on) s.frame(t, ctx);
    }
    syncVideos();
    var text = '', op = 0, photo = false;
    for (var c = 0; c < caps.length; c++) {
      if (t >= caps[c].a && t < caps[c].b) { text = caps[c].text; photo = !!caps[c].photo; op = u.win(t, caps[c].a, caps[c].a + 0.5, caps[c].b - 0.5, caps[c].b); }
    }
    if (text) { tx(capIn, text); tx(capBar, text); if (capIn._ph !== photo) { capIn._ph = photo; capIn.classList.toggle('cxf-onphoto', photo); } }
    st(capIn, op); st(capBar, op);
    var cta = t >= 104.8;
    if (endLayer._on !== cta) { endLayer._on = cta; endLayer.classList.toggle('on', cta); }
    if (document.activeElement !== scrub) scrub.value = t;
    scrub.style.setProperty('--p', (t / DUR * 100) + '%');
    tx(timeEl, fmt(t) + ' / ' + fmt(DUR));
  }
  function tick(now) {
    if (!playing) return;
    var dt = Math.min(0.1, (now - lastNow) / 1000), prev = t;
    lastNow = now;
    t = Math.min(DUR, t + dt);
    for (var i = 0; i < cues.length; i++) { if (cues[i].t > prev && cues[i].t <= t) blip(cues[i].type); if (cues[i].t > t) break; }
    audioFrame();
    render();
    if (t >= DUR) { ended = true; pause(); wake(); return; }
    raf = requestAnimationFrame(tick);
  }
  function setPlayUi() {
    btnPlay.innerHTML = playing ? ICON.pause : ICON.play;
    btnPlay.setAttribute('aria-label', playing ? 'Pause' : 'Play'); btnPlay.title = playing ? 'Pause' : 'Play';
    root.classList.toggle('cxf-paused', !playing);
  }
  function play() {
    if (playing) return;
    if (t >= DUR) { t = 0; }
    ended = false; playing = true;
    audioInit(); if (ac && ac.state === 'suspended') ac.resume();
    lastNow = performance.now();
    raf = requestAnimationFrame(tick);
    setPlayUi(); wake();
  }
  function pause() {
    playing = false; cancelAnimationFrame(raf);
    if (ac && ac.state === 'running') ac.suspend();
    setPlayUi(); root.classList.remove('cxf-idle');
  }
  function toggle() { if (playing) pause(); else play(); }
  function seek(time) { t = Math.max(0, Math.min(DUR, time)); ended = t >= DUR; render(); }
  function setMuted(m) {
    muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ac.currentTime, 0.03);
    btnMute.innerHTML = m ? ICON.muted : ICON.sound;
    btnMute.setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound'); btnMute.title = m ? 'Unmute sound' : 'Mute sound';
  }
  function fullscreen() {
    var fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (fs) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
  }
  function wake() {
    root.classList.remove('cxf-idle');
    clearTimeout(hideTimer);
    if (playing) hideTimer = setTimeout(function () { if (playing) root.classList.add('cxf-idle'); }, 2600);
  }
  function onKey(e) {
    if (!root || !root.classList.contains('cxf-open')) return;
    if (e.key === 'Escape') { if (!(document.fullscreenElement || document.webkitFullscreenElement)) close(); }
    else if (e.key === ' ' && e.target === document.body || e.key === 'k') { e.preventDefault(); toggle(); }
    else if (e.key === 'm') setMuted(!muted);
    else if (e.key === 'f') fullscreen();
    else if (e.key === 'ArrowRight' && e.target !== scrub) seek(t + 5);
    else if (e.key === 'ArrowLeft' && e.target !== scrub) seek(t - 5);
    wake();
  }

  /* ── Public ────────────────────────────────────────────────────── */
  function open(opts) {
    opts = opts || {};
    if (!built) build();
    returnFocus = document.activeElement;
    root.classList.add('cxf-open');
    document.documentElement.classList.add('cxf-lock');
    fit(); seek(opts.at || 0);
    btnPlay.focus();
    if (opts.autoplay === false) { setPlayUi(); } else play();
  }
  function close() {
    if (!root) return;
    pause();
    if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    root.classList.remove('cxf-open');
    document.documentElement.classList.remove('cxf-lock');
    if (returnFocus && returnFocus.focus) returnFocus.focus();
  }

  return {
    DUR: DUR, u: u,
    scene: function (def) { scenes.push(def); if (def.chapter) chapters.push({ t: def.ranges[0][0], name: def.chapter }); },
    caption: function (a, b, text, photo) { caps.push({ a: a, b: b, text: text, photo: photo }); },
    open: open, close: close, seek: seek, play: play, pause: pause,
    renderAudio: renderAudio, settle: settle,
    time: function () { return t; }, isPlaying: function () { return playing; }, setMuted: setMuted
  };
})();
