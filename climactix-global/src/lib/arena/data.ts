/**
 * Data access for the Climate Arena.
 *
 * `ArenaDataSource` is the seam between the UI and where data lives. The
 * default implementation reads the static files produced by
 * scripts/arena/build_arena_data.py and calls Open-Meteo directly for
 * location-specific series. A server implementation (PostGIS / FastAPI) can
 * replace it without touching components — see docs/CLIMATE_ARENA.md.
 */
import type { CountryCo2, PlantRow } from "./emissions";

export interface DatasetMeta {
  source: string; licence: string; url: string; kind: string; retrieved: string; records: number; note: string;
}
export interface Manifest { generated: string; datasets: Record<string, DatasetMeta> }

export interface Airport { code: string; name: string; iso2: string; lat: number; lon: number }
export interface Port { name: string; lat: number; lon: number; scalerank: number }

export interface Era5Summary {
  lat: number; lon: number;
  fetchedAt: string;
  years: number[];
  annualMeanTmax: number[];
  annualMaxTmax: number[];
  annualMaxPrecip: number[];
  baseline: { meanTmax: number; maxTmax: number; p90MaxTmax: number; maxPrecip: number; daysAbove35: number };
  recent: { period: string; meanTmax: number; daysAbove35: number };
  trendPerDecade: number;
}

export interface CurrentWeather {
  time: string; temperature: number; precipitation: number; rain: number; cloudCover: number; isDay: boolean; weatherCode: number; windSpeed: number; windDir: number;
}

export interface SectorInventory {
  unit: string; gas: string; sectors: string[];
  countries: { iso3: string; name: string; sectors: Record<string, [number, number][]> }[];
}

/** CAMS global atmospheric composition (model analysis/forecast) via Open-Meteo. */
export interface AirQualityModel {
  time: string; lat: number; lon: number;
  values: Record<string, number | null>;
  units: Record<string, string>;
}

export interface GroundStation {
  id: number; name: string; locality: string | null; provider: string | null; owner: string | null;
  lat: number; lon: number; distanceM: number | null; lastUpdated: string | null;
  readings: { parameter: string; label: string; units: string; value: number; utc: string }[];
}
export interface GroundNetwork { configured: boolean; stations: GroundStation[]; message?: string; fetched?: string }

export interface ArenaDataSource {
  manifest(): Promise<Manifest>;
  countries(): Promise<CountryCo2[]>;
  countryShapes(): Promise<GeoJSON.FeatureCollection>;
  powerPlants(): Promise<{ rows: PlantRow[]; emissionFactors: Record<string, number> }>;
  airports(): Promise<Airport[]>;
  ports(): Promise<Port[]>;
  gistemp(): Promise<{ baseline: string; rows: [number, number][] }>;
  mumbaiFacilities(): Promise<GeoJSON.FeatureCollection>;
  mumbaiTransport(): Promise<{ roads: { c: string; n: string | null; p: [number, number][] }[]; rail: { c: string; n: string | null; p: [number, number][] }[] }>;
  era5(lat: number, lon: number): Promise<Era5Summary>;
  currentWeather(lat: number, lon: number): Promise<CurrentWeather>;
  sectorInventory(): Promise<SectorInventory>;
  mumbaiWater(): Promise<GeoJSON.FeatureCollection>;
  airQualityModel(lat: number, lon: number): Promise<AirQualityModel>;
  groundStations(lat: number, lon: number): Promise<GroundNetwork>;
}

const BASE = process.env.NEXT_PUBLIC_ARENA_DATA_URL || "/arena";
const cache = new Map<string, Promise<unknown>>();

function getJSON<T>(path: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${BASE}/${path}`;
  if (!cache.has(url)) {
    cache.set(url, fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${r.status} loading ${url}`);
      return r.json();
    }).catch((e) => { cache.delete(url); throw e; }));
  }
  return cache.get(url) as Promise<T>;
}

function rowsToObjects<T>(d: { fields: string[]; rows: unknown[][] }): T[] {
  return d.rows.map((r) => Object.fromEntries(d.fields.map((f, i) => [f, r[i]])) as T);
}

function sessionGet<T>(key: string): T | null {
  try { const v = sessionStorage.getItem(key); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
}
function sessionSet(key: string, v: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(v)); } catch { /* storage unavailable */ }
}

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

export const staticSource: ArenaDataSource = {
  manifest: () => getJSON<Manifest>("manifest.json"),
  countries: () => getJSON<CountryCo2[]>("data/countries-co2.json"),
  countryShapes: () => getJSON<GeoJSON.FeatureCollection>("data/countries.geojson"),
  powerPlants: async () => {
    const d = await getJSON<{ fields: string[]; rows: unknown[][]; emission_factors_t_per_mwh: Record<string, number> }>("data/power-plants.json");
    return { rows: rowsToObjects<PlantRow>(d), emissionFactors: d.emission_factors_t_per_mwh };
  },
  airports: async () => rowsToObjects<Airport>(await getJSON("data/airports.json")),
  ports: async () => rowsToObjects<Port>(await getJSON("data/ports.json")),
  gistemp: () => getJSON("data/gistemp-global.json"),
  mumbaiFacilities: () => getJSON("mumbai/facilities.geojson"),
  mumbaiTransport: () => getJSON("mumbai/transport.json"),
  sectorInventory: () => getJSON("data/sector-inventory.json"),
  mumbaiWater: () => getJSON("mumbai/water.geojson"),

  async airQualityModel(lat, lon) {
    const vars = "us_aqi,pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,carbon_monoxide";
    const r = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=${vars}&timezone=auto&domains=cams_global`);
    if (!r.ok) throw new Error(`Open-Meteo air quality ${r.status}`);
    const d = await r.json() as { latitude: number; longitude: number; current: Record<string, number | string | null>; current_units: Record<string, string> };
    const values: Record<string, number | null> = {};
    for (const k of vars.split(",")) values[k] = typeof d.current[k] === "number" ? (d.current[k] as number) : null;
    return { time: String(d.current.time), lat: d.latitude, lon: d.longitude, values, units: d.current_units };
  },

  async groundStations(lat, lon) {
    const r = await fetch(`/api/arena/openaq?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`);
    const d = await r.json() as GroundNetwork;
    return d;
  },

  async era5(lat, lon) {
    const key = `cx-arena-era5:${lat.toFixed(3)},${lon.toFixed(3)}`;
    const hit = sessionGet<Era5Summary>(key);
    if (hit) return hit;
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
      `&start_date=1981-01-01&end_date=2024-12-31&daily=temperature_2m_max,precipitation_sum&timezone=auto`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Open-Meteo archive ${r.status}`);
    const d = await r.json() as { daily: { time: string[]; temperature_2m_max: (number | null)[]; precipitation_sum: (number | null)[] } };
    const byYear = new Map<number, { t: number[]; p: number[] }>();
    d.daily.time.forEach((t, i) => {
      const y = Number(t.slice(0, 4));
      const e = byYear.get(y) ?? { t: [], p: [] };
      const tv = d.daily.temperature_2m_max[i]; const pv = d.daily.precipitation_sum[i];
      if (tv !== null) e.t.push(tv);
      if (pv !== null) e.p.push(pv);
      byYear.set(y, e);
    });
    const years = Array.from(byYear.keys()).sort();
    const annualMeanTmax = years.map((y) => mean(byYear.get(y)!.t));
    const annualMaxTmax = years.map((y) => Math.max(...byYear.get(y)!.t));
    const annualMaxPrecip = years.map((y) => Math.max(...byYear.get(y)!.p));
    const days35 = years.map((y) => byYear.get(y)!.t.filter((v) => v > 35).length);
    const bi = years.map((y, i) => (y >= 1981 && y <= 2010 ? i : -1)).filter((i) => i >= 0);
    const ri = years.map((y, i) => (y >= 2015 ? i : -1)).filter((i) => i >= 0);
    const sortedMax = bi.map((i) => annualMaxTmax[i]).sort((a, b) => a - b);
    // least-squares trend of annual mean Tmax
    const xm = mean(years), ym = mean(annualMeanTmax);
    const slope = years.reduce((a, x, i) => a + (x - xm) * (annualMeanTmax[i] - ym), 0) / years.reduce((a, x) => a + (x - xm) ** 2, 0);
    const out: Era5Summary = {
      lat, lon, fetchedAt: new Date().toISOString(), years, annualMeanTmax, annualMaxTmax, annualMaxPrecip,
      baseline: {
        meanTmax: mean(bi.map((i) => annualMeanTmax[i])),
        maxTmax: mean(bi.map((i) => annualMaxTmax[i])),
        p90MaxTmax: sortedMax[Math.floor(0.9 * (sortedMax.length - 1))],
        maxPrecip: mean(bi.map((i) => annualMaxPrecip[i])),
        daysAbove35: mean(bi.map((i) => days35[i])),
      },
      recent: { period: `2015–${years[years.length - 1]}`, meanTmax: mean(ri.map((i) => annualMeanTmax[i])), daysAbove35: mean(ri.map((i) => days35[i])) },
      trendPerDecade: slope * 10,
    };
    sessionSet(key, out);
    return out;
  },

  async currentWeather(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,precipitation,rain,cloud_cover,is_day,weather_code,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=auto`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Open-Meteo forecast ${r.status}`);
    const d = await r.json() as { current: { time: string; temperature_2m: number; precipitation: number; rain: number; cloud_cover: number; is_day: number; weather_code: number; wind_speed_10m: number; wind_direction_10m: number } };
    const c = d.current;
    return { time: c.time, temperature: c.temperature_2m, precipitation: c.precipitation, rain: c.rain, cloudCover: c.cloud_cover, isDay: c.is_day === 1, weatherCode: c.weather_code, windSpeed: c.wind_speed_10m, windDir: c.wind_direction_10m };
  },
};

export const arenaData: ArenaDataSource = staticSource;
