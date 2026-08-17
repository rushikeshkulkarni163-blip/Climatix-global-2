"""
Climactix Green Production — Water & Waste Engine v1.0
Tracks volumetric water consumption/recycling and mass-based waste
generation/diversion, independent of the CO2e carbon engine (though waste
disposal also feeds a CO2e term — see green_carbon_engine._waste_co2e).

Proprietary IP of Climactix Global. All rights reserved.
"""

from __future__ import annotations
from datetime import date
from typing import Optional

import asyncpg

WATER_SOURCES = ("crew", "hotel", "set", "cleaning", "catering", "sanitation")
WASTE_TYPES = ("plastic", "paper", "glass", "metal", "wood", "food",
               "construction", "hazardous", "electronic", "battery")


# ── Water ─────────────────────────────────────────────────────────────────────

async def log_water_record(
    pool: asyncpg.Pool,
    production_id: str,
    phase: str,
    source: str,
    volume_liters: float,
    greywater_recycled_liters: float = 0,
    location_id: Optional[str] = None,
    notes: Optional[str] = None,
    recorded_at: Optional[date] = None,
    location_name: Optional[str] = None,
    purpose: Optional[str] = None,
    meter_start_l: Optional[float] = None,
    meter_end_l: Optional[float] = None,
    tanker_liters: Optional[float] = None,
    bottled_liters: Optional[float] = None,
    drinking_liters: Optional[float] = None,
    sanitation_liters: Optional[float] = None,
    cleaning_liters: Optional[float] = None,
    catering_liters: Optional[float] = None,
    makeup_liters: Optional[float] = None,
    other_liters: Optional[float] = None,
    people_served: Optional[int] = None,
    evidence_ref: Optional[str] = None,
    data_quality: str = "Actual",
) -> dict:
    if source not in WATER_SOURCES:
        raise ValueError(f"invalid water source '{source}' (expected one of {WATER_SOURCES})")
    if volume_liters < 0 or greywater_recycled_liters < 0:
        raise ValueError("volumes must be non-negative")
    if greywater_recycled_liters > volume_liters:
        raise ValueError("greywater_recycled_liters cannot exceed volume_liters")
    if recorded_at is None:
        recorded_at = date.today()

    row = await pool.fetchrow(
        """
        INSERT INTO green_water_records
          (production_id, location_id, phase, source, volume_liters, greywater_recycled_liters,
           notes, recorded_at, location_name, purpose, meter_start_l, meter_end_l, tanker_liters,
           bottled_liters, drinking_liters, sanitation_liters, cleaning_liters, catering_liters,
           makeup_liters, other_liters, people_served, evidence_ref, data_quality)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
        RETURNING id, recorded_at
        """,
        production_id, location_id, phase, source, volume_liters, greywater_recycled_liters, notes,
        recorded_at, location_name, purpose, meter_start_l, meter_end_l, tanker_liters, bottled_liters,
        drinking_liters, sanitation_liters, cleaning_liters, catering_liters, makeup_liters,
        other_liters, people_served, evidence_ref, data_quality,
    )
    return {
        "id": row["id"], "productionId": production_id, "phase": phase, "source": source,
        "volumeLiters": volume_liters, "greywaterRecycledLiters": greywater_recycled_liters,
        "recordedAt": row["recorded_at"].isoformat(),
    }


async def get_water_summary(pool: asyncpg.Pool, production_id: str) -> dict:
    rows = await pool.fetch(
        "SELECT source, SUM(volume_liters) AS total_liters, "
        "SUM(greywater_recycled_liters) AS recycled_liters "
        "FROM green_water_records WHERE production_id = $1 GROUP BY source",
        production_id,
    )
    total = sum(float(r["total_liters"] or 0) for r in rows)
    recycled = sum(float(r["recycled_liters"] or 0) for r in rows)
    by_source = {
        r["source"]: {
            "totalLiters": round(float(r["total_liters"] or 0), 1),
            "recycledLiters": round(float(r["recycled_liters"] or 0), 1),
        }
        for r in rows
    }
    return {
        "productionId": production_id,
        "totalVolumeLiters": round(total, 1),
        "totalRecycledLiters": round(recycled, 1),
        "recyclingRatePct": round(recycled / total * 100, 1) if total else 0.0,
        "bySource": by_source,
    }


# ── Waste ─────────────────────────────────────────────────────────────────────

async def log_waste_record(
    pool: asyncpg.Pool,
    production_id: str,
    phase: str,
    waste_type: str,
    quantity_kg: float,
    pct_recycled: float = 0,
    pct_reused: float = 0,
    pct_landfill: Optional[float] = None,
    disposal_partner: Optional[str] = None,
    location_id: Optional[str] = None,
    recorded_at: Optional[date] = None,
    location_name: Optional[str] = None,
    source_activity: Optional[str] = None,
    quantity_units: Optional[float] = None,
    unit_type: Optional[str] = None,
    segregated: Optional[bool] = None,
    collection_method: Optional[str] = None,
    destination_vendor: Optional[str] = None,
    composted_kg: Optional[float] = None,
    incinerated_kg: Optional[float] = None,
    hazardous: Optional[bool] = None,
    manifest_ref: Optional[str] = None,
    data_quality: str = "Actual",
) -> dict:
    if waste_type not in WASTE_TYPES:
        raise ValueError(f"invalid waste type '{waste_type}' (expected one of {WASTE_TYPES})")
    if quantity_kg < 0:
        raise ValueError("quantity_kg must be non-negative")
    if pct_landfill is None:
        pct_landfill = max(0.0, 100 - pct_recycled - pct_reused)
    if pct_recycled + pct_reused + pct_landfill > 100.01:
        raise ValueError("pct_recycled + pct_reused + pct_landfill cannot exceed 100")
    if recorded_at is None:
        recorded_at = date.today()

    row = await pool.fetchrow(
        """
        INSERT INTO green_waste_records
          (production_id, location_id, phase, waste_type, quantity_kg,
           pct_recycled, pct_reused, pct_landfill, disposal_partner, recorded_at,
           location_name, source_activity, quantity_units, unit_type, segregated,
           collection_method, destination_vendor, composted_kg, incinerated_kg,
           hazardous, manifest_ref, data_quality)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
        RETURNING id, recorded_at
        """,
        production_id, location_id, phase, waste_type, quantity_kg,
        pct_recycled, pct_reused, pct_landfill, disposal_partner, recorded_at,
        location_name, source_activity, quantity_units, unit_type, segregated,
        collection_method, destination_vendor, composted_kg, incinerated_kg,
        hazardous, manifest_ref, data_quality,
    )
    return {
        "id": row["id"], "productionId": production_id, "phase": phase, "wasteType": waste_type,
        "quantityKg": quantity_kg, "pctRecycled": pct_recycled, "pctReused": pct_reused,
        "pctLandfill": pct_landfill, "recordedAt": row["recorded_at"].isoformat(),
    }


async def get_waste_summary(pool: asyncpg.Pool, production_id: str) -> dict:
    rows = await pool.fetch(
        """
        SELECT waste_type, SUM(quantity_kg) AS total_kg,
               SUM(quantity_kg * pct_recycled / 100) AS recycled_kg,
               SUM(quantity_kg * pct_reused / 100)   AS reused_kg,
               SUM(quantity_kg * pct_landfill / 100) AS landfill_kg
        FROM green_waste_records WHERE production_id = $1 GROUP BY waste_type
        """,
        production_id,
    )
    total = sum(float(r["total_kg"] or 0) for r in rows)
    recycled = sum(float(r["recycled_kg"] or 0) for r in rows)
    reused = sum(float(r["reused_kg"] or 0) for r in rows)
    landfill = sum(float(r["landfill_kg"] or 0) for r in rows)
    diverted = recycled + reused

    by_type = {
        r["waste_type"]: {
            "totalKg": round(float(r["total_kg"] or 0), 1),
            "recycledKg": round(float(r["recycled_kg"] or 0), 1),
            "reusedKg": round(float(r["reused_kg"] or 0), 1),
            "landfillKg": round(float(r["landfill_kg"] or 0), 1),
        }
        for r in rows
    }
    return {
        "productionId": production_id,
        "totalWasteKg": round(total, 1),
        "recycledKg": round(recycled, 1),
        "reusedKg": round(reused, 1),
        "landfillKg": round(landfill, 1),
        "diversionRatePct": round(diverted / total * 100, 1) if total else 0.0,
        "byType": by_type,
    }
