"""
Climactix Green Production router — /api/v1/green-production/*

Production registration, activity/water/waste logging, footprint
computation, sustainability questionnaire, scoring, and certification
lookup for the Green Film Certification platform.
"""

import json
from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

import database as db
from services import green_carbon_engine as carbon
from services import green_water_waste_engine as water_waste
from services import green_score_engine as scoring
from services import green_certification_engine as certification

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
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/productions/{production_id}/waste-summary")
async def waste_summary(production_id: str):
    pool = await _pool()
    return await water_waste.get_waste_summary(pool, production_id)


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


class CertificateIssueRequest(BaseModel):
    issued_by: str = "Climactix Global"
    actor_id: Optional[str] = None


@router.post("/productions/{production_id}/certifications/issue")
async def issue_certificate(production_id: str, payload: CertificateIssueRequest):
    """Re-scores the production and issues a certificate at whatever level
    it currently clears. The certificate starts in 'pending' status until a
    reviewer approves it via /certifications/{certificate_id}/status."""
    pool = await _pool()
    prod = await pool.fetchval("SELECT id FROM green_productions WHERE id = $1", production_id)
    if not prod:
        raise HTTPException(status_code=404, detail="production not found")
    try:
        return await certification.issue_certificate(
            pool, production_id, issued_by=payload.issued_by, actor_id=payload.actor_id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


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
