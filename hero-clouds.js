/**
 * hero-clouds.js — Climactix Global
 * 4-layer parallax cloud animation for the hero section.
 * Renders entirely on a Canvas 2D overlay — no WebGL, no dependencies.
 *
 * Architecture:
 *   · Pre-renders every cloud formation into an offscreen sprite once
 *   · Each frame only does fast drawImage() blits — zero gradient cost at runtime
 *   · 4 depth layers at different scroll speeds → parallax depth illusion
 *   · ISS-perspective foreshortening: top layers flatter, bottom layers taller
 *   · Runs at native 60 fps on GPU-composited canvas (pointer-events: none)
 */
(function () {
  'use strict';

  /* ── Wait for DOM ─────────────────────────────────────────────── */
  function init() {
    const canvas = document.getElementById('heroCloudCanvas');
    if (!canvas) return;

    const hero = canvas.closest('.cx-hero') || canvas.parentElement;
    let W = hero.offsetWidth  || window.innerWidth;
    let H = hero.offsetHeight || window.innerHeight;

    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    /* ── Seeded PRNG so clouds look the same every page load ─────── */
    let _seed = 0xA3F2C1;
    function rand() {
      _seed ^= _seed << 13;
      _seed ^= _seed >> 17;
      _seed ^= _seed << 5;
      return ((_seed >>> 0) / 0xFFFFFFFF);
    }
    function randRange(lo, hi) { return lo + rand() * (hi - lo); }

    /* ══════════════════════════════════════════════════════════════
       CLOUD SPRITE FACTORY
       Each sprite is a cluster of soft radial ellipses drawn once
       onto an offscreen canvas. Runtime cost = zero gradients.
    ══════════════════════════════════════════════════════════════ */
    function makeCloudSprite(opts) {
      const sw   = opts.w;
      const sh   = opts.h;
      const oc   = document.createElement('canvas');
      oc.width   = sw;
      oc.height  = sh;
      const octx = oc.getContext('2d');

      /* Number of blob centres — bigger sprite = more blobs */
      const blobs = opts.blobs || Math.round(6 + rand() * 10);
      const cx    = sw * 0.5;
      const cy    = sh * 0.5;

      for (let i = 0; i < blobs; i++) {
        /* Each blob: random position within the sprite */
        const bx  = cx + randRange(-sw * 0.38, sw * 0.38);
        const by  = cy + randRange(-sh * 0.32, sh * 0.32);
        const rx  = randRange(sw * 0.18, sw * 0.42);
        const ry  = rx * randRange(0.28, 0.55);   /* flat, ISS-foreshortened */
        const rot = randRange(-0.25, 0.25);        /* slight tilt */

        /* Core brightness — outer wispiness */
        const coreAlpha  = opts.alpha * randRange(0.55, 1.0);
        const outerAlpha = opts.alpha * randRange(0.08, 0.22);

        const g = octx.createRadialGradient(bx, by, 0, bx, by, Math.max(rx, ry));
        g.addColorStop(0.00, `rgba(${opts.r},${opts.g},${opts.b},${coreAlpha.toFixed(3)})`);
        g.addColorStop(0.45, `rgba(${opts.r},${opts.g},${opts.b},${(coreAlpha * 0.50).toFixed(3)})`);
        g.addColorStop(0.78, `rgba(${opts.r},${opts.g},${opts.b},${outerAlpha.toFixed(3)})`);
        g.addColorStop(1.00, `rgba(${opts.r},${opts.g},${opts.b},0)`);

        octx.save();
        octx.translate(bx, by);
        octx.rotate(rot);
        octx.scale(1, ry / rx);
        octx.beginPath();
        octx.arc(0, 0, rx, 0, Math.PI * 2);
        octx.fillStyle = g;
        octx.fill();
        octx.restore();
      }

      return oc;
    }

    /* ══════════════════════════════════════════════════════════════
       LAYER DEFINITIONS
       depth 0 = furthest (horizon), depth 3 = closest (foreground)
       ISS perspective: near horizon → flat, small, slow
                        near camera  → tall, large, fast
    ══════════════════════════════════════════════════════════════ */
    const LAYER_DEFS = [
      /* Layer 0 — horizon / background clouds — barely perceptible drift */
      {
        depth:      0,
        count:      14,
        speed:      0.055,          /* px per frame */
        yBand:      [0.05, 0.38],   /* fraction of H */
        wRange:     [W * 0.18, W * 0.32],
        hRatio:     [0.08, 0.14],   /* h as fraction of w — very flat at horizon */
        alpha:      0.055,
        r: 235, g: 242, b: 255,     /* cool blue-white (high altitude) */
      },
      /* Layer 1 — mid-high clouds */
      {
        depth:      1,
        count:      18,
        speed:      0.12,
        yBand:      [0.18, 0.55],
        wRange:     [W * 0.14, W * 0.28],
        hRatio:     [0.12, 0.22],
        alpha:      0.075,
        r: 245, g: 248, b: 255,
      },
      /* Layer 2 — main cloud deck — clearly visible */
      {
        depth:      2,
        count:      22,
        speed:      0.22,
        yBand:      [0.30, 0.78],
        wRange:     [W * 0.10, W * 0.22],
        hRatio:     [0.18, 0.34],
        alpha:      0.095,
        r: 255, g: 255, b: 255,
      },
      /* Layer 3 — foreground wispy streaks — fastest, closest */
      {
        depth:      3,
        count:      26,
        speed:      0.38,
        yBand:      [0.50, 0.95],
        wRange:     [W * 0.06, W * 0.16],
        hRatio:     [0.22, 0.45],
        alpha:      0.060,
        r: 255, g: 252, b: 248,     /* very faint warm tint near surface */
      },
    ];

    /* ── Build layers ──────────────────────────────────────────── */
    const layers = LAYER_DEFS.map(function (def) {
      const clouds = [];
      for (let i = 0; i < def.count; i++) {
        const w = randRange(def.wRange[0], def.wRange[1]);
        const h = w * randRange(def.hRatio[0], def.hRatio[1]);
        const sprite = makeCloudSprite({
          w:     Math.ceil(w + 40),
          h:     Math.ceil(h + 20),
          blobs: Math.round(5 + rand() * 12),
          alpha: def.alpha,
          r:     def.r, g: def.g, b: def.b,
        });
        clouds.push({
          sprite,
          /* Stagger initial x positions across two canvas widths for seamless wrap */
          x:  rand() * W * 2,
          y:  H * (def.yBand[0] + rand() * (def.yBand[1] - def.yBand[0])),
          w,
          h,
          /* Individual speed jitter so each cloud drifts at a slightly different rate */
          speed: def.speed * (0.72 + rand() * 0.56),
          /* Subtle vertical drift — very slow up/down oscillation */
          vyAmp:  H * randRange(0.004, 0.014),
          vyFreq: randRange(0.00008, 0.00025),
          vyPhase: rand() * Math.PI * 2,
          /* Fade in/out near seam edges */
          fadeZone: w * 0.15,
        });
      }
      return { def, clouds };
    });

    /* ══════════════════════════════════════════════════════════════
       RENDER LOOP
    ══════════════════════════════════════════════════════════════ */
    let frame = 0;

    function draw() {
      ctx.clearRect(0, 0, W, H);

      layers.forEach(function (layer) {
        layer.clouds.forEach(function (c) {
          /* Advance position */
          c.x -= c.speed;

          /* Seamless wrap — when fully off left edge, jump to right */
          if (c.x + c.w < 0) {
            c.x = W + rand() * W * 0.5;
            c.y = H * (layer.def.yBand[0] + rand() * (layer.def.yBand[1] - layer.def.yBand[0]));
          }

          /* Vertical oscillation — very subtle breathing */
          const yOff = c.vyAmp * Math.sin(frame * c.vyFreq * Math.PI * 2 + c.vyPhase);

          /* Edge fade — clouds appear/disappear softly at right wrap point */
          let alpha = 1;
          if (c.x > W - c.fadeZone) {
            alpha = (W - c.x) / c.fadeZone;
          } else if (c.x < c.fadeZone - c.w) {
            alpha = (c.x + c.w) / c.fadeZone;
          }

          ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
          ctx.drawImage(c.sprite, c.x, c.y + yOff, c.w, c.h);
        });
      });

      ctx.globalAlpha = 1;
      frame++;
      requestAnimationFrame(draw);
    }

    /* ── Resize handler ───────────────────────────────────────── */
    let resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        W = hero.offsetWidth  || window.innerWidth;
        H = hero.offsetHeight || window.innerHeight;
        canvas.width  = W;
        canvas.height = H;
      }, 120);
    });

    /* ── Pause when tab is hidden (saves CPU/GPU) ─────────────── */
    let running = true;
    document.addEventListener('visibilitychange', function () {
      running = !document.hidden;
      if (running) requestAnimationFrame(draw);
    });

    /* ── Kick off ─────────────────────────────────────────────── */
    requestAnimationFrame(draw);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
