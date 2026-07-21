"""
Climactix AI — Global ESG Framework Intelligence Layer
=======================================================
Operationalises ALL major global ESG frameworks into a unified, interoperable
intelligence system.  Frameworks are not treated separately — they are treated
as different lenses over the same underlying ESG reality.

Architecture:
  UNIFIED_ESG_MODEL      — Canonical data-point catalogue (concept → framework map)
  CROSS_FRAMEWORK_MAP    — Equivalence table: one disclosure satisfies N frameworks
  FRAMEWORK_REGISTRY     — Metadata for every supported standard/regulation
  detect_jurisdiction()  — Context inference (India → BRSR, EU → CSRD, etc.)
  map_report_to_model()  — Maps extracted data against unified model
  compute_integrity_score() — ESG Integrity Score (0–100) + risk level
  run_intelligence_analysis() — Full pipeline (extract → map → score → output)
"""

from __future__ import annotations

import re
from typing import Any


# ══════════════════════════════════════════════════════════════════════════════
# FRAMEWORK REGISTRY
# ══════════════════════════════════════════════════════════════════════════════

FRAMEWORK_REGISTRY: dict[str, dict] = {
    # ── Global voluntary frameworks ────────────────────────────────────────────
    "GRI": {
        "full_name": "Global Reporting Initiative",
        "type": "voluntary_framework",
        "focus": "multi-stakeholder disclosure",
        "jurisdiction": "global",
        "target_users": ["corporates", "NGOs", "governments"],
        "latest_version": "GRI Universal Standards 2021",
        "key_standards": ["GRI 1", "GRI 2", "GRI 3", "GRI 300 (Environmental)", "GRI 400 (Social)", "GRI 200 (Economic)"],
        "disclosure_areas": ["governance", "emissions", "energy", "water", "biodiversity", "workforce", "supply_chain", "ethics"],
        "mandatory_in": [],
        "url": "https://www.globalreporting.org",
    },
    "TCFD": {
        "full_name": "Task Force on Climate-related Financial Disclosures",
        "type": "voluntary_framework",
        "focus": "climate financial risk disclosure",
        "jurisdiction": "global",
        "target_users": ["investors", "financial_institutions", "corporates"],
        "latest_version": "2021 Guidance",
        "key_standards": ["Governance", "Strategy", "Risk Management", "Metrics & Targets"],
        "disclosure_areas": ["climate_governance", "climate_strategy", "climate_risk", "climate_metrics"],
        "mandatory_in": ["UK", "New Zealand", "Singapore", "Japan"],
        "url": "https://www.fsb-tcfd.org",
    },
    "CDP": {
        "full_name": "Carbon Disclosure Project",
        "type": "voluntary_framework",
        "focus": "environmental data collection",
        "jurisdiction": "global",
        "target_users": ["corporates", "cities", "investors"],
        "latest_version": "CDP 2024",
        "key_standards": ["Climate Change (C)", "Water Security (W)", "Forests (F)"],
        "disclosure_areas": ["emissions", "energy", "water", "forests", "climate_governance"],
        "mandatory_in": [],
        "url": "https://www.cdp.net",
    },
    "IIRC": {
        "full_name": "Integrated Reporting Framework (IIRC / IFRS Foundation)",
        "type": "voluntary_framework",
        "focus": "integrated capital reporting",
        "jurisdiction": "global",
        "target_users": ["investors", "corporates"],
        "latest_version": "International Framework 2021",
        "key_standards": ["Financial Capital", "Manufactured Capital", "Intellectual Capital", "Human Capital", "Social Capital", "Natural Capital"],
        "disclosure_areas": ["governance", "strategy", "value_creation", "materiality"],
        "mandatory_in": ["South Africa (JSE listed)"],
        "url": "https://www.integratedreporting.org",
    },
    # ── Investor-focused metric standards ─────────────────────────────────────
    "ISSB_S1": {
        "full_name": "IFRS Sustainability Disclosure Standard S1",
        "type": "investor_standard",
        "focus": "general sustainability disclosures",
        "jurisdiction": "global",
        "target_users": ["investors", "capital_markets"],
        "latest_version": "IFRS S1 (2023)",
        "key_standards": ["General Requirements for Sustainability-related Financial Information"],
        "disclosure_areas": ["governance", "strategy", "risk_management", "metrics_targets", "materiality"],
        "mandatory_in": ["UK (SSBR roadmap)", "Australia (AASB)", "Canada (CSA roadmap)"],
        "url": "https://www.ifrs.org/issued-standards/ifrs-sustainability-disclosure-standards/",
    },
    "ISSB_S2": {
        "full_name": "IFRS Sustainability Disclosure Standard S2",
        "type": "investor_standard",
        "focus": "climate-related disclosures",
        "jurisdiction": "global",
        "target_users": ["investors", "capital_markets"],
        "latest_version": "IFRS S2 (2023)",
        "key_standards": ["Climate Governance", "Climate Strategy", "Climate Risk", "GHG Metrics (Scope 1/2/3)"],
        "disclosure_areas": ["climate_governance", "climate_strategy", "physical_risks", "transition_risks", "emissions", "targets"],
        "mandatory_in": ["UK (SSBR)", "Australia", "Brazil"],
        "url": "https://www.ifrs.org/issued-standards/ifrs-sustainability-disclosure-standards/",
    },
    "SASB": {
        "full_name": "Sustainability Accounting Standards Board",
        "type": "investor_standard",
        "focus": "industry-specific financially material metrics",
        "jurisdiction": "global",
        "target_users": ["investors", "corporates"],
        "latest_version": "SASB Standards (77 industry standards)",
        "key_standards": ["Energy", "Materials", "Transportation", "Technology", "Financial", "Healthcare", "Food & Beverage", "Real Estate", "Services", "Resource Transformation"],
        "disclosure_areas": ["industry_specific_kpis", "financial_materiality", "emissions", "workforce", "governance"],
        "mandatory_in": [],
        "url": "https://www.sasb.org",
    },
    # ── Mandatory regulatory frameworks ───────────────────────────────────────
    "CSRD": {
        "full_name": "Corporate Sustainability Reporting Directive (EU)",
        "type": "mandatory_regulation",
        "focus": "mandatory EU sustainability reporting",
        "jurisdiction": "EU",
        "target_users": ["large_EU_companies", "listed_EU_companies", "non_EU_with_EU_operations"],
        "latest_version": "CSRD Directive (EU) 2022/2464",
        "key_standards": ["ESRS E1 (Climate)", "ESRS E2 (Pollution)", "ESRS E3 (Water)", "ESRS E4 (Biodiversity)", "ESRS E5 (Circular Economy)", "ESRS S1–S4 (Social)", "ESRS G1 (Governance)"],
        "disclosure_areas": ["double_materiality", "governance", "emissions", "energy", "water", "biodiversity", "workforce", "supply_chain", "ethics"],
        "mandatory_in": ["EU", "EEA"],
        "phased_in": True,
        "phase_1": "2024 FY (large PIEs > 500 employees)",
        "phase_2": "2025 FY (other large companies)",
        "phase_3": "2026 FY (listed SMEs)",
        "url": "https://finance.ec.europa.eu/capital-markets-union-and-financial-markets/company-reporting-and-auditing/company-reporting/corporate-sustainability-reporting_en",
    },
    "ESRS": {
        "full_name": "European Sustainability Reporting Standards",
        "type": "mandatory_regulation",
        "focus": "detailed CSRD disclosure standards",
        "jurisdiction": "EU",
        "target_users": ["EU_corporates"],
        "latest_version": "ESRS Set 1 (Commission Delegated Regulation 2023)",
        "key_standards": [
            "ESRS 1 (General Principles)", "ESRS 2 (General Disclosures)",
            "ESRS E1 (Climate Change)", "ESRS E2 (Pollution)", "ESRS E3 (Water)",
            "ESRS E4 (Biodiversity)", "ESRS E5 (Resource Use)",
            "ESRS S1 (Own Workforce)", "ESRS S2 (Workers in Value Chain)",
            "ESRS S3 (Affected Communities)", "ESRS S4 (Consumers)",
            "ESRS G1 (Governance & Business Conduct)",
        ],
        "disclosure_areas": ["climate", "pollution", "water", "biodiversity", "circular_economy", "workforce", "communities", "governance"],
        "mandatory_in": ["EU"],
        "url": "https://www.efrag.org/Activities/2104241416085185/Sustainability-reporting-standards-interim-draft",
    },
    "BRSR": {
        "full_name": "Business Responsibility and Sustainability Report (SEBI, India)",
        "type": "mandatory_regulation",
        "focus": "India-specific corporate ESG reporting",
        "jurisdiction": "India",
        "target_users": ["NSE_BSE_listed_top1000"],
        "latest_version": "BRSR Core (2023) with assurance requirement",
        "key_standards": [
            "Section A: General Disclosures",
            "Section B: Management & Process",
            "Section C: Principle-wise Performance (9 BRSRPrinciples)",
        ],
        "disclosure_areas": ["governance", "emissions", "energy", "water", "waste", "workforce", "community", "supply_chain", "data_privacy"],
        "mandatory_in": ["India"],
        "url": "https://www.sebi.gov.in/legal/circulars/may-2021/business-responsibility-and-sustainability-reporting-by-listed-entities_50096.html",
    },
    "SFDR": {
        "full_name": "Sustainable Finance Disclosure Regulation (EU)",
        "type": "mandatory_regulation",
        "focus": "ESG disclosures for EU financial products and firms",
        "jurisdiction": "EU",
        "target_users": ["asset_managers", "banks", "insurance", "financial_advisors"],
        "latest_version": "SFDR Level 2 RTS (2023)",
        "key_standards": ["Article 6 (no sustainability claims)", "Article 8 (ESG characteristics)", "Article 9 (sustainable investment)"],
        "disclosure_areas": ["PAI_indicators", "sustainable_investment", "ESG_integration", "taxonomy_alignment"],
        "mandatory_in": ["EU"],
        "url": "https://finance.ec.europa.eu/sustainable-finance/disclosures/sustainability-related-disclosure-financial-services-sector_en",
    },
    "SEC_CLIMATE": {
        "full_name": "SEC Climate Disclosure Rule (USA)",
        "type": "mandatory_regulation",
        "focus": "US public company climate risk disclosure",
        "jurisdiction": "USA",
        "target_users": ["SEC_registered_companies"],
        "latest_version": "Final Rule March 2024 (subject to litigation stays)",
        "key_standards": ["Scope 1 & 2 emissions (large accelerated filers)", "Material climate risks", "Risk management processes", "Financial impact of severe weather"],
        "disclosure_areas": ["climate_risk", "emissions", "climate_governance", "financial_materiality"],
        "mandatory_in": ["USA"],
        "url": "https://www.sec.gov/climate",
    },
    # ── Emerging / specialised frameworks ─────────────────────────────────────
    "TNFD": {
        "full_name": "Taskforce on Nature-related Financial Disclosures",
        "type": "emerging_framework",
        "focus": "nature and biodiversity risk disclosure",
        "jurisdiction": "global",
        "target_users": ["corporates", "financial_institutions"],
        "latest_version": "TNFD v1.0 (2023)",
        "key_standards": ["LEAP approach (Locate, Evaluate, Assess, Prepare)", "14 recommended disclosures"],
        "disclosure_areas": ["biodiversity", "ecosystems", "nature_risk", "dependencies"],
        "mandatory_in": [],
        "url": "https://tnfd.global",
    },
    "GRESB": {
        "full_name": "Global Real Estate Sustainability Benchmark",
        "type": "specialised_framework",
        "focus": "real estate & infrastructure ESG",
        "jurisdiction": "global",
        "target_users": ["REITs", "real_estate_funds", "infrastructure_funds"],
        "latest_version": "GRESB 2024 Assessment",
        "key_standards": ["Management", "Performance", "Development"],
        "disclosure_areas": ["energy", "water", "waste", "governance", "tenant_engagement"],
        "mandatory_in": [],
        "url": "https://www.gresb.com",
    },
    "ISO_14001": {
        "full_name": "ISO 14001 Environmental Management Systems",
        "type": "management_standard",
        "focus": "environmental management system certification",
        "jurisdiction": "global",
        "target_users": ["any_organisation"],
        "latest_version": "ISO 14001:2015",
        "key_standards": ["Environmental policy", "Planning", "Implementation", "Checking", "Management review"],
        "disclosure_areas": ["environmental_management", "compliance", "targets"],
        "mandatory_in": [],
        "url": "https://www.iso.org/iso-14001-environmental-management.html",
    },
    "PCAF": {
        "full_name": "Partnership for Carbon Accounting Financials",
        "type": "specialised_framework",
        "focus": "financed emissions accounting",
        "jurisdiction": "global",
        "target_users": ["banks", "insurers", "asset_managers", "pension_funds"],
        "latest_version": "PCAF Standard 2022",
        "key_standards": ["Financed emissions", "Facilitated emissions", "Insurance-associated emissions"],
        "disclosure_areas": ["financed_emissions", "portfolio_alignment", "climate_risk"],
        "mandatory_in": [],
        "url": "https://carbonaccountingfinancials.com",
    },
    "GHG_PROTOCOL": {
        "full_name": "GHG Protocol Corporate Accounting and Reporting Standard",
        "type": "measurement_standard",
        "focus": "GHG emissions accounting methodology",
        "jurisdiction": "global",
        "target_users": ["any_organisation"],
        "latest_version": "Corporate Standard (2015 update), Scope 3 Standard (2011)",
        "key_standards": ["Scope 1 (direct)", "Scope 2 (energy indirect)", "Scope 3 (value chain)"],
        "disclosure_areas": ["emissions"],
        "mandatory_in": [],
        "url": "https://ghgprotocol.org",
    },
    "SBTI": {
        "full_name": "Science Based Targets initiative",
        "type": "target_setting_framework",
        "focus": "science-aligned emissions reduction targets",
        "jurisdiction": "global",
        "target_users": ["corporates"],
        "latest_version": "SBTi Corporate Net-Zero Standard (2021)",
        "key_standards": ["Near-term targets (2030)", "Long-term targets (net-zero)", "1.5°C alignment"],
        "disclosure_areas": ["emissions_targets", "decarbonisation_pathway"],
        "mandatory_in": [],
        "url": "https://sciencebasedtargets.org",
    },
}


# ══════════════════════════════════════════════════════════════════════════════
# UNIFIED ESG DATA MODEL
# Each concept is one lens over the same ESG reality, mapped to every framework
# that touches it.  "met" means the framework requires or recognises this point.
# ══════════════════════════════════════════════════════════════════════════════

UNIFIED_ESG_MODEL: dict[str, dict] = {

    # ── GOVERNANCE ─────────────────────────────────────────────────────────────
    "board_climate_oversight": {
        "category": "Governance",
        "sub_category": "Board & Leadership",
        "concept": "Board-level oversight of climate and ESG risks",
        "metric_type": "qualitative",
        "framework_mappings": {
            "TCFD":      {"pillar": "Governance", "ref": "TCFD Governance a/b",    "weight": 1.0},
            "ISSB_S2":   {"section": "para 6a–6b", "ref": "ISSB S2 para 6",       "weight": 1.0},
            "CSRD":      {"standard": "ESRS 2 GOV-1", "ref": "ESRS 2",            "weight": 1.0},
            "GRI":       {"standard": "GRI 2-9",  "ref": "GRI 2-9",               "weight": 0.8},
            "BRSR":      {"section": "Section A",  "ref": "BRSR Principle 1",     "weight": 1.0},
            "SEC_CLIMATE":{"rule": "Item 1501",   "ref": "SEC Climate Rule",      "weight": 0.9},
            "CDP":       {"section": "C1",         "ref": "CDP C1",                "weight": 0.8},
        },
        "extraction_pattern": r"board\s+(?:oversight|committee|climate|esg|sustainability)",
        "scoring_weight": 0.08,
    },
    "management_climate_processes": {
        "category": "Governance",
        "sub_category": "Management",
        "concept": "Management-level processes for climate / ESG risk",
        "metric_type": "qualitative",
        "framework_mappings": {
            "TCFD":    {"pillar": "Governance", "ref": "TCFD Governance c",    "weight": 0.9},
            "ISSB_S2": {"section": "para 6c",   "ref": "ISSB S2 para 6c",     "weight": 0.9},
            "CSRD":    {"standard": "ESRS 2 GOV-2", "ref": "ESRS 2 GOV-2",   "weight": 0.9},
            "GRI":     {"standard": "GRI 2-13", "ref": "GRI 2-13",            "weight": 0.7},
            "BRSR":    {"section": "Section B", "ref": "BRSR Section B",      "weight": 0.8},
        },
        "extraction_pattern": r"(?:management|executive)\s+(?:climate|esg|sustainability)\s+(?:process|responsibility|oversight)",
        "scoring_weight": 0.05,
    },

    # ── STRATEGY ───────────────────────────────────────────────────────────────
    "climate_risks_opportunities": {
        "category": "Strategy",
        "sub_category": "Risk & Opportunity Identification",
        "concept": "Climate-related risks and opportunities identified and assessed",
        "metric_type": "qualitative",
        "framework_mappings": {
            "TCFD":    {"pillar": "Strategy", "ref": "TCFD Strategy a/b/c",    "weight": 1.0},
            "ISSB_S2": {"section": "para 10", "ref": "ISSB S2 para 10",        "weight": 1.0},
            "CSRD":    {"standard": "ESRS E1-2", "ref": "ESRS E1-2",           "weight": 1.0},
            "GRI":     {"standard": "GRI 201-2", "ref": "GRI 201-2",           "weight": 0.7},
            "CDP":     {"section": "C2",          "ref": "CDP C2",             "weight": 0.9},
            "BRSR":    {"section": "Section C P6","ref": "BRSR P6",            "weight": 0.8},
        },
        "extraction_pattern": r"climate[\s\-]related\s+(?:risk|opportunit|impact|scenario)",
        "scoring_weight": 0.08,
    },
    "scenario_analysis": {
        "category": "Strategy",
        "sub_category": "Scenario Analysis",
        "concept": "Climate scenario analysis performed (≥1.5°C and physical risk scenario)",
        "metric_type": "qualitative",
        "framework_mappings": {
            "TCFD":    {"pillar": "Strategy", "ref": "TCFD Strategy c",        "weight": 1.0},
            "ISSB_S2": {"section": "para 22", "ref": "ISSB S2 para 22",        "weight": 1.0},
            "CSRD":    {"standard": "ESRS E1-3", "ref": "ESRS E1-3",           "weight": 1.0},
            "CDP":     {"section": "C3",          "ref": "CDP C3",             "weight": 0.9},
        },
        "extraction_pattern": r"scenario\s+analysis|1\.5[°\s]?[cC]|2[°\s]?[cC]\s+scenario|physical\s+scenario",
        "scoring_weight": 0.07,
    },
    "transition_plan": {
        "category": "Strategy",
        "sub_category": "Transition Planning",
        "concept": "Decarbonisation transition plan with interim milestones",
        "metric_type": "qualitative",
        "framework_mappings": {
            "ISSB_S2": {"section": "para 29", "ref": "ISSB S2 para 29",        "weight": 1.0},
            "TCFD":    {"pillar": "Strategy", "ref": "TCFD Strategy",          "weight": 0.9},
            "CSRD":    {"standard": "ESRS E1-1", "ref": "ESRS E1-1",           "weight": 1.0},
            "GRI":     {"standard": "GRI 3-3",   "ref": "GRI 3-3",            "weight": 0.7},
            "SBTI":    {"section": "Corporate Standard", "ref": "SBTi",        "weight": 0.9},
        },
        "extraction_pattern": r"transition\s+plan|decarboni(?:s|z)ation\s+(?:plan|pathway|roadmap)|interim\s+(?:target|milestone)",
        "scoring_weight": 0.08,
    },

    # ── RISK MANAGEMENT ────────────────────────────────────────────────────────
    "physical_risk_assessment": {
        "category": "Risk Management",
        "sub_category": "Physical Risks",
        "concept": "Acute and chronic physical climate risks assessed",
        "metric_type": "qualitative",
        "framework_mappings": {
            "TCFD":    {"pillar": "Risk Management", "ref": "TCFD Risk",       "weight": 1.0},
            "ISSB_S2": {"section": "para 10a",        "ref": "ISSB S2 para 10","weight": 1.0},
            "CSRD":    {"standard": "ESRS E1-9",      "ref": "ESRS E1-9",     "weight": 1.0},
            "CDP":     {"section": "C2.3a",            "ref": "CDP C2.3a",     "weight": 0.9},
        },
        "extraction_pattern": r"physical\s+(?:risk|hazard|climate\s+risk|impact|acute|chronic)",
        "scoring_weight": 0.06,
    },
    "transition_risk_assessment": {
        "category": "Risk Management",
        "sub_category": "Transition Risks",
        "concept": "Policy, legal, technology and market transition risks assessed",
        "metric_type": "qualitative",
        "framework_mappings": {
            "TCFD":    {"pillar": "Risk Management", "ref": "TCFD Risk",       "weight": 1.0},
            "ISSB_S2": {"section": "para 10b",        "ref": "ISSB S2 para 10","weight": 1.0},
            "CSRD":    {"standard": "ESRS E1-2",      "ref": "ESRS E1-2",     "weight": 1.0},
        },
        "extraction_pattern": r"transition\s+risk|regulatory\s+risk|policy\s+risk|stranded\s+asset|carbon\s+price",
        "scoring_weight": 0.06,
    },
    "climate_risk_management_process": {
        "category": "Risk Management",
        "sub_category": "Risk Processes",
        "concept": "Processes for identifying and managing climate risk integrated into ERM",
        "metric_type": "qualitative",
        "framework_mappings": {
            "TCFD":    {"pillar": "Risk Management", "ref": "TCFD Risk a/b/c","weight": 1.0},
            "ISSB_S2": {"section": "para 25",         "ref": "ISSB S2 para 25","weight": 1.0},
            "CSRD":    {"standard": "ESRS 2 IRO-1",   "ref": "ESRS 2 IRO-1", "weight": 1.0},
            "GRI":     {"standard": "GRI 2-25",        "ref": "GRI 2-25",     "weight": 0.7},
        },
        "extraction_pattern": r"climate\s+risk\s+(?:management|assessment|process|framework|register|ERM)",
        "scoring_weight": 0.06,
    },

    # ── METRICS & TARGETS — EMISSIONS ─────────────────────────────────────────
    "scope_1_emissions": {
        "category": "Metrics & Targets",
        "sub_category": "GHG Emissions",
        "concept": "Scope 1 (direct) GHG emissions quantified",
        "metric_type": "quantitative",
        "unit": "tCO2e / ktCO2e / MtCO2e",
        "framework_mappings": {
            "GRI":         {"standard": "GRI 305-1",   "ref": "GRI 305-1",     "weight": 1.0},
            "TCFD":        {"pillar": "Metrics",        "ref": "TCFD Metrics",  "weight": 1.0},
            "ISSB_S2":     {"section": "para 29b",      "ref": "ISSB S2 para 29","weight": 1.0},
            "CSRD":        {"standard": "ESRS E1-6",    "ref": "ESRS E1-6",     "weight": 1.0},
            "BRSR":        {"section": "P9 C9",         "ref": "BRSR P9",       "weight": 1.0},
            "SEC_CLIMATE": {"rule": "Item 1504",        "ref": "SEC Climate Rule","weight": 1.0},
            "CDP":         {"section": "C6.1",          "ref": "CDP C6.1",      "weight": 1.0},
            "GHG_PROTOCOL":{"standard": "Scope 1",     "ref": "GHG Protocol",  "weight": 1.0},
            "SBTI":        {"section": "Baseline",      "ref": "SBTi baseline", "weight": 0.8},
        },
        "extraction_pattern": r"scope\s*[1i]\s*(?:emissions?|ghg)?\s*(?:were|is|are|:|\=|of)?\s*([\d,]+\.?\d*)\s*(kt?co2e?|mt?co2e?|t\s*co2e?|tonnes?\s*co2)",
        "scoring_weight": 0.10,
    },
    "scope_2_emissions": {
        "category": "Metrics & Targets",
        "sub_category": "GHG Emissions",
        "concept": "Scope 2 (energy indirect) GHG emissions quantified (market and/or location-based)",
        "metric_type": "quantitative",
        "unit": "tCO2e",
        "framework_mappings": {
            "GRI":         {"standard": "GRI 305-2",   "ref": "GRI 305-2",     "weight": 1.0},
            "TCFD":        {"pillar": "Metrics",        "ref": "TCFD Metrics",  "weight": 1.0},
            "ISSB_S2":     {"section": "para 29b",      "ref": "ISSB S2 para 29","weight": 1.0},
            "CSRD":        {"standard": "ESRS E1-6",    "ref": "ESRS E1-6",     "weight": 1.0},
            "BRSR":        {"section": "P9 C9",         "ref": "BRSR P9",       "weight": 1.0},
            "SEC_CLIMATE": {"rule": "Item 1504",        "ref": "SEC Climate Rule","weight": 0.9},
            "CDP":         {"section": "C6.3",          "ref": "CDP C6.3",      "weight": 1.0},
            "GHG_PROTOCOL":{"standard": "Scope 2",     "ref": "GHG Protocol",  "weight": 1.0},
        },
        "extraction_pattern": r"scope\s*2\s*(?:emissions?|ghg)?\s*(?:were|is|are|:|\=|of)?\s*([\d,]+\.?\d*)\s*(kt?co2e?|mt?co2e?|t\s*co2e?)",
        "scoring_weight": 0.10,
    },
    "scope_3_emissions": {
        "category": "Metrics & Targets",
        "sub_category": "GHG Emissions",
        "concept": "Scope 3 (value chain) GHG emissions quantified by category",
        "metric_type": "quantitative",
        "unit": "tCO2e",
        "framework_mappings": {
            "GRI":         {"standard": "GRI 305-3",   "ref": "GRI 305-3",     "weight": 1.0},
            "ISSB_S2":     {"section": "para 29e",      "ref": "ISSB S2 para 29","weight": 1.0},
            "CSRD":        {"standard": "ESRS E1-6",    "ref": "ESRS E1-6",     "weight": 1.0},
            "CDP":         {"section": "C6.5",          "ref": "CDP C6.5",      "weight": 1.0},
            "GHG_PROTOCOL":{"standard": "Scope 3",     "ref": "GHG Protocol Scope 3","weight": 1.0},
            "SBTI":        {"section": "Value chain",   "ref": "SBTi Scope 3",  "weight": 0.9},
            "BRSR":        {"section": "P9",            "ref": "BRSR P9",       "weight": 0.7},
            "SEC_CLIMATE": {"rule": "Item 1504c",       "ref": "SEC (if material)","weight": 0.7},
        },
        "extraction_pattern": r"scope\s*3\s*(?:emissions?|ghg)?\s*(?:were|is|are|:|\=|of)?\s*([\d,]+\.?\d*)\s*(kt?co2e?|mt?co2e?|t\s*co2e?)",
        "scoring_weight": 0.09,
    },
    "emission_intensity": {
        "category": "Metrics & Targets",
        "sub_category": "GHG Emissions",
        "concept": "GHG emission intensity ratio (per unit revenue/output)",
        "metric_type": "quantitative",
        "framework_mappings": {
            "GRI":     {"standard": "GRI 305-4", "ref": "GRI 305-4",           "weight": 0.9},
            "TCFD":    {"pillar": "Metrics",      "ref": "TCFD Metrics",        "weight": 0.8},
            "ISSB_S2": {"section": "para 29d",    "ref": "ISSB S2 para 29d",   "weight": 0.9},
            "CSRD":    {"standard": "ESRS E1-6",  "ref": "ESRS E1-6",          "weight": 0.9},
            "CDP":     {"section": "C6.10",        "ref": "CDP C6.10",          "weight": 0.8},
            "BRSR":    {"section": "P9",           "ref": "BRSR P9",            "weight": 0.8},
        },
        "extraction_pattern": r"(?:emission|ghg|carbon)\s+intensit",
        "scoring_weight": 0.04,
    },
    "baseline_year": {
        "category": "Metrics & Targets",
        "sub_category": "GHG Targets",
        "concept": "Baseline year defined for all emissions reduction targets",
        "metric_type": "quantitative",
        "framework_mappings": {
            "GRI":     {"standard": "GRI 305-5", "ref": "GRI 305-5",           "weight": 1.0},
            "TCFD":    {"pillar": "Metrics",      "ref": "TCFD Metrics & Targets","weight": 1.0},
            "ISSB_S2": {"section": "para 29c",    "ref": "ISSB S2 para 29c",   "weight": 1.0},
            "CSRD":    {"standard": "ESRS E1-5",  "ref": "ESRS E1-5",          "weight": 1.0},
            "SBTI":    {"section": "Baseline",    "ref": "SBTi",               "weight": 1.0},
        },
        "extraction_pattern": r"base(?:line)?\s+year\s*(?:is|:|\=)?\s*(20\d{2})\b",
        "scoring_weight": 0.06,
    },
    "net_zero_target": {
        "category": "Metrics & Targets",
        "sub_category": "GHG Targets",
        "concept": "Net-zero or carbon neutrality target with year defined",
        "metric_type": "qualitative_quantitative",
        "framework_mappings": {
            "ISSB_S2": {"section": "para 29f",    "ref": "ISSB S2",            "weight": 1.0},
            "TCFD":    {"pillar": "Metrics",      "ref": "TCFD Metrics & Targets","weight": 1.0},
            "CSRD":    {"standard": "ESRS E1-4",  "ref": "ESRS E1-4",          "weight": 1.0},
            "GRI":     {"standard": "GRI 305-5",  "ref": "GRI 305-5",          "weight": 0.8},
            "SBTI":    {"section": "Long-term",   "ref": "SBTi Net-Zero Standard","weight": 1.0},
            "CDP":     {"section": "C4",           "ref": "CDP C4",             "weight": 0.9},
            "BRSR":    {"section": "P6 P9",        "ref": "BRSR",              "weight": 0.8},
        },
        "extraction_pattern": r"net[\s\-]zero\s+(?:by\s+)?(20[2-5]\d)|carbon[\s\-]neutral",
        "scoring_weight": 0.06,
    },

    # ── ENERGY ────────────────────────────────────────────────────────────────
    "energy_consumption": {
        "category": "Metrics & Targets",
        "sub_category": "Energy",
        "concept": "Total energy consumption (absolute, by source)",
        "metric_type": "quantitative",
        "unit": "GWh / TJ / MWh",
        "framework_mappings": {
            "GRI":     {"standard": "GRI 302-1",  "ref": "GRI 302-1",          "weight": 1.0},
            "CSRD":    {"standard": "ESRS E1-5",  "ref": "ESRS E1-5",          "weight": 1.0},
            "BRSR":    {"section": "P6",           "ref": "BRSR P6",            "weight": 1.0},
            "CDP":     {"section": "C8",           "ref": "CDP C8",             "weight": 1.0},
            "ISSB_S2": {"section": "para 29",      "ref": "ISSB S2 para 29",   "weight": 0.7},
            "SEC_CLIMATE":{"rule": "Item 1502",    "ref": "SEC Climate Rule",   "weight": 0.6},
        },
        "extraction_pattern": r"(?:total\s+)?energy\s+(?:consumption|use|usage)\s*(?:was|is|:|\=|of)?\s*([\d,]+\.?\d*)\s*(g?wh|mwh|tj|terajoule|kwh)",
        "scoring_weight": 0.06,
    },
    "renewable_energy": {
        "category": "Metrics & Targets",
        "sub_category": "Energy",
        "concept": "Renewable energy share or absolute renewable energy consumption",
        "metric_type": "quantitative",
        "framework_mappings": {
            "GRI":     {"standard": "GRI 302-1",  "ref": "GRI 302-1",          "weight": 0.9},
            "CSRD":    {"standard": "ESRS E1-5",  "ref": "ESRS E1-5",          "weight": 1.0},
            "BRSR":    {"section": "P6",           "ref": "BRSR P6",            "weight": 0.9},
            "CDP":     {"section": "C8.2",         "ref": "CDP C8.2",           "weight": 0.9},
        },
        "extraction_pattern": r"renewable\s+energy\s+(?:share|%|percent|proportion|consumption|generated)",
        "scoring_weight": 0.04,
    },

    # ── WATER ─────────────────────────────────────────────────────────────────
    "water_consumption": {
        "category": "Metrics & Targets",
        "sub_category": "Water & Waste",
        "concept": "Total water withdrawal and/or consumption",
        "metric_type": "quantitative",
        "unit": "megalitres / cubic metres",
        "framework_mappings": {
            "GRI":   {"standard": "GRI 303-3",  "ref": "GRI 303-3",            "weight": 1.0},
            "CSRD":  {"standard": "ESRS E3-1",  "ref": "ESRS E3-1",            "weight": 1.0},
            "CDP":   {"section": "W1",           "ref": "CDP Water Security",   "weight": 1.0},
            "BRSR":  {"section": "P6",           "ref": "BRSR P6",              "weight": 0.9},
            "ISSB_S2":{"section": "para 29",     "ref": "ISSB S2 (sector-specific)","weight": 0.5},
        },
        "extraction_pattern": r"water\s+(?:withdrawal|consumption|use|intake)\s*(?:was|is|:|\=|of)?\s*([\d,]+\.?\d*)\s*(m[l3]|megalit|cubic)",
        "scoring_weight": 0.04,
    },

    # ── BIODIVERSITY ──────────────────────────────────────────────────────────
    "biodiversity_impact": {
        "category": "Metrics & Targets",
        "sub_category": "Biodiversity",
        "concept": "Biodiversity impact assessment or nature-related risk disclosure",
        "metric_type": "qualitative",
        "framework_mappings": {
            "GRI":   {"standard": "GRI 304",     "ref": "GRI 304",              "weight": 0.9},
            "CSRD":  {"standard": "ESRS E4",     "ref": "ESRS E4",              "weight": 1.0},
            "TNFD":  {"section": "LEAP",          "ref": "TNFD v1.0",           "weight": 1.0},
            "CDP":   {"section": "F",             "ref": "CDP Forests",          "weight": 0.8},
            "BRSR":  {"section": "P6",            "ref": "BRSR P6",             "weight": 0.7},
        },
        "extraction_pattern": r"biodiversit|ecosystem|habitat|species|deforest|TNFD|nature[\s\-]related",
        "scoring_weight": 0.03,
    },

    # ── WORKFORCE / SOCIAL ────────────────────────────────────────────────────
    "workforce_health_safety": {
        "category": "Social",
        "sub_category": "Workforce",
        "concept": "Occupational health and safety metrics (TRIR/LTIR, fatalities)",
        "metric_type": "quantitative",
        "framework_mappings": {
            "GRI":   {"standard": "GRI 403",     "ref": "GRI 403",              "weight": 1.0},
            "CSRD":  {"standard": "ESRS S1-14",  "ref": "ESRS S1-14",           "weight": 1.0},
            "BRSR":  {"section": "P3",           "ref": "BRSR P3",              "weight": 1.0},
            "SASB":  {"section": "industry-specific","ref": "SASB",             "weight": 0.8},
        },
        "extraction_pattern": r"(?:TRIR|LTIR|lost\s+time|fatali|injury|health\s+and\s+safety|occupational\s+health)",
        "scoring_weight": 0.04,
    },
    "gender_diversity": {
        "category": "Social",
        "sub_category": "Workforce",
        "concept": "Gender diversity metrics (representation at board and management level)",
        "metric_type": "quantitative",
        "framework_mappings": {
            "GRI":   {"standard": "GRI 405-1",   "ref": "GRI 405-1",           "weight": 1.0},
            "CSRD":  {"standard": "ESRS S1-6",   "ref": "ESRS S1-6",           "weight": 1.0},
            "BRSR":  {"section": "P5",           "ref": "BRSR P5",             "weight": 1.0},
        },
        "extraction_pattern": r"gender\s+(?:diversity|parity|representation|ratio|gap)|women\s+(?:in|on|at)\s+(?:board|leadership|management)",
        "scoring_weight": 0.03,
    },
    "supply_chain_due_diligence": {
        "category": "Social",
        "sub_category": "Supply Chain",
        "concept": "Supply chain ESG due diligence and human rights assessment",
        "metric_type": "qualitative",
        "framework_mappings": {
            "GRI":   {"standard": "GRI 414",     "ref": "GRI 414",              "weight": 1.0},
            "CSRD":  {"standard": "ESRS S2",     "ref": "ESRS S2",              "weight": 1.0},
            "BRSR":  {"section": "P2 P9",        "ref": "BRSR P2/P9",           "weight": 1.0},
            "SFDR":  {"standard": "PAI 9",       "ref": "SFDR PAI Indicator 9", "weight": 0.8},
        },
        "extraction_pattern": r"supply\s+chain\s+(?:due\s+diligence|audit|assessment|esg|sustainability|human\s+rights)",
        "scoring_weight": 0.04,
    },

    # ── GOVERNANCE & ETHICS ───────────────────────────────────────────────────
    "anti_corruption": {
        "category": "Governance",
        "sub_category": "Ethics & Conduct",
        "concept": "Anti-corruption and anti-bribery policies and incidents",
        "metric_type": "qualitative",
        "framework_mappings": {
            "GRI":   {"standard": "GRI 205",     "ref": "GRI 205",              "weight": 1.0},
            "CSRD":  {"standard": "ESRS G1",     "ref": "ESRS G1",              "weight": 1.0},
            "BRSR":  {"section": "P1",           "ref": "BRSR P1",              "weight": 1.0},
        },
        "extraction_pattern": r"anti[\s\-](?:corruption|bribery)|bribery|code\s+of\s+(?:conduct|ethics)|whistleblower",
        "scoring_weight": 0.04,
    },
    "third_party_assurance": {
        "category": "Governance",
        "sub_category": "Assurance & Verification",
        "concept": "External/third-party assurance on ESG data",
        "metric_type": "qualitative",
        "framework_mappings": {
            "GRI":   {"standard": "GRI 2-5",     "ref": "GRI 2-5",              "weight": 1.0},
            "ISSB_S2":{"section": "para 21",     "ref": "ISSB S2 para 21",     "weight": 1.0},
            "CSRD":  {"standard": "ESRS 2",      "ref": "ESRS 2 assurance",    "weight": 1.0},
            "BRSR":  {"section": "BRSR Core",    "ref": "BRSR Core Assurance",  "weight": 1.0},
            "CDP":   {"section": "C1.3",         "ref": "CDP C1.3",            "weight": 0.9},
        },
        "extraction_pattern": r"(?:third[\s\-]party|external|independent)\s+(?:assurance|verification|audit|review)",
        "scoring_weight": 0.06,
    },
    "reporting_boundary": {
        "category": "Governance",
        "sub_category": "Reporting Quality",
        "concept": "Reporting boundary and consolidation approach clearly defined",
        "metric_type": "qualitative",
        "framework_mappings": {
            "GRI":        {"standard": "GRI 2-2",    "ref": "GRI 2-2",          "weight": 1.0},
            "GHG_PROTOCOL":{"standard": "Corporate","ref": "GHG Protocol",      "weight": 1.0},
            "ISSB_S2":    {"section": "para 29",    "ref": "ISSB S2",           "weight": 0.9},
            "CSRD":       {"standard": "ESRS 2",    "ref": "ESRS 2",            "weight": 0.9},
            "BRSR":       {"section": "Section A",  "ref": "BRSR Section A",    "weight": 0.9},
        },
        "extraction_pattern": r"(?:reporting\s+boundary|consolidation\s+approach|operational\s+control|financial\s+control|equity\s+share)",
        "scoring_weight": 0.05,
    },
    "materiality_assessment": {
        "category": "Governance",
        "sub_category": "Materiality",
        "concept": "Materiality assessment process disclosed (double materiality for CSRD)",
        "metric_type": "qualitative",
        "framework_mappings": {
            "GRI":     {"standard": "GRI 3",      "ref": "GRI 3 (Materiality)", "weight": 1.0},
            "ISSB_S1": {"section": "para 18",     "ref": "ISSB S1 para 18",    "weight": 1.0},
            "CSRD":    {"standard": "ESRS 2 IRO-1","ref": "ESRS 2 IRO-1",      "weight": 1.0},
            "CDP":     {"section": "C2",           "ref": "CDP C2",             "weight": 0.8},
            "BRSR":    {"section": "Section B",   "ref": "BRSR Section B",      "weight": 0.9},
        },
        "extraction_pattern": r"material(?:ity)?\s+(?:assessment|topic|risk|threshold|issue|matrix)",
        "scoring_weight": 0.06,
    },
}


# ══════════════════════════════════════════════════════════════════════════════
# CROSS-FRAMEWORK EQUIVALENCE MAP
# One disclosure point satisfies requirements across multiple frameworks.
# Format: concept → {framework: ref_string}
# ══════════════════════════════════════════════════════════════════════════════

CROSS_FRAMEWORK_MAP: dict[str, dict[str, str]] = {
    concept_id: {
        fw: info["ref"]
        for fw, info in concept["framework_mappings"].items()
    }
    for concept_id, concept in UNIFIED_ESG_MODEL.items()
}


# ══════════════════════════════════════════════════════════════════════════════
# JURISDICTION DETECTION
# Infers which frameworks are primary based on textual signals.
# ══════════════════════════════════════════════════════════════════════════════

_INDIA_SIGNALS = re.compile(
    r"\b(?:India|Indian|NSE|BSE|SEBI|BRSR|Bombay Stock|National Stock Exchange|"
    r"Rupee|₹|crore|lakh|Ministry of Corporate Affairs|MCA)\b",
    re.IGNORECASE,
)
_EU_SIGNALS = re.compile(
    r"\b(?:European Union|EU|CSRD|ESRS|Taxonomy Regulation|SFDR|"
    r"Euro|€|EUR|SEC Commission|EFRAG|EEA|Germany|France|Netherlands|Sweden|"
    r"Italy|Spain|Poland|Denmark|Belgium|Austria|Finland|Portugal|Ireland)\b",
    re.IGNORECASE,
)
_US_SIGNALS = re.compile(
    r"\b(?:United States|US|USA|SEC|FASB|SASB|American|NYSE|NASDAQ|"
    r"Dollar|\$|USD|California|New York|federal|Form 10-K)\b",
    re.IGNORECASE,
)
_FINANCE_SIGNALS = re.compile(
    r"\b(?:bank|insurance|asset manager|pension fund|investment fund|"
    r"PCAF|financed emissions|portfolio|AUM|assets under management|SFDR)\b",
    re.IGNORECASE,
)
_REAL_ESTATE_SIGNALS = re.compile(
    r"\b(?:REIT|real estate|property|building|construction|GRESB|"
    r"floor area|GFA|occupancy|tenant)\b",
    re.IGNORECASE,
)
_NATURE_SIGNALS = re.compile(
    r"\b(?:TNFD|biodiversit|ecosystem|nature|forest|deforest|land use|"
    r"species|habitat|wetland)\b",
    re.IGNORECASE,
)


def detect_jurisdiction(text: str) -> dict:
    """
    Infer primary jurisdiction(s) and sector from textual signals.
    Returns prioritised framework lists for that context.
    """
    jurisdictions: list[str] = []
    primary_frameworks: list[str] = []
    secondary_frameworks: list[str] = []

    if _INDIA_SIGNALS.search(text):
        jurisdictions.append("India")
        primary_frameworks += ["BRSR", "GRI", "ISSB_S2"]
    if _EU_SIGNALS.search(text):
        jurisdictions.append("EU")
        primary_frameworks += ["CSRD", "ESRS", "ISSB_S2", "SFDR"]
    if _US_SIGNALS.search(text):
        jurisdictions.append("USA")
        primary_frameworks += ["SEC_CLIMATE", "SASB", "TCFD", "ISSB_S2"]
    if not jurisdictions:
        jurisdictions.append("Global")
        primary_frameworks += ["GRI", "TCFD", "ISSB_S2"]

    secondary_frameworks += ["GRI", "TCFD", "GHG_PROTOCOL", "CDP", "SBTI"]

    sector = "general"
    if _FINANCE_SIGNALS.search(text):
        sector = "financial_services"
        primary_frameworks.insert(0, "PCAF")
        primary_frameworks.insert(1, "SFDR")
    if _REAL_ESTATE_SIGNALS.search(text):
        sector = "real_estate"
        primary_frameworks.insert(0, "GRESB")
    if _NATURE_SIGNALS.search(text):
        secondary_frameworks.insert(0, "TNFD")

    # Deduplicate preserving order
    seen: set[str] = set()
    primary_dedup = []
    for fw in primary_frameworks:
        if fw not in seen:
            seen.add(fw)
            primary_dedup.append(fw)
    secondary_dedup = [fw for fw in secondary_frameworks if fw not in seen]

    return {
        "jurisdictions": jurisdictions,
        "sector": sector,
        "primary_frameworks": primary_dedup,
        "secondary_frameworks": secondary_dedup,
        "all_applicable": primary_dedup + secondary_dedup,
    }


# ══════════════════════════════════════════════════════════════════════════════
# UNIFIED MODEL MAPPER
# Maps extracted data against the unified ESG model, producing a coverage matrix.
# ══════════════════════════════════════════════════════════════════════════════

def _matches_pattern(pattern_str: str, text: str) -> bool:
    try:
        return bool(re.search(pattern_str, text, re.IGNORECASE | re.DOTALL))
    except re.error:
        return False


def map_report_to_model(
    text: str,
    extracted_data: dict,
    jurisdiction_info: dict,
) -> dict:
    """
    For each concept in the unified model, determine:
    - whether it is present in the report
    - which framework requirements it satisfies
    - which frameworks remain unsatisfied
    """
    applicable_frameworks = set(jurisdiction_info.get("all_applicable", []))

    coverage_matrix: dict[str, dict] = {}

    for concept_id, concept in UNIFIED_ESG_MODEL.items():
        # Check via regex pattern first
        pattern_hit = _matches_pattern(concept["extraction_pattern"], text)

        # Also check extracted structured data for key emission concepts
        structured_hit = False
        data_key = concept_id.replace("_emissions", "").replace("net_zero_target", "net_zero_target_year")
        if concept_id == "scope_1_emissions":
            structured_hit = extracted_data.get("scope_1") is not None
        elif concept_id == "scope_2_emissions":
            structured_hit = extracted_data.get("scope_2") is not None
        elif concept_id == "scope_3_emissions":
            structured_hit = extracted_data.get("scope_3") is not None
        elif concept_id == "energy_consumption":
            structured_hit = extracted_data.get("energy_consumption") is not None
        elif concept_id == "baseline_year":
            structured_hit = extracted_data.get("baseline_year") is not None
        elif concept_id == "net_zero_target":
            structured_hit = bool(extracted_data.get("net_zero_target_year"))
        elif concept_id == "reporting_boundary":
            structured_hit = extracted_data.get("reporting_boundary_defined", False)
        elif concept_id == "third_party_assurance":
            structured_hit = extracted_data.get("third_party_assurance", False)
        elif concept_id == "transition_plan":
            structured_hit = extracted_data.get("transition_pathway_present", False)

        is_present = pattern_hit or structured_hit

        # Framework satisfaction
        frameworks_satisfied: dict[str, str] = {}
        frameworks_missing: dict[str, str] = {}

        for fw_id, fw_info in concept["framework_mappings"].items():
            ref = fw_info["ref"]
            if is_present:
                frameworks_satisfied[fw_id] = ref
            else:
                # Only flag as missing if this framework is applicable
                if fw_id in applicable_frameworks or not applicable_frameworks:
                    frameworks_missing[fw_id] = ref

        coverage_matrix[concept_id] = {
            "category": concept["category"],
            "sub_category": concept["sub_category"],
            "concept": concept["concept"],
            "is_present": is_present,
            "frameworks_satisfied": frameworks_satisfied,
            "frameworks_missing": frameworks_missing,
            "scoring_weight": concept["scoring_weight"],
            "cross_framework_refs": CROSS_FRAMEWORK_MAP.get(concept_id, {}),
        }

    return coverage_matrix


# ══════════════════════════════════════════════════════════════════════════════
# FRAMEWORK COVERAGE SUMMARY
# Aggregates per-framework coverage from the matrix.
# ══════════════════════════════════════════════════════════════════════════════

def compute_framework_coverage(
    coverage_matrix: dict,
    jurisdiction_info: dict,
) -> dict[str, dict]:
    """
    For each applicable framework, compute how many requirements are met/missing.
    Returns:
      {framework_id: {met: int, total: int, pct: int, status: str, missing_refs: [...]}}
    """
    applicable = set(jurisdiction_info.get("all_applicable", list(FRAMEWORK_REGISTRY.keys())))
    framework_totals: dict[str, dict] = {fw: {"met": 0, "total": 0, "missing_refs": []} for fw in applicable}

    for concept_id, data in coverage_matrix.items():
        for fw_id, ref in data["cross_framework_refs"].items():
            if fw_id not in applicable:
                continue
            if fw_id not in framework_totals:
                framework_totals[fw_id] = {"met": 0, "total": 0, "missing_refs": []}
            framework_totals[fw_id]["total"] += 1
            if fw_id in data["frameworks_satisfied"]:
                framework_totals[fw_id]["met"] += 1
            else:
                framework_totals[fw_id]["missing_refs"].append({
                    "concept": data["concept"],
                    "ref": ref,
                })

    result: dict[str, dict] = {}
    for fw_id, counts in framework_totals.items():
        total = counts["total"]
        met = counts["met"]
        if total == 0:
            continue
        pct = round((met / total) * 100)
        if pct >= 80:
            status = "Aligned"
        elif pct >= 50:
            status = "Partial"
        else:
            status = "Missing"

        result[fw_id] = {
            "framework": fw_id,
            "full_name": FRAMEWORK_REGISTRY.get(fw_id, {}).get("full_name", fw_id),
            "met": met,
            "total": total,
            "coverage_pct": pct,
            "status": status,
            "missing_refs": counts["missing_refs"][:10],  # cap output
        }

    return result


# ══════════════════════════════════════════════════════════════════════════════
# ESG INTEGRITY SCORE
# 0 = perfectly compliant, 100 = maximum risk (inverted like greenwashing score)
# For "Integrity Score" we flip: 100 = best, 0 = worst.
# ══════════════════════════════════════════════════════════════════════════════

def compute_integrity_score(
    coverage_matrix: dict,
    risk_flags: list,
    jurisdiction_info: dict,
) -> dict:
    """
    ESG Integrity Score (0–100, higher = better).

    Components:
      50% — Completeness (weighted disclosure coverage)
      25% — Consistency  (absence of high-severity risk flags)
      25% — Framework alignment (average coverage across primary frameworks)
    """
    # Component 1: Completeness (weighted)
    total_weight = sum(c["scoring_weight"] for c in coverage_matrix.values())
    achieved_weight = sum(
        c["scoring_weight"] for c in coverage_matrix.values() if c["is_present"]
    )
    completeness_pct = (achieved_weight / total_weight * 100) if total_weight else 0

    # Component 2: Consistency (flag penalty)
    high_flags = sum(1 for f in risk_flags if f.get("severity") == "High")
    med_flags  = sum(1 for f in risk_flags if f.get("severity") == "Medium")
    flag_penalty = min(high_flags * 20 + med_flags * 8, 100)
    consistency_score = max(0, 100 - flag_penalty)

    # Component 3: Framework alignment (primary frameworks only)
    primary_fws = jurisdiction_info.get("primary_frameworks", [])
    fw_coverage = compute_framework_coverage(coverage_matrix, jurisdiction_info)
    primary_pcts = [
        fw_coverage[fw]["coverage_pct"]
        for fw in primary_fws
        if fw in fw_coverage
    ]
    alignment_score = (sum(primary_pcts) / len(primary_pcts)) if primary_pcts else 50

    # Composite
    integrity_score = int(
        completeness_pct * 0.50 +
        consistency_score * 0.25 +
        alignment_score * 0.25
    )
    integrity_score = max(0, min(100, integrity_score))

    # Greenwashing risk score (inverse — 0 = safest)
    greenwashing_risk = 100 - integrity_score

    if integrity_score >= 70:
        risk_level = "Low"
    elif integrity_score >= 40:
        risk_level = "Medium"
    else:
        risk_level = "High"

    return {
        "integrity_score": integrity_score,
        "greenwashing_risk_score": greenwashing_risk,
        "risk_level": risk_level,
        "components": {
            "completeness": {
                "score": round(completeness_pct),
                "weight": "50%",
                "description": "Weighted ESG disclosure coverage",
            },
            "consistency": {
                "score": consistency_score,
                "weight": "25%",
                "description": f"{high_flags} High + {med_flags} Medium risk flags detected",
            },
            "framework_alignment": {
                "score": round(alignment_score),
                "weight": "25%",
                "description": f"Average coverage across {len(primary_pcts)} primary frameworks",
            },
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
# CONTEXTUAL INTELLIGENCE SUMMARY
# Human-readable intelligence for investor / regulator / auditor persona
# ══════════════════════════════════════════════════════════════════════════════

def build_intelligence_summary(
    coverage_matrix: dict,
    fw_coverage: dict,
    jurisdiction_info: dict,
    integrity_result: dict,
) -> dict:
    """Build a structured intelligence summary for the front-end and API consumers."""

    # Which concepts are missing that are high-weight?
    missing_high_impact = sorted(
        [
            {"concept_id": cid, "concept": c["concept"], "weight": c["scoring_weight"],
             "category": c["category"], "frameworks_missing": list(c["frameworks_missing"].keys())}
            for cid, c in coverage_matrix.items()
            if not c["is_present"] and c["scoring_weight"] >= 0.05
        ],
        key=lambda x: -x["weight"],
    )

    # Framework status for primary frameworks
    primary_fws = jurisdiction_info.get("primary_frameworks", [])
    framework_statuses = {fw: fw_coverage.get(fw, {}).get("status", "Unknown") for fw in primary_fws}

    # Cross-framework leverage: present concepts that satisfy the most frameworks
    cross_leverage = sorted(
        [
            {"concept_id": cid, "concept": c["concept"],
             "satisfies_n_frameworks": len(c["frameworks_satisfied"])}
            for cid, c in coverage_matrix.items()
            if c["is_present"] and len(c["frameworks_satisfied"]) >= 3
        ],
        key=lambda x: -x["satisfies_n_frameworks"],
    )[:5]

    return {
        "integrity_score": integrity_result["integrity_score"],
        "greenwashing_risk_score": integrity_result["greenwashing_risk_score"],
        "risk_level": integrity_result["risk_level"],
        "score_components": integrity_result["components"],
        "jurisdiction": jurisdiction_info,
        "framework_coverage": framework_statuses,
        "critical_gaps": missing_high_impact[:8],
        "cross_framework_leverage": cross_leverage,
        "total_concepts_assessed": len(coverage_matrix),
        "concepts_present": sum(1 for c in coverage_matrix.values() if c["is_present"]),
        "concepts_missing": sum(1 for c in coverage_matrix.values() if not c["is_present"]),
    }


# ══════════════════════════════════════════════════════════════════════════════
# MAIN PIPELINE
# ══════════════════════════════════════════════════════════════════════════════

def run_intelligence_analysis(
    text: str,
    extracted_data: dict,
    risk_flags: list,
    company_name: str = "The Company",
) -> dict:
    """
    Full ESG Framework Intelligence pipeline.

    Args:
        text:           Raw extracted text from the ESG report
        extracted_data: Output of greenwashing_scanner.extract_data()
        risk_flags:     Output of greenwashing_scanner.validate_claims()
        company_name:   Company identifier

    Returns:
        Structured intelligence dict compatible with /api/analyze-esg response
    """
    # 1. Detect jurisdiction + sector
    jurisdiction_info = detect_jurisdiction(text)

    # 2. Map report against unified model
    coverage_matrix = map_report_to_model(text, extracted_data, jurisdiction_info)

    # 3. Per-framework coverage
    fw_coverage = compute_framework_coverage(coverage_matrix, jurisdiction_info)

    # 4. Integrity score
    integrity_result = compute_integrity_score(coverage_matrix, risk_flags, jurisdiction_info)

    # 5. Intelligence summary
    summary = build_intelligence_summary(coverage_matrix, fw_coverage, jurisdiction_info, integrity_result)

    # 6. Structured output
    framework_coverage_output = {
        fw_id: {
            "full_name": info["full_name"],
            "status": info["status"],
            "coverage_pct": info["coverage_pct"],
            "met": info["met"],
            "total": info["total"],
            "missing_refs": info["missing_refs"],
        }
        for fw_id, info in fw_coverage.items()
    }

    gaps = [
        {
            "concept": c["concept"],
            "category": c["category"],
            "frameworks_affected": list(c["frameworks_missing"].keys()),
            "cross_framework_refs": {
                fw: ref for fw, ref in c["cross_framework_refs"].items()
                if fw in c["frameworks_missing"]
            },
        }
        for cid, c in coverage_matrix.items()
        if not c["is_present"]
    ]

    return {
        "company_name": company_name,
        "integrity_score": integrity_result["integrity_score"],
        "greenwashing_risk_score": integrity_result["greenwashing_risk_score"],
        "risk_level": integrity_result["risk_level"],
        "score_components": integrity_result["components"],
        "jurisdiction": jurisdiction_info,
        "framework_coverage": framework_coverage_output,
        "coverage_summary": summary,
        "gaps": gaps,
        "cross_framework_map_excerpt": {
            k: v for k, v in CROSS_FRAMEWORK_MAP.items()
            if k in ["scope_1_emissions", "scope_3_emissions", "net_zero_target", "transition_plan"]
        },
        "framework_registry_count": len(FRAMEWORK_REGISTRY),
        "concepts_assessed": len(coverage_matrix),
    }
