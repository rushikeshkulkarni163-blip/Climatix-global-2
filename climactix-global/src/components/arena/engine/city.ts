/**
 * Mumbai city arena: building tileset, facilities, mapped water, and optional traffic/rail animation.
 *
 * Buildings: Overture footprints extruded to OSM/GHSL heights (see
 * scripts/arena/build_arena_data.py), shaded by a custom shader that derives
 * flat normals from screen-space derivatives and does its own sun lighting.
 * Roofs and walls are shaded procedurally from per-building data (height, seed).
 * Google Photorealistic 3D Tiles are used instead when a Google Map Tiles key or a
 * Cesium ion token is configured (ion streams the same Google tileset).
 */
import type * as CT from "cesium";
import type { CesiumNS } from "./loader";
import { arenaData } from "@/lib/arena/data";
import { FACILITIES, KIND_LABEL, facilityByName } from "@/lib/arena/mumbai";
import type { Quality, Selection } from "../store";
import type { EngineConfig } from "./ArenaEngine";

const BUILDING_FS = /* glsl */ `
float cxHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cxNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float a = cxHash(i), b = cxHash(i + vec2(1.0, 0.0)), c = cxHash(i + vec2(0.0, 1.0)), d = cxHash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
  vec3 pEC = fsInput.attributes.positionEC;
  vec3 nEC = normalize(cross(dFdx(pEC), dFdy(pEC)));
  if (dot(nEC, pEC) > 0.0) nEC = -nEC;
  vec3 pMC = fsInput.attributes.positionMC;            // decimetres, glTF y-up
  vec3 nMC = normalize(cross(dFdx(pMC), dFdy(pMC)));
  bool roof = abs(nMC.y) > 0.85;
  vec4 c0 = fsInput.attributes.color_0;
  float hgt = c0.r * 255.0;
  float seed = c0.g;
  float basis = floor(c0.b * 255.0 / 60.0 + 0.5);
  float yM = pMC.y * 0.1;
  vec3 upEC = czm_eyeEllipsoidNormalEC;
  float day = clamp(u_sun * 5.0 + 0.45, 0.0, 1.0);
  bool tower = hgt > 45.0;

  // facade palette: weathered whites, creams, greys and muted pastels typical of Mumbai
  float s2 = fract(seed * 13.7), s3 = fract(seed * 29.3);
  vec3 plaster = s2 < 0.36 ? vec3(0.86, 0.84, 0.79) : s2 < 0.62 ? vec3(0.80, 0.75, 0.64) : s2 < 0.86 ? vec3(0.70, 0.72, 0.73) : vec3(0.77, 0.67, 0.59);
  plaster *= 0.86 + 0.18 * s3;
  float wAlong = abs(nMC.x) > abs(nMC.z) ? pMC.z * 0.1 : pMC.x * 0.1;
  float streak = cxNoise(vec2(wAlong * 0.8, yM * 0.035 + seed * 10.0));
  float grime = smoothstep(0.55, 0.95, streak) * 0.24 + (1.0 - smoothstep(0.0, 3.0, yM)) * 0.12;
  vec3 wall = plaster * (1.0 - grime);
  // roof materials seen across Mumbai: weathered concrete, blue tarpaulin and terracotta on low-rise,
  // light waterproofing membrane on towers; stained with monsoon grime
  float r1 = fract(seed * 3.17), r2 = fract(seed * 51.3);
  vec3 concrete = mix(vec3(0.42, 0.41, 0.39), vec3(0.60, 0.58, 0.55), r1);
  vec3 roofProc = concrete;
  if (hgt < 11.0 && r2 < 0.18) roofProc = vec3(0.16, 0.32, 0.55);          // blue tarpaulin
  else if (hgt < 13.0 && r2 < 0.33) roofProc = vec3(0.55, 0.30, 0.22);     // clay tiles
  else if (hgt > 30.0 && r2 < 0.5) roofProc = vec3(0.70, 0.70, 0.68);      // membrane
  float stain = cxNoise(pMC.xz * 0.1 * 0.35 + seed * 40.0);
  roofProc *= 0.82 + 0.3 * stain;
  bool hasImg = false;
  vec3 base = roof ? roofProc : wall;

  if (roof && seed < u_solar) {
    vec2 g = fract(pMC.xz * 0.1 / vec2(2.0, 1.1));
    float cell = step(0.07, g.x) * step(0.1, g.y);
    base = mix(vec3(0.58), vec3(0.05, 0.09, 0.20), cell);
    hasImg = false;
  }

  float ndl = max(dot(nEC, czm_lightDirectionEC), 0.0);
  float hemi = dot(nEC, upEC) * 0.5 + 0.5;
  vec3 ambient = mix(vec3(0.30, 0.28, 0.25), vec3(0.52, 0.60, 0.72), hemi) * 0.62 * day + vec3(0.035, 0.04, 0.055) * (1.0 - day);
  vec3 sunC = vec3(1.0, 0.95, 0.86) * 1.05 * day;
  vec3 lit = (roof && hasImg) ? base * (0.80 + 0.28 * ndl) * mix(0.2, 1.0, day) : base * (ambient + sunC * ndl);

  if (!roof) {
    float floorH = 3.1, bay = tower ? 1.6 : 3.0;
    vec2 cell = vec2(floor(yM / floorH), floor(wAlong / bay));
    vec2 f = vec2(fract(yM / floorH), fract(wAlong / bay));
    float win = tower ? step(0.10, f.x) * step(f.x, 0.92) * step(0.04, f.y) * step(f.y, 0.96)
                      : step(0.30, f.x) * step(f.x, 0.78) * step(0.22, f.y) * step(f.y, 0.78);
    win *= step(3.6, yM);                               // ground-floor frontage stays solid
    vec3 V = normalize(-pEC);
    vec3 R = reflect(-V, nEC);
    float skyR = clamp(dot(R, upEC) * 0.5 + 0.5, 0.0, 1.0);
    vec3 refl = mix(vec3(0.16, 0.17, 0.19), vec3(0.55, 0.66, 0.82), skyR);
    float fres = 0.25 + 0.75 * pow(1.0 - max(dot(nEC, V), 0.0), 4.0);
    float spec = pow(max(dot(R, czm_lightDirectionEC), 0.0), 90.0);
    vec3 glassDay = ((vec3(0.05, 0.07, 0.09) + refl * fres) + vec3(1.0, 0.95, 0.85) * spec * 1.6) * day;
    float blinds = 0.6 + 0.4 * cxHash(cell + seed * 17.0);
    lit = mix(lit, glassDay * blinds + lit * 0.08, win * (tower ? 0.9 : 0.72));
    lit *= 0.9 + 0.1 * smoothstep(0.0, 0.07, f.x);       // floor slab lines
    if (day < 0.75) {
      float on = step(0.55, cxHash(cell + seed * 91.0));
      vec3 warm = mix(vec3(1.0, 0.77, 0.48), vec3(0.85, 0.9, 1.0), step(0.82, cxHash(cell + 3.1)));
      lit += warm * win * on * (1.0 - day) * 0.85;
    }
  }
  lit *= mix(0.6, 1.0, smoothstep(0.0, 5.0, yM));       // contact shading at the base

  float haze = (1.0 - exp(-length(pEC) / 15000.0)) * 0.55;
  lit = mix(lit, vec3(0.66, 0.73, 0.82) * day + vec3(0.03, 0.04, 0.06) * (1.0 - day), haze);

  if (u_view > 1.5) {
    vec3 pc = basis < 0.5 ? vec3(0.25, 0.55, 0.95) : basis < 1.5 ? vec3(0.32, 0.74, 0.46) : basis < 2.5 ? vec3(0.86, 0.66, 0.28) : vec3(0.6);
    lit = pc * (0.45 + 0.55 * ndl);
  }
  material.diffuse = lit;
  material.alpha = 1.0;
}`;



interface Road { pts: CT.Cartesian3[]; cum: number[]; len: number; speed: number }
interface Mover { road: number; s: number; dir: 1 | -1; speed: number; p: CT.PointPrimitive; ev: boolean; seed: number }
interface Train { road: number; s: number; dir: 1 | -1; cars: CT.PointPrimitive[] }

export interface FacilityStyle { color: string; outline?: string }

export class CityLayer {
  private C: CesiumNS;
  private viewer: CT.Viewer;
  private tileset: CT.Cesium3DTileset | null = null;
  private shader: CT.CustomShader | null = null;
  private facilities: CT.CustomDataSource;
  private vehicles: CT.PointPrimitiveCollection;
  private trains: CT.PointPrimitiveCollection;
  private roads: Road[] = [];
  private rails: Road[] = [];
  private roadCum: number[] = [];
  private movers: Mover[] = [];
  private trainList: Train[] = [];
  private water: CT.CustomDataSource;
  private loading: Promise<string> | null = null;
  private pending = 0;
  private lastT = performance.now();
  private on: Record<string, boolean> = { "city-facilities": true, "city-traffic": false, "city-water": true };
  private night = false;
  private evShare = 0;
  private quality: Quality = "auto";
  private uniforms = { solar: 0, sun: 0.5, view: 0 };
  private photoreal = false;
  groundOffset = 0;

  constructor(C: CesiumNS, viewer: CT.Viewer) {
    this.C = C;
    this.viewer = viewer;
    this.facilities = new C.CustomDataSource("mumbai-facilities");
    viewer.dataSources.add(this.facilities);
    this.water = new C.CustomDataSource("mumbai-water");
    viewer.dataSources.add(this.water);
    this.vehicles = viewer.scene.primitives.add(new C.PointPrimitiveCollection());
    this.trains = viewer.scene.primitives.add(new C.PointPrimitiveCollection());
  }

  ensureLoaded(hasTerrain: boolean, cfg: EngineConfig): Promise<string> {
    if (!this.loading) this.loading = this.load(hasTerrain, cfg);
    return this.loading;
  }

  private async load(hasTerrain: boolean, cfg: EngineConfig): Promise<string> {
    const { C, viewer } = this;
    if (hasTerrain) {
      try {
        const [c] = await C.sampleTerrainMostDetailed(viewer.terrainProvider, [C.Cartographic.fromDegrees(72.865, 19.03)]);
        this.groundOffset = c.height ?? 0;
      } catch { this.groundOffset = 0; }
    }
    let label = "";
    if (cfg.googleKey || cfg.ionToken) {
      try {
        // the Arena has no geocoder, so the Google-geocoder-only condition is met
        this.tileset = await C.createGooglePhotorealistic3DTileset(cfg.googleKey ? { key: cfg.googleKey, onlyUsingWithGoogleGeocoder: true } : { onlyUsingWithGoogleGeocoder: true }, {
          maximumScreenSpaceError: this.quality === "low" ? 24 : 10,
          cacheBytes: 768 * 1024 * 1024,
          showCreditsOnScreen: true,
          shadows: C.ShadowMode.ENABLED,
        });
        this.photoreal = true;
        this.shader = null;
        label = `Google Photorealistic 3D Tiles${cfg.googleKey ? "" : " via Cesium ion"}`;
      } catch (err) {
        console.warn("[arena] photorealistic tiles unavailable, using Overture buildings", err);
        this.photoreal = false;
      }
    }
    if (!this.photoreal) {
      this.tileset = await C.Cesium3DTileset.fromUrl(`${process.env.NEXT_PUBLIC_ARENA_TILES_URL || "/arena/mumbai"}/tileset.json`, {
        maximumScreenSpaceError: this.quality === "low" ? 24 : 12,
        cacheBytes: 256 * 1024 * 1024,
        shadows: C.ShadowMode.ENABLED,
        dynamicScreenSpaceError: true,
        foveatedScreenSpaceError: true,
      });
      this.shader = new C.CustomShader({
        lightingModel: C.LightingModel.UNLIT,
        uniforms: {
          u_solar: { type: C.UniformType.FLOAT, value: 0 },
          u_sun: { type: C.UniformType.FLOAT, value: 0.5 },
          u_view: { type: C.UniformType.FLOAT, value: 0 },
        },
        fragmentShaderText: BUILDING_FS,
      });

      if (this.groundOffset) {
        const center = C.Cartesian3.fromDegrees(72.865, 19.03, 0);
        const n = C.Ellipsoid.WGS84.geodeticSurfaceNormal(center, new C.Cartesian3());
        this.tileset.modelMatrix = C.Matrix4.fromTranslation(C.Cartesian3.multiplyByScalar(n, this.groundOffset, new C.Cartesian3()));
      }
      label = "Overture buildings · OSM/GHSL heights";
    }
    const ts = this.tileset!;
    if (this.shader) ts.customShader = this.shader;
    ts.loadProgress.addEventListener((p: number, q: number) => { this.pending = p + q; });
    viewer.scene.primitives.add(ts);
    this.pushUniforms();
    if (this.photoreal) {
      // ground height of the photorealistic surface, used for street-level and flight cameras
      viewer.scene.sampleHeightMostDetailed([C.Cartographic.fromDegrees(72.8224, 18.9432)]).then(([c]) => {
        if (c && Number.isFinite(c.height)) this.groundOffset = c.height!;
      }).catch(() => {});
    }

    await Promise.all([this.loadFacilities(), this.loadTransport(), this.loadWater()]);
    this.applyVisibility();
    return label;
  }

  /* ── facilities ─────────────────────────────────────────────────────────── */

  private async loadFacilities() {
    const { C } = this;
    const gj = await arenaData.mumbaiFacilities();
    for (const f of gj.features) {
      const name = (f.properties as { name: string }).name;
      const meta = facilityByName(name);
      if (!meta) continue;
      const g = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
      const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
      let cx = 0, cy = 0, n = 0;
      polys.forEach((poly, i) => {
        const ring = poly[0] as number[][];
        ring.forEach(([x, y]) => { cx += x; cy += y; n++; });
        this.facilities.entities.add({
          id: `fac:${name}:${i}`, name,
          properties: { facility: name, label: `${meta.label} · ${KIND_LABEL[meta.kind]}` },
          polygon: this.photoreal ? {
            hierarchy: new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(ring.flat())),
            material: C.Color.fromCssColorString("#4C7BD9").withAlpha(0.22), classificationType: C.ClassificationType.BOTH,
          } : {
            hierarchy: new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(ring.flat())),
            height: this.groundOffset + 1.5, material: C.Color.fromCssColorString("#4C7BD9").withAlpha(0.22),
          },
          polyline: this.photoreal ? {
            positions: C.Cartesian3.fromDegreesArray(ring.flat()), clampToGround: true,
            width: 2, material: C.Color.fromCssColorString("#8FB1F0").withAlpha(0.9),
          } : {
            positions: C.Cartesian3.fromDegreesArrayHeights(ring.flatMap(([x, y]) => [x, y, this.groundOffset + 3])),
            width: 2, material: C.Color.fromCssColorString("#8FB1F0").withAlpha(0.9),
          },
        });
      });
      const lon = cx / n, lat = cy / n;
      this.facilities.entities.add({
        id: `fac:${name}:label`, name,
        position: C.Cartesian3.fromDegrees(lon, lat, this.groundOffset + 90),
        properties: { facility: name, label: `${meta.label} · ${KIND_LABEL[meta.kind]}` },
        label: {
          text: meta.label, font: "600 12px 'Helvetica Neue', Helvetica, Arial, sans-serif",
          fillColor: C.Color.WHITE, outlineColor: C.Color.fromCssColorString("#0B0E13"), outlineWidth: 3,
          style: C.LabelStyle.FILL_AND_OUTLINE, verticalOrigin: C.VerticalOrigin.BOTTOM,
          distanceDisplayCondition: new C.DistanceDisplayCondition(0, 22_000),
          disableDepthTestDistance: Number.POSITIVE_INFINITY, scale: 1,
          showBackground: true, backgroundColor: C.Color.fromCssColorString("#0E1217").withAlpha(0.82),
          backgroundPadding: new C.Cartesian2(7, 4),
        },
      });
      this.streamAnchor.set(name, { lon, lat });
    }
  }

  private streamAnchor = new Map<string, { lon: number; lat: number }>();

  anchor(name: string) { return this.streamAnchor.get(name); }

  private async loadWater() {
    const { C } = this;
    const gj = await arenaData.mumbaiWater().catch(() => null);
    if (!gj) return;
    const fill = C.Color.fromCssColorString("#2F6DA8").withAlpha(0.32);
    for (const f of gj.features) {
      const g = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
      const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
      const name = (f.properties as { name: string | null; subtype: string }).name;
      const subtype = (f.properties as { subtype: string }).subtype;
      for (const poly of polys) {
        this.water.entities.add({
          polygon: {
            hierarchy: new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray((poly[0] as number[][]).flat()),
              (poly.slice(1) as number[][][]).map((h) => new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(h.flat())))),
            material: fill, classificationType: this.photoreal ? C.ClassificationType.BOTH : C.ClassificationType.TERRAIN,
          },
          properties: { label: `${name ?? "Unnamed"} · ${subtype} (Overture water)` },
        });
      }
    }
  }

  setFacilityStyles(styles: Record<string, FacilityStyle> | null) {
    const { C } = this;
    for (const ent of this.facilities.entities.values) {
      const name = ent.properties?.facility?.getValue();
      const st = styles?.[name];
      if (ent.polygon) ent.polygon.material = new C.ColorMaterialProperty(C.Color.fromCssColorString(st?.color ?? "#4C7BD9").withAlpha(st ? 0.42 : 0.22));
      if (ent.polyline) ent.polyline.material = new C.ColorMaterialProperty(C.Color.fromCssColorString(st?.outline ?? st?.color ?? "#8FB1F0").withAlpha(0.95));
    }
  }

  /* ── traffic and rail (illustrative animation on real road geometry) ──── */

  private async loadTransport() {
    const { C } = this;
    const t = await arenaData.mumbaiTransport();
    const speed: Record<string, number> = { motorway: 17, trunk: 14, primary: 11, secondary: 9 };
    const toRoad = (p: [number, number][], v: number): Road => {
      const pts = p.map(([x, y]) => C.Cartesian3.fromDegrees(x, y, this.groundOffset + 2.2));
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + C.Cartesian3.distance(pts[i - 1], pts[i]));
      return { pts, cum, len: cum[cum.length - 1], speed: v };
    };
    this.roads = t.roads.map((r) => toRoad(r.p, speed[r.c] ?? 9)).filter((r) => r.len > 40);
    this.rails = t.rail.map((r) => toRoad(r.p, 16)).filter((r) => r.len > 300);
    let acc = 0;
    // weight motorways/trunks up so flow concentrates on arterials
    this.roadCum = this.roads.map((r) => (acc += r.len * (r.speed >= 14 ? 2.2 : 1)));
    this.spawn();
  }

  private spawn() {
    const { C } = this;
    this.vehicles.removeAll();
    this.trains.removeAll();
    this.movers = [];
    this.trainList = [];
    if (!this.roads.length) return;
    const n = this.quality === "low" ? 500 : this.quality === "balanced" ? 1200 : 2400;
    const ddc = new C.DistanceDisplayCondition(0, 14_000);
    for (let i = 0; i < n; i++) {
      const road = this.pickRoad();
      const p = this.vehicles.add({ position: this.roads[road].pts[0], pixelSize: 3.2, color: C.Color.WHITE, distanceDisplayCondition: ddc,
        scaleByDistance: new C.NearFarScalar(200, 2.2, 12_000, 0.6) });
      this.movers.push({ road, s: Math.random() * this.roads[road].len, dir: Math.random() < 0.5 ? 1 : -1,
        speed: this.roads[road].speed * (0.7 + Math.random() * 0.5), p, ev: false, seed: Math.random() });
    }
    const nt = Math.min(36, this.rails.length);
    for (let i = 0; i < nt; i++) {
      const road = Math.floor(Math.random() * this.rails.length);
      const cars = Array.from({ length: 6 }, () => this.trains.add({ position: this.rails[road].pts[0], pixelSize: 4.2,
        color: C.Color.fromCssColorString("#C9D3E0"), distanceDisplayCondition: new C.DistanceDisplayCondition(0, 18_000),
        scaleByDistance: new C.NearFarScalar(200, 2.4, 15_000, 0.7) }));
      this.trainList.push({ road, s: Math.random() * this.rails[road].len, dir: Math.random() < 0.5 ? 1 : -1, cars });
    }
    this.restyleVehicles();
  }

  private pickRoad(): number {
    const total = this.roadCum[this.roadCum.length - 1];
    const x = Math.random() * total;
    let lo = 0, hi = this.roadCum.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (this.roadCum[m] < x) lo = m + 1; else hi = m; }
    return lo;
  }

  private at(r: Road, s: number, out: CT.Cartesian3): CT.Cartesian3 {
    const { C } = this;
    let lo = 0, hi = r.cum.length - 1;
    while (lo < hi - 1) { const m = (lo + hi) >> 1; if (r.cum[m] <= s) lo = m; else hi = m; }
    const seg = r.cum[hi] - r.cum[lo] || 1;
    return C.Cartesian3.lerp(r.pts[lo], r.pts[hi], (s - r.cum[lo]) / seg, out);
  }

  setEvShare(share: number) { this.evShare = Math.max(0, Math.min(1, share)); this.restyleVehicles(); }

  private restyleVehicles() {
    const { C } = this;
    const head = C.Color.fromCssColorString("#FFE3AE"), tail = C.Color.fromCssColorString("#E0463A");
    const day = C.Color.fromCssColorString("#E6E8EC"), dayDark = C.Color.fromCssColorString("#9AA1AB");
    const ev = C.Color.fromCssColorString("#7FA6FF");
    for (const m of this.movers) {
      m.ev = m.seed < this.evShare;
      m.p.color = m.ev ? ev : this.night ? (m.dir === 1 ? head : tail) : m.seed > 0.6 ? dayDark : day;
    }
  }

  /* ── per-frame ─────────────────────────────────────────────────────────── */

  step(now: number, sunElevationRad: number) {
    const dt = Math.min(0.1, (now - this.lastT) / 1000);
    this.lastT = now;
    const night = sunElevationRad < -0.05;
    if (night !== this.night) { this.night = night; this.restyleVehicles(); }
    if (this.uniforms.sun !== sunElevationRad) { this.uniforms.sun = sunElevationRad; this.pushUniforms(); }
    if (!this.vehicles.show || !this.movers.length) return;
    if (this.viewer.camera.positionCartographic.height > 16_000) return;
    for (const m of this.movers) {
      const r = this.roads[m.road];
      m.s += m.dir * m.speed * dt;
      if (m.s < 0 || m.s > r.len) {
        m.road = this.pickRoad();
        const nr = this.roads[m.road];
        m.dir = Math.random() < 0.5 ? 1 : -1;
        m.s = m.dir === 1 ? 0 : nr.len;
        m.speed = nr.speed * (0.7 + m.seed * 0.5);
      }
      m.p.position = this.at(this.roads[m.road], m.s, m.p.position);
    }
    for (const t of this.trainList) {
      const r = this.rails[t.road];
      t.s += t.dir * r.speed * dt;
      if (t.s < 0 || t.s > r.len) { t.road = Math.floor(Math.random() * this.rails.length); t.s = t.dir === 1 ? 0 : this.rails[t.road].len; }
      const rr = this.rails[t.road];
      t.cars.forEach((c, i) => { c.position = this.at(rr, Math.max(0, Math.min(rr.len, t.s - t.dir * i * 22)), c.position); });
    }
  }

  /* ── visuals driven by scenario / simulator ────────────────────────────── */

  setSolar(fraction: number) { this.uniforms.solar = Math.max(0, Math.min(1, fraction)); this.pushUniforms(); }
  setView(v: "standard" | "provenance") { this.uniforms.view = v === "provenance" ? 2 : 0; this.pushUniforms(); }

  private pushUniforms() {
    const s = this.shader;
    if (!s) return;
    s.setUniform("u_view", this.uniforms.view);
    if (!this.photoreal) { s.setUniform("u_solar", this.uniforms.solar); s.setUniform("u_sun", this.uniforms.sun); }
  }

  setLayer(id: string, on: boolean) {
    if (!(id in this.on)) return;
    this.on[id] = on;
    this.applyVisibility();
  }

  private applyVisibility() {
    this.facilities.show = this.on["city-facilities"];
    this.vehicles.show = this.trains.show = this.on["city-traffic"];
    this.water.show = this.on["city-water"];
  }

  setShadows(on: boolean) {
    if (this.tileset) this.tileset.shadows = on ? this.C.ShadowMode.ENABLED : this.C.ShadowMode.DISABLED;
  }

  setQuality(q: Quality) {
    const changed = q !== this.quality;
    this.quality = q;
    if (this.tileset && !this.photoreal) this.tileset.maximumScreenSpaceError = q === "low" ? 24 : q === "balanced" ? 16 : 12;
    if (changed && this.roads.length) this.spawn();
  }

  pendingTiles() { return this.pending; }
  isPhotoreal() { return this.photoreal && !!this.tileset; }

  resolvePick(picked: unknown): Selection | null {
    const ent = (picked as { id?: CT.Entity })?.id;
    const name = ent?.properties?.facility?.getValue?.();
    return typeof name === "string" ? { type: "facility", name } : null;
  }

  labelFor(picked: unknown): string | null {
    const ent = (picked as { id?: CT.Entity })?.id;
    const l = ent?.properties?.facility ? ent.properties.label?.getValue?.() : null;
    return typeof l === "string" ? l : null;
  }

  facilityNames() { return FACILITIES.map((f) => f.name); }

  destroy() {
  }
}
