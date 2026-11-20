/**
 * ArenaEngine — imperative CesiumJS scene controller for the Climate Arena.
 *
 * React owns state (store.ts); the engine owns the WebGL scene. Components call
 * engine methods; the engine reports picks and status through callbacks.
 *
 * Animation policy: only camera movement, simulated satellite orbital motion and
 * the passage of time move. Observation layers are static rasters for a chosen
 * acquisition date; there are no particle, glow or weather effects.
 */
import type * as CT from "cesium";
import type { CesiumNS } from "./loader";
import { gibsUrl, type GibsLayer, LAYERS } from "@/lib/arena/layers";
import type { View } from "@/lib/arena/mumbai";
import { CITY_VIEWS, FLIGHT_PATH, STREET_START } from "@/lib/arena/mumbai";
import type { CameraMode, EngineStatus, Quality, Selection } from "../store";
import { GlobalLayers } from "./globalLayers";
import { CityLayer } from "./city";
import { WalkControls } from "./controls";
import { ConstellationLayer } from "./constellation";

export interface EngineConfig {
  ionToken?: string;
  googleKey?: string;
  imagery: "auto" | "ion" | "esri" | "gibs";
}

export interface EngineCallbacks {
  onPick: (s: Selection | { type: "globe"; lon: number; lat: number }) => void;
  onHover: (label: string | null, x: number, y: number) => void;
  onStatus: (s: Partial<EngineStatus>) => void;
  onFlightLabel: (label: string | null) => void;
  onCityProximity: (inCity: boolean) => void;
}

const MUMBAI_CENTER = { lon: 72.865, lat: 19.03 };
const DEFAULT_FOV = Math.PI / 3;

export class ArenaEngine {
  readonly C: CesiumNS;
  readonly viewer: CT.Viewer;
  readonly global: GlobalLayers;
  readonly city: CityLayer;
  readonly ceon: ConstellationLayer;
  private walk: WalkControls;
  private cb: EngineCallbacks;
  private cfg: EngineConfig;
  private gibs = new Map<string, { layer: CT.ImageryLayer; time: string }>();
  private compareLayer: { id: string; layer: CT.ImageryLayer; time: string } | null = null;
  private esri: CT.ImageryLayer | null = null;
  private nightLayer: CT.ImageryLayer | null = null;
  private handler: CT.ScreenSpaceEventHandler;
  private lastInteract = 0;
  private autoRotate = true;
  private mode: CameraMode = "orbit";
  private quality: Quality = "auto";
  private frames = 0;
  private fpsT = performance.now();
  private globeQueue = 0;
  private flight: { t0: number; dur: number; spline: CT.CatmullRomSpline } | null = null;
  private follow = { range: 55, pitch: -0.32 };
  private tween: { t0: number; dur: number; from: { carto: CT.Cartographic; dir: CT.Cartesian3; up: CT.Cartesian3 } } | null = null;
  private hoverT = 0;
  private hasTerrain = false;
  private disposed = false;
  private inCity = false;
  private timeScale = 1;
  private lastTickT = performance.now();
  private lowFpsSeconds = 0;
  private dprCap = 1;
  private hourOverride: number | null = null;
  private removers: (() => void)[] = [];

  static async create(C: CesiumNS, container: HTMLElement, credits: HTMLElement, cfg: EngineConfig, cb: EngineCallbacks) {
    const e = new ArenaEngine(C, container, credits, cfg, cb);
    await e.init();
    return e;
  }

  private constructor(C: CesiumNS, container: HTMLElement, credits: HTMLElement, cfg: EngineConfig, cb: EngineCallbacks) {
    this.C = C;
    this.cb = cb;
    this.cfg = cfg;
    // "__cesium_eval__" (development only) keeps CesiumJS's built-in evaluation token.
    if (cfg.ionToken && cfg.ionToken !== "__cesium_eval__") C.Ion.defaultAccessToken = cfg.ionToken;
    const useIon = !!cfg.ionToken && (cfg.imagery === "auto" || cfg.imagery === "ion");
    const gibsBase = new C.UrlTemplateImageryProvider({
      url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
      tilingScheme: new C.WebMercatorTilingScheme(), maximumLevel: 8,
      credit: new C.Credit("NASA Blue Marble Next Generation (GIBS)"),
    });
    this.viewer = new C.Viewer(container, {
      baseLayer: useIon ? C.ImageryLayer.fromWorldImagery({}) : new C.ImageryLayer(gibsBase, {}),
      terrain: cfg.ionToken ? C.Terrain.fromWorldTerrain({ requestVertexNormals: true, requestWaterMask: true }) : undefined,
      animation: false, timeline: false, baseLayerPicker: false, geocoder: false, homeButton: false,
      sceneModePicker: false, navigationHelpButton: false, fullscreenButton: false, infoBox: false,
      selectionIndicator: false, creditContainer: credits, shouldAnimate: true,
      // at ≥1.5× pixel density geometric aliasing is already small; 2× MSAA keeps edges clean at half the cost
      msaaSamples: (typeof window !== "undefined" && window.devicePixelRatio >= 1.5) ? 2 : 4,
      useBrowserRecommendedResolution: false, // render at device pixels (sharp on Retina / HiDPI)
      contextOptions: { webgl: { powerPreference: "high-performance" } },
    });
    this.hasTerrain = !!cfg.ionToken;
    this.global = new GlobalLayers(C, this.viewer);
    this.city = new CityLayer(C, this.viewer);
    this.ceon = new ConstellationLayer(C, this.viewer);
    this.walk = new WalkControls(C, this.viewer);
    this.handler = new C.ScreenSpaceEventHandler(this.viewer.scene.canvas);
    cb.onStatus({
      imagery: useIon ? "Cesium ion · Bing Maps Aerial" : cfg.imagery === "gibs" ? "NASA Blue Marble (GIBS)" : "NASA Blue Marble + Esri World Imagery",
      terrain: cfg.ionToken ? `Cesium World Terrain${cfg.ionToken === "__cesium_eval__" ? " (evaluation token)" : ""}` : "Ellipsoid (no terrain token)",
    });
  }

  private async init() {
    const { C, viewer } = this;
    const scene = viewer.scene;
    const globe = scene.globe;
    globe.enableLighting = true;
    globe.dynamicAtmosphereLighting = true;
    globe.dynamicAtmosphereLightingFromSun = true;
    globe.showGroundAtmosphere = true;
    globe.baseColor = C.Color.fromCssColorString("#0A0F16");
    globe.maximumScreenSpaceError = 1.25;
    globe.tileCacheSize = 1000;
    globe.preloadSiblings = true;
    globe.loadingDescendantLimit = 30;
    // HDR with a neutral PBR tonemapper: realistic sun, atmosphere and model lighting without glow.
    if (scene.highDynamicRangeSupported) {
      scene.highDynamicRange = true;
      scene.postProcessStages.tonemapper = C.Tonemapper.PBR_NEUTRAL;
      scene.postProcessStages.exposure = 1.15;
    }
    scene.atmosphere.lightIntensity = 11;
    this.dprCap = Math.min(1, 2 / (window.devicePixelRatio || 1)); // never above 2× device pixels
    viewer.resolutionScale = this.autoScale();
    globe.depthTestAgainstTerrain = this.hasTerrain;
    globe.shadows = C.ShadowMode.RECEIVE_ONLY;
    scene.fog.enabled = true;
    if (scene.skyAtmosphere) scene.skyAtmosphere.show = true;
    scene.postProcessStages.fxaa.enabled = true;
    scene.backgroundColor = C.Color.BLACK;
    scene.splitPosition = 0.5;
    viewer.shadowMap.size = 2048;
    viewer.shadowMap.softShadows = false;
    viewer.shadowMap.maximumDistance = 6000;

    const usingIon = !!this.cfg.ionToken && (this.cfg.imagery === "auto" || this.cfg.imagery === "ion");
    const base = viewer.imageryLayers.get(0);
    base.nightAlpha = 0.0;
    if (!usingIon && this.cfg.imagery !== "gibs") {
      const esri = new C.UrlTemplateImageryProvider({
        url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        maximumLevel: 19, credit: new C.Credit("Esri, Maxar, Earthstar Geographics, and the GIS User Community"),
      });
      this.esri = new C.ImageryLayer(esri, { minimumTerrainLevel: 5, nightAlpha: 0.22 });
      viewer.imageryLayers.add(this.esri);
    }
    const night = viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({
      url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png",
      tilingScheme: new C.WebMercatorTilingScheme(), maximumLevel: 8, credit: new C.Credit("NASA Black Marble 2016 (VIIRS, GIBS)"),
    }));
    night.dayAlpha = 0.0;
    night.nightAlpha = 1.0;
    night.brightness = 1.3;
    this.nightLayer = night;

    const o = openingView();
    scene.camera.setView({ destination: C.Cartesian3.fromDegrees(o.lon, o.lat, 21_000_000) });

    this.bindInput();
    const tick = () => this.onTick();
    viewer.clock.onTick.addEventListener(tick);
    this.removers.push(() => viewer.clock.onTick.removeEventListener(tick));
    const post = () => { this.frames++; };
    scene.postRender.addEventListener(post);
    this.removers.push(() => scene.postRender.removeEventListener(post));
    const tl = (q: number) => { this.globeQueue = q; };
    globe.tileLoadProgressEvent.addEventListener(tl);
    this.removers.push(() => globe.tileLoadProgressEvent.removeEventListener(tl));
    scene.camera.percentageChanged = 0.15;
    const camChanged = () => this.onCameraChanged();
    scene.camera.changed.addEventListener(camChanged);
    this.removers.push(() => scene.camera.changed.removeEventListener(camChanged));

    await Promise.all([this.global.init(), this.ceon.init()]);
    this.onCameraChanged();
  }

  /* ── input, picking, hover ─────────────────────────────────────────────── */

  private bindInput() {
    const { C, viewer, handler } = this;
    const canvas = viewer.scene.canvas;
    const mark = () => { this.lastInteract = performance.now(); };
    const wheel = (e: WheelEvent) => {
      if (this.mode !== "satfollow") return;
      e.preventDefault();
      this.follow.range = Math.max(18, Math.min(4_000_000, this.follow.range * Math.exp(e.deltaY * 0.0015)));
    };
    canvas.addEventListener("pointerdown", mark);
    canvas.addEventListener("wheel", mark, { passive: true });
    canvas.addEventListener("wheel", wheel, { passive: false });
    this.removers.push(() => { canvas.removeEventListener("pointerdown", mark); canvas.removeEventListener("wheel", mark); canvas.removeEventListener("wheel", wheel); });

    handler.setInputAction((e: { position: CT.Cartesian2 }) => {
      if (this.mode === "street" || this.mode === "free") return;
      const picked = viewer.scene.pick(e.position);
      const sel = picked ? this.global.resolvePick(picked) ?? this.city.resolvePick(picked) : null;
      if (sel) { this.cb.onPick(sel); return; }
      const ray = viewer.camera.getPickRay(e.position);
      const cart = (ray && viewer.scene.globe.pick(ray, viewer.scene)) ?? viewer.camera.pickEllipsoid(e.position);
      if (!cart) return;
      const c = C.Cartographic.fromCartesian(cart);
      this.cb.onPick({ type: "globe", lon: C.Math.toDegrees(c.longitude), lat: C.Math.toDegrees(c.latitude) });
    }, C.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction((e: { endPosition: CT.Cartesian2 }) => {
      const now = performance.now();
      if (now - this.hoverT < 90) return;
      this.hoverT = now;
      const picked = viewer.scene.pick(e.endPosition);
      const label = picked ? this.global.labelFor(picked) ?? this.city.labelFor(picked) : null;
      canvas.style.cursor = label ? "pointer" : "";
      this.cb.onHover(label, e.endPosition.x, e.endPosition.y);
    }, C.ScreenSpaceEventType.MOUSE_MOVE);
  }

  /* ── frame loop ─────────────────────────────────────────────────────────── */

  simTime(): number { return this.C.JulianDate.toDate(this.viewer.clock.currentTime).getTime(); }

  private onTick() {
    if (this.disposed) return;
    const { C, viewer } = this;
    const cam = viewer.camera;
    const now = performance.now();
    const h = cam.positionCartographic.height;

    const dt = Math.min(0.1, (now - this.lastTickT) / 1000);
    this.lastTickT = now;
    // time-based (frame-rate independent) slow rotation: 1.6° of longitude per second
    if (this.autoRotate && this.mode === "orbit" && h > 6_000_000 && now - this.lastInteract > 5000 && !this.flight) {
      cam.rotate(C.Cartesian3.UNIT_Z, -C.Math.toRadians(1.6) * dt);
    }
    const ms = this.simTime();
    this.ceon.step(ms, h);
    if (this.mode === "satfollow") this.stepFollow(ms);
    else if (this.mode === "satview") this.stepSensorView(ms);
    if (this.flight) this.stepFlight(now);
    this.walk.step();
    this.city.step(now, this.sunElevationAtMumbai());

    if (now - this.fpsT > 1000) {
      const fps = (this.frames * 1000) / (now - this.fpsT);
      this.frames = 0; this.fpsT = now;
      this.adapt(fps);
      this.cb.onStatus({ fps: Math.round(fps), tilesLoading: this.globeQueue + this.city.pendingTiles(), resolutionScale: viewer.resolutionScale * (window.devicePixelRatio || 1) });
    }
  }

  /** Chase camera behind and above the spacecraft along its track, Earth below. */
  private stepFollow(ms: number) {
    const { C } = this;
    const { pos, up, along } = this.ceon.frame(this.ceon.selectedMission().id, ms);
    const R = this.follow.range, p = this.follow.pitch;
    const eye = C.Cartesian3.add(
      C.Cartesian3.multiplyByScalar(along, -R * Math.cos(p), new C.Cartesian3()),
      C.Cartesian3.multiplyByScalar(up, -R * Math.sin(p), new C.Cartesian3()), new C.Cartesian3());
    C.Cartesian3.add(pos, eye, eye);
    const dir = C.Cartesian3.normalize(C.Cartesian3.subtract(pos, eye, new C.Cartesian3()), new C.Cartesian3());
    const camUp = C.Cartesian3.normalize(C.Cartesian3.subtract(up, C.Cartesian3.multiplyByScalar(dir, C.Cartesian3.dot(dir, up), new C.Cartesian3()), new C.Cartesian3()), new C.Cartesian3());
    this.applyPose(eye, dir, camUp);
  }

  /** Looking straight down from the spacecraft with the sensor's cross-track field of view. */
  private stepSensorView(ms: number) {
    const { C } = this;
    const { pos, up, along } = this.ceon.frame(this.ceon.selectedMission().id, ms);
    const eye = C.Cartesian3.subtract(pos, C.Cartesian3.multiplyByScalar(up, 8, new C.Cartesian3()), new C.Cartesian3());
    this.applyPose(eye, C.Cartesian3.negate(up, new C.Cartesian3()), along);
  }

  /** Sets the camera pose, blending from the captured start pose while a transition is running. */
  private applyPose(eye: CT.Cartesian3, dir: CT.Cartesian3, up: CT.Cartesian3) {
    const { C, viewer } = this;
    const tw = this.tween;
    if (tw) {
      const u = Math.min(1, (performance.now() - tw.t0) / tw.dur);
      const k = u * u * (3 - 2 * u);
      const to = C.Cartographic.fromCartesian(eye);
      const fr = tw.from.carto;
      let dl = to.longitude - fr.longitude;
      if (dl > Math.PI) dl -= 2 * Math.PI; else if (dl < -Math.PI) dl += 2 * Math.PI;
      // log-height interpolation keeps the descent from orbit smooth
      const h = Math.exp(Math.log(Math.max(fr.height, 10)) + k * (Math.log(Math.max(to.height, 10)) - Math.log(Math.max(fr.height, 10))));
      const pos = C.Cartesian3.fromRadians(fr.longitude + k * dl, fr.latitude + k * (to.latitude - fr.latitude), h);
      const d = C.Cartesian3.normalize(C.Cartesian3.lerp(tw.from.dir, dir, k, new C.Cartesian3()), new C.Cartesian3());
      const uu = C.Cartesian3.normalize(C.Cartesian3.lerp(tw.from.up, up, k, new C.Cartesian3()), new C.Cartesian3());
      viewer.camera.setView({ destination: pos, orientation: { direction: d, up: uu } });
      if (u >= 1) this.tween = null;
      return;
    }
    viewer.camera.setView({ destination: eye, orientation: { direction: dir, up } });
  }

  private startTween(dur: number) {
    const cam = this.viewer.camera;
    this.tween = { t0: performance.now(), dur, from: { carto: cam.positionCartographic.clone(), dir: cam.directionWC.clone(), up: cam.upWC.clone() } };
  }

  /** Auto: up to 1.5 rendered pixels per CSS pixel — sharp on Retina at ~half the cost of full 2×. */
  private autoScale() {
    const dpr = window.devicePixelRatio || 1;
    return Math.min(this.dprCap, 1.5 / dpr);
  }

  /** Lowers resolution only after 3 s of sustained low frame rate, never below 1 pixel per CSS pixel. */
  private adapt(fps: number) {
    if (this.quality !== "auto") return;
    const v = this.viewer;
    const dpr = window.devicePixelRatio || 1;
    const ceil = this.autoScale();
    const floor = Math.min(ceil, 1 / dpr);
    if (fps < 24 && this.globeQueue < 40) this.lowFpsSeconds++; else this.lowFpsSeconds = 0;
    if (this.lowFpsSeconds >= 3 && v.resolutionScale > floor) { v.resolutionScale = Math.max(floor, v.resolutionScale - 0.08); this.lowFpsSeconds = 0; }
    else if (fps > 50 && v.resolutionScale < ceil) v.resolutionScale = Math.min(ceil, v.resolutionScale + 0.04);
  }

  private onCameraChanged() {
    const h = this.viewer.camera.positionCartographic.height;
    this.global.onCameraHeight(h);
    // Black Marble is ~500 m resolution: crisp from orbit, a saturated blur at city scale.
    const f = Math.max(0, Math.min(1, (Math.log10(Math.max(h, 1)) - 4.3) / (5.4 - 4.3)));
    if (this.nightLayer) this.nightLayer.nightAlpha = 0.12 + 0.88 * f;
    if (this.esri) this.esri.nightAlpha = 0.5 - 0.28 * f;
    const base = this.viewer.imageryLayers.get(0);
    base.nightAlpha = this.esri ? 0 : 0.45 - 0.45 * f;
    // photorealistic tiles are global and include terrain: hide the ellipsoid globe near the ground
    if (this.city.isPhotoreal()) this.viewer.scene.globe.show = h > 90_000;
    const c = this.viewer.camera.positionCartographic;
    const near = h < 60_000 && Math.abs(this.C.Math.toDegrees(c.latitude) - MUMBAI_CENTER.lat) < 0.6 && Math.abs(this.C.Math.toDegrees(c.longitude) - MUMBAI_CENTER.lon) < 0.6;
    if (near !== this.inCity) {
      this.inCity = near;
      this.cb.onCityProximity(near);
      if (near) this.city.ensureLoaded(this.hasTerrain, this.cfg).then((s) => { this.cb.onStatus({ buildings: s }); this.onCameraChanged(); }).catch((err) => this.cb.onStatus({ buildings: `Buildings unavailable: ${String(err?.message ?? err)}` }));
      this.applyShadows();
    }
  }

  private applyShadows() {
    const on = this.inCity && (this.quality === "high" || (this.quality === "auto" && !isLowPowerDevice()));
    this.viewer.shadows = on;
    this.city.setShadows(on);
  }

  private sunElevationAtMumbai(): number {
    const { C, viewer } = this;
    const sun = C.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(viewer.clock.currentTime);
    const m = C.Transforms.computeIcrfToFixedMatrix(viewer.clock.currentTime) ?? C.Transforms.computeTemeToPseudoFixedMatrix(viewer.clock.currentTime);
    const sunF = C.Matrix3.multiplyByVector(m, sun, new C.Cartesian3());
    const p = C.Cartesian3.fromDegrees(MUMBAI_CENTER.lon, MUMBAI_CENTER.lat);
    const up = C.Ellipsoid.WGS84.geodeticSurfaceNormal(p, new C.Cartesian3());
    const dir = C.Cartesian3.normalize(C.Cartesian3.subtract(sunF, p, new C.Cartesian3()), new C.Cartesian3());
    return Math.asin(C.Cartesian3.dot(up, dir));
  }

  /* ── layers ─────────────────────────────────────────────────────────────── */

  setLayer(id: string, on: boolean, time = "default") {
    const def = LAYERS.find((l) => l.id === id);
    if (!def) return;
    if (def.kind === "gibs") { this.setGibs(def, on, time || "default"); return; }
    if (id === "ceon") { this.ceon.setVisible(on); return; }
    this.global.setLayer(id, on);
    this.city.setLayer(id, on);
  }

  private makeGibs(def: GibsLayer, time: string) {
    const { C, viewer } = this;
    const layer = viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({
      url: gibsUrl(def, time), tilingScheme: new C.WebMercatorTilingScheme(), maximumLevel: def.maxLevel,
      credit: new C.Credit(`${def.dataset} — ${def.source}`),
    }));
    layer.alpha = def.alpha;
    layer.nightAlpha = def.id === "truecolor" ? 0.3 : def.alpha;
    return layer;
  }

  private setGibs(def: GibsLayer, on: boolean, time: string) {
    const cur = this.gibs.get(def.id);
    if (cur && (cur.time !== time || !on)) {
      if (!on) { cur.layer.show = false; }
      else { this.viewer.imageryLayers.remove(cur.layer, true); this.gibs.delete(def.id); }
    }
    if (on) {
      const ex = this.gibs.get(def.id);
      if (ex) ex.layer.show = true;
      else this.gibs.set(def.id, { layer: this.makeGibs(def, time), time });
    }
    this.applySplit();
  }

  /** Swipe comparison: the layer's current date on the left, `time` on the right. */
  setCompare(id: string | null, time: string | null) {
    const { viewer } = this;
    if (this.compareLayer && (this.compareLayer.id !== id || this.compareLayer.time !== time)) {
      viewer.imageryLayers.remove(this.compareLayer.layer, true);
      this.compareLayer = null;
    }
    if (id && time && !this.compareLayer) {
      const def = LAYERS.find((l) => l.id === id);
      if (def?.kind === "gibs") this.compareLayer = { id, layer: this.makeGibs(def, time), time };
    }
    this.applySplit();
  }

  private applySplit() {
    const C = this.C;
    for (const [id, g] of Array.from(this.gibs.entries())) {
      g.layer.splitDirection = this.compareLayer && this.compareLayer.id === id ? C.SplitDirection.LEFT : C.SplitDirection.NONE;
    }
    if (this.compareLayer) this.compareLayer.layer.splitDirection = C.SplitDirection.RIGHT;
  }

  setSplit(v: number) { this.viewer.scene.splitPosition = v; }

  /* ── camera ─────────────────────────────────────────────────────────────── */

  flyTo(lon: number, lat: number, range: number, opts: { pitch?: number; heading?: number; duration?: number } = {}) {
    const { C, viewer } = this;
    this.stopSpecialModes();
    const pitch = opts.pitch ?? (range > 3_000_000 ? -90 : range > 400_000 ? -70 : -45);
    viewer.camera.flyToBoundingSphere(new C.BoundingSphere(C.Cartesian3.fromDegrees(lon, lat, 0), 10), {
      offset: new C.HeadingPitchRange(C.Math.toRadians(opts.heading ?? 0), C.Math.toRadians(pitch), range),
      duration: opts.duration ?? (range > 3_000_000 ? 3.0 : 4.2),
      easingFunction: C.EasingFunction.CUBIC_IN_OUT,
    });
    this.lastInteract = performance.now();
  }

  flyToView(v: View, duration = 3) {
    const { C, viewer } = this;
    viewer.camera.flyTo({
      destination: C.Cartesian3.fromDegrees(v.lon, v.lat, v.height + this.city.groundOffset),
      orientation: { heading: C.Math.toRadians(v.heading), pitch: C.Math.toRadians(v.pitch), roll: 0 },
      duration: duration * 1.25, easingFunction: C.EasingFunction.CUBIC_IN_OUT,
    });
  }

  setCameraMode(mode: CameraMode) {
    const { C, viewer } = this;
    this.stopSpecialModes();
    this.mode = mode;
    const ctl = viewer.scene.screenSpaceCameraController;
    ctl.enableInputs = true;
    switch (mode) {
      case "orbit": {
        const o = openingView();
        this.flyTo(o.lon, o.lat, 21_000_000);
        this.mode = "orbit";
        break;
      }
      case "satfollow": {
        this.follow = { range: 34, pitch: -0.28 };
        ctl.enableInputs = false;
        this.startTween(4200);
        break;
      }
      case "satview": {
        const m = this.ceon.selectedMission();
        ctl.enableInputs = false;
        this.startTween(3600);
        const fov = Math.max(C.Math.toRadians(14), Math.min(C.Math.toRadians(112), 2 * C.Math.toRadians(m.sensor.halfAngleDeg)));
        (viewer.camera.frustum as CT.PerspectiveFrustum).fov = fov;
        break;
      }
      case "satellite": case "high": case "intel":
        this.flyToView(CITY_VIEWS[mode]);
        break;
      case "flight":
        this.startFlight();
        break;
      case "street": {
        const s = STREET_START;
        viewer.camera.flyTo({
          destination: C.Cartesian3.fromDegrees(s.lon, s.lat, this.city.groundOffset + 1.8),
          orientation: { heading: C.Math.toRadians(s.heading), pitch: C.Math.toRadians(2), roll: 0 },
          duration: 3.5,
          complete: () => { if (this.mode === "street") { ctl.enableInputs = false; this.walk.start("street", this.city.groundOffset); } },
        });
        break;
      }
      case "free":
        ctl.enableInputs = false;
        this.walk.start("free", this.city.groundOffset);
        break;
    }
  }

  private stopSpecialModes() {
    const { C, viewer } = this;
    this.walk.stop();
    viewer.scene.screenSpaceCameraController.enableInputs = true;
    if (this.mode === "satfollow" || this.mode === "satview") {
      (viewer.camera.frustum as CT.PerspectiveFrustum).fov = DEFAULT_FOV;
    }
    this.tween = null;
    if (this.flight) { this.flight = null; this.cb.onFlightLabel(null); }
    this.mode = "orbit";
  }

  private startFlight() {
    const { C } = this;
    const pts = FLIGHT_PATH.map((p) => C.Cartesian3.fromDegrees(p.lon, p.lat, p.height + this.city.groundOffset));
    const times = pts.map((_, i) => i / (pts.length - 1));
    const spline = new C.CatmullRomSpline({ times, points: pts });
    this.viewer.scene.screenSpaceCameraController.enableInputs = false;
    this.viewer.camera.flyTo({
      destination: pts[0],
      orientation: { heading: C.Math.toRadians(5), pitch: C.Math.toRadians(-18), roll: 0 },
      duration: 3,
      complete: () => { if (this.mode === "flight") this.flight = { t0: performance.now(), dur: 80_000, spline }; },
    });
  }

  private stepFlight(now: number) {
    const { C, viewer } = this;
    const f = this.flight!;
    const u = (now - f.t0) / f.dur;
    if (u >= 1) { this.flight = null; this.cb.onFlightLabel(null); this.viewer.scene.screenSpaceCameraController.enableInputs = true; return; }
    const ease = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    const t = Math.min(0.999, ease);
    const pos = f.spline.evaluate(t, new C.Cartesian3());
    const ahead = f.spline.evaluate(Math.min(1, t + 0.035), new C.Cartesian3());
    const up = C.Ellipsoid.WGS84.geodeticSurfaceNormal(pos, new C.Cartesian3());
    const target = C.Cartesian3.add(ahead, C.Cartesian3.multiplyByScalar(up, -170, new C.Cartesian3()), new C.Cartesian3());
    const dir = C.Cartesian3.normalize(C.Cartesian3.subtract(target, pos, new C.Cartesian3()), new C.Cartesian3());
    const right = C.Cartesian3.normalize(C.Cartesian3.cross(dir, up, new C.Cartesian3()), new C.Cartesian3());
    const camUp = C.Cartesian3.cross(right, dir, new C.Cartesian3());
    viewer.camera.setView({ destination: pos, orientation: { direction: dir, up: camUp } });
    this.cb.onFlightLabel(FLIGHT_PATH[Math.round(t * (FLIGHT_PATH.length - 1))].label);
  }

  enterCity() {
    this.mode = "high";
    this.flyToView(CITY_VIEWS.high, 4.2);
  }

  selectMission(id: string) {
    if (id === this.ceon.selectedMission().id) return;
    this.ceon.select(id);
    if (this.mode === "satfollow" || this.mode === "satview") {
      this.startTween(3200);
      if (this.mode === "satview") {
        const m = this.ceon.selectedMission();
        (this.viewer.camera.frustum as CT.PerspectiveFrustum).fov = Math.max(this.C.Math.toRadians(14), Math.min(this.C.Math.toRadians(112), 2 * this.C.Math.toRadians(m.sensor.halfAngleDeg)));
      }
    }
  }

  /* ── time ───────────────────────────────────────────────────────────────── */

  /** Local hour at Mumbai (IST, UTC+5:30); null returns to the running clock. */
  setHour(hour: number | null) {
    const { C, viewer } = this;
    this.hourOverride = hour;
    if (hour === null) {
      viewer.clock.currentTime = C.JulianDate.now();
      viewer.clock.shouldAnimate = true;
      viewer.clock.multiplier = this.timeScale;
      return;
    }
    const d = new Date();
    const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0) + (hour - 5.5) * 3600_000;
    viewer.clock.currentTime = C.JulianDate.fromDate(new Date(utc));
    viewer.clock.shouldAnimate = false;
  }

  /** Simulation speed for the clock (sun and satellite positions). 1 = real time. */
  setTimeScale(v: number) {
    this.timeScale = v;
    if (this.hourOverride === null) { this.viewer.clock.multiplier = v; this.viewer.clock.shouldAnimate = true; }
  }

  /** Jump the simulation clock (e.g. to a predicted overpass). */
  jumpTo(ms: number) {
    const { C, viewer } = this;
    this.hourOverride = null;
    viewer.clock.currentTime = C.JulianDate.fromDate(new Date(ms));
    viewer.clock.shouldAnimate = true;
    viewer.clock.multiplier = this.timeScale;
  }

  setQuality(q: Quality) {
    this.quality = q;
    const v = this.viewer;
    const g = v.scene.globe;
    const dpr = window.devicePixelRatio || 1;
    if (q === "high") { v.resolutionScale = this.dprCap; g.maximumScreenSpaceError = 1.0; }
    else if (q === "balanced") { v.resolutionScale = Math.min(this.dprCap, 1.25 / dpr); g.maximumScreenSpaceError = 1.6; }
    else if (q === "low") { v.resolutionScale = 1 / dpr; g.maximumScreenSpaceError = 2.5; }
    else { v.resolutionScale = this.autoScale(); g.maximumScreenSpaceError = 1.25; }
    this.city.setQuality(q);
    this.applyShadows();
  }

  setAutoRotate(on: boolean) { this.autoRotate = on; }
  highlightCountry(iso3: string | null) { this.global.highlightCountry(iso3); }
  cameraHeight() { return this.viewer.camera.positionCartographic.height; }

  destroy() {
    this.disposed = true;
    this.walk.stop();
    this.removers.forEach((r) => r());
    this.handler.destroy();
    this.city.destroy();
    this.ceon.destroy();
    this.viewer.destroy();
  }
}

/** Camera longitude 55° east of the sub-solar point so the evening terminator crosses the disc. */
function openingView(): { lon: number; lat: number } {
  const d = new Date();
  const utcH = d.getUTCHours() + d.getUTCMinutes() / 60;
  const subsolar = (12 - utcH) * 15;
  let lon = subsolar + 55;
  if (lon > 180) lon -= 360;
  return { lon, lat: 15 };
}

export function isLowPowerDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency ?? 8;
  return mobile || cores <= 4;
}
