"""
Climactix Green Production router — /api/v1/green-production/*

Production registration, activity/water/waste logging, footprint
computation, sustainability questionnaire, scoring, and certification
lookup for the Green Film Certification platform.
"""

import json
from datetime import date, time
from typing import Optional

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

import database as db
from services import green_carbon_engine as carbon
from services import green_water_waste_engine as water_waste
from services import green_score_engine as scoring
from services import green_certification_engine as certification
from services import green_datalog_engine as datalog
from services import green_application_engine as application
from services import green_application_pdf as application_pdf

router = APIRouter(prefix="/api/v1/green-production", tags=["green-production"])


async def _pool():
    try:
        return await db.get_pool()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}")


def _row_to_dict(row, json_fields: tuple = ()) -> dict:
    """asyncpg returns JSONB columns as raw strings — parse the given fields
    so the API responds with nested JSON rather than a double-encoded string."""
    d = dict(row)
    for f in json_fields:
        if isinstance(d.get(f), str):
            d[f] = json.loads(d[f])
    return d


# ── Schemas ────────────────────────────────────────────────────────────────────

class ProductionCreate(BaseModel):
    production_name: str
    production_company: str
    studio: Optional[str] = None
    director: Optional[str] = None
    producer: Optional[str] = None
    executive_producer: Optional[str] = None
    production_manager: Optional[str] = None
    budget_amount: Optional[float] = None
    budget_currency: str = "INR"
    film_type: str
    language: Optional[str] = None
    country: str
    crew_size_expected: Optional[int] = None
    cast_size_expected: Optional[int] = None
    expected_audience: Optional[str] = None
    distribution_channel: str = "both"
    streaming_platform: Optional[str] = None
    timeline_start: Optional[date] = None
    timeline_end: Optional[date] = None
    owner_user_id: Optional[str] = None


class LocationCreate(BaseModel):
    location_name: str
    country: str
    state: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    shoot_start_date: Optional[date] = None
    shoot_end_date: Optional[date] = None
    protected_area_flag: bool = False


class ActivityLogCreate(BaseModel):
    category_id: str
    phase: str
    quantity: float = Field(ge=0)
    region: str = "Global"
    location_id: Optional[str] = None
    notes: Optional[str] = None
    logged_by: Optional[str] = None
    activity_date: Optional[date] = None


class WaterRecordCreate(BaseModel):
    phase: str
    source: str
    volume_liters: float = Field(ge=0)
    greywater_recycled_liters: float = Field(default=0, ge=0)
    location_id: Optional[str] = None
    notes: Optional[str] = None
    recorded_at: Optional[date] = None
    location_name: Optional[str] = None
    purpose: Optional[str] = None
    meter_start_l: Optional[float] = None
    meter_end_l: Optional[float] = None
    tanker_liters: Optional[float] = None
    bottled_liters: Optional[float] = None
    drinking_liters: Optional[float] = None
    sanitation_liters: Optional[float] = None
    cleaning_liters: Optional[float] = None
    catering_liters: Optional[float] = None
    makeup_liters: Optional[float] = None
    other_liters: Optional[float] = None
    people_served: Optional[int] = None
    evidence_ref: Optional[str] = None
    data_quality: str = "Actual"


class WasteRecordCreate(BaseModel):
    phase: str
    waste_type: str
    quantity_kg: float = Field(ge=0)
    pct_recycled: float = Field(default=0, ge=0, le=100)
    pct_reused: float = Field(default=0, ge=0, le=100)
    pct_landfill: Optional[float] = Field(default=None, ge=0, le=100)
    disposal_partner: Optional[str] = None
    location_id: Optional[str] = None
    recorded_at: Optional[date] = None
    location_name: Optional[str] = None
    source_activity: Optional[str] = None
    quantity_units: Optional[float] = None
    unit_type: Optional[str] = None
    segregated: Optional[bool] = None
    collection_method: Optional[str] = None
    destination_vendor: Optional[str] = None
    composted_kg: Optional[float] = None
    incinerated_kg: Optional[float] = None
    hazardous: Optional[bool] = None
    manifest_ref: Optional[str] = None
    data_quality: str = "Actual"


class QuestionnaireResponseCreate(BaseModel):
    question_id: str
    response: object
    answered_by: Optional[str] = None


# ── Productions ────────────────────────────────────────────────────────────────

@router.post("/productions")
async def create_production(payload: ProductionCreate):
    pool = await _pool()
    row = await pool.fetchrow(
        """
        INSERT INTO green_productions
          (owner_user_id, production_name, production_company, studio, director, producer,
           executive_producer, production_manager, budget_amount, budget_currency, film_type,
           language, country, crew_size_expected, cast_size_expected, expected_audience,
           distribution_channel, streaming_platform, timeline_start, timeline_end)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        RETURNING id, created_at
        """,
        payload.owner_user_id, payload.production_name, payload.production_company,
        payload.studio, payload.director, payload.producer, payload.executive_producer,
        payload.production_manager, payload.budget_amount, payload.budget_currency,
        payload.film_type, payload.language, payload.country, payload.crew_size_expected,
        payload.cast_size_expected, payload.expected_audience, payload.distribution_channel,
        payload.streaming_platform, payload.timeline_start, payload.timeline_end,
    )
    return {"id": row["id"], "createdAt": row["created_at"].isoformat()}


@router.get("/productions/{production_id}")
async def get_production(production_id: str):
    pool = await _pool()
    row = await pool.fetchrow("SELECT * FROM green_productions WHERE id = $1", production_id)
    if row is None:
        raise HTTPException(status_code=404, detail="production not found")
    return _row_to_dict(row, json_fields=("metadata",))


@router.get("/productions")
async def list_productions(owner_user_id: Optional[str] = None, limit: int = 50):
    pool = await _pool()
    if owner_user_id:
        rows = await pool.fetch(
            "SELECT id, production_name, film_type, country, status, created_at "
            "FROM green_productions WHERE owner_user_id = $1 ORDER BY created_at DESC LIMIT $2",
            owner_user_id, limit,
        )
    else:
        rows = await pool.fetch(
            "SELECT id, production_name, film_type, country, status, created_at "
            "FROM green_productions ORDER BY created_at DESC LIMIT $1",
            limit,
        )
    return {"productions": [dict(r) for r in rows], "count": len(rows)}


@router.post("/productions/{production_id}/locations")
async def add_location(production_id: str, payload: LocationCreate):
    pool = await _pool()
    prod = await pool.fetchval("SELECT id FROM green_productions WHERE id = $1", production_id)
    if not prod:
        raise HTTPException(status_code=404, detail="production not found")
    row = await pool.fetchrow(
        """
        INSERT INTO green_production_locations
          (production_id, location_name, country, state, city, latitude, longitude,
           shoot_start_date, shoot_end_date, protected_area_flag)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING id, created_at
        """,
        production_id, payload.location_name, payload.country, payload.state, payload.city,
        payload.latitude, payload.longitude, payload.shoot_start_date, payload.shoot_end_date,
        payload.protected_area_flag,
    )
    return {"id": row["id"], "createdAt": row["created_at"].isoformat()}


# ── Activity taxonomy & logging ──────────────────────────────────────────────

@router.get("/activity-categories")
async def get_activity_categories(phase: Optional[str] = None):
    pool = await _pool()
    return {"categories": await carbon.list_categories(pool, phase)}


@router.post("/productions/{production_id}/activities")
async def log_activity(production_id: str, payload: ActivityLogCreate):
    pool = await _pool()
    prod = await pool.fetchval("SELECT id FROM green_productions WHERE id = $1", production_id)
    if not prod:
        raise HTTPException(status_code=404, detail="production not found")
    try:
        return await carbon.log_activity(
            pool, production_id, payload.category_id, payload.phase, payload.quantity,
            region=payload.region, location_id=payload.location_id,
            notes=payload.notes, logged_by=payload.logged_by, activity_date=payload.activity_date,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/productions/{production_id}/footprint")
async def get_footprint(production_id: str):
    pool = await _pool()
    try:
        return await carbon.get_production_footprint(pool, production_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/productions/{production_id}/timeline")
async def get_timeline(production_id: str):
    pool = await _pool()
    prod = await pool.fetchval("SELECT id FROM green_productions WHERE id = $1", production_id)
    if not prod:
        raise HTTPException(status_code=404, detail="production not found")
    try:
        return await carbon.get_production_timeline(pool, production_id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ── Water & waste ─────────────────────────────────────────────────────────────

@router.post("/productions/{production_id}/water")
async def log_water(production_id: str, payload: WaterRecordCreate):
    pool = await _pool()
    prod = await pool.fetchval("SELECT id FROM green_productions WHERE id = $1", production_id)
    if not prod:
        raise HTTPException(status_code=404, detail="production not found")
    try:
        return await water_waste.log_water_record(
            pool, production_id, payload.phase, payload.source, payload.volume_liters,
            greywater_recycled_liters=payload.greywater_recycled_liters,
            location_id=payload.location_id, notes=payload.notes, recorded_at=payload.recorded_at,
            location_name=payload.location_name, purpose=payload.purpose,
            meter_start_l=payload.meter_start_l, meter_end_l=payload.meter_end_l,
            tanker_liters=payload.tanker_liters, bottled_liters=payload.bottled_liters,
            drinking_liters=payload.drinking_liters, sanitation_liters=payload.sanitation_liters,
            cleaning_liters=payload.cleaning_liters, catering_liters=payload.catering_liters,
            makeup_liters=payload.makeup_liters, other_liters=payload.other_liters,
            people_served=payload.people_served, evidence_ref=payload.evidence_ref,
            data_quality=payload.data_quality,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/productions/{production_id}/water-summary")
async def water_summary(production_id: str):
    pool = await _pool()
    return await water_waste.get_water_summary(pool, production_id)


@router.post("/productions/{production_id}/waste")
async def log_waste(production_id: str, payload: WasteRecordCreate):
    pool = await _pool()
    prod = await pool.fetchval("SELECT id FROM green_productions WHERE id = $1", production_id)
    if not prod:
        raise HTTPException(status_code=404, detail="production not found")
    try:
        return await water_waste.log_waste_record(
            pool, production_id, payload.phase, payload.waste_type, payload.quantity_kg,
            pct_recycled=payload.pct_recycled, pct_reused=payload.pct_reused,
            pct_landfill=payload.pct_landfill, disposal_partner=payload.disposal_partner,
            location_id=payload.location_id, recorded_at=payload.recorded_at,
            location_name=payload.location_name, source_activity=payload.source_activity,
            quantity_units=payload.quantity_units, unit_type=payload.unit_type,
            segregated=payload.segregated, collection_method=payload.collection_method,
            destination_vendor=payload.destination_vendor, composted_kg=payload.composted_kg,
            incinerated_kg=payload.incinerated_kg, hazardous=payload.hazardous,
            manifest_ref=payload.manifest_ref, data_quality=payload.data_quality,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/productions/{production_id}/waste-summary")
async def waste_summary(production_id: str):
    pool = await _pool()
    return await water_waste.get_waste_summary(pool, production_id)


# ── Production Data Log (full sheet-by-sheet log, mirrors the manual ────────
# "Film Green Rating — Production Sustainability Data Log" workbook) ────────

class DailyLogCreate(BaseModel):
    log_date: date
    shoot_day_number: Optional[int] = None
    location_set: Optional[str] = None
    shoot_unit: Optional[str] = None
    call_time: Optional[time] = None
    wrap_time: Optional[time] = None
    crew_count: Optional[int] = None
    cast_count: Optional[int] = None
    extras_count: Optional[int] = None
    production_hours: Optional[float] = None
    weather_conditions: Optional[str] = None
    power_source: Optional[str] = None
    diesel_generator_l: Optional[float] = None
    grid_electricity_kwh: Optional[float] = None
    water_used_l: Optional[float] = None
    waste_generated_kg: Optional[float] = None
    crew_travel_km: Optional[float] = None
    shoot_stay_km: Optional[float] = None
    accommodation_rooms_nights: Optional[int] = None
    catering_covers: Optional[int] = None
    notes: Optional[str] = None
    data_quality: str = "Actual"


@router.post("/productions/{production_id}/daily-log")
async def post_daily_log(production_id: str, payload: DailyLogCreate):
    pool = await _pool()
    prod = await pool.fetchval("SELECT id FROM green_productions WHERE id = $1", production_id)
    if not prod:
        raise HTTPException(status_code=404, detail="production not found")
    fields = payload.model_dump(exclude={"log_date"})
    return await datalog.log_daily(pool, production_id, payload.log_date, **fields)


@router.get("/productions/{production_id}/daily-log")
async def get_daily_log(production_id: str):
    pool = await _pool()
    entries = await datalog.list_daily(pool, production_id)
    return {"entries": entries, "count": len(entries)}


class FuelVehicleLogCreate(BaseModel):
    log_date: date
    region: str = "Global"
    vehicle_equipment_id: Optional[str] = None
    vehicle_type: Optional[str] = None
    fuel_type: Optional[str] = None
    opening_odometer_km: Optional[float] = None
    closing_odometer_km: Optional[float] = None
    distance_km: Optional[float] = None
    fuel_purchased_l: Optional[float] = None
    fuel_consumed_l: Optional[float] = None
    fuel_receipt_ref: Optional[str] = None
    fuel_vendor: Optional[str] = None
    is_generator: bool = False
    generator_hours: Optional[float] = None
    generator_fuel_l: Optional[float] = None
    adblue_l: Optional[float] = None
    purpose_route: Optional[str] = None
    driver_name: Optional[str] = None
    data_quality: str = "Actual"
    notes: Optional[str] = None


@router.post("/productions/{production_id}/fuel-vehicle-log")
async def post_fuel_vehicle_log(production_id: str, payload: FuelVehicleLogCreate):
    pool = await _pool()
    prod = await pool.fetchval("SELECT id FROM green_productions WHERE id = $1", production_id)
    if not prod:
        raise HTTPException(status_code=404, detail="production not found")
    fields = payload.model_dump(exclude={"log_date", "region"})
    return await datalog.log_fuel_vehicle(pool, production_id, payload.log_date, payload.region, **fields)


@router.get("/productions/{production_id}/fuel-vehicle-log")
async def get_fuel_vehicle_log(production_id: str):
    pool = await _pool()
    entries = await datalog.list_fuel_vehicle(pool, production_id)
    return {"entries": entries, "count": len(entries)}


class CrewTravelLogCreate(BaseModel):
    log_date: date
    region: str = "Global"
    person_crew_category: Optional[str] = None
    department: Optional[str] = None
    travel_mode: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    one_way_distance_km: Optional[float] = 0
    num_persons: Optional[int] = 1
    trips: Optional[int] = 1
    passenger_km: Optional[float] = None
    purpose: Optional[str] = None
    shared_vehicle: Optional[bool] = None
    public_transport: Optional[bool] = None
    is_flight: Optional[bool] = None
    travel_class: Optional[str] = None
    ticket_ref: Optional[str] = None
    cost_inr: Optional[float] = None
    data_quality: str = "Actual"
    notes: Optional[str] = None


@router.post("/productions/{production_id}/crew-travel-log")
async def post_crew_travel_log(production_id: str, payload: CrewTravelLogCreate):
    pool = await _pool()
    prod = await pool.fetchval("SELECT id FROM green_productions WHERE id = $1", production_id)
    if not prod:
        raise HTTPException(status_code=404, detail="production not found")
    fields = payload.model_dump(exclude={"log_date", "region"})
    return await datalog.log_crew_travel(pool, production_id, payload.log_date, payload.region, **fields)


@router.get("/productions/{production_id}/crew-travel-log")
async def get_crew_travel_log(production_id: str):
    pool = await _pool()
    entries = await datalog.list_crew_travel(pool, production_id)
    return {"entries": entries, "count": len(entries)}


class ShootStayTripLogCreate(BaseModel):
    log_date: date
    region: str = "Global"
    trip_label: Optional[str] = None
    from_location: Optional[str] = None
    to_location: Optional[str] = None
    trip_purpose: Optional[str] = None
    vehicle_id: Optional[str] = None
    vehicle_type: Optional[str] = None
    fuel_type: Optional[str] = None
    distance_per_trip_km: Optional[float] = 0
    number_of_trips: Optional[int] = 1
    passengers_per_trip: Optional[int] = 1
    total_passenger_km: Optional[float] = None
    fuel_consumed_l: Optional[float] = None
    driver_name: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    evidence_ref: Optional[str] = None
    data_quality: str = "Actual"
    notes: Optional[str] = None


@router.post("/productions/{production_id}/shoot-stay-trip-log")
async def post_shoot_stay_trip_log(production_id: str, payload: ShootStayTripLogCreate):
    pool = await _pool()
    prod = await pool.fetchval("SELECT id FROM green_productions WHERE id = $1", production_id)
    if not prod:
        raise HTTPException(status_code=404, detail="production not found")
    fields = payload.model_dump(exclude={"log_date", "region"})
    return await datalog.log_shoot_stay_trip(pool, production_id, payload.log_date, payload.region, **fields)


@router.get("/productions/{production_id}/shoot-stay-trip-log")
async def get_shoot_stay_trip_log(production_id: str):
    pool = await _pool()
    entries = await datalog.list_shoot_stay_trip(pool, production_id)
    return {"entries": entries, "count": len(entries)}


class EnergyLogCreate(BaseModel):
    log_date: date
    region: str = "Global"
    location_name: Optional[str] = None
    energy_source: Optional[str] = None
    equipment_area: Optional[str] = None
    meter_start_kwh: Optional[float] = None
    meter_end_kwh: Optional[float] = None
    grid_kwh: Optional[float] = None
    generator_kwh: Optional[float] = None
    renewable_kwh: Optional[float] = None
    battery_kwh: Optional[float] = None
    generator_hours: Optional[float] = None
    diesel_used_l: Optional[float] = None
    renewable_source: Optional[str] = None
    meter_invoice_ref: Optional[str] = None
    data_quality: str = "Actual"
    notes: Optional[str] = None


@router.post("/productions/{production_id}/energy-log")
async def post_energy_log(production_id: str, payload: EnergyLogCreate):
    pool = await _pool()
    prod = await pool.fetchval("SELECT id FROM green_productions WHERE id = $1", production_id)
    if not prod:
        raise HTTPException(status_code=404, detail="production not found")
    fields = payload.model_dump(exclude={"log_date", "region"})
    return await datalog.log_energy(pool, production_id, payload.log_date, payload.region, **fields)


@router.get("/productions/{production_id}/energy-log")
async def get_energy_log(production_id: str):
    pool = await _pool()
    entries = await datalog.list_energy(pool, production_id)
    return {"entries": entries, "count": len(entries)}


class MaterialsLogCreate(BaseModel):
    log_date: date
    region: str = "Global"
    department: Optional[str] = None
    material_item: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[float] = 0
    unit: Optional[str] = None
    condition_new_reused: Optional[str] = None
    locally_sourced: Optional[bool] = None
    reusable_recyclable: Optional[bool] = None
    supplier: Optional[str] = None
    cost_inr: Optional[float] = None
    disposal_route: Optional[str] = None
    evidence_ref: Optional[str] = None
    data_quality: str = "Actual"
    notes: Optional[str] = None


@router.post("/productions/{production_id}/materials-log")
async def post_materials_log(production_id: str, payload: MaterialsLogCreate):
    pool = await _pool()
    prod = await pool.fetchval("SELECT id FROM green_productions WHERE id = $1", production_id)
    if not prod:
        raise HTTPException(status_code=404, detail="production not found")
    fields = payload.model_dump(exclude={"log_date", "region"})
    return await datalog.log_materials(pool, production_id, payload.log_date, payload.region, **fields)


@router.get("/productions/{production_id}/materials-log")
async def get_materials_log(production_id: str):
    pool = await _pool()
    entries = await datalog.list_materials(pool, production_id)
    return {"entries": entries, "count": len(entries)}


class AccommodationLogCreate(BaseModel):
    log_date: date
    region: str = "Global"
    property_hotel: Optional[str] = None
    location_name: Optional[str] = None
    crew_cast_category: Optional[str] = None
    rooms_occupied: Optional[int] = 0
    nights: Optional[int] = 0
    occupancy_per_room: Optional[float] = None
    total_room_nights: Optional[float] = None
    check_in: Optional[date] = None
    check_out: Optional[date] = None
    electricity_included: Optional[bool] = None
    water_included: Optional[bool] = None
    waste_services: Optional[bool] = None
    laundry_services: Optional[bool] = None
    booking_ref: Optional[str] = None
    cost_inr: Optional[float] = None
    data_quality: str = "Actual"
    notes: Optional[str] = None


@router.post("/productions/{production_id}/accommodation-log")
async def post_accommodation_log(production_id: str, payload: AccommodationLogCreate):
    pool = await _pool()
    prod = await pool.fetchval("SELECT id FROM green_productions WHERE id = $1", production_id)
    if not prod:
        raise HTTPException(status_code=404, detail="production not found")
    fields = payload.model_dump(exclude={"log_date", "region"})
    return await datalog.log_accommodation(pool, production_id, payload.log_date, payload.region, **fields)


@router.get("/productions/{production_id}/accommodation-log")
async def get_accommodation_log(production_id: str):
    pool = await _pool()
    entries = await datalog.list_accommodation(pool, production_id)
    return {"entries": entries, "count": len(entries)}


class FoodCateringLogCreate(BaseModel):
    log_date: date
    region: str = "Global"
    location_name: Optional[str] = None
    meal: Optional[str] = None
    covers_servings: Optional[int] = None
    menu_type: Optional[str] = None
    food_purchased_kg: Optional[float] = None
    food_waste_kg: Optional[float] = None
    packaging_waste_kg: Optional[float] = None
    vegetarian_covers: Optional[int] = 0
    nonveg_covers: Optional[int] = 0
    local_seasonal_pct: Optional[float] = None
    plant_based_options: Optional[bool] = None
    reusable_crockery: Optional[bool] = None
    single_use_items_qty: Optional[int] = None
    water_used_l: Optional[float] = None
    supplier: Optional[str] = None
    evidence_ref: Optional[str] = None
    data_quality: str = "Actual"
    notes: Optional[str] = None


@router.post("/productions/{production_id}/food-catering-log")
async def post_food_catering_log(production_id: str, payload: FoodCateringLogCreate):
    pool = await _pool()
    prod = await pool.fetchval("SELECT id FROM green_productions WHERE id = $1", production_id)
    if not prod:
        raise HTTPException(status_code=404, detail="production not found")
    fields = payload.model_dump(exclude={"log_date", "region"})
    return await datalog.log_food_catering(pool, production_id, payload.log_date, payload.region, **fields)


@router.get("/productions/{production_id}/food-catering-log")
async def get_food_catering_log(production_id: str):
    pool = await _pool()
    entries = await datalog.list_food_catering(pool, production_id)
    return {"entries": entries, "count": len(entries)}


class EvidenceCreate(BaseModel):
    evidence_type: str
    evidence_date: Optional[date] = None
    file_url: Optional[str] = None
    file_folder_reference: Optional[str] = None
    description: Optional[str] = None
    data_category: Optional[str] = None
    source_vendor: Optional[str] = None
    amount_quantity: Optional[float] = None
    unit: Optional[str] = None
    verified_by: Optional[str] = None
    verification_date: Optional[date] = None
    status: str = "pending"
    remarks: Optional[str] = None


@router.post("/productions/{production_id}/evidence")
async def post_evidence(production_id: str, payload: EvidenceCreate):
    pool = await _pool()
    prod = await pool.fetchval("SELECT id FROM green_productions WHERE id = $1", production_id)
    if not prod:
        raise HTTPException(status_code=404, detail="production not found")
    fields = payload.model_dump(exclude={"evidence_type", "evidence_date"})
    return await datalog.log_evidence(pool, production_id, payload.evidence_type, payload.evidence_date, **fields)


@router.get("/productions/{production_id}/evidence")
async def get_evidence(production_id: str):
    pool = await _pool()
    entries = await datalog.list_evidence(pool, production_id)
    return {"entries": entries, "count": len(entries)}


@router.get("/productions/{production_id}/data-log-summary")
async def get_data_log_summary(production_id: str):
    pool = await _pool()
    prod = await pool.fetchval("SELECT id FROM green_productions WHERE id = $1", production_id)
    if not prod:
        raise HTTPException(status_code=404, detail="production not found")
    return await datalog.get_data_log_summary(pool, production_id)


# ── Questionnaire ─────────────────────────────────────────────────────────────

@router.get("/questionnaire")
async def get_questionnaire(phase: Optional[str] = None):
    pool = await _pool()
    if phase:
        rows = await pool.fetch(
            "SELECT * FROM green_questionnaire_questions "
            "WHERE phase = $1 OR phase = 'general' ORDER BY sort_order",
            phase,
        )
    else:
        rows = await pool.fetch("SELECT * FROM green_questionnaire_questions ORDER BY sort_order")
    questions = [_row_to_dict(r, json_fields=("options",)) for r in rows]
    return {"questions": questions, "count": len(questions)}


@router.post("/productions/{production_id}/questionnaire-responses")
async def submit_response(production_id: str, payload: QuestionnaireResponseCreate):
    pool = await _pool()
    exists = await pool.fetchval(
        "SELECT 1 FROM green_questionnaire_questions WHERE id = $1", payload.question_id)
    if not exists:
        raise HTTPException(status_code=404, detail="unknown question_id")
    row = await pool.fetchrow(
        """
        INSERT INTO green_questionnaire_responses (production_id, question_id, response, answered_by)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (production_id, question_id)
        DO UPDATE SET response = EXCLUDED.response, answered_by = EXCLUDED.answered_by, answered_at = NOW()
        RETURNING id, answered_at
        """,
        production_id, payload.question_id, json.dumps(payload.response), payload.answered_by,
    )
    return {"id": row["id"], "answeredAt": row["answered_at"].isoformat()}


# ── Scoring & certification ──────────────────────────────────────────────────

@router.get("/productions/{production_id}/score")
async def get_score(production_id: str, persist: bool = True):
    pool = await _pool()
    prod = await pool.fetchval("SELECT id FROM green_productions WHERE id = $1", production_id)
    if not prod:
        raise HTTPException(status_code=404, detail="production not found")
    return await scoring.compute_score(pool, production_id, persist=persist)


@router.get("/certification-levels")
async def get_certification_levels():
    pool = await _pool()
    rows = await pool.fetch(
        "SELECT * FROM green_certification_levels ORDER BY sort_order")
    return {"levels": [_row_to_dict(r, json_fields=("mandatory_criteria",)) for r in rows]}


@router.get("/productions/{production_id}/certifications")
async def get_certifications(production_id: str):
    pool = await _pool()
    rows = await pool.fetch(
        "SELECT * FROM green_certifications WHERE production_id = $1 ORDER BY issued_at DESC",
        production_id,
    )
    return {"certifications": [_row_to_dict(r, json_fields=("metadata",)) for r in rows]}


class CertificateStatusUpdate(BaseModel):
    status: str
    reviewer_notes: Optional[str] = None
    actor_id: Optional[str] = None


@router.post("/certifications/{certificate_id}/status")
async def update_certificate_status(certificate_id: str, payload: CertificateStatusUpdate):
    """Reviewer approval step: pending -> verified (or revoked). This is the
    admin-only 'Reviewer Assessment / Approval' stage of the certification
    workflow — no RBAC gate is wired up yet in this phase (see routers/auth.py
    for the JWT/RBAC pattern to apply once an admin console exists)."""
    pool = await _pool()
    try:
        return await certification.set_verification_status(
            pool, certificate_id, payload.status,
            reviewer_notes=payload.reviewer_notes, actor_id=payload.actor_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Public certificate verification portal (no auth — anyone can verify) ─────

@router.get("/verify/{certificate_number}")
async def verify_certificate(certificate_number: str):
    pool = await _pool()
    result = await certification.get_certificate_by_number(pool, certificate_number)
    if result is None:
        raise HTTPException(status_code=404, detail="no certificate found with that number")
    return result


@router.get("/verify/{certificate_number}/qrcode")
async def certificate_qrcode(certificate_number: str):
    pool = await _pool()
    result = await certification.get_certificate_by_number(pool, certificate_number)
    if result is None:
        raise HTTPException(status_code=404, detail="no certificate found with that number")
    png = certification.qr_png_bytes(certification.verify_url(certificate_number))
    return Response(content=png, media_type="image/png")


# ── Certification Review (application/review pipeline — replaces self-issue) ─
# A production can never self-issue a certificate. Submission only creates an
# *application*; a real certificate is produced solely by the reviewer
# "issue-certificate" action, reachable only after an approval decision.
# No reviewer authentication exists yet in this codebase (same gap already
# noted on the pre-existing certificate status endpoint above) — these
# reviewer endpoints are actor-tagged, not RBAC-gated.

class ApplicationSubmitRequest(BaseModel):
    actor: str = "Applicant"


@router.post("/productions/{production_id}/certification-applications")
async def submit_certification_application(production_id: str, payload: ApplicationSubmitRequest):
    pool = await _pool()
    prod = await pool.fetchval("SELECT id FROM green_productions WHERE id = $1", production_id)
    if not prod:
        raise HTTPException(status_code=404, detail="production not found")
    try:
        return await application.submit_application(pool, production_id, actor=payload.actor)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/productions/{production_id}/certification-applications")
async def list_certification_applications(production_id: str):
    pool = await _pool()
    apps = await application.list_applications(pool, production_id)
    return {"applications": apps, "count": len(apps)}


@router.get("/certification-applications/{application_id}")
async def get_certification_application(application_id: str):
    pool = await _pool()
    try:
        return await application.get_application(pool, application_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


class ReviewerAssignRequest(BaseModel):
    reviewer_name: str
    actor: str = "Reviewer"


@router.post("/certification-applications/{application_id}/reviewer/assign")
async def assign_application_reviewer(application_id: str, payload: ReviewerAssignRequest):
    pool = await _pool()
    try:
        return await application.assign_reviewer(pool, application_id, payload.reviewer_name, payload.actor)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class StageAdvanceRequest(BaseModel):
    to_stage: str
    actor: str = "Reviewer"
    comment: Optional[str] = None


@router.post("/certification-applications/{application_id}/reviewer/advance-stage")
async def advance_application_stage(application_id: str, payload: StageAdvanceRequest):
    pool = await _pool()
    try:
        return await application.advance_stage(pool, application_id, payload.to_stage, payload.actor, payload.comment)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class DocumentsRequestRequest(BaseModel):
    items: list[str]
    actor: str = "Reviewer"
    deadline: Optional[date] = None
    comment: Optional[str] = None


@router.post("/certification-applications/{application_id}/reviewer/request-documents")
async def request_application_documents(application_id: str, payload: DocumentsRequestRequest):
    pool = await _pool()
    try:
        return await application.request_documents(
            pool, application_id, payload.items, payload.actor, deadline=payload.deadline, comment=payload.comment)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class ApplicationCommentRequest(BaseModel):
    actor: str = "Reviewer"
    comment: str


@router.post("/certification-applications/{application_id}/reviewer/comment")
async def comment_on_application(application_id: str, payload: ApplicationCommentRequest):
    pool = await _pool()
    try:
        return await application.add_comment(pool, application_id, payload.actor, payload.comment)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class ApplicationDecisionRequest(BaseModel):
    decision: str
    actor: str = "Reviewer"
    comment: Optional[str] = None
    items: Optional[list[str]] = None
    deadline: Optional[date] = None


@router.post("/certification-applications/{application_id}/reviewer/decision")
async def record_application_decision(application_id: str, payload: ApplicationDecisionRequest):
    pool = await _pool()
    try:
        return await application.record_decision(
            pool, application_id, payload.decision, payload.actor,
            comment=payload.comment, items=payload.items, deadline=payload.deadline)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class IssueCertificateForApplicationRequest(BaseModel):
    actor: str = "Reviewer"


@router.post("/certification-applications/{application_id}/reviewer/issue-certificate")
async def issue_certificate_for_application(application_id: str, payload: IssueCertificateForApplicationRequest):
    """Stage 7 — the only path that produces a real certificate. Only reachable
    after a reviewer has recorded an 'approved'/'approved_with_conditions' decision."""
    pool = await _pool()
    try:
        return await application.issue_certificate_for_application(pool, application_id, payload.actor)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class DocumentFulfillRequest(BaseModel):
    actor: str = "Applicant"


@router.post("/certification-applications/{application_id}/required-documents/{document_id}/fulfill")
async def fulfill_application_document(application_id: str, document_id: str, payload: DocumentFulfillRequest):
    pool = await _pool()
    try:
        return await application.fulfill_document(pool, application_id, document_id, payload.actor)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class ApplicationResubmitRequest(BaseModel):
    actor: str = "Applicant"


@router.post("/certification-applications/{application_id}/resubmit")
async def resubmit_certification_application(application_id: str, payload: ApplicationResubmitRequest):
    pool = await _pool()
    try:
        return await application.resubmit_application(pool, application_id, payload.actor)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Certification Review — Download Center ────────────────────────────────────

@router.get("/certification-applications/{application_id}/downloads/submission-summary.pdf")
async def download_submission_summary(application_id: str):
    pool = await _pool()
    try:
        app_detail = await application.get_application(pool, application_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    pdf_bytes = application_pdf.build_submission_summary_pdf(app_detail)
    return Response(content=pdf_bytes, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="{app_detail["application_number"]}-submission-summary.pdf"'})


@router.get("/certification-applications/{application_id}/downloads/review-report.pdf")
async def download_review_report(application_id: str):
    pool = await _pool()
    try:
        app_detail = await application.get_application(pool, application_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    pdf_bytes = application_pdf.build_review_report_pdf(app_detail)
    return Response(content=pdf_bytes, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="{app_detail["application_number"]}-review-report.pdf"'})


@router.get("/certification-applications/{application_id}/downloads/certificate.pdf")
async def download_certificate(application_id: str):
    pool = await _pool()
    try:
        app_detail = await application.get_application(pool, application_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    if app_detail["status"] != "certified" or not app_detail.get("certificate_number"):
        raise HTTPException(status_code=403, detail="certificate is not available until the application reaches 'certified' status")
    pdf_bytes = application_pdf.build_certificate_pdf(
        app_detail, app_detail["certificate_number"], app_detail["certificate_level_label"],
        float(app_detail["score"]), app_detail["certificate_issued_at"], app_detail["certificate_expires_at"],
    )
    return Response(content=pdf_bytes, media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="{app_detail["certificate_number"]}-certificate.pdf"'})
