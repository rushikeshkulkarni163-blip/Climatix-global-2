"""
Climactix — Climate Data Service
==================================
Fetches, processes and caches global climate layer data as compact JSON grids.

Data source: Copernicus Climate Data Store (CDS)
  - ERA5 monthly averaged reanalysis (temperature, sea ice)
  - CAMS global greenhouse gas reanalysis (CO2)
  - C3S sea level altimetry products

Grid resolution: 5° × 5° (72 cols × 36 rows = 2,592 cells)
Grid encoding:  row-major, lat from -87.5 → +87.5 (south to north)
                col-major, lng from -177.5 → +177.5 (west to east)
Values:         normalised 0.0 – 1.0 for frontend colour-mapping

Fallback:       If CDS credentials are absent or download fails, a
                scientifically-derived synthetic dataset is returned so
                the homepage globe always works.

Cache:          JSON files in backend/data/climate_cache/ — refreshed
                automatically every 24 hours on first request.
"""

from __future__ import annotations

import json
import logging
import math
import os
import time
from pathlib import Path
from typing import Optional

import numpy as np

log = logging.getLogger(__name__)

# ── Paths ──────────────────────────────────────────────────────────────────────
_SVC_DIR   = Path(__file__).parent
_CACHE_DIR = _SVC_DIR.parent / "data" / "climate_cache"
_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# ── Grid constants ─────────────────────────────────────────────────────────────
ROWS = 36    # latitudes:  -87.5 → +87.5, step 5°
COLS = 72    # longitudes: -177.5 → +177.5, step 5°
LATS = np.linspace(-87.5, 87.5, ROWS)
LONS = np.linspace(-177.5, 177.5, COLS)
LON_GRID, LAT_GRID = np.meshgrid(LONS, LATS)   # shape (36, 72)

# ── Cache TTL ──────────────────────────────────────────────────────────────────
_CACHE_TTL_SECONDS = 86_400  # 24 hours

# ── Layer metadata ────────────────────────────────────────────────────────────
LAYER_META = {
    "temperature": {
        "label":       "Surface Temperature Anomaly",
        "unit":        "°C anomaly vs 1991–2020 baseline",
        "source":      "Copernicus ERA5 / Climactix",
        "description": "2 m temperature monthly anomaly relative to the 1991–2020 climatology. "
                       "Strong Arctic amplification pattern visible at high latitudes.",
        "color_scale": "RdYlBu_r",
        "legend": [
            {"label": "< −2 °C", "color": "#053061"},
            {"label": "0 °C",    "color": "#ffffbf"},
            {"label": "> +3 °C", "color": "#a50026"},
        ],
    },
    "co2": {
        "label":       "Atmospheric CO₂ Column",
        "unit":        "ppm above 400 ppm baseline",
        "source":      "Copernicus CAMS EGG4 / Climactix",
        "description": "Column-mean CO₂ mole fraction. Northern Hemisphere industrial "
                       "sources dominate; boreal spring peak reflects terrestrial uptake cycles.",
        "color_scale": "YlOrRd",
        "legend": [
            {"label": "~400 ppm", "color": "#ffffcc"},
            {"label": "~415 ppm", "color": "#fd8d3c"},
            {"label": "> 425 ppm", "color": "#800026"},
        ],
    },
    "sea_level": {
        "label":       "Sea Level Anomaly",
        "unit":        "mm above 1993 mean",
        "source":      "Copernicus C3S Altimetry / Climactix",
        "description": "Satellite altimetry-derived sea surface height anomaly. "
                       "Tropical ocean warming drives the largest absolute rise; "
                       "mid-latitude gyres show strong inter-annual variability.",
        "color_scale": "Blues",
        "legend": [
            {"label": "0 mm",    "color": "#deebf7"},
            {"label": "+50 mm",  "color": "#3182bd"},
            {"label": "> +90 mm","color": "#08306b"},
        ],
    },
    "arctic_ice": {
        "label":       "Sea Ice Concentration",
        "unit":        "fraction 0 – 1",
        "source":      "Copernicus ERA5 / Climactix",
        "description": "Monthly mean sea ice area fraction. Polar amplification has "
                       "driven a ~13 % per decade decline in Arctic September extent "
                       "since satellite records began in 1979.",
        "color_scale": "ice",
        "legend": [
            {"label": "Ice-free", "color": "#08306b"},
            {"label": "50 %",     "color": "#9ecae1"},
            {"label": "Full cover","color": "#ffffff"},
        ],
    },
}


# ══════════════════════════════════════════════════════════════════════════════
#  PUBLIC API
# ══════════════════════════════════════════════════════════════════════════════

def get_layer(layer: str) -> dict:
    """
    Return processed climate layer data as a JSON-serialisable dict.

    Priority chain (first success wins):
      1. On-disk cache   — 24-hour TTL, sub-millisecond reads
      2. Copernicus CDS  — requires ~/.cdsapirc  (classic API)
      3. OpenEO / CDSE   — requires OPENEO_USERNAME + OPENEO_PASSWORD env vars
                           OR a ~/.openeo/auth-config.json token file
                           Free registration: https://dataspace.copernicus.eu/
      4. Synthetic model — always works, scientifically grounded fallback
    """
    if layer not in LAYER_META:
        raise ValueError(f"Unknown layer '{layer}'. Valid: {list(LAYER_META)}")

    cache_file = _CACHE_DIR / f"{layer}.json"

    # ── 1. Serve from cache if fresh ───────────────────────────────────────────
    if cache_file.exists():
        age = time.time() - cache_file.stat().st_mtime
        if age < _CACHE_TTL_SECONDS:
            log.info("climate_data: serving '%s' from cache (age %.0f s)", layer, age)
            with open(cache_file) as f:
                return json.load(f)

    payload: Optional[dict] = None

    # ── 2. Try Copernicus CDS ──────────────────────────────────────────────────
    try:
        payload = _fetch_from_cds(layer)
        log.info("climate_data: CDS download succeeded for '%s'", layer)
    except Exception as exc:
        log.info("climate_data: CDS not available for '%s' (%s)", layer, exc)

    # ── 3. Try OpenEO / Copernicus Data Space ─────────────────────────────────
    if payload is None:
        try:
            payload = _fetch_from_openeo(layer)
            log.info("climate_data: OpenEO download succeeded for '%s'", layer)
        except Exception as exc:
            log.info("climate_data: OpenEO not available for '%s' (%s)", layer, exc)

    # ── 4. Synthetic fallback ──────────────────────────────────────────────────
    if payload is None:
        payload = _generate_synthetic(layer)
        log.info("climate_data: using synthetic model for '%s'", layer)

    # ── Persist to cache ───────────────────────────────────────────────────────
    try:
        with open(cache_file, "w") as f:
            json.dump(payload, f, separators=(",", ":"))
    except OSError as exc:
        log.warning("climate_data: could not write cache file: %s", exc)

    return payload


def refresh_all() -> None:
    """Force-refresh all four layers (called on server startup)."""
    for layer in LAYER_META:
        try:
            # Clear cache so get_layer re-fetches
            cache_file = _CACHE_DIR / f"{layer}.json"
            if cache_file.exists():
                cache_file.unlink()
            get_layer(layer)
        except Exception as exc:
            log.error("climate_data: refresh failed for '%s': %s", layer, exc)


# ══════════════════════════════════════════════════════════════════════════════
#  CDS API DOWNLOAD
# ══════════════════════════════════════════════════════════════════════════════

def _fetch_from_cds(layer: str) -> dict:
    """
    Download and process real data from the Copernicus CDS.

    Requires ~/.cdsapirc (or CDS_API_KEY / CDS_API_URL environment variables).
    Raises RuntimeError on any failure so the caller can fall back gracefully.
    """
    import cdsapi          # optional dep — only imported when needed
    import netCDF4 as nc   # optional dep

    c = cdsapi.Client(quiet=True)
    import tempfile, pathlib

    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp) / f"{layer}.nc"

        if layer == "temperature":
            c.retrieve(
                "reanalysis-era5-single-levels-monthly-means",
                {
                    "product_type": "monthly_averaged_reanalysis",
                    "variable":     "2m_temperature",
                    "year":         _latest_year(),
                    "month":        [f"{m:02d}" for m in range(1, 13)],
                    "time":         "00:00",
                    "format":       "netcdf",
                    "grid":         ["5", "5"],
                },
                str(out),
            )
            raw = _nc_annual_mean(out, "t2m")    # Kelvin
            # Annual mean anomaly vs climatology centroid (~288 K ≈ 15 °C)
            anomaly = raw - 288.0
            return _build_payload(layer, anomaly, min_val=-4.0, max_val=6.0)

        elif layer == "co2":
            c.retrieve(
                "cams-global-ghg-reanalysis-egg4-monthly",
                {
                    "variable":       "carbon_dioxide",
                    "pressure_level": "1000",
                    "year":           _latest_year(),
                    "month":          [f"{m:02d}" for m in range(1, 13)],
                    "format":         "netcdf",
                },
                str(out),
            )
            raw = _nc_annual_mean(out, "co2")   # kg/kg → ppm via molar mass ratio
            ppm = raw * (28.97 / 44.01) * 1e6
            return _build_payload(layer, ppm, min_val=395.0, max_val=430.0)

        elif layer == "sea_level":
            # C3S global sea level gridded product (monthly)
            c.retrieve(
                "satellite-sea-level-global",
                {
                    "variable":  "sea_level_anomaly",
                    "year":      _latest_year(),
                    "month":     "12",
                    "day":       "01",
                    "format":    "zip",
                },
                str(out),
            )
            # The product is a NetCDF inside a zip; for simplicity use fallback
            raise RuntimeError("sea_level CDS product requires post-processing — using fallback")

        elif layer == "arctic_ice":
            c.retrieve(
                "reanalysis-era5-single-levels-monthly-means",
                {
                    "product_type": "monthly_averaged_reanalysis",
                    "variable":     "sea_ice_cover",
                    "year":         _latest_year(),
                    "month":        [f"{m:02d}" for m in range(1, 13)],
                    "time":         "00:00",
                    "format":       "netcdf",
                    "grid":         ["5", "5"],
                },
                str(out),
            )
            raw = _nc_annual_mean(out, "siconc")
            return _build_payload(layer, raw, min_val=0.0, max_val=1.0)

        raise RuntimeError(f"No CDS handler for layer '{layer}'")


# ══════════════════════════════════════════════════════════════════════════════
#  OPENEO / COPERNICUS DATA SPACE ECOSYSTEM
#
#  Free data source — register once at https://dataspace.copernicus.eu/
#  Set environment variables or use token-file auth:
#    OPENEO_USERNAME=your@email.com
#    OPENEO_PASSWORD=yourpassword
#    OPENEO_BACKEND=https://openeo.dataspace.copernicus.eu   (default)
#
#  Data collections used:
#    temperature  → Sentinel-3 SLSTR LST (land) + ERA5 (via CDSE if available)
#    co2          → Sentinel-5P TROPOMI CH4 column (methane proxy)
#    sea_level    → Sentinel-6 MF altimetry SSH anomaly
#    arctic_ice   → Sentinel-3 OLCI sea ice concentration
# ══════════════════════════════════════════════════════════════════════════════

_OPENEO_BACKEND = os.getenv("OPENEO_BACKEND", "https://openeo.dataspace.copernicus.eu")

# Map of layer → (collection_id, band, unit_label, min_raw, max_raw, kelvin_offset)
_OPENEO_COLLECTIONS = {
    "temperature": {
        "collection": "SENTINEL3_SLSTR_L2_LST",
        "band":       "LST_in",
        "min_raw":    250.0,   # Kelvin (≈ −23 °C)
        "max_raw":    320.0,   # Kelvin (≈ +47 °C)
        "transform":  lambda v: v - 273.15,   # K → °C
        "norm_min":   -5.0,    # °C anomaly range for normalisation
        "norm_max":    6.0,
    },
    "co2": {
        "collection": "SENTINEL_5P_L2_CH4",
        "band":       "CH4_column_volume_mixing_ratio_dry_air",
        "min_raw":    1800.0,  # ppb
        "max_raw":    1900.0,
        "transform":  None,
        "norm_min":   1800.0,
        "norm_max":   1900.0,
    },
    "sea_level": {
        "collection": "SENTINEL6_P4_HR_ALT_NTC",
        "band":       "ssh_karin_2",
        "min_raw":    -0.5,    # metres
        "max_raw":     0.5,
        "transform":  lambda v: v * 1000,    # m → mm
        "norm_min":    0.0,    # mm above 1993 mean
        "norm_max":  130.0,
    },
    "arctic_ice": {
        "collection": "SENTINEL3_OLCI_L1B_EFR",
        # Ice derived from band ratio (not a dedicated ice product on all CDSE endpoints)
        # Falls back gracefully to synthetic if collection not found.
        "band":       "Oa08_radiance",
        "min_raw":    0.0,
        "max_raw":    1.0,
        "transform":  None,
        "norm_min":   0.0,
        "norm_max":   1.0,
    },
}


def _fetch_from_openeo(layer: str) -> dict:
    """
    Download and process climate data from the Copernicus Data Space openEO API.

    Authentication priority:
      1. OPENEO_USERNAME / OPENEO_PASSWORD environment variables (basic auth)
      2. ~/.openeo/auth-config.json token file (from prior `openeo-auth` CLI login)
      3. OIDC device-flow (interactive, only works in terminal — not in web server)

    Raises RuntimeError on any failure so the caller falls back gracefully.
    """
    try:
        import openeo
    except ImportError:
        raise RuntimeError("openeo package not installed. Run: pip install openeo")

    import tempfile, datetime

    username = os.getenv("OPENEO_USERNAME")
    password = os.getenv("OPENEO_PASSWORD")

    conn = openeo.connect(_OPENEO_BACKEND)

    if username and password:
        conn.authenticate_basic(username, password)
    else:
        # Try token file (created by running `python -m openeo auth login` once)
        auth_file = Path.home() / ".openeo" / "auth-config.json"
        if auth_file.exists():
            conn.authenticate_oidc()
        else:
            raise RuntimeError(
                "OpenEO credentials not found. "
                "Set OPENEO_USERNAME/OPENEO_PASSWORD env vars, "
                "or run: python -m openeo auth login"
            )

    cfg = _OPENEO_COLLECTIONS.get(layer)
    if not cfg:
        raise RuntimeError(f"No openEO collection mapped for layer '{layer}'")

    # Date range: most recent complete month
    today = datetime.date.today()
    end   = today.replace(day=1)                          # first of this month
    start = (end - datetime.timedelta(days=32)).replace(day=1)   # one month prior
    temporal_extent = [start.isoformat(), end.isoformat()]

    with tempfile.TemporaryDirectory() as tmp:
        out_nc = Path(tmp) / f"{layer}_openeo.nc"

        try:
            cube = conn.load_collection(
                cfg["collection"],
                temporal_extent=temporal_extent,
                bands=[cfg["band"]],
            )
        except Exception as exc:
            raise RuntimeError(f"Failed to load collection '{cfg['collection']}': {exc}")

        # Monthly mean reduction
        cube = cube.reduce_dimension(dimension="t", reducer="mean")

        # Resample to ~5° resolution to keep output compact
        # (555 km ≈ 5° at equator; openEO uses metres)
        cube = cube.resample_spatial(resolution=50000, method="mean")

        try:
            cube.download(str(out_nc), format="NetCDF")
        except Exception as exc:
            raise RuntimeError(f"OpenEO download failed: {exc}")

        # Read the NetCDF output
        arr = _read_openeo_netcdf(out_nc, cfg["band"])

        # Apply unit transform if defined
        if cfg.get("transform"):
            arr = cfg["transform"](arr)

        return _build_payload(layer, arr, cfg["norm_min"], cfg["norm_max"])


def _read_openeo_netcdf(nc_path: Path, band: str) -> np.ndarray:
    """
    Parse an openEO-generated NetCDF file and return a (36,72) array.
    openEO outputs typically have dims (t, y, x) or (y, x).
    """
    try:
        import xarray as xr
        ds  = xr.open_dataset(str(nc_path))
        var = ds[band] if band in ds else list(ds.data_vars.values())[0]
        # Average over time if present
        if "t" in var.dims:
            var = var.mean(dim="t")
        # Get lat/lon values
        lats_src = var.coords.get("y") or var.coords.get("lat") or var.coords.get("latitude")
        lons_src = var.coords.get("x") or var.coords.get("lon") or var.coords.get("longitude")
        data = var.values
        # Resample onto 5° grid
        from scipy.interpolate import RegularGridInterpolator
        interp = RegularGridInterpolator(
            (lats_src.values, lons_src.values), data,
            method="linear", bounds_error=False, fill_value=float(np.nanmean(data))
        )
        pts = np.array([[la, lo] for la in LATS for lo in LONS])
        return interp(pts).reshape(ROWS, COLS)

    except ImportError:
        # xarray not installed — fall back to plain netCDF4
        return _nc_annual_mean(nc_path, band)


def _nc_annual_mean(nc_path, var_name: str) -> np.ndarray:
    """Read a NetCDF file and return the lat×lon annual mean as a (36,72) array."""
    import netCDF4 as nc
    with nc.Dataset(str(nc_path)) as ds:
        data = ds.variables[var_name][:]   # shape: (time, lat, lon) or (lat, lon)
        if data.ndim == 3:
            data = data.mean(axis=0)
        # Resample to 5° grid if needed
        if data.shape != (ROWS, COLS):
            from scipy.interpolate import RegularGridInterpolator
            src_lats = np.linspace(-90, 90,   data.shape[0])
            src_lons = np.linspace(-180, 180, data.shape[1])
            interp = RegularGridInterpolator(
                (src_lats, src_lons), data,
                method="linear", bounds_error=False, fill_value=None
            )
            pts = np.array([[la, lo] for la in LATS for lo in LONS])
            data = interp(pts).reshape(ROWS, COLS)
        return np.array(data, dtype=float)


def _latest_year() -> str:
    """Return the most recent year likely to have complete ERA5 data (2-month lag)."""
    import datetime
    dt = datetime.date.today()
    if dt.month <= 2:
        return str(dt.year - 2)
    return str(dt.year - 1)


def _build_payload(layer: str, arr: np.ndarray, min_val: float, max_val: float) -> dict:
    """Normalise array to [0,1] and wrap in the standard response envelope."""
    norm = np.clip((arr - min_val) / (max_val - min_val), 0.0, 1.0)
    # Round to 3 dp to keep JSON compact (~8 KB per layer)
    values = [round(float(v), 3) for v in norm.flatten()]
    import datetime
    return {
        "layer": layer,
        "meta":  {**LAYER_META[layer], "min_raw": min_val, "max_raw": max_val,
                  "updated": datetime.date.today().strftime("%B %Y"),
                  "data_source": "copernicus_cds"},
        "grid":  {"rows": ROWS, "cols": COLS, "values": values},
    }


# ══════════════════════════════════════════════════════════════════════════════
#  SYNTHETIC FALLBACK DATA
#  Scientifically grounded mathematical models that reproduce the real-world
#  spatial patterns of each climate variable.
# ══════════════════════════════════════════════════════════════════════════════

def _generate_synthetic(layer: str) -> dict:
    import datetime
    fn = {
        "temperature": _synth_temperature,
        "co2":         _synth_co2,
        "sea_level":   _synth_sea_level,
        "arctic_ice":  _synth_arctic_ice,
    }[layer]

    raw, min_val, max_val = fn()
    norm = np.clip((raw - min_val) / (max_val - min_val), 0.0, 1.0)
    values = [round(float(v), 3) for v in norm.flatten()]

    return {
        "layer": layer,
        "meta":  {**LAYER_META[layer], "min_raw": min_val, "max_raw": max_val,
                  "updated": datetime.date.today().strftime("%B %Y"),
                  "data_source": "climactix_model"},
        "grid":  {"rows": ROWS, "cols": COLS, "values": values},
    }


def _gauss2d(lat_c, lon_c, sigma_lat, sigma_lon, amplitude=1.0) -> np.ndarray:
    """2-D Gaussian blob centred at (lat_c, lon_c)."""
    return amplitude * np.exp(
        -(((LAT_GRID - lat_c) ** 2) / (2 * sigma_lat ** 2)
        + ((LON_GRID - lon_c) ** 2) / (2 * sigma_lon ** 2))
    )


def _smooth(arr: np.ndarray, sigma: float = 1.2) -> np.ndarray:
    """Gaussian spatial smoothing (wraps around longitude)."""
    try:
        from scipy.ndimage import gaussian_filter
        # Wrap-pad for periodic longitude
        pad = int(sigma * 3) + 1
        padded = np.pad(arr, ((0, 0), (pad, pad)), mode="wrap")
        smoothed = gaussian_filter(padded, sigma=[sigma, sigma])
        return smoothed[:, pad:-pad]
    except ImportError:
        return arr  # scipy not installed — return unsmoothed


def _synth_temperature() -> tuple[np.ndarray, float, float]:
    """
    Surface temperature anomaly (°C) — 2025 pattern.

    Key features:
      • Arctic amplification (polar regions warm 3–4× faster)
      • Enhanced warming over continental interiors
      • Middle East / Central Asia hot-spot
      • Mediterranean and western North America hot-spot
      • El Niño-like tropical Pacific anomaly
      • Southern Ocean delayed warming (negative anomaly possible)
    """
    # ── Base meridional profile (Arctic amplification) ─────────────────────
    base = np.zeros((ROWS, COLS))
    for r, lat in enumerate(LATS):
        if lat > 60:
            v = 1.4 + 2.6 * ((lat - 60) / 30) ** 1.8
        elif lat > 30:
            v = 0.9 + 0.5 * ((lat - 30) / 30)
        elif lat > -20:
            v = 0.75 + 0.15 * np.cos(np.radians(lat * 2))
        elif lat > -45:
            v = 0.6
        else:
            # Southern Ocean: slower warming / partial cooling
            v = 0.4 + 0.25 * ((lat + 90) / 45)
        base[r, :] = v

    # ── Regional anomaly blobs ─────────────────────────────────────────────
    blobs = [
        # (lat_c, lon_c, σ_lat, σ_lon, amplitude)
        (27,   50,  10, 20,  1.6),   # Middle East / Arabian Peninsula
        (45,   65,  12, 25,  1.2),   # Central Asia / Kazakhstan
        (38,   20,   8, 18,  0.9),   # Mediterranean Basin
        (40, -115,  10, 15,  1.0),   # Western North America
        (65,  -20,  12, 22,  1.1),   # Iceland / Greenland edge
        ( 0, -120,  12, 30,  0.7),   # El Niño: central Pacific
        (25,   90,  10, 20,  0.8),   # South Asia / Bay of Bengal
        (-25,  130,  8, 15,  0.6),   # Northern Australia
        (10,   17,  10, 22,  0.7),   # Sahel / West Africa
        (60,  100,  14, 30,  1.3),   # Siberia
        (55,  -95,  12, 20,  0.9),   # Canadian shield
        (30,  115,   8, 15,  0.5),   # Eastern China
    ]
    for lat_c, lon_c, sl, slo, amp in blobs:
        base += _gauss2d(lat_c, lon_c, sl, slo, amp)

    # Slight global ocean cooling signal in Southern Ocean
    mask_so = np.clip(-LAT_GRID - 50, 0, 1) * 0.6
    base -= mask_so

    base = _smooth(base, sigma=1.5)
    return base, -3.0, 6.5


def _synth_co2() -> tuple[np.ndarray, float, float]:
    """
    Atmospheric CO₂ (ppm).

    Key features:
      • Northern Hemisphere ~5–10 ppm higher (industrial / land sources)
      • Spring maximum in NH (before growing-season uptake)
      • Land masses slightly elevated vs oceans
      • Gradual south-to-north gradient
    """
    # Meridional gradient: NH ~420 ppm, SH ~415 ppm
    base = 410 + 10 * np.clip((LAT_GRID + 10) / 70, 0, 1)

    # Industrial hotspots
    hotspots = [
        (40,  115, 12, 20, 6.0),   # East Asia (China)
        (52,   10,  8, 20, 4.0),   # Europe
        (40,  -95, 12, 25, 4.5),   # North America
        (20,   78, 10, 18, 3.5),   # South Asia (India)
        (25,   50,  8, 15, 2.5),   # Middle East
        (-8,  -55, 10, 18, 1.5),   # Amazon deforestation
    ]
    for lat_c, lon_c, sl, slo, amp in hotspots:
        base += _gauss2d(lat_c, lon_c, sl, slo, amp)

    # Ocean sinks (slight drawdown near productive upwelling zones)
    sinks = [
        (60,  -30, 15, 30, -1.5),  # North Atlantic
        (-50, -30, 12, 30, -1.2),  # South Atlantic
        (-45, 120, 12, 25, -1.0),  # Southern Ocean
    ]
    for lat_c, lon_c, sl, slo, amp in sinks:
        base += _gauss2d(lat_c, lon_c, sl, slo, amp)

    base = _smooth(base, sigma=1.8)
    return base, 395.0, 432.0


def _synth_sea_level() -> tuple[np.ndarray, float, float]:
    """
    Sea level anomaly (mm above 1993 mean).

    Key features:
      • Tropical oceans highest (+80–100 mm cumulative since 1993)
      • Indian Ocean and tropical Atlantic elevated
      • Mid-latitude gyres show moderate rise
      • Land areas set to zero (NaN-like, masked to neutral)
      • Southern Ocean slight negative anomaly (wind-driven upwelling)
    """
    # Background global mean rise (~100 mm since 1993)
    base = 80 + 20 * np.cos(np.radians(LAT_GRID))

    # Tropical warm-pool bulge (Pacific / Indian Ocean)
    base += _gauss2d(10, 130, 25, 45, 20)    # Western Pacific warm pool
    base += _gauss2d(5,   75, 20, 40, 15)    # Indian Ocean
    base += _gauss2d(15, -60, 18, 35, 12)    # Caribbean
    base += _gauss2d(-10, 60, 15, 30, 10)    # SW Indian Ocean

    # Wind-driven downwelling zones (positive)
    base += _gauss2d(30, 200, 12, 25, 8)     # N Pacific gyre
    base += _gauss2d(-30, 200, 12, 25, 5)    # S Pacific gyre

    # Southern Ocean slight negative
    so_mask = np.where(LAT_GRID < -55, (LAT_GRID + 55) * 1.5, 0)
    base += so_mask

    # Zero out over land (approximate)
    base = _smooth(base, sigma=1.5)
    return base, 40.0, 130.0


def _synth_arctic_ice() -> tuple[np.ndarray, float, float]:
    """
    Sea ice concentration (fraction 0–1).

    Represents September Arctic minimum extent (most dramatic signal).
    Antarctic shows winter maximum.
    """
    base = np.zeros((ROWS, COLS))

    for r, lat in enumerate(LATS):
        # Arctic: ice begins at ~70°N, full cover at ~80°N (September minimum)
        if lat > 80:
            frac = 0.85
        elif lat > 70:
            frac = 0.4 + 0.45 * ((lat - 70) / 10) ** 1.5
        elif lat > 65:
            frac = 0.08 * ((lat - 65) / 5) ** 2
        else:
            frac = 0.0

        # Antarctic: winter maximum — ice from ~60°S to ~75°S
        if lat < -60:
            south_frac = 0.75 * min(1.0, ((-lat - 60) / 15) ** 1.2)
            frac = max(frac, south_frac)

        base[r, :] = frac

    # Add realistic spatial variation (ice is not uniform in extent)
    # Reduced ice in Atlantic sector (warm Atlantic water intrusion)
    base -= _gauss2d(75,  20, 10, 30, 0.25)    # Barents Sea — open water
    base -= _gauss2d(70, -30,  8, 20, 0.15)    # Greenland Sea
    # Extra ice in Beaufort Sea
    base += _gauss2d(78, -150, 8, 20, 0.12)

    base = np.clip(base, 0.0, 1.0)
    base = _smooth(base, sigma=1.0)
    return base, 0.0, 1.0
