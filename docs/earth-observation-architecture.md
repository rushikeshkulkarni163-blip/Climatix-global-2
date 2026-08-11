# Climactix Earth Observation & Climate Data Repository — Architecture (Phase 1)

## Scope

This document covers **Phase 1** of the Earth Observation & Climate Data Repository:
Data Source Registry, PostGIS catalogue schema, the Asset system, three provider
connectors (Copernicus Sentinel discovery, Landsat, ERA5) running in demo/fallback
mode, the internal API abstraction layer, and a layer toggle on the Scenario
Studio GIS map. Phases 2–5 (NASA Earthdata dataset pulls, full pixel-level
indicator computation, financial linkage, Terminal integration, greenwashing
evidence engine) are architected for but not built in this pass — see
"What's deferred" below.

## Why this exists

Climactix needs a single internal layer that turns satellite/Earth-observation
and climate provider APIs into Climactix's own API, so the website, Scenario
Studio, and future Terminal never call a provider directly and never hold
provider credentials client-side.

## Data flow

```
Provider API / STAC (Copernicus CDSE, USGS M2M, Copernicus CDS, NASA Earthdata, NASA POWER)
        │  (metadata + on-demand queries only — no bulk raster download)
        ▼
intelligence_engine/earth_observation/connectors/*.py
        │  (common ConnectorResult: data + Provenance — source/method/
        │   observation_type/resolution/confidence/date/demo)
        ▼
intelligence_engine/earth_observation/{registry,indicators}.py
        │
        ▼
intelligence_engine/api/earth_observation_router.py   (/api/v1/earth-observation/*)
        │
        ▼
climactix-global/src/app/api/earth-observation/*/route.ts   (server-side proxy)
        │
        ▼
Browser — GISMap.tsx layer toggles, company/asset pages
```

## Why intelligence_engine, not climate_api or backend

`intelligence_engine` is the only service already wired in `docker-compose.yml`
to Postgres 16 + TimescaleDB + PostGIS + Redis, and it's what the Next.js
app's `NEXT_PUBLIC_API_URL`/`INTELLIGENCE_ENGINE_URL` points to. `climate_api/`
has good connector patterns (reused for NASA POWER) but no database. `backend/`
is a separate Postgres schema for auth/materiality/green-production —
unrelated domain.

`intelligence_engine` had no database connection code at all before this
change — `intelligence_engine/database.py` and `intelligence_engine/migrations/`
were added following the exact pattern already proven in `backend/database.py`
+ `backend/migrations/*.sql`: an asyncpg pool that runs idempotent
`CREATE TABLE IF NOT EXISTS` migrations on every startup.

## Database schema

See `intelligence_engine/migrations/001_earth_observation.sql` for the full
DDL. Summary:

| Table | Purpose |
|---|---|
| `data_sources` | Data Source Registry — one row per provider, seeded on startup from `earth_observation/registry.py` |
| `eo_assets` | Physical assets (factory, port, mine, film location, ...) with a PostGIS `GEOGRAPHY(POINT)` generated column + GIST index |
| `eo_datasets` | Scene/product catalogue metadata (STAC-style) — no raster storage |
| `environmental_indicators` | Per-asset indicator values with mandatory `observation_type`/`confidence` |
| `eo_time_series` | TimescaleDB hypertable, same pattern as `climate_signals`/`emissions` in `infra/postgres/init.sql` |
| `eo_processing_jobs` | Job queue tracking |
| `api_usage` | Per-call log feeding the future Data Quality Dashboard |

`eo_assets.company_id` references `companies(id)` from `infra/postgres/init.sql`
— this migration assumes that table already exists, which is true in the
docker-compose flow (Postgres init.sql runs before intelligence_engine starts).

## Providers, auth, and current status (Phase 1)

| Provider | Used for | Auth | Status without credentials |
|---|---|---|---|
| Copernicus Data Space Ecosystem (Sentinel-1/2/3/5P/6) | Scene discovery (STAC) | OAuth2 client-credentials | Demo scene list |
| Copernicus Climate Data Store (ERA5-Land) | Reanalysis climate | Personal access token | Demo lat-band value |
| USGS Landsat M2M | Scene discovery | Application token (`login-token`) | Demo scene list |
| NASA Earthdata (CMR-STAC) | Multi-mission discovery (SMAP/SWOT/GEDI/... enabled in later phases) | EDL bearer token | Registry entry + planned-dataset list only |
| NASA POWER | Climatology baseline | None | Always live |

All auth flows were verified against each provider's **current** documentation
(not the classic/retired patterns) — see comments at the top of each connector
file in `intelligence_engine/earth_observation/connectors/` for direct doc
links and exact endpoint URLs. Notably:

- Copernicus Climate Data Store migrated off the classic `api/v2` + `UID:key`
  format in 2025 — `copernicus_cds.py` uses the new `https://cds.climate.copernicus.eu/api`
  + single personal-access-token format. The pre-existing
  `climate_api/connectors/copernicus.py` still documents the retired format —
  it was not modified since it's a separate service, but should be updated
  before relying on it for ERA5 access.
- USGS deprecated the username/password `/login` endpoint 2025-02-26 —
  `landsat_usgs.py` uses `/login-token` with an application token only.

No credentials exist in `.env` today. Every connector detects that and
returns `"demo": true` data with `confidence: "LOW"` — never silently
presented as live. Add real credentials to `.env` (see `.env.example`) and
restart — no code changes needed, `earth_observation/registry.py` re-derives
each source's live/demo status from environment variables on every startup.

## Environmental indicators (Phase 1: NDVI, NDWI, LST only)

`intelligence_engine/earth_observation/indicators.py` documents formula,
input dataset, resolution, temporal aggregation, assumptions, and limitations
for each indicator (spec requirement — no invented formulas):

- **NDVI** = (NIR − Red) / (NIR + Red), Sentinel-2 bands B8/B4
- **NDWI** = (Green − NIR) / (Green + NIR) (McFeeters 1996), Sentinel-2 bands B3/B8
- **Land Surface Temperature** — mono-window algorithm on Landsat TIRS
  Band 10 / Sentinel-3 SLSTR brightness temperature

**Phase 1 does not do live pixel math.** Computing real NDVI/NDWI/LST values
requires downloading Sentinel-2/Landsat band rasters and running a
`rasterio` band-math pipeline against real CDSE/USGS credentials, neither of
which this deployment has yet. What Phase 1 does: confirm real scene
availability via the CDSE discovery connector, then return a demo-calibrated,
latitude/biome-plausible value, always flagged `demo: true`. This is the
seam where Phase 2 plugs in a real pixel pipeline — the methodology metadata
does not change when the computation does.

`/air-quality/{location}` and `/land-use-change/{location}` honestly return
`"status": "DATA NOT AVAILABLE"` rather than fabricate a value, per the
platform's scientific-integrity rule — Sentinel-5P is registered but its
pollutant indicators aren't computed yet, and land-use change needs a
multi-date time-series baseline this deployment hasn't accumulated.

## API (`/api/v1/earth-observation/*`, mounted in `intelligence_engine/main.py`)

See `intelligence_engine/api/earth_observation_router.py` for the full route
list (`/sources`, `/datasets`, `/search`, `/imagery`, `/assets`,
`/time-series`, `/environmental-indicators`, `/climate-risk|water-risk|
flood-risk|heat-risk|nature-risk|air-quality|land-use-change/{lat,lng}`,
`/asset-climate-profile/{id}`, `/company-climate-profile/{id}`). The
physical-risk wrappers reuse the existing `engines.physical_risk_engine` —
scoring logic is not duplicated.

Every response carries a `provenance` block (source, method, observation_type,
resolution, confidence, date, demo, attribution, limitations). External
provider failures are caught and return `"Earth observation data temporarily
unavailable."` — never a raw provider error, never a 500 that breaks the
caller.

## Frontend integration

`climactix-global/src/app/api/earth-observation/*/route.ts` are server-side
proxies (same pattern as the existing `src/app/api/terminal/*/route.ts`) —
the browser calls these, never the intelligence_engine URL or a provider
directly. `src/store/index.ts`'s `gisLayers` array gained three
`earthObservation: true` entries (`vegetation-ndvi`, `water-surface-ndwi`,
`land-surface-temp`); `GISMap.tsx` fetches indicators per visible asset when
one is toggled on and renders them as a colored scatter layer with a
source/confidence/demo-flag popup, reusing the map's existing hover-popup
pattern. No air-quality layer was added to the UI — the endpoint exists but
Phase 1's indicator engine doesn't compute a real value for it yet, and a
toggle that always says "unavailable" isn't a useful control.

No changes were made to the public marketing homepage (`index.html`/
`globe-gis.js`) — deep Earth Observation layers live in Scenario Studio,
consistent with keeping the public site to summary-level risk labels only.

## Caching, rate limits, and failure handling

`earth_observation/cache.py` is a process-local TTL cache (same
dict-with-expiry pattern already used in `climate_api/connectors/
worldbank.py`/`nasa_power.py`), tuned per dataset's real update cadence —
hourly for scene/indicator lookups, daily for NASA POWER climatology. It
also logs every call to `api_usage` for future dashboarding. Swap for Redis
(already provisioned in docker-compose) if multi-worker cache coherency
becomes necessary — not needed at Phase 1's endpoint volume.

## What's deferred to later phases (not built this pass)

- Live pixel-level indicator computation (rasterio band math against real
  downloaded scenes) — Phase 2, once CDSE/USGS credentials exist.
- NASA Earthdata dataset-specific pulls (SMAP, SWOT, GEDI, OCO-2/3, MODIS,
  VIIRS, ECOSTRESS) — Phase 2/3, each slots into the existing registry
  pattern without a schema rewrite.
- Sentinel-5P pollutant indicators, land-use-change time-series — Phase 2,
  once `eo_time_series` has accumulated real history.
- Financial linkage (heat → cooling demand → opex, flood → revenue at risk),
  Terminal integration, and the greenwashing/evidence-corroboration engine
  (`backend/services/geospatial_validation.py`'s existing
  `GEOSPATIAL_DATASET_TYPES` stub is the intended hook) — Phase 4/5.
- Separate `evidence`/`data_quality`/`data_versions` tables — `data_sources.
  status/last_error` covers Phase 1's quality signal; these get added
  alongside the evidence engine.

## Licensing & attribution

Every `data_sources` row carries `license` and `attribution_requirement`
fields sourced from each provider's own terms (Copernicus Sentinel Data
Terms and Conditions; USGS public domain with requested attribution; NASA
public domain; Copernicus Climate Change Service licence). Surface
`attribution_requirement` in the UI wherever a value derived from that
source is shown.
