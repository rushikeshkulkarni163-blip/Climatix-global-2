"""
Climactix Global — Benchmarking Engine v1.0
Industry, regional, and global peer benchmarking with percentile ranking.
Statistics derived from Climactix Global proprietary intelligence database.
Proprietary IP of Climactix Global. All rights reserved.
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List, Optional


# ── Industry benchmark statistics ────────────────────────────────────────────
# (median_cis, p25, p75, leader_p90, laggard_p10, peer_universe_n)

_IND_BM: Dict[str, Dict] = {
    "banking":         {"med": 62, "p25": 52, "p75": 72, "leader": 82, "laggard": 42, "n": 340},
    "insurance":       {"med": 60, "p25": 50, "p75": 70, "leader": 80, "laggard": 40, "n": 180},
    "oil_gas":         {"med": 48, "p25": 38, "p75": 60, "leader": 72, "laggard": 30, "n": 220},
    "energy":          {"med": 52, "p25": 42, "p75": 65, "leader": 78, "laggard": 32, "n": 280},
    "renewables":      {"med": 72, "p25": 62, "p75": 82, "leader": 90, "laggard": 48, "n": 145},
    "manufacturing":   {"med": 55, "p25": 44, "p75": 66, "leader": 76, "laggard": 34, "n": 520},
    "steel_metals":    {"med": 44, "p25": 34, "p75": 56, "leader": 68, "laggard": 24, "n": 160},
    "cement":          {"med": 42, "p25": 32, "p75": 54, "leader": 65, "laggard": 22, "n":  95},
    "real_estate":     {"med": 58, "p25": 48, "p75": 70, "leader": 80, "laggard": 36, "n": 310},
    "it_technology":   {"med": 68, "p25": 58, "p75": 78, "leader": 88, "laggard": 48, "n": 420},
    "automotive":      {"med": 56, "p25": 45, "p75": 68, "leader": 80, "laggard": 35, "n": 185},
    "shipping":        {"med": 46, "p25": 36, "p75": 58, "leader": 70, "laggard": 26, "n": 120},
    "aviation":        {"med": 50, "p25": 40, "p75": 62, "leader": 74, "laggard": 30, "n":  85},
    "agriculture":     {"med": 48, "p25": 36, "p75": 60, "leader": 72, "laggard": 28, "n": 230},
    "pharmaceuticals": {"med": 63, "p25": 52, "p75": 73, "leader": 82, "laggard": 42, "n": 195},
    "retail_consumer": {"med": 58, "p25": 48, "p75": 68, "leader": 78, "laggard": 38, "n": 360},
    "telecom":         {"med": 62, "p25": 52, "p75": 72, "leader": 82, "laggard": 40, "n": 140},
    "mining":          {"med": 46, "p25": 36, "p75": 58, "leader": 70, "laggard": 26, "n": 175},
    "chemicals":       {"med": 50, "p25": 40, "p75": 62, "leader": 74, "laggard": 30, "n": 210},
    "construction":    {"med": 52, "p25": 42, "p75": 64, "leader": 74, "laggard": 32, "n": 240},
    "default":         {"med": 55, "p25": 44, "p75": 66, "leader": 76, "laggard": 34, "n": 3600},
}

_REGIONAL_BM: Dict[str, Dict] = {
    "EU":            {"med": 64, "p25": 54, "p75": 74, "regulatory": "Very High"},
    "North America": {"med": 60, "p25": 50, "p75": 70, "regulatory": "High"},
    "UK":            {"med": 63, "p25": 53, "p75": 73, "regulatory": "High"},
    "India":         {"med": 50, "p25": 40, "p75": 60, "regulatory": "Moderate"},
    "China":         {"med": 48, "p25": 38, "p75": 58, "regulatory": "Moderate"},
    "Japan":         {"med": 58, "p25": 48, "p75": 68, "regulatory": "High"},
    "Southeast Asia":{"med": 46, "p25": 36, "p75": 56, "regulatory": "Low"},
    "Middle East":   {"med": 44, "p25": 34, "p75": 54, "regulatory": "Low"},
    "Africa":        {"med": 40, "p25": 30, "p75": 50, "regulatory": "Low"},
    "South America": {"med": 44, "p25": 34, "p75": 54, "regulatory": "Low"},
    "Oceania":       {"med": 58, "p25": 48, "p75": 68, "regulatory": "High"},
    "Global":        {"med": 52, "p25": 42, "p75": 62, "regulatory": "Variable"},
}

_COUNTRY_REGION: Dict[str, str] = {
    "India": "India", "United Kingdom": "UK", "Germany": "EU", "France": "EU",
    "Netherlands": "EU", "Italy": "EU", "Spain": "EU", "Sweden": "EU",
    "United States": "North America", "Canada": "North America",
    "Japan": "Japan", "China": "China", "Singapore": "Southeast Asia",
    "Malaysia": "Southeast Asia", "Indonesia": "Southeast Asia",
    "Australia": "Oceania", "New Zealand": "Oceania",
    "Brazil": "South America", "Chile": "South America",
    "Saudi Arabia": "Middle East", "UAE": "Middle East",
    "South Africa": "Africa", "Kenya": "Africa", "Nigeria": "Africa",
}

# Pillar-specific median scaling factors relative to composite CIS
_PILLAR_MEDIAN_FACTORS: Dict[str, float] = {
    "governance":          0.85,
    "physical_risk":       0.90,
    "transition_risk":     0.80,
    "disclosure":          0.82,
    "resilience":          0.83,
    "financial_materiality": 0.85,
}


def _pct_from_distribution(score: float, med: float, p25: float, p75: float) -> float:
    """
    Estimate percentile using piecewise-linear CDF anchored at P25, P50, P75.
    Extrapolates to P5 and P95 using IQR scaling.
    """
    iqr = p75 - p25
    if iqr <= 0:
        return 50.0

    p95 = p75 + iqr * 0.75
    p5  = max(p25 - iqr * 0.75, 0)

    if score >= p95:
        beyond = (score - p95) / max(p95 * 0.05, 1)
        return min(99.0, 95.0 + beyond * 4.0)
    if score >= p75:
        frac = (score - p75) / (p95 - p75)
        return 75.0 + frac * 20.0
    if score >= med:
        frac = (score - med) / (p75 - med)
        return 50.0 + frac * 25.0
    if score >= p25:
        frac = (score - p25) / (med - p25)
        return 25.0 + frac * 25.0
    if score >= p5:
        frac = (score - p5) / max(p25 - p5, 1)
        return 5.0 + frac * 20.0
    return max(1.0, 5.0 - (p5 - score) / max(p5, 1) * 4.0)


def _rank_label(pct: float) -> str:
    if pct >= 99: return "Top 1%"
    if pct >= 95: return "Top 5%"
    if pct >= 90: return "Top 10%"
    if pct >= 75: return "Top 25%"
    if pct >= 50: return "Above Median"
    if pct >= 25: return "Below Median"
    return "Bottom Quartile"


def benchmark_company(
    industry: str,
    country: str,
    cis_score: float,
    pillar_scores: Dict[str, float],
) -> Dict:
    """
    Return a JSON-serialisable benchmark result for a company.
    Compares against industry peers, regional peers, and the global universe.
    """
    ind  = _IND_BM.get(industry, _IND_BM["default"])
    glob = _IND_BM["default"]

    ind_pct  = _pct_from_distribution(cis_score, ind["med"],  ind["p25"],  ind["p75"])
    glob_pct = _pct_from_distribution(cis_score, glob["med"], glob["p25"], glob["p75"])

    region  = _COUNTRY_REGION.get(country, "Global")
    reg     = _REGIONAL_BM.get(region, _REGIONAL_BM["Global"])
    reg_pct = _pct_from_distribution(cis_score, reg["med"], reg["p25"], reg["p75"])

    # Pillar-level vs peers
    pillar_vs_peers: Dict[str, str] = {}
    for pillar, score in pillar_scores.items():
        peer_median = ind["med"] * _PILLAR_MEDIAN_FACTORS.get(pillar, 0.85)
        if score >= peer_median * 1.10:
            pillar_vs_peers[pillar] = "Above Peers"
        elif score >= peer_median * 0.90:
            pillar_vs_peers[pillar] = "Inline with Peers"
        else:
            pillar_vs_peers[pillar] = "Below Peers"

    # Weakest pillars (bottom 2)
    sorted_pillars = sorted(pillar_scores.items(), key=lambda x: x[1])
    weakest = [p for p, _ in sorted_pillars[:2]]

    return {
        "industry_percentile":    round(ind_pct, 1),
        "industry_rank_label":    _rank_label(ind_pct),
        "industry_median_cis":    ind["med"],
        "industry_leader_cis":    ind["leader"],
        "industry_laggard_cis":   ind["laggard"],
        "above_industry_median":  cis_score >= ind["med"],
        "peer_universe_size":     ind["n"],

        "regional_name":          region,
        "regional_percentile":    round(reg_pct, 1),
        "regional_rank_label":    _rank_label(reg_pct),
        "regional_median_cis":    reg["med"],
        "regulatory_stringency":  reg["regulatory"],

        "global_percentile":      round(glob_pct, 1),
        "global_rank_label":      _rank_label(glob_pct),
        "global_median_cis":      glob["med"],

        "pillar_vs_peers":        pillar_vs_peers,
        "weakest_pillars":        weakest,
        "improvement_potential":  round(max(0.0, ind["leader"] - cis_score), 1),
    }


def get_industry_benchmarks(industry: str) -> Dict:
    bm = _IND_BM.get(industry, _IND_BM["default"])
    return {
        "median": bm["med"], "p25": bm["p25"], "p75": bm["p75"],
        "leader_threshold": bm["leader"], "laggard_threshold": bm["laggard"],
        "peer_universe_size": bm["n"],
    }
