"""
Climactix Green Production — Production Data Log Engine v1.0

Implements the full sheet-by-sheet manual data log — Daily Log, Fuel &
Vehicles, Crew Travel, Shoot-Stay Trips, Energy, Materials,
Accommodation, Food & Catering, Evidence Register — as a live data
collection tool, mirroring the "Film Green Rating — Production
Sustainability Data Log" workbook column-for-column.

Every entry that represents a real emission source computes its own
CO2e via direct lookups against the existing multi-country emission
factor database (green_carbon_engine.get_factor) — no separate factor
taxonomy, no invented conversion factors. green_carbon_engine's
footprint/timeline aggregation unions these tables in, so the score
and certification engines see this data automatically.

Proprietary IP of Climactix Global. All rights reserved.
"""

from __future__ import annotations
from datetime import date
from typing import Optional

import asyncpg

from . import green_carbon_engine as carbon

# ── Dropdown → emission-factor-key maps (all keys already exist in
# green_emission_factors — see migration 004) ─────────────────────────────────

FUEL_FACTOR_BY_TYPE = {
    "Diesel": "diesel_l",
    "Petrol": "petrol_l",
    "Biofuel": "biofuel_l",
}

VEHICLE_DISTANCE_FACTOR_BY_TYPE = {
    "Car": "car_diesel_km",
    "SUV": "suv_diesel_km",
    "Bus": "bus_diesel_km",
    "Vanity Van": "vanity_van_diesel_km",
    "Mini Truck": "mini_truck_diesel_km",
    "EV": "ev_car_km",
    "Hybrid": "hybrid_car_km",
}

TRAVEL_MODE_PKM_FACTOR = {
    "Train": "rail_pkm",
    "Metro": "metro_pkm",
    "Boat / Ferry": "boat_pkm",
}

FLIGHT_FACTOR_BY_MODE_CLASS = {
    ("Domestic Flight", "Economy"): "domestic_flight_economy_pkm",
    ("Domestic Flight", "Business"): "domestic_flight_business_pkm",
    ("International Flight", "Economy"): "international_flight_economy_pkm",
    ("International Flight", "Business"): "international_flight_business_pkm",
}

MATERIAL_CATEGORY_FACTOR = {
    "Timber / Wood": "timber_kg",
    "Steel (Virgin)": "steel_kg_virgin",
    "Steel (Recycled)": "steel_kg_recycled",
    "Plastic (Virgin)": "plastic_kg_virgin",
    "Plastic (Recycled)": "plastic_kg_recycled",
    "Concrete": "concrete_kg",
    "Fabric / Textile": "fabric_kg",
    "Paint": "paint_l",
    "Foam": "foam_kg",
    "Costume (Purchased)": "costume_purchased_kg",
    "Costume (Rental)": "costume_rental_kg",
    "Cosmetics / Makeup": "cosmetics_kg",
    "Paper": "paper_kg",
}


async def _co2e(pool: asyncpg.Pool, factor_key: str, region: str, quantity: float) -> tuple[float, str]:
    factor = await carbon.get_factor(pool, factor_key, region)
    return round(quantity * factor["factorKgCo2ePerUnit"], 4), factor["factorKey"]


# ── Daily Log (upsert by date — one row per shoot day) ────────────────────────

async def log_daily(pool: asyncpg.Pool, production_id: str, log_date: date, **fields) -> dict:
    cols = [
        "shoot_day_number", "location_set", "shoot_unit", "call_time", "wrap_time",
        "crew_count", "cast_count", "extras_count", "production_hours", "weather_conditions",
        "power_source", "diesel_generator_l", "grid_electricity_kwh", "water_used_l",
        "waste_generated_kg", "crew_travel_km", "shoot_stay_km", "accommodation_rooms_nights",
        "catering_covers", "notes", "data_quality",
    ]
    values = [fields.get(c) for c in cols]
    set_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols)
    row = await pool.fetchrow(
        f"""
        INSERT INTO green_daily_logs (production_id, log_date, {", ".join(cols)})
        VALUES ($1, $2, {", ".join(f"${i+3}" for i in range(len(cols)))})
        ON CONFLICT (production_id, log_date) DO UPDATE SET {set_clause}, updated_at = NOW()
        RETURNING id, created_at
        """,
        production_id, log_date, *values,
    )
    return {"id": row["id"], "productionId": production_id, "logDate": log_date.isoformat(),
            "createdAt": row["created_at"].isoformat()}


async def list_daily(pool: asyncpg.Pool, production_id: str) -> list[dict]:
    rows = await pool.fetch(
        "SELECT * FROM green_daily_logs WHERE production_id = $1 ORDER BY log_date DESC", production_id)
    return [dict(r) for r in rows]


# ── Fuel & Vehicles ────────────────────────────────────────────────────────────

async def log_fuel_vehicle(pool: asyncpg.Pool, production_id: str, log_date: date, region: str = "Global", **f) -> dict:
    fuel_type = f.get("fuel_type")
    fuel_l = float(f.get("fuel_consumed_l") or 0) + float(f.get("generator_fuel_l") or 0)
    distance_km = f.get("distance_km")
    co2e_kg, factor_key = None, None

    if fuel_l > 0 and fuel_type in FUEL_FACTOR_BY_TYPE:
        co2e_kg, factor_key = await _co2e(pool, FUEL_FACTOR_BY_TYPE[fuel_type], region, fuel_l)
    elif distance_km and f.get("vehicle_type") in VEHICLE_DISTANCE_FACTOR_BY_TYPE:
        co2e_kg, factor_key = await _co2e(pool, VEHICLE_DISTANCE_FACTOR_BY_TYPE[f["vehicle_type"]], region, float(distance_km))

    cols = ["vehicle_equipment_id", "vehicle_type", "fuel_type", "opening_odometer_km",
            "closing_odometer_km", "distance_km", "fuel_purchased_l", "fuel_consumed_l",
            "fuel_receipt_ref", "fuel_vendor", "is_generator", "generator_hours",
            "generator_fuel_l", "adblue_l", "purpose_route", "driver_name", "data_quality", "notes"]
    values = [f.get(c) for c in cols]
    row = await pool.fetchrow(
        f"""
        INSERT INTO green_fuel_vehicle_logs
          (production_id, log_date, region, {", ".join(cols)}, co2e_kg, factor_key_used)
        VALUES ($1,$2,$3,{", ".join(f"${i+4}" for i in range(len(cols)))},${len(cols)+4},${len(cols)+5})
        RETURNING id, created_at
        """,
        production_id, log_date, region, *values, co2e_kg, factor_key,
    )
    return {"id": row["id"], "productionId": production_id, "logDate": log_date.isoformat(),
            "co2eKg": co2e_kg, "factorKeyUsed": factor_key, "createdAt": row["created_at"].isoformat()}


async def list_fuel_vehicle(pool: asyncpg.Pool, production_id: str) -> list[dict]:
    rows = await pool.fetch(
        "SELECT * FROM green_fuel_vehicle_logs WHERE production_id = $1 ORDER BY log_date DESC, created_at DESC", production_id)
    return [dict(r) for r in rows]


# ── Crew Travel ────────────────────────────────────────────────────────────────

async def log_crew_travel(pool: asyncpg.Pool, production_id: str, log_date: date, region: str = "Global", **f) -> dict:
    travel_mode = f.get("travel_mode")
    one_way_km = float(f.get("one_way_distance_km") or 0)
    num_persons = int(f.get("num_persons") or 1)
    trips = int(f.get("trips") or 1)
    passenger_km = f.get("passenger_km")
    if passenger_km is None:
        passenger_km = round(one_way_km * num_persons * trips, 2)
    else:
        passenger_km = float(passenger_km)

    co2e_kg, factor_key = None, None
    if travel_mode in VEHICLE_DISTANCE_FACTOR_BY_TYPE:
        co2e_kg, factor_key = await _co2e(pool, VEHICLE_DISTANCE_FACTOR_BY_TYPE[travel_mode], region, one_way_km * trips)
    elif travel_mode in TRAVEL_MODE_PKM_FACTOR:
        co2e_kg, factor_key = await _co2e(pool, TRAVEL_MODE_PKM_FACTOR[travel_mode], region, passenger_km)
    elif travel_mode in ("Domestic Flight", "International Flight"):
        travel_class = f.get("travel_class") if f.get("travel_class") in ("Economy", "Business") else "Economy"
        co2e_kg, factor_key = await _co2e(
            pool, FLIGHT_FACTOR_BY_MODE_CLASS[(travel_mode, travel_class)], region, passenger_km)

    cols = ["person_crew_category", "department", "travel_mode", "origin", "destination",
            "one_way_distance_km", "num_persons", "trips", "purpose", "shared_vehicle",
            "public_transport", "is_flight", "travel_class", "ticket_ref", "cost_inr",
            "data_quality", "notes"]
    values = [f.get(c) for c in cols]
    row = await pool.fetchrow(
        f"""
        INSERT INTO green_crew_travel_logs
          (production_id, log_date, region, {", ".join(cols)}, passenger_km, co2e_kg, factor_key_used)
        VALUES ($1,$2,$3,{", ".join(f"${i+4}" for i in range(len(cols)))},${len(cols)+4},${len(cols)+5},${len(cols)+6})
        RETURNING id, created_at
        """,
        production_id, log_date, region, *values, passenger_km, co2e_kg, factor_key,
    )
    return {"id": row["id"], "productionId": production_id, "logDate": log_date.isoformat(),
            "passengerKm": passenger_km, "co2eKg": co2e_kg, "factorKeyUsed": factor_key,
            "createdAt": row["created_at"].isoformat()}


async def list_crew_travel(pool: asyncpg.Pool, production_id: str) -> list[dict]:
    rows = await pool.fetch(
        "SELECT * FROM green_crew_travel_logs WHERE production_id = $1 ORDER BY log_date DESC, created_at DESC", production_id)
    return [dict(r) for r in rows]


# ── Shoot ↔ Stay Trips ─────────────────────────────────────────────────────────

async def log_shoot_stay_trip(pool: asyncpg.Pool, production_id: str, log_date: date, region: str = "Global", **f) -> dict:
    distance_per_trip = float(f.get("distance_per_trip_km") or 0)
    number_of_trips = int(f.get("number_of_trips") or 1)
    passengers_per_trip = int(f.get("passengers_per_trip") or 1)
    total_passenger_km = f.get("total_passenger_km")
    if total_passenger_km is None:
        total_passenger_km = round(distance_per_trip * number_of_trips * passengers_per_trip, 2)
    else:
        total_passenger_km = float(total_passenger_km)

    fuel_l = float(f.get("fuel_consumed_l") or 0)
    fuel_type = f.get("fuel_type")
    vehicle_type = f.get("vehicle_type")
    co2e_kg, factor_key = None, None
    if fuel_l > 0 and fuel_type in FUEL_FACTOR_BY_TYPE:
        co2e_kg, factor_key = await _co2e(pool, FUEL_FACTOR_BY_TYPE[fuel_type], region, fuel_l)
    elif vehicle_type in VEHICLE_DISTANCE_FACTOR_BY_TYPE:
        co2e_kg, factor_key = await _co2e(
            pool, VEHICLE_DISTANCE_FACTOR_BY_TYPE[vehicle_type], region, distance_per_trip * number_of_trips)

    cols = ["trip_label", "from_location", "to_location", "trip_purpose", "vehicle_id",
            "vehicle_type", "fuel_type", "distance_per_trip_km", "number_of_trips",
            "passengers_per_trip", "fuel_consumed_l", "driver_name", "start_time", "end_time",
            "evidence_ref", "data_quality", "notes"]
    values = [f.get(c) for c in cols]
    row = await pool.fetchrow(
        f"""
        INSERT INTO green_shoot_stay_trip_logs
          (production_id, log_date, region, {", ".join(cols)}, total_passenger_km, co2e_kg, factor_key_used)
        VALUES ($1,$2,$3,{", ".join(f"${i+4}" for i in range(len(cols)))},${len(cols)+4},${len(cols)+5},${len(cols)+6})
        RETURNING id, created_at
        """,
        production_id, log_date, region, *values, total_passenger_km, co2e_kg, factor_key,
    )
    return {"id": row["id"], "productionId": production_id, "logDate": log_date.isoformat(),
            "totalPassengerKm": total_passenger_km, "co2eKg": co2e_kg, "factorKeyUsed": factor_key,
            "createdAt": row["created_at"].isoformat()}


async def list_shoot_stay_trip(pool: asyncpg.Pool, production_id: str) -> list[dict]:
    rows = await pool.fetch(
        "SELECT * FROM green_shoot_stay_trip_logs WHERE production_id = $1 ORDER BY log_date DESC, created_at DESC", production_id)
    return [dict(r) for r in rows]


# ── Energy ─────────────────────────────────────────────────────────────────────

async def log_energy(pool: asyncpg.Pool, production_id: str, log_date: date, region: str = "Global", **f) -> dict:
    grid_kwh = float(f.get("grid_kwh") or 0)
    diesel_used_l = f.get("diesel_used_l")
    generator_kwh = float(f.get("generator_kwh") or 0)

    co2e_kg = 0.0
    factor_keys = []
    if grid_kwh > 0:
        c, k = await _co2e(pool, "electricity_grid_kwh", region, grid_kwh)
        co2e_kg += c
        factor_keys.append(k)
    if diesel_used_l:
        c, k = await _co2e(pool, "diesel_l", region, float(diesel_used_l))
        co2e_kg += c
        factor_keys.append(k)
    elif generator_kwh > 0:
        c, k = await _co2e(pool, "generator_diesel_kwh", region, generator_kwh)
        co2e_kg += c
        factor_keys.append(k)
    co2e_kg = round(co2e_kg, 4) if factor_keys else None

    cols = ["location_name", "energy_source", "equipment_area", "meter_start_kwh",
            "meter_end_kwh", "grid_kwh", "generator_kwh", "renewable_kwh", "battery_kwh",
            "generator_hours", "diesel_used_l", "renewable_source", "meter_invoice_ref",
            "data_quality", "notes"]
    values = [f.get(c) for c in cols]
    row = await pool.fetchrow(
        f"""
        INSERT INTO green_energy_logs
          (production_id, log_date, region, {", ".join(cols)}, co2e_kg, factor_key_used)
        VALUES ($1,$2,$3,{", ".join(f"${i+4}" for i in range(len(cols)))},${len(cols)+4},${len(cols)+5})
        RETURNING id, created_at
        """,
        production_id, log_date, region, *values, co2e_kg, ",".join(factor_keys) or None,
    )
    return {"id": row["id"], "productionId": production_id, "logDate": log_date.isoformat(),
            "co2eKg": co2e_kg, "factorKeyUsed": ",".join(factor_keys) or None,
            "createdAt": row["created_at"].isoformat()}


async def list_energy(pool: asyncpg.Pool, production_id: str) -> list[dict]:
    rows = await pool.fetch(
        "SELECT * FROM green_energy_logs WHERE production_id = $1 ORDER BY log_date DESC, created_at DESC", production_id)
    return [dict(r) for r in rows]


# ── Materials ──────────────────────────────────────────────────────────────────

async def log_materials(pool: asyncpg.Pool, production_id: str, log_date: date, region: str = "Global", **f) -> dict:
    category = f.get("category")
    quantity = float(f.get("quantity") or 0)
    co2e_kg, factor_key = None, None
    if quantity > 0 and category in MATERIAL_CATEGORY_FACTOR:
        co2e_kg, factor_key = await _co2e(pool, MATERIAL_CATEGORY_FACTOR[category], region, quantity)

    cols = ["department", "material_item", "category", "quantity", "unit",
            "condition_new_reused", "locally_sourced", "reusable_recyclable", "supplier",
            "cost_inr", "disposal_route", "evidence_ref", "data_quality", "notes"]
    values = [f.get(c) for c in cols]
    row = await pool.fetchrow(
        f"""
        INSERT INTO green_materials_logs
          (production_id, log_date, region, {", ".join(cols)}, co2e_kg, factor_key_used)
        VALUES ($1,$2,$3,{", ".join(f"${i+4}" for i in range(len(cols)))},${len(cols)+4},${len(cols)+5})
        RETURNING id, created_at
        """,
        production_id, log_date, region, *values, co2e_kg, factor_key,
    )
    return {"id": row["id"], "productionId": production_id, "logDate": log_date.isoformat(),
            "co2eKg": co2e_kg, "factorKeyUsed": factor_key, "createdAt": row["created_at"].isoformat()}


async def list_materials(pool: asyncpg.Pool, production_id: str) -> list[dict]:
    rows = await pool.fetch(
        "SELECT * FROM green_materials_logs WHERE production_id = $1 ORDER BY log_date DESC, created_at DESC", production_id)
    return [dict(r) for r in rows]


# ── Accommodation ──────────────────────────────────────────────────────────────

async def log_accommodation(pool: asyncpg.Pool, production_id: str, log_date: date, region: str = "Global", **f) -> dict:
    rooms_occupied = float(f.get("rooms_occupied") or 0)
    nights = float(f.get("nights") or 0)
    total_room_nights = f.get("total_room_nights")
    if total_room_nights is None:
        total_room_nights = round(rooms_occupied * nights, 2)
    else:
        total_room_nights = float(total_room_nights)

    co2e_kg, factor_key = (None, None)
    if total_room_nights > 0:
        co2e_kg, factor_key = await _co2e(pool, "hotel_room_night", region, total_room_nights)

    cols = ["property_hotel", "location_name", "crew_cast_category", "rooms_occupied", "nights",
            "occupancy_per_room", "check_in", "check_out", "electricity_included",
            "water_included", "waste_services", "laundry_services", "booking_ref", "cost_inr",
            "data_quality", "notes"]
    values = [f.get(c) for c in cols]
    row = await pool.fetchrow(
        f"""
        INSERT INTO green_accommodation_logs
          (production_id, log_date, region, {", ".join(cols)}, total_room_nights, co2e_kg, factor_key_used)
        VALUES ($1,$2,$3,{", ".join(f"${i+4}" for i in range(len(cols)))},${len(cols)+4},${len(cols)+5},${len(cols)+6})
        RETURNING id, created_at
        """,
        production_id, log_date, region, *values, total_room_nights, co2e_kg, factor_key,
    )
    return {"id": row["id"], "productionId": production_id, "logDate": log_date.isoformat(),
            "totalRoomNights": total_room_nights, "co2eKg": co2e_kg, "factorKeyUsed": factor_key,
            "createdAt": row["created_at"].isoformat()}


async def list_accommodation(pool: asyncpg.Pool, production_id: str) -> list[dict]:
    rows = await pool.fetch(
        "SELECT * FROM green_accommodation_logs WHERE production_id = $1 ORDER BY log_date DESC, created_at DESC", production_id)
    return [dict(r) for r in rows]


# ── Food & Catering ─────────────────────────────────────────────────────────────

async def log_food_catering(pool: asyncpg.Pool, production_id: str, log_date: date, region: str = "Global", **f) -> dict:
    veg_covers = float(f.get("vegetarian_covers") or 0)
    nonveg_covers = float(f.get("nonveg_covers") or 0)
    food_waste_kg = float(f.get("food_waste_kg") or 0)
    menu_type = (f.get("menu_type") or "").strip().lower()
    veg_factor_key = "meal_vegan" if menu_type == "vegan" else "meal_vegetarian"

    co2e_kg = 0.0
    factor_keys = []
    if veg_covers > 0:
        c, k = await _co2e(pool, veg_factor_key, region, veg_covers)
        co2e_kg += c
        factor_keys.append(k)
    if nonveg_covers > 0:
        c, k = await _co2e(pool, "meal_nonvegetarian", region, nonveg_covers)
        co2e_kg += c
        factor_keys.append(k)
    if food_waste_kg > 0:
        c, k = await _co2e(pool, "food_waste_kg", region, food_waste_kg)
        co2e_kg += c
        factor_keys.append(k)
    co2e_kg = round(co2e_kg, 4) if factor_keys else None

    cols = ["location_name", "meal", "covers_servings", "menu_type", "food_purchased_kg",
            "food_waste_kg", "packaging_waste_kg", "vegetarian_covers", "nonveg_covers",
            "local_seasonal_pct", "plant_based_options", "reusable_crockery",
            "single_use_items_qty", "water_used_l", "supplier", "evidence_ref",
            "data_quality", "notes"]
    values = [f.get(c) for c in cols]
    row = await pool.fetchrow(
        f"""
        INSERT INTO green_food_catering_logs
          (production_id, log_date, region, {", ".join(cols)}, co2e_kg, factor_key_used)
        VALUES ($1,$2,$3,{", ".join(f"${i+4}" for i in range(len(cols)))},${len(cols)+4},${len(cols)+5})
        RETURNING id, created_at
        """,
        production_id, log_date, region, *values, co2e_kg, ",".join(factor_keys) or None,
    )
    return {"id": row["id"], "productionId": production_id, "logDate": log_date.isoformat(),
            "co2eKg": co2e_kg, "factorKeyUsed": ",".join(factor_keys) or None,
            "createdAt": row["created_at"].isoformat()}


async def list_food_catering(pool: asyncpg.Pool, production_id: str) -> list[dict]:
    rows = await pool.fetch(
        "SELECT * FROM green_food_catering_logs WHERE production_id = $1 ORDER BY log_date DESC, created_at DESC", production_id)
    return [dict(r) for r in rows]


# ── Evidence Register ────────────────────────────────────────────────────────

async def log_evidence(pool: asyncpg.Pool, production_id: str, evidence_type: str, evidence_date: Optional[date] = None, **f) -> dict:
    if evidence_date is None:
        evidence_date = date.today()
    row = await pool.fetchrow(
        """
        INSERT INTO green_evidence
          (production_id, evidence_type, evidence_date, file_url, file_folder_reference,
           description, data_category, source_vendor, amount_quantity, unit, verified_by,
           verification_date, status, remarks)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING id, uploaded_at
        """,
        production_id, evidence_type, evidence_date, f.get("file_url"), f.get("file_folder_reference"),
        f.get("description"), f.get("data_category"), f.get("source_vendor"), f.get("amount_quantity"),
        f.get("unit"), f.get("verified_by"), f.get("verification_date"), f.get("status") or "pending",
        f.get("remarks"),
    )
    return {"id": row["id"], "productionId": production_id, "evidenceType": evidence_type,
            "evidenceDate": evidence_date.isoformat(), "uploadedAt": row["uploaded_at"].isoformat()}


async def list_evidence(pool: asyncpg.Pool, production_id: str) -> list[dict]:
    rows = await pool.fetch(
        "SELECT * FROM green_evidence WHERE production_id = $1 ORDER BY uploaded_at DESC", production_id)
    return [dict(r) for r in rows]


# ── Summary — mirrors the Excel Summary sheet exactly ─────────────────────────

async def get_data_log_summary(pool: asyncpg.Pool, production_id: str) -> dict:
    async def scalar(sql: str) -> float:
        v = await pool.fetchval(sql, production_id)
        return float(v) if v is not None else 0.0

    async def count(sql: str) -> int:
        v = await pool.fetchval(sql, production_id)
        return int(v) if v is not None else 0

    total_shoot_days = await count("SELECT COUNT(*) FROM green_daily_logs WHERE production_id = $1")
    person_days = await scalar(
        "SELECT COALESCE(SUM((COALESCE(crew_count,0) + COALESCE(cast_count,0))),0) "
        "FROM green_daily_logs WHERE production_id = $1")

    energy_rows = await count("SELECT COUNT(*) FROM green_energy_logs WHERE production_id = $1")
    grid_kwh = (await scalar("SELECT COALESCE(SUM(grid_kwh),0) FROM green_energy_logs WHERE production_id = $1")
                if energy_rows else
                await scalar("SELECT COALESCE(SUM(grid_electricity_kwh),0) FROM green_daily_logs WHERE production_id = $1"))

    fuel_rows = await count("SELECT COUNT(*) FROM green_fuel_vehicle_logs WHERE production_id = $1")
    generator_fuel_l = (await scalar("SELECT COALESCE(SUM(generator_fuel_l),0) FROM green_fuel_vehicle_logs WHERE production_id = $1")
                         if fuel_rows else
                         await scalar("SELECT COALESCE(SUM(diesel_generator_l),0) FROM green_daily_logs WHERE production_id = $1"))

    water_granular = await count("SELECT COUNT(*) FROM green_water_records WHERE production_id = $1")
    total_water_l = (await scalar("SELECT COALESCE(SUM(volume_liters),0) FROM green_water_records WHERE production_id = $1")
                      if water_granular else
                      await scalar("SELECT COALESCE(SUM(water_used_l),0) FROM green_daily_logs WHERE production_id = $1"))

    waste_granular = await count("SELECT COUNT(*) FROM green_waste_records WHERE production_id = $1")
    total_waste_kg = (await scalar("SELECT COALESCE(SUM(quantity_kg),0) FROM green_waste_records WHERE production_id = $1")
                       if waste_granular else
                       await scalar("SELECT COALESCE(SUM(waste_generated_kg),0) FROM green_daily_logs WHERE production_id = $1"))

    waste_recycled = await scalar(
        "SELECT COALESCE(SUM(quantity_kg * pct_recycled / 100),0) FROM green_waste_records WHERE production_id = $1")
    waste_composted = await scalar(
        "SELECT COALESCE(SUM(composted_kg),0) FROM green_waste_records WHERE production_id = $1")
    waste_reused = await scalar(
        "SELECT COALESCE(SUM(quantity_kg * pct_reused / 100),0) FROM green_waste_records WHERE production_id = $1")
    waste_landfill = await scalar(
        "SELECT COALESCE(SUM(quantity_kg * pct_landfill / 100),0) FROM green_waste_records WHERE production_id = $1")

    crew_travel_pkm = await scalar(
        "SELECT COALESCE(SUM(passenger_km),0) FROM green_crew_travel_logs WHERE production_id = $1")
    shoot_stay_pkm = await scalar(
        "SELECT COALESCE(SUM(total_passenger_km),0) FROM green_shoot_stay_trip_logs WHERE production_id = $1")
    room_nights = await scalar(
        "SELECT COALESCE(SUM(total_room_nights),0) FROM green_accommodation_logs WHERE production_id = $1")
    catering_covers = await scalar(
        "SELECT COALESCE(SUM(covers_servings),0) FROM green_food_catering_logs WHERE production_id = $1")

    dq_daily = await count("SELECT COUNT(*) FROM green_daily_logs WHERE production_id = $1 AND data_quality = 'Actual'")
    dq_fuel = await count("SELECT COUNT(*) FROM green_fuel_vehicle_logs WHERE production_id = $1 AND data_quality = 'Actual'")
    dq_travel = await count("SELECT COUNT(*) FROM green_crew_travel_logs WHERE production_id = $1 AND data_quality = 'Actual'")
    dq_water = await count("SELECT COUNT(*) FROM green_water_records WHERE production_id = $1 AND data_quality = 'Actual'")
    dq_waste = await count("SELECT COUNT(*) FROM green_waste_records WHERE production_id = $1 AND data_quality = 'Actual'")

    return {
        "productionId": production_id,
        "metrics": [
            {"metric": "Total Shoot Days", "value": total_shoot_days, "unit": "days", "source": "Daily Log"},
            {"metric": "Total Crew + Cast Person-Days", "value": round(person_days, 0), "unit": "person-days", "source": "Daily Log"},
            {"metric": "Total Grid Electricity", "value": round(grid_kwh, 1), "unit": "kWh", "source": "Energy" if energy_rows else "Daily Log"},
            {"metric": "Total Generator Fuel", "value": round(generator_fuel_l, 1), "unit": "L", "source": "Fuel & Vehicles" if fuel_rows else "Daily Log"},
            {"metric": "Total Water Use", "value": round(total_water_l, 1), "unit": "L", "source": "Water" if water_granular else "Daily Log"},
            {"metric": "Total Waste Generated", "value": round(total_waste_kg, 1), "unit": "kg", "source": "Waste" if waste_granular else "Daily Log"},
            {"metric": "Waste Recycled", "value": round(waste_recycled, 1), "unit": "kg", "source": "Waste"},
            {"metric": "Waste Composted", "value": round(waste_composted, 1), "unit": "kg", "source": "Waste"},
            {"metric": "Waste Reused", "value": round(waste_reused, 1), "unit": "kg", "source": "Waste"},
            {"metric": "Waste to Landfill", "value": round(waste_landfill, 1), "unit": "kg", "source": "Waste"},
            {"metric": "Crew Travel Passenger-km", "value": round(crew_travel_pkm, 1), "unit": "passenger-km", "source": "Crew Travel"},
            {"metric": "Shoot-Stay Passenger-km", "value": round(shoot_stay_pkm, 1), "unit": "passenger-km", "source": "Shoot-Stay Trips"},
            {"metric": "Total Accommodation Room-Nights", "value": round(room_nights, 1), "unit": "room-nights", "source": "Accommodation"},
            {"metric": "Total Catering Covers", "value": round(catering_covers, 0), "unit": "covers", "source": "Food & Catering"},
        ],
        "dataQualityCheck": [
            {"label": "Daily Log — Actual records", "count": dq_daily},
            {"label": "Fuel — Actual records", "count": dq_fuel},
            {"label": "Travel — Actual records", "count": dq_travel},
            {"label": "Water — Actual records", "count": dq_water},
            {"label": "Waste — Actual records", "count": dq_waste},
        ],
    }
