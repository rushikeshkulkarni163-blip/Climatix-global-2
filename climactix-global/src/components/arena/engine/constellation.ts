/**
 * CEON constellation rendering: spacecraft models with nadir-pointing attitude,
 * orbit rings, ground tracks, swath coverage and sensor field-of-view edges.
 * Orbits are simulated (see lib/arena/constellation.ts); nothing here is telemetry.
 */
import type * as CT from "cesium";
import type { CesiumNS } from "./loader";
import {
  MISSIONS, destination, groundTrack, orbitRing, periodMin, stateAt, swathKm, trackBearing, type Mission,
} from "@/lib/arena/constellation";
import type { Selection } from "../store";

interface Craft { m: Mission; model: CT.Model | null; label: CT.Label }

export class ConstellationLayer {
  private C: CesiumNS;
  private viewer: CT.Viewer;
  crafts: Craft[] = [];
  private labels: CT.LabelCollection;
  private orbits: CT.PolylineCollection;
  private tracks: CT.PolylineCollection;
  private fov: CT.PolylineCollection;
  private swath: CT.Entity;
  private footprint: CT.Entity;
  private shown = true;
  private selected = "ceon-01";
  private lastHeavy = -Infinity;
  private lastFoot = -Infinity;
  private swathPositions: CT.Cartesian3[] = [];
  private footPositions: CT.Cartesian3[] = [];

  constructor(C: CesiumNS, viewer: CT.Viewer) {
    this.C = C;
    this.viewer = viewer;
    const P = viewer.scene.primitives;
    this.orbits = P.add(new C.PolylineCollection());
    this.tracks = P.add(new C.PolylineCollection());
    this.fov = P.add(new C.PolylineCollection());
    this.labels = P.add(new C.LabelCollection());
    this.swath = viewer.entities.add({ id: "ceon-swath" });
    this.footprint = viewer.entities.add({ id: "ceon-footprint" });
    for (const m of MISSIONS) {
      const label = this.labels.add({
        position: C.Cartesian3.ZERO, text: `${m.code} · ${m.name}`, font: "600 12px 'Helvetica Neue', Helvetica, Arial, sans-serif",
        fillColor: C.Color.WHITE, outlineColor: C.Color.fromCssColorString("#06080B"), outlineWidth: 3,
        style: C.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new C.Cartesian2(14, -14),
        horizontalOrigin: C.HorizontalOrigin.LEFT, showBackground: true,
        backgroundColor: C.Color.fromCssColorString("#0E1217").withAlpha(0.85), backgroundPadding: new C.Cartesian2(6, 3),
        distanceDisplayCondition: new C.DistanceDisplayCondition(4_000, 6.0e7),
      });
      label.id = { arenaPick: { type: "satellite", id: m.id } satisfies Selection, label: `${m.code} — ${m.name} (virtual mission concept)` };
      this.crafts.push({ m, model: null, label });
    }
  }

  async init() {
    const { C } = this;
    await Promise.all(this.crafts.map(async (c) => {
      try {
        const model = await C.Model.fromGltfAsync({
          url: c.m.model, minimumPixelSize: 34, maximumScale: 60000, upAxis: C.Axis.Y, forwardAxis: C.Axis.X,
          id: { arenaPick: { type: "satellite", id: c.m.id } satisfies Selection, label: `${c.m.code} — ${c.m.name} (virtual mission concept)` },
          shadows: C.ShadowMode.DISABLED,
        });
        // in orbit: hard sunlight, deep shadows, faint earthshine — not the default sky ambient
        model.imageBasedLighting.imageBasedLightingFactor = new C.Cartesian2(0.22, 0.85);
        c.model = this.viewer.scene.primitives.add(model);
        c.model.show = this.shown;
      } catch (err) {
        console.warn(`[ceon] model ${c.m.model} failed to load`, err);
        c.model = null; // label and tracks still render
      }
    }));
  }

  setVisible(on: boolean) {
    this.shown = on;
    for (const c of this.crafts) { if (c.model) c.model.show = on; c.label.show = on; }
    this.orbits.show = this.tracks.show = this.fov.show = on;
    this.swath.show = this.footprint.show = on;
  }

  select(id: string) {
    if (id === this.selected) return;
    this.selected = id;
    this.lastHeavy = -Infinity;
    this.lastFoot = -Infinity;
  }

  selectedMission() { return MISSIONS.find((m) => m.id === this.selected)!; }

  /** Earth-fixed position (m), unit velocity direction and local up for a mission at time ms. */
  frame(id: string, ms: number) {
    const { C } = this;
    const m = MISSIONS.find((x) => x.id === id)!;
    const s = stateAt(m, ms);
    const pos = new C.Cartesian3(...s.ecef);
    const up = C.Cartesian3.normalize(pos, new C.Cartesian3());
    const v = new C.Cartesian3(...s.vel);
    const along = C.Cartesian3.normalize(C.Cartesian3.subtract(v, C.Cartesian3.multiplyByScalar(up, C.Cartesian3.dot(v, up), new C.Cartesian3()), new C.Cartesian3()), new C.Cartesian3());
    return { m, s, pos, up, along };
  }

  step(ms: number, camHeight: number) {
    if (!this.shown) return;
    const { C } = this;
    for (const c of this.crafts) {
      const { pos, up, along } = this.frame(c.m.id, ms);
      const y = C.Cartesian3.cross(up, along, new C.Cartesian3());
      const mat = new C.Matrix4(
        along.x, y.x, up.x, pos.x,
        along.y, y.y, up.y, pos.y,
        along.z, y.z, up.z, pos.z,
        0, 0, 0, 1,
      );
      if (c.model) c.model.modelMatrix = mat;
      c.label.position = pos;
      c.label.show = camHeight > 1500;
    }
    // heavy geometry: orbit rings and ground tracks (every 20 s of simulated time)
    if (Math.abs(ms - this.lastHeavy) > 20_000) {
      this.lastHeavy = ms;
      this.orbits.removeAll();
      this.tracks.removeAll();
      for (const c of this.crafts) {
        const isSel = c.m.id === this.selected;
        const col = C.Color.fromCssColorString(c.m.color);
        this.orbits.add({
          positions: orbitRing(c.m, ms).map((p) => new C.Cartesian3(...p)), width: isSel ? 1.6 : 1,
          material: C.Material.fromType("Color", { color: (isSel ? col : C.Color.fromCssColorString("#C9D1DC")).withAlpha(isSel ? 0.75 : 0.22) }),
        });
        const P = periodMin(c.m) * 60_000;
        const tr = groundTrack(c.m, ms - P * 0.5, ms + P * 0.5, 30);
        // split at the antimeridian so the polyline never wraps across the globe
        let seg: CT.Cartesian3[] = [];
        for (let i = 0; i < tr.length; i++) {
          if (i > 0 && Math.abs(tr[i].lon - tr[i - 1].lon) > 180) { this.addTrack(seg, col, isSel); seg = []; }
          seg.push(C.Cartesian3.fromDegrees(tr[i].lon, tr[i].lat, 2000));
        }
        this.addTrack(seg, col, isSel);
      }
      const m = this.selectedMission();
      const past = groundTrack(m, ms - 14 * 60_000, ms, 20);
      const out: CT.Cartesian3[] = [];
      for (let i = 0; i < past.length; i++) {
        if (i > 0 && Math.abs(past[i].lon - past[i - 1].lon) > 180) out.length = 0;
        out.push(C.Cartesian3.fromDegrees(past[i].lon, past[i].lat));
      }
      this.swathPositions = out.length >= 2 ? out : [];
      const col = C.Color.fromCssColorString(m.color);
      this.swath.corridor = this.swathPositions.length >= 2 ? new C.CorridorGraphics({
        positions: this.swathPositions, width: swathKm(m) * 1000,
        material: col.withAlpha(0.16), cornerType: C.CornerType.ROUNDED,
      }) : undefined;
    }
    // instantaneous footprint and sensor field-of-view edges (every second)
    if (Math.abs(ms - this.lastFoot) > 1000) {
      this.lastFoot = ms;
      const { m, s, pos } = this.frame(this.selected, ms);
      const half = swathKm(m) / 2;
      const brg = trackBearing(m, ms);
      const corner = (along: number, across: number) => {
        const a = destination(s.lat, s.lon, brg, along);
        const b = destination(a.lat, a.lon, brg + 90, across);
        return C.Cartesian3.fromDegrees(b.lon, b.lat, 0);
      };
      const L = Math.min(60, half / 2);
      this.footPositions = [corner(L, -half), corner(L, half), corner(-L, half), corner(-L, -half)];
      this.footprint.polygon = new C.PolygonGraphics({
        hierarchy: new C.PolygonHierarchy(this.footPositions),
        material: C.Color.fromCssColorString(m.color).withAlpha(0.4),
      });
      this.fov.removeAll();
      const col = C.Color.fromCssColorString(m.color).withAlpha(0.6);
      const edgeL = destination(s.lat, s.lon, brg - 90, half), edgeR = destination(s.lat, s.lon, brg + 90, half);
      for (const e of [edgeL, edgeR]) {
        this.fov.add({ positions: [pos, C.Cartesian3.fromDegrees(e.lon, e.lat, 0)], width: 1.2, material: C.Material.fromType("Color", { color: col }) });
      }
      this.fov.add({ positions: [pos, C.Cartesian3.fromDegrees(s.lon, s.lat, 0)], width: 1, material: C.Material.fromType("Color", { color: col.withAlpha(0.35) }) });
    }
  }

  private addTrack(seg: CT.Cartesian3[], col: CT.Color, sel: boolean) {
    if (seg.length < 2) return;
    this.tracks.add({ positions: seg, width: sel ? 1.6 : 1, material: this.C.Material.fromType("Color", { color: col.withAlpha(sel ? 0.7 : 0.3) }) });
  }

  destroy() {
    for (const c of this.crafts) if (c.model) this.viewer.scene.primitives.remove(c.model);
  }
}
