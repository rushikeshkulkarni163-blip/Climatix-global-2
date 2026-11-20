/**
 * Planetary-scale layers: country CO₂ extrusions, power-plant emission sources,
 * ports and airports. Encodings are documented in the legend; heights encode
 * reported/estimated annual emissions and never imply a plume.
 */
import type * as CT from "cesium";
import type { CesiumNS } from "./loader";
import { arenaData } from "@/lib/arena/data";
import type { CountryCo2, PlantRow } from "@/lib/arena/emissions";
import { titleCase } from "@/lib/arena/emissions";
import { FUEL_COLOR } from "@/lib/arena/layers";
import type { InventoryMetric, Selection } from "../store";

type Ring = [number, number][];
interface CountryShape { iso3: string; name: string; lon: number; lat: number; polys: Ring[][]; bbox: [number, number, number, number] }
interface Pickable { arenaPick: Selection; label: string }

/** Sequential ramp for emissions (log scale), light → dark red. */
export const CO2_RAMP = ["#FCE3B4", "#F7B267", "#EE7E3C", "#D9472B", "#A1161E"];
export function co2Color(C: CesiumNS, mt: number, alpha = 0.62, max = 12_000, log = true): CT.Color {
  const t = log ? Math.max(0, Math.min(1, Math.log10(Math.max(1, mt)) / Math.log10(max))) : Math.max(0, Math.min(1, mt / max));
  const i = Math.min(CO2_RAMP.length - 2, Math.floor(t * (CO2_RAMP.length - 1)));
  const f = t * (CO2_RAMP.length - 1) - i;
  const a = C.Color.fromCssColorString(CO2_RAMP[i]);
  const b = C.Color.fromCssColorString(CO2_RAMP[i + 1]);
  return C.Color.lerp(a, b, f, new C.Color()).withAlpha(alpha);
}
/** Extrusion: 45 m per MtCO₂ (China ≈ 540 km, India ≈ 145 km). */
export const COUNTRY_M_PER_MT = 45;

export const METRIC_META: Record<InventoryMetric, { label: string; unit: string; source: string; max: number; log: boolean; mPerUnit: number }> = {
  "fossil-co2": { label: "Fossil CO₂", unit: "MtCO₂", source: "Global Carbon Project", max: 12_000, log: true, mPerUnit: 45 },
  "co2-per-capita": { label: "Fossil CO₂ per person", unit: "tCO₂/person", source: "Global Carbon Project", max: 30, log: false, mPerUnit: 15_000 },
  "Electricity/Heat": { label: "Electricity & heat GHG", unit: "MtCO₂e", source: "Climate Watch", max: 6_000, log: true, mPerUnit: 80 },
  "Transportation": { label: "Transportation GHG", unit: "MtCO₂e", source: "Climate Watch", max: 2_000, log: true, mPerUnit: 220 },
  "Manufacturing/Construction": { label: "Manufacturing & construction GHG", unit: "MtCO₂e", source: "Climate Watch", max: 3_500, log: true, mPerUnit: 140 },
  "Agriculture": { label: "Agriculture GHG", unit: "MtCO₂e", source: "Climate Watch", max: 900, log: true, mPerUnit: 450 },
};

export class GlobalLayers {
  private C: CesiumNS;
  private viewer: CT.Viewer;
  shapes: CountryShape[] = [];
  co2 = new Map<string, CountryCo2>();
  plants: PlantRow[] = [];
  private countries: CT.CustomDataSource;
  private selection: CT.CustomDataSource;
  private plantPoints: CT.PointPrimitiveCollection;
  private columns: CT.PolylineCollection;
  private portPoints: CT.PointPrimitiveCollection;
  private airportPoints: CT.PointPrimitiveCollection;
  private points = new Map<string, { lon: number; lat: number }>();
  private columnRefs: { line: CT.Polyline; plant: PlantRow }[] = [];
  private barMats: CT.Material[] = [];
  private metric: InventoryMetric = "fossil-co2";
  inventory = new Map<string, Record<string, [number, number][]>>();
  private countryOverride = new Map<string, number>();
  private plantOverride = new Map<string, number>();
  private camH = 2e7;
  private on: Record<string, boolean> = {};
  private loaded = { plants: false, ports: false, airports: false, countries: false };

  constructor(C: CesiumNS, viewer: CT.Viewer) {
    this.C = C;
    this.viewer = viewer;
    this.countries = new C.CustomDataSource("countries");
    this.selection = new C.CustomDataSource("selection");
    viewer.dataSources.add(this.countries);
    viewer.dataSources.add(this.selection);
    this.countries.show = false;
    const P = viewer.scene.primitives;
    this.plantPoints = P.add(new C.PointPrimitiveCollection());
    this.columns = P.add(new C.PolylineCollection());
    this.portPoints = P.add(new C.PointPrimitiveCollection());
    this.airportPoints = P.add(new C.PointPrimitiveCollection());
    this.plantPoints.show = this.columns.show = this.portPoints.show = this.airportPoints.show = false;
    // static inventory bars — solid colour by magnitude band, no animation
    this.barMats = ["#F2A65A", "#E8743B", "#D9412B"].map((c) => C.Material.fromType("Color", { color: C.Color.fromCssColorString(c).withAlpha(0.92) }));
  }

  async init() {
    const [shapes, co2, inv] = await Promise.all([arenaData.countryShapes(), arenaData.countries(), arenaData.sectorInventory().catch(() => null)]);
    for (const c of co2) this.co2.set(c.iso3, c);
    if (inv) for (const c of inv.countries) this.inventory.set(c.iso3, c.sectors);
    for (const f of shapes.features) {
      const p = f.properties as { iso3: string; name: string; lon: number; lat: number };
      const g = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
      const polys = (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as unknown as Ring[][];
      let w = 180, s = 90, e = -180, n = -90;
      for (const poly of polys) for (const [x, y] of poly[0]) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
      this.shapes.push({ iso3: p.iso3, name: p.name, lon: p.lon ?? (w + e) / 2, lat: p.lat ?? (s + n) / 2, polys, bbox: [w, s, e, n] });
    }
  }

  /* ── countries ─────────────────────────────────────────────────────────── */

  /** Value of the active inventory metric for a country: [value, year] or undefined. */
  metricValue(iso: string, metric = this.metric): [number, number] | undefined {
    if (metric === "fossil-co2") {
      const o = this.countryOverride.get(iso);
      if (o !== undefined) return [o, 0];
      return this.co2.get(iso)?.latest.co2;
    }
    if (metric === "co2-per-capita") return this.co2.get(iso)?.latest.co2_per_capita;
    const ser = this.inventory.get(iso)?.[metric];
    if (!ser?.length) return undefined;
    const [y, v] = ser[ser.length - 1];
    return [v, y];
  }

  setMetric(m: InventoryMetric) {
    if (m === this.metric) return;
    this.metric = m;
    if (this.loaded.countries) { this.countries.entities.removeAll(); this.buildCountries(); }
  }

  private buildCountries() {
    const { C } = this;
    const meta = METRIC_META[this.metric];
    for (const sh of this.shapes) {
      if (sh.iso3 === "ATA") continue;
      const val = this.metricValue(sh.iso3);
      const mt = val && val[0] > 0 ? val[0] : undefined;
      const label = mt !== undefined ? `${sh.name} — ${meta.label}: ${fmtMt(mt)} ${meta.unit}${val![1] ? ` (${val![1]})` : " (simulated)"}` : `${sh.name} — no data`;
      sh.polys.forEach((poly, i) => {
        const hierarchy = new C.PolygonHierarchy(
          C.Cartesian3.fromDegreesArray(poly[0].flat()),
          poly.slice(1).map((h) => new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(h.flat()))),
        );
        this.countries.entities.add({
          id: `country:${sh.iso3}:${i}`,
          name: sh.name,
          properties: { iso3: sh.iso3, label },
          polygon: {
            hierarchy, height: 0,
            extrudedHeight: mt !== undefined ? Math.max(2_000, mt * meta.mPerUnit) : 0,
            material: mt !== undefined ? co2Color(C, mt, this.countryOverride.has(sh.iso3) && this.metric === "fossil-co2" ? 0.85 : 0.62, meta.max, meta.log) : C.Color.fromCssColorString("#6B7280").withAlpha(0.18),
            outline: false,
          },
        });
      });
    }
    this.loaded.countries = true;
  }

  setCountryOverride(iso3: string | null, mt: number | null) {
    const prev = Array.from(this.countryOverride.keys());
    this.countryOverride.clear();
    if (iso3 && mt !== null) this.countryOverride.set(iso3, mt);
    const touched = new Set([...prev, ...(iso3 ? [iso3] : [])]);
    if (!this.loaded.countries || this.metric !== "fossil-co2") return;
    for (const ent of this.countries.entities.values) {
      const iso = ent.properties?.iso3?.getValue();
      if (!touched.has(iso) || !ent.polygon) continue;
      const mtv = this.countryOverride.get(iso) ?? this.co2.get(iso)?.latest.co2?.[0];
      if (mtv === undefined) continue;
      ent.polygon.extrudedHeight = new this.C.ConstantProperty(Math.max(2_000, mtv * COUNTRY_M_PER_MT));
      ent.polygon.material = new this.C.ColorMaterialProperty(co2Color(this.C, mtv, this.countryOverride.has(iso) ? 0.85 : 0.62));
    }
  }

  highlightCountry(iso3: string | null) {
    const { C } = this;
    this.selection.entities.removeAll();
    if (!iso3) return;
    const sh = this.shapes.find((s) => s.iso3 === iso3);
    if (!sh) return;
    sh.polys.forEach((poly, i) => {
      const ring = [...poly[0], poly[0][0]];
      this.selection.entities.add({
        id: `sel:${iso3}:${i}`,
        polyline: {
          positions: C.Cartesian3.fromDegreesArray(ring.flat()), width: 2,
          material: C.Color.fromCssColorString("#9DB8EA"), clampToGround: false,
          arcType: C.ArcType.RHUMB,
        },
      });
    });
  }

  /** Point-in-polygon lookup for clicks on the bare globe. */
  countryAt(lon: number, lat: number): CountryShape | undefined {
    for (const sh of this.shapes) {
      const [w, s, e, n] = sh.bbox;
      if (lon < w || lon > e || lat < s || lat > n) continue;
      for (const poly of sh.polys) {
        if (inRing(lon, lat, poly[0]) && !poly.slice(1).some((h) => inRing(lon, lat, h))) return sh;
      }
    }
    return undefined;
  }

  /* ── plants ────────────────────────────────────────────────────────────── */

  private async ensurePlants() {
    if (this.loaded.plants) return;
    this.loaded.plants = true;
    const { C } = this;
    const { rows } = await arenaData.powerPlants();
    this.plants = rows;
    for (const p of rows) {
      const pos = C.Cartesian3.fromDegrees(p.lon, p.lat, 30);
      const label = `${titleCase(p.name)} · ${p.capacity_mw.toLocaleString()} MW ${p.fuel}${p.co2_mt_est ? ` · est. ${p.co2_mt_est.toFixed(2)} MtCO₂/yr` : ""}`;
      const id: Pickable = { arenaPick: { type: "plant", id: p.id }, label };
      this.plantPoints.add({
        position: pos, id,
        pixelSize: 3 + Math.sqrt(p.capacity_mw) / 14,
        color: C.Color.fromCssColorString(FUEL_COLOR[p.fuel] ?? "#9AA4B2").withAlpha(0.95),
        outlineColor: C.Color.BLACK.withAlpha(0.6), outlineWidth: 1,
        scaleByDistance: new C.NearFarScalar(2e4, 1.8, 2e7, 0.75),
      });
      if (p.co2_mt_est && p.co2_mt_est >= 0.05) {
        const band = p.co2_mt_est < 1 ? 0 : p.co2_mt_est < 5 ? 1 : 2;
        const line = this.columns.add({ positions: [pos, pos], width: 3.2, material: this.barMats[band], id });
        this.columnRefs.push({ line, plant: p });
      }
    }
    this.rescaleColumns();
  }

  setPlantOverride(id: string | null, mt: number | null) {
    this.plantOverride.clear();
    if (id && mt !== null) this.plantOverride.set(id, mt);
    this.rescaleColumns();
  }

  /** Column metres per MtCO₂ scale with camera height so columns stay legible from orbit to city. */
  private columnScale() {
    return Math.max(140, Math.min(this.camH * 0.0032, 70_000));
  }

  private rescaleColumns() {
    const { C } = this;
    const k = this.columnScale();
    for (const { line, plant } of this.columnRefs) {
      const mt = this.plantOverride.get(plant.id) ?? plant.co2_mt_est ?? 0;
      line.positions = [C.Cartesian3.fromDegrees(plant.lon, plant.lat, 30), C.Cartesian3.fromDegrees(plant.lon, plant.lat, 30 + Math.max(1, mt * k))];
      line.width = this.plantOverride.has(plant.id) ? 6 : 3.2;
    }
  }

  plantById(id: string) { return this.plants.find((p) => p.id === id); }

  pointFor(sel: Selection): { lon: number; lat: number } | undefined {
    if (sel?.type === "port") return this.points.get(`port:${sel.name}`);
    if (sel?.type === "airport") return this.points.get(`airport:${sel.code}`);
    return undefined;
  }

  /* ── ports / airports ─────────────────────────────────────────────────── */

  private async ensurePorts() {
    if (this.loaded.ports) return;
    this.loaded.ports = true;
    const { C } = this;
    for (const p of await arenaData.ports()) {
      this.points.set(`port:${p.name}`, { lon: p.lon, lat: p.lat });
      this.portPoints.add({
        position: C.Cartesian3.fromDegrees(p.lon, p.lat, 20), pixelSize: 4.5,
        color: C.Color.fromCssColorString("#8FA6C4"), outlineColor: C.Color.BLACK.withAlpha(0.6), outlineWidth: 1,
        id: { arenaPick: { type: "port", name: p.name }, label: `Port · ${p.name}` } satisfies Pickable,
        scaleByDistance: new C.NearFarScalar(2e4, 1.6, 2e7, 0.6),
      });
    }
  }

  private async ensureAirports() {
    if (this.loaded.airports) return;
    this.loaded.airports = true;
    const { C } = this;
    for (const a of await arenaData.airports()) {
      this.points.set(`airport:${a.code}`, { lon: a.lon, lat: a.lat });
      this.airportPoints.add({
        position: C.Cartesian3.fromDegrees(a.lon, a.lat, 20), pixelSize: 4.5,
        color: C.Color.fromCssColorString("#E7EAF0"), outlineColor: C.Color.BLACK.withAlpha(0.7), outlineWidth: 1,
        id: { arenaPick: { type: "airport", code: a.code }, label: `Airport · ${a.name} (${a.code})` } satisfies Pickable,
        scaleByDistance: new C.NearFarScalar(2e4, 1.6, 2e7, 0.6),
      });
    }
  }

  /* ── layer switching, frame updates, picking ──────────────────────────── */

  setLayer(id: string, on: boolean) {
    this.on[id] = on;
    if (id === "co2-countries") {
      if (on && !this.loaded.countries) this.buildCountries();
      this.countries.show = on && this.camH > 350_000;
    }
    if (id === "co2-plants" || id === "plants-all") {
      if (on) void this.ensurePlants();
      this.columns.show = !!this.on["co2-plants"];
      this.plantPoints.show = !!this.on["plants-all"] || !!this.on["co2-plants"];
    }
    if (id === "ports") { if (on) void this.ensurePorts(); this.portPoints.show = on; }
    if (id === "airports") { if (on) void this.ensureAirports(); this.airportPoints.show = on; }
  }


  onCameraHeight(h: number) {
    const prev = this.camH;
    this.camH = h;
    // country extrusions are planetary-scale (hundreds of km); hide them near the ground
    this.countries.show = !!this.on["co2-countries"] && h > 350_000;
    if (Math.abs(Math.log(h / prev)) > 0.15 && this.columnRefs.length) this.rescaleColumns();
  }

  resolvePick(picked: unknown): Selection | null {
    const id = (picked as { id?: unknown })?.id;
    if (id && typeof id === "object" && "arenaPick" in (id as object)) return (id as Pickable).arenaPick;
    const ent = id as CT.Entity | undefined;
    const iso = ent?.properties?.iso3?.getValue?.();
    if (iso) return { type: "country", iso3: iso, name: ent?.name ?? iso };
    return null;
  }

  labelFor(picked: unknown): string | null {
    const id = (picked as { id?: unknown })?.id;
    if (id && typeof id === "object" && "label" in (id as object) && typeof (id as Pickable).label === "string") return (id as Pickable).label;
    const ent = id as CT.Entity | undefined;
    const l = ent?.properties?.label?.getValue?.();
    return typeof l === "string" ? l : null;
  }
}

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function fmtMt(v: number): string {
  return v >= 100 ? Math.round(v).toLocaleString() : v >= 10 ? v.toFixed(1) : v.toFixed(2);
}
