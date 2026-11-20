#!/usr/bin/env python3
"""
Climactix Climate Arena — reproducible data build.

Downloads open datasets, normalises them into compact JSON for the browser,
and builds a 3D Tiles 1.1 tileset of Mumbai buildings.

Every output is listed in public/arena/manifest.json with its source,
licence, retrieval date and record count. Nothing here is invented: values
that are Climactix estimates (e.g. power-plant CO2) carry the method used.

Usage:
    python -m venv .venv-arena && .venv-arena/bin/pip install -r scripts/arena/requirements.txt
    .venv-arena/bin/python scripts/arena/build_arena_data.py [--cache DIR] [--skip-buildings]

Run from the climactix-global/ directory.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import math
import os
import struct
import sys
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "arena"
TODAY = dt.date.today().isoformat()
UA = "climactix-arena-databuild/1.0"

OVERTURE_RELEASE = os.environ.get("OVERTURE_RELEASE", "2026-11-18.0")
OVERTURE = f"s3://overturemaps-us-west-2/release/{OVERTURE_RELEASE}"

# Mumbai city arena extent (island city → Bandra/BKC/Kurla/Chembur/Trombay/airport)
CITY_BBOX = (72.800, 18.890, 72.950, 19.120)  # lon_min, lat_min, lon_max, lat_max
CITY_TILE_DEG = 0.01  # leaf tile size (~1.1 km)

GHSL_TILES = ["R7_C26", "R8_C26"]
GHSL_URL = ("https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/GHS_BUILT_H_GLOBE_R2023A/"
            "GHS_BUILT_H_ANBH_E2018_GLOBE_R2023A_4326_3ss/V1-0/tiles/"  # public JRC dataset path  # pragma: allowlist secret
            "GHS_BUILT_H_ANBH_E2018_GLOBE_R2023A_4326_3ss_V1_0_{tile}.zip")

URLS = {
    "owid": "https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv",
    "ne_countries": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson",
    "ne_ports": "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_ports.geojson",
    "gppd": "https://raw.githubusercontent.com/wri/global-power-plant-database/master/output_database/global_power_plant_database.csv",
    "airports": "https://davidmegginson.github.io/ourairports-data/airports.csv",
    "gistemp": "https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv",
}

manifest: dict[str, dict] = {}


def log(*a):
    print("[arena]", *a, flush=True)


def fetch(key_or_url: str, cache: Path) -> Path:
    url = URLS.get(key_or_url, key_or_url)
    name = hashlib.sha1(url.encode()).hexdigest()[:10] + "_" + url.rsplit("/", 1)[-1].split("?")[0]
    dest = cache / name
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    log("download", url)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=300) as r, open(dest, "wb") as f:
        while chunk := r.read(1 << 20):
            f.write(chunk)
    return dest


def write_json(rel: str, data, *, source: str, licence: str, url: str, kind: str, records: int, note: str = ""):
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, separators=(",", ":"))
        f.write("\n")  # end-of-file newline (pre-commit end-of-file-fixer)
    manifest[rel] = {"source": source, "licence": licence, "url": url, "kind": kind,
                     "retrieved": TODAY, "records": records, "bytes": path.stat().st_size, "note": note}
    log(f"wrote {rel} ({path.stat().st_size/1e3:.0f} kB, {records} records)")


def num(v):
    try:
        x = float(v)
        return None if math.isnan(x) else x
    except (TypeError, ValueError):
        return None


# ── Country emissions (Global Carbon Project via Our World in Data) ─────────
def build_countries(cache: Path):
    rows = list(csv.DictReader(open(fetch("owid", cache), newline="")))
    series_fields = ["co2"]
    latest_fields = ["co2", "co2_per_capita", "coal_co2", "oil_co2", "gas_co2", "cement_co2",
                     "flaring_co2", "other_industry_co2", "share_global_co2", "cumulative_co2",
                     "population", "co2_per_gdp", "consumption_co2", "co2_per_unit_energy",
                     "total_ghg", "methane", "nitrous_oxide"]
    by: dict[str, dict] = {}
    for r in rows:
        iso = r["iso_code"] or ("WLD" if r["country"] == "World" else "")
        if not iso or (iso.startswith("OWID") and iso != "OWID_WRL"):
            continue
        iso = "WLD" if iso == "OWID_WRL" else iso
        y = int(r["year"])
        e = by.setdefault(iso, {"iso3": iso, "name": r["country"], "latest": {}, "series": {}})
        for k in latest_fields:
            v = num(r.get(k))
            if v is not None and (k not in e["latest"] or e["latest"][k][1] <= y):
                e["latest"][k] = [round(v, 4), y]
        if y >= 1990:
            for k in series_fields:
                v = num(r.get(k))
                if v is not None:
                    e["series"].setdefault(k, []).append([y, round(v, 3)])
    out = [e for e in by.values() if "co2" in e["latest"]]
    write_json("data/countries-co2.json", out,
               source="Global Carbon Project (GCB) and others, compiled by Our World in Data co2-data",
               licence="CC BY 4.0", url=URLS["owid"], kind="observed", records=len(out),
               note="Territorial fossil CO2 in MtCO2 (co2). Each 'latest' value is [value, year]. "
                    "Latest year may be a preliminary GCB estimate.")


def build_country_shapes(cache: Path):
    gj = json.load(open(fetch("ne_countries", cache)))
    feats = []
    for f in gj["features"]:
        p = f["properties"]
        iso = p.get("ISO_A3_EH") if p.get("ISO_A3_EH") not in (None, "-99") else p.get("ADM0_A3")

        def rnd(c):
            return [rnd(x) for x in c] if isinstance(c[0], list) else [round(c[0], 3), round(c[1], 3)]
        feats.append({"type": "Feature",
                      "properties": {"iso3": iso, "name": p.get("NAME"), "continent": p.get("CONTINENT"),
                                     "lon": p.get("LABEL_X"), "lat": p.get("LABEL_Y")},
                      "geometry": {"type": f["geometry"]["type"], "coordinates": rnd(f["geometry"]["coordinates"])}})
    write_json("data/countries.geojson", {"type": "FeatureCollection", "features": feats},
               source="Natural Earth 1:110m Admin 0 – Countries", licence="Public domain",
               url=URLS["ne_countries"], kind="reference", records=len(feats),
               note="Boundaries are generalised; shown for orientation, not as legal boundaries.")


# ── Power plants (WRI Global Power Plant Database v1.3) ──────────────────────
# Emission factors, tCO2 per MWh of generation. Fuel-level defaults consistent with
# IPCC 2006 Guidelines (Vol. 2) combustion factors at typical fleet efficiencies.
EF = {"Coal": 0.95, "Oil": 0.75, "Gas": 0.45, "Petcoke": 1.00}
DEFAULT_CF = {"Coal": 0.55, "Oil": 0.15, "Gas": 0.40, "Petcoke": 0.55}
KEEP_RENEWABLE = {"Solar", "Wind", "Hydro", "Nuclear", "Geothermal"}


def build_power_plants(cache: Path):
    out = []
    for r in csv.DictReader(open(fetch("gppd", cache), newline="", encoding="utf-8")):
        fuel = r["primary_fuel"]
        cap = num(r["capacity_mw"]) or 0
        fossil = fuel in EF
        if not ((fossil and cap >= 100) or (fuel in KEEP_RENEWABLE and cap >= 150)):
            continue
        gen, gen_year, gen_basis = None, None, None
        for y in range(2019, 2012, -1):
            g = num(r.get(f"generation_gwh_{y}"))
            if g is not None:  # a reported zero is a real observation (unit idle), not missing data
                gen, gen_year, gen_basis = g, y, "reported"
                break
        if gen is None:
            g = num(r.get("estimated_generation_gwh_2017"))
            if g is not None and g > 0:
                gen, gen_year, gen_basis = g, 2017, "wri_estimate"
        if gen is None and fossil:
            gen, gen_year, gen_basis = cap * 8.76 * DEFAULT_CF[fuel], None, "default_capacity_factor"
        co2 = round(gen * EF[fuel] / 1000, 3) if fossil and gen is not None else None  # MtCO2/yr
        out.append([r["gppd_idnr"], r["name"][:60], r["country"], fuel, round(cap),
                    round(float(r["latitude"]), 4), round(float(r["longitude"]), 4),
                    round(gen) if gen is not None else None, gen_year, gen_basis, co2,
                    int(float(r["commissioning_year"])) if num(r["commissioning_year"]) else None,
                    (r["owner"] or "")[:60]])
    write_json("data/power-plants.json",
               {"fields": ["id", "name", "iso3", "fuel", "capacity_mw", "lat", "lon", "generation_gwh",
                           "generation_year", "generation_basis", "co2_mt_est", "commissioned", "owner"],
                "emission_factors_t_per_mwh": EF, "default_capacity_factors": DEFAULT_CF, "rows": out},
               source="WRI Global Power Plant Database v1.3.0", licence="CC BY 4.0", url=URLS["gppd"],
               kind="observed", records=len(out),
               note="Plant locations, capacity and generation are WRI data (last updated 2021). "
                    "co2_mt_est is a Climactix estimate = generation × fuel emission factor; unit efficiency, "
                    "co-firing and CCS are not modelled.")


CW_URL = ("https://www.climatewatchdata.org/api/v1/data/historical_emissions"
          "?gases[]=All%20GHG&source_ids[]=274&per_page=200&page={page}")
CW_SECTORS = ["Electricity/Heat", "Transportation", "Manufacturing/Construction", "Building",
              "Fugitive Emissions", "Other Fuel Combustion", "Industrial Processes", "Agriculture", "Waste",
              "Land Use, Land-Use Change and Forestry", "Bunker Fuels"]


def build_sector_inventory(cache: Path):
    """Climate Watch (CAIT) GHG inventory by sector, all gases, MtCO2e — last 10 years per sector."""
    out: dict[str, dict] = {}
    page = 1
    while True:
        p = fetch(CW_URL.format(page=page), cache)
        rows = json.load(open(p)).get("data", [])
        if not rows:
            break
        for r in rows:
            iso = r.get("iso_code3") or ""
            if len(iso) != 3 or r.get("sector") not in CW_SECTORS:
                continue
            series = sorted(((e["year"], e["value"]) for e in r["emissions"] if e.get("value") is not None))[-10:]
            if not series:
                continue
            e = out.setdefault(iso, {"iso3": iso, "name": r.get("country"), "sectors": {}})
            e["sectors"][r["sector"]] = [[y, round(v, 2)] for y, v in series]
        page += 1
        if page > 120:
            break
    write_json("data/sector-inventory.json", {"unit": "MtCO2e", "gas": "All GHG (AR4 GWP100)", "sectors": CW_SECTORS,
                                             "countries": list(out.values())},
               source="Climate Watch Historical GHG Emissions (CAIT), World Resources Institute",
               licence="CC BY 4.0", url="https://www.climatewatchdata.org/data-explorer/historical-emissions",
               kind="observed", records=len(out),
               note="National inventory estimates by IPCC sector, all greenhouse gases in MtCO2e. "
                    "Last 10 reported years per sector. Electricity/Heat, Transportation, Manufacturing and "
                    "Buildings are energy sub-sectors; LUCF can be negative (net removals).")


def build_airports(cache: Path):
    out = []
    for r in csv.DictReader(open(fetch("airports", cache), newline="", encoding="utf-8")):
        if r["type"] != "large_airport":
            continue
        out.append([r["iata_code"] or r["ident"], r["name"][:60], r["iso_country"],
                    round(float(r["latitude_deg"]), 4), round(float(r["longitude_deg"]), 4)])
    write_json("data/airports.json", {"fields": ["code", "name", "iso2", "lat", "lon"], "rows": out},
               source="OurAirports", licence="Public domain", url=URLS["airports"], kind="reference",
               records=len(out), note="Large airports only. Aviation emissions are not attributed per airport.")


def build_ports(cache: Path):
    gj = json.load(open(fetch("ne_ports", cache)))
    out = [[f["properties"].get("name"), round(f["geometry"]["coordinates"][1], 4),
            round(f["geometry"]["coordinates"][0], 4), f["properties"].get("scalerank")]
           for f in gj["features"] if f["properties"].get("name")]
    write_json("data/ports.json", {"fields": ["name", "lat", "lon", "scalerank"], "rows": out},
               source="Natural Earth 1:10m Ports", licence="Public domain", url=URLS["ne_ports"],
               kind="reference", records=len(out), note="Port locations only; no throughput or emissions.")


def build_gistemp(cache: Path):
    text = open(fetch("gistemp", cache), encoding="utf-8").read().splitlines()
    rows = list(csv.reader(text[1:]))
    hdr = rows[0]
    jd = hdr.index("J-D")
    out = [[int(r[0]), float(r[jd])] for r in rows[1:] if r and r[0].isdigit() and r[jd] not in ("***", "")]
    write_json("data/gistemp-global.json", {"baseline": "1951-1980", "unit": "°C", "rows": out},
               source="NASA GISS Surface Temperature Analysis (GISTEMP v4)", licence="Public domain (NASA)",
               url=URLS["gistemp"], kind="observed", records=len(out),
               note="Annual (Jan–Dec) global mean land-ocean temperature anomaly relative to 1951–1980. "
                    "Not the same baseline as IPCC warming levels (1850–1900).")


# ── Mumbai: Overture buildings, roads, facilities + GHSL heights ─────────────
def duck():
    import duckdb
    c = duckdb.connect()
    c.sql("INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial; "
          "SET s3_region='us-west-2'; SET geometry_always_xy=true;")
    return c


def bbox_where(b):
    return f"bbox.xmin>{b[0]} AND bbox.xmax<{b[2]} AND bbox.ymin>{b[1]} AND bbox.ymax<{b[3]}"


class Ghsl:
    def __init__(self, cache: Path):
        import rasterio
        self.ds = []
        for t in GHSL_TILES:
            z = fetch(GHSL_URL.format(tile=t), cache)
            tif = cache / f"ghsl_{t}.tif"
            if not tif.exists():
                with zipfile.ZipFile(z) as zf:
                    name = next(n for n in zf.namelist() if n.endswith(".tif"))
                    tif.write_bytes(zf.read(name))
            d = rasterio.open(tif)
            self.ds.append((d, d.read(1)))

    def height(self, lon, lat):
        for d, arr in self.ds:
            b = d.bounds
            if b.left <= lon < b.right and b.bottom < lat <= b.top:
                r, c = d.index(lon, lat)
                v = float(arr[r, c])
                return v if v > 0 else None
        return None


def build_mumbai(cache: Path):
    import numpy as np
    import mapbox_earcut as earcut
    from shapely import wkb
    from shapely.geometry import Polygon

    c = duck()
    log("query Overture buildings", OVERTURE_RELEASE)
    rows = c.sql(f"""
        SELECT ST_AsWKB(geometry), height, num_floors, class, names.primary
        FROM read_parquet('{OVERTURE}/theme=buildings/type=building/*', hive_partitioning=1)
        WHERE {bbox_where(CITY_BBOX)}""").fetchall()
    log("buildings fetched", len(rows))
    ghsl = Ghsl(cache)

    lon0 = (CITY_BBOX[0] + CITY_BBOX[2]) / 2
    lat0 = (CITY_BBOX[1] + CITY_BBOX[3]) / 2
    m_per_deg_lat = 111132.92 - 559.82 * math.cos(2 * math.radians(lat0))
    m_per_deg_lon = 111412.84 * math.cos(math.radians(lat0))

    tiles: dict[tuple[int, int], list] = {}
    stats = {"osm_height": 0, "floors": 0, "ghsl": 0, "minimum": 0, "skipped_small": 0}
    for g, h, nf, cls, name in rows:
        geom = wkb.loads(bytes(g))
        polys = list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom]
        for poly in polys:
            if not isinstance(poly, Polygon) or poly.is_empty:
                continue
            cx, cy = poly.centroid.x, poly.centroid.y
            area = poly.area * m_per_deg_lat * m_per_deg_lon
            if area < 20:
                stats["skipped_small"] += 1
                continue
            if h:
                height, basis = float(h), 0; stats["osm_height"] += 1
            elif nf:
                height, basis = float(nf) * 3.1 + 1.0, 1; stats["floors"] += 1
            else:
                gh = ghsl.height(cx, cy)
                if gh:
                    height, basis = gh, 2; stats["ghsl"] += 1
                else:
                    height, basis = 4.0, 3; stats["minimum"] += 1
            height = max(3.0, min(height, 400.0))
            simp = poly.simplify(0.000004, preserve_topology=True)  # ~0.4 m
            if simp.is_empty or not isinstance(simp, Polygon):
                simp = poly
            key = (int((cx - CITY_BBOX[0]) / CITY_TILE_DEG), int((cy - CITY_BBOX[1]) / CITY_TILE_DEG))
            tiles.setdefault(key, []).append((simp, height, basis))
    log("height basis", stats)

    tile_dir = OUT / "mumbai" / "tiles"
    tile_dir.mkdir(parents=True, exist_ok=True)
    for old in tile_dir.glob("*.glb"):
        old.unlink()

    def extrude(items, tlon, tlat):
        """Shared-vertex extrusion: one ground ring + one roof ring per building ring.
        No NORMAL attribute — the arena shader derives flat normals from screen-space
        derivatives, which lets walls and roofs share vertices (≈5× fewer vertices)."""
        pos, col, idx = [], [], []
        maxh = 0.0

        def to_local(lon, lat):
            return ((lon - tlon) * m_per_deg_lon, (lat - tlat) * m_per_deg_lat)

        for poly, hgt, basis in items:
            ext = [to_local(*p) for p in list(poly.exterior.coords)[:-1]]
            if len(ext) < 3:
                continue
            holes = [[to_local(*p) for p in list(r.coords)[:-1]] for r in poly.interiors]
            holes = [h_ for h_ in holes if len(h_) >= 3]
            seed = int(hashlib.md5(f"{ext[0][0]:.2f},{ext[0][1]:.2f}".encode()).hexdigest()[:2], 16)
            c4 = (min(255, int(round(hgt))), seed, basis * 60, 255)
            maxh = max(maxh, hgt)
            ring_pts = ext + [p for h_ in holes for p in h_]
            n = len(ring_pts)
            rings = [len(ext)]
            for h_ in holes:
                rings.append(rings[-1] + len(h_))
            base = len(pos)
            for (x, y) in ring_pts:          # ground ring  [base, base+n)
                pos.append((x, 0.0, -y)); col.append(c4)
            for (x, y) in ring_pts:          # roof ring    [base+n, base+2n)
                pos.append((x, hgt, -y)); col.append(c4)
            tri = earcut.triangulate_float32(np.array(ring_pts, dtype=np.float32), np.array(rings, dtype=np.uint32))
            idx.extend(int(t) + base + n for t in tri)
            start_i = 0
            for end_i in rings:
                for i in range(start_i, end_i):
                    j = i + 1 if i + 1 < end_i else start_i
                    a_, b_, c_, d_ = base + i, base + j, base + n + j, base + n + i
                    idx.extend([a_, b_, c_, a_, c_, d_])
                start_i = end_i
        if not idx:
            return None, 0.0
        return make_glb(np.array(pos, np.float32), np.array(col, np.uint8), np.array(idx, np.uint32)), maxh

    leaf_nodes, coarse_nodes = [], {}
    total_bytes = 0
    for (ix, iy), items in sorted(tiles.items()):
        w = CITY_BBOX[0] + ix * CITY_TILE_DEG
        s = CITY_BBOX[1] + iy * CITY_TILE_DEG
        tlon, tlat = w + CITY_TILE_DEG / 2, s + CITY_TILE_DEG / 2
        glb, maxh = extrude(items, tlon, tlat)
        if glb is None:
            continue
        name = f"{ix}_{iy}.glb"
        (tile_dir / name).write_bytes(glb)
        total_bytes += len(glb)
        leaf_nodes.append({"ix": ix, "iy": iy, "w": w, "s": s, "lon": tlon, "lat": tlat, "maxh": maxh,
                           "uri": f"tiles/{name}", "count": len(items)})

    # Coarse LOD (4×4 leaf blocks): larger/taller buildings as oriented rectangles.
    blocks: dict[tuple[int, int], list] = {}
    for (ix, iy), items in tiles.items():
        for poly, hgt, basis in items:
            area = poly.area * m_per_deg_lat * m_per_deg_lon
            if area >= 600 or (hgt >= 25 and area >= 150):
                rect = poly.minimum_rotated_rectangle
                if isinstance(rect, Polygon):
                    blocks.setdefault((ix // 4, iy // 4), []).append((rect, hgt, basis))
    for (bx, by), items in blocks.items():
        w = CITY_BBOX[0] + bx * 4 * CITY_TILE_DEG
        s = CITY_BBOX[1] + by * 4 * CITY_TILE_DEG
        tlon, tlat = w + 2 * CITY_TILE_DEG, s + 2 * CITY_TILE_DEG
        glb, maxh = extrude(items, tlon, tlat)
        if glb is None:
            continue
        name = f"lod1_{bx}_{by}.glb"
        (tile_dir / name).write_bytes(glb)
        total_bytes += len(glb)
        coarse_nodes[(bx, by)] = {"lon": tlon, "lat": tlat, "uri": f"tiles/{name}", "maxh": maxh}

    tileset = build_tileset(leaf_nodes, coarse_nodes)
    (OUT / "mumbai" / "tileset.json").write_text(json.dumps(tileset, separators=(",", ":")) + "\n")
    manifest["mumbai/tileset.json"] = {
        "source": f"Overture Maps Foundation buildings ({OVERTURE_RELEASE}); heights from OpenStreetMap tags where present, "
                  "otherwise JRC GHSL GHS-BUILT-H R2023A (2018 epoch, ~90 m average net building height)",
        "licence": "ODbL 1.0 (Overture/OSM-derived buildings) · CC BY 4.0 (GHSL)",
        "url": "https://docs.overturemaps.org/guides/buildings/ · https://human-settlement.emergency.copernicus.eu/ghs_buildH2023.php",
        "kind": "observed+estimated", "retrieved": TODAY, "height_basis": stats,
        "records": sum(n["count"] for n in leaf_nodes), "bytes": total_bytes, "tiles": len(leaf_nodes),
        "note": "Height basis per building (COLOR_0.b × 255 / 60): 0 = OSM height tag, 1 = OSM floor count × 3.1 m + 1 m, "
                "2 = GHSL cell mean height (buildings in the same ~90 m cell share one value), 3 = 4 m minimum. "
                f"Counts: {stats}",
    }
    log(f"tileset: {len(leaf_nodes)} tiles, {total_bytes/1e6:.1f} MB")

    # roads + rail for traffic animation and infrastructure overlays
    log("query Overture transportation")
    seg = c.sql(f"""
        SELECT subtype, class, names.primary, ST_AsGeoJSON(geometry)
        FROM read_parquet('{OVERTURE}/theme=transportation/type=segment/*', hive_partitioning=1)
        WHERE {bbox_where(CITY_BBOX)} AND (
            (subtype='road' AND class IN ('motorway','trunk','primary','secondary')) OR subtype='rail')
    """).fetchall()
    roads, rail = [], []
    for st, cls, name, gj in seg:
        coords = json.loads(gj)["coordinates"]
        line = [[round(x, 5), round(y, 5)] for x, y in coords]
        if len(line) < 2:
            continue
        (rail if st == "rail" else roads).append({"c": cls, "n": name, "p": line})
    write_json("mumbai/transport.json", {"roads": roads, "rail": rail},
               source=f"Overture Maps Foundation transportation ({OVERTURE_RELEASE})", licence="ODbL 1.0",
               url="https://docs.overturemaps.org/guides/transportation/", kind="observed",
               records=len(roads) + len(rail), note="Road classes motorway–secondary and rail segments.")

    # facility footprints by name (attributes curated in src/lib/arena/mumbai.ts)
    names = ["Trombay Thermal Power Station", "Mumbai Refinery Mahul", "Mumbai Refinery",
             "Rashtriya Chemicals & Fertilizers", "Mumbai Port Trust", "Jawaharlal Nehru Port",
             "Chhatrapati Shivaji Maharaj International Airport", "Sewri Dockyard",
             "Mazagon Dock Shipbuilders Limited", "Wadala Truck Terminal", "Sassoon Docks", "Uran",
             "Navi Mumbai International Airport", "Kurla EMU Carshed"]
    quoted = ",".join("'" + n.replace("'", "''") + "'" for n in names)
    fac = c.sql(f"""
        SELECT names.primary, type, ST_AsGeoJSON(ST_SimplifyPreserveTopology(geometry, 0.00005))
        FROM read_parquet('{OVERTURE}/theme=base/type=*/*', hive_partitioning=1, union_by_name=true)
        WHERE bbox.xmin>72.75 AND bbox.xmax<73.10 AND bbox.ymin>18.85 AND bbox.ymax<19.30
          AND names.primary IN ({quoted})
          AND ST_GeometryType(geometry) IN ('POLYGON','MULTIPOLYGON')
    """).fetchall()
    seen, feats = set(), []
    for name, typ, gj in fac:
        if name in seen:
            continue
        seen.add(name)
        feats.append({"type": "Feature", "properties": {"name": name, "overture_type": typ}, "geometry": json.loads(gj)})
    write_json("mumbai/facilities.geojson", {"type": "FeatureCollection", "features": feats},
               source=f"Overture Maps Foundation base land use / infrastructure ({OVERTURE_RELEASE})",
               licence="ODbL 1.0", url="https://docs.overturemaps.org/guides/base/", kind="observed",
               records=len(feats), note="Footprints only. Operational and emissions attributes are curated "
                                        "separately and labelled by provenance in the UI.")


def make_glb(pos, col, idx) -> bytes:
    """GLB with KHR_mesh_quantization: int16 positions in decimetres (node scale 0.1)."""
    import numpy as np
    def pad(b, ch=b"\x00"):
        return b + ch * ((4 - len(b) % 4) % 4)
    q = np.round(pos * 10.0).astype(np.int16)
    q4 = np.zeros((len(q), 4), np.int16); q4[:, :3] = q          # stride 8 (4-byte aligned)
    bufs = [q4.tobytes(), col.tobytes(), idx.tobytes()]
    offsets, off = [], 0
    for b in bufs:
        offsets.append(off); off += len(pad(b))
    binary = b"".join(pad(b) for b in bufs)
    gltf = {
        "asset": {"version": "2.0", "generator": "climactix-arena-databuild"},
        "extensionsUsed": ["KHR_mesh_quantization"], "extensionsRequired": ["KHR_mesh_quantization"],
        "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0, "scale": [0.1, 0.1, 0.1]}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "COLOR_0": 1},
                                    "indices": 2, "material": 0, "mode": 4}]}],
        "materials": [{"doubleSided": True, "pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1],
                                                                      "metallicFactor": 0.0, "roughnessFactor": 0.85}}],
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": offsets[0], "byteLength": len(bufs[0]), "byteStride": 8, "target": 34962},
            {"buffer": 0, "byteOffset": offsets[1], "byteLength": len(bufs[1]), "target": 34962},
            {"buffer": 0, "byteOffset": offsets[2], "byteLength": len(bufs[2]), "target": 34963},
        ],
        "accessors": [
            {"bufferView": 0, "componentType": 5122, "count": len(q), "type": "VEC3",
             "min": q.min(0).tolist(), "max": q.max(0).tolist()},
            {"bufferView": 1, "componentType": 5121, "normalized": True, "count": len(col), "type": "VEC4"},
            {"bufferView": 2, "componentType": 5125, "count": len(idx), "type": "SCALAR"},
        ],
    }
    js = pad(json.dumps(gltf, separators=(",", ":")).encode(), b" ")
    total = 12 + 8 + len(js) + 8 + len(binary)
    return (struct.pack("<III", 0x46546C67, 2, total) + struct.pack("<II", len(js), 0x4E4F534A) + js
            + struct.pack("<II", len(binary), 0x004E4942) + binary)


def enu_matrix(lon, lat):
    """Column-major ENU→ECEF transform at (lon, lat, 0) on WGS84."""
    a, f = 6378137.0, 1 / 298.257223563
    e2 = f * (2 - f)
    lo, la = math.radians(lon), math.radians(lat)
    N = a / math.sqrt(1 - e2 * math.sin(la) ** 2)
    x = N * math.cos(la) * math.cos(lo); y = N * math.cos(la) * math.sin(lo); z = N * (1 - e2) * math.sin(la)
    east = (-math.sin(lo), math.cos(lo), 0.0)
    north = (-math.sin(la) * math.cos(lo), -math.sin(la) * math.sin(lo), math.cos(la))
    up = (math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la))
    return [*east, 0, *north, 0, *up, 0, x, y, z, 1]


def build_tileset(leaves, coarse):
    """Quadtree over leaf tiles. Size-4 nodes carry coarse block content and REPLACE-refine
    into full-detail leaves, so the city never disappears between LODs."""
    def region(w, s, e, n, h):
        return {"region": [math.radians(w), math.radians(s), math.radians(e), math.radians(n), -5, h + 5]}

    def node(ix0, iy0, size):
        kids = [l for l in leaves if ix0 <= l["ix"] < ix0 + size and iy0 <= l["iy"] < iy0 + size]
        if not kids:
            return None
        if size == 1:
            l = kids[0]
            return {"boundingVolume": region(l["w"], l["s"], l["w"] + CITY_TILE_DEG, l["s"] + CITY_TILE_DEG, l["maxh"]),
                    "geometricError": 0, "transform": enu_matrix(l["lon"], l["lat"]), "content": {"uri": l["uri"]}}
        half = size // 2
        children = [c for c in (node(ix0, iy0, half), node(ix0 + half, iy0, half),
                                node(ix0, iy0 + half, half), node(ix0 + half, iy0 + half, half)) if c]
        w = CITY_BBOX[0] + ix0 * CITY_TILE_DEG; s = CITY_BBOX[1] + iy0 * CITY_TILE_DEG
        out = {"boundingVolume": region(w, s, w + size * CITY_TILE_DEG, s + size * CITY_TILE_DEG,
                                        max(l["maxh"] for l in kids)),
               "geometricError": {1: 0, 2: 120.0, 4: 120.0}.get(size, 160.0 * size),
               "refine": "REPLACE" if size <= 4 else "ADD", "children": children}
        if size == 4 and (ix0 // 4, iy0 // 4) in coarse:
            c = coarse[(ix0 // 4, iy0 // 4)]
            # content lives in the block's own ENU frame; children carry their own transforms
            out["children"] = [{"boundingVolume": out["boundingVolume"], "geometricError": 120.0, "refine": "REPLACE",
                                "children": children}]
            out = {"boundingVolume": out["boundingVolume"], "geometricError": 120.0, "refine": "REPLACE",
                   "transform": enu_matrix(c["lon"], c["lat"]), "content": {"uri": c["uri"]},
                   "children": [_untransform(ch, c["lon"], c["lat"]) for ch in out["children"]]}
        return out

    span = max(max(l["ix"] for l in leaves), max(l["iy"] for l in leaves)) + 1
    size = 1
    while size < span:
        size *= 2
    root = node(0, 0, size)
    return {"asset": {"version": "1.1", "generator": "climactix-arena-databuild"},
            "geometricError": root["geometricError"] * 2, "root": root}


def _mat_mul(a, b):
    """Column-major 4×4 multiply a·b."""
    return [sum(a[k * 4 + r] * b[c * 4 + k] for k in range(4)) for c in range(4) for r in range(4)]


def _mat_inv_rigid(m):
    """Inverse of a column-major rigid transform (rotation + translation)."""
    r = [[m[c * 4 + rr] for c in range(3)] for rr in range(3)]  # r[row][col]
    t = m[12:15]
    rt = [[r[c][rr] for c in range(3)] for rr in range(3)]
    ti = [-sum(rt[rr][k] * t[k] for k in range(3)) for rr in range(3)]
    return [rt[0][0], rt[1][0], rt[2][0], 0, rt[0][1], rt[1][1], rt[2][1], 0,
            rt[0][2], rt[1][2], rt[2][2], 0, ti[0], ti[1], ti[2], 1]


def _untransform(tile, lon, lat):
    """Children's transforms are absolute ENU frames; make them relative to the parent frame."""
    inv = _mat_inv_rigid(enu_matrix(lon, lat))

    def walk(t):
        t = dict(t)
        if "transform" in t:
            t["transform"] = _mat_mul(inv, t["transform"])
        if "children" in t:
            t["children"] = [walk_abs(c) for c in t["children"]]
        return t

    def walk_abs(t):
        # only the first transformed tile on each branch needs re-basing
        if "transform" in t:
            t = dict(t); t["transform"] = _mat_mul(inv, t["transform"]); return t
        t = dict(t)
        if "children" in t:
            t["children"] = [walk_abs(c) for c in t["children"]]
        return t

    return walk_abs(tile)


def build_mumbai_water(cache: Path):
    """Overture water polygons around Mumbai: rivers, creeks, lakes, reservoirs, mangrove channels."""
    c = duck()
    rows = c.sql(f"""
        SELECT subtype, class, names.primary, ST_AsGeoJSON(ST_SimplifyPreserveTopology(geometry, 0.00003))
        FROM read_parquet('{OVERTURE}/theme=base/type=water/*', hive_partitioning=1)
        WHERE bbox.xmin>72.76 AND bbox.xmax<73.08 AND bbox.ymin>18.86 AND bbox.ymax<19.30
          AND ST_GeometryType(geometry) IN ('POLYGON','MULTIPOLYGON')
          AND subtype IN ('river','lake','reservoir','stream','canal','water','pond','lagoon')
          AND ST_Area_Spheroid(geometry) > 4000
    """).fetchall()
    feats = []
    for st, cls, name, gj in rows:
        geom = json.loads(gj)
        def rnd(cc):
            return [rnd(x) for x in cc] if isinstance(cc[0], list) else [round(cc[0], 5), round(cc[1], 5)]
        geom["coordinates"] = rnd(geom["coordinates"])
        feats.append({"type": "Feature", "properties": {"subtype": st, "class": cls, "name": name}, "geometry": geom})
    write_json("mumbai/water.geojson", {"type": "FeatureCollection", "features": feats},
               source=f"Overture Maps Foundation base theme — water ({OVERTURE_RELEASE})", licence="ODbL 1.0",
               url="https://docs.overturemaps.org/guides/base/", kind="observed", records=len(feats),
               note="Inland water polygons > 0.4 ha (rivers, creeks, lakes, reservoirs). Open sea is not included.")


STEPS = ["countries", "shapes", "plants", "airports", "ports", "gistemp", "sectors", "buildings", "water"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default=str(ROOT / ".arena-cache"))
    ap.add_argument("--skip-buildings", action="store_true")
    ap.add_argument("--only", default="", help=f"comma-separated subset of {STEPS}")
    args = ap.parse_args()
    cache = Path(args.cache); cache.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    mpath = OUT / "manifest.json"
    if mpath.exists():
        manifest.update(json.loads(mpath.read_text()).get("datasets", {}))
    only = {s.strip() for s in args.only.split(",") if s.strip()}
    run = (lambda s: s in only) if only else (lambda s: not (s == "buildings" and args.skip_buildings))
    if run("countries"): build_countries(cache)
    if run("shapes"): build_country_shapes(cache)
    if run("plants"): build_power_plants(cache)
    if run("airports"): build_airports(cache)
    if run("ports"): build_ports(cache)
    if run("gistemp"): build_gistemp(cache)
    if run("sectors"): build_sector_inventory(cache)
    if run("buildings"): build_mumbai(cache)
    if run("water"): build_mumbai_water(cache)
    mpath.write_text(json.dumps({"generated": TODAY, "datasets": manifest}, indent=2) + "\n")
    log("manifest written")


if __name__ == "__main__":
    sys.exit(main())
