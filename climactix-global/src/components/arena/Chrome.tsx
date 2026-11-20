"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type RefObject } from "react";
import { useArena, MODULES, type CameraMode, type InventoryMetric } from "./store";
import { LayerDetail, ObservationDock } from "./Observation";
import { METRIC_META } from "./engine/globalLayers";
import { useArenaCtx } from "./context";
import { GROUP_LABEL, LAYERS, type LayerGroup } from "@/lib/arena/layers";
import { CITE, SCENARIOS, TIMELINE_YEARS } from "@/lib/arena/science";
import { CONSTELLATION_NOTICE } from "@/lib/arena/constellation";
import { ASSUMPTIONS } from "@/lib/arena/emissions";
import { EXPOSURE_WEIGHTS } from "@/lib/arena/mumbai";
import { CITIES, CLUSTERS, CONTINENTS, STATES } from "@/lib/arena/places";
import { CO2_RAMP } from "./engine/globalLayers";

/* ── Top bar ─────────────────────────────────────────────────────────────── */

export function TopBar() {
  const module = useArena((s) => s.module);
  const setModule = useArena((s) => s.setModule);
  const setSources = useArena((s) => s.setSourcesOpen);
  return (
    <header className="ax-top">
      <div className="ax-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Climactix Global" />
        <div><b>CLIMACTIX GLOBAL</b><span>Climate Arena</span></div>
      </div>
      <nav className="ax-modules" aria-label="Arena modules">
        {MODULES.map((m) => (
          <button key={m.id} className={module === m.id ? "on" : ""} aria-pressed={module === m.id} title={m.hint} onClick={() => setModule(m.id)}>
            {m.label}
          </button>
        ))}
      </nav>
      <div className="ax-top-right">
        <button className="ax-btn ghost" onClick={() => setSources(true)}>Sources &amp; method</button>
        <Link className="ax-btn ghost" href="/console">Terminal</Link>
      </div>
    </header>
  );
}

/* ── Left dock: navigate / layers / view ─────────────────────────────────── */

export function LeftDock() {
  const module = useArena((s) => s.module);
  const [tab, setTab] = useState<"obs" | "nav" | "layers" | "view">("nav");
  useEffect(() => { if (module === "observation") setTab("obs"); }, [module]);
  const open = useArena((s) => s.panelOpen);
  const setOpen = useArena((s) => s.setPanelOpen);
  return (
    <aside className={`ax-dock${open ? "" : " closed"}`} aria-label="Controls">
      <div className="ax-dock-tabs" role="tablist">
        {(["obs", "nav", "layers", "view"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => { setTab(t); setOpen(true); }}>
            {t === "obs" ? "Observe" : t === "nav" ? "Navigate" : t === "layers" ? "Layers" : "View"}
          </button>
        ))}
        <button className="ax-collapse" aria-label={open ? "Collapse panel" : "Expand panel"} onClick={() => setOpen(!open)}>{open ? "‹" : "›"}</button>
      </div>
      {open && (
        <div className="ax-dock-body">
          {tab === "obs" && <ObservationDock />}
          {tab === "nav" && <Navigator />}
          {tab === "layers" && <LayerList />}
          {tab === "view" && <ViewSettings />}
        </div>
      )}
    </aside>
  );
}

function Navigator() {
  const { data, engine } = useArenaCtx();
  const select = useArena((s) => s.select);
  const selection = useArena((s) => s.selection);
  const [q, setQ] = useState("");
  const countries = useMemo(() => (engine?.global.shapes ?? []).map((s) => ({ iso3: s.iso3, name: s.name })).sort((a, b) => a.name.localeCompare(b.name)), [engine, data.countries.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const results = useMemo(() => {
    if (q.trim().length < 2) return [];
    const t = q.toLowerCase();
    const c = countries.filter((x) => x.name.toLowerCase().includes(t)).slice(0, 6).map((x) => ({ key: `c:${x.iso3}`, label: x.name, kind: "Country", go: () => select({ type: "country", iso3: x.iso3, name: x.name }) }));
    const p = [...STATES, ...CITIES, ...CLUSTERS].filter((x) => x.name.toLowerCase().includes(t)).slice(0, 8).map((x) => ({ key: `p:${x.id}`, label: x.name, kind: x.kind === "cluster" ? "Industrial cluster" : x.kind[0].toUpperCase() + x.kind.slice(1), go: () => select({ type: "place", id: x.id }) }));
    return [...p, ...c];
  }, [q, countries, select]);
  const selIso = selection?.type === "country" ? selection.iso3 : null;
  const selPlace = selection?.type === "place" ? selection.id : null;
  const inIndia = selIso === "IND" || (selPlace && (STATES.some((s) => s.id === selPlace) || CITIES.some((c) => c.id === selPlace && c.iso3 === "IND") || CLUSTERS.some((c) => c.id === selPlace)));
  const state = STATES.find((s) => s.id === selPlace) ?? (selPlace ? STATES.find((s) => s.id === CITIES.find((c) => c.id === selPlace)?.parent) : undefined);

  return (
    <div className="ax-stack">
      <input className="ax-in" placeholder="Search country, state, city or cluster" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search places" />
      {results.length > 0 && (
        <ul className="ax-results">
          {results.map((r) => <li key={r.key}><button onClick={() => { r.go(); setQ(""); }}><span>{r.label}</span><em>{r.kind}</em></button></li>)}
        </ul>
      )}
      <button className="ax-btn primary block" onClick={() => select({ type: "place", id: "mumbai" })}>Descend to Mumbai</button>
      <div className="ax-sec">Continents</div>
      <div className="ax-chips">
        {CONTINENTS.map((c) => <button key={c.id} className={selPlace === c.id ? "on" : ""} onClick={() => select({ type: "place", id: c.id })}>{c.name}</button>)}
      </div>
      <div className="ax-sec">Countries</div>
      <div className="ax-chips">
        {["IND", "CHN", "USA", "IDN", "DEU", "BRA", "JPN", "ZAF", "SAU", "GBR"].map((iso) => {
          const c = countries.find((x) => x.iso3 === iso);
          return c ? <button key={iso} className={selIso === iso ? "on" : ""} onClick={() => select({ type: "country", iso3: iso, name: c.name })}>{c.name}</button> : null;
        })}
      </div>
      {inIndia && (
        <>
          <div className="ax-sec">India · States</div>
          <div className="ax-chips">
            {STATES.map((s) => <button key={s.id} className={state?.id === s.id ? "on" : ""} onClick={() => select({ type: "place", id: s.id })}>{s.name}</button>)}
          </div>
        </>
      )}
      {state && (
        <>
          <div className="ax-sec">{state.name} · Cities</div>
          <div className="ax-chips">
            {CITIES.filter((c) => c.parent === state.id).map((c) => <button key={c.id} className={selPlace === c.id ? "on" : ""} onClick={() => select({ type: "place", id: c.id })}>{c.name}{c.arena ? " · 3D" : ""}</button>)}
          </div>
        </>
      )}
      <div className="ax-sec">Mumbai · Industrial clusters</div>
      <ul className="ax-list">
        {CLUSTERS.map((c) => <li key={c.id}><button className={selPlace === c.id ? "on" : ""} onClick={() => select({ type: "place", id: c.id })}>{c.name}</button></li>)}
      </ul>
      <p className="ax-note">Click any country on the globe to select it. The full city environment (buildings, facilities, traffic) is built for Mumbai; other cities fly to imagery and terrain only.</p>
    </div>
  );
}

function LayerList() {
  const layers = useArena((s) => s.layers);
  const times = useArena((s) => s.layerTimes);
  const toggle = useArena((s) => s.toggleLayer);
  const metric = useArena((s) => s.inventoryMetric);
  const setMetric = useArena((s) => s.setInventoryMetric);
  const groups: LayerGroup[] = ["carbon", "temperature", "air", "water", "infrastructure", "context"];
  return (
    <div className="ax-stack">
      {groups.map((g) => (
        <section key={g}>
          <div className="ax-sec">{GROUP_LABEL[g]}</div>
          {LAYERS.filter((l) => l.group === g).map((l) => {
            const on = !!layers[l.id];
            return (
              <div key={l.id} className={`ax-layer${on ? " on" : ""}`}>
                <label>
                  <input type="checkbox" checked={on} onChange={() => toggle(l.id)} />
                  <span>{l.label}</span>
                </label>
                {on && l.kind === "gibs" && <LayerDetail def={l} />}
                {on && l.kind === "vector" && (
                  <div className="ax-layer-detail">
                    {l.id === "co2-countries" && (
                      <>
                        <select className="ax-in sm" value={metric} onChange={(e) => setMetric(e.target.value as InventoryMetric)} aria-label="Inventory metric">
                          {(Object.keys(METRIC_META) as InventoryMetric[]).map((k) => <option key={k} value={k}>{METRIC_META[k].label} ({METRIC_META[k].source})</option>)}
                        </select>
                        <Co2Legend metric={metric} />
                      </>
                    )}
                    {l.id === "co2-plants" && <PlantLegend />}
                    <div className="ax-meta"><b>Measures</b> {l.measures}</div>
                    <div className="ax-meta"><b>Source</b> {l.source}</div>
                    <div className="ax-meta caveat">{l.caveat}</div>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function Co2Legend({ metric }: { metric: InventoryMetric }) {
  const m = METRIC_META[metric];
  return (
    <div className="ax-ramp">
      <div className="bar" style={{ background: `linear-gradient(90deg, ${CO2_RAMP.join(",")})` }} />
      <div className="ticks">{m.log ? <><span>1</span><span>{fmtK(Math.sqrt(m.max))}</span><span>{fmtK(m.max)} {m.unit}</span></> : <><span>0</span><span>{m.max / 2}</span><span>{m.max} {m.unit}</span></>}</div>
      <div className="ax-meta">{m.log ? "Log" : "Linear"} colour scale; extrusion {m.mPerUnit.toLocaleString()} m per {m.unit.replace("/person", "")}{m.unit.includes("person") ? " per person" : ""}. Source: {m.source}.</div>
    </div>
  );
}
const fmtK = (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v)));

function PlantLegend() {
  return (
    <div className="ax-keyrow">
      <span><i style={{ background: "#F2A65A" }} />&lt;1 Mt</span>
      <span><i style={{ background: "#E8743B" }} />1–5 Mt</span>
      <span><i style={{ background: "#D9412B" }} />&gt;5 Mt/yr</span>
    </div>
  );
}

function ViewSettings() {
  const s = useArena();
  const { weather } = useArenaCtx();
  return (
    <div className="ax-stack">
      <div className="ax-sec">Simulation clock</div>
      <div className="ax-seg">
        {[1, 10, 60, 300].map((v) => <button key={v} className={s.timeScale === v ? "on" : ""} onClick={() => s.setTimeScale(v)}>{v === 1 ? "Real time" : `${v}×`}</button>)}
      </div>
      <p className="ax-note">Drives the Sun and the simulated CEON orbits. Observation layers keep their own acquisition dates.</p>
      <div className="ax-sec">Time of day (Mumbai, IST)</div>
      <div className="ax-row">
        <button className={`ax-btn sm${s.hour === null ? " on" : ""}`} onClick={() => s.setHour(null)}>Live clock</button>
        <span className="ax-num">{s.hour === null ? "now" : `${String(Math.floor(s.hour)).padStart(2, "0")}:${String(Math.round((s.hour % 1) * 60)).padStart(2, "0")}`}</span>
      </div>
      <input type="range" min={0} max={23.75} step={0.25} value={s.hour ?? 12} onChange={(e) => s.setHour(Number(e.target.value))} aria-label="Hour of day" />
      <p className="ax-note">Sun position, shadows, night lights (NASA Black Marble) and building windows follow the clock.</p>

      <div className="ax-sec">Buildings</div>
      <div className="ax-seg">
        {(["standard", "provenance"] as const).map((v) => (
          <button key={v} className={s.buildingView === v ? "on" : ""} onClick={() => s.setBuildingView(v)}>
            {v === "standard" ? "Standard" : "Height source"}
          </button>
        ))}
      </div>
      {s.buildingView === "provenance" && (
        <div className="ax-keyrow wrap">
          <span><i style={{ background: "#4089F2" }} />OSM height tag</span>
          <span><i style={{ background: "#52BD75" }} />OSM floor count</span>
          <span><i style={{ background: "#DBA847" }} />GHSL ~90 m cell mean</span>
          <span><i style={{ background: "#999" }} />4 m minimum</span>
        </div>
      )}

      <div className="ax-sec">Current weather, Mumbai (forecast model)</div>
      {weather.data && <p className="ax-note">Open-Meteo, {weather.data.time} local: {weather.data.temperature.toFixed(1)} °C air temperature, rain {weather.data.rain.toFixed(1)} mm/h, cloud {weather.data.cloudCover}%, wind {weather.data.windSpeed.toFixed(1)} m/s. Shown as data; no weather effects are drawn.</p>}
      {weather.error && <p className="ax-note warn">Live weather unavailable ({weather.error}).</p>}

      <div className="ax-sec">Rendering</div>
      <div className="ax-seg">
        {(["auto", "high", "balanced", "low"] as const).map((q) => (
          <button key={q} className={s.quality === q ? "on" : ""} onClick={() => s.setQuality(q)}>{q[0].toUpperCase() + q.slice(1)}</button>
        ))}
      </div>
      <p className="ax-note">Auto renders up to 1.5 pixels per screen point (High: full Retina density) and lowers resolution only after 3 s below 24 fps. Building shadows are off on low-power devices.</p>
    </div>
  );
}

/* ── Bottom bar: camera modes + scenario timeline ────────────────────────── */

const SAT_CAMS: { id: CameraMode; label: string; key: string }[] = [
  { id: "orbit", label: "Orbital view", key: "1" },
  { id: "satfollow", label: "Follow satellite", key: "8" },
  { id: "satview", label: "Sensor view", key: "9" },
];

const CAMS: { id: CameraMode; label: string; key: string }[] = [
  { id: "orbit", label: "Earth orbit", key: "1" },
  { id: "satellite", label: "Satellite", key: "2" },
  { id: "high", label: "High altitude", key: "3" },
  { id: "flight", label: "Cinematic flight", key: "4" },
  { id: "street", label: "Street level", key: "5" },
  { id: "free", label: "Free roam", key: "6" },
  { id: "intel", label: "Intelligence view", key: "7" },
];

export function BottomBar() {
  const { requestCamera } = useArenaCtx();
  const s = useArena();
  const showTimeline = s.module === "futures" || s.module === "twin" || s.module === "simulator";
  const showCams = s.module !== "earth" || s.inCity;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input,textarea,select") || e.metaKey || e.ctrlKey) return;
      const c = [...CAMS, ...SAT_CAMS].find((x) => x.key === e.key);
      if (c && !(s.camera === "street" || s.camera === "free")) requestCamera(c.id);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [requestCamera, s.camera]);
  return (
    <div className="ax-bottom">
      {showTimeline && <Timeline />}
      {s.module === "observation" ? (
        <div className="ax-cams" role="toolbar" aria-label="Observation camera modes">
          {SAT_CAMS.map((c) => (
            <button key={c.id} className={s.camera === c.id ? "on" : ""} aria-pressed={s.camera === c.id} onClick={() => requestCamera(c.id)} title={`Shortcut ${c.key}`}>{c.label}</button>
          ))}
          <button onClick={() => { const p = s.point; if (p) s.select({ type: "place", id: "mumbai" }); s.setModule("city"); }}>Descend to Mumbai</button>
        </div>
      ) : showCams ? (
        <div className="ax-cams" role="toolbar" aria-label="Camera modes">
          {CAMS.map((c) => (
            <button key={c.id} className={s.camera === c.id ? "on" : ""} aria-pressed={s.camera === c.id} onClick={() => requestCamera(c.id)} title={`Shortcut ${c.key}`}>
              {c.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="ax-cams"><button className="on" onClick={() => { s.select({ type: "place", id: "mumbai" }); }}>Descend: India → Maharashtra → Mumbai</button></div>
      )}
    </div>
  );
}

function Timeline() {
  const s = useArena();
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      const S = useArena.getState();
      const i = TIMELINE_YEARS.findIndex((y) => y > S.year);
      if (i === -1) { setPlaying(false); return; }
      S.setYear(TIMELINE_YEARS[i]);
    }, 2200);
    return () => clearInterval(t);
  }, [playing]);
  return (
    <div className="ax-timeline">
      <div className="ax-seg" role="radiogroup" aria-label="Warming scenario">
        {SCENARIOS.map((sc) => (
          <button key={sc.id} role="radio" aria-checked={s.scenario === sc.id} className={s.scenario === sc.id ? "on" : ""} onClick={() => s.setScenario(sc.id)} title={sc.description}>{sc.short}</button>
        ))}
      </div>
      <button className="ax-btn sm" onClick={() => { if (!playing && s.year >= 2100) s.setYear(2026); setPlaying(!playing); }} aria-label={playing ? "Pause" : "Play timeline"}>{playing ? "Pause" : "Play"}</button>
      <div className="ax-years">
        <input type="range" min={2026} max={2100} step={1} value={s.year} onChange={(e) => s.setYear(Number(e.target.value))} aria-label="Year" />
        <div className="ticks">
          {TIMELINE_YEARS.map((y) => (
            <button key={y} className={s.year === y ? "on" : ""} onClick={() => s.setYear(y)}>{y}</button>
          ))}
        </div>
      </div>
      <span className="ax-num year">{s.year}</span>
    </div>
  );
}

/* ── Status, overlays, modal ────────────────────────────────────────────── */

export function StatusBar({ creditsRef }: { creditsRef: RefObject<HTMLDivElement> }) {
  const st = useArena((s) => s.status);
  return (
    <div className="ax-status">
      <div className="line">
        {st.phase === "loading-engine" && <span>Loading 3D engine…</span>}
        {st.phase === "error" && <span className="err">Engine error: {st.error}</span>}
        {st.phase === "ready" && (
          <>
            <span title="Imagery">{st.imagery}</span>
            <span title="Terrain">{st.terrain}</span>
            {st.buildings && <span title="Buildings">{st.buildings}</span>}
            <span className={st.tilesLoading ? "busy" : ""}>{st.tilesLoading ? `Loading ${st.tilesLoading} tiles` : "Tiles ready"}</span>
            <span>{st.fps} fps · {st.resolutionScale.toFixed(2)}× px</span>
          </>
        )}
      </div>
      <div ref={creditsRef} className="ax-credits" />
    </div>
  );
}

export function SwipeDivider() {
  const split = useArena((s) => s.split);
  const setSplit = useArena((s) => s.setSplit);
  const cmp = useArena((s) => s.compare);
  const cmpTime = useArena((s) => s.compareTime);
  const leftTime = useArena((s) => (s.compare ? s.layerTimes[s.compare.id] : undefined));
  const onDown = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => setSplit(ev.clientX / window.innerWidth);
    const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };
  return (
    <div className="ax-swipe" style={{ left: `${split * 100}%` }}>
      <div className="handle" onPointerDown={onDown} role="slider" aria-label="Comparison divider" aria-valuenow={Math.round(split * 100)} tabIndex={0}
        onKeyDown={(e) => { if (e.key === "ArrowLeft") setSplit(split - 0.02); if (e.key === "ArrowRight") setSplit(split + 0.02); }} />
      <span className="tag l">{leftTime ?? "latest"}</span>
      <span className="tag r">{cmpTime ?? cmp?.date}</span>
    </div>
  );
}

export function FlightLabel({ label }: { label: string }) {
  return <div className="ax-flight"><span className="eyebrow">Low-altitude flight</span><b>{label}</b><span className="hint">Esc to stop</span></div>;
}

export function StreetHelp({ mode }: { mode: "street" | "free" }) {
  return (
    <div className="ax-help">
      {mode === "street" ? "Street level · W A S D walk · drag to look · Shift run · Esc exit" : "Free roam · W A S D move · Q / E down / up · drag to look · wheel forward · Shift fast · Esc exit"}
    </div>
  );
}

export function NoWebGL() {
  return (
    <div className="ax-nogl">
      <div>
        <h2>3D view unavailable</h2>
        <p>This browser or device does not provide WebGL, which the Climate Arena needs to render the Earth and city. The intelligence panels on the right still work: scenario impacts, emissions data and the simulator are computed without the 3D view.</p>
      </div>
    </div>
  );
}

export function SourcesModal() {
  const { data } = useArenaCtx();
  const close = useArena((s) => s.setSourcesOpen);
  const ds = data.manifest?.datasets ?? {};
  return (
    <div className="ax-modal" role="dialog" aria-modal="true" aria-label="Sources and methodology" onClick={() => close(false)}>
      <div className="box" onClick={(e) => e.stopPropagation()}>
        <div className="hd"><h2>Sources &amp; methodology</h2><button className="ax-btn ghost" onClick={() => close(false)}>Close</button></div>
        <div className="bd">
          <h3>Bundled datasets</h3>
          <p className="ax-note">Built by <code>scripts/arena/build_arena_data.py</code>{data.manifest ? ` on ${data.manifest.generated}` : ""}. Values are not edited after download.</p>
          <table className="ax-table">
            <thead><tr><th>File</th><th>Source</th><th>Licence</th><th>Kind</th><th>Records</th><th>Retrieved</th></tr></thead>
            <tbody>
              {Object.entries(ds).map(([k, v]) => (
                <tr key={k}><td><code>{k}</code></td><td>{v.source}<div className="ax-meta">{v.note}</div></td><td>{v.licence}</td><td>{v.kind}</td><td className="ax-num">{v.records.toLocaleString()}</td><td>{v.retrieved}</td></tr>
              ))}
            </tbody>
          </table>
          <h3>Climactix Earth Observation Network (CEON)</h3>
          <p className="ax-note">{CONSTELLATION_NOTICE} Swath widths follow from each concept sensor&apos;s field of view and altitude on a spherical Earth; overpass predictions use the same simulated orbits.</p>
          <h3>Animation policy</h3>
          <p className="ax-note">Only camera movement, simulated satellite motion and the passage of time animate. Observation layers are static rasters for the acquisition date shown. There are no particle, smoke, glow or weather effects. Traffic and rail animation in Mumbai is illustrative and off by default.</p>
          <h3>Evidence classes</h3>
          <ul className="ax-ul">
            <li><b>Ground monitors</b> (OpenAQ, including India CPCB stations): real-time readings, shown with their own timestamp; requires OPENAQ_API_KEY on the server.</li>
            <li><b>Model analysis</b> (CAMS via Open-Meteo): hourly ~40 km atmospheric composition; the AQI shown is computed from model concentrations, not measured.</li>
            <li><b>Near-real-time satellite</b> (GIBS LANCE products, Sentinel-5P): typically 3–48 h latency — never labelled live.</li>
            <li><b>Standard satellite products and reanalysis</b>: days to weeks latency; monthly means.</li>
            <li><b>Historical climatologies</b>: static hazard or urban heat datasets.</li>
          </ul>
          <h3>Point readouts</h3>
          <p className="ax-note">Values at a clicked location are decoded from the pixel colour of the GIBS visualisation tile using the product&apos;s published colormap, so they carry the colour-bin quantisation shown (for example a 0.6 K bin). They are not the original science-file values.</p>
          <h3>Live services</h3>
          <ul className="ax-ul">
            <li>NASA GIBS WMTS — satellite and reanalysis rasters; each layer shows the acquisition date GIBS reports.</li>
            <li>Open-Meteo Historical (ERA5 reanalysis, 1981–2024) for local temperature and rainfall baselines; Open-Meteo Forecast for current weather.</li>
            <li>Imagery: NASA Blue Marble, NASA Black Marble 2016, Esri World Imagery (or Cesium ion when a token is configured).</li>
          </ul>
          <h3>Climate science references</h3>
          <ul className="ax-ul">{Object.values(CITE).map((c) => <li key={c.short}><b>{c.short}.</b> {c.full} <a href={c.url} target="_blank" rel="noreferrer">Source</a></li>)}</ul>
          <h3>How scenarios are built</h3>
          <ul className="ax-ul">
            <li>Warming levels are relative to 1850–1900 and are global — not a temperature increase for Mumbai.</li>
            <li>Each scenario follows its closest AR6 illustrative pathway (1.5 °C → SSP1-1.9, 2 °C → SSP1-2.6, 3 °C → SSP2-4.5). Warming by year is interpolated between Table SPM.1 period means.</li>
            <li>Extremes come from Fig. SPM.6 (global land medians at 1, 1.5, 2 and 4 °C). Values between those levels, including 3 °C, are interpolated and flagged.</li>
            <li>Local values for Mumbai apply the global-land change to an ERA5 1981–2010 baseline (≈0.6 °C warming). This is a first-order translation; regional amplification and coastal moderation are not modelled.</li>
            <li>Sea level is global mean, relative to 1995–2014. Local relative sea-level change and inundation mapping need a coastal DEM, which is not yet connected.</li>
          </ul>
          <h3>Exposure index (Industrial Digital Twin)</h3>
          <p className="ax-note">Score = 100 × Σ weight × hazard index × applicability. Weights: heat {EXPOSURE_WEIGHTS.heat}, heavy rainfall {EXPOSURE_WEIGHTS.rain}, sea level {EXPOSURE_WEIGHTS.sea}, water stress {EXPOSURE_WEIGHTS.water}. Hazard indices are normalised by their 4 °C (or SSP5-8.5 2100) values. Screening only — not an asset damage model.</p>
          <h3>Emissions simulator assumptions</h3>
          <ul className="ax-ul">{Object.entries(ASSUMPTIONS).filter(([, v]) => typeof v === "string").map(([k, v]) => <li key={k}>{v as string}</li>)}</ul>
          <h3>Labels used in the interface</h3>
          <ul className="ax-ul">
            <li><span className="ax-prov ax-prov-observed">Observed</span> from a named dataset · <span className="ax-prov ax-prov-projection">Projection</span> published scenario value · <span className="ax-prov ax-prov-interpolated">Interpolated</span> between published values · <span className="ax-prov ax-prov-estimate">Climactix estimate</span> calculation with a stated method · <span className="ax-prov ax-prov-illustrative">Illustrative</span> visual encoding · <span className="ax-prov ax-prov-demo">Demo data</span> placeholder until a disclosure is connected.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
