"""
Climactix Global — Industry Ontology & Materiality Engine v1.0
Sector-specific pillar weights, material indicators, peer groups, and carbon benchmarks.
Proprietary IP of Climactix Global. All rights reserved.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class IndustryConfig:
    code: str
    label: str
    sector_group: str
    pillar_weights: Dict[str, float]       # must sum to 1.0
    material_indicators: List[str]
    carbon_intensity_median: float         # tCO2e per $M revenue — sector median
    carbon_intensity_leader: float         # top-decile threshold
    peer_group: str
    primary_physical_hazards: List[str]
    primary_transition_risks: List[str]
    applicable_frameworks: List[str]


INDUSTRY_CONFIGS: Dict[str, IndustryConfig] = {

    "banking": IndustryConfig(
        code="banking", label="Banking & Financial Services", sector_group="Financial",
        pillar_weights={
            "governance": 0.20, "physical_risk": 0.10, "transition_risk": 0.25,
            "disclosure": 0.20, "resilience": 0.10, "financial_materiality": 0.15,
        },
        material_indicators=[
            "financed_emissions", "portfolio_transition_risk", "climate_lending_exposure",
            "green_finance_ratio", "climate_stress_test", "pcaf_alignment",
        ],
        carbon_intensity_median=8.5, carbon_intensity_leader=2.0,
        peer_group="global_banks",
        primary_physical_hazards=["flood", "sea_level", "heat_stress"],
        primary_transition_risks=["regulatory", "portfolio_stranding", "credit_risk"],
        applicable_frameworks=["TCFD", "ISSB S2", "PCAF", "NGFS", "RBI Climate Guidelines"],
    ),

    "insurance": IndustryConfig(
        code="insurance", label="Insurance & Reinsurance", sector_group="Financial",
        pillar_weights={
            "governance": 0.18, "physical_risk": 0.25, "transition_risk": 0.20,
            "disclosure": 0.17, "resilience": 0.10, "financial_materiality": 0.10,
        },
        material_indicators=[
            "catastrophe_loss_exposure", "climate_underwriting_risk",
            "investment_portfolio_climate_risk", "nat_cat_reserve_adequacy", "climate_pricing_model",
        ],
        carbon_intensity_median=5.2, carbon_intensity_leader=1.5,
        peer_group="global_insurers",
        primary_physical_hazards=["cyclone", "flood", "wildfire", "heat_stress"],
        primary_transition_risks=["stranded_investment_assets", "regulatory"],
        applicable_frameworks=["TCFD", "ISSB S2", "IAIS ISSF"],
    ),

    "oil_gas": IndustryConfig(
        code="oil_gas", label="Oil & Gas", sector_group="Energy",
        pillar_weights={
            "governance": 0.12, "physical_risk": 0.15, "transition_risk": 0.30,
            "disclosure": 0.13, "resilience": 0.12, "financial_materiality": 0.18,
        },
        material_indicators=[
            "scope3_absolute_emissions", "stranded_asset_value", "carbon_price_exposure",
            "reserve_life_index", "capex_fossil_vs_clean", "methane_intensity", "flaring_intensity",
        ],
        carbon_intensity_median=485.0, carbon_intensity_leader=120.0,
        peer_group="global_oil_gas",
        primary_physical_hazards=["cyclone", "sea_level", "flood", "heat_stress"],
        primary_transition_risks=["carbon_tax", "demand_destruction", "stranded_assets", "CBAM", "ETS"],
        applicable_frameworks=["TCFD", "ISSB S2", "GRI 305", "CDP", "OGCI"],
    ),

    "energy": IndustryConfig(
        code="energy", label="Energy & Utilities", sector_group="Energy",
        pillar_weights={
            "governance": 0.13, "physical_risk": 0.18, "transition_risk": 0.28,
            "disclosure": 0.13, "resilience": 0.15, "financial_materiality": 0.13,
        },
        material_indicators=[
            "fuel_mix", "carbon_intensity_kwh", "stranded_thermal_assets",
            "renewable_capacity_pct", "water_withdrawal_per_kwh", "grid_resilience",
        ],
        carbon_intensity_median=320.0, carbon_intensity_leader=25.0,
        peer_group="global_utilities",
        primary_physical_hazards=["water_stress", "heat_stress", "flood", "cyclone"],
        primary_transition_risks=["carbon_pricing", "fuel_transition", "stranded_coal", "ETS"],
        applicable_frameworks=["TCFD", "ISSB S2", "GRI 302", "CDP", "EU Taxonomy"],
    ),

    "renewables": IndustryConfig(
        code="renewables", label="Renewable Energy", sector_group="Energy",
        pillar_weights={
            "governance": 0.15, "physical_risk": 0.25, "transition_risk": 0.15,
            "disclosure": 0.15, "resilience": 0.20, "financial_materiality": 0.10,
        },
        material_indicators=[
            "irradiance_variability_risk", "wind_resource_stability",
            "supply_chain_concentration", "land_water_conflicts", "battery_storage_ratio",
        ],
        carbon_intensity_median=18.0, carbon_intensity_leader=3.0,
        peer_group="global_renewables",
        primary_physical_hazards=["cyclone", "heatwave", "flood", "drought"],
        primary_transition_risks=["supply_chain", "technology_disruption", "grid_curtailment"],
        applicable_frameworks=["TCFD", "ISSB S2", "RE100", "SBTi", "GRI"],
    ),

    "manufacturing": IndustryConfig(
        code="manufacturing", label="Manufacturing & Industrials", sector_group="Industrial",
        pillar_weights={
            "governance": 0.14, "physical_risk": 0.18, "transition_risk": 0.24,
            "disclosure": 0.14, "resilience": 0.15, "financial_materiality": 0.15,
        },
        material_indicators=[
            "energy_intensity", "water_consumption", "supply_chain_disruption_risk",
            "scope3_upstream_exposure", "process_heat_decarbonization", "CBAM_tariff_exposure",
        ],
        carbon_intensity_median=145.0, carbon_intensity_leader=28.0,
        peer_group="global_manufacturing",
        primary_physical_hazards=["flood", "heat_stress", "water_stress"],
        primary_transition_risks=["carbon_tax", "CBAM", "energy_cost", "technology"],
        applicable_frameworks=["TCFD", "ISSB S2", "GRI 305", "BRSR", "ISO 14001"],
    ),

    "steel_metals": IndustryConfig(
        code="steel_metals", label="Steel & Metals", sector_group="Industrial",
        pillar_weights={
            "governance": 0.12, "physical_risk": 0.16, "transition_risk": 0.30,
            "disclosure": 0.13, "resilience": 0.15, "financial_materiality": 0.14,
        },
        material_indicators=[
            "blast_furnace_vs_eaf_ratio", "green_hydrogen_readiness",
            "scope1_intensity_per_tonne", "CBAM_steel_tariff_exposure",
            "coal_dependency", "water_usage_intensity",
        ],
        carbon_intensity_median=580.0, carbon_intensity_leader=85.0,
        peer_group="global_steel",
        primary_physical_hazards=["water_stress", "heat_stress", "flood"],
        primary_transition_risks=["CBAM", "carbon_pricing", "green_steel_competition", "coal_phase_out"],
        applicable_frameworks=["TCFD", "ISSB S2", "SBTi", "ResponsibleSteel"],
    ),

    "cement": IndustryConfig(
        code="cement", label="Cement & Building Materials", sector_group="Industrial",
        pillar_weights={
            "governance": 0.12, "physical_risk": 0.15, "transition_risk": 0.32,
            "disclosure": 0.12, "resilience": 0.14, "financial_materiality": 0.15,
        },
        material_indicators=[
            "clinker_ratio", "alternative_fuel_pct", "ccs_readiness",
            "carbon_intensity_per_tonne", "CBAM_exposure",
        ],
        carbon_intensity_median=680.0, carbon_intensity_leader=420.0,
        peer_group="global_cement",
        primary_physical_hazards=["heat_stress", "water_stress", "drought"],
        primary_transition_risks=["CBAM", "carbon_pricing", "low_carbon_cement_competition"],
        applicable_frameworks=["TCFD", "ISSB S2", "GNR", "SBTi", "GCCA"],
    ),

    "real_estate": IndustryConfig(
        code="real_estate", label="Real Estate & Infrastructure", sector_group="Real Estate",
        pillar_weights={
            "governance": 0.15, "physical_risk": 0.30, "transition_risk": 0.18,
            "disclosure": 0.14, "resilience": 0.15, "financial_materiality": 0.08,
        },
        material_indicators=[
            "flood_zone_asset_value", "building_energy_rating", "urban_heat_island_exposure",
            "green_building_certification_pct", "sea_level_risk_portfolio", "tenant_climate_risk",
        ],
        carbon_intensity_median=55.0, carbon_intensity_leader=8.0,
        peer_group="global_reits",
        primary_physical_hazards=["flood", "sea_level", "heat_stress", "wildfire"],
        primary_transition_risks=["building_regulation", "stranded_brown_assets", "energy_standards"],
        applicable_frameworks=["TCFD", "ISSB S2", "GRESB", "EU Taxonomy", "BRSR"],
    ),

    "it_technology": IndustryConfig(
        code="it_technology", label="Information Technology", sector_group="Technology",
        pillar_weights={
            "governance": 0.20, "physical_risk": 0.15, "transition_risk": 0.20,
            "disclosure": 0.20, "resilience": 0.15, "financial_materiality": 0.10,
        },
        material_indicators=[
            "data_center_pue", "renewable_energy_pct", "water_usage_effectiveness",
            "scope3_supply_chain", "AI_energy_consumption", "e_waste_circularity",
        ],
        carbon_intensity_median=22.0, carbon_intensity_leader=4.0,
        peer_group="global_tech",
        primary_physical_hazards=["heat_stress", "flood", "water_stress"],
        primary_transition_risks=["energy_cost", "regulatory_data_center", "supply_chain"],
        applicable_frameworks=["TCFD", "ISSB S2", "GHG Protocol", "RE100", "CDP"],
    ),

    "automotive": IndustryConfig(
        code="automotive", label="Automotive & Mobility", sector_group="Industrial",
        pillar_weights={
            "governance": 0.14, "physical_risk": 0.14, "transition_risk": 0.28,
            "disclosure": 0.14, "resilience": 0.15, "financial_materiality": 0.15,
        },
        material_indicators=[
            "fleet_ev_transition_rate", "scope3_vehicle_use_emissions", "battery_supply_chain_risk",
            "ICE_stranded_capex", "EV_revenue_mix_pct", "critical_mineral_dependency",
        ],
        carbon_intensity_median=92.0, carbon_intensity_leader=18.0,
        peer_group="global_automotive",
        primary_physical_hazards=["flood", "heat_stress", "supply_chain_disruption"],
        primary_transition_risks=["EV_disruption", "ICE_ban_regulation", "battery_supply_chain", "CAFE_standards"],
        applicable_frameworks=["TCFD", "ISSB S2", "SBTi", "EU Green Deal", "CAFE"],
    ),

    "shipping": IndustryConfig(
        code="shipping", label="Shipping & Maritime", sector_group="Transportation",
        pillar_weights={
            "governance": 0.13, "physical_risk": 0.18, "transition_risk": 0.30,
            "disclosure": 0.13, "resilience": 0.16, "financial_materiality": 0.10,
        },
        material_indicators=[
            "CII_rating", "EEXI_compliance", "fuel_transition_timeline",
            "green_fuel_readiness", "route_climate_exposure", "arctic_route_risk",
        ],
        carbon_intensity_median=210.0, carbon_intensity_leader=55.0,
        peer_group="global_shipping",
        primary_physical_hazards=["cyclone", "sea_level", "extreme_weather"],
        primary_transition_risks=["IMO_2050", "carbon_levy", "green_fuel_cost", "port_regulation"],
        applicable_frameworks=["IMO MEPC", "TCFD", "Poseidon Principles", "Sea Cargo Charter"],
    ),

    "aviation": IndustryConfig(
        code="aviation", label="Aviation & Aerospace", sector_group="Transportation",
        pillar_weights={
            "governance": 0.13, "physical_risk": 0.15, "transition_risk": 0.30,
            "disclosure": 0.14, "resilience": 0.15, "financial_materiality": 0.13,
        },
        material_indicators=[
            "SAF_blending_ratio", "fuel_efficiency_per_RPK", "CORSIA_compliance",
            "fleet_age_carbon_intensity", "route_climate_exposure",
        ],
        carbon_intensity_median=310.0, carbon_intensity_leader=180.0,
        peer_group="global_aviation",
        primary_physical_hazards=["extreme_weather", "heat_stress", "flood"],
        primary_transition_risks=["CORSIA", "SAF_cost", "demand_shift", "airport_regulation"],
        applicable_frameworks=["CORSIA", "TCFD", "ISSB S2", "CDP"],
    ),

    "agriculture": IndustryConfig(
        code="agriculture", label="Agriculture & Food Systems", sector_group="Land Use",
        pillar_weights={
            "governance": 0.12, "physical_risk": 0.30, "transition_risk": 0.20,
            "disclosure": 0.12, "resilience": 0.18, "financial_materiality": 0.08,
        },
        material_indicators=[
            "land_use_change", "deforestation_exposure", "water_usage_intensity",
            "methane_from_livestock", "crop_yield_climate_sensitivity", "soil_carbon_sequestration",
        ],
        carbon_intensity_median=88.0, carbon_intensity_leader=15.0,
        peer_group="global_agriculture",
        primary_physical_hazards=["drought", "flood", "heat_stress", "water_stress", "wildfire"],
        primary_transition_risks=["land_use_regulation", "deforestation_tariffs", "water_pricing"],
        applicable_frameworks=["TCFD", "TNFD", "Science Based Targets for Nature", "GRI 303"],
    ),

    "pharmaceuticals": IndustryConfig(
        code="pharmaceuticals", label="Pharmaceuticals & Healthcare", sector_group="Healthcare",
        pillar_weights={
            "governance": 0.18, "physical_risk": 0.15, "transition_risk": 0.18,
            "disclosure": 0.20, "resilience": 0.15, "financial_materiality": 0.14,
        },
        material_indicators=[
            "supply_chain_geographic_concentration", "water_usage_and_discharge",
            "scope3_patient_care", "pharmaceutical_pollution", "cold_chain_climate_risk",
        ],
        carbon_intensity_median=38.0, carbon_intensity_leader=9.0,
        peer_group="global_pharma",
        primary_physical_hazards=["heat_stress", "flood", "water_stress"],
        primary_transition_risks=["supply_chain", "regulatory", "energy_cost"],
        applicable_frameworks=["TCFD", "ISSB S2", "PSCI", "CDP", "GRI"],
    ),

    "retail_consumer": IndustryConfig(
        code="retail_consumer", label="Retail & Consumer Goods", sector_group="Consumer",
        pillar_weights={
            "governance": 0.16, "physical_risk": 0.16, "transition_risk": 0.22,
            "disclosure": 0.18, "resilience": 0.14, "financial_materiality": 0.14,
        },
        material_indicators=[
            "scope3_product_use", "packaging_circularity", "supply_chain_climate_risk",
            "deforestation_free_sourcing", "climate_preference_shift_risk",
        ],
        carbon_intensity_median=42.0, carbon_intensity_leader=8.0,
        peer_group="global_retail",
        primary_physical_hazards=["heat_stress", "flood", "supply_chain_disruption"],
        primary_transition_risks=["consumer_preference", "packaging_regulation", "supply_chain"],
        applicable_frameworks=["TCFD", "ISSB S2", "CDP", "GRI", "BRSR"],
    ),

    "telecom": IndustryConfig(
        code="telecom", label="Telecommunications", sector_group="Technology",
        pillar_weights={
            "governance": 0.18, "physical_risk": 0.18, "transition_risk": 0.20,
            "disclosure": 0.18, "resilience": 0.16, "financial_materiality": 0.10,
        },
        material_indicators=[
            "network_energy_intensity", "tower_resilience", "data_center_emissions",
            "e_waste_management", "scope2_renewable_pct",
        ],
        carbon_intensity_median=30.0, carbon_intensity_leader=6.0,
        peer_group="global_telecom",
        primary_physical_hazards=["cyclone", "flood", "heat_stress"],
        primary_transition_risks=["energy_cost", "energy_regulation", "network_upgrade_capex"],
        applicable_frameworks=["TCFD", "ISSB S2", "GeSI", "CDP"],
    ),

    "mining": IndustryConfig(
        code="mining", label="Mining & Resources", sector_group="Extractives",
        pillar_weights={
            "governance": 0.13, "physical_risk": 0.20, "transition_risk": 0.27,
            "disclosure": 0.13, "resilience": 0.15, "financial_materiality": 0.12,
        },
        material_indicators=[
            "tailings_climate_risk", "water_intensity", "biodiversity_impact",
            "critical_mineral_transition_opportunity", "stranded_coal_assets", "scope1_intensity",
        ],
        carbon_intensity_median=220.0, carbon_intensity_leader=45.0,
        peer_group="global_mining",
        primary_physical_hazards=["flood", "drought", "water_stress", "wildfire"],
        primary_transition_risks=["carbon_pricing", "coal_phase_out", "water_regulation"],
        applicable_frameworks=["TCFD", "ISSB S2", "IRMA", "GRI", "TNFD"],
    ),

    "chemicals": IndustryConfig(
        code="chemicals", label="Chemicals & Specialty Materials", sector_group="Industrial",
        pillar_weights={
            "governance": 0.13, "physical_risk": 0.16, "transition_risk": 0.28,
            "disclosure": 0.13, "resilience": 0.15, "financial_materiality": 0.15,
        },
        material_indicators=[
            "feedstock_fossil_dependency", "process_emissions_intensity",
            "CBAM_chemical_exposure", "green_chemistry_transition", "water_discharge_quality",
        ],
        carbon_intensity_median=260.0, carbon_intensity_leader=55.0,
        peer_group="global_chemicals",
        primary_physical_hazards=["flood", "water_stress", "heat_stress"],
        primary_transition_risks=["CBAM", "carbon_pricing", "green_chemistry_regulation"],
        applicable_frameworks=["TCFD", "ISSB S2", "Responsible Care", "GRI"],
    ),

    "construction": IndustryConfig(
        code="construction", label="Construction & Engineering", sector_group="Industrial",
        pillar_weights={
            "governance": 0.15, "physical_risk": 0.22, "transition_risk": 0.22,
            "disclosure": 0.14, "resilience": 0.15, "financial_materiality": 0.12,
        },
        material_indicators=[
            "embodied_carbon", "supply_chain_material_intensity", "project_climate_risk",
            "green_building_pct", "worker_heat_exposure",
        ],
        carbon_intensity_median=115.0, carbon_intensity_leader=22.0,
        peer_group="global_construction",
        primary_physical_hazards=["heat_stress", "flood", "cyclone"],
        primary_transition_risks=["building_code", "material_cost", "low_carbon_material"],
        applicable_frameworks=["TCFD", "ISSB S2", "LEED", "BREEAM", "BRSR"],
    ),

    "default": IndustryConfig(
        code="default", label="General Industry", sector_group="Other",
        pillar_weights={
            "governance": 0.15, "physical_risk": 0.20, "transition_risk": 0.20,
            "disclosure": 0.15, "resilience": 0.15, "financial_materiality": 0.15,
        },
        material_indicators=["emissions", "governance", "disclosure", "resilience"],
        carbon_intensity_median=85.0, carbon_intensity_leader=15.0,
        peer_group="global_all",
        primary_physical_hazards=["flood", "heat_stress", "water_stress"],
        primary_transition_risks=["carbon_pricing", "regulation", "energy"],
        applicable_frameworks=["TCFD", "ISSB S2", "GRI", "BRSR"],
    ),
}


def get_industry_config(industry_code: str) -> IndustryConfig:
    return INDUSTRY_CONFIGS.get(industry_code, INDUSTRY_CONFIGS["default"])


def list_industries() -> List[str]:
    return [k for k in INDUSTRY_CONFIGS if k != "default"]


def get_material_indicators(industry_code: str) -> List[str]:
    return get_industry_config(industry_code).material_indicators


def get_peer_group(industry_code: str) -> str:
    return get_industry_config(industry_code).peer_group
