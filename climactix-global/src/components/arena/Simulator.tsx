"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useArena } from "./store";
import { useArenaCtx } from "./context";
import { Kpi, Panel } from "./Panels";
import { fmt, Prov } from "./fmt";
import { ASSUMPTIONS, applicableLevers, type EntityKind, type Levers } from "@/lib/arena/emissions";

const KINDS: { id: EntityKind; label: string }[] = [
  { id: "country", label: "Country" }, { id: "city", label: "City" }, { id: "industry", label: "Industry" },
  { id: "company", label: "Company" }, { id: "plant", label: "Power plant" }, { id: "transport", label: "Transport" },
];

const LEVERS: { k: keyof Levers; label: string; min: number; max: number; step: number; unit: string; help: string }[] = [
  { k: "renewables", label: "Renewable energy adoption", min: 0, max: 100, step: 5, unit: "% of fossil power displaced by 2050", help: "Applies to electricity-related emissions (Scope 2 for consumers, generation for utilities and plants)." },
  { k: "fossilDependency", label: "Fossil fuel dependency", min: 0, max: 100, step: 5, unit: "% of today's non-power fossil use left in 2050", help: "100 = unchanged. Lower values model electrification and fuel switching in industry, buildings and non-road transport." },
  { k: "efficiency", label: "Industrial energy efficiency", min: 0, max: 4, step: 0.25, unit: "% per year beyond BAU", help: "Compounding energy-intensity improvement applied to all energy emissions." },
  { k: "ev", label: "Electric vehicle adoption", min: 0, max: 100, step: 5, unit: "% of road transport by 2050", help: "EV emissions follow the grid: 0.35 × grid emission factor relative to today." },
  { k: "carbonPrice", label: "Carbon price", min: 0, max: 300, step: 5, unit: "USD/tCO₂ by 2030", help: "Ramps from zero to the set level in 2030, then flat. Drives an illustrative abatement response and the carbon cost." },
  { k: "target", label: "Reduction target", min: 0, max: 100, step: 5, unit: "% below base year by 2050", help: "Drawn as a straight-line target pathway; the gap shows whether levers meet it." },
];

export function SimulatorPanel() {
  const { entities, entity, sim } = useArenaCtx();
  const s = useArena();
  const [kind, setKind] = useState<EntityKind>(entity?.kind ?? "city");
  const [q, setQ] = useState("");
  const [showA, setShowA] = useState(false);
  const options = useMemo(() => {
    const t = q.toLowerCase();
    const list = entities.filter((e) => e.kind === kind && (!t || e.name.toLowerCase().includes(t)));
    if (kind === "plant" || kind === "country") list.sort((a, b) => b.sectors.reduce((x, y) => x + y.mt, 0) - a.sectors.reduce((x, y) => x + y.mt, 0));
    return list.slice(0, 60);
  }, [entities, kind, q]);
  const appl = entity ? applicableLevers(entity) : null;
  const y = Math.min(2050, Math.max(entity?.baseYear ?? 2024, s.year));
  const pt = sim?.path.find((p) => p.year === y);

  return (
    <Panel eyebrow="Scenario Simulator · carbon emissions" title="Baseline vs decarbonisation">
      <div className="ax-seg wrap" role="tablist">
        {KINDS.map((k) => <button key={k.id} className={kind === k.id ? "on" : ""} onClick={() => { setKind(k.id); setQ(""); }}>{k.label}</button>)}
      </div>
      {(kind === "plant" || kind === "country") && <input className="ax-in" placeholder={`Search ${kind === "plant" ? "power plants" : "countries"}`} value={q} onChange={(e) => setQ(e.target.value)} />}
      <select className="ax-in" value={entity?.kind === kind ? entity.id : ""} onChange={(e) => s.setEntity(e.target.value)} aria-label="Entity">
        <option value="" disabled>Select {KINDS.find((k) => k.id === kind)?.label.toLowerCase()}…</option>
        {options.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
      {kind === "industry" && <p className="ax-note">Industries are the fuel and cement splits of the country selected on the globe (India by default).</p>}

      {entity && sim && (
        <>
          <div className="ax-entity">
            <Prov p={entity.provenance} /> <span className="ax-meta">{entity.source}</span>
          </div>
          <div className="ax-kpis three">
            <Kpi label={`Base ${entity.baseYear}`} value={fmt.mt(sim.base)} unit="MtCO₂" note={entity.intensity ? `${entity.intensity.value.toFixed(2)} ${entity.intensity.unit}` : undefined} />
            <Kpi label={`2050 scenario`} value={fmt.mt(sim.at2050.scenario)} unit="Mt" note={`BAU ${fmt.mt(sim.at2050.baseline)} Mt · ${sim.reductionVsBase2050 >= 0 ? "−" : "+"}${fmt.pct(Math.abs(sim.reductionVsBase2050))} vs base`} />
            <Kpi label="Avoided to 2050" value={fmt.mt(sim.cumulative.avoided)} unit="MtCO₂" note={`cumulative vs BAU (${fmt.mt(sim.cumulative.baseline)} Mt)`} />
          </div>
          <div className="ax-chart">
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={sim.path} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="#1C222B" vertical={false} />
                <XAxis dataKey="year" stroke="#5B6370" fontSize={10} tickLine={false} interval={4} />
                <YAxis stroke="#5B6370" fontSize={10} tickLine={false} width={46} tickFormatter={(v: number) => fmt.mt(v)} />
                <Tooltip contentStyle={{ background: "#0E1217", border: "1px solid #2A303A", borderRadius: 8, fontSize: 12 }} formatter={(v: number, k: string) => [`${fmt.mt(v)} Mt`, k === "baseline" ? "Baseline (BAU)" : k === "scenario" ? "Decarbonisation" : "Target"]} />
                <Legend wrapperStyle={{ fontSize: 11 }} formatter={(k: string) => (k === "baseline" ? "Baseline (BAU)" : k === "scenario" ? "Decarbonisation" : "Target")} />
                <ReferenceLine x={y} stroke="#9DB8EA" strokeDasharray="3 3" />
                <Line dataKey="baseline" stroke="#8A919C" dot={false} strokeWidth={1.6} isAnimationActive={false} />
                <Line dataKey="scenario" stroke="#5B8DEF" dot={false} strokeWidth={2.2} isAnimationActive={false} />
                <Line dataKey="target" stroke="#1E8E3E" dot={false} strokeDasharray="5 4" strokeWidth={1.4} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="ax-row between">
            <span className="ax-meta">Timeline year {y}{s.year > 2050 ? " (simulator ends 2050)" : ""}: {pt ? `${fmt.mt(pt.scenario)} Mt vs ${fmt.mt(pt.baseline)} Mt BAU` : ""}</span>
            <span className={`ax-meta ${sim.targetGap2050 > 0 ? "warn" : "ok"}`}>{s.levers.target ? (sim.targetGap2050 > 0 ? `2050 gap to target: ${fmt.mt(sim.targetGap2050)} Mt` : "2050 target met") : ""}</span>
          </div>

          <div className="ax-levers">
            {LEVERS.map((l) => {
              const ok = appl?.[l.k] ?? true;
              return (
                <div key={l.k} className={`ax-lever${ok ? "" : " off"}`} title={ok ? l.help : "Not applicable to this entity's emission sources"}>
                  <div className="ax-row between"><span>{l.label}</span><b className="ax-num">{s.levers[l.k]}{l.k === "carbonPrice" ? " $" : l.k === "efficiency" ? " %/yr" : " %"}</b></div>
                  <input type="range" min={l.min} max={l.max} step={l.step} value={s.levers[l.k]} disabled={!ok} onChange={(e) => s.setLever(l.k, Number(e.target.value))} aria-label={l.label} />
                  <div className="ax-meta">{l.unit}</div>
                </div>
              );
            })}
            <button className="ax-btn ghost sm" onClick={s.resetLevers}>Reset to baseline</button>
          </div>

          <div className="ax-sec">2050 by source</div>
          <table className="ax-table compact">
            <thead><tr><th>Source</th><th className="r">BAU</th><th className="r">Scenario</th><th className="r">Δ</th></tr></thead>
            <tbody>
              {sim.bySector2050.map((r) => (
                <tr key={r.id}><td>{r.label}</td><td className="r ax-num">{fmt.mt(r.baseline)}</td><td className="r ax-num">{fmt.mt(r.scenario)}</td><td className="r ax-num">{fmt.pct(r.baseline ? r.scenario / r.baseline - 1 : 0)}</td></tr>
              ))}
            </tbody>
          </table>

          <div className="ax-fin">
            <div className="ax-sec">Financial view</div>
            <div className="ax-kpis">
              <Kpi label="Carbon cost 2030" value={fmt.usdM(sim.carbonCost2030UsdM)} unit="/ yr" note="Scope 1 × price, no free allocation" />
              <Kpi label="Cumulative carbon cost to 2050" value={fmt.usdM(sim.carbonCostCumUsdM)} note={sim.intensity2050 ? `2050 intensity ${sim.intensity2050.value.toFixed(0)} ${sim.intensity2050.unit}` : "Undiscounted, real USD"} />
            </div>
          </div>

          <div className="ax-sec">In the 3D view</div>
          <p className="ax-note">
            {entity.kind === "plant" && "The plant's emission column shows the simulated value for the timeline year."}
            {entity.kind === "country" && "The country's extrusion shows the simulated value for the timeline year (switch on the country layer)."}
            {(entity.id === "city:mumbai" || entity.id.startsWith("transport:mumbai")) && "Mumbai's facility streams scale with the simulated emissions."}
            {" "}Rooftop solar on Mumbai buildings scales with the renewables lever, and blue vehicles show the EV share for the timeline year <span className="ax-prov ax-prov-illustrative">Illustrative</span>.
          </p>

          <button className="ax-btn ghost sm" onClick={() => setShowA(!showA)}>{showA ? "Hide" : "Show"} model assumptions</button>
          {showA && (
            <ul className="ax-ul small">
              <li>BAU: {entity.bauBasis}.</li>
              {entity.notes?.map((n) => <li key={n}>{n}</li>)}
              {Object.entries(ASSUMPTIONS).filter(([, v]) => typeof v === "string").map(([k, v]) => <li key={k}>{v as string}</li>)}
            </ul>
          )}
        </>
      )}
    </Panel>
  );
}
