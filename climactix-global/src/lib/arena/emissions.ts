/**
 * Carbon emissions simulator — transparent lever model.
 *
 * Baseline (BAU): each sector grows at the entity's BAU rate from its base year.
 * Decarbonisation: levers ramp linearly from the base year to full effect in 2050.
 * All coefficients are exported in ASSUMPTIONS and shown in the UI. This is a
 * screening model for comparing directions of travel, not a forecast.
 */
import type { Provenance } from "./science";

export type EntityKind = "country" | "city" | "industry" | "company" | "plant" | "transport";
export type SectorType = "power" | "industry" | "transport" | "buildings" | "process" | "valuechain" | "other";
export type Scope = 1 | 2 | 3;

export interface Sector { id: string; label: string; type: SectorType; mt: number; scope?: Scope }

export interface EmissionEntity {
  id: string;
  kind: EntityKind;
  name: string;
  provenance: Provenance;
  source: string;
  baseYear: number;
  sectors: Sector[];
  bauGrowth: number;          // fraction per year
  bauBasis: string;
  history?: [number, number][];
  revenueUsdM?: number;
  intensity?: { value: number; unit: string; year: number };
  location?: { lat: number; lon: number };
  notes?: string[];
}

export interface Levers {
  renewables: number;       // % of fossil electricity displaced by 2050
  fossilDependency: number; // % of today's non-power fossil fuel use remaining in 2050 (100 = unchanged)
  efficiency: number;       // % per year energy-intensity improvement beyond BAU
  ev: number;               // % of road transport electrified by 2050
  carbonPrice: number;      // USD/tCO2 reached in 2030, held flat thereafter
  target: number;           // % reduction by 2050 vs base year (shown as a target line)
}

export const DEFAULT_LEVERS: Levers = { renewables: 0, fossilDependency: 100, efficiency: 0, ev: 0, carbonPrice: 0, target: 50 };

export const ASSUMPTIONS = {
  adoptionRamp: "Linear from base year to full lever effect in 2050",
  roadShareOfTransport: 0.75,
  evRelativeEmissions: "EV per-km emissions = 0.35 × grid emissions factor relative to the base year (drivetrain efficiency ≈ 3× ICE)",
  evFactor: 0.35,
  carbonPriceResponse: "Additional abatement = 25% × (1 − e^(−price/150)) of residual emissions — illustrative behavioural response, not a marginal abatement cost curve",
  carbonPriceMaxAbatement: 0.25,
  carbonPriceScale: 150,
  carbonCostCoverage: "Carbon cost applied to 100% of Scope 1 emissions, no free allocation",
  processEmissions: "Process CO₂ (e.g. cement calcination) responds only to efficiency and carbon price, not to fuel levers",
  countryAllocation: "Fuel CO₂ allocated to sectors with generic shares (coal 70% power / 30% industry; oil 60% transport / 25% industry / 15% buildings; gas 40% power / 30% industry / 30% buildings). National energy balances are not yet connected.",
} as const;

export interface PathPoint { year: number; baseline: number; scenario: number; target: number | null; carbonCostUsdM: number }

export interface SimResult {
  path: PathPoint[];
  base: number;
  at2030: { baseline: number; scenario: number };
  at2050: { baseline: number; scenario: number };
  cumulative: { baseline: number; scenario: number; avoided: number };
  reductionVsBase2050: number;     // fraction
  targetGap2050: number;           // Mt above target line (negative = on track)
  bySector2050: { id: string; label: string; baseline: number; scenario: number }[];
  carbonCost2030UsdM: number;
  carbonCostCumUsdM: number;
  intensity2050?: { value: number; unit: string };
}

const END = 2050;

export function simulate(e: EmissionEntity, lv: Levers): SimResult {
  const years: number[] = [];
  for (let y = e.baseYear; y <= END; y++) years.push(y);
  const total0 = e.sectors.reduce((a, s) => a + s.mt, 0);
  const path: PathPoint[] = [];
  const sectorAt = (s: Sector, y: number) => {
    const t = y - e.baseYear;
    const r = Math.min(1, Math.max(0, t / (END - e.baseYear)));
    const bau = s.mt * Math.pow(1 + e.bauGrowth, t);
    const eff = Math.pow(1 - lv.efficiency / 100, t);
    const gridRel = 1 - (lv.renewables / 100) * r;
    let f = 1;
    switch (s.type) {
      case "power": f = eff * gridRel; break;
      case "transport": {
        const road = ASSUMPTIONS.roadShareOfTransport;
        const evShare = (lv.ev / 100) * r;
        const fossilNonRoad = 1 - (1 - lv.fossilDependency / 100) * r;
        f = eff * (road * (1 - evShare + evShare * ASSUMPTIONS.evFactor * gridRel) + (1 - road) * fossilNonRoad);
        break;
      }
      case "industry": case "buildings": case "other":
        f = eff * (1 - (1 - lv.fossilDependency / 100) * r); break;
      case "process": f = eff; break;
      case "valuechain": f = eff; break;
    }
    const price = priceAt(lv.carbonPrice, e.baseYear, y);
    const resp = ASSUMPTIONS.carbonPriceMaxAbatement * (1 - Math.exp(-price / ASSUMPTIONS.carbonPriceScale));
    const scenario = bau * f * (s.type === "valuechain" ? 1 : 1 - resp);
    return { bau, scenario, price };
  };
  for (const y of years) {
    let b = 0, sc = 0, cost = 0;
    for (const s of e.sectors) {
      const v = sectorAt(s, y);
      b += v.bau; sc += v.scenario;
      if (s.scope === undefined || s.scope === 1) cost += v.scenario * v.price; // Mt × $/t = $m
    }
    const target = lv.target > 0 ? total0 * (1 - (lv.target / 100) * ((y - e.baseYear) / (END - e.baseYear))) : null;
    path.push({ year: y, baseline: b, scenario: sc, target, carbonCostUsdM: cost });
  }
  const at = (y: number) => path.find((p) => p.year === y) ?? path[path.length - 1];
  const cumB = path.reduce((a, p) => a + p.baseline, 0);
  const cumS = path.reduce((a, p) => a + p.scenario, 0);
  const p2050 = at(END);
  const bySector2050 = e.sectors.map((s) => { const v = sectorAt(s, END); return { id: s.id, label: s.label, baseline: v.bau, scenario: v.scenario }; });
  return {
    path, base: total0,
    at2030: { baseline: at(2030).baseline, scenario: at(2030).scenario },
    at2050: { baseline: p2050.baseline, scenario: p2050.scenario },
    cumulative: { baseline: cumB, scenario: cumS, avoided: cumB - cumS },
    reductionVsBase2050: 1 - p2050.scenario / total0,
    targetGap2050: p2050.target === null ? 0 : p2050.scenario - p2050.target,
    bySector2050,
    carbonCost2030UsdM: at(2030).carbonCostUsdM,
    carbonCostCumUsdM: path.reduce((a, p) => a + p.carbonCostUsdM, 0),
    intensity2050: e.revenueUsdM ? { value: (p2050.scenario * 1e6) / e.revenueUsdM, unit: "tCO₂ per USD m revenue (revenue held flat)" } : undefined,
  };
}

export function priceAt(p2030: number, baseYear: number, y: number): number {
  if (y >= 2030) return p2030;
  const span = Math.max(1, 2030 - baseYear);
  return p2030 * Math.max(0, (y - baseYear) / span);
}

/** Which levers apply to an entity (others are disabled in the UI). */
export function applicableLevers(e: EmissionEntity): Record<keyof Levers, boolean> {
  const types = new Set(e.sectors.map((s) => s.type));
  return {
    renewables: types.has("power"),
    fossilDependency: types.has("industry") || types.has("buildings") || types.has("other") || types.has("transport"),
    efficiency: true,
    ev: types.has("transport"),
    carbonPrice: true,
    target: true,
  };
}

/* ── Entity builders ─────────────────────────────────────────────────────────── */

export interface CountryCo2 {
  iso3: string;
  name: string;
  latest: Record<string, [number, number]>;
  series: { co2?: [number, number][] };
}

function cagr(series: [number, number][] | undefined, years = 10): { g: number; basis: string } {
  if (!series || series.length < years + 1) return { g: 0, basis: "Insufficient history — BAU held flat" };
  const a = series[series.length - 1 - years];
  const b = series[series.length - 1];
  if (a[1] <= 0) return { g: 0, basis: "BAU held flat" };
  const raw = Math.pow(b[1] / a[1], 1 / (b[0] - a[0])) - 1;
  const g = Math.max(-0.03, Math.min(0.05, raw));
  return { g, basis: `Observed ${a[0]}–${b[0]} CAGR ${(raw * 100).toFixed(1)}%/yr${g !== raw ? " (clamped to −3…+5%)" : ""}, held constant` };
}

export function countryEntity(c: CountryCo2): EmissionEntity {
  const L = c.latest;
  const v = (k: string) => (L[k] ? L[k][0] : 0);
  const year = L.co2[1];
  const coal = v("coal_co2"), oil = v("oil_co2"), gas = v("gas_co2"), cement = v("cement_co2");
  const other = Math.max(0, v("co2") - coal - oil - gas - cement);
  const g = cagr(c.series.co2);
  const sectors: Sector[] = [
    { id: "power", label: "Electricity & heat (coal + gas share)", type: "power", mt: 0.7 * coal + 0.4 * gas },
    { id: "industry", label: "Industry fuel combustion", type: "industry", mt: 0.3 * coal + 0.25 * oil + 0.3 * gas },
    { id: "transport", label: "Transport (oil share)", type: "transport", mt: 0.6 * oil },
    { id: "buildings", label: "Buildings (oil + gas share)", type: "buildings", mt: 0.15 * oil + 0.3 * gas },
    { id: "process", label: "Cement process CO₂", type: "process", mt: cement },
    { id: "other", label: "Flaring & other industry", type: "other", mt: other },
  ].filter((s) => s.mt > 0.0005) as Sector[];
  return {
    id: `country:${c.iso3}`, kind: "country", name: c.name, provenance: "observed",
    source: `Global Carbon Project via Our World in Data — ${year} territorial fossil CO₂`,
    baseYear: year, sectors, bauGrowth: g.g, bauBasis: g.basis, history: c.series.co2,
    intensity: L.co2_per_capita ? { value: L.co2_per_capita[0], unit: "tCO₂ per person", year: L.co2_per_capita[1] } : undefined,
    notes: [ASSUMPTIONS.countryAllocation],
  };
}

export function industryEntities(c: CountryCo2): EmissionEntity[] {
  const L = c.latest;
  const year = L.co2[1];
  const out: EmissionEntity[] = [];
  const mk = (key: string, label: string, type: SectorType) => {
    if (!L[key] || L[key][0] <= 0) return;
    out.push({
      id: `industry:${c.iso3}:${key}`, kind: "industry", name: `${c.name} — ${label}`, provenance: "observed",
      source: `Global Carbon Project via Our World in Data — ${L[key][1]}`, baseYear: L[key][1],
      sectors: [{ id: key, label, type, mt: L[key][0] }], bauGrowth: cagr(c.series.co2).g,
      bauBasis: `National ${cagr(c.series.co2).basis.toLowerCase()}`, notes: year !== L[key][1] ? [`Latest year differs from national total (${year}).`] : [],
    });
  };
  mk("cement_co2", "Cement (process CO₂)", "process");
  mk("coal_co2", "Coal combustion (all uses)", "power");
  mk("oil_co2", "Oil combustion (all uses)", "transport");
  mk("gas_co2", "Gas combustion (all uses)", "industry");
  return out;
}

export interface PlantRow {
  id: string; name: string; iso3: string; fuel: string; capacity_mw: number; lat: number; lon: number;
  generation_gwh: number | null; generation_year: number | null; generation_basis: string | null;
  co2_mt_est: number | null; commissioned: number | null; owner: string;
}

export function plantEntity(p: PlantRow): EmissionEntity {
  const basis = p.generation_basis === "reported" ? `reported generation ${p.generation_year}`
    : p.generation_basis === "wri_estimate" ? "WRI-estimated generation 2017" : "default capacity factor";
  return {
    id: `plant:${p.id}`, kind: "plant", name: titleCase(p.name), provenance: "estimate",
    source: `WRI GPPD v1.3 — ${p.capacity_mw} MW ${p.fuel}; CO₂ = ${basis} × fuel emission factor`,
    baseYear: p.generation_year ?? 2019,
    sectors: [{ id: "gen", label: `${p.fuel} generation`, type: "power", mt: p.co2_mt_est ?? 0, scope: 1 }],
    bauGrowth: 0, bauBasis: "Output held at the latest generation year",
    intensity: p.generation_gwh ? { value: ((p.co2_mt_est ?? 0) * 1e6) / (p.generation_gwh * 1000), unit: "tCO₂ per MWh", year: p.generation_year ?? 2017 } : undefined,
    location: { lat: p.lat, lon: p.lon },
    notes: ["Renewables lever = share of this plant's output replaced by renewable generation by 2050."],
  };
}

export function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s(\-/])([a-z])/g, (_, a, b) => a + b.toUpperCase()).replace(/_/g, " ");
}

/** Demonstration entities — synthetic, clearly labelled, for the city/company/transport selectors. */
export const DEMO_ENTITIES: EmissionEntity[] = [
  {
    id: "city:mumbai", kind: "city", name: "Mumbai (city inventory)", provenance: "demo",
    source: "DEMO composition — connect the Mumbai Climate Action Plan GHG inventory (BMC) to replace",
    baseYear: 2024, bauGrowth: 0.02, bauBasis: "Illustrative 2%/yr growth",
    sectors: [
      { id: "elec", label: "Grid electricity consumed", type: "power", mt: 15.8, scope: 2 },
      { id: "road", label: "Road transport", type: "transport", mt: 3.9, scope: 1 },
      { id: "bld", label: "Buildings fuel (LPG, PNG)", type: "buildings", mt: 0.9, scope: 1 },
      { id: "waste", label: "Waste (CH₄ as CO₂e)", type: "other", mt: 2.6, scope: 1 },
    ],
    location: { lat: 19.03, lon: 72.865 },
    notes: ["All values in this entity are placeholders for demonstration."],
  },
  {
    id: "company:konkan-cement", kind: "company", name: "Konkan Cement Ltd (synthetic)", provenance: "demo",
    source: "Synthetic company — not a real entity", baseYear: 2024, bauGrowth: 0.035, bauBasis: "Illustrative 3.5%/yr volume growth",
    revenueUsdM: 1450,
    sectors: [
      { id: "proc", label: "Clinker calcination (Scope 1)", type: "process", mt: 3.1, scope: 1 },
      { id: "kiln", label: "Kiln fuel (Scope 1)", type: "industry", mt: 2.1, scope: 1 },
      { id: "s2", label: "Purchased electricity (Scope 2)", type: "power", mt: 0.42, scope: 2 },
      { id: "s3", label: "Upstream & downstream (Scope 3)", type: "valuechain", mt: 1.1, scope: 3 },
    ],
  },
  {
    id: "company:western-grid", kind: "company", name: "Western Grid Utilities (synthetic)", provenance: "demo",
    source: "Synthetic company — not a real entity", baseYear: 2024, bauGrowth: 0.03, bauBasis: "Illustrative 3%/yr demand growth",
    revenueUsdM: 2900,
    sectors: [
      { id: "coal", label: "Coal generation (Scope 1)", type: "power", mt: 8.6, scope: 1 },
      { id: "gas", label: "Gas generation (Scope 1)", type: "power", mt: 1.2, scope: 1 },
      { id: "fleet", label: "Fleet & site fuel (Scope 1)", type: "transport", mt: 0.05, scope: 1 },
      { id: "s3", label: "Fuel supply chain (Scope 3)", type: "valuechain", mt: 1.6, scope: 3 },
    ],
  },
  {
    id: "transport:mumbai-bus", kind: "transport", name: "Mumbai city bus fleet (illustrative)", provenance: "demo",
    source: "DEMO values — connect operator fleet and fuel data", baseYear: 2024, bauGrowth: 0.01, bauBasis: "Illustrative 1%/yr service growth",
    sectors: [{ id: "bus", label: "Bus diesel & CNG", type: "transport", mt: 0.32, scope: 1 }],
    location: { lat: 19.0, lon: 72.84 },
  },
  {
    id: "transport:mumbai-rail", kind: "transport", name: "Mumbai suburban rail traction (illustrative)", provenance: "demo",
    source: "DEMO values — connect traction energy data", baseYear: 2024, bauGrowth: 0.015, bauBasis: "Illustrative 1.5%/yr",
    sectors: [{ id: "trac", label: "Traction electricity (Scope 2)", type: "power", mt: 0.85, scope: 2 }],
    location: { lat: 19.02, lon: 72.84 },
  },
];
