"""
Climactix Green Production — Carbon Calculation Engine v1.0
Converts logged production activity into CO2e using the multi-country
emission factor database (see backend/migrations/004_green_production_schema.sql).

Architecture:
  Activity (category + region + quantity) -> Factor Lookup (region, with
  Global fallback) -> CO2e -> Persisted Activity Log -> Phase/Department
  Aggregation -> Total Production Carbon Footprint

Every computed CO2e value stores which factor and region were actually
used, so the result is always explainable and auditable.

Proprietary IP of Climactix Global. All rights reserved.
"""

from __future__ import annotations
from datetime import date, timedelta
from typing import Optional

import asyncpg


# ── Factor lookup ────────────────────────────────────────────────────────────

async def get_factor(pool: asyncpg.Pool, factor_key: str, region: str) -> dict:
    """
    Look up an emission factor for (factor_key, region). Falls back to the
    'Global' row when no country-specific factor exists — this is expected
    for fuel-combustion and material factors that don't meaningfully vary
    by country (see migration comments for source citations).
    """
    row = await pool.fetchrow(
        "SELECT factor_key, region, unit, factor_kgco2e_per_unit, source, notes "
        "FROM green_emission_factors WHERE factor_key = $1 AND region = $2",
        factor_key, region,
    )
    region_used = region
    if row is None:
        row = await pool.fetchrow(
            "SELECT factor_key, region, unit, factor_kgco2e_per_unit, source, notes "
            "FROM green_emission_factors WHERE factor_key = $1 AND region = 'Global'",
            factor_key,
        )
        region_used = "Global"
    if row is None:
        raise ValueError(f"no emission factor found for factor_key='{factor_key}'")

    return {
        "factorKey": row["factor_key"],
        "regionRequested": region,
        "regionUsed": region_used,
        "unit": row["unit"],
        "factorKgCo2ePerUnit": float(row["factor_kgco2e_per_unit"]),
        "source": row["source"],
        "notes": row["notes"],
    }


async def get_category(pool: asyncpg.Pool, category_id: str) -> dict:
    row = await pool.fetchrow(
        "SELECT id, department, label, unit, factor_key, applicable_phases, description "
        "FROM green_activity_categories WHERE id = $1",
        category_id,
    )
    if row is None:
        raise ValueError(f"unknown activity category '{category_id}'")
    return {
        "id": row["id"],
        "department": row["department"],
        "label": row["label"],
        "unit": row["unit"],
        "factorKey": row["factor_key"],
        "applicablePhases": list(row["applicable_phases"]),
        "description": row["description"],
    }


async def list_categories(pool: asyncpg.Pool, phase: Optional[str] = None) -> list[dict]:
    rows = await pool.fetch(
        "SELECT id, department, label, unit, factor_key, applicable_phases, description, sort_order "
        "FROM green_activity_categories ORDER BY sort_order"
    )
    result = []
    for r in rows:
        phases = list(r["applicable_phases"])
        if phase and phase not in phases:
            continue
        result.append({
            "id": r["id"], "department": r["department"], "label": r["label"],
            "unit": r["unit"], "factorKey": r["factor_key"], "applicablePhases": phases,
            "description": r["description"],
        })
    return result


# ── Activity logging ─────────────────────────────────────────────────────────

async def log_activity(
    pool: asyncpg.Pool,
    production_id: str,
    category_id: str,
    phase: str,
    quantity: float,
    region: str = "Global",
    location_id: Optional[str] = None,
    notes: Optional[str] = None,
    logged_by: Optional[str] = None,
    activity_date: Optional[date] = None,
) -> dict:
    """Compute CO2e for one activity entry and persist it, dated to the
    production day it actually happened on (defaults to today) — this is
    what lets the timeline report reconstruct a day-1-to-wrap data log
    rather than just an undated aggregate."""
    if quantity < 0:
        raise ValueError("quantity must be non-negative")
    if activity_date is None:
        activity_date = date.today()

    category = await get_category(pool, category_id)
    if phase not in category["applicablePhases"]:
        raise ValueError(
            f"phase '{phase}' is not applicable to category '{category_id}' "
            f"(applicable: {category['applicablePhases']})"
        )

    factor = await get_factor(pool, category["factorKey"], region)
    co2e_kg = round(quantity * factor["factorKgCo2ePerUnit"], 4)

    row = await pool.fetchrow(
        """
        INSERT INTO green_activity_logs
          (production_id, location_id, category_id, phase, region, quantity,
           co2e_kg, factor_key_used, factor_value_used, notes, logged_by, activity_date)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING id, created_at
        """,
        production_id, location_id, category_id, phase, factor["regionUsed"], quantity,
        co2e_kg, factor["factorKey"], factor["factorKgCo2ePerUnit"], notes, logged_by, activity_date,
    )

    return {
        "id": row["id"],
        "productionId": production_id,
        "categoryId": category_id,
        "categoryLabel": category["label"],
        "department": category["department"],
        "phase": phase,
        "quantity": quantity,
        "unit": category["unit"],
        "activityDate": activity_date.isoformat(),
        "regionRequested": region,
        "regionUsed": factor["regionUsed"],
        "factorKey": factor["factorKey"],
        "factorKgCo2ePerUnit": factor["factorKgCo2ePerUnit"],
        "factorSource": factor["source"],
        "co2eKg": co2e_kg,
        "createdAt": row["created_at"].isoformat(),
    }


# ── Footprint aggregation ─────────────────────────────────────────────────────

_WASTE_DISPOSAL_FACTOR_LANDFILL = "landfill_waste_kg"
_WASTE_DISPOSAL_FACTOR_RECYCLED = "recycled_waste_kg"


async def _waste_co2e(pool: asyncpg.Pool, production_id: str) -> float:
    """Waste carries its own CO2e via landfill/recycling disposal factors,
    on top of the material-embodied carbon already logged for set construction."""
    rows = await pool.fetch(
        "SELECT quantity_kg, pct_recycled, pct_reused, pct_landfill "
        "FROM green_waste_records WHERE production_id = $1",
        production_id,
    )
    if not rows:
        return 0.0

    landfill_factor = await get_factor(pool, _WASTE_DISPOSAL_FACTOR_LANDFILL, "Global")
    recycled_factor = await get_factor(pool, _WASTE_DISPOSAL_FACTOR_RECYCLED, "Global")

    total = 0.0
    for r in rows:
        landfill_kg = float(r["quantity_kg"]) * float(r["pct_landfill"]) / 100
        diverted_kg = float(r["quantity_kg"]) * (float(r["pct_recycled"]) + float(r["pct_reused"])) / 100
        total += landfill_kg * landfill_factor["factorKgCo2ePerUnit"]
        total += diverted_kg * recycled_factor["factorKgCo2ePerUnit"]
    return round(total, 4)


_DATALOG_CO2E_TABLES = (
    ("green_fuel_vehicle_logs", "fuel_vehicle_log"),
    ("green_crew_travel_logs", "crew_travel_log"),
    ("green_shoot_stay_trip_logs", "shoot_stay_trip_log"),
    ("green_energy_logs", "energy_log"),
    ("green_materials_logs", "materials_log"),
    ("green_accommodation_logs", "accommodation_log"),
    ("green_food_catering_logs", "food_catering_log"),
)


async def _datalog_co2e_total(pool: asyncpg.Pool, production_id: str) -> tuple[float, list[dict]]:
    """Sums CO2e already computed on the granular Production Data Log
    sheets (Fuel & Vehicles, Crew Travel, Shoot-Stay Trips, Energy,
    Materials, Accommodation, Food & Catering) so the footprint/timeline
    reflect the full data log, not just the quick single-entry logger."""
    total = 0.0
    by_source: list[dict] = []
    for table, label in _DATALOG_CO2E_TABLES:
        row = await pool.fetchrow(
            f"SELECT COALESCE(SUM(co2e_kg),0) AS co2e_kg, COUNT(co2e_kg) AS entry_count "
            f"FROM {table} WHERE production_id = $1",
            production_id,
        )
        co2e = float(row["co2e_kg"] or 0)
        if co2e:
            total += co2e
            by_source.append({"source": label, "co2eKg": round(co2e, 2), "entryCount": row["entry_count"]})
    return round(total, 2), by_source


async def get_production_footprint(pool: asyncpg.Pool, production_id: str) -> dict:
    """Full carbon footprint: total CO2e, broken down by phase, department,
    and category, plus a per-crew-day intensity metric for benchmarking."""
    prod = await pool.fetchrow(
        "SELECT crew_size_expected, timeline_start, timeline_end, film_type "
        "FROM green_productions WHERE id = $1",
        production_id,
    )
    if prod is None:
        raise ValueError(f"unknown production '{production_id}'")

    rows = await pool.fetch(
        """
        SELECT l.phase, c.department, l.category_id, c.label AS category_label,
               SUM(l.co2e_kg) AS co2e_kg, COUNT(*) AS entry_count
        FROM green_activity_logs l
        JOIN green_activity_categories c ON c.id = l.category_id
        WHERE l.production_id = $1
        GROUP BY l.phase, c.department, l.category_id, c.label
        """,
        production_id,
    )

    activity_co2e = sum(float(r["co2e_kg"] or 0) for r in rows)
    waste_co2e = await _waste_co2e(pool, production_id)
    datalog_co2e, datalog_by_source = await _datalog_co2e_total(pool, production_id)
    total_co2e = round(activity_co2e + waste_co2e + datalog_co2e, 2)

    by_phase: dict[str, float] = {}
    by_department: dict[str, float] = {}
    by_category: list[dict] = []
    for r in rows:
        co2e = float(r["co2e_kg"] or 0)
        by_phase[r["phase"]] = round(by_phase.get(r["phase"], 0) + co2e, 2)
        by_department[r["department"]] = round(by_department.get(r["department"], 0) + co2e, 2)
        by_category.append({
            "categoryId": r["category_id"], "label": r["category_label"],
            "phase": r["phase"], "department": r["department"],
            "co2eKg": round(co2e, 2), "entryCount": r["entry_count"],
        })
    by_category.sort(key=lambda x: x["co2eKg"], reverse=True)
    if waste_co2e:
        by_department["waste_disposal"] = round(by_department.get("waste_disposal", 0) + waste_co2e, 2)
    for source in datalog_by_source:
        by_department[source["source"]] = round(by_department.get(source["source"], 0) + source["co2eKg"], 2)

    crew_size = prod["crew_size_expected"] or 0
    shoot_days = None
    if prod["timeline_start"] and prod["timeline_end"]:
        shoot_days = max((prod["timeline_end"] - prod["timeline_start"]).days, 1)

    co2e_per_crew_day = None
    if crew_size and shoot_days:
        co2e_per_crew_day = round(total_co2e / (crew_size * shoot_days), 3)

    return {
        "productionId": production_id,
        "totalCo2eKg": total_co2e,
        "activityCo2eKg": round(activity_co2e, 2),
        "wasteDisposalCo2eKg": waste_co2e,
        "dataLogCo2eKg": datalog_co2e,
        "dataLogBySource": datalog_by_source,
        "byPhase": by_phase,
        "byDepartment": by_department,
        "byCategory": by_category,
        "topEmittingCategories": by_category[:5],
        "crewSizeExpected": crew_size,
        "shootDays": shoot_days,
        "co2ePerCrewDay": co2e_per_crew_day,
        "filmType": prod["film_type"],
    }


# ── Day-by-day production timeline ────────────────────────────────────────────

async def get_production_timeline(pool: asyncpg.Pool, production_id: str) -> dict:
    """
    Day-indexed report spanning the full production window (timeline_start
    through timeline_end) — this is what makes the platform a continuous
    data log from day 1 of the shoot through wrap, not a one-shot calculator.
    Every calendar day in the window gets an entry (zero-filled if nothing
    was logged that day), plus a running cumulative total and a same-pace
    projection for the remaining days.
    """
    prod = await pool.fetchrow(
        "SELECT production_name, timeline_start, timeline_end FROM green_productions WHERE id = $1",
        production_id,
    )
    if prod is None:
        raise ValueError(f"unknown production '{production_id}'")
    start, end = prod["timeline_start"], prod["timeline_end"]
    if start is None or end is None:
        raise ValueError("production has no timeline_start/timeline_end set — cannot build a daily timeline")
    if end < start:
        raise ValueError("timeline_end is before timeline_start")

    co2e_rows = await pool.fetch(
        "SELECT activity_date, SUM(co2e_kg) AS co2e_kg FROM green_activity_logs "
        "WHERE production_id = $1 GROUP BY activity_date",
        production_id,
    )
    water_rows = await pool.fetch(
        "SELECT recorded_at, SUM(volume_liters) AS liters FROM green_water_records "
        "WHERE production_id = $1 GROUP BY recorded_at",
        production_id,
    )
    waste_rows = await pool.fetch(
        "SELECT recorded_at, SUM(quantity_kg) AS kg FROM green_waste_records "
        "WHERE production_id = $1 GROUP BY recorded_at",
        production_id,
    )
    co2e_by_day = {r["activity_date"]: float(r["co2e_kg"] or 0) for r in co2e_rows}
    water_by_day = {r["recorded_at"]: float(r["liters"] or 0) for r in water_rows}
    waste_by_day = {r["recorded_at"]: float(r["kg"] or 0) for r in waste_rows}

    for table, _label in _DATALOG_CO2E_TABLES:
        rows = await pool.fetch(
            f"SELECT log_date, SUM(co2e_kg) AS co2e_kg FROM {table} "
            f"WHERE production_id = $1 GROUP BY log_date",
            production_id,
        )
        for r in rows:
            co2e_by_day[r["log_date"]] = co2e_by_day.get(r["log_date"], 0.0) + float(r["co2e_kg"] or 0)

    total_days = (end - start).days + 1
    today = date.today()

    days = []
    cumulative = 0.0
    for i in range(total_days):
        d = start + timedelta(days=i)
        day_co2e = round(co2e_by_day.get(d, 0.0), 2)
        cumulative = round(cumulative + day_co2e, 2)
        days.append({
            "date": d.isoformat(),
            "dayNumber": i + 1,
            "co2eKg": day_co2e,
            "cumulativeCo2eKg": cumulative,
            "waterLiters": round(water_by_day.get(d, 0.0), 1),
            "wasteKg": round(waste_by_day.get(d, 0.0), 1),
            "hasActivity": d in co2e_by_day or d in water_by_day or d in waste_by_day,
            "isFuture": d > today,
        })

    days_with_activity = sum(1 for d in days if d["hasActivity"])
    total_co2e = cumulative
    avg_co2e_per_active_day = round(total_co2e / days_with_activity, 2) if days_with_activity else None
    projected_total_co2e = round(avg_co2e_per_active_day * total_days, 2) if avg_co2e_per_active_day else None

    elapsed_days = max(0, min((min(today, end) - start).days + 1, total_days)) if today >= start else 0

    return {
        "productionId": production_id,
        "productionName": prod["production_name"],
        "timelineStart": start.isoformat(),
        "timelineEnd": end.isoformat(),
        "totalDays": total_days,
        "elapsedDays": elapsed_days,
        "daysRemaining": max(total_days - elapsed_days, 0),
        "daysWithActivity": days_with_activity,
        "totalCo2eKgToDate": total_co2e,
        "avgCo2ePerActiveDay": avg_co2e_per_active_day,
        "projectedTotalCo2eKg": projected_total_co2e,
        "days": days,
    }
