# Climate Arena — immersive Earth, city and scenario module

Route: **`/console/earth`** (inside the authenticated Climactix Terminal; nav item "Climate Arena (3D)").

The Arena is a WebGL module built on CesiumJS. It renders a lit 3D Earth, descends to a Mumbai digital twin, and ties every visual to a named dataset, a published projection, or an explicitly labelled illustrative encoding.

| Module | What it does |
|---|---|
| Satellite Observation | CEON constellation (four **virtual** Climactix mission concepts on simulated sun-synchronous orbits), mission control, six observation categories with historical dates and swipe-compare, point readouts decoded from GIBS colormaps, ground/model/satellite air quality kept separate |
| Earth | Orbit, day/night lighting from the live clock, NASA Black Marble night lights, country selection, continent → country → state → city → cluster navigation |
| City Arena | ~202,600 Mumbai buildings, 14 mapped facilities, animated traffic and rail on real road geometry, live weather, ERA5 local climate record, seven camera modes |
| Carbon Intelligence | Emission *sources* (country totals, power-plant estimates, Mumbai facilities) kept separate from atmospheric *concentration* (OCO-2 XCO₂) |
| Climate Futures | "The 1.5 °C future": baseline / 1.5 / 2 / 3 °C, timeline 2026–2100, IPCC AR6 extremes and sea level, Mumbai translation, scenario comparison |
| Industrial Digital Twin | Facility exposure index by scenario/year, carbon-cost liability, provenance per value |
| Scenario Simulator | Baseline vs decarbonisation for countries, cities, industries, companies, power plants and transport; six levers; 3D view responds |

## Earth Observation Network (CEON)

- **Not real spacecraft.** CEON-01 Carbon, CEON-02 Thermal, CEON-03 Atmospheric, CEON-04 Climate & Environment are mission concepts. Every panel says so. Positions come from `src/lib/arena/constellation.ts`: circular orbits, sun-synchronous inclination (`cos i = −(a/12352 km)^3.5`), RAAN tied to the local time of ascending node, GMST Earth rotation. Swath = spherical-Earth geometry from the concept sensor half-angle. Next daylight pass searches 16 days.
- **Models:** `scripts/arena/build_ceon_models.py` (numpy + pillow) writes `public/arena/models/ceon-0X.glb` — procedural buses with MLI, solar wings, nadir instruments, radiators, antenna, star trackers and a Climactix branding plate.
- **Cameras:** Orbital view, Follow satellite (chase camera; wheel changes range), Sensor view (nadir, field of view = the sensor's cross-track FOV). Esc returns to orbit.
- **Data is real:** observation layers are NASA GIBS products from OCO-2, AIRS, MODIS, Sentinel-5P TROPOMI, OMPS, SMAP, MERRA-2 and SEDAC, each with dataset, observation date (from GIBS `layer-time-actual`), resolution, units, cadence/latency, processing and quality notes.
- **Point readouts** (`src/lib/arena/readout.ts`): fetches the tile under the point at native zoom, reads the pixel without colour conversion and maps it through the product's published GIBS colormap → value bin + units. Stated as quantised visualisation values, not science-file values.
- **Air quality evidence classes:** ground monitors via OpenAQ v3 (`/api/arena/openaq`, needs `OPENAQ_API_KEY`), CAMS model via Open-Meteo (hourly, ~40 km, AQI computed from model concentrations), satellite columns (TROPOMI NO₂/SO₂, MODIS AOD). Never merged, never called "live" unless it is a ground reading.
- **Animation policy:** only camera, simulated orbital motion and time move. The earlier particle streams, flowing column pulses, rain shader, depth of field and scenario building tint were removed. Traffic animation is illustrative and off by default.

## Install and run

```bash
cd climactix-global
npm install                 # postinstall copies CesiumJS into public/cesium
npm run dev                 # predev also copies it if missing
# open http://localhost:3000/console/earth (sign in to the Terminal first)
```

The Terminal API (`terminal_platform/`, `uvicorn cxt.main:app --port 8100`) must be running for sign-in; the Arena itself makes no Terminal API calls.

### Build the datasets

Small JSON datasets live in `public/arena/` (about 3 MB, intended to be committed). The Mumbai building tiles (`public/arena/mumbai/tiles/`, ~64 MB, 253 GLB files) are generated and git-ignored:

```bash
python3 -m venv .venv-arena
.venv-arena/bin/pip install -r scripts/arena/requirements.txt
.venv-arena/bin/python scripts/arena/build_arena_data.py            # everything (~3 min, ~200 MB download, cached in .arena-cache/)
.venv-arena/bin/python scripts/arena/build_arena_data.py --skip-buildings   # global datasets only
.venv-arena/bin/python scripts/arena/build_arena_data.py --only sectors,water  # individual steps
.venv-arena/bin/python scripts/arena/build_ceon_models.py                      # CEON spacecraft models
```

`OVERTURE_RELEASE` (env) pins the Overture Maps release (default `2026-11-18.0`). Every output is recorded in `public/arena/manifest.json` with source, licence, retrieval date and record count; the in-app "Sources & method" dialog reads that file.

## Environment variables (all optional)

| Variable | Effect when set | Without it |
|---|---|---|
| `NEXT_PUBLIC_CESIUM_ION_TOKEN` | Cesium World Terrain (real relief, mountains), Bing aerial imagery, Mumbai tiles lifted onto terrain | Ellipsoid globe; NASA Blue Marble + Esri imagery |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Photorealistic 3D Tiles replace the Mumbai tileset (photogrammetry; heat tint still works, rooftop-solar and height-source views do not) | Bundled Overture/GHSL tileset |
| `NEXT_PUBLIC_ARENA_IMAGERY` | `auto` \| `ion` \| `esri` \| `gibs` | `auto` |
| `NEXT_PUBLIC_ARENA_DATA_URL` | Serve `manifest.json`, `data/*`, `mumbai/*` from a CDN | `/arena` |
| `OPENAQ_API_KEY` (server) | Ground-monitor air quality near any point (OpenAQ v3, incl. CPCB) | Panel states the network is not connected |
| `NEXT_PUBLIC_ARENA_TILES_URL` | Serve the Mumbai tileset from a CDN | `/arena/mumbai` |

## Architecture

```
src/app/console/earth/page.tsx        dynamic import, ssr:false
src/components/arena/
  ArenaApp.tsx                         mounts engine, syncs store → scene, layout
  store.ts                             zustand state (module, camera, layers, scenario, year, levers…)
  context.ts                           engine + derived data for panels
  Chrome.tsx                           top bar, navigator, layer list, view settings, camera/timeline bars, sources dialog
  Panels.tsx · Simulator.tsx           right-hand intelligence panels
  useArenaData.ts                      dataset, ERA5 and weather hooks
  engine/
    loader.ts                          loads /cesium/Cesium.js (kept out of webpack)
    ArenaEngine.ts                     viewer, imagery/terrain, lighting, GIBS layers, picking, camera modes, flight, adaptive resolution, rain + depth of field
    globalLayers.ts                    country extrusions, power-plant columns, ports, airports, point-in-polygon country lookup
    city.ts                            Mumbai tileset + building shader, facilities, emission streams, traffic and rail
    controls.ts                        street-level and free-roam controls
src/lib/arena/
  science.ts                           IPCC AR6 tables (SPM.6, SPM.1, sea level) and interpolation
  emissions.ts                         simulator model, entity builders, demo entities
  layers.ts                            layer catalogue (verified GIBS identifiers)
  mumbai.ts                            facility attributes, exposure index, camera viewpoints, flight path
  places.ts                            navigation hierarchy
  data.ts                              ArenaDataSource interface + static/Open-Meteo implementation
scripts/arena/
  build_arena_data.py                  reproducible data build
  copy-cesium.mjs                      copies CesiumJS build into public/cesium
```

**Data seam.** Components only call `arenaData` (`src/lib/arena/data.ts`), which implements `ArenaDataSource`. To move to a server (FastAPI + PostGIS), implement the same interface against versioned endpoints (e.g. `/api/v1/arena/countries`, `/api/v1/arena/facilities?bbox=`) and export it as `arenaData`. Company-level Scope 1/2/3 from the Terminal (`terminal_platform`) can replace the synthetic companies in `DEMO_ENTITIES` the same way.

**Mumbai tileset.** Overture building footprints extruded to: OSM `height` tag → OSM floors × 3.1 m + 1 m → JRC GHSL GHS-BUILT-H 2018 cell mean (~90 m) → 4 m minimum. 98% of buildings use GHSL, so buildings in the same 90 m cell share a height; the "Height source" view shows this. Tiles are 3D Tiles 1.1 GLBs with int16-quantised positions and no normals (the shader derives flat normals), a ~1 km leaf grid, and a coarse LOD of simplified blocks for 6–20 km views.

## Visual quality

- Rendering uses device pixels (`useBrowserRecommendedResolution: false`): Auto renders up to 1.5 px per CSS pixel, High uses full Retina density (capped at 2×). Adaptive scaling only steps down after 3 s below 24 fps and never below 1 px per CSS pixel.
- HDR with the PBR-neutral tonemapper; 2× MSAA on HiDPI screens (4× otherwise) plus FXAA.
- Buildings: procedural façades (floor-by-floor glazing with Fresnel sky reflection and sun glint, weathering, contact shading, aerial haze) and roof materials (concrete, tarpaulin, clay tile, membrane). These are visual materials, not surveyed attributes.
- **Photorealistic Mumbai:** set `NEXT_PUBLIC_CESIUM_ION_TOKEN` (free Cesium ion account) or `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. The Arena then streams Google Photorealistic 3D Tiles (global, with terrain), hides the ellipsoid globe below 90 km and clamps overlays onto the photogrammetry. In development only, `?evalIon=1` previews this with CesiumJS's built-in evaluation token.
- Spacecraft: 1–2K textures, space lighting (low diffuse IBL, strong specular), X-forward glTF axes.

## Performance

- Tiles stream per ~1 km cell (largest GLB 1.1 MB, ~0.33 MB gzipped); coarse LOD above ~6 km; nothing loads above ~20 km.
- Global layers load on first use only; GIBS rasters load only while switched on.
- Adaptive resolution (Auto): drops to 60% when the frame rate falls below 26 fps, recovers above 52 fps. Shadows are off on low-power devices; traffic drops from 2,400 to 500 vehicles on Low.
- Measured on an Apple M2 in headless Chromium (Metal): 40–50 fps on the globe, 31–49 fps in the city.
- No WebGL: a fallback message is shown and the panels still work.

## Deployment

1. `npm ci` (runs the Cesium copy), run the data build in CI or upload `public/arena/mumbai/tiles/` to a CDN and set `NEXT_PUBLIC_ARENA_TILES_URL`.
2. Serve `*.glb` and `*.json` with gzip/brotli and long cache headers (tiles are content-stable per build).
3. Imagery licensing: Esri World Imagery requires an ArcGIS account/licence for commercial production use. For production either set a Cesium ion token (Bing via ion) or `NEXT_PUBLIC_ARENA_IMAGERY=gibs`.
4. Keep the Cesium credit area visible (it is required by the imagery and ion terms).

## Scientific integrity rules built in

- Warming levels are global and relative to 1850–1900; the UI never presents them as a Mumbai temperature.
- Scenario → pathway: 1.5 °C → SSP1-1.9, 2 °C → SSP1-2.6, 3 °C → SSP2-4.5 (closest AR6 pathway). Values between published points, including all 3 °C extremes, are labelled *Interpolated*.
- Mumbai translation adds the global-land median change to an ERA5 1981–2010 baseline, labelled *Estimate*, with the caveats stated in the panel.
- Emission columns and streams encode annual tonnes; the UI says they are not plumes. Atmospheric CO₂ is a separate OCO-2 layer.
- Facility emissions without a public facility-level figure are **Demo data** and say what disclosure should replace them. Operators are named only where verified.
- Rain, building heat tint, rooftop solar and EV-coloured vehicles are *Illustrative* encodings of a stated variable.

## Not yet connected (explicit gaps)

- Coastal inundation mapping (needs a coastal DEM such as CoastalDEM or Copernicus GLO-30 plus local relative sea-level projections).
- Regional climate projections (CMIP6 / CORDEX-South Asia) — the Arena currently uses global-land medians.
- Facility-level emissions from BRSR/CDP disclosures; NGFS carbon-price paths; shipping (AIS) and aviation emissions.
- Asset values and damage functions — the exposure index ranks exposure; it does not estimate financial loss.
- Full city environments beyond Mumbai (other cities fly to imagery, plus terrain with an ion token).

## Design notes

The module follows DESIGN.md v4.0 for the accent (NASA Blue `#0B3D91`), status colours, 8 px radius, 1 px borders, no shadows, no glassmorphism, no `backdrop-filter`, typography roles and ≤250 ms UI motion. It deliberately uses a dark surface because it is a full-bleed space and night scene. Camera flights (2–4 s) and the 80 s cinematic flight are content navigation, not UI decoration. The brief's "royal blue" and "glass-style panels" were not used because CLAUDE.md retires both.
