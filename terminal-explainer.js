/* ════════════════════════════════════════════════════════════════════
   CLIMACTIX TERMINAL — "HOW THE TERMINAL WORKS" EXPLAINER VIDEO
   A self-contained video component. Drop
       <div data-cx-explainer></div>
   anywhere; this file injects its own styles and mounts itself.

   The video (terminal-film-assets/how-it-works.mp4) is its own rendered,
   48-second, six-scene explainer composed in terminal-explainer-src/,
   separate from the product film. Frame 0 and the last frame match,
   so it loops without a visible cut.
   Behaviour:
     - loads and plays only when the section is on screen; pauses off it
     - loops, muted by default, no player controls
     - one optional sound switch
     - a slim scene strip shows where the film is; selecting a scene
       jumps to it
     - under prefers-reduced-motion, or if the browser refuses autoplay,
       the poster is shown with a play button instead

   Exports window.CXExplainer { mount(root) }.
   ════════════════════════════════════════════════════════════════════ */
window.CXExplainer = (function () {
  'use strict';

  var SRC = 'terminal-film-assets/how-it-works.mp4', POSTER = 'terminal-film-assets/how-it-works.jpg';
  /* scene start times in the rendered cut, seconds */
  var SCENES = [[0, 'Fragmented information'], [8, 'Centralised intelligence'], [16, 'Assessment'], [24, 'Intelligence Score'], [31, 'Institutional decisions'], [41, 'Business impact']];
  var DUR = 48;

  var CSS = '.cxe{margin:0;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif}' +
    '.cxe *{box-sizing:border-box}' +
    '.cxe-stage{position:relative;background:#FAF8F3;display:flex;justify-content:center;overflow:hidden}' +
    '.cxe video{display:block;width:100%;max-width:1040px;aspect-ratio:16/9;height:auto;background:#FAF8F3}' +
    '.cxe-snd,.cxe-play{position:absolute;display:inline-flex;align-items:center;gap:8px;border:1px solid #DCE1E8;background:rgba(255,255,255,.94);color:#0B1F3A;font:600 13px/1 "Helvetica Neue",Helvetica,Arial,sans-serif;border-radius:999px;cursor:pointer;transition:border-color .18s ease,transform .15s ease,opacity .2s ease}' +
    '.cxe-snd{right:16px;bottom:16px;height:36px;padding:0 14px;opacity:.72}' +
    '.cxe-stage:hover .cxe-snd,.cxe-snd:focus-visible,.cxe-snd[aria-pressed="true"]{opacity:1}' +
    '.cxe-play{left:50%;top:50%;transform:translate(-50%,-50%);height:52px;padding:0 24px;font-size:15px;background:#1D4FD8;border-color:#1D4FD8;color:#fff}' +
    '.cxe-play[hidden]{display:none}' +
    '.cxe-snd:hover{border-color:#1D4FD8}.cxe-snd:active{transform:translateY(1px)}' +
    '.cxe-snd:focus-visible,.cxe-play:focus-visible,.cxe-sc:focus-visible{outline:2px solid #1D4FD8;outline-offset:2px}' +
    '.cxe-scenes{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));border-top:1px solid var(--border-soft,#E3E7ED)}' +
    '.cxe-sc{position:relative;display:block;width:100%;padding:12px 12px 14px;border:0;background:none;text-align:left;cursor:pointer;font:500 13px/1.3 "Helvetica Neue",Helvetica,Arial,sans-serif;color:var(--text-muted,#7A8799);transition:color .18s ease,background .18s ease}' +
    '.cxe-sc:hover{background:var(--card-2,#F3F5F8);color:var(--text,#0B1F3A)}' +
    '.cxe-sc i{display:block;font-style:normal;font-size:11px;font-weight:700;letter-spacing:.08em;margin-bottom:2px}' +
    '.cxe-sc u{position:absolute;left:0;right:0;top:-1px;height:2px;background:var(--accent,#1D4FD8);transform-origin:0 50%;transform:scaleX(0)}' +
    '.cxe-sc[aria-current="true"]{color:var(--text,#0B1F3A)}.cxe-sc[aria-current="true"] i{color:var(--accent,#1D4FD8)}' +
    '.cxe-sc.done u{transform:scaleX(1);opacity:.35}' +
    '@media (max-width:720px){.cxe-scenes{grid-template-columns:repeat(3,minmax(0,1fr))}.cxe-sc{padding:8px 8px 10px;font-size:12px}.cxe-snd span{display:none}.cxe-snd{padding:0 10px}}';

  var ON = '<svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 7v4h2.6L9 14V4L5.6 7z" fill="currentColor"/><path d="M11.5 6.5a3.5 3.5 0 0 1 0 5M13.3 4.6a6.2 6.2 0 0 1 0 8.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  var OFF = '<svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 7v4h2.6L9 14V4L5.6 7z" fill="currentColor"/><path d="M12 7l4 4M16 7l-4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

  var styled = false;
  function create(el) {
    el.setAttribute('data-cxe-on', '');
    if (!styled) { styled = true; var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.innerHTML = '<figure class="cxe"><div class="cxe-stage">' +
      '<video muted loop playsinline preload="none" poster="' + POSTER + '" aria-label="How the Terminal works: a 48-second explainer in six scenes, from fragmented disclosures to institutional decisions"></video>' +
      '<button type="button" class="cxe-snd" aria-pressed="false" aria-label="Turn sound on">' + OFF + '<span>Sound off</span></button>' +
      '<button type="button" class="cxe-play" hidden>Play the film</button></div>' +
      '<ol class="cxe-scenes" aria-label="Scenes">' + SCENES.map(function (s, i) {
        return '<li><button type="button" class="cxe-sc" data-i="' + i + '"><u></u><i>0' + (i + 1) + '</i>' + s[1] + '</button></li>';
      }).join('') + '</ol></figure>';

    var v = el.querySelector('video'), snd = el.querySelector('.cxe-snd'), playBtn = el.querySelector('.cxe-play'), items = el.querySelectorAll('.cxe-sc');
    var loaded = false, wanted = false, cur = -1;
    v.muted = true; v.defaultMuted = true;

    function load() { if (!loaded) { loaded = true; v.src = SRC; } }
    function play() {
      load();
      var p = v.play();
      /* only a real autoplay refusal shows the button; an interrupted play() (scrolled away mid-load) does not */
      if (p && p.catch) p.catch(function (e) { if (e && e.name === 'NotAllowedError') playBtn.hidden = false; });
    }
    function mark() {
      var t = v.currentTime || 0, k = 0;
      for (var i = 0; i < SCENES.length; i++) if (t >= SCENES[i][0]) k = i;
      var end = k + 1 < SCENES.length ? SCENES[k + 1][0] : DUR, p = Math.min(1, (t - SCENES[k][0]) / (end - SCENES[k][0]));
      if (k !== cur) {
        cur = k;
        Array.prototype.forEach.call(items, function (b, i) {
          if (i === k) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
          b.classList.toggle('done', i < k);
          if (i !== k) b.firstChild.style.transform = '';
        });
      }
      items[k].firstChild.style.transform = 'scaleX(' + p.toFixed(3) + ')';
    }

    v.addEventListener('timeupdate', mark);
    v.addEventListener('playing', function () { playBtn.hidden = true; });
    snd.addEventListener('click', function () {
      v.muted = !v.muted;
      snd.setAttribute('aria-pressed', String(!v.muted));
      snd.setAttribute('aria-label', v.muted ? 'Turn sound on' : 'Turn sound off');
      snd.innerHTML = (v.muted ? OFF : ON) + '<span>' + (v.muted ? 'Sound off' : 'Sound on') + '</span>';
      if (v.paused) play();
    });
    playBtn.addEventListener('click', function () { wanted = true; play(); });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('.cxe-sc'); if (!b) return;
      load();
      var go = function () { v.currentTime = SCENES[+b.getAttribute('data-i')][0] + 0.05; mark(); play(); };
      if (v.readyState >= 1) go(); else v.addEventListener('loadedmetadata', go, { once: true });
    });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) {
        if (!el.isConnected) { io.disconnect(); return; }
        var vis = en[en.length - 1].isIntersecting;
        if (vis) { if (!reduced || wanted) play(); else playBtn.hidden = false; }
        else if (!v.paused) v.pause();
      }, { threshold: 0.35 });
      io.observe(el);
    } else if (!reduced) play(); else playBtn.hidden = false;
    document.addEventListener('visibilitychange', function () { if (document.hidden && !v.paused) v.pause(); });
    mark();
  }

  function mount(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('[data-cx-explainer]:not([data-cxe-on])'), create);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mount(); }); else mount();
  return { mount: mount, scenes: SCENES };
})();
