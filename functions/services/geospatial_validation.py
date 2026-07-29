"""
Climactix — Environmental & Geospatial Validation
====================================================
Part of the Climactix Evidence Intelligence Agent (see evidence_intelligence_agent.py).

Spec §7: where a claim is location-dependent, cross-check it against
facility/project location data and (where available) environmental/geospatial
datasets — water-stress indices, satellite/remote-sensing corroboration.

Two distinct halves, deliberately kept separate:

1. STRUCTURAL VALIDATION (real, deterministic, ships today): for claims like
   afforestation/tree-planting, checks that the claim actually states the
   fields the spec requires before any carbon/sequestration inference is
   possible — Location, Area, Species, Plantation Date, Number Planted,
   Survival Rate, Mortality Rate, Replacement Policy, Permanence, Monitoring
   Evidence. This module NEVER concludes "trees planted ⇒ carbon
   sequestration" — that inference requires survival, growth, species,
   geography, permanence, baseline, and additionality data this module can
   only check for presence/absence of, not fabricate (spec §7 hard rule).

2. DATASET CROSS-CHECK (stubbed, same discipline as external_verification.py):
   corroborating a facility's claimed risk profile (e.g. "low water risk")
   against a real water-stress/hazard dataset, or a plantation's survival
   claim against satellite/remote-sensing time series. No such dataset is
   wired into this build — returns GEOSPATIAL_DATA_UNAVAILABLE honestly,
   with the same provider-registration escape hatch as external_verification.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Optional


# ── 1. Structural validation (real) ──────────────────────────────────────────

_AFFORESTATION_REQUIRED_FIELDS = (
    ("location", "Facility/project location"),
    ("area", "Planted area"),
    ("species", "Species planted"),
    ("plantation_date", "Plantation date"),
    ("number_planted", "Number of trees/units planted"),
    ("survival_rate", "Survival rate"),
    ("mortality_rate", "Mortality rate"),
    ("replacement_policy", "Replacement policy for mortality"),
    ("permanence", "Permanence commitment (e.g. land-use protection period)"),
    ("monitoring_evidence", "Ongoing monitoring evidence (e.g. survey, satellite, third-party audit)"),
)


@dataclass
class StructuralValidationResult:
    complete: bool
    present_fields: list
    missing_fields: list
    carbon_inference_supported: bool
    caveat: str


def validate_afforestation_claim(claim_fields: dict) -> StructuralValidationResult:
    """
    `claim_fields`: dict with any subset of the keys in
    _AFFORESTATION_REQUIRED_FIELDS, extracted from evidence text (values are
    "present" signals — the raw extracted value or None/absent).

    Never infers carbon sequestration from tree-planting alone — even a
    structurally complete claim only supports the caveat below, not a
    quantified carbon claim, because that additionally requires growth-rate
    modelling, baseline/additionality analysis, and time-series monitoring
    beyond what a single evidence document can establish.
    """
    present = [label for key, label in _AFFORESTATION_REQUIRED_FIELDS if claim_fields.get(key)]
    missing = [label for key, label in _AFFORESTATION_REQUIRED_FIELDS if not claim_fields.get(key)]

    return StructuralValidationResult(
        complete=not missing,
        present_fields=present,
        missing_fields=missing,
        carbon_inference_supported=False,
        caveat=(
            "Tree-planting/afforestation claims do not, by themselves, establish carbon "
            "sequestration — that additionally requires species-specific growth-rate modelling, "
            "a defined baseline and additionality case, and multi-year monitoring data. This "
            "validation checks only whether the claim's own operational disclosure is complete."
        ),
    )


# ── 2. Dataset cross-check (stubbed, provider-pluggable) ────────────────────

GEOSPATIAL_DATASET_TYPES = (
    "water_stress_index",       # e.g. WRI Aqueduct-style baseline water stress
    "physical_hazard_model",    # flood/cyclone/heatwave/wildfire hazard layers
    "satellite_land_cover",     # remote-sensing corroboration of land use/afforestation
)


@dataclass
class GeospatialCheckResult:
    status: str  # "CORROBORATED" | "CONTRADICTED" | "PARTIAL" | "GEOSPATIAL_DATA_UNAVAILABLE"
    dataset_type: Optional[str]
    reason: str
    checked_types: list = field(default_factory=list)


ProviderFn = Callable[[dict, tuple], Optional[GeospatialCheckResult]]

_PROVIDERS: list[ProviderFn] = []


def register_provider(provider: ProviderFn) -> None:
    """Register a real geospatial dataset provider — see external_verification.py's
    register_provider() for the identical pattern. No providers are registered
    by default in this build."""
    _PROVIDERS.append(provider)


def _no_provider_configured(facility: dict, dataset_types: tuple) -> GeospatialCheckResult:
    facility_label = facility.get("name") or facility.get("location") or "this facility/project"
    return GeospatialCheckResult(
        status="GEOSPATIAL_DATA_UNAVAILABLE",
        dataset_type=None,
        reason=(
            f"No geospatial dataset provider is configured for {', '.join(dataset_types)}. "
            f"The location-dependent claim for {facility_label} has not been cross-checked against "
            f"any environmental dataset — this is an evidence gap, not a confirmed match or mismatch. "
            f"Register a provider via geospatial_validation.register_provider() to enable real checks."
        ),
        checked_types=[],
    )


def cross_check_geospatial(facility: dict, dataset_types: tuple = GEOSPATIAL_DATASET_TYPES) -> GeospatialCheckResult:
    """
    Main entry point for the Evidence Intelligence Agent (spec §7 dataset
    cross-check half). `facility`: dict from ros_facilities_v1 — expects
    keys like name, country, state_district, latitude, longitude, area,
    asset_identifier. Never fabricates a hazard/water-stress reading —
    returns GEOSPATIAL_DATA_UNAVAILABLE unless a real provider is registered.
    """
    if not facility or not (facility.get("latitude") and facility.get("longitude")):
        return GeospatialCheckResult(
            status="GEOSPATIAL_DATA_UNAVAILABLE",
            dataset_type=None,
            reason="No facility coordinates provided — a geospatial cross-check requires at minimum latitude/longitude.",
            checked_types=[],
        )
    for provider in _PROVIDERS:
        try:
            result = provider(facility, dataset_types)
        except Exception:
            continue
        if result is not None:
            return result
    return _no_provider_configured(facility, dataset_types)
