/* ============================================================
   Climactix Global — Deep Space Engine
   Three.js · Realistic Earth · Multi-depth Stars · Camera FX
   ============================================================ */
(function () {
  'use strict';

  /* ── Texture URLs (NASA / three-globe CDN) ── */
  const TX = {
    day:    'https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg',
    night:  'https://unpkg.com/three-globe@2.31.1/example/img/earth-night.jpg',
    clouds: 'https://unpkg.com/three-globe@2.31.1/example/img/earth-clouds.png',
    bump:   'https://unpkg.com/three-globe@2.31.1/example/img/earth-topology.png',
  };

  /* ── GLSL Shaders ── */
  const EARTH_VERT = `
    varying vec2  vUv;
    varying vec3  vNormal;
    varying vec3  vWorldPos;
    void main() {
      vUv      = uv;
      vNormal  = normalize(mat3(modelMatrix) * normal);
      vec4 wp  = modelMatrix * vec4(position, 1.0);
      vWorldPos= wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;

  const EARTH_FRAG = `
    uniform sampler2D uDay;
    uniform sampler2D uNight;
    uniform sampler2D uClouds;
    uniform vec3      uSunDir;
    varying vec2  vUv;
    varying vec3  vNormal;
    varying vec3  vWorldPos;

    void main() {
      vec3 N   = normalize(vNormal);
      vec3 L   = normalize(uSunDir);
      vec3 V   = normalize(cameraPosition - vWorldPos);

      float NdL    = dot(N, L);
      float dayMix = smoothstep(-0.18, 0.28, NdL);

      vec3 dayCol   = texture2D(uDay,    vUv).rgb;
      vec3 nightCol = texture2D(uNight,  vUv).rgb * 1.6;
      float clouds  = texture2D(uClouds, vUv).r;

      /* Day / night blend */
      vec3 color = mix(nightCol * 0.55, dayCol, dayMix);

      /* Cloud overlay */
      color = mix(color, vec3(0.96, 0.97, 1.00),
                  clouds * (0.22 + 0.55 * dayMix));

      /* Ocean specular glint (Blinn-Phong) */
      vec3 H    = normalize(L + V);
      float sp  = pow(max(0.0, dot(N, H)), 35.0) * dayMix * 0.16;
      color    += sp;

      /* Atmospheric limb scatter (blue rim, day side only) */
      float rim = 1.0 - max(0.0, dot(N, V));
      color    += vec3(0.18, 0.45, 0.90)
                  * pow(rim, 3.5)
                  * smoothstep(0.0, 0.45, NdL)
                  * 0.55;

      /* Terminator soft glow */
      float term = exp(-abs(NdL) * 6.0) * 0.10;
      color     += vec3(0.50, 0.32, 0.10) * term;

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const ATMOS_VERT = `
    varying vec3 vNormal;
    varying vec3 vViewPos;
    void main() {
      vNormal  = normalize(normalMatrix * normal);
      vec4 vp  = modelViewMatrix * vec4(position, 1.0);
      vViewPos = vp.xyz;
      gl_Position = projectionMatrix * vp;
    }
  `;

  const ATMOS_FRAG = `
    varying vec3 vNormal;
    varying vec3 vViewPos;
    void main() {
      float f = dot(normalize(vNormal), normalize(-vViewPos));
      float i = pow(1.0 - clamp(f, 0.0, 1.0), 4.2);
      gl_FragColor = vec4(0.22, 0.52, 1.00, i * 0.72);
    }
  `;

  /* ─────────────────────────────────────────────────────────────
     SPACE ENGINE
  ───────────────────────────────────────────────────────────── */
  const Engine = {
    renderer: null, scene: null, camera: null,
    earth: null, clouds: null, atmosphere: null,
    sunLight: null, sunGlow: null,
    starLayers: [],
    mouse:  { x: 0, y: 0, lx: 0, ly: 0 },
    scroll: { frac: 0, target: 0 },
    clock:  null,
    loaded: false,

    init() {
      const canvas = document.getElementById('space-canvas');
      if (!canvas || typeof THREE === 'undefined') return;

      /* Renderer */
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
      this.renderer.setClearColor(0x03050e, 1);
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 0.90;

      /* Scene + Clock */
      this.scene = new THREE.Scene();
      this.clock  = new THREE.Clock();

      /* Camera */
      this.camera = new THREE.PerspectiveCamera(
        55, window.innerWidth / window.innerHeight, 0.1, 5000
      );
      this.camera.position.set(0, 0.4, 5.0);

      /* Build scene */
      this._buildStars();
      this._buildNebula();
      this._buildLights();
      this._buildEarth();    // async — loads textures
      this._buildSunGlow();
      this._buildDustField();

      /* Events */
      window.addEventListener('mousemove',  e => this._onMouse(e),  { passive: true });
      window.addEventListener('scroll',     ()=> this._onScroll(),   { passive: true });
      window.addEventListener('resize',     ()=> this._onResize());

      this._loop();
    },

    /* ── Stars — 3 concentric layers at different depths ── */
    _buildStars() {
      const layers = [
        { count: 5500, rMin: 200, rMax: 900,  sMin: 0.5, sMax: 1.8, alpha: 0.85 },
        { count: 2000, rMin:  80, rMax: 200,  sMin: 0.8, sMax: 2.5, alpha: 0.70 },
        { count:  280, rMin:  55, rMax:  85,  sMin: 1.5, sMax: 4.0, alpha: 0.55 },
      ];

      const starPalette = [
        new THREE.Color(0.92, 0.94, 1.00),  // blue-white
        new THREE.Color(1.00, 0.98, 0.92),  // warm white
        new THREE.Color(0.78, 0.86, 1.00),  // cooler blue
        new THREE.Color(1.00, 0.94, 0.80),  // yellow-white
        new THREE.Color(0.96, 0.90, 1.00),  // pale violet
      ];

      layers.forEach(cfg => {
        const pos  = new Float32Array(cfg.count * 3);
        const col  = new Float32Array(cfg.count * 3);
        const sizes= new Float32Array(cfg.count);

        for (let i = 0; i < cfg.count; i++) {
          const i3  = i * 3;
          const r   = cfg.rMin + Math.random() * (cfg.rMax - cfg.rMin);
          const th  = Math.random() * Math.PI * 2;
          const ph  = Math.acos(2 * Math.random() - 1);
          pos[i3]   = r * Math.sin(ph) * Math.cos(th);
          pos[i3+1] = r * Math.sin(ph) * Math.sin(th);
          pos[i3+2] = r * Math.cos(ph);
          sizes[i]  = cfg.sMin + Math.random() * (cfg.sMax - cfg.sMin);
          const c   = starPalette[Math.floor(Math.random() * starPalette.length)];
          const b   = 0.50 + Math.random() * 0.50;
          col[i3]   = c.r * b;
          col[i3+1] = c.g * b;
          col[i3+2] = c.b * b;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos,   3));
        geo.setAttribute('color',    new THREE.BufferAttribute(col,   3));
        geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

        const mat = new THREE.PointsMaterial({
          size: 1.4,
          sizeAttenuation: true,
          vertexColors: true,
          transparent: true,
          opacity: cfg.alpha,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const pts = new THREE.Points(geo, mat);
        this.scene.add(pts);
        this.starLayers.push(pts);
      });
    },

    /* ── Faint nebula tint ── */
    _buildNebula() {
      const count = 1200;
      const nebulas = [
        { cx: -120, cy:  60, cz: -400, spread: 200, col: new THREE.Color(0.06, 0.08, 0.22) },
        { cx:  180, cy: -80, cz: -600, spread: 280, col: new THREE.Color(0.10, 0.04, 0.18) },
        { cx:   50, cy: 120, cz: -350, spread: 160, col: new THREE.Color(0.04, 0.10, 0.20) },
      ];
      nebulas.forEach(n => {
        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          const i3 = i * 3;
          pos[i3]   = n.cx + (Math.random() - 0.5) * n.spread;
          pos[i3+1] = n.cy + (Math.random() - 0.5) * n.spread * 0.5;
          pos[i3+2] = n.cz + (Math.random() - 0.5) * n.spread * 0.3;
          const b   = 0.3 + Math.random() * 0.7;
          col[i3]   = n.col.r * b;
          col[i3+1] = n.col.g * b;
          col[i3+2] = n.col.b * b;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
        const mat = new THREE.PointsMaterial({
          size: 7, sizeAttenuation: true, vertexColors: true,
          transparent: true, opacity: 0.18,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        this.scene.add(new THREE.Points(geo, mat));
      });
    },

    /* ── Lights ── */
    _buildLights() {
      // Sun: directional, warm white
      this.sunLight = new THREE.DirectionalLight(0xfff4e8, 2.6);
      this.sunLight.position.set(5, 2, 3);
      this.scene.add(this.sunLight);

      // Deep space ambient (very dim blue)
      this.scene.add(new THREE.AmbientLight(0x080c20, 0.35));
    },

    /* ── Earth: async texture load ── */
    _buildEarth() {
      const loader = new THREE.TextureLoader();
      let loaded = 0;
      const textures = {};

      const onLoad = (key, tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        textures[key] = tex;
        if (++loaded === 3) this._createEarthMesh(textures);
      };

      loader.load(TX.day,    t => onLoad('day',    t), undefined, () => onLoad('day',    new THREE.Texture()));
      loader.load(TX.night,  t => onLoad('night',  t), undefined, () => onLoad('night',  new THREE.Texture()));
      loader.load(TX.clouds, t => onLoad('clouds', t), undefined, () => onLoad('clouds', new THREE.Texture()));
    },

    _createEarthMesh(tx) {
      const SUN_DIR = new THREE.Vector3(5, 2, 3).normalize();

      /* Earth sphere */
      const geo = new THREE.SphereGeometry(1.60, 72, 72);
      const mat = new THREE.ShaderMaterial({
        vertexShader:   EARTH_VERT,
        fragmentShader: EARTH_FRAG,
        uniforms: {
          uDay:    { value: tx.day    },
          uNight:  { value: tx.night  },
          uClouds: { value: tx.clouds },
          uSunDir: { value: SUN_DIR   },
        },
      });
      this.earth = new THREE.Mesh(geo, mat);
      this.earth.rotation.z = 0.41; // axial tilt ~23.5°

      /* Cloud sphere — slightly larger, separate rotation */
      const cloudGeo = new THREE.SphereGeometry(1.606, 64, 64);
      const cloudMat = new THREE.MeshPhongMaterial({
        map: tx.clouds,
        transparent: true,
        opacity: 0.30,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.clouds = new THREE.Mesh(cloudGeo, cloudMat);

      /* Atmosphere (Fresnel glow) — rendered from inside */
      const atmGeo = new THREE.SphereGeometry(1.72, 64, 64);
      const atmMat = new THREE.ShaderMaterial({
        vertexShader:   ATMOS_VERT,
        fragmentShader: ATMOS_FRAG,
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.atmosphere = new THREE.Mesh(atmGeo, atmMat);

      /* Outer glow halo */
      const haloGeo = new THREE.SphereGeometry(1.92, 48, 48);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0x1a4aff,
        transparent: true,
        opacity: 0.04,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);

      /* Group */
      const group = new THREE.Group();
      group.add(this.earth, this.clouds, this.atmosphere, halo);
      // Position: massive, right-of-centre, slightly behind content
      group.position.set(2.2, -0.2, -0.5);
      this.scene.add(group);
      this.earthGroup = group;
      this.loaded = true;

      /* Satellite */
      this._buildSatellite();
    },

    /* ── Realistic Climactix satellite ── */
    _buildSatellite() {
      const sat = new THREE.Group();

      /* Body */
      const bodyMat = new THREE.MeshPhongMaterial({
        color: 0xc8d8e8, shininess: 90, specular: 0x445566,
      });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.032, 0.072), bodyMat);
      sat.add(body);

      /* Solar panels */
      const panelMat = new THREE.MeshPhongMaterial({
        color: 0x0a1a3a, shininess: 140, specular: 0x3366cc,
        emissive: 0x020810,
      });
      const panelGeo = new THREE.BoxGeometry(0.145, 0.002, 0.052);
      const panelL = new THREE.Mesh(panelGeo, panelMat);
      panelL.position.x = -0.097;
      const panelR = panelL.clone();
      panelR.position.x = 0.097;
      sat.add(panelL, panelR);

      /* Panel cell grid lines (thin dark strips) */
      const gridMat = new THREE.MeshBasicMaterial({ color: 0x112244 });
      for (let i = -2; i <= 2; i++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.003, 0.052), gridMat);
        bar.position.set(-0.097 + i * 0.028, 0.001, 0);
        sat.add(bar);
        const barR = bar.clone();
        barR.position.x = 0.097 + i * 0.028;
        sat.add(barR);
      }

      /* Antenna mast */
      const antMat = new THREE.MeshPhongMaterial({ color: 0xe0e0e0, shininess: 70 });
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.058, 8), antMat);
      mast.position.y = 0.045;
      sat.add(mast);

      /* Dish */
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.007, 0.013, 16), antMat);
      dish.position.y = 0.075;
      sat.add(dish);

      /* Dish inner (darker) */
      const dishInner = new THREE.Mesh(
        new THREE.CircleGeometry(0.016, 16),
        new THREE.MeshPhongMaterial({ color: 0x334455, shininess: 120, specular: 0x223344 }),
      );
      dishInner.position.y = 0.082;
      dishInner.rotation.x = -Math.PI / 2;
      sat.add(dishInner);

      /* Orbit pivot — child of earthGroup so it moves with Earth */
      this.orbitPivot = new THREE.Group();
      this.orbitPivot.rotation.x = 0.49; // ~28° orbital inclination
      sat.position.set(2.22, 0, 0);      // orbit radius just outside atmosphere
      this.orbitPivot.add(sat);
      this.earthGroup.add(this.orbitPivot);
      this.satellite = sat;
    },

    /* ── Sun glow sprite ── */
    _buildSunGlow() {
      // Simple sprite at sun position
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 128;
      const ctx = canvas.getContext('2d');
      const grd = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0.00, 'rgba(255,245,220,0.90)');
      grd.addColorStop(0.15, 'rgba(255,220,150,0.55)');
      grd.addColorStop(0.45, 'rgba(200,160,80,0.18)');
      grd.addColorStop(1.00, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 128, 128);

      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.65,
      });
      this.sunGlow = new THREE.Sprite(mat);
      this.sunGlow.scale.set(12, 12, 1);
      this.sunGlow.position.copy(this.sunLight.position).multiplyScalar(30);
      this.scene.add(this.sunGlow);
    },

    /* ── Floating dust particles ── */
    _buildDustField() {
      const count = window.innerWidth < 768 ? 400 : 900;
      const pos   = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        pos[i3]   = (Math.random() - 0.5) * 20;
        pos[i3+1] = (Math.random() - 0.5) * 12;
        pos[i3+2] = (Math.random() - 0.5) * 10 - 1;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        size: 0.018,
        color: 0x8ab4e8,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.dustField = new THREE.Points(geo, mat);
      this.scene.add(this.dustField);
    },

    /* ── Animation loop ── */
    _loop() {
      requestAnimationFrame(() => this._loop());
      const delta = this.clock.getDelta();
      const elapsed = this.clock.getElapsedTime();

      /* Smooth mouse lerp */
      this.mouse.lx += (this.mouse.x - this.mouse.lx) * 0.04;
      this.mouse.ly += (this.mouse.y - this.mouse.ly) * 0.04;

      /* Smooth scroll lerp */
      this.scroll.frac += (this.scroll.target - this.scroll.frac) * 0.05;

      /* Camera: drift + mouse parallax + scroll depth */
      const drift = Math.sin(elapsed * 0.12) * 0.06;
      this.camera.position.x  = this.mouse.lx * 0.22 + drift;
      this.camera.position.y  = -this.mouse.ly * 0.16 + 0.40 + Math.sin(elapsed * 0.08) * 0.04;
      this.camera.position.z  = 5.0 + this.scroll.frac * 2.2; // pull back as user scrolls
      this.camera.lookAt(0.5, 0, 0); // look slightly toward Earth

      /* Earth group: subtle drift + scroll-based drift */
      if (this.earthGroup) {
        this.earthGroup.position.y = -0.20 + Math.sin(elapsed * 0.15) * 0.08
                                    - this.scroll.frac * 0.8;
        this.earthGroup.position.x = 2.2 + this.mouse.lx * 0.10;
      }

      /* Earth rotation */
      if (this.earth)  this.earth.rotation.y  += 0.00025;
      if (this.clouds) this.clouds.rotation.y += 0.00032;

      /* Satellite orbit */
      if (this.orbitPivot) {
        this.orbitPivot.rotation.y += 0.0055; // ~25 s full orbit
        if (this.satellite) {
          // Keep satellite body facing direction of travel (prograde)
          this.satellite.rotation.z = -(this.orbitPivot.rotation.y + Math.PI / 2);
        }
      }

      /* Star layers: very slow rotation */
      this.starLayers.forEach((s, i) => {
        s.rotation.y += (0.00008 + i * 0.00004);
        s.rotation.x += 0.00003;
      });

      /* Dust drift */
      if (this.dustField) {
        this.dustField.rotation.y  = elapsed * 0.004;
        this.dustField.position.x  = this.mouse.lx * 0.05;
      }

      this.renderer.render(this.scene, this.camera);
    },

    _onMouse(e) {
      this.mouse.x = (e.clientX / window.innerWidth  - 0.5) * 2;
      this.mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
    },
    _onScroll() {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      this.scroll.target = maxScroll > 0 ? window.scrollY / maxScroll : 0;
    },
    _onResize() {
      const W = window.innerWidth, H = window.innerHeight;
      this.camera.aspect = W / H;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(W, H);
    },
  };

  /* ─────────────────────────────────────────────────────────────
     SCROLL REVEAL
  ───────────────────────────────────────────────────────────── */
  const Reveal = {
    init() {
      const sel = [
        '.solution-card', '.problem-card', '.cx-fw-card', '.cx-concern-card',
        '.cx-imperative-card', '.roadmap-card', '.sct-card', '.cx-gbm-deal',
        '.arch-node', '.theme-card', 'h2', '.section-label', '.cx-eyebrow',
        '.cx-hero-badge', '.cx-market-stats', '.founder-card', '.cx-ai-pill',
      ];
      sel.forEach(s => {
        document.querySelectorAll(s).forEach((el, i) => {
          el.classList.add('sp-reveal');
          el.style.transitionDelay = `${(i % 6) * 70}ms`;
        });
      });
      const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
        });
      }, { threshold: 0.10, rootMargin: '0px 0px -30px 0px' });
      document.querySelectorAll('.sp-reveal').forEach(el => io.observe(el));
    },
  };

  /* ─────────────────────────────────────────────────────────────
     CURSOR FX
  ───────────────────────────────────────────────────────────── */
  const Cursor = {
    dot: null, ring: null, mx: -100, my: -100, rx: -100, ry: -100,
    init() {
      if (window.matchMedia('(pointer:coarse)').matches) return;
      this.dot  = this._mk('sp-cursor-dot');
      this.ring = this._mk('sp-cursor-ring');
      document.body.appendChild(this.dot);
      document.body.appendChild(this.ring);
      document.addEventListener('mousemove', e => {
        this.mx = e.clientX; this.my = e.clientY;
        this.dot.style.transform = `translate(${this.mx - 3}px,${this.my - 3}px)`;
      });
      document.querySelectorAll('a,button,[role=button],[class*="-card"],.theme-card').forEach(el => {
        el.addEventListener('mouseenter', () => this.ring.classList.add('hover'));
        el.addEventListener('mouseleave', () => this.ring.classList.remove('hover'));
      });
      this._track();
    },
    _track() {
      this.rx += (this.mx - this.rx) * 0.11;
      this.ry += (this.my - this.ry) * 0.11;
      const w = this.ring.classList.contains('hover') ? 46 : 28;
      this.ring.style.transform = `translate(${this.rx - w/2}px,${this.ry - w/2}px)`;
      requestAnimationFrame(() => this._track());
    },
    _mk(cls) { const d = document.createElement('div'); d.className = cls; return d; },
  };

  /* ─────────────────────────────────────────────────────────────
     HOVER TILT (subtle 3-D card response)
  ───────────────────────────────────────────────────────────── */
  const HoverTilt = {
    init() {
      const cards = document.querySelectorAll(
        '.solution-card,.problem-card,.cx-fw-card,.cx-concern-card,' +
        '.cx-imperative-card,.roadmap-card,.theme-card,.cx-gbm-deal,.sct-card'
      );
      cards.forEach(card => {
        card.addEventListener('mousemove', e => {
          const r  = card.getBoundingClientRect();
          const dx = (e.clientX - r.left  - r.width  / 2) / (r.width  / 2);
          const dy = (e.clientY - r.top   - r.height / 2) / (r.height / 2);
          card.style.transform = `translateY(-4px) rotateX(${dy * -2.5}deg) rotateY(${dx * 2.5}deg)`;
        });
        card.addEventListener('mouseleave', () => { card.style.transform = ''; });
      });
    },
  };

  /* ─────────────────────────────────────────────────────────────
     BOOT
  ───────────────────────────────────────────────────────────── */
  function boot() {
    // Three.js may still be loading — poll
    if (typeof THREE === 'undefined') {
      const t = setInterval(() => { if (typeof THREE !== 'undefined') { clearInterval(t); Engine.init(); } }, 80);
    } else {
      Engine.init();
    }
    Reveal.init();
    Cursor.init();
    HoverTilt.init();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

})();
