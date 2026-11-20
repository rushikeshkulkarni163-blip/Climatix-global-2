/**
 * Mumbai digital twin — curated facility attributes, camera viewpoints and the
 * screening-level exposure index.
 *
 * Footprints come from Overture Maps (public/arena/mumbai/facilities.geojson).
 * Attributes here are labelled by provenance:
 *   observed  — from a named public dataset (WRI GPPD for power plants)
 *   estimate  — Climactix calculation with a stated method
 *   demo      — placeholder for a facility-level disclosure not yet connected
 */
import type { Provenance, ScenarioImpacts } from "./science";

export type FacilityKind = "power" | "refinery" | "chemicals" | "port" | "airport" | "shipyard" | "logistics" | "rail";

export interface Facility {
  name: string;              // must match facilities.geojson `name`
  label: string;
  kind: FacilityKind;
  operator: string | null;   // null = not verified from a source in this build
  description: string;
  gppdIds?: string[];        // linked WRI GPPD units
  emissions?: { mtco2: number; provenance: Provenance; basis: string };
  exposure: { coastal: boolean; riverine: boolean; waterIntensive: boolean; outdoorWork: boolean };
}

export const KIND_LABEL: Record<FacilityKind, string> = {
  power: "Thermal power station", refinery: "Petroleum refinery", chemicals: "Fertiliser & chemicals",
  port: "Port", airport: "Airport", shipyard: "Shipyard", logistics: "Logistics terminal", rail: "Rail depot",
};

export const FACILITIES: Facility[] = [
  { name: "Trombay Thermal Power Station", label: "Trombay Thermal Power Station", kind: "power", operator: "Tata Power",
    description: "Coal and gas units on Thane Creek supplying the Mumbai grid.",
    gppdIds: ["IND0000462", "IND0000463", "IND0000464", "IND0000465"],
    exposure: { coastal: true, riverine: false, waterIntensive: true, outdoorWork: true } },
  { name: "Uran", label: "Uran Gas Turbine Power Station", kind: "power", operator: null,
    description: "Gas-fired station at Uran across the harbour.", gppdIds: ["IND0000485"],
    exposure: { coastal: true, riverine: false, waterIntensive: true, outdoorWork: true } },
  { name: "Mumbai Refinery Mahul", label: "Mumbai Refinery, Mahul", kind: "refinery", operator: null,
    description: "Petroleum refinery at Mahul on Thane Creek.",
    emissions: { mtco2: 2.4, provenance: "demo", basis: "Placeholder — connect the operator's BRSR Principle 6 Scope 1 disclosure." },
    exposure: { coastal: true, riverine: false, waterIntensive: true, outdoorWork: true } },
  { name: "Mumbai Refinery", label: "Mumbai Refinery", kind: "refinery", operator: null,
    description: "Petroleum refinery adjoining the Mahul complex.",
    emissions: { mtco2: 2.9, provenance: "demo", basis: "Placeholder — connect the operator's BRSR Principle 6 Scope 1 disclosure." },
    exposure: { coastal: true, riverine: false, waterIntensive: true, outdoorWork: true } },
  { name: "Rashtriya Chemicals & Fertilizers", label: "Rashtriya Chemicals & Fertilizers, Trombay", kind: "chemicals", operator: "Rashtriya Chemicals & Fertilizers Ltd",
    description: "Ammonia, urea and complex fertiliser production.",
    emissions: { mtco2: 1.3, provenance: "demo", basis: "Placeholder — connect the company's BRSR Scope 1 disclosure for the Trombay unit." },
    exposure: { coastal: true, riverine: false, waterIntensive: true, outdoorWork: true } },
  { name: "Mumbai Port Trust", label: "Mumbai Port", kind: "port", operator: "Mumbai Port Authority",
    description: "Historic docks on the eastern waterfront of the island city.",
    emissions: { mtco2: 0.09, provenance: "demo", basis: "Placeholder for port-operations Scope 1+2; vessel emissions excluded." },
    exposure: { coastal: true, riverine: false, waterIntensive: false, outdoorWork: true } },
  { name: "Jawaharlal Nehru Port", label: "Jawaharlal Nehru Port (JNPA)", kind: "port", operator: "Jawaharlal Nehru Port Authority",
    description: "India’s largest container port by volume, at Nhava Sheva.",
    emissions: { mtco2: 0.12, provenance: "demo", basis: "Placeholder for terminal-operations Scope 1+2; vessel emissions excluded." },
    exposure: { coastal: true, riverine: false, waterIntensive: false, outdoorWork: true } },
  { name: "Chhatrapati Shivaji Maharaj International Airport", label: "Chhatrapati Shivaji Maharaj International Airport", kind: "airport", operator: null,
    description: "Mumbai’s primary airport, beside the Mithi River.",
    emissions: { mtco2: 0.06, provenance: "demo", basis: "Placeholder for airport-operator Scope 1+2; aircraft emissions excluded." },
    exposure: { coastal: false, riverine: true, waterIntensive: false, outdoorWork: true } },
  { name: "Navi Mumbai International Airport", label: "Navi Mumbai International Airport", kind: "airport", operator: null,
    description: "New second airport for the metropolitan region.",
    exposure: { coastal: true, riverine: true, waterIntensive: false, outdoorWork: true } },
  { name: "Mazagon Dock Shipbuilders Limited", label: "Mazagon Dock Shipbuilders", kind: "shipyard", operator: "Mazagon Dock Shipbuilders Ltd",
    description: "Naval and commercial shipbuilding yard.",
    exposure: { coastal: true, riverine: false, waterIntensive: false, outdoorWork: true } },
  { name: "Sewri Dockyard", label: "Sewri Dockyard", kind: "shipyard", operator: null, description: "Dockyard on the eastern waterfront.",
    exposure: { coastal: true, riverine: false, waterIntensive: false, outdoorWork: true } },
  { name: "Sassoon Docks", label: "Sassoon Docks", kind: "port", operator: null, description: "Fishing harbour at Colaba.",
    exposure: { coastal: true, riverine: false, waterIntensive: false, outdoorWork: true } },
  { name: "Wadala Truck Terminal", label: "Wadala Truck Terminal", kind: "logistics", operator: null, description: "Road freight terminal.",
    exposure: { coastal: false, riverine: false, waterIntensive: false, outdoorWork: true } },
  { name: "Kurla EMU Carshed", label: "Kurla EMU Car Shed", kind: "rail", operator: null, description: "Suburban rail maintenance depot.",
    exposure: { coastal: false, riverine: true, waterIntensive: false, outdoorWork: true } },
];

export function facilityByName(name: string): Facility | undefined {
  return FACILITIES.find((f) => f.name === name);
}

/* ── Screening-level exposure index ──────────────────────────────────────────── */

export const EXPOSURE_WEIGHTS = { heat: 0.3, rain: 0.3, sea: 0.25, water: 0.15 } as const;

export interface ExposureBreakdown {
  score: number;               // 0–100
  band: "Low" | "Moderate" | "High" | "Very high";
  parts: { key: keyof typeof EXPOSURE_WEIGHTS; label: string; index: number; weight: number; points: number; driver: string }[];
}

/**
 * Exposure = Σ weight × hazard index × applicability.
 * Hazard indices are IPCC AR6 global-land medians normalised by their 4 °C value
 * (sea level by SSP5-8.5 2100 median, 0.77 m). Applicability comes from the
 * facility flags. Screening only — not an asset-level damage model.
 */
export function exposureIndex(f: Facility, imp: ScenarioImpacts): ExposureBreakdown {
  const heatI = Math.min(1, (imp.hot10.freq - 1) / (9.4 - 1));
  const rainI = Math.min(1, imp.rain10.intensity / 30.2);
  const seaI = Math.min(1, Math.max(0, imp.seaLevel.m) / 0.77);
  const waterI = Math.min(1, imp.drought10.intensity / 1.0);
  const e = f.exposure;
  const rows = [
    { key: "heat" as const, label: "Extreme heat", index: heatI, appl: e.outdoorWork ? 1 : 0.6,
      driver: `10-yr hot extreme ${imp.hot10.freq.toFixed(1)}× as frequent, +${imp.hot10.intensity.toFixed(1)} °C` },
    { key: "rain" as const, label: "Heavy rainfall / pluvial flood", index: rainI, appl: e.riverine || e.coastal ? 1 : 0.6,
      driver: `10-yr 1-day rainfall +${imp.rain10.intensity.toFixed(1)} %` },
    { key: "sea" as const, label: "Sea-level rise (coastal)", index: seaI, appl: e.coastal ? 1 : 0,
      driver: e.coastal ? `GMSL +${(imp.seaLevel.m * 100).toFixed(0)} cm vs 1995–2014` : "Not a coastal asset" },
    { key: "water" as const, label: "Water stress (cooling / process)", index: waterI, appl: e.waterIntensive ? 1 : 0.2,
      driver: `Drought intensity +${imp.drought10.intensity.toFixed(2)} s.d. in drying regions` },
  ];
  const parts = rows.map((r) => {
    const w = EXPOSURE_WEIGHTS[r.key];
    return { key: r.key, label: r.label, index: r.index * r.appl, weight: w, points: 100 * w * r.index * r.appl, driver: r.driver };
  });
  const score = parts.reduce((a, p) => a + p.points, 0);
  const band = score < 25 ? "Low" : score < 50 ? "Moderate" : score < 75 ? "High" : "Very high";
  return { score, band, parts };
}

/* ── Camera viewpoints and the cinematic flight path ────────────────────────── */

export interface View { lon: number; lat: number; height: number; heading: number; pitch: number }

export const CITY_VIEWS: Record<"satellite" | "high" | "intel", View> = {
  satellite: { lon: 72.862, lat: 19.005, height: 26_000, heading: 0, pitch: -90 },
  high: { lon: 72.818, lat: 18.872, height: 3_200, heading: 12, pitch: -24 },
  intel: { lon: 72.952, lat: 18.992, height: 2_900, heading: 262, pitch: -27 },
};

/** Low-altitude flight: Nariman Point → Marine Drive → Sea Link → BKC → Trombay → eastern docks. */
export const FLIGHT_PATH: { lon: number; lat: number; height: number; label: string }[] = [
  { lon: 72.8195, lat: 18.912, height: 420, label: "Nariman Point" },
  { lon: 72.8225, lat: 18.944, height: 320, label: "Marine Drive" },
  { lon: 72.8135, lat: 18.989, height: 300, label: "Worli" },
  { lon: 72.8165, lat: 19.036, height: 260, label: "Bandra–Worli Sea Link" },
  { lon: 72.866, lat: 19.064, height: 320, label: "Bandra Kurla Complex" },
  { lon: 72.894, lat: 19.034, height: 380, label: "Chembur" },
  { lon: 72.899, lat: 19.004, height: 420, label: "Trombay power station" },
  { lon: 72.872, lat: 18.976, height: 420, label: "Sewri waterfront" },
  { lon: 72.846, lat: 18.948, height: 380, label: "Mumbai Port" },
];

export const STREET_START = { lon: 72.82235, lat: 18.9432, heading: 196, label: "Marine Drive promenade" };

/** Mumbai coordinates used for the local climate (ERA5) series. */
export const MUMBAI_POINT = { lat: 19.076, lon: 72.8777 };
