# Data Source Registry

The canonical list lives in `intelligence_engine/earth_observation/registry.py`
(`SOURCES`) and is written to the `data_sources` table on every
`intelligence_engine` startup (idempotent upsert on `source_key`). This
document is a human-readable mirror of that table — if the two ever
disagree, `registry.py` is authoritative.

Query it live via `GET /api/v1/earth-observation/sources` (proxied at
`GET /api/earth-observation/sources` from the Next.js app).

| source_key | Provider | Dataset | Type | Resolution | Auth | Ingestion |
|---|---|---|---|---|---|---|
| `sentinel-1` | ESA / Copernicus | Sentinel-1 GRD | satellite_sar | 5m–40m | OAuth2 client-credentials | STAC search |
| `sentinel-2` | ESA / Copernicus | Sentinel-2 L2A | satellite_optical | 10m/20m/60m | OAuth2 client-credentials | STAC search |
| `sentinel-3` | ESA / Copernicus | Sentinel-3 LST / Ocean Colour | satellite_optical | 300m–1km | OAuth2 client-credentials | STAC search |
| `sentinel-5p` | ESA / Copernicus | Sentinel-5P L2 | atmospheric | 3.5km × 5.5–7km | OAuth2 client-credentials | STAC search |
| `sentinel-6` | ESA/Copernicus/NASA/NOAA/EUMETSAT | Sentinel-6 Altimetry | satellite_altimetry | ~300m along-track | OAuth2 client-credentials | STAC search |
| `landsat` | USGS / NASA | Landsat 8-9 OLI/TIRS L2 | satellite_optical | 30m (15m pan) | Application token (M2M `login-token`) | STAC-style search |
| `era5-land` | ECMWF / Copernicus CDS | ERA5-Land monthly | reanalysis | 0.1° (~9km) | API personal access token | On-demand API |
| `nasa-earthdata` | NASA | CMR / CMR-STAC | satellite_optical (umbrella) | varies by mission | EDL bearer token | STAC search |
| `nasa-power` | NASA | POWER Climatology (1981–2010) | reanalysis | 0.5° × 0.625° | None | On-demand API |

## Adding a new source

1. Add an entry to `SOURCES` in `registry.py` with real values sourced from
   the provider's own documentation — never invent a resolution, license, or
   endpoint (this is a hard rule, not a style preference).
2. If it needs credentials, add the env var name(s) to `_CREDENTIAL_ENV` in
   the same file so `/sources` correctly reports `active` vs `demo` status,
   and document them in `.env.example` / `intelligence_engine/.env.example`.
3. If it needs a new connector, add `intelligence_engine/earth_observation/
   connectors/<provider>.py` returning the shared `ConnectorResult` type
   from `earth_observation/types.py` — every result must carry a full
   `Provenance` block.
4. Restart `intelligence_engine` — the registry upserts automatically, no
   migration needed for the registry row itself (only for new tables).

## Status semantics

- `active` — credentials configured, connector calls the live provider.
- `demo` — no credentials, connector returns clearly-labeled synthetic data.
- `degraded` / `inactive` — reserved for future health-check-driven states
  (not yet wired to an automated monitor in Phase 1).
