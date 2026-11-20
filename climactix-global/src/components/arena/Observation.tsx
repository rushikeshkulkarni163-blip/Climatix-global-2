"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useArena, OBS_CATEGORIES } from "./store";
import { useArenaCtx } from "./context";
import { Kpi, Panel } from "./Panels";
import { fmt } from "./fmt";
import {
  CONSTELLATION_NOTICE, MISSIONS, greatCircleKm, inclinationDeg, localSolarHours, mission as missionById,
  nextPass, periodMin, stateAt, swathKm, groundTrack, type Mission,
} from "@/lib/arena/constellation";
import { LATENCY_LABEL, LAYERS, OBS_LABEL, ageDays, gibsLayer, type GibsLayer, type ObsCategory } from "@/lib/arena/layers";
import { readGibs, type Readout } from "@/lib/arena/readout";
import { arenaData, type AirQualityModel, type GroundNetwork } from "@/lib/arena/data";
import { FACILITIES, KIND_LABEL } from "@/lib/arena/mumbai";
import { titleCase } from "@/lib/arena/emissions";

/* ── shared hooks ──────────────────────────────────────────────────────── */

export function useSimTime(periodMs = 1000): number {
  const { engine } = useArenaCtx();
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setT(engine ? engine.simTime() : Date.now());
    tick();
    const id = setInterval(tick, periodMs);
    return () => clearInterval(id);
  }, [engine, periodMs]);
  return t;
}

const productsOf = (cat: ObsCategory) => LAYERS.filter((l): l is GibsLayer => l.kind === "gibs" && l.obs === cat);
const fmtUtc = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace("T", " ") + " UTC";

function freshness(def: GibsLayer, observed: string | undefined | null) {
  if (def.cadence === "static") return "Static climatology";
  const a = ageDays(observed);
  if (a === null) return "Date pending";
  return a === 0 ? "Observed today" : `${a} day${a === 1 ? "" : "s"} old`;
}

/* ── layer detail with date selection and compare ──────────────────────── */

export function LayerDetail({ def }: { def: GibsLayer }) {
  const s = useArena();
  const observed = s.layerTimes[def.id];
  const requested = s.layerDates[def.id] ?? "";
  const cmp = s.compare?.id === def.id ? s.compare : null;
  const [cmpDate, setCmpDate] = useState("");
  const monthly = def.cadence === "monthly";
  const toInput = (d: string) => (monthly ? d.slice(0, 7) : d.slice(0, 10));
  const fromInput = (v: string) => (monthly ? `${v}-01` : v);
  const defaultCompare = () => {
    const base = observed && observed !== "static" ? new Date(observed) : new Date();
    base.setUTCFullYear(base.getUTCFullYear() - 1);
    return base.toISOString().slice(0, 10);
  };
  return (
    <div className="ax-layer-detail">
      {def.legend && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="ax-legend-img" src={def.legend} alt={`Legend: ${def.label}`} />
      )}
      <dl className="ax-meta-grid">
        <dt>Dataset</dt><dd>{def.dataset}</dd>
        <dt>Source</dt><dd>{def.source}</dd>
        <dt>Observed</dt><dd>{def.cadence === "static" ? "Static product" : observed ?? "loading…"} · {freshness(def, observed)}</dd>
        <dt>Resolution</dt><dd>{def.resolution}</dd>
        <dt>Units</dt><dd>{def.units}</dd>
        <dt>Cadence</dt><dd>{def.cadence} · {LATENCY_LABEL[def.latency]}</dd>
        <dt>Processing</dt><dd>{def.processing}</dd>
        <dt>Quality</dt><dd>{def.quality}</dd>
      </dl>
      {def.cadence !== "static" && (
        <div className="ax-datebar">
          <label>Date
            <input type={monthly ? "month" : "date"} className="ax-in sm" value={requested ? toInput(requested) : ""}
              max={new Date().toISOString().slice(0, monthly ? 7 : 10)}
              onChange={(e) => s.setLayerDate(def.id, e.target.value ? fromInput(e.target.value) : "")} />
          </label>
          {requested && <button className="ax-btn ghost sm" onClick={() => s.setLayerDate(def.id, "")}>Latest</button>}
          {!cmp ? (
            <button className="ax-btn sm" onClick={() => { const d = cmpDate || defaultCompare(); setCmpDate(d); s.setCompare({ id: def.id, date: d }); }}>Compare dates</button>
          ) : (
            <button className="ax-btn sm on" onClick={() => s.setCompare(null)}>End compare</button>
          )}
        </div>
      )}
      {cmp && (
        <div className="ax-datebar">
          <label>Right side
            <input type={monthly ? "month" : "date"} className="ax-in sm" value={toInput(cmp.date)}
              onChange={(e) => e.target.value && s.setCompare({ id: def.id, date: fromInput(e.target.value) })} />
          </label>
          <span className="ax-meta">served {s.compareTime ?? "…"} · drag the divider on the globe</span>
        </div>
      )}
      <div className="ax-meta caveat">{def.caveat}</div>
    </div>
  );
}

/* ── observation dock: six independently controlled categories ─────────── */

export function ObservationDock() {
  const s = useArena();
  return (
    <div className="ax-stack">
      <p className="ax-note">Each observation layer is an identified satellite or reanalysis product with its own date. Rasters are static for the date shown — nothing animates.</p>
      {OBS_CATEGORIES.map((cat) => {
        const products = productsOf(cat);
        const active = products.find((p) => s.layers[p.id]);
        const chosen = gibsLayer(s.obsProduct[cat]) ?? products[0];
        return (
          <section key={cat} className={`ax-obs${active ? " on" : ""}`}>
            <div className="ax-row between">
              <label className="ax-check strong"><input type="checkbox" checked={!!active} onChange={() => s.toggleObs(cat)} /> {OBS_LABEL[cat].toUpperCase()}</label>
            </div>
            <select className="ax-in sm" value={chosen.id} onChange={(e) => s.setObsProduct(cat, e.target.value)} aria-label={`${OBS_LABEL[cat]} product`}>
              {products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            {active && <LayerDetail def={active} />}
          </section>
        );
      })}
    </div>
  );
}

/* ── mission control ───────────────────────────────────────────────────── */

export function MissionControl() {
  const s = useArena();
  const { requestCamera, engine } = useArenaCtx();
  const now = useSimTime(1000);
  const m = missionById(s.mission) ?? MISSIONS[0];
  const st = stateAt(m, now);
  const target = s.point ?? (s.selection?.type === "place" ? null : null);
  const nadirCountry = engine?.global.countryAt(st.lon, st.lat)?.name ?? "Ocean / no country";
  const region = target ?? { lat: 19.076, lon: 72.8777 };
  const regionName = target ? `${target.lat.toFixed(3)}°, ${target.lon.toFixed(3)}°` : "Mumbai";
  const pass = useMemo(() => nextPass(m, region.lat, region.lon, Math.floor(now / 60_000) * 60_000), [m, region.lat, region.lon, Math.floor(now / 60_000)]); // eslint-disable-line react-hooks/exhaustive-deps
  const activeLayers = LAYERS.filter((l): l is GibsLayer => l.kind === "gibs" && !!s.layers[l.id]);
  const mainProduct = gibsLayer(m.products[0]);
  const camMode = s.camera;

  return (
    <Panel eyebrow="Climactix Global — Earth Observation Network" title="Mission control" tone="accent">
      <div className="ax-notice">{CONSTELLATION_NOTICE}</div>
      <div className="ax-missions" role="radiogroup" aria-label="CEON mission">
        {MISSIONS.map((x) => (
          <button key={x.id} role="radio" aria-checked={x.id === m.id} className={x.id === m.id ? "on" : ""} onClick={() => { s.setMission(x.id); s.select({ type: "satellite", id: x.id }); }}>
            <i style={{ background: x.color }} /><b>{x.code}</b><span>{x.name}</span>
          </button>
        ))}
      </div>
      <div className="ax-row wrap">
        <button className={`ax-btn sm${camMode === "satfollow" ? " on" : ""}`} onClick={() => requestCamera("satfollow")}>Follow satellite</button>
        <button className={`ax-btn sm${camMode === "satview" ? " on" : ""}`} onClick={() => requestCamera("satview")}>Sensor view</button>
        <button className={`ax-btn sm${camMode === "orbit" ? " on" : ""}`} onClick={() => requestCamera("orbit")}>Orbital view</button>
        <button className="ax-btn primary sm" onClick={() => { m.products.slice(0, 1).forEach((id) => s.toggleLayer(id, true)); }}>Show {OBS_LABEL[m.category].toLowerCase()}</button>
      </div>

      <div className="ax-sec">{m.code} · simulated orbital state <span className="ax-prov ax-prov-illustrative">Simulated</span></div>
      <dl className="ax-kv tight">
        <dt>Position</dt><dd>{st.lat.toFixed(2)}°, {st.lon.toFixed(2)}° · over {nadirCountry}</dd>
        <dt>Altitude</dt><dd>{st.altKm.toFixed(0)} km · {st.ascending ? "ascending (northbound)" : "descending (southbound)"}</dd>
        <dt>Orbit</dt><dd>Sun-synchronous, i = {inclinationDeg(m).toFixed(2)}°, period {periodMin(m).toFixed(1)} min, LTAN {fmtHour(m.ltanHours)}</dd>
        <dt>Ground speed</dt><dd>{st.speedKms.toFixed(2)} km/s · local solar time {fmtHour(localSolarHours(st.lon, now))}</dd>
        <dt>Simulation time</dt><dd>{fmtUtc(now)}{s.timeScale !== 1 ? ` · ${s.timeScale}× speed` : " · real time"}</dd>
      </dl>
      <div className="ax-sec">Sensor (concept)</div>
      <dl className="ax-kv tight">
        <dt>Instrument</dt><dd>{m.sensor.name}</dd>
        <dt>Bands</dt><dd>{m.sensor.bands}</dd>
        <dt>Field of view</dt><dd>±{m.sensor.halfAngleDeg}° → swath {fmt.int(swathKm(m))} km (spherical-Earth geometry)</dd>
        <dt>Ground sample</dt><dd>{m.sensor.gsdM >= 1000 ? `${m.sensor.gsdM / 1000} km` : `${m.sensor.gsdM} m`} at nadir</dd>
        <dt>Real analogues</dt><dd>{m.analogues}</dd>
      </dl>
      <div className="ax-sec">Target region · {regionName}</div>
      <dl className="ax-kv tight">
        <dt>Next daylight pass</dt>
        <dd>{pass ? <>{fmtUtc(pass.t)} · {fmt.int(pass.offsetKm)} km off-track{" "}
          <button className="ax-btn ghost sm" onClick={() => engine?.jumpTo(pass.t - 90_000)}>Jump clock to pass</button></> : "No daylight pass in the next 16 days (swath does not reach the target)"}</dd>
        <dt>Last available observation</dt>
        <dd>{mainProduct ? `${mainProduct.dataset}: ${s.layerTimes[mainProduct.id] ?? "enable the layer to fetch"} (real data from ${mainProduct.source.split(" via ")[0]})` : "—"}</dd>
      </dl>
      <p className="ax-note">Click anywhere on the globe to set the target region. “Jump clock” moves the simulation clock (sun and satellite positions); observation layers keep their own acquisition dates.</p>

      <div className="ax-sec">Datasets this mission concept addresses</div>
      <div className="ax-chips">
        {m.products.map((id) => { const d = gibsLayer(id); return d ? <button key={id} className={s.layers[id] ? "on" : ""} onClick={() => s.toggleLayer(id)}>{d.label}</button> : null; })}
      </div>

      <div className="ax-sec">Active observation layers</div>
      {activeLayers.length === 0 ? <p className="ax-note">None. Open the Observe tab or use “Show …” above.</p> : (
        <table className="ax-table compact">
          <thead><tr><th>Layer</th><th>Observed</th><th>Freshness</th></tr></thead>
          <tbody>{activeLayers.map((l) => (
            <tr key={l.id}><td>{l.label}<div className="ax-meta">{l.source}</div></td><td className="ax-num">{l.cadence === "static" ? "static" : s.layerTimes[l.id] ?? "…"}</td><td>{freshness(l, s.layerTimes[l.id])}</td></tr>
          ))}</tbody>
        </table>
      )}

      <div className="ax-sec">Orbital situation</div>
      <OrbitMap now={now} />
      <div className="ax-row wrap">
        <span className="ax-meta">Simulation speed</span>
        <div className="ax-seg sm">
          {[1, 10, 60, 300].map((v) => <button key={v} className={s.timeScale === v ? "on" : ""} onClick={() => s.setTimeScale(v)}>{v === 1 ? "Real time" : `${v}×`}</button>)}
        </div>
      </div>
    </Panel>
  );
}

function fmtHour(h: number) {
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm === 60 ? 0 : mm).padStart(2, "0")}`;
}

/* ── orbital map (equirectangular) ─────────────────────────────────────── */

function OrbitMap({ now }: { now: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { engine } = useArenaCtx();
  const sel = useArena((s) => s.mission);
  const point = useArena((s) => s.point);
  const land = useMemo(() => {
    if (!engine) return null;
    return engine.global.shapes;
  }, [engine]);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth, H = Math.round(W / 2);
    c.width = W * dpr; c.height = H * dpr; c.style.height = `${H}px`;
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);
    const X = (lon: number) => ((lon + 180) / 360) * W, Y = (lat: number) => ((90 - lat) / 180) * H;
    g.fillStyle = "#0A0E13"; g.fillRect(0, 0, W, H);
    g.strokeStyle = "#1C232D"; g.lineWidth = 0.5;
    for (let lon = -150; lon <= 150; lon += 30) { g.beginPath(); g.moveTo(X(lon), 0); g.lineTo(X(lon), H); g.stroke(); }
    for (let lat = -60; lat <= 60; lat += 30) { g.beginPath(); g.moveTo(0, Y(lat)); g.lineTo(W, Y(lat)); g.stroke(); }
    if (land) {
      g.fillStyle = "#1B2430"; g.strokeStyle = "#2E3A48"; g.lineWidth = 0.5;
      for (const sh of land) for (const poly of sh.polys) {
        g.beginPath();
        poly[0].forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
        g.closePath(); g.fill(); g.stroke();
      }
    }
    // night side: points where the Sun is below the horizon (low-precision subsolar point)
    const d = new Date(now);
    const doy = (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86_400_000;
    const decl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (doy + 10));
    const subLon = (12 - (d.getUTCHours() + d.getUTCMinutes() / 60)) * 15;
    g.fillStyle = "rgba(0,0,0,0.38)";
    for (let px = 0; px < W; px += 3) for (let py = 0; py < H; py += 3) {
      const lon = (px / W) * 360 - 180, lat = 90 - (py / H) * 180;
      const cz = Math.sin((lat * Math.PI) / 180) * Math.sin((decl * Math.PI) / 180) + Math.cos((lat * Math.PI) / 180) * Math.cos((decl * Math.PI) / 180) * Math.cos(((lon - subLon) * Math.PI) / 180);
      if (cz < 0) g.fillRect(px, py, 3, 3);
    }
    for (const m of MISSIONS) {
      const isSel = m.id === sel;
      const P = periodMin(m) * 60_000;
      const tr = groundTrack(m, now - P * 0.5, now + P * 0.5, 45);
      const drawTrack = (from: number, to: number, alpha: number, width: number) => {
        g.strokeStyle = hexA(m.color, alpha); g.lineWidth = width; g.beginPath();
        for (let i = from; i <= to; i++) {
          const p = tr[i];
          if (i === from || Math.abs(p.lon - tr[i - 1].lon) > 180) g.moveTo(X(p.lon), Y(p.lat)); else g.lineTo(X(p.lon), Y(p.lat));
        }
        g.stroke();
      };
      const mid = Math.floor(tr.length / 2);
      if (isSel) drawTrack(0, mid, 0.28, Math.max(1.5, (swathKm(m) / 40_075) * W));
      drawTrack(0, mid, isSel ? 0.9 : 0.45, 1);
      g.setLineDash([3, 3]); drawTrack(mid, tr.length - 1, isSel ? 0.7 : 0.3, 1); g.setLineDash([]);
      const s = stateAt(m, now);
      g.fillStyle = m.color; g.beginPath(); g.arc(X(s.lon), Y(s.lat), isSel ? 4 : 3, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#E8EAEE"; g.font = "600 10px Helvetica, Arial"; g.fillText(m.code, X(s.lon) + 6, Y(s.lat) - 5);
    }
    if (point) { g.strokeStyle = "#FFFFFF"; g.lineWidth = 1.2; g.strokeRect(X(point.lon) - 4, Y(point.lat) - 4, 8, 8); }
  }, [now, land, sel, point]);
  return (
    <div className="ax-orbitmap">
      <canvas ref={ref} aria-label="Ground tracks of the four CEON missions" />
      <div className="ax-meta">Solid: last half orbit · dashed: next half orbit · band: selected swath · shaded: night side. Simulated orbits.</div>
    </div>
  );
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* ── satellite intelligence panel (other modules) ──────────────────────── */

export function SatellitePanel({ id, onClose }: { id: string; onClose: () => void }) {
  const m = missionById(id);
  const s = useArena();
  const now = useSimTime(1000);
  if (!m) return null;
  const st = stateAt(m, now);
  return (
    <Panel eyebrow="CEON · virtual mission concept" title={`${m.code} — ${m.name}`} onClose={onClose}>
      <div className="ax-notice">{CONSTELLATION_NOTICE}</div>
      <ul className="ax-ul">{m.purpose.map((p) => <li key={p}>{p}</li>)}</ul>
      <div className="ax-kpis">
        <Kpi label="Simulated altitude" prov="illustrative" value={st.altKm.toFixed(0)} unit="km" note={`i = ${inclinationDeg(m).toFixed(2)}° · ${periodMin(m).toFixed(1)} min`} />
        <Kpi label="Swath" value={fmt.int(swathKm(m))} unit="km" note={`±${m.sensor.halfAngleDeg}° field of view`} />
      </div>
      <dl className="ax-kv tight">
        <dt>Position</dt><dd>{st.lat.toFixed(2)}°, {st.lon.toFixed(2)}° · {fmtUtc(now)}</dd>
        <dt>Sensor</dt><dd>{m.sensor.name}</dd>
      </dl>
      <div className="ax-row"><button className="ax-btn primary sm" onClick={() => s.setModule("observation")}>Open mission control</button></div>
    </Panel>
  );
}

/* ── location intelligence: observations at a point ────────────────────── */

const READ_GROUPS: { title: string; ids: string[] }[] = [
  { title: "Thermal", ids: ["lst-monthly", "lst-8day", "airtemp", "uhi-day"] },
  { title: "Air quality — satellite columns", ids: ["no2", "so2", "aod"] },
  { title: "Carbon — atmospheric concentration", ids: ["xco2", "ch4"] },
  { title: "Vegetation", ids: ["ndvi-monthly"] },
  { title: "Water stress", ids: ["soil-moisture", "drought-hazard"] },
  { title: "Flood exposure", ids: ["flood-hazard", "flood-now"] },
];

const AQ_LABEL: Record<string, string> = { us_aqi: "AQI (US EPA, from CAMS)", pm2_5: "PM2.5", pm10: "PM10", nitrogen_dioxide: "NO₂", sulphur_dioxide: "SO₂", ozone: "O₃", carbon_monoxide: "CO" };

export function LocationIntel({ lat, lon, title, onClose }: { lat: number; lon: number; title: string; onClose?: () => void }) {
  const s = useArena();
  const { data, facilityCo2, engine } = useArenaCtx();
  const [reads, setReads] = useState<Record<string, Readout | "loading">>({});
  const [cams, setCams] = useState<AirQualityModel | { error: string } | null>(null);
  const [ground, setGround] = useState<GroundNetwork | { error: string } | null>(null);
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;

  useEffect(() => {
    let live = true;
    const ids = READ_GROUPS.flatMap((g) => g.ids);
    setReads(Object.fromEntries(ids.map((id) => [id, "loading" as const])));
    for (const id of ids) {
      const def = gibsLayer(id);
      if (!def) continue;
      readGibs(def, lon, lat, useArena.getState().layerDates[id] || "default").then((r) => live && setReads((p) => ({ ...p, [id]: r })));
    }
    setCams(null); setGround(null);
    arenaData.airQualityModel(lat, lon).then((d) => live && setCams(d)).catch((e) => live && setCams({ error: String(e.message ?? e) }));
    arenaData.groundStations(lat, lon).then((d) => live && setGround(d)).catch((e) => live && setGround({ error: String(e.message ?? e) }));
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const plants = useMemo(() => data.plants.filter((p) => p.co2_mt_est && greatCircleKm(lat, lon, p.lat, p.lon) <= 30)
    .map((p) => ({ p, d: greatCircleKm(lat, lon, p.lat, p.lon) })).sort((a, b) => b.p.co2_mt_est! - a.p.co2_mt_est!), [data.plants, lat, lon]);
  const facs = useMemo(() => FACILITIES.map((f) => ({ f, a: engine?.city.anchor(f.name) })).filter((x) => x.a && greatCircleKm(lat, lon, x.a.lat, x.a.lon) <= 15), [engine, lat, lon]);
  const country = engine?.global.countryAt(lon, lat);
  const inv = country ? engine?.global.inventory.get(country.iso3) : undefined;

  return (
    <Panel eyebrow="Location intelligence · observations at this point" title={title} onClose={onClose}>
      <p className="ax-note">{lat.toFixed(4)}°, {lon.toFixed(4)}°{country ? ` · ${country.name}` : ""}. Values are decoded from each product&apos;s official GIBS colormap (quantised to the colour bin shown) for the date served.</p>

      <div className="ax-sec">Air quality — ground monitors <span className="ax-prov ax-prov-observed">Ground · real time</span></div>
      {!ground ? <p className="ax-note">Querying OpenAQ…</p> : "error" in ground ? <p className="ax-note warn">{ground.error}</p> : !ground.configured ? (
        <p className="ax-note warn">{ground.message}</p>
      ) : ground.stations.length === 0 ? <p className="ax-note">No reporting monitor within 25 km.</p> : (
        <table className="ax-table compact">
          <thead><tr><th>Station (≤25 km)</th><th>Latest readings</th></tr></thead>
          <tbody>{ground.stations.slice(0, 4).map((st) => (
            <tr key={st.id}><td>{st.name}<div className="ax-meta">{st.provider ?? st.owner ?? "OpenAQ"}{st.distanceM ? ` · ${(st.distanceM / 1000).toFixed(1)} km` : ""}</div></td>
              <td>{st.readings.length ? st.readings.slice(0, 5).map((r) => <div key={r.parameter + r.utc}>{r.label}: <b className="ax-num">{r.value}</b> {r.units} <span className="ax-meta">{r.utc.slice(0, 16).replace("T", " ")} UTC{(ageDays(r.utc) ?? 0) > 1 ? " · stale" : ""}</span></div>) : <span className="ax-meta">No recent readings</span>}</td></tr>
          ))}</tbody>
        </table>
      )}

      <div className="ax-sec">Air quality — CAMS model <span className="ax-prov ax-prov-projection">Model analysis</span></div>
      {!cams ? <p className="ax-note">Loading…</p> : "error" in cams ? <p className="ax-note warn">CAMS unavailable: {cams.error}</p> : (
        <>
          <div className="ax-aq">
            {Object.keys(AQ_LABEL).map((k) => (
              <div key={k}><span>{AQ_LABEL[k]}</span><b className="ax-num">{cams.values[k] ?? "—"}</b><em>{cams.units[k] ?? ""}</em></div>
            ))}
          </div>
          <p className="ax-src">Copernicus Atmosphere Monitoring Service global model via Open-Meteo, hour {cams.time} local, grid cell {cams.lat.toFixed(2)}°, {cams.lon.toFixed(2)}° (~40 km). A model estimate, not a monitor reading; the AQI is computed from model concentrations.</p>
        </>
      )}

      {READ_GROUPS.map((g) => (
        <div key={g.title}>
          <div className="ax-sec">{g.title}</div>
          <table className="ax-table compact readouts">
            <tbody>{g.ids.map((id) => {
              const def = gibsLayer(id)!;
              const r = reads[id];
              return (
                <tr key={id} onClick={() => s.toggleLayer(id, true)} title="Show this layer">
                  <td>{def.label}<div className="ax-meta">{def.resolution} · {def.latency === "nrt" ? "near-real-time" : def.latency}</div></td>
                  <td className="r">{!r || r === "loading" ? <span className="ax-meta">reading…</span> : r.status === "ok" ? <b className="ax-num">{r.text}</b> : <span className="ax-meta">{r.text}</span>}
                    {r && r !== "loading" && r.observed && <div className="ax-meta">{r.observed}</div>}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      ))}

      <div className="ax-sec">Emissions inventory near this point</div>
      {plants.length === 0 && facs.length === 0 && <p className="ax-note">No inventoried power plant (≥100 MW) within 30 km and no mapped Mumbai facility within 15 km.</p>}
      {plants.length > 0 && (
        <table className="ax-table compact">
          <thead><tr><th>Power plant (≤30 km)</th><th className="r">MtCO₂/yr</th></tr></thead>
          <tbody>{plants.slice(0, 6).map(({ p, d }) => (
            <tr key={p.id} onClick={() => s.select({ type: "plant", id: p.id })}><td>{titleCase(p.name)}<div className="ax-meta">{p.fuel} · {p.capacity_mw} MW · {d.toFixed(1)} km</div></td><td className="r ax-num">{p.co2_mt_est!.toFixed(2)} <span className="ax-prov ax-prov-estimate">Est.</span></td></tr>
          ))}</tbody>
        </table>
      )}
      {facs.length > 0 && (
        <table className="ax-table compact">
          <thead><tr><th>Facility (≤15 km)</th><th className="r">MtCO₂/yr</th></tr></thead>
          <tbody>{facs.map(({ f }) => { const em = facilityCo2[f.name]; return (
            <tr key={f.name} onClick={() => s.select({ type: "facility", name: f.name })}><td>{f.label}<div className="ax-meta">{KIND_LABEL[f.kind]}</div></td>
              <td className="r ax-num">{em ? em.mt.toFixed(2) : "—"}{em && <span className={`ax-prov ax-prov-${em.provenance}`}>{em.provenance === "demo" ? "Demo" : "Est."}</span>}</td></tr>
          ); })}</tbody>
        </table>
      )}
      {inv && country && (
        <>
          <div className="ax-sec">{country.name} · national inventory by sector (Climate Watch)</div>
          <SectorBars sectors={inv} />
        </>
      )}
    </Panel>
  );
}

export function SectorBars({ sectors }: { sectors: Record<string, [number, number][]> }) {
  const rows = Object.entries(sectors).map(([k, ser]) => ({ k, v: ser[ser.length - 1][1], y: ser[ser.length - 1][0] }))
    .filter((r) => r.k !== "Bunker Fuels").sort((a, b) => b.v - a.v);
  const max = Math.max(...rows.map((r) => Math.abs(r.v)), 1);
  return (
    <div className="ax-bars">
      {rows.map((r) => (
        <div key={r.k} className="row"><span>{r.k === "Land Use, Land-Use Change and Forestry" ? "Land use & forestry" : r.k}</span>
          <div className="track"><i style={{ width: `${(Math.abs(r.v) / max) * 100}%`, background: r.v < 0 ? "#3E9B5B" : "#9AA4B2" }} /></div>
          <b className="ax-num">{fmt.mt(r.v)}</b></div>
      ))}
      <div className="ax-meta">MtCO₂e, all GHGs, {rows[0]?.y}. Negative = net removals.</div>
    </div>
  );
}

export function useMissionForCategory(cat: ObsCategory): Mission {
  return MISSIONS.find((m) => m.category === cat || m.products.some((p) => gibsLayer(p)?.obs === cat)) ?? MISSIONS[0];
}
