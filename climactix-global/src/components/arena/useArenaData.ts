"use client";

import { useEffect, useMemo, useState } from "react";
import { arenaData, type CurrentWeather, type Era5Summary, type Manifest } from "@/lib/arena/data";
import {
  DEMO_ENTITIES, countryEntity, industryEntities, plantEntity,
  type CountryCo2, type EmissionEntity, type PlantRow,
} from "@/lib/arena/emissions";
import { FACILITIES } from "@/lib/arena/mumbai";
import type { Provenance } from "@/lib/arena/science";

export interface ArenaDataset {
  manifest: Manifest | null;
  countries: CountryCo2[];
  plants: PlantRow[];
  gistemp: [number, number][];
  error: string | null;
}

let shared: Promise<ArenaDataset> | null = null;

function loadAll(): Promise<ArenaDataset> {
  if (!shared) {
    shared = Promise.all([arenaData.manifest(), arenaData.countries(), arenaData.powerPlants(), arenaData.gistemp()])
      .then(([manifest, countries, plants, g]) => ({ manifest, countries, plants: plants.rows, gistemp: g.rows, error: null }))
      .catch((e) => { shared = null; return { manifest: null, countries: [], plants: [], gistemp: [], error: String(e?.message ?? e) }; });
  }
  return shared;
}

export function useArenaDataset(): ArenaDataset & { loading: boolean } {
  const [d, setD] = useState<ArenaDataset | null>(null);
  useEffect(() => { let live = true; loadAll().then((x) => live && setD(x)); return () => { live = false; }; }, []);
  return d ? { ...d, loading: false } : { manifest: null, countries: [], plants: [], gistemp: [], error: null, loading: true };
}

/** Facility emissions with provenance: GPPD-linked plants are estimates, others demo placeholders. */
export function facilityEmissions(plants: PlantRow[]): Record<string, { mt: number; provenance: Provenance; basis: string }> {
  const out: Record<string, { mt: number; provenance: Provenance; basis: string }> = {};
  for (const f of FACILITIES) {
    if (f.gppdIds?.length) {
      const units = plants.filter((p) => f.gppdIds!.includes(p.id));
      if (units.length) {
        const mt = units.reduce((a, u) => a + (u.co2_mt_est ?? 0), 0);
        const yrs = Array.from(new Set(units.map((u) => u.generation_year).filter(Boolean))).join("/");
        out[f.name] = { mt, provenance: "estimate", basis: `Sum of ${units.length} WRI GPPD unit(s): reported generation (${yrs}) × fuel emission factor` };
        continue;
      }
    }
    if (f.emissions) out[f.name] = { mt: f.emissions.mtco2, provenance: f.emissions.provenance, basis: f.emissions.basis };
  }
  return out;
}

export function useEntities(countries: CountryCo2[], plants: PlantRow[], iso3ForIndustry: string) {
  return useMemo(() => {
    const list: EmissionEntity[] = [...DEMO_ENTITIES];
    for (const c of countries) if (c.iso3 !== "WLD" && c.latest.co2) list.push(countryEntity(c));
    const ind = countries.find((c) => c.iso3 === iso3ForIndustry);
    if (ind) list.push(...industryEntities(ind));
    for (const p of plants) if (p.co2_mt_est && p.co2_mt_est > 0.2) list.push(plantEntity(p));
    return list;
  }, [countries, plants, iso3ForIndustry]);
}

export function useEra5(lat: number, lon: number, enabled: boolean) {
  const [s, setS] = useState<{ data: Era5Summary | null; error: string | null }>({ data: null, error: null });
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    arenaData.era5(lat, lon).then((data) => live && setS({ data, error: null })).catch((e) => live && setS({ data: null, error: String(e?.message ?? e) }));
    return () => { live = false; };
  }, [lat, lon, enabled]);
  return s;
}

export function useWeather(lat: number, lon: number, enabled: boolean) {
  const [s, setS] = useState<{ data: CurrentWeather | null; error: string | null }>({ data: null, error: null });
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const load = () => arenaData.currentWeather(lat, lon).then((data) => live && setS({ data, error: null })).catch((e) => live && setS({ data: null, error: String(e?.message ?? e) }));
    load();
    const t = setInterval(load, 15 * 60_000);
    return () => { live = false; clearInterval(t); };
  }, [lat, lon, enabled]);
  return s;
}
