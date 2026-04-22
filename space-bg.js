/* ============================================================
   Climactix Global — Atmospheric Earth Background Engine
   Living climate system · Sky · Clouds · Wind · Light
   ============================================================ */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────────
     SECTION ATMOSPHERE MAP
     Defines each section's atmospheric biome based on scroll %
  ───────────────────────────────────────────────────────────── */
  const BIOMES = [
    // [scroll%, topSkyHex, bottomSkyHex, cloudAlpha, haze, sunIntensity, label]
    [0.00, '#0d2a4a', '#1a4a7a', 0.55, 0.12, 0.60, 'dawn'],        // Hero: pre-dawn
    [0.08, '#0a1e38', '#152e52', 0.40, 0.15, 0.35, 'troposphere'], // Ticker
    [0.16, '#1a0f0a', '#2c1a10', 0.25, 0.30, 0.20, 'heat'],        // Heatmap
    [0.24, '#0c1e34', '#1a3558', 0.60, 0.18, 0.40, 'sky'],         // Concerns
    [0.32, '#080e1c', '#10203a', 0.50, 0.22, 0.25, 'stratosphere'],// Frameworks
    [0.40, '#0a1628', '#0e2040', 0.45, 0.20, 0.30, 'ocean'],       // Vision/Mission
    [0.48, '#14181e', '#1e2838', 0.70, 0.35, 0.15, 'overcast'],    // Calculator/Problems
    [0.56, '#0c1e32', '#18304e', 0.55, 0.25, 0.35, 'clearing'],    // Solutions
    [0.64, '#081828', '#102030', 0.40, 0.18, 0.28, 'architecture'],// Architecture
    [0.72, '#0a1c36', '#163050', 0.50, 0.20, 0.38, 'stratosphere'],// ESG Engine
    [0.80, '#061420', '#0e2435', 0.45, 0.22, 0.30, 'ocean-deep'],  // Green Bonds
    [0.88, '#0c1e38', '#162e50', 0.55, 0.20, 0.35, 'evening'],     // Contact
    [1.00, '#050e1c', '#0c1a2e', 0.60, 0.28, 0.20, 'dusk'],        // Footer
  ];

  /* ─────────────────────────────────────────────────────────────
     1. SKY SYSTEM — Canvas gradient background
  ───────────────────────────────────────────────────────────── */
  const SkySystem = {
    canvas: null, ctx: null,
    scrollFraction: 0,
    targetFraction: 0,
    currentTop: [13, 42, 74],      // RGB
    currentBot: [26, 74, 122],
    targetTop:  [13, 42, 74],
    targetBot:  [26, 74, 122],

    init() {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'sky-canvas';
      Object.assign(this.canvas.style, {
        position: 'fixed', top: 0, left: 0,
        width: '100%', height: '100%',
        zIndex: '-3', pointerEvents: 'none',
      });
      document.body.insertBefore(this.canvas, document.body.firstChild);
      this.ctx = this.canvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', () => this.resize(), { passive: true });
      window.addEventListener('scroll', () => {
        this.targetFraction = Math.min(1, window.scrollY / (document.documentElement.scrollHeight - window.innerHeight || 1));
      }, { passive: true });
      this.loop();
    },

    resize() {
      this.canvas.width  = window.innerWidth;
      this.canvas.height = window.innerHeight;
    },

    hexToRgb(hex) {
      const r = parseInt(hex.slice(1,3),16);
      const g = parseInt(hex.slice(3,5),16);
      const b = parseInt(hex.slice(5,7),16);
      return [r, g, b];
    },

    getBiome(frac) {
      let b0 = BIOMES[0], b1 = BIOMES[BIOMES.length - 1];
      for (let i = 0; i < BIOMES.length - 1; i++) {
        if (frac >= BIOMES[i][0] && frac <= BIOMES[i+1][0]) {
          b0 = BIOMES[i]; b1 = BIOMES[i+1]; break;
        }
      }
      const range = b1[0] - b0[0] || 0.001;
      const t = (frac - b0[0]) / range;
      const ease = t * t * (3 - 2 * t); // smoothstep
      const topRgb = this.hexToRgb(b0[1]).map((v,i) => v + (this.hexToRgb(b1[1])[i] - v) * ease);
      const botRgb = this.hexToRgb(b0[2]).map((v,i) => v + (this.hexToRgb(b1[2])[i] - v) * ease);
      return { topRgb, botRgb, cloudAlpha: b0[3] + (b1[3] - b0[3]) * ease };
    },

    loop() {
      this.scrollFraction += (this.targetFraction - this.scrollFraction) * 0.035;
      const biome = this.getBiome(this.scrollFraction);

      // Lerp colours
      for (let i = 0; i < 3; i++) {
        this.currentTop[i] += (biome.topRgb[i] - this.currentTop[i]) * 0.04;
        this.currentBot[i] += (biome.botRgb[i] - this.currentBot[i]) * 0.04;
      }

      const ctx = this.ctx;
      const W = this.canvas.width, H = this.canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Main sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad.addColorStop(0, `rgb(${this.currentTop.map(Math.round).join(',')})`);
      skyGrad.addColorStop(0.55, `rgb(${this.currentBot.map(Math.round).join(',')})`);
      skyGrad.addColorStop(1,   `rgb(${this.currentBot.map(v => Math.round(v * 0.7)).join(',')})`);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);

      // Atmospheric haze band (horizon glow)
      const hazeY = H * 0.55;
      const hazeGrad = ctx.createRadialGradient(W * 0.5, hazeY, 0, W * 0.5, hazeY, W * 0.6);
      const sf = this.scrollFraction;
      // Dawn: warm amber, midday: blue-white, storm: grey, evening: warm
      let hazeR, hazeG, hazeB;
      if (sf < 0.12)      { hazeR = 200; hazeG = 130; hazeB = 60; }
      else if (sf < 0.35) { hazeR = 100; hazeG = 160; hazeB = 210; }
      else if (sf < 0.55) { hazeR = 80;  hazeG = 90;  hazeB = 110; }
      else if (sf < 0.75) { hazeR = 120; hazeG = 170; hazeB = 210; }
      else                { hazeR = 170; hazeG = 120; hazeB = 60;  }

      hazeGrad.addColorStop(0, `rgba(${hazeR},${hazeG},${hazeB},0.07)`);
      hazeGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = hazeGrad;
      ctx.fillRect(0, 0, W, H);

      requestAnimationFrame(() => this.loop());
    }
  };

  /* ─────────────────────────────────────────────────────────────
     2. CLOUD SYSTEM — Layered cumulus clouds
  ───────────────────────────────────────────────────────────── */
  const CloudSystem = {
    canvas: null, ctx: null,
    layers: [],
    mouse: { x: 0, y: 0 },
    time: 0,

    init() {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'cloud-canvas';
      Object.assign(this.canvas.style, {
        position: 'fixed', top: 0, left: 0,
        width: '100%', height: '100%',
        zIndex: '-2', pointerEvents: 'none',
        mixBlendMode: 'screen',
      });
      document.body.insertBefore(this.canvas, document.body.firstChild);
      this.ctx = this.canvas.getContext('2d');
      this.resize();
      this.buildClouds();
      window.addEventListener('resize', () => { this.resize(); this.buildClouds(); }, { passive: true });
      window.addEventListener('mousemove', e => {
        this.mouse.x = (e.clientX / window.innerWidth  - 0.5);
        this.mouse.y = (e.clientY / window.innerHeight - 0.5);
      }, { passive: true });
      this.loop();
    },

    resize() {
      this.canvas.width  = window.innerWidth;
      this.canvas.height = window.innerHeight;
    },

    buildClouds() {
      this.layers = [];
      const W = this.canvas.width, H = this.canvas.height;

      // 3 cloud layers: far (slow, faint), mid, near (faster, opaque)
      const layerCfg = [
        { count: 4, yBand: [0.04, 0.25], speedX: 0.015, speedY: 0.004, scale: 0.9, alpha: 0.05, parallax: 0.3 },
        { count: 5, yBand: [0.10, 0.38], speedX: 0.025, speedY: 0.006, scale: 1.1, alpha: 0.07, parallax: 0.6 },
        { count: 3, yBand: [0.18, 0.42], speedX: 0.040, speedY: 0.008, scale: 1.3, alpha: 0.05, parallax: 1.0 },
      ];

      layerCfg.forEach((cfg, li) => {
        for (let i = 0; i < cfg.count; i++) {
          const puffs = [];
          const cx = (Math.random() * 1.6 - 0.3) * W;
          const cy = (cfg.yBand[0] + Math.random() * (cfg.yBand[1] - cfg.yBand[0])) * H;
          const puffCount = 4 + Math.floor(Math.random() * 5);
          for (let p = 0; p < puffCount; p++) {
            puffs.push({
              dx: (Math.random() - 0.5) * 200 * cfg.scale,
              dy: (Math.random() - 0.3) * 80  * cfg.scale,
              r:  (40 + Math.random() * 80) * cfg.scale,
            });
          }
          this.layers.push({ cx, cy, puffs, speedX: cfg.speedX, speedY: cfg.speedY, alpha: cfg.alpha, parallax: cfg.parallax, layer: li });
        }
      });
    },

    drawCloud(cx, cy, puffs, alpha) {
      const ctx = this.ctx;
      puffs.forEach(p => {
        const grd = ctx.createRadialGradient(cx + p.dx, cy + p.dy, 0, cx + p.dx, cy + p.dy, p.r);
        grd.addColorStop(0,   `rgba(200,225,248,${alpha})`);
        grd.addColorStop(0.5, `rgba(180,210,240,${alpha * 0.55})`);
        grd.addColorStop(1,   'rgba(160,200,235,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(cx + p.dx, cy + p.dy, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
    },

    loop() {
      this.time += 0.0008;
      const ctx = this.ctx;
      const W = this.canvas.width, H = this.canvas.height;
      ctx.clearRect(0, 0, W, H);

      const scrollFrac = SkySystem.scrollFraction;

      this.layers.forEach(cl => {
        cl.cx += cl.speedX;
        if (cl.cx > W * 1.3) cl.cx = -W * 0.5;

        const parallaxX = this.mouse.x * 18 * cl.parallax;
        const parallaxY = this.mouse.y * 8  * cl.parallax;
        const wave = Math.sin(this.time * 0.5 + cl.cy * 0.01) * 4;

        // Reduce cloud alpha during heat/storm sections
        let alphaScale = 1;
        if (scrollFrac > 0.12 && scrollFrac < 0.22) alphaScale = 0.3; // heat
        if (scrollFrac > 0.42 && scrollFrac < 0.55) alphaScale = 1.5; // overcast

        this.drawCloud(cl.cx + parallaxX, cl.cy + parallaxY + wave, cl.puffs, cl.alpha * alphaScale);
      });

      requestAnimationFrame(() => this.loop());
    }
  };

  /* ─────────────────────────────────────────────────────────────
     3. ATMOSPHERIC PARTICLES — mist, pollen, dust
  ───────────────────────────────────────────────────────────── */
  const AtmosphericParticles = {
    canvas: null, ctx: null,
    particles: [],
    mouse: { x: 0.5, y: 0.5 },

    init() {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'particle-canvas';
      Object.assign(this.canvas.style, {
        position: 'fixed', top: 0, left: 0,
        width: '100%', height: '100%',
        zIndex: '-1', pointerEvents: 'none',
      });
      document.body.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this.resize();
      this.spawn();
      window.addEventListener('resize', () => this.resize(), { passive: true });
      window.addEventListener('mousemove', e => {
        this.mouse.x = e.clientX / window.innerWidth;
        this.mouse.y = e.clientY / window.innerHeight;
      }, { passive: true });
      this.loop();
    },

    resize() {
      this.canvas.width  = window.innerWidth;
      this.canvas.height = window.innerHeight;
    },

    spawn() {
      const count = window.innerWidth < 768 ? 30 : 65;
      this.particles = [];
      const W = this.canvas.width, H = this.canvas.height;
      for (let i = 0; i < count; i++) {
        this.particles.push(this.makeParticle(W, H, true));
      }
    },

    makeParticle(W, H, scatter) {
      const type = Math.random();
      return {
        x:    scatter ? Math.random() * W : (Math.random() < 0.5 ? -5 : W + 5),
        y:    Math.random() * H,
        vx:   (Math.random() - 0.45) * 0.35,  // gentle wind drift
        vy:   -Math.random() * 0.18 - 0.04,    // slow upward float
        size: type < 0.6 ? 0.8 + Math.random() * 1.8 : 2.5 + Math.random() * 3,
        opacity: 0.08 + Math.random() * 0.20,
        life:    0.3 + Math.random() * 0.7,
        maxLife: 1,
        // colour: mist-white, warm dust, or green pollen
        hue: type < 0.5 ? 210 : (type < 0.8 ? 40 : 120),
        sat: type < 0.5 ? 30 : (type < 0.8 ? 60 : 50),
      };
    },

    loop() {
      const ctx = this.ctx;
      const W = this.canvas.width, H = this.canvas.height;
      ctx.clearRect(0, 0, W, H);

      const scrollFrac = SkySystem.scrollFraction;
      // Wind direction shifts with biome
      const windX = 0.06 + Math.sin(scrollFrac * Math.PI) * 0.12;
      const windY = -0.02;

      this.particles.forEach((p, i) => {
        p.x  += p.vx + windX + (this.mouse.x - 0.5) * 0.015;
        p.y  += p.vy + windY;
        p.life -= 0.0015;

        if (p.life <= 0 || p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) {
          this.particles[i] = this.makeParticle(W, H, false);
          return;
        }

        const alpha = p.opacity * Math.min(p.life / 0.15, 1) * Math.min((p.maxLife - p.life) / 0.1 + 0.5, 1);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},${p.sat}%,80%,${alpha})`;
        ctx.fill();
      });

      requestAnimationFrame(() => this.loop());
    }
  };

  /* ─────────────────────────────────────────────────────────────
     4. LIGHT RAYS — volumetric sun shafts
  ───────────────────────────────────────────────────────────── */
  const LightRays = {
    canvas: null, ctx: null,
    time: 0,

    init() {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'light-canvas';
      Object.assign(this.canvas.style, {
        position: 'fixed', top: 0, left: 0,
        width: '100%', height: '100%',
        zIndex: '0', pointerEvents: 'none',
        mixBlendMode: 'soft-light',
        opacity: '0.55',
      });
      document.body.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', () => this.resize(), { passive: true });
      this.loop();
    },

    resize() {
      this.canvas.width  = window.innerWidth;
      this.canvas.height = window.innerHeight;
    },

    loop() {
      this.time += 0.003;
      const ctx = this.ctx;
      const W = this.canvas.width, H = this.canvas.height;
      ctx.clearRect(0, 0, W, H);

      const sf = SkySystem.scrollFraction;
      // Sun position: upper-right at dawn/dusk, upper-center mid-day
      const sunX = W * (0.82 - sf * 0.28);
      const sunY = -H * 0.05;

      // Rays only when not in storm/heat sections
      const isStorm = (sf > 0.42 && sf < 0.56);
      const isHeat  = (sf > 0.12 && sf < 0.22);
      if (isStorm || isHeat) {
        requestAnimationFrame(() => this.loop());
        return;
      }

      // Biome-based sun colour
      let rC, gC, bC;
      if (sf < 0.12)      { rC=255; gC=200; bC=120; }  // dawn: warm amber
      else if (sf < 0.35) { rC=220; gC=235; bC=255; }  // day: cool white
      else if (sf < 0.70) { rC=180; gC=210; bC=240; }  // sky: blue-white
      else                { rC=255; gC=190; bC=100; }  // dusk: golden

      const rayCount = 5;
      for (let i = 0; i < rayCount; i++) {
        const angle  = (-0.28 + i * 0.14) + Math.sin(this.time + i) * 0.04;
        const spread = 0.10 + i * 0.06;
        const alpha  = (0.025 + Math.sin(this.time * 0.7 + i * 1.2) * 0.012) * (1 - Math.abs(sf - 0.25) * 2);

        const x0 = sunX;
        const y0 = sunY;
        const x1 = sunX + Math.cos(Math.PI/2 + angle - spread/2) * H * 1.6;
        const x2 = sunX + Math.cos(Math.PI/2 + angle + spread/2) * H * 1.6;
        const y1 = sunY + H * 1.6;

        const grad = ctx.createLinearGradient(x0, y0, (x1+x2)/2, y1);
        grad.addColorStop(0, `rgba(${rC},${gC},${bC},${Math.max(0,alpha)})`);
        grad.addColorStop(1, `rgba(${rC},${gC},${bC},0)`);

        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y1);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }

      requestAnimationFrame(() => this.loop());
    }
  };

  /* ─────────────────────────────────────────────────────────────
     5. THREE.JS SCENE — 3D atmospheric particles
  ───────────────────────────────────────────────────────────── */
  const ThreeScene = {
    renderer: null, scene: null, camera: null,
    dustField: null, mistField: null,
    mouse: { x: 0, y: 0, lx: 0, ly: 0 },
    scrollY: 0,

    init() {
      if (typeof THREE === 'undefined') return;

      const canvas = document.getElementById('space-canvas');
      if (!canvas) return;

      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      this.renderer.setClearColor(0x000000, 0); // transparent — sky canvas shows through

      this.scene  = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);
      this.camera.position.z = 400;

      this.buildDustField();
      this.buildMistField();

      // Ambient + directional lighting (warm sun)
      this.scene.add(new THREE.AmbientLight(0x8ab4cc, 0.6));
      const sun = new THREE.DirectionalLight(0xffedc8, 1.2);
      sun.position.set(3, 5, 3);
      this.scene.add(sun);

      window.addEventListener('mousemove', e => {
        this.mouse.x = (e.clientX / window.innerWidth  - 0.5) * 2;
        this.mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
      window.addEventListener('scroll', () => { this.scrollY = window.scrollY; }, { passive: true });
      window.addEventListener('resize', () => this.onResize());

      this.animate();
    },

    buildDustField() {
      const count = window.innerWidth < 768 ? 800 : 2000;
      const pos   = new Float32Array(count * 3);
      const sizes = new Float32Array(count);
      const cols  = new Float32Array(count * 3);

      // Atmospheric particle colours
      const palette = [
        [0.80, 0.90, 1.00],  // mist blue-white
        [0.85, 0.88, 0.92],  // haze grey-white
        [1.00, 0.92, 0.78],  // warm dust
        [0.70, 0.88, 0.78],  // pollen green-white
      ];

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        pos[i3]     = (Math.random() - 0.5) * 900;
        pos[i3 + 1] = (Math.random() - 0.5) * 600;
        pos[i3 + 2] = (Math.random() - 0.5) * 400 - 100;
        sizes[i] = 0.5 + Math.random() * 2.0;
        const c = palette[Math.floor(Math.random() * palette.length)];
        const b = 0.5 + Math.random() * 0.5;
        cols[i3] = c[0]*b; cols[i3+1] = c[1]*b; cols[i3+2] = c[2]*b;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos,   3));
      geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));
      geo.setAttribute('color',    new THREE.BufferAttribute(cols,  3));

      const mat = new THREE.PointsMaterial({
        size: 1.2, sizeAttenuation: true, vertexColors: true,
        transparent: true, opacity: 0.35,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      this.dustField = new THREE.Points(geo, mat);
      this.scene.add(this.dustField);
    },

    buildMistField() {
      const count = 500;
      const pos   = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        pos[i3]     = (Math.random() - 0.5) * 600;
        pos[i3 + 1] = (Math.random() - 0.5) * 350;
        pos[i3 + 2] = (Math.random() - 0.5) * 250;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        size: 6, color: 0xc8e0f0,
        transparent: true, opacity: 0.06,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      this.mistField = new THREE.Points(geo, mat);
      this.scene.add(this.mistField);
    },

    animate() {
      requestAnimationFrame(() => this.animate());
      const t = performance.now() * 0.001;

      // Gentle mouse parallax
      this.mouse.lx += (this.mouse.x - this.mouse.lx) * 0.03;
      this.mouse.ly += (this.mouse.y - this.mouse.ly) * 0.03;
      this.camera.position.x = this.mouse.lx * 12;
      this.camera.position.y = -this.mouse.ly * 8 - this.scrollY * 0.04;
      this.camera.lookAt(0, -this.scrollY * 0.02, 0);

      // Slow wind-drift rotation
      if (this.dustField) {
        this.dustField.rotation.y = t * 0.006;
        this.dustField.rotation.x = t * 0.002;
      }
      if (this.mistField) {
        this.mistField.rotation.y = -t * 0.004;
        this.mistField.rotation.z = t * 0.003;
      }

      // Biome opacity shift
      const sf = SkySystem.scrollFraction;
      if (this.dustField) {
        this.dustField.material.opacity = 0.20 + Math.sin(t * 0.4) * 0.05 + sf * 0.08;
      }

      this.renderer.render(this.scene, this.camera);
    },

    onResize() {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  };

  /* ─────────────────────────────────────────────────────────────
     6. WEATHER RAIN — appears during storm/overcast sections
  ───────────────────────────────────────────────────────────── */
  const WeatherRain = {
    canvas: null, ctx: null,
    drops: [],
    active: false,
    intensity: 0,

    init() {
      this.canvas = document.createElement('canvas');
      Object.assign(this.canvas.style, {
        position: 'fixed', top: 0, left: 0,
        width: '100%', height: '100%',
        zIndex: '0', pointerEvents: 'none', opacity: '0.0',
        transition: 'opacity 2s ease',
      });
      document.body.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', () => this.resize(), { passive: true });
      this.spawnDrops(80);
      this.loop();
    },

    resize() {
      this.canvas.width  = window.innerWidth;
      this.canvas.height = window.innerHeight;
    },

    spawnDrops(count) {
      const W = this.canvas.width, H = this.canvas.height;
      for (let i = 0; i < count; i++) {
        this.drops.push({
          x: Math.random() * W,
          y: Math.random() * H,
          len: 8 + Math.random() * 18,
          speed: 6 + Math.random() * 10,
          alpha: 0.10 + Math.random() * 0.20,
        });
      }
    },

    loop() {
      const ctx = this.ctx;
      const W = this.canvas.width, H = this.canvas.height;
      ctx.clearRect(0, 0, W, H);

      const sf = SkySystem.scrollFraction;
      const isOvercast = sf > 0.42 && sf < 0.56;
      this.canvas.style.opacity = isOvercast ? '0.35' : '0.0';

      this.drops.forEach(d => {
        d.y += d.speed;
        d.x += 0.8; // wind angle
        if (d.y > H) { d.y = -d.len; d.x = Math.random() * W; }
        if (d.x > W) { d.x = 0; }

        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + d.len * 0.15, d.y + d.len);
        ctx.strokeStyle = `rgba(180,220,255,${d.alpha})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      });

      requestAnimationFrame(() => this.loop());
    }
  };

  /* ─────────────────────────────────────────────────────────────
     7. SCROLL REVEAL — elements emerge from atmospheric haze
  ───────────────────────────────────────────────────────────── */
  const ScrollReveal = {
    init() {
      const selectors = [
        '.solution-card', '.problem-card', '.cx-fw-card',
        '.cx-concern-card', '.cx-imperative-card', '.roadmap-card',
        '.sct-card', '.cx-gbm-deal', '.arch-node', '.theme-card',
        'h2', '.section-label', '.cx-label', '.cx-hero-badge',
        '.cx-market-stats', '.cx-hm-stats', '.cx-ai-pill',
        '.founder-card', '.cx-gbm-stat-val', '.cx-eyebrow',
      ];

      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach((el, i) => {
          el.classList.add('atm-reveal');
          el.style.transitionDelay = `${(i % 6) * 75}ms`;
        });
      });

      const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.10, rootMargin: '0px 0px -30px 0px' });

      document.querySelectorAll('.atm-reveal').forEach(el => io.observe(el));
    }
  };

  /* ─────────────────────────────────────────────────────────────
     8. HOVER RIPPLE — water-like distortion on card hover
  ───────────────────────────────────────────────────────────── */
  const HoverRipple = {
    init() {
      const cards = document.querySelectorAll(
        '.solution-card, .problem-card, .cx-fw-card, .cx-concern-card, ' +
        '.cx-imperative-card, .roadmap-card, .theme-card, .cx-gbm-deal, .sct-card'
      );

      cards.forEach(card => {
        card.addEventListener('mouseenter', e => {
          card.style.transition = 'transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 0.45s ease, border-color 0.35s ease';
        });

        card.addEventListener('mousemove', e => {
          const rect = card.getBoundingClientRect();
          const cx   = rect.left + rect.width  / 2;
          const cy   = rect.top  + rect.height / 2;
          const dx   = (e.clientX - cx) / (rect.width  / 2);
          const dy   = (e.clientY - cy) / (rect.height / 2);
          const tiltX = dy * 3;     // gentle tilt — like water surface
          const tiltY = -dx * 3;
          card.style.transform = `translateY(-4px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
          card.style.transformOrigin = 'center';
        });

        card.addEventListener('mouseleave', () => {
          card.style.transform = '';
        });
      });
    }
  };

  /* ─────────────────────────────────────────────────────────────
     9. CUSTOM CURSOR — soft atmospheric ring
  ───────────────────────────────────────────────────────────── */
  const CursorFX = {
    dot: null, ring: null,
    mx: -100, my: -100,
    rx: -100, ry: -100,

    init() {
      if (window.matchMedia('(pointer: coarse)').matches) return;

      this.dot  = this._el('cursor-dot');
      this.ring = this._el('cursor-ring');
      document.body.appendChild(this.dot);
      document.body.appendChild(this.ring);

      document.addEventListener('mousemove', e => {
        this.mx = e.clientX;
        this.my = e.clientY;
        this.dot.style.transform = `translate(${this.mx - 3.5}px, ${this.my - 3.5}px)`;
      });
      document.querySelectorAll('a, button, [role="button"], .theme-card, [class*="-card"]').forEach(el => {
        el.addEventListener('mouseenter', () => this.ring.classList.add('expand'));
        el.addEventListener('mouseleave', () => this.ring.classList.remove('expand'));
      });
      this._track();
    },

    _track() {
      this.rx += (this.mx - this.rx) * 0.10;
      this.ry += (this.my - this.ry) * 0.10;
      const w = this.ring.classList.contains('expand') ? 52 : 30;
      this.ring.style.transform = `translate(${this.rx - w/2}px, ${this.ry - w/2}px)`;
      requestAnimationFrame(() => this._track());
    },

    _el(cls) {
      const d = document.createElement('div');
      d.className = cls;
      return d;
    }
  };

  /* ─────────────────────────────────────────────────────────────
     10. SECTION ATMOSPHERE TAGGING
     Tags each section with its biome class as user scrolls
  ───────────────────────────────────────────────────────────── */
  const SectionTagger = {
    sections: [],
    tags: ['atm-clear', 'atm-ocean', 'atm-heat', 'atm-clear', 'atm-ocean', 'atm-forest',
           'atm-storm', 'atm-clear', 'atm-clear', 'atm-clear', 'atm-ocean', 'atm-clear', 'atm-clear'],

    init() {
      this.sections = Array.from(document.querySelectorAll('section'));
      this.sections.forEach((s, i) => {
        const tag = this.tags[i] || 'atm-clear';
        s.classList.add(tag);
      });
    }
  };

  /* ─────────────────────────────────────────────────────────────
     BOOT
  ───────────────────────────────────────────────────────────── */
  function boot() {
    SkySystem.init();
    CloudSystem.init();
    AtmosphericParticles.init();
    LightRays.init();
    WeatherRain.init();
    SectionTagger.init();
    ScrollReveal.init();
    HoverRipple.init();
    CursorFX.init();

    // Three.js boots when library loads
    if (typeof THREE !== 'undefined') {
      ThreeScene.init();
    } else {
      const poll = setInterval(() => {
        if (typeof THREE !== 'undefined') {
          ThreeScene.init();
          clearInterval(poll);
        }
      }, 120);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
