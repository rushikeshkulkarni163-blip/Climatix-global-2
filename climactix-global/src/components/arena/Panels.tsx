"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useArena } from "./store";
import { EXPOSURE_COLOR, useArenaCtx } from "./context";
import { fmt, Prov } from "./fmt";
import { useEra5 } from "./useArenaData";
import { SimulatorPanel } from "./Simulator";
import { LocationIntel, MissionControl, SatellitePanel, SectorBars } from "./Observation";
import { METRIC_META } from "./engine/globalLayers";
import type { InventoryMetric } from "./store";
import { CITE, SCENARIOS, deltaFromEra5Baseline, impactsAt, warmingAt, type ScenarioImpacts } from "@/lib/arena/science";
import { FACILITIES, KIND_LABEL, MUMBAI_POINT, exposureIndex, facilityByName } from "@/lib/arena/mumbai";
import { placeById } from "@/lib/arena/places";
import { titleCase } from "@/lib/arena/emissions";

export function Panel({ title, eyebrow, children, onClose, tone }: { title: ReactNode; eyebrow?: string; children: ReactNode; onClose?: () => void; tone?: "accent" }) {
  return (
    <section className={`ax-panel${tone ? ` ${tone}` : ""}`}>
      <header>
        <div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h3>{title}</h3></div>
        {onClose && <button className="ax-x" aria-label="Close" onClick={onClose}>×</button>}
      </header>
      <div className="bd">{children}</div>
    </section>
  );
}

export function Kpi({ label, value, unit, note, prov }: { label: string; value: ReactNode; unit?: string; note?: ReactNode; prov?: Parameters<typeof Prov>[0]["p"] }) {
  return (
    <div className="ax-kpi">
      <div className="l">{label}{prov && <Prov p={prov} />}</div>
      <div className="v">{value}{unit && <small>{unit}</small>}</div>
      {note && <div className="n">{note}</div>}
    </div>
  );
}

const AXIS = { stroke: "#5B6370", fontSize: 10, tickLine: false } as const;
const TIP = { contentStyle: { background: "#0E1217", border: "1px solid #2A303A", borderRadius: 8, fontSize: 12, color: "#E6E8EC" }, labelStyle: { color: "#9AA3AF" } };

export function RightColumn() {
  const module = useArena((s) => s.module);
  const selection = useArena((s) => s.selection);
  const point = useArena((s) => s.point);
  const setPoint = useArena((s) => s.setPoint);
  return (
    <aside className="ax-right" aria-label="Intelligence panels">
      {module === "observation" && <MissionControl />}
      {module === "observation" && point && <LocationIntel lat={point.lat} lon={point.lon} title="Selected point" onClose={() => setPoint(null)} />}
      {selection && module !== "simulator" && !(module === "observation" && selection.type === "satellite") && <SelectionPanel />}
      {module === "earth" && <EarthPanel />}
      {module === "city" && <CityPanel />}
      {module === "carbon" && <CarbonPanel />}
      {module === "futures" && <FuturesPanel />}
      {module === "twin" && <TwinPanel />}
      {module === "simulator" && <SimulatorPanel />}
    </aside>
  );
}

/* ── Earth ───────────────────────────────────────────────────────────────── */

function EarthPanel() {
  const { data } = useArenaCtx();
  const world = data.countries.find((c) => c.iso3 === "WLD");
  const g = data.gistemp;
  const last = g[g.length - 1];
  return (
    <Panel eyebrow="Planetary overview" title="Climactix Earth">
      <div className="ax-kpis">
        <Kpi label="World fossil CO₂" prov="observed" value={world ? fmt.mt(world.latest.co2[0] / 1000) : "—"} unit="GtCO₂" note={world ? `${world.latest.co2[1]} · Global Carbon Project` : undefined} />
        <Kpi label="Global temperature anomaly" prov="observed" value={last ? fmt.t(last[1], 2) : "—"} unit="°C" note={last ? `${last[0]} vs 1951–1980 · NASA GISTEMP v4` : undefined} />
      </div>
      {g.length > 0 && (
        <div className="ax-chart">
          <div className="ax-meta">Annual global mean temperature anomaly, °C vs 1951–1980 (GISTEMP v4)</div>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={g.filter(([y]) => y >= 1900).map(([year, v]) => ({ year, v }))} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
              <CartesianGrid stroke="#1C222B" vertical={false} />
              <XAxis dataKey="year" {...AXIS} interval={29} />
              <YAxis {...AXIS} domain={[-0.6, 1.4]} />
              <ReferenceLine y={0} stroke="#3A414C" />
              <Tooltip {...TIP} formatter={(v: number) => [`${v.toFixed(2)} °C`, "Anomaly"]} />
              <Line dataKey="v" stroke="#9DB8EA" dot={false} strokeWidth={1.6} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="ax-note">IPCC AR6 assesses 2011–2020 at 1.09 °C above 1850–1900 — the baseline the Climate Futures scenarios are measured from. GISTEMP uses a different baseline (1951–1980), so the two numbers are not directly comparable.</p>
      <ol className="ax-steps">
        <li>Drag to rotate, scroll to zoom, click a country to select it.</li>
        <li>Navigate → India → Maharashtra → Mumbai to descend into the city.</li>
        <li>Open Carbon Intelligence or Climate Futures to switch on data layers.</li>
      </ol>
    </Panel>
  );
}

/* ── Selection ───────────────────────────────────────────────────────────── */

function FacilityIntel({ name }: { name: string }) {
  const { engine } = useArenaCtx();
  const a = engine?.city.anchor(name);
  if (!a) return null;
  return <LocationIntel lat={a.lat} lon={a.lon} title="Environmental observations at this facility" />;
}

function CountrySectors({ iso3 }: { iso3: string }) {
  const { engine } = useArenaCtx();
  const inv = engine?.global.inventory.get(iso3);
  if (!inv) return null;
  return (<><div className="ax-sec">GHG inventory by sector (Climate Watch)</div><SectorBars sectors={inv} /></>);
}

function SelectionPanel() {
  const sel = useArena((s) => s.selection)!;
  const select = useArena((s) => s.select);
  const close = () => select(null);
  if (sel.type === "country") return <CountryPanel iso3={sel.iso3} name={sel.name} onClose={close} />;
  if (sel.type === "plant") return <PlantPanel id={sel.id} onClose={close} />;
  if (sel.type === "facility") return <><FacilityPanel name={sel.name} onClose={close} /><FacilityIntel name={sel.name} /></>;
  if (sel.type === "place") {
    const p = placeById(sel.id);
    return (
      <>
        <PlacePanel id={sel.id} onClose={close} />
        {p && (p.kind === "cluster" || p.kind === "city") && <LocationIntel lat={p.lat} lon={p.lon} title={`${p.name} — environmental observations`} />}
      </>
    );
  }
  if (sel.type === "satellite") return <SatellitePanel id={sel.id} onClose={close} />;
  return (
    <Panel eyebrow={sel.type === "airport" ? "Airport" : "Port"} title={sel.type === "airport" ? sel.code : sel.name} onClose={close}>
      <p className="ax-note">{sel.type === "airport" ? "OurAirports (public domain)." : "Natural Earth ports (public domain)."} Location only — throughput and emissions are not attributed to individual {sel.type === "airport" ? "airports" : "ports"} in this build.</p>
    </Panel>
  );
}

function CountryPanel({ iso3, name, onClose }: { iso3: string; name: string; onClose: () => void }) {
  const { data } = useArenaCtx();
  const s = useArena();
  const c = data.countries.find((x) => x.iso3 === iso3);
  if (!c) return <Panel eyebrow="Country" title={name} onClose={onClose}><p className="ax-note">No emissions record for this territory in the Global Carbon Project dataset.</p></Panel>;
  const L = c.latest;
  const v = (k: string) => (L[k] ? L[k][0] : 0);
  const parts = [
    ["Coal", v("coal_co2"), "#4B4B4B"], ["Oil", v("oil_co2"), "#8A5A2B"], ["Gas", v("gas_co2"), "#C2702A"],
    ["Cement", v("cement_co2"), "#9AA4B2"], ["Flaring", v("flaring_co2"), "#E0B04A"], ["Other industry", v("other_industry_co2"), "#6B7280"],
  ] as [string, number, string][];
  const total = v("co2");
  const series = (c.series.co2 ?? []).map(([year, val]) => ({ year, val }));
  return (
    <Panel eyebrow="Country · territorial fossil CO₂" title={c.name} onClose={onClose}>
      <div className="ax-kpis">
        <Kpi label="Annual CO₂" prov="observed" value={fmt.mt(total)} unit="MtCO₂" note={`${L.co2[1]} · share of world ${L.share_global_co2 ? L.share_global_co2[0].toFixed(1) : "—"}%`} />
        <Kpi label="Per person" prov="observed" value={L.co2_per_capita ? L.co2_per_capita[0].toFixed(2) : "—"} unit="tCO₂" note={L.co2_per_gdp ? `${L.co2_per_gdp[0].toFixed(3)} kg per $ GDP (${L.co2_per_gdp[1]})` : undefined} />
      </div>
      <div className="ax-sec">By source ({L.co2[1]})</div>
      <div className="ax-bars">
        {parts.filter(([, x]) => x > 0).map(([k, x, col]) => (
          <div key={k} className="row"><span>{k}</span><div className="track"><i style={{ width: `${(x / total) * 100}%`, background: col }} /></div><b className="ax-num">{fmt.mt(x)}</b></div>
        ))}
      </div>
      {series.length > 3 && (
        <div className="ax-chart">
          <div className="ax-meta">Annual fossil CO₂ since 1990, MtCO₂</div>
          <ResponsiveContainer width="100%" height={110}>
            <LineChart data={series} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
              <CartesianGrid stroke="#1C222B" vertical={false} />
              <XAxis dataKey="year" {...AXIS} interval={9} />
              <YAxis {...AXIS} width={44} />
              <Tooltip {...TIP} formatter={(x: number) => [`${fmt.mt(x)} Mt`, "CO₂"]} />
              <Line dataKey="val" stroke="#EE7E3C" dot={false} strokeWidth={1.6} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <CountrySectors iso3={iso3} />
      <dl className="ax-kv">
        {L.consumption_co2 && <><dt>Consumption-based CO₂</dt><dd>{fmt.mt(L.consumption_co2[0])} Mt ({L.consumption_co2[1]})</dd></>}
        {L.total_ghg && <><dt>Total GHG incl. land use</dt><dd>{fmt.mt(L.total_ghg[0])} MtCO₂e ({L.total_ghg[1]})</dd></>}
        {L.cumulative_co2 && <><dt>Cumulative CO₂ since 1750</dt><dd>{fmt.mt(L.cumulative_co2[0] / 1000)} Gt</dd></>}
      </dl>
      <div className="ax-row wrap">
        <button className="ax-btn primary sm" onClick={() => { s.setEntity(`country:${iso3}`); s.setModule("simulator"); }}>Simulate decarbonisation</button>
        <button className="ax-btn sm" onClick={() => { s.toggleLayer("co2-plants", true); }}>Show power-sector sources</button>
        {iso3 === "IND" && <button className="ax-btn sm" onClick={() => s.select({ type: "place", id: "in-mh" })}>Descend to Maharashtra</button>}
      </div>
      <p className="ax-src">Global Carbon Project via Our World in Data (CC BY 4.0).</p>
    </Panel>
  );
}

function PlantPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useArenaCtx();
  const s = useArena();
  const p = data.plants.find((x) => x.id === id);
  if (!p) return <Panel eyebrow="Power plant" title={id} onClose={onClose}><p className="ax-note">Loading…</p></Panel>;
  const fossil = p.co2_mt_est !== null;
  return (
    <Panel eyebrow={`Power plant · ${p.fuel}`} title={titleCase(p.name)} onClose={onClose}>
      <div className="ax-kpis">
        <Kpi label="Capacity" prov="observed" value={fmt.int(p.capacity_mw)} unit="MW" note={p.commissioned ? `Commissioned ${p.commissioned}` : undefined} />
        {fossil ? <Kpi label="Estimated CO₂" prov="estimate" value={fmt.mt(p.co2_mt_est!)} unit="Mt/yr" note="Generation × fuel emission factor" />
          : <Kpi label="Direct CO₂" value="≈ 0" note="Non-combustion generation" />}
      </div>
      <dl className="ax-kv">
        <dt>Generation</dt><dd>{p.generation_gwh !== null ? `${fmt.int(p.generation_gwh)} GWh` : "—"} {p.generation_basis === "reported" ? `(reported ${p.generation_year})` : p.generation_basis === "wri_estimate" ? "(WRI estimate 2017)" : p.generation_basis ? "(default capacity factor)" : ""}</dd>
        <dt>Country</dt><dd>{p.iso3}</dd>
        {p.owner && <><dt>Owner (WRI)</dt><dd>{p.owner}</dd></>}
        <dt>Location</dt><dd>{p.lat.toFixed(4)}, {p.lon.toFixed(4)}</dd>
      </dl>
      {fossil && <div className="ax-row"><button className="ax-btn primary sm" onClick={() => { s.setEntity(`plant:${p.id}`); s.setModule("simulator"); }}>Simulate this plant</button></div>}
      <p className="ax-src">WRI Global Power Plant Database v1.3 (CC BY 4.0, last updated 2021). CO₂ is a Climactix estimate; unit efficiency, co-firing and capture are not modelled.</p>
    </Panel>
  );
}

function PlacePanel({ id, onClose }: { id: string; onClose: () => void }) {
  const p = placeById(id);
  const s = useArena();
  if (!p) return null;
  return (
    <Panel eyebrow={p.kind === "cluster" ? "Industrial cluster" : p.kind[0].toUpperCase() + p.kind.slice(1)} title={p.name} onClose={onClose}>
      {p.note && <p className="ax-note">{p.note}</p>}
      {p.arena && (
        <>
          <p className="ax-note">Digital twin available: about 200,000 building footprints, 14 mapped facilities, road and rail network, and live weather.</p>
          <div className="ax-row wrap">
            <button className="ax-btn primary sm" onClick={() => s.setModule("city")}>Enter City Arena</button>
            <button className="ax-btn sm" onClick={() => s.setModule("futures")}>The 1.5 °C future</button>
          </div>
        </>
      )}
      {p.kind === "state" && p.parent === "IND" && <p className="ax-note">State boundaries are not drawn in this build; the camera centres on the state. Choose a city in Navigate.</p>}
      {p.kind === "city" && !p.arena && <p className="ax-note">Imagery{process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN ? " and terrain" : ""} only — the building, facility and traffic environment is built for Mumbai.</p>}
    </Panel>
  );
}

function FacilityPanel({ name, onClose }: { name: string; onClose: () => void }) {
  const { facilityCo2 } = useArenaCtx();
  const s = useArena();
  const f = facilityByName(name);
  const imp = useMemo(() => impactsAt(s.scenario, s.year), [s.scenario, s.year]);
  if (!f) return null;
  const em = facilityCo2[name];
  const ex = exposureIndex(f, imp);
  const price = s.levers.carbonPrice || 50;
  return (
    <Panel eyebrow={KIND_LABEL[f.kind]} title={f.label} onClose={onClose}>
      <p className="ax-note">{f.description} Operator: {f.operator ?? "not verified in source data"}.</p>
      <div className="ax-kpis">
        <Kpi label="Annual CO₂" prov={em?.provenance} value={em ? fmt.mt(em.mt) : "—"} unit={em ? "Mt" : undefined} note={em ? em.basis : "No facility-level figure connected"} />
        <Kpi label={`Exposure · ${imp.scenario.short} · ${s.year}`} prov="estimate" value={<span style={{ color: EXPOSURE_COLOR[ex.band] }}>{ex.score.toFixed(0)}</span>} unit={ex.band} note="Screening index, 0–100" />
      </div>
      <ExposureBreakdown imp={imp} name={name} />
      {em && (
        <div className="ax-fin">
          <div className="ax-sec">Carbon cost exposure</div>
          <div className="ax-row"><span className="ax-num big">{fmt.usdM(em.mt * price)}</span><span className="ax-meta">per year at ${price}/tCO₂{s.levers.carbonPrice ? " (simulator price)" : " (reference price — set in Scenario Simulator)"}, no free allocation</span></div>
          {em.provenance === "demo" && <p className="ax-note warn">Based on demo emissions — replace with the operator&apos;s disclosed Scope 1 before use.</p>}
        </div>
      )}
    </Panel>
  );
}

function ExposureBreakdown({ imp, name }: { imp: ScenarioImpacts; name: string }) {
  const f = facilityByName(name)!;
  const ex = exposureIndex(f, imp);
  return (
    <div className="ax-bars">
      {ex.parts.map((p) => (
        <div key={p.key} className="row" title={p.driver}>
          <span>{p.label}</span>
          <div className="track"><i style={{ width: `${(p.points / (100 * p.weight)) * 100}%`, background: "#9DB8EA" }} /></div>
          <b className="ax-num">{p.points.toFixed(0)}<small>/{(100 * p.weight).toFixed(0)}</small></b>
        </div>
      ))}
      <div className="ax-meta">{ex.parts.map((p) => p.driver).join(" · ")}</div>
    </div>
  );
}

/* ── City Arena ──────────────────────────────────────────────────────────── */

function CityPanel() {
  const { data, weather, requestCamera } = useArenaCtx();
  const inCity = useArena((s) => s.inCity);
  const era = useEra5(MUMBAI_POINT.lat, MUMBAI_POINT.lon, true);
  const t = data.manifest?.datasets["mumbai/tileset.json"];
  const hb = (t as unknown as { height_basis?: Record<string, number> })?.height_basis;
  return (
    <Panel eyebrow="City Arena · digital twin" title="Mumbai">
      {!inCity && <div className="ax-row"><button className="ax-btn primary sm" onClick={() => requestCamera("high")}>Fly into the city</button></div>}
      <div className="ax-kpis">
        <Kpi label="Buildings modelled" prov="observed" value={t ? fmt.int(t.records) : "—"} note="Overture Maps footprints" />
        <Kpi label="Heights from GHSL" prov="estimate" value={hb ? fmt.pct(hb.ghsl / (hb.ghsl + hb.osm_height + hb.floors + hb.minimum)) : "—"} note="Rest from OSM tags or a 4 m floor" />
      </div>
      {weather.data && (
        <>
          <div className="ax-sec">Current weather · Open-Meteo</div>
          <dl className="ax-kv">
            <dt>Observed at</dt><dd>{weather.data.time} IST</dd>
            <dt>Air temperature</dt><dd>{weather.data.temperature.toFixed(1)} °C</dd>
            <dt>Rain</dt><dd>{weather.data.rain.toFixed(1)} mm/h · cloud {weather.data.cloudCover}%</dd>
            <dt>Wind (10 m)</dt><dd>{weather.data.windSpeed.toFixed(1)} m/s from {Math.round(weather.data.windDir)}°</dd>
          </dl>
        </>
      )}
      <div className="ax-sec">Local climate record · ERA5 reanalysis</div>
      {era.error && <p className="ax-note warn">ERA5 series unavailable: {era.error}</p>}
      {!era.data && !era.error && <p className="ax-note">Loading 1981–2024 daily series…</p>}
      {era.data && (
        <>
          <div className="ax-kpis">
            <Kpi label="Mean daily max, 1981–2010" prov="observed" value={era.data.baseline.meanTmax.toFixed(1)} unit="°C" note={`${era.data.recent.period}: ${era.data.recent.meanTmax.toFixed(1)} °C`} />
            <Kpi label="Trend in mean daily max" prov="observed" value={fmt.t(era.data.trendPerDecade, 2)} unit="°C / decade" note="Least squares, 1981–2024" />
          </div>
          <div className="ax-chart">
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={era.data.years.map((y, i) => ({ y, v: era.data!.annualMeanTmax[i] }))} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="#1C222B" vertical={false} />
                <XAxis dataKey="y" {...AXIS} interval={10} />
                <YAxis {...AXIS} domain={["auto", "auto"]} />
                <Tooltip {...TIP} formatter={(x: number) => [`${x.toFixed(2)} °C`, "Annual mean Tmax"]} />
                <Line dataKey="v" stroke="#EE7E3C" dot={false} strokeWidth={1.5} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="ax-src">ERA5 via Open-Meteo, grid cell nearest {MUMBAI_POINT.lat}°N {MUMBAI_POINT.lon}°E (~25 km). Coarse grids smooth coastal and urban extremes.</p>
        </>
      )}
      <div className="ax-sec">Camera modes</div>
      <p className="ax-note">Satellite (2) · High altitude (3) · Cinematic flight (4) · Street level (5) · Free roam (6) · Intelligence view (7). Traffic is an illustrative animation on real road geometry, not live traffic.</p>
    </Panel>
  );
}

/* ── Carbon Intelligence ─────────────────────────────────────────────────── */

function CarbonPanel() {
  const { data, engine } = useArenaCtx();
  const s = useArena();
  const [metric, setMetric] = useState<"co2" | "co2_per_capita">("co2");
  const rows = useMemo(() => data.countries.filter((c) => c.iso3 !== "WLD" && c.latest[metric]).sort((a, b) => b.latest[metric][0] - a.latest[metric][0]).slice(0, 12), [data.countries, metric]);
  const iso = s.selection?.type === "country" ? s.selection.iso3 : null;
  const plants = useMemo(() => data.plants.filter((p) => p.co2_mt_est && (!iso || p.iso3 === iso)).sort((a, b) => b.co2_mt_est! - a.co2_mt_est!).slice(0, 8), [data.plants, iso]);
  const world = data.countries.find((c) => c.iso3 === "WLD");
  const inv = iso ? engine?.global.inventory.get(iso) : engine?.global.inventory.get("IND");
  const toggle = (id: string) => s.toggleLayer(id);
  const chk = (id: string, label: ReactNode) => <label className="ax-check"><input type="checkbox" checked={!!s.layers[id]} onChange={() => toggle(id)} /> {label}</label>;
  return (
    <Panel eyebrow="Carbon Intelligence" title="Concentration, inventory and point sources — kept separate">
      <div className="ax-classes">
        <div><b>A · Atmospheric concentration</b><span>What satellites measure in the air column. Units: ppm (CO₂), ppbv (CH₄, CO).</span>
          {chk("xco2", "CO₂ column, OCO-2 (daily)")}
          {chk("ch4", "Methane, AIRS (monthly)")}
          {chk("co-airs", "Carbon monoxide, AIRS (monthly)")}
        </div>
        <div><b>B · Emissions inventory</b><span>Estimated annual flows by country and sector. Units: MtCO₂ / MtCO₂e per year.</span>
          {chk("co2-countries", "National inventory on the globe")}
          <select className="ax-in sm" value={s.inventoryMetric} onChange={(e) => { s.setInventoryMetric(e.target.value as InventoryMetric); s.toggleLayer("co2-countries", true); }} aria-label="Inventory metric">
            {(Object.keys(METRIC_META) as InventoryMetric[]).map((k) => <option key={k} value={k}>{METRIC_META[k].label}</option>)}
          </select>
        </div>
        <div><b>C · Point sources</b><span>Facility-level estimates only where a plant record supports them (WRI GPPD generation × emission factor).</span>
          {chk("co2-plants", "Power-sector inventory (estimated)")}
        </div>
      </div>
      <p className="ax-note">Concentration rasters are never drawn as smoke from factories: well-mixed CO₂ varies by a few ppm around ≈420 ppm, while inventories are annual tonnes attributed to territories and plants. Use the Layers tab to pick historical dates and compare them side by side.</p>
      {world && <Kpi label="World fossil CO₂" prov="observed" value={fmt.mt(world.latest.co2[0] / 1000)} unit="GtCO₂/yr" note={`${world.latest.co2[1]} · Global Carbon Project`} />}
      {inv && (
        <>
          <div className="ax-sec">{iso ? s.selection && s.selection.type === "country" ? s.selection.name : iso : "India"} · GHG inventory by sector (Climate Watch)</div>
          <SectorBars sectors={inv} />
        </>
      )}
      <div className="ax-row between">
        <div className="ax-sec">Largest emitters (fossil CO₂)</div>
        <div className="ax-seg sm">
          <button className={metric === "co2" ? "on" : ""} onClick={() => setMetric("co2")}>Total</button>
          <button className={metric === "co2_per_capita" ? "on" : ""} onClick={() => setMetric("co2_per_capita")}>Per person</button>
        </div>
      </div>
      <table className="ax-table compact">
        <thead><tr><th>Country</th><th className="r">{metric === "co2" ? "MtCO₂" : "tCO₂/person"}</th><th className="r">Year</th></tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.iso3} className={iso === c.iso3 ? "on" : ""} onClick={() => s.select({ type: "country", iso3: c.iso3, name: c.name })}>
              <td>{c.name}</td><td className="r ax-num">{metric === "co2" ? fmt.mt(c.latest.co2[0]) : c.latest.co2_per_capita[0].toFixed(1)}</td><td className="r">{c.latest[metric][1]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ax-sec">Largest estimated power-sector point sources{iso ? ` · ${iso}` : ""}</div>
      <table className="ax-table compact">
        <thead><tr><th>Plant</th><th>Fuel</th><th className="r">MtCO₂/yr</th></tr></thead>
        <tbody>
          {plants.map((p) => (
            <tr key={p.id} onClick={() => s.select({ type: "plant", id: p.id })}><td>{titleCase(p.name)}</td><td>{p.fuel}</td><td className="r ax-num">{p.co2_mt_est!.toFixed(1)}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="ax-src">Inventories: Global Carbon Project via OWID; Climate Watch (WRI) sector data. Point sources: WRI GPPD v1.3 with Climactix estimates. Concentration: NASA OCO-2 and AIRS via GIBS. Shipping and aviation are not attributed to locations.</p>
    </Panel>
  );
}

/* ── Climate Futures ─────────────────────────────────────────────────────── */

function FuturesPanel() {
  const s = useArena();
  const era = useEra5(MUMBAI_POINT.lat, MUMBAI_POINT.lon, true);
  const imp = useMemo(() => impactsAt(s.scenario, s.year), [s.scenario, s.year]);
  const all = useMemo(() => SCENARIOS.map((sc) => impactsAt(sc.id, s.year)), [s.year]);
  const path = useMemo(() => {
    const out: Record<string, number | string>[] = [];
    for (let y = 2016; y <= 2100; y += 2) {
      const row: Record<string, number | string> = { y };
      for (const sc of SCENARIOS) row[sc.id] = Number(warmingAt(sc.id, y).gwl.toFixed(2));
      out.push(row);
    }
    return out;
  }, []);
  const w = imp.warming;
  const dHot = deltaFromEra5Baseline("hot10", w.gwl);
  const dRain = deltaFromEra5Baseline("rain10", w.gwl);
  const interp = (x: { interpolated: boolean }) => (x.interpolated ? "interpolated" : "projection") as "interpolated" | "projection";
  return (
    <Panel eyebrow="The 1.5 °C future · a climate transformation experience" title={`${imp.scenario.label} · ${s.year}`} tone="accent">
      <p className="ax-note">{imp.scenario.description}</p>
      <div className="ax-kpis">
        <Kpi label="Global warming level" prov={s.scenario === "baseline" ? "observed" : interp(w)} value={w.gwl.toFixed(2)} unit="°C" note={`${w.lo.toFixed(1)}–${w.hi.toFixed(1)} °C very likely · ${w.basis}`} />
        <Kpi label="Global mean sea level" prov={s.scenario === "baseline" ? "observed" : "projection"} value={`+${(imp.seaLevel.m * 100).toFixed(0)}`} unit="cm" note={`${(imp.seaLevel.lo * 100).toFixed(0)}–${(imp.seaLevel.hi * 100).toFixed(0)} cm likely · vs 1995–2014`} />
      </div>
      <div className="ax-sec">Extremes over land at this warming level · {CITE.spm6.short}</div>
      <table className="ax-table compact">
        <thead><tr><th>Event (pre-industrial 1-in-N)</th><th className="r">Frequency</th><th className="r">Intensity</th></tr></thead>
        <tbody>
          {([["10-yr hot extreme", imp.hot10, "°C"], ["50-yr hot extreme", imp.hot50, "°C"], ["10-yr heavy 1-day rain", imp.rain10, "%"], ["10-yr agri/eco drought", imp.drought10, "s.d."]] as const).map(([l, x, u]) => (
            <tr key={l}><td>{l} {x.interpolated && <span className="ax-prov ax-prov-interpolated">Interp.</span>}</td><td className="r ax-num">{x.freq.toFixed(1)}×</td><td className="r ax-num">{fmt.t(x.intensity, u === "s.d." ? 2 : 1)} {u}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="ax-sec">Mumbai translation · ERA5 1981–2010 baseline</div>
      {era.data ? (
        <dl className="ax-kv">
          <dt>Typical hottest day of year</dt>
          <dd>{era.data.baseline.maxTmax.toFixed(1)} °C → <b>{(era.data.baseline.maxTmax + dHot.intensity).toFixed(1)} °C</b> <span className="ax-prov ax-prov-estimate">Estimate</span></dd>
          <dt>Hot extremes vs 1981–2010</dt><dd>{dHot.freqRatio.toFixed(1)}× as frequent</dd>
          <dt>Wettest day of year</dt>
          <dd>{era.data.baseline.maxPrecip.toFixed(0)} mm → <b>{(era.data.baseline.maxPrecip * (1 + dRain.intensity / 100)).toFixed(0)} mm</b> <span className="ax-prov ax-prov-estimate">Estimate</span></dd>
        </dl>
      ) : <p className="ax-note">{era.error ? `ERA5 unavailable: ${era.error}` : "Loading ERA5 baseline…"}</p>}
      <p className="ax-src">Global-land median change from {CITE.spm6.short} applied to the local ERA5 baseline (≈0.6 °C above pre-industrial). First-order only: Mumbai&apos;s coastal setting moderates heat extremes relative to the land average, and ERA5&apos;s ~25 km grid underestimates local rainfall peaks.</p>
      <div className="ax-chart">
        <div className="ax-meta">Global warming by pathway, °C above 1850–1900 (Table SPM.1, interpolated)</div>
        <ResponsiveContainer width="100%" height={130}>
          <LineChart data={path} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
            <CartesianGrid stroke="#1C222B" vertical={false} />
            <XAxis dataKey="y" {...AXIS} interval={9} />
            <YAxis {...AXIS} domain={[1, 3]} />
            <ReferenceLine x={Math.round(s.year / 2) * 2} stroke="#9DB8EA" strokeDasharray="3 3" />
            <ReferenceLine y={1.5} stroke="#3A414C" strokeDasharray="2 4" />
            <Tooltip {...TIP} formatter={(v: number, k: string) => [`${v} °C`, SCENARIOS.find((x) => x.id === k)?.short ?? k]} />
            {SCENARIOS.map((sc) => <Line key={sc.id} dataKey={sc.id} dot={false} isAnimationActive={false} stroke={sc.id === s.scenario ? "#E6E8EC" : "#4A5260"} strokeWidth={sc.id === s.scenario ? 2 : 1.2} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="ax-sec">Scenario comparison · {s.year}</div>
      <table className="ax-table compact">
        <thead><tr><th />{all.map((a) => <th key={a.scenario.id} className={`r${a.scenario.id === s.scenario ? " on" : ""}`}>{a.scenario.short}</th>)}</tr></thead>
        <tbody>
          <tr><td>Warming °C</td>{all.map((a) => <td key={a.scenario.id} className="r ax-num">{a.warming.gwl.toFixed(2)}</td>)}</tr>
          <tr><td>Hot extreme freq.</td>{all.map((a) => <td key={a.scenario.id} className="r ax-num">{a.hot10.freq.toFixed(1)}×</td>)}</tr>
          <tr><td>Heavy rain intensity</td>{all.map((a) => <td key={a.scenario.id} className="r ax-num">+{a.rain10.intensity.toFixed(1)}%</td>)}</tr>
          <tr><td>Drought freq.</td>{all.map((a) => <td key={a.scenario.id} className="r ax-num">{a.drought10.freq.toFixed(1)}×</td>)}</tr>
          <tr><td>Sea level cm</td>{all.map((a) => <td key={a.scenario.id} className="r ax-num">+{(a.seaLevel.m * 100).toFixed(0)}</td>)}</tr>
        </tbody>
      </table>
      <div className="ax-sec">Actual observations alongside the scenario</div>
      <p className="ax-note">Scenarios are not drawn onto the map. The globe shows observed data; switch between them here and compare dates in the Layers tab.</p>
      <label className="ax-check"><input type="checkbox" checked={!!s.layers["lst-monthly"]} onChange={() => s.toggleLayer("lst-monthly")} /> Land surface temperature, monthly (MODIS) <span className="ax-prov ax-prov-observed">Observed</span></label>
      <label className="ax-check"><input type="checkbox" checked={!!s.layers["uhi-day"]} onChange={() => s.toggleLayer("uhi-day")} /> Urban heat island, summer 2013 (SEDAC) <span className="ax-prov ax-prov-observed">Observed</span></label>
      <label className="ax-check"><input type="checkbox" checked={!!s.layers["flood-hazard"]} onChange={() => s.toggleLayer("flood-hazard")} /> Flood hazard frequency 1985–2003 (SEDAC) <span className="ax-prov ax-prov-observed">Historical</span></label>
      <label className="ax-check"><input type="checkbox" checked={!!s.layers["soil-moisture"]} onChange={() => s.toggleLayer("soil-moisture")} /> Root-zone soil moisture (SMAP) <span className="ax-prov ax-prov-observed">Near-real-time</span></label>
      <p className="ax-note">Facility footprints are coloured by the exposure index for this scenario and year. Coastal inundation is not drawn: it needs a coastal elevation model, which is not yet connected.</p>
      <div className="ax-row"><button className="ax-btn primary sm" onClick={() => s.setModule("twin")}>Financial consequences →</button></div>
    </Panel>
  );
}

/* ── Industrial Digital Twin ─────────────────────────────────────────────── */

function TwinPanel() {
  const { facilityCo2 } = useArenaCtx();
  const s = useArena();
  const imp = useMemo(() => impactsAt(s.scenario, s.year), [s.scenario, s.year]);
  const base = useMemo(() => impactsAt("baseline", s.year), [s.year]);
  const [price, setPrice] = useState(s.levers.carbonPrice || 50);
  const rows = useMemo(() => FACILITIES.map((f) => ({ f, ex: exposureIndex(f, imp), ex0: exposureIndex(f, base), em: facilityCo2[f.name] })).sort((a, b) => b.ex.score - a.ex.score), [imp, base, facilityCo2]);
  const est = rows.filter((r) => r.em && r.em.provenance !== "demo").reduce((a, r) => a + r.em!.mt, 0);
  const demo = rows.filter((r) => r.em?.provenance === "demo").reduce((a, r) => a + r.em!.mt, 0);
  const sel = s.selection?.type === "facility" ? s.selection.name : null;
  return (
    <Panel eyebrow="Industrial Digital Twin · Mumbai" title={`Exposure and financial consequences · ${imp.scenario.short} · ${s.year}`}>
      <table className="ax-table compact">
        <thead><tr><th>Facility</th><th className="r">MtCO₂</th><th className="r">Exposure</th><th className="r">Δ vs base</th></tr></thead>
        <tbody>
          {rows.map(({ f, ex, ex0, em }) => (
            <tr key={f.name} className={sel === f.name ? "on" : ""} onClick={() => s.select({ type: "facility", name: f.name })}>
              <td>{f.label}<div className="ax-meta">{KIND_LABEL[f.kind]}</div></td>
              <td className="r ax-num">{em ? fmt.mt(em.mt) : "—"}{em?.provenance === "demo" && <sup className="ax-demo">demo</sup>}</td>
              <td className="r"><span className="ax-band" style={{ background: EXPOSURE_COLOR[ex.band] }}>{ex.score.toFixed(0)}</span></td>
              <td className="r ax-num">{fmt.t(ex.score - ex0.score, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ax-fin">
        <div className="ax-sec">Carbon cost liability (Scope 1, no free allocation)</div>
        <div className="ax-row"><input type="range" min={0} max={300} step={5} value={price} onChange={(e) => setPrice(Number(e.target.value))} aria-label="Carbon price" /><span className="ax-num">${price}/tCO₂</span></div>
        <div className="ax-kpis">
          <Kpi label="Estimated sources" prov="estimate" value={fmt.usdM(est * price)} unit="/ yr" note={`${fmt.mt(est)} MtCO₂ — GPPD-based power stations`} />
          <Kpi label="Demo sources" prov="demo" value={fmt.usdM(demo * price)} unit="/ yr" note={`${fmt.mt(demo)} MtCO₂ — placeholders until disclosures connect`} />
        </div>
      </div>
      <p className="ax-src">Exposure is a screening index from IPCC AR6 global-land changes and facility flags (coastal, riverine, water-intensive, outdoor work) — see Sources &amp; method. It ranks relative exposure; it does not estimate damages, revenue at risk or asset value. Connect asset values and damage functions to convert exposure into financial loss.</p>
    </Panel>
  );
}
