/* ============================================================
   Climactix Global — Space Background Engine
   Three.js WebGL scene: stars · nebula · planets · parallax
   ============================================================ */

(function() {
  'use strict';

  // Wait for THREE to load
  function init() {
    if (typeof THREE === 'undefined') {
      setTimeout(init, 100);
      return;
    }
    SpaceScene.init();
    CursorFX.init();
    ScrollReveal.init();
    ShootingStars.init();
    SpacePlanets.init();
  }

  /* ─────────────────────────────────────────────────────────────
     1. THREE.JS SPACE SCENE
  ───────────────────────────────────────────────────────────── */
  const SpaceScene = {
    renderer: null,
    scene: null,
    camera: null,
    stars: null,
    nebula1: null,
    nebula2: null,
    planets: [],
    asteroids: null,
    mouse: { x: 0, y: 0, lerpX: 0, lerpY: 0 },
    scrollY: 0,
    frameId: null,

    init() {
      const canvas = document.getElementById('space-canvas');
      if (!canvas) return;

      // Renderer
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance'
      });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      this.renderer.setClearColor(0x00000f, 1);

      // Scene & Camera
      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.FogExp2(0x00000f, 0.00008);

      this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 3000);
      this.camera.position.z = 500;

      // Build scene objects
      this.buildStarField();
      this.buildNebula();
      this.buildPlanets();
      this.buildAsteroids();

      // Events
      window.addEventListener('mousemove', e => {
        this.mouse.x = (e.clientX / window.innerWidth  - 0.5) * 2;
        this.mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });

      window.addEventListener('scroll', () => {
        this.scrollY = window.scrollY;
      }, { passive: true });

      window.addEventListener('resize', () => this.onResize());

      this.animate();
    },

    buildStarField() {
      const count = window.innerWidth < 768 ? 4000 : 8000;
      const positions = new Float32Array(count * 3);
      const sizes     = new Float32Array(count);
      const colors    = new Float32Array(count * 3);

      // Color palette for stars
      const starColors = [
        [0.9, 0.95, 1.0],   // white-blue
        [0.7, 0.85, 1.0],   // blue
        [0.95, 0.90, 1.0],  // white-purple
        [1.0, 1.0, 0.90],   // warm white
        [0.60, 0.80, 1.0],  // cyan-blue
      ];

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        // Spherical distribution
        const r = 300 + Math.random() * 1200;
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.acos(2 * Math.random() - 1);
        positions[i3]     = r * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = r * Math.cos(phi) - 200;

        sizes[i] = Math.random() < 0.05 ? 3.5 + Math.random() * 3 : 0.8 + Math.random() * 2.5;

        const col = starColors[Math.floor(Math.random() * starColors.length)];
        const bright = 0.6 + Math.random() * 0.4;
        colors[i3]     = col[0] * bright;
        colors[i3 + 1] = col[1] * bright;
        colors[i3 + 2] = col[2] * bright;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));
      geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

      const mat = new THREE.PointsMaterial({
        size: 1.5,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.90,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      this.stars = new THREE.Points(geo, mat);
      this.scene.add(this.stars);

      // Bright star layer (fewer, bigger)
      this.buildBrightStars();
    },

    buildBrightStars() {
      const count = 200;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const r = 200 + Math.random() * 800;
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.acos(2 * Math.random() - 1);
        positions[i3]     = r * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = r * Math.cos(phi);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        size: 3.0,
        color: 0xaaddff,
        transparent: true,
        opacity: 0.70,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.scene.add(new THREE.Points(geo, mat));
    },

    buildNebula() {
      this._addNebula(0x1a0040, 0x003366, 2000, 600, -100, -400, 0.4);   // purple nebula
      this._addNebula(0x001a33, 0x004466,  800, -400, 200, -600, 0.30);  // cyan nebula
      this._addNebula(0x110022, 0x220044, 1500, 200, -300, -800, 0.25);  // deep purple
    },

    _addNebula(col1, col2, count, x, y, z, opacity) {
      const positions = new Float32Array(count * 3);
      const colors    = new Float32Array(count * 3);
      const c1 = new THREE.Color(col1);
      const c2 = new THREE.Color(col2);

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const spread = 280;
        positions[i3]     = x + (Math.random() - 0.5) * spread;
        positions[i3 + 1] = y + (Math.random() - 0.5) * spread * 0.6;
        positions[i3 + 2] = z + (Math.random() - 0.5) * spread * 0.4;

        const t = Math.random();
        colors[i3]     = c1.r + (c2.r - c1.r) * t;
        colors[i3 + 1] = c1.g + (c2.g - c1.g) * t;
        colors[i3 + 2] = c1.b + (c2.b - c1.b) * t;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

      const mat = new THREE.PointsMaterial({
        size: 5,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.scene.add(new THREE.Points(geo, mat));
    },

    buildPlanets() {
      const planetData = [
        { r: 55,  x: 620,  y: -180, z: -400, color: 0x1a6abf, emissive: 0x0a2244, speed: 0.003 },
        { r: 30,  x: -580, y:  240, z: -300, color: 0x7b2fbe, emissive: 0x2a0050, speed: 0.004 },
        { r: 18,  x:  350, y:  320, z: -200, color: 0x00d4ff, emissive: 0x003344, speed: 0.006 },
        { r: 8,   x: -300, y: -280, z: -150, color: 0x4361ee, emissive: 0x0a1050, speed: 0.008 },
      ];

      planetData.forEach(d => {
        const geo = new THREE.SphereGeometry(d.r, 32, 32);
        const mat = new THREE.MeshPhongMaterial({
          color: d.color,
          emissive: d.emissive,
          emissiveIntensity: 0.5,
          shininess: 30,
          transparent: true,
          opacity: 0.85,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(d.x, d.y, d.z);
        mesh.userData.speed = d.speed;
        mesh.userData.originX = d.x;
        mesh.userData.originY = d.y;
        this.scene.add(mesh);
        this.planets.push(mesh);

        // Add glow halo
        const haloGeo = new THREE.SphereGeometry(d.r * 1.4, 24, 24);
        const haloMat = new THREE.MeshBasicMaterial({
          color: d.color,
          transparent: true,
          opacity: 0.08,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        mesh.add(halo);
      });

      // Lighting
      const ambientLight = new THREE.AmbientLight(0x112244, 0.8);
      this.scene.add(ambientLight);

      const pointLight1 = new THREE.PointLight(0x4488ff, 2, 800);
      pointLight1.position.set(200, 200, 200);
      this.scene.add(pointLight1);

      const pointLight2 = new THREE.PointLight(0xaa44ff, 1.5, 600);
      pointLight2.position.set(-300, -100, 100);
      this.scene.add(pointLight2);
    },

    buildAsteroids() {
      const count = 60;
      const positions = new Float32Array(count * 3);

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        const band = Math.random() < 0.5;
        if (band) {
          // Asteroid belt
          const angle = Math.random() * Math.PI * 2;
          const rad = 250 + Math.random() * 100;
          positions[i3]     = Math.cos(angle) * rad;
          positions[i3 + 1] = (Math.random() - 0.5) * 40;
          positions[i3 + 2] = Math.sin(angle) * rad - 300;
        } else {
          positions[i3]     = (Math.random() - 0.5) * 1000;
          positions[i3 + 1] = (Math.random() - 0.5) * 600;
          positions[i3 + 2] = (Math.random() - 0.5) * 400 - 200;
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        size: 2.5,
        color: 0x8899bb,
        transparent: true,
        opacity: 0.60,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.asteroids = new THREE.Points(geo, mat);
      this.scene.add(this.asteroids);
    },

    animate() {
      this.frameId = requestAnimationFrame(() => this.animate());
      const t = performance.now() * 0.001;

      // Smooth mouse lerp
      this.mouse.lerpX += (this.mouse.x - this.mouse.lerpX) * 0.04;
      this.mouse.lerpY += (this.mouse.y - this.mouse.lerpY) * 0.04;

      // Parallax camera
      this.camera.position.x = this.mouse.lerpX * 18;
      this.camera.position.y = -this.mouse.lerpY * 12 - this.scrollY * 0.06;
      this.camera.lookAt(0, -this.scrollY * 0.04, 0);

      // Rotate star field slowly
      if (this.stars) {
        this.stars.rotation.y = t * 0.008;
        this.stars.rotation.x = t * 0.003;
      }

      // Rotate asteroids
      if (this.asteroids) {
        this.asteroids.rotation.y = t * 0.015;
        this.asteroids.rotation.z = t * 0.008;
      }

      // Animate planets
      this.planets.forEach((p, i) => {
        p.rotation.y = t * p.userData.speed * 60;
        p.rotation.x = t * p.userData.speed * 30;
        const drift = Math.sin(t * 0.3 + i * 1.5) * 12;
        p.position.x = p.userData.originX + drift;
        p.position.y = p.userData.originY + Math.cos(t * 0.2 + i) * 8;
      });

      this.renderer.render(this.scene, this.camera);
    },

    onResize() {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  };

  /* ─────────────────────────────────────────────────────────────
     2. CUSTOM CURSOR
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
        this.dot.style.transform = `translate(${this.mx - 3}px, ${this.my - 3}px)`;
      });

      // Expand ring on interactive elements
      document.querySelectorAll('a, button, [role="button"], .theme-card, .solution-card').forEach(el => {
        el.addEventListener('mouseenter', () => this.ring.classList.add('expand'));
        el.addEventListener('mouseleave', () => this.ring.classList.remove('expand'));
      });

      this._animateRing();
    },

    _animateRing() {
      this.rx += (this.mx - this.rx) * 0.12;
      this.ry += (this.my - this.ry) * 0.12;
      const w = this.ring.classList.contains('expand') ? 48 : 28;
      this.ring.style.transform = `translate(${this.rx - w/2}px, ${this.ry - w/2}px)`;
      requestAnimationFrame(() => this._animateRing());
    },

    _el(cls) {
      const d = document.createElement('div');
      d.className = cls;
      return d;
    }
  };

  /* ─────────────────────────────────────────────────────────────
     3. SCROLL REVEAL
  ───────────────────────────────────────────────────────────── */
  const ScrollReveal = {
    init() {
      const targets = [
        '.solution-card', '.problem-card', '.cx-fw-card',
        '.cx-concern-card', '.cx-imperative-card', '.roadmap-card',
        '.sct-card', '.cx-gbm-deal', '.arch-node', '.theme-card',
        'h2', '.section-label', '.cx-label', '.cx-hero-badge',
        '.cx-market-stats', '.cx-hm-stats', '.cx-ai-pill',
        '.founder-card', '.cx-gbm-stat-val'
      ];

      targets.forEach(sel => {
        document.querySelectorAll(sel).forEach((el, i) => {
          el.classList.add('space-reveal');
          el.style.transitionDelay = `${(i % 6) * 80}ms`;
        });
      });

      const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

      document.querySelectorAll('.space-reveal').forEach(el => io.observe(el));
    }
  };

  /* ─────────────────────────────────────────────────────────────
     4. SHOOTING STARS (Canvas overlay)
  ───────────────────────────────────────────────────────────── */
  const ShootingStars = {
    canvas: null, ctx: null,
    stars: [], timer: null,

    init() {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'shooting-star-canvas';
      Object.assign(this.canvas.style, {
        position: 'fixed', top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: '0',
      });
      document.body.insertBefore(this.canvas, document.body.firstChild);
      this.resize();
      window.addEventListener('resize', () => this.resize(), { passive: true });
      this.schedule();
      this.loop();
    },

    resize() {
      this.canvas.width  = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.ctx = this.canvas.getContext('2d');
    },

    schedule() {
      const delay = 2500 + Math.random() * 5000;
      this.timer = setTimeout(() => {
        this.spawn();
        this.schedule();
      }, delay);
    },

    spawn() {
      const x = Math.random() * window.innerWidth * 0.7;
      const y = Math.random() * window.innerHeight * 0.4;
      const angle = 25 + Math.random() * 20;
      const len = 100 + Math.random() * 200;
      const speed = 4 + Math.random() * 5;
      this.stars.push({ x, y, len, angle: angle * Math.PI / 180, speed, progress: 0, opacity: 1 });
    },

    loop() {
      if (!this.ctx) { requestAnimationFrame(() => this.loop()); return; }
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      this.stars = this.stars.filter(s => s.opacity > 0);
      this.stars.forEach(s => {
        s.progress += s.speed;
        const px = s.x + Math.cos(s.angle) * s.progress;
        const py = s.y + Math.sin(s.angle) * s.progress;
        s.opacity = Math.max(0, 1 - s.progress / (s.len * 2));

        const grad = this.ctx.createLinearGradient(px - Math.cos(s.angle) * s.len, py - Math.sin(s.angle) * s.len, px, py);
        grad.addColorStop(0, `rgba(0,212,255,0)`);
        grad.addColorStop(0.7, `rgba(0,212,255,${s.opacity * 0.6})`);
        grad.addColorStop(1, `rgba(255,255,255,${s.opacity})`);

        this.ctx.beginPath();
        this.ctx.moveTo(px - Math.cos(s.angle) * s.len, py - Math.sin(s.angle) * s.len);
        this.ctx.lineTo(px, py);
        this.ctx.strokeStyle = grad;
        this.ctx.lineWidth = 1.5;
        this.ctx.shadowBlur = 8;
        this.ctx.shadowColor = 'rgba(0,212,255,0.8)';
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
      });

      requestAnimationFrame(() => this.loop());
    }
  };

  /* ─────────────────────────────────────────────────────────────
     5. CSS FLOATING PLANETS (lightweight, no WebGL needed)
  ───────────────────────────────────────────────────────────── */
  const SpacePlanets = {
    init() {
      if (window.innerWidth < 768) return;

      const planets = [
        { size: 120, top: '8%',  right: '3%',  gradient: 'radial-gradient(circle at 35% 35%, #2a4a8f, #0a1640, #000820)', opacity: 0.30, delay: '0s',   dur: '22s' },
        { size: 60,  top: '45%', left:  '2%',  gradient: 'radial-gradient(circle at 40% 30%, #6b2fa0, #2a0060, #100025)', opacity: 0.25, delay: '8s',   dur: '28s' },
        { size: 35,  top: '75%', right: '8%',  gradient: 'radial-gradient(circle at 35% 35%, #004466, #001830, #000015)', opacity: 0.35, delay: '14s',  dur: '18s' },
        { size: 20,  top: '30%', right: '15%', gradient: 'radial-gradient(circle at 40% 40%, #00d4ff, #004488, #000820)', opacity: 0.40, delay: '4s',   dur: '15s' },
      ];

      planets.forEach(p => {
        const el = document.createElement('div');
        el.className = 'space-planet';
        Object.assign(el.style, {
          width:  p.size + 'px',
          height: p.size + 'px',
          top:    p.top  || 'auto',
          left:   p.left || 'auto',
          right:  p.right || 'auto',
          bottom: p.bottom || 'auto',
          background: p.gradient,
          opacity: p.opacity,
          boxShadow: `0 0 ${p.size * 0.5}px rgba(0,212,255,0.15), 0 0 ${p.size}px rgba(155,93,229,0.08)`,
          animationDelay: p.delay,
          animationDuration: p.dur,
        });
        document.body.appendChild(el);
      });
    }
  };

  /* ─────────────────────────────────────────────────────────────
     6. PARTICLE TRAIL (on mousemove)
  ───────────────────────────────────────────────────────────── */
  const ParticleTrail = {
    canvas: null, ctx: null,
    particles: [],
    lastX: 0, lastY: 0,

    init() {
      if (window.matchMedia('(pointer: coarse)').matches) return;

      this.canvas = document.createElement('canvas');
      this.canvas.id = 'particle-trail-canvas';
      Object.assign(this.canvas.style, {
        position: 'fixed', top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: '1',
        mixBlendMode: 'screen',
      });
      document.body.appendChild(this.canvas);
      this.canvas.width  = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.ctx = this.canvas.getContext('2d');

      window.addEventListener('resize', () => {
        this.canvas.width  = window.innerWidth;
        this.canvas.height = window.innerHeight;
      });

      let throttle = 0;
      document.addEventListener('mousemove', e => {
        if (++throttle % 2 !== 0) return;
        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 6) return;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.emit(e.clientX, e.clientY, dist);
      });

      this.loop();
    },

    emit(x, y, speed) {
      const count = Math.min(3, Math.floor(speed / 10));
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: x + (Math.random() - 0.5) * 6,
          y: y + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -Math.random() * 1.5 - 0.5,
          size: 1.5 + Math.random() * 2.5,
          life: 1,
          hue: 180 + Math.random() * 60,
        });
      }
    },

    loop() {
      if (!this.ctx) { requestAnimationFrame(() => this.loop()); return; }
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      this.particles = this.particles.filter(p => p.life > 0);
      this.particles.forEach(p => {
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.04;
        p.life -= 0.04;
        const a = p.life * 0.7;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        this.ctx.fillStyle = `hsla(${p.hue}, 100%, 70%, ${a})`;
        this.ctx.fill();
      });

      requestAnimationFrame(() => this.loop());
    }
  };

  // Boot when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
      ParticleTrail.init();
    });
  } else {
    init();
    ParticleTrail.init();
  }

})();
