/**
 * Climactix Earth Observation Network (CEON) — VIRTUAL mission concepts.
 *
 * Climactix does not own or operate satellites. These four missions are
 * proposed mission identities. Their orbits are simulated with a circular
 * sun-synchronous model; positions are computed, not telemetry. The data shown
 * on the globe comes from real missions (NASA, ESA/Copernicus) named per layer.
 *
 * Orbit model: circular orbit, inclination from the sun-synchronous condition,
 * right ascension of the ascending node fixed to the mission's local time of
 * ascending node (LTAN) relative to the mean Sun, so J2 nodal precession is
 * represented implicitly. Earth rotation by GMST (IAU 1982). Accuracy is a few
 * kilometres to tens of kilometres — adequate for visualising coverage, not for
 * tasking real spacecraft.
 */

export type ObsCategory = "carbon" | "thermal" | "air" | "vegetation" | "water" | "flood";

export interface Mission {
  id: string;
  code: string;
  name: string;
  category: ObsCategory;
  color: string;
  model: string;
  purpose: string[];
  altitudeKm: number;
  ltanHours: number;     // local time of ascending node
  phaseDeg: number;      // argument of latitude at epoch
  sensor: {
    name: string;
    type: string;
    bands: string;
    halfAngleDeg: number; // cross-track half field of view (off-nadir)
    gsdM: number;         // ground sample distance at nadir
  };
  /** Real data products (layer ids in layers.ts) this mission concept would deliver. */
  products: string[];
  analogues: string;
}

export const RE_KM = 6378.137;
const MU = 398600.4418;
const EPOCH = Date.UTC(2026, 0, 1, 0, 0, 0);

export const MISSIONS: Mission[] = [
  {
    id: "ceon-01", code: "CEON-01", name: "Carbon Observation", category: "carbon", color: "#E07A3F", model: "/arena/models/ceon-01.glb",
    purpose: ["Atmospheric CO₂ column concentration", "Methane concentration where supported", "Emission hotspot localisation (with inventories)", "Regional carbon trends"],
    altitudeKm: 705, ltanHours: 13.5, phaseDeg: 0,
    sensor: { name: "Three-channel SWIR/NIR grating spectrometer", type: "Passive imaging spectrometer", bands: "O₂ A-band 0.76 µm · weak CO₂ 1.61 µm · strong CO₂ 2.06 µm · CH₄ 2.3 µm", halfAngleDeg: 15, gsdM: 2000 },
    products: ["xco2", "ch4", "co-airs"], analogues: "OCO-2/3 (NASA), Sentinel-5P TROPOMI CH₄ (ESA), CO2M (Copernicus, planned)",
  },
  {
    id: "ceon-02", code: "CEON-02", name: "Thermal Intelligence", category: "thermal", color: "#D9472B", model: "/arena/models/ceon-02.glb",
    purpose: ["Land surface temperature", "Urban heat islands", "Industrial thermal hotspots", "Surface heat exposure and change over time"],
    altitudeKm: 680, ltanHours: 10.5, phaseDeg: 120,
    sensor: { name: "Cryo-cooled thermal-infrared push-broom imager", type: "Passive TIR radiometer", bands: "8.6 · 10.6 · 12.0 µm (split-window)", halfAngleDeg: 7.5, gsdM: 70 },
    products: ["lst-monthly", "lst-8day", "lst-day", "uhi-day", "airtemp", "sst-anom"], analogues: "Landsat 8/9 TIRS, ECOSTRESS, MODIS (NASA); LSTM (Copernicus, planned)",
  },
  {
    id: "ceon-03", code: "CEON-03", name: "Atmospheric Intelligence", category: "air", color: "#7E8FD8", model: "/arena/models/ceon-03.glb",
    purpose: ["Tropospheric NO₂, SO₂ and ozone", "Aerosol and particulate proxies", "Pollution concentration hotspots", "Regional air-quality trends"],
    altitudeKm: 824, ltanHours: 13.5, phaseDeg: 200,
    sensor: { name: "UV–VIS–NIR–SWIR push-broom spectrometer", type: "Passive hyperspectral sounder", bands: "270–500 nm · 675–775 nm · 2.3 µm", halfAngleDeg: 54, gsdM: 5500 },
    products: ["no2", "so2", "o3", "aod", "pm25-dust"], analogues: "Sentinel-5P TROPOMI (ESA), OMI / OMPS (NASA/NOAA), TEMPO (NASA, geostationary)",
  },
  {
    id: "ceon-04", code: "CEON-04", name: "Climate & Environment", category: "vegetation", color: "#4E9A5F", model: "/arena/models/ceon-04.glb",
    purpose: ["Vegetation health", "Land-use and forest-cover change", "Water stress (soil moisture)", "Flood exposure and extent"],
    altitudeKm: 786, ltanHours: 10.5, phaseDeg: 300,
    sensor: { name: "13-band VNIR/SWIR multispectral push-broom imager", type: "Passive multispectral imager", bands: "443–2190 nm, 13 bands", halfAngleDeg: 10.3, gsdM: 10 },
    products: ["ndvi-monthly", "ndvi", "soil-moisture", "drought-hazard", "flood-now", "flood-hazard"], analogues: "Sentinel-2 (ESA), Landsat 8/9 OLI, MODIS, SMAP (NASA)",
  },
];

export function mission(id: string): Mission | undefined {
  return MISSIONS.find((m) => m.id === id);
}

/* ── orbital mechanics ───────────────────────────────────────────────────── */

const D2R = Math.PI / 180;

export function semiMajorKm(m: Mission) { return RE_KM + m.altitudeKm; }
export function periodMin(m: Mission) { return (2 * Math.PI * Math.sqrt(semiMajorKm(m) ** 3 / MU)) / 60; }
/** Sun-synchronous inclination: cos i = −(a / 12352 km)^(7/2). */
export function inclinationDeg(m: Mission) { return Math.acos(-Math.pow(semiMajorKm(m) / 12352, 3.5)) / D2R; }

/** Swath width from cross-track half-angle on a spherical Earth (limited by the horizon). */
export function swathKm(m: Mission) {
  const eta = m.sensor.halfAngleDeg * D2R;
  const s = ((RE_KM + m.altitudeKm) / RE_KM) * Math.sin(eta);
  const lambda = s >= 1 ? Math.acos(RE_KM / (RE_KM + m.altitudeKm)) : Math.asin(s) - eta;
  return 2 * RE_KM * lambda;
}

function julian(ms: number) { return ms / 86_400_000 + 2440587.5; }
function gmstRad(ms: number) {
  const d = julian(ms) - 2451545.0;
  return (((280.46061837 + 360.98564736629 * d) % 360) + 360) % 360 * D2R;
}
/** Low-precision solar right ascension (≈0.01°). */
function sunRA(ms: number) {
  const n = julian(ms) - 2451545.0;
  const L = (280.46 + 0.9856474 * n) * D2R;
  const g = (357.528 + 0.9856003 * n) * D2R;
  const lam = L + (1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * D2R;
  const eps = (23.439 - 0.0000004 * n) * D2R;
  return Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
}

export interface SatState {
  /** Earth-fixed position, metres. */
  ecef: [number, number, number];
  lat: number; lon: number; altKm: number;
  /** Earth-fixed velocity, m/s (finite difference). */
  vel: [number, number, number];
  speedKms: number;
  ascending: boolean;
}

function ecefAt(m: Mission, ms: number): [number, number, number] {
  const a = semiMajorKm(m) * 1000;
  const inc = inclinationDeg(m) * D2R;
  const raan = sunRA(ms) + (m.ltanHours - 12) * 15 * D2R;
  const n = (2 * Math.PI) / (periodMin(m) * 60);
  const u = m.phaseDeg * D2R + n * ((ms - EPOCH) / 1000);
  const cu = Math.cos(u), su = Math.sin(u), cO = Math.cos(raan), sO = Math.sin(raan), ci = Math.cos(inc), si = Math.sin(inc);
  const x = a * (cO * cu - sO * su * ci);
  const y = a * (sO * cu + cO * su * ci);
  const z = a * (su * si);
  const th = gmstRad(ms);
  return [Math.cos(th) * x + Math.sin(th) * y, -Math.sin(th) * x + Math.cos(th) * y, z];
}

export function stateAt(m: Mission, ms: number): SatState {
  const p = ecefAt(m, ms);
  const p2 = ecefAt(m, ms + 1000);
  const vel: [number, number, number] = [p2[0] - p[0], p2[1] - p[1], p2[2] - p[2]];
  const r = Math.hypot(p[0], p[1], p[2]);
  return {
    ecef: p, vel, speedKms: Math.hypot(...vel) / 1000,
    lat: Math.asin(p[2] / r) / D2R, lon: Math.atan2(p[1], p[0]) / D2R, altKm: r / 1000 - RE_KM,
    ascending: vel[2] > 0,
  };
}

/** Sub-satellite ground track sampled every `stepS` seconds over [t0, t1]. */
export function groundTrack(m: Mission, t0: number, t1: number, stepS = 30): { lat: number; lon: number; t: number }[] {
  const out = [];
  for (let t = t0; t <= t1; t += stepS * 1000) { const s = stateAt(m, t); out.push({ lat: s.lat, lon: s.lon, t }); }
  return out;
}

export function greatCircleKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const p1 = lat1 * D2R, p2 = lat2 * D2R, dl = (lon2 - lon1) * D2R;
  const c = Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl);
  return RE_KM * Math.acos(Math.max(-1, Math.min(1, c)));
}

/** Next time the target falls inside the swath (searches `days`, 20 s steps). Daylight passes only when `dayOnly`. */
export function nextPass(m: Mission, lat: number, lon: number, fromMs: number, dayOnly = true, days = 16): { t: number; offsetKm: number } | null {
  const half = swathKm(m) / 2;
  let best: { t: number; offsetKm: number } | null = null;
  for (let t = fromMs; t < fromMs + days * 86_400_000; t += 20_000) {
    const s = stateAt(m, t);
    const d = greatCircleKm(s.lat, s.lon, lat, lon);
    if (d <= half) {
      const daylight = isDaylight(s.lon, t);
      if (dayOnly && !daylight) continue;
      if (!best || d < best.offsetKm) best = { t, offsetKm: d };
      // refine within this overpass (next ~3 minutes) then stop
      if (best && t - best.t > 180_000) break;
    } else if (best) break;
  }
  return best;
}

/** The orbit ellipse at one instant (inertial orbit drawn in the current Earth-fixed frame), metres. */
export function orbitRing(m: Mission, ms: number, samples = 160): [number, number, number][] {
  const a = semiMajorKm(m) * 1000;
  const inc = inclinationDeg(m) * D2R;
  const raan = sunRA(ms) + (m.ltanHours - 12) * 15 * D2R;
  const th = gmstRad(ms);
  const cO = Math.cos(raan), sO = Math.sin(raan), ci = Math.cos(inc), si = Math.sin(inc);
  const out: [number, number, number][] = [];
  for (let k = 0; k <= samples; k++) {
    const u = (2 * Math.PI * k) / samples;
    const cu = Math.cos(u), su = Math.sin(u);
    const x = a * (cO * cu - sO * su * ci), y = a * (sO * cu + cO * su * ci), z = a * su * si;
    out.push([Math.cos(th) * x + Math.sin(th) * y, -Math.sin(th) * x + Math.cos(th) * y, z]);
  }
  return out;
}

/** Initial bearing (degrees from north) of the ground track at time ms. */
export function trackBearing(m: Mission, ms: number): number {
  const a = stateAt(m, ms), b = stateAt(m, ms + 5000);
  const p1 = a.lat * D2R, p2 = b.lat * D2R, dl = (b.lon - a.lon) * D2R;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) / D2R + 360) % 360;
}

/** Great-circle destination from (lat, lon) along a bearing for a distance in km. */
export function destination(lat: number, lon: number, bearingDeg: number, km: number): { lat: number; lon: number } {
  const d = km / RE_KM, b = bearingDeg * D2R, p1 = lat * D2R, l1 = lon * D2R;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return { lat: p2 / D2R, lon: ((l2 / D2R + 540) % 360) - 180 };
}

/** Local mean solar time at a longitude, hours. */
export function localSolarHours(lon: number, ms: number) {
  const d = new Date(ms);
  const utc = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  return (((utc + lon / 15) % 24) + 24) % 24;
}
export function isDaylight(lon: number, ms: number) {
  const h = localSolarHours(lon, ms);
  return h > 6 && h < 18;
}

export const CONSTELLATION_NOTICE =
  "CEON satellites are virtual Climactix mission concepts. Climactix does not own or operate spacecraft. " +
  "Orbits are simulated (circular sun-synchronous model); positions are not telemetry. Observation layers come from the real missions named on each layer.";
