/**
 * rim-intel-layers.js — carbon exposure · narrative intelligence · NGFS scenario modelling
 * as analytical layers of the EXISTING Risk Intelligence Map (risk-map-story.js).
 *
 * The three layers are not widgets: they are drawn on the map's own canvas with its own projection,
 * palette and clock, they read ONE Risk Intelligence Object (rim-intel-data.js), and they feed one
 * chain — carbon + narrative + scenario → climate risk → financial materiality → decision intelligence.
 *
 *   carbonExposureLayer          assets → emissions → intensity → regulatory exposure → carbon cost
 *   narrativeIntelligenceLayer   narrative → claims → evidence → data signals → consistency → risk signal
 *   ngfsScenarioLayer            current → pathway → climate variables → physical/transition → carbon/policy → assets/supply chain
 *
 * Time-driven during the story (pure function of the extended clock te); after the story, hovering or
 * pressing a layer holds it in its fully built state. Values are the platform's simulated product data
 * and are never presented as live external data.
 *
 * Exposes window.CX_RIM_INTEL.create(api) → { draw, sync, reset, destroy, physScen }.
 */
(function () {
  'use strict';
  if (window.CX_RIM_INTEL) return;

  function create(api) {
    var RIO = window.CX_RIO ? window.CX_RIO.build(api.FAC) : null;
    if (!RIO) return null;
    var root = api.root, wrap = api.wrap, ctx = api.ctx, C = api.C, MONO = api.MONO, TAU = api.TAU, rgba = api.rgba, text = api.text;
    var clamp = api.clamp, lerp = api.lerp, seg = api.seg, smooth = api.smooth, easeOut = api.easeOut, easeIO = api.easeIO, PH = api.PH, tier = api.tier;
    var SHOW = api.SHOW_TEXT, MOBILE = tier === 'mobile';
    var P = { x: 0, y: 0, z: 0 }, Q = { x: 0, y: 0, z: 0 };
    function $(s) { return root.querySelector(s); }
    function $$(s) { return Array.prototype.slice.call(root.querySelectorAll(s)); }

    /* ── DOM ── */
    var ipC = $('[data-ip="carbon"]'), ipN = $('[data-ip="narrative"]'), ipS = $('[data-ip="scenario"]');
    var claimsEl = $('[data-rim-claims]'), lensBtns = $$('[data-lens]'), ichain = $('[data-rim-ichain]'), ichainNote = $('[data-rim-ichain-note]'), synth = $('[data-rim-synth]');
    var ichainLis = ichain ? $$('[data-rim-ichain] li') : [];
    var pEl = { pathway: $('[data-sc-pathway]'), horizon: $$('[data-sc-horizon]'), type: $$('[data-sc-type]'), outs: $$('[data-sc-out]') };
    var carbonRows = $$('[data-ip="carbon"] [data-cr]'), narrRows = $$('[data-ip="narrative"] [data-nr]');
    var memo = {};
    function setText(el, v) { if (el && el.__v !== v) { el.__v = v; el.textContent = v; } }
    function setCls(el, cls, on) { if (el && el.__c !== (cls + on)) { el.__c = cls + on; el.classList.toggle(cls, !!on); } }
    function fmtPct(v) { return Math.round(v * 100) + '%'; }
    var STATUS = { supported: 'Supported', partial: 'Partial', gap: 'Evidence gap' };

    /* ── phases: envelope + progress (seconds into the phase) ── */
    var KEYS = { 7: 'carbon', 8: 'narrative', 9: 'scenario' };
    function envOf(te, r) { return smooth(seg(te, r[0], r[0] + 0.5)) * (1 - smooth(seg(te, r[1] - 0.35, r[1]))); }
    function state(te) {                                             // what is showing right now: weight + phase time per layer
      var em = api.emph(), A = api.emphA(), o = { carbon: 0, narrative: 0, scenario: 0, tp: { carbon: 0, narrative: 0, scenario: 0 }, forced: 0 };
      var held = em.layer >= 7 && em.layer <= 9 ? KEYS[em.layer] : null;
      ['carbon', 'narrative', 'scenario'].forEach(function (k) {
        var r = PH[k]; o.tp[k] = clamp(te - r[0], 0, r[1] - r[0]); o[k] = envOf(te, r);
      });
      if (held) {                                                    // held by hover / lens: fully built, the others step aside
        ['carbon', 'narrative', 'scenario'].forEach(function (k) {
          o[k] = k === held ? A[em.layer] : 0;
          if (k === held) o.tp[k] = PH[k][1] - PH[k][0];
        });
        o.forced = 1;
      }
      return o;
    }

    /* ── scenario state: auto-cycles through pathways during the story; the user can take over ── */
    var SC = { id: 'nz2050', horizon: 2030, type: 'combined', manual: false }, tween = null, tweenRaf = 0;
    var AUTO = [[0, 'nz2050', 2030, 'combined'], [1.5, 'delayed', 2050, 'transition'], [3.0, '3c', 2050, 'physical'], [4.2, 'delayed', 2050, 'combined']];
    function autoAt(tp) { var a = AUTO[0]; for (var i = 0; i < AUTO.length; i++) if (tp >= AUTO[i][0]) a = AUTO[i]; return a; }
    function evalFor(id, h, ty) { return RIO.evaluate(id, h, ty); }
    function mapVals(ev) { return { physical: ev.map.physical, transition: ev.map.transition, carbon: ev.map.carbon, supply: ev.map.supply }; }
    function scenVisual(te) {                                        // deterministic in te (auto) or tweened (manual)
      if (SC.manual) {
        var to = mapVals(evalFor(SC.id, SC.horizon, SC.type));
        if (!tween) return to;
        var u = clamp((performance.now() - tween.t0) / 600, 0, 1), e = easeIO(u), o = {};
        Object.keys(to).forEach(function (k) { o[k] = lerp(tween.from[k], to[k], e); });
        if (u >= 1) tween = null;
        return o;
      }
      var tp = clamp(te - PH.scenario[0], 0, 99), idx = 0, i;
      for (i = 0; i < AUTO.length; i++) if (tp >= AUTO[i][0]) idx = i;
      var cur = AUTO[idx], prev = AUTO[Math.max(0, idx - 1)], f = idx === 0 ? 1 : easeIO(clamp((tp - cur[0]) / 0.5, 0, 1));
      var a = mapVals(evalFor(prev[1], prev[2], prev[3])), b = mapVals(evalFor(cur[1], cur[2], cur[3])), out = {};
      Object.keys(a).forEach(function (k) { out[k] = lerp(a[k], b[k], f); });
      return out;
    }
    function scenCurrent(te) {                                       // the discrete selection shown in the controls
      if (SC.manual) return { id: SC.id, horizon: SC.horizon, type: SC.type };
      var a = autoAt(clamp(te - PH.scenario[0], 0, 99));
      return { id: a[1], horizon: a[2], type: a[3] };
    }
    function scenAfter(te) { return SC.manual ? SC : (te >= PH.scenario[0] ? scenCurrent(te) : { id: 'delayed', horizon: 2050, type: 'combined' }); }
    /* physical-risk scenario pressure handed to the Earth's own hazard field (its gain / threshold) */
    function physScen(te) {
      var s = state(te), w = s.scenario;
      if (w <= 0.01) return 0;
      var v = scenVisual(te);
      return w * (v.physical * 1.5 - 0.1);
    }

    function startTween(from) { tween = { from: from, t0: performance.now() }; if (!tweenRaf) { (function tick() { tweenRaf = requestAnimationFrame(function () { tweenRaf = 0; api.redraw(); if (tween) tick(); }); })(); } }

    /* ── controls ── */
    var bound = [];
    function bind(el, ev, fn) { if (el) { el.addEventListener(ev, fn); bound.push([el, ev, fn]); } }
    function userScenario(patch) {
      var before = scenVisual(lastTe);
      if (!SC.manual) { var c = scenCurrent(lastTe); SC.id = c.id; SC.horizon = c.horizon; SC.type = c.type; }
      SC.manual = true; for (var k in patch) SC[k] = patch[k];
      startTween(before); api.redraw(); sync(lastTe, 4, 0);
    }
    if (pEl.pathway) {
      RIO.scenario.pathways.forEach(function (p) { var o = document.createElement('option'); o.value = p.id; o.textContent = p.label; pEl.pathway.appendChild(o); });
      bind(pEl.pathway, 'change', function () { userScenario({ id: pEl.pathway.value }); });
    }
    pEl.horizon.forEach(function (b) { bind(b, 'click', function () { userScenario({ horizon: +b.getAttribute('data-sc-horizon') }); }); });
    pEl.type.forEach(function (b) { bind(b, 'click', function () { userScenario({ type: b.getAttribute('data-sc-type') }); }); });
    lensBtns.forEach(function (b) {
      var id = +b.getAttribute('data-lens');
      bind(b, 'click', function () { var on = api.emph().layer !== id; api.lens(id, on); });
    });

    /* ── claims list (built from the RIO) ── */
    var claimEls = [];
    if (claimsEl) {
      RIO.narrative.claims.forEach(function (c) {
        var li = document.createElement('li'); li.setAttribute('data-status', c.status);
        li.innerHTML = '<span class="rim-cl-t"></span><span class="rim-cl-d"></span><em></em>';
        li.children[0].textContent = '“' + c.text.replace(/\.$/, '') + '”'; li.children[1].textContent = c.doc; li.children[2].textContent = STATUS[c.status];
        claimsEl.appendChild(li); claimEls.push(li);
      });
    }

    /* layout anchors (DOM boxes in stage px) — refreshed when the stage resizes or a panel changes */
    var anchors = { key: '' };
    function box(el) { return el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : { x: 0, y: 0, w: 0, h: 0 }; }
    function refreshAnchors() {
      var sz = api.size(), key = sz.W + 'x' + sz.H + (ipC ? ipC.offsetHeight : 0) + (claimsEl ? claimsEl.offsetHeight : 0);
      if (anchors.key === key) return;
      anchors = { key: key, c: box(ipC), n: box(ipN), s: box(ipS), cl: box(claimsEl), claims: claimEls.map(box), chain: box(ichain && ichain.parentNode) };
    }

    var lastTe = 0;
    /* ═════════════ shared drawing helpers ═════════════ */
    function near(lat, lon, out) { api.proj(lat, lon, 0, out); return out.z > 0.1; }
    function visA(z) { return clamp((z - 0.1) / 0.25, 0, 1); }
    function tone(level) { return level === 'high' ? C.amber : level === 'mod' ? C.text2 : C.mute; }
    function qpt(a, c, b, u) { var v = 1 - u; return [v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]]; }
    function qline(a, c, b, u1) { ctx.beginPath(); ctx.moveTo(a[0], a[1]); for (var i = 1; i <= 18; i++) { var q = qpt(a, c, b, u1 * i / 18); ctx.lineTo(q[0], q[1]); } ctx.stroke(); }
    function dotAt(a, c, b, u, col, al, r) { var q = qpt(a, c, b, u); ctx.fillStyle = rgba(col, al); ctx.beginPath(); ctx.arc(q[0], q[1], r || 1.6, 0, TAU); ctx.fill(); }
    function plate(x, y, w, h, a, edge) { ctx.fillStyle = rgba(C.bg, 0.88 * a); ctx.fillRect(x, y, w, h); ctx.strokeStyle = rgba(edge || C.text2, 0.42 * a); ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
    var HERO_I = -1; api.FAC.forEach(function (f, i) { if (f.hero) HERO_I = i; });

    /* ═════════════ carbon exposure layer ═════════════
       assets → emissions → carbon intensity → regulatory exposure → carbon cost → financial materiality.
       Restrained contours and nodes (no filled glow): pale rings for moderate exposure, amber for high. */
    function drawCarbon(te, w, tp, dt) {
      var sz = api.size(), rs = sz.S / 240, as = RIO.carbon.assets, cls = RIO.carbon.clusters, i, j, a, c, pt;
      refreshAnchors();
      var AP = as.map(function (x) { var ok = near(x.lat, x.lon, P); return { ok: ok, x: P.x, y: P.y, v: visA(P.z) }; });
      var CP = cls.map(function (x) { var ok = near(x.lat, x.lon, P); return { ok: ok, x: P.x, y: P.y, v: visA(P.z) }; });
      ctx.save(); ctx.lineWidth = 1;
      /* regions with concentrated emissions */
      for (j = 0; j < cls.length; j++) {
        c = cls[j]; pt = CP[j]; if (!pt.ok) continue;
        var ra = smooth(seg(tp, 0.08 * j, 0.7 + 0.08 * j)) * pt.v * w, rc = (26 + 64 * c.concentration) * rs, col = tone(c.exposure);
        ctx.strokeStyle = rgba(col, 0.32 * ra); ctx.beginPath(); ctx.ellipse(pt.x, pt.y, rc * 1.25, rc * 0.82, -0.2, 0, TAU); ctx.stroke();
        ctx.setLineDash([2, 4]); ctx.strokeStyle = rgba(col, 0.22 * ra); ctx.beginPath(); ctx.ellipse(pt.x, pt.y, rc * 1.55, rc, -0.2, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      }
      /* assets and the emission contours around them */
      for (i = 0; i < as.length; i++) {
        a = as[i]; pt = AP[i]; if (!pt.ok) continue;
        var aa = smooth(seg(tp, 0.35 + i * 0.045, 0.8 + i * 0.045)) * pt.v * w; if (aa < 0.02) continue;
        var col2 = tone(a.intensity), r0 = (5 + 20 * a.emis) * rs, rp = smooth(seg(tp, 0.9 + i * 0.03, 1.9 + i * 0.03));
        for (j = 0; j < 3; j++) {
          ctx.strokeStyle = rgba(col2, (0.55 - 0.15 * j) * rp * aa * (a.emis > 0.5 ? 1 : 0.7));
          if (j === 2) ctx.setLineDash([2, 3]);
          ctx.beginPath(); ctx.arc(pt.x, pt.y, r0 * (0.5 + 0.55 * j) * rp, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        }
        var ph = (dt * 0.32 + i * 0.137) % 1;                                        // slow outward wave: emissions dispersing
        ctx.strokeStyle = rgba(col2, (1 - ph) * 0.22 * rp * aa * a.emis); ctx.beginPath(); ctx.arc(pt.x, pt.y, r0 * (1.2 + 1.0 * ph), 0, TAU); ctx.stroke();
        if (!MOBILE && a.emis > 0.5 && rp > 0.3) {                                   // a few controlled particles rising from high emitters
          for (j = 0; j < 4; j++) {
            var pp = (dt * 0.22 + j * 0.25 + i * 0.09) % 1;
            ctx.fillStyle = rgba(col2, Math.sin(pp * Math.PI) * 0.55 * aa * rp); ctx.beginPath();
            ctx.arc(pt.x + (j - 1.5) * 3.2, pt.y - 4 - pp * r0 * 1.9, 1.1, 0, TAU); ctx.fill();
          }
        }
        ctx.fillStyle = rgba(C.text, 0.95 * aa); ctx.fillRect(pt.x - 1.8, pt.y - 1.8, 3.6, 3.6);
        ctx.strokeStyle = rgba(C.text, 0.5 * aa); ctx.strokeRect(pt.x - 4.5, pt.y - 4.5, 9, 9);
        if (SHOW && (i === HERO_I) && tp > 1.0) text('PUNE · ASSET', pt.x + 10, pt.y + 14, C.text, 0.9 * aa, 'left', 8.5);
      }
      /* flows: asset → cluster → exposure (into the carbon panel) */
      var cb = anchors.c || { x: 0, y: 0, w: 0, h: 0 }, tgt = [cb.x + cb.w, cb.y + 54];
      for (j = 0; j < cls.length; j++) {
        c = cls[j]; var cn = CP[j]; if (!cn.ok) continue;
        var fa = smooth(seg(tp, 1.5 + j * 0.15, 2.4 + j * 0.15)) * cn.v * w;
        for (i = 0; i < as.length; i++) {
          if (c.members.indexOf(as[i].n) < 0 || !AP[i].ok) continue;
          var A0 = [AP[i].x, AP[i].y], B0 = [cn.x, cn.y], C0 = [(A0[0] + B0[0]) / 2, Math.min(A0[1], B0[1]) - 14 * rs];
          ctx.strokeStyle = rgba(tone(as[i].intensity), 0.28 * fa); qline(A0, C0, B0, fa);
          if (fa > 0.4) dotAt(A0, C0, B0, (dt * 0.5 + i * 0.21) % 1, tone(as[i].intensity), 0.85 * fa, 1.5);
        }
        var E0 = [cn.x, cn.y], E1 = tgt, EC = [(E0[0] + E1[0]) / 2, Math.min(E0[1], E1[1]) - 40];
        var ea = smooth(seg(tp, 2.2 + j * 0.12, 3.1 + j * 0.12)) * cn.v * w * (c.exposure === 'high' ? 1 : 0.5);
        if (ea > 0.02 && cb.w) { ctx.strokeStyle = rgba(tone(c.exposure), 0.30 * ea); qline(E0, EC, E1, ea); dotAt(E0, EC, E1, (dt * 0.4 + j * 0.27) % 1, tone(c.exposure), 0.9 * ea, 1.7); }
        if (SHOW && tp > 2.4) {
          text((c.label + ' · ' + (c.exposure === 'high' ? 'HIGH' : c.exposure === 'mod' ? 'MODERATE' : 'LOW')).toUpperCase(), cn.x, cn.y - (26 + 64 * c.concentration) * rs * 0.9 - 8, tone(c.exposure), 0.9 * cn.v * w * smooth(seg(tp, 2.4, 3.0)), 'center', 8);
        }
      }
      /* carbon feeds risk: intensity + policy signal + asset exposure → transition risk → financial exposure */
      var H = AP[HERO_I], la = smooth(seg(tp, 3.3, 3.9)) * w;
      if (H && H.ok && la > 0.02 && SHOW) {
        var bx = H.x + 44, by = H.y - 112, bw = 176, bh = 74;
        ctx.strokeStyle = rgba(C.amber, 0.55 * la); ctx.beginPath(); ctx.moveTo(H.x + 3, H.y - 3); ctx.lineTo(bx, by + bh); ctx.stroke();
        plate(bx, by, bw, bh, la, C.amber);
        text('HIGH CARBON INTENSITY', bx + 10, by + 13, C.text, la, 'left', 8);
        text('+ POLICY / REGULATORY SIGNAL', bx + 10, by + 27, C.text2, la, 'left', 8);
        text('+ ASSET EXPOSURE', bx + 10, by + 41, C.text2, la, 'left', 8);
        text('→ TRANSITION RISK', bx + 10, by + 58, C.amber, la, 'left', 8.5);
        text('→ FINANCIAL EXPOSURE', bx + 10, by + 70 - 1, C.amber, la * 0.85, 'left', 7.5);
      }
      ctx.restore();
    }

    /* ═════════════ narrative intelligence layer ═════════════
       narrative → claims → evidence → data signals → consistency → credibility → risk signal.
       Claims travel from the disclosure to the exact places on the map whose data can corroborate them. */
    function drawNarrative(te, w, tp, dt) {
      var sz = api.size(), rs = sz.S / 240, cl = RIO.narrative.claims, i, j, e, hero = { x: 0, y: 0, ok: false };
      refreshAnchors();
      var cb = anchors.cl || { x: 0, y: 0, w: 0, h: 0 }, slots = {}, cnt = {}, drawn = {};
      if (HERO_I >= 0) { var hf = api.FAC[HERO_I]; hero.ok = near(hf.lat, hf.lon, P); hero.x = P.x; hero.y = P.y; }
      ctx.save(); ctx.lineWidth = 1;
      for (i = 0; i < cl.length; i++) {
        var c = cl[i], s0 = 0.35 + i * 0.7, chip = anchors.claims[i] || { x: 0, y: 0, w: 0, h: 0 };
        var ca = smooth(seg(tp, s0, s0 + 0.35)) * w, from = [cb.x + chip.x, cb.y + chip.y + chip.h / 2];
        var col = c.status === 'supported' ? C.blue : c.status === 'partial' ? C.text : C.amber;
        for (j = 0; j < c.evidence.length; j++) {
          e = c.evidence[j];
          var ok = near(e.lat, e.lon, Q); if (!ok) continue;
          var key = e.lat + ',' + e.lon, sk = key + '|' + e.kind, x = Q.x, y = Q.y, va = visA(Q.z);
          if (!slots[sk]) { cnt[key] = (cnt[key] || 0) + 1; slots[sk] = cnt[key]; }
          var n = slots[sk];
          var side = 1;
          if (n > 1 || key === '18.605,73.779') { var ang = (-70 + 64 * (n - 1)) * Math.PI / 180; x += Math.cos(ang) * 38 * rs; y += Math.sin(ang) * 38 * rs; side = Math.cos(ang) < 0 ? -1 : 1; }
          var cp = smooth(seg(tp, s0 + 0.3 + j * 0.15, s0 + 1.0 + j * 0.15)), to = [x, y], ctl = [(from[0] + x) / 2, Math.min(from[1], y) - 36];
          var mcol = e.match === 'supported' ? C.blue : e.match === 'partial' ? C.text2 : C.amber;
          if (cb.w && ca > 0.02) {
            ctx.strokeStyle = rgba(mcol, 0.42 * ca * va); if (e.match === 'gap') ctx.setLineDash([3, 3]);
            qline(from, ctl, to, cp); ctx.setLineDash([]);
            if (cp > 0.05 && cp < 1) dotAt(from, ctl, to, easeOut(cp), mcol, 0.95 * ca, 1.7);
          }
          var na = smooth(seg(cp, 0.75, 1)) * ca * va;
          if (na > 0.02 && !drawn[sk]) { drawn[sk] = 1;                                                         // evidence node: solid = supported · half = partial · dashed = evidence gap
            ctx.strokeStyle = rgba(mcol, 0.95 * na); ctx.lineWidth = 1;
            if (e.match === 'gap') { ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.arc(x, y, 5.5, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
            else if (e.match === 'partial') { ctx.beginPath(); ctx.arc(x, y, 5.5, -Math.PI / 2, Math.PI / 2); ctx.stroke(); ctx.setLineDash([1.5, 2.5]); ctx.beginPath(); ctx.arc(x, y, 5.5, Math.PI / 2, Math.PI * 1.5); ctx.stroke(); ctx.setLineDash([]); }
            else { ctx.beginPath(); ctx.arc(x, y, 5.5, 0, TAU); ctx.stroke(); }
            ctx.fillStyle = rgba(C.text, 0.95 * na); ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
            if (SHOW) text(e.kind.toUpperCase(), x + 9 * side, y, C.text2, 0.85 * na, side < 0 ? 'right' : 'left', 7.5);
          }
        }
      }
      /* claim ↔ evidence ↔ risk signal, at the asset */
      var ta = smooth(seg(tp, 2.9, 3.5)) * w;
      if (hero.ok && ta > 0.02 && SHOW) {
        var x0 = hero.x - 214, y0 = hero.y + 66, bw = 92, bh = 34, gap = 14, cells = [['CLAIM', 'Reducing exposure', C.text], ['EVIDENCE', 'Asset data · high', C.text2], ['RISK SIGNAL', 'Climate signal · high', C.amber]];
        for (i = 0; i < 3; i++) {
          var bx = x0 + i * (bw + gap), a3 = smooth(seg(tp, 2.9 + i * 0.22, 3.4 + i * 0.22)) * w;
          plate(bx, y0, bw, bh, a3, cells[i][2]);
          text(cells[i][0], bx + 8, y0 + 11, C.mute, a3, 'left', 7);
          text(cells[i][1], bx + 8, y0 + 24, cells[i][2], a3, 'left', 7.5);
          if (i < 2) { ctx.strokeStyle = rgba(C.text2, 0.7 * a3); ctx.beginPath(); ctx.moveTo(bx + bw + 2, y0 + bh / 2); ctx.lineTo(bx + bw + gap - 2, y0 + bh / 2); ctx.stroke(); text('↔', bx + bw + gap / 2, y0 + bh / 2 - 1, C.text2, a3, 'center', 9); }
        }
        var sa = smooth(seg(tp, 3.6, 4.0)) * w;
        text('PARTIALLY SUPPORTED · ANALYTICAL SIGNAL', x0, y0 + bh + 13, C.text2, sa, 'left', 7.5);
      }
      /* narrative meets carbon: claim → emissions trend → consistency → climate intelligence */
      var sp = smooth(seg(tp, 3.7, 4.4)) * w, ch = anchors.chain || { y: sz.H - 60 };
      if (sp > 0.02 && SHOW) {
        var W2 = 214, H2 = 96, px = sz.cx - W2 / 2 + 46, py = Math.max(sz.H * 0.55, ch.y - H2 - 12);
        var cc = anchors.claims[3];
        if (cc && cb.w) { var f0 = [cb.x + cc.x, cb.y + cc.y + cc.h], f1 = [px + W2, py + 24]; ctx.strokeStyle = rgba(C.blue, 0.5 * sp); ctx.setLineDash([3, 3]); qline(f0, [f0[0] - 20, (f0[1] + f1[1]) / 2], f1, 1); ctx.setLineDash([]); }
        plate(px, py, W2, H2, sp);
        text('“REDUCING CARBON INTENSITY”', px + 10, py + 12, C.text, sp, 'left', 7.5);
        text('EMISSIONS TREND', px + 10, py + 25, C.mute, sp, 'left', 7);
        var gx = px + 12, gy = py + 34, gw = W2 - 24, gh = 34, T = RIO.carbon.trend.intensity;
        ctx.setLineDash([3, 3]); ctx.strokeStyle = rgba(C.text2, 0.6 * sp); ctx.beginPath(); ctx.moveTo(gx, gy + 2); ctx.lineTo(gx + gw, gy + gh - 4); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = rgba(C.amber, 0.95 * sp); ctx.lineWidth = 1.3; ctx.beginPath();
        for (i = 0; i < T.length; i++) { var yy = gy + 6 + (1 - T[i]) * 170 + i * 0.4; if (i) ctx.lineTo(gx + gw * i / (T.length - 1), yy); else ctx.moveTo(gx, yy); }
        ctx.stroke(); ctx.lineWidth = 1;
        text('CLAIM', gx + gw - 2, gy + gh - 12, C.text2, sp, 'right', 7); text('DATA', gx + gw - 2, gy + 14, C.amber, sp, 'right', 7);
        text('CONSISTENCY · PARTIAL  →  CLIMATE INTELLIGENCE', px + 10, py + H2 - 10, C.blue, sp * smooth(seg(tp, 4.0, 4.5)), 'left', 7);
      }
      ctx.restore();
    }

    /* ═════════════ NGFS scenario modelling layer ═════════════
       current state → pathway → climate variables → physical + transition exposure → carbon cost / policy
       → asset / supply-chain impact → financial materiality. Each change on the map encodes one relationship:
         the Earth's own hazard field  ↔ physical pressure          (handed to the engine via physScen)
         rings around assets           ↔ transition pressure
         regulatory zones              ↔ policy pressure by region
         supply routes                 ↔ supply-chain exposure (route × the hazard field it crosses)
         asset outer ring              ↔ asset risk level under the pathway                              */
    var routeExp = null;
    function routeExposure() {
      if (routeExp) return routeExp;
      routeExp = api.ARCS.map(function (r) { var s = 0, n = 0, i; for (i = 0; i < r.pts.length; i += 2) { s += api.field(r.pts[i][0], r.pts[i][1], 1.2); n++; } return s / Math.max(1, n); });
      var mx = Math.max.apply(null, routeExp) || 1; routeExp = routeExp.map(function (v) { return v / mx; });
      return routeExp;
    }
    var BASE_RISK = { high: 0.8, mod: 0.55, low: 0.3 };
    function drawScenario(te, w, tp, dt) {
      var v = scenVisual(te), cur = scenCurrent(te), ev = evalFor(cur.id, cur.horizon, cur.type), sz = api.size(), rs = sz.S / 240;
      var as = RIO.carbon.assets, cls = RIO.carbon.clusters, i, j, pt, sw = smooth(seg(tp, 0.0, 0.7)) * w;
      ctx.save(); ctx.lineWidth = 1.2;
      /* supply chain: routes light up where they cross the hazard field, scaled by the pathway's supply-chain pressure */
      var rx = routeExposure(), arcs = api.ARCS;
      for (i = 0; i < arcs.length; i++) {
        var ra = v.supply * (0.25 + 0.75 * rx[i]) * sw; if (ra < 0.04) continue;
        ctx.strokeStyle = rgba(rx[i] > 0.55 ? C.amber : C.text2, 0.62 * ra); ctx.beginPath();
        var pen = false, pts = arcs[i].pts, k;
        for (k = 0; k < pts.length; k++) { api.proj(pts[k][0], pts[k][1], pts[k][2], Q); if (Q.z < 0.05) { pen = false; continue; } if (!pen) { ctx.moveTo(Q.x, Q.y); pen = true; } else ctx.lineTo(Q.x, Q.y); }
        ctx.stroke();
      }
      /* policy pressure by region (cluster zones) + carbon-cost markers */
      for (j = 0; j < cls.length; j++) {
        var c = cls[j]; if (!near(c.lat, c.lon, P)) continue;
        var cx0 = P.x, cy0 = P.y, va = visA(P.z), rc = (26 + 64 * c.concentration) * rs, reg = c.id === 'europe' ? 1 : c.id === 'south-asia' ? 0.85 : 0.55;
        var za = v.transition * reg * sw * va;
        ctx.strokeStyle = rgba(C.amber, 0.5 * za); ctx.setLineDash([3, 3]); ctx.lineDashOffset = -dt * 5;
        ctx.beginPath(); ctx.ellipse(cx0, cy0, rc * 1.7, rc * 1.15, -0.2, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        if (SHOW && v.carbon > 0.5) text('CARBON COST ▲', cx0, cy0 + rc * 1.15 + 12, C.amber, 0.85 * va * sw * smooth(seg(v.carbon, 0.5, 0.75)), 'center', 7.5);
      }
      /* assets: transition rings + the asset's risk level under this pathway */
      for (i = 0; i < as.length; i++) {
        var a = as[i], f = api.FAC[i]; if (!near(a.lat, a.lon, P)) continue;
        pt = { x: P.x, y: P.y, v: visA(P.z) };
        var al = sw * pt.v; if (al < 0.03) continue;
        var tr = (9 + 34 * v.transition * a.emis) * rs;
        ctx.strokeStyle = rgba(v.transition > 0.5 ? C.amber : C.text2, 0.5 * al); ctx.setLineDash([2, 3]); ctx.lineDashOffset = dt * 4;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, tr, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        var lvl = clamp(BASE_RISK[f.risk] + v.physical * 0.55 + v.transition * 0.35 - 0.35, 0, 1);
        ctx.strokeStyle = rgba(lvl > 0.78 ? C.red : lvl > 0.55 ? C.amber : C.text2, 0.9 * al); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 8.5, 0, TAU); ctx.stroke(); ctx.lineWidth = 1.2;
        if (SHOW && i === HERO_I) {
          var o = ev.outputs.asset;
          text('PUNE · ASSET RISK ' + o.label.toUpperCase() + ' ' + (o.dir === 'up' ? '▲' : o.dir === 'down' ? '▼' : '►'), pt.x + 14, pt.y - 14, lvl > 0.78 ? C.red : C.amber, al, 'left', 8.5);
        }
      }
      /* the pathway being applied */
      if (SHOW) {
        var lab = ev.pathway.label.toUpperCase() + ' · ' + ev.horizon + ' · ' + ev.riskType.toUpperCase();
        text('PATHWAY', sz.cx, Math.max(60, sz.cy - sz.S - 26), C.mute, sw, 'center', 7.5);
        text(lab, sz.cx, Math.max(60, sz.cy - sz.S - 12), C.text, sw, 'center', 9);
      }
      ctx.restore();
    }

    function draw(te, tb, z, dt) {
      lastTe = te;
      var s = state(te), zoomOut = 1 - smooth(seg(z, 0.5, 1.2));
      if (zoomOut < 0.02) return;
      if (s.carbon > 0.01) drawCarbon(te, s.carbon * zoomOut, s.tp.carbon, dt);
      if (s.narrative > 0.01) drawNarrative(te, s.narrative * zoomOut, s.tp.narrative, dt);
      if (s.scenario > 0.01) drawScenario(te, s.scenario * zoomOut, s.tp.scenario, dt);
    }

    /* ═════════════ DOM: panels, chain strip, synthesis, controls ═════════════ */
    var CH = {
      carbon: { items: ['Asset', 'Emissions', 'Carbon intensity', 'Regulatory exposure', 'Carbon cost', 'Financial materiality'], t0: 0.5, dt: 0.62,
        note: 'High carbon intensity + policy signal + asset exposure → transition risk → financial exposure.' },
      narrative: { items: ['Narrative', 'Claims', 'Evidence', 'Data signals', 'Consistency', 'Credibility', 'Risk signal'], t0: 0.3, dt: 0.55,
        note: 'What the company says, set against what the data indicates. Evidence gaps are analytical signals, not conclusions.' },
      scenario: { items: ['Current state', 'Scenario', 'Climate variables', 'Physical + transition', 'Carbon cost · policy', 'Asset · supply chain', 'Financial materiality'], t0: 0.3, dt: 0.62,
        note: 'Each change on the map encodes one relationship: hazard field ↔ physical pressure · rings ↔ transition · routes ↔ supply-chain exposure.' }
    };
    var modeEl = $('[data-sc-mode]'), synthIn = synth ? $$('[data-rim-synth] [data-si]') : [], synthOut = synth ? $$('[data-rim-synth] [data-so]') : [];
    function sync(te, stage, z) {
      lastTe = te;
      var s = state(te), st = RIO.narrative.stats, k;
      setCls(ipC, 'is-on', s.carbon > 0.05); setCls(ipN, 'is-on', s.narrative > 0.05); setCls(ipS, 'is-on', s.scenario > 0.05); setCls(claimsEl, 'is-on', s.narrative > 0.05);
      carbonRows.forEach(function (r, i) { setCls(r, 'is-on', s.carbon > 0.05 && s.tp.carbon >= 0.9 + 0.32 * i); });
      var vals = [st.claimsAnalysed, st.climateClaims, st.evidenceMatches, st.evidenceGaps, fmtPct(st.consistency), fmtPct(st.confidence)];
      narrRows.forEach(function (r, i) {
        var t0 = 0.4 + 0.32 * i, on = s.narrative > 0.05 && s.tp.narrative >= t0, el = r.querySelector('b');
        setCls(r, 'is-on', on);
        if (typeof vals[i] === 'number') setText(el, on ? String(Math.round(vals[i] * smooth(seg(s.tp.narrative, t0, t0 + 0.9)))) : '—'); else setText(el, on ? vals[i] : '—');
      });
      claimEls.forEach(function (li, i) { var s0 = 0.35 + i * 0.7; setCls(li, 'is-on', s.tp.narrative >= s0); setCls(li, 'is-eval', s.tp.narrative >= s0 + 1.2); });

      var cur = scenCurrent(te), ev = evalFor(cur.id, cur.horizon, cur.type);
      if (pEl.pathway && pEl.pathway.value !== cur.id) pEl.pathway.value = cur.id;
      pEl.horizon.forEach(function (b) { setCls(b, 'is-on', +b.getAttribute('data-sc-horizon') === cur.horizon); });
      pEl.type.forEach(function (b) { setCls(b, 'is-on', b.getAttribute('data-sc-type') === cur.type); });
      pEl.outs.forEach(function (o) {
        var r = ev.outputs[o.getAttribute('data-sc-out')];
        setText(o.querySelector('em'), r.label); setText(o.querySelector('b'), r.dir === 'up' ? '▲' : r.dir === 'down' ? '▼' : '►');
        setCls(o, 'is-up', r.dir === 'up'); setCls(o, 'is-down', r.dir === 'down'); setCls(o, 'is-hi', r.level >= 2);
        o.querySelector('i').style.setProperty('--w', Math.round(r.v * 100) + '%');
      });
      setText(modeEl, SC.manual ? 'User selection' : 'Auto sequence');

      /* one chain strip: carries the active layer's relationship chain */
      var act = null, best = 0.05;
      ['carbon', 'narrative', 'scenario'].forEach(function (key) { if (s[key] > best) { best = s[key]; act = key; } });
      if (ichain) {
        setCls(ichain, 'is-on', !!act);
        if (act) {
          var def = CH[act], lit = clamp(Math.floor((s.tp[act] - def.t0) / def.dt) + 1, 0, def.items.length);
          ichainLis.forEach(function (li, i) { var has = i < def.items.length; setCls(li, 'is-off', !has); if (has) setText(li, def.items[i]); setCls(li, 'is-lit', has && i < lit); });
          setText(ichainNote, def.note); setCls(ichainNote, 'is-on', lit >= def.items.length);
        } else setCls(ichainNote, 'is-on', false);
        setCls(ichain.parentNode, 'has-intel', !!act);
      }
      /* closing synthesis at the facility: current + carbon + narrative + scenario → climate intelligence → materiality */
      if (synth) {
        var sp = te - PH.synth[0], on = sp >= 0 && te < PH.synth[1] + 0.3 && !api.isDone();
        setCls(synth, 'is-on', on); setCls(root, 'is-synth', on);
        if (on) {
          var af = scenAfter(te), sy = RIO.synthesis(af.id, af.horizon);
          synthIn.forEach(function (li, i) { setText(li.children[0], sy.inputs[i].k); setText(li.children[1], sy.inputs[i].v); li.setAttribute('data-tone', sy.inputs[i].tone); setCls(li, 'is-lit', sp >= 0.2 + 0.32 * i); });
          setText(synthOut[0].children[1], sy.intelligence); setText(synthOut[1].children[1], sy.materiality); setText(synthOut[2].children[1], sy.action);
          synthOut.forEach(function (o, i) { setCls(o, 'is-lit', sp >= 1.5 + 0.5 * i); });
        }
      }
      lensBtns.forEach(function (b) { var id = +b.getAttribute('data-lens'), key = KEYS[id]; setCls(b, 'is-on', api.emph().layer === id); setCls(b, 'is-cur', s[key] > 0.5 && !api.emph().layer); });
    }


    return {
      draw: draw, sync: sync, physScen: physScen,
      reset: function () { memo = {}; anchors.key = ''; SC.manual = false; tween = null; },
      destroy: function () { bound.forEach(function (b) { b[0].removeEventListener(b[1], b[2]); }); bound = []; cancelAnimationFrame(tweenRaf); }
    };
  }

  window.CX_RIM_INTEL = { create: create };
})();
