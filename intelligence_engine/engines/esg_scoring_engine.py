"""
ESG Scoring Engine
==================
Multi-framework ESG scoring with:
  - Environmental score (GHG, water, biodiversity, pollution)
  - Social score (labor, supply chain, community, health & safety)
  - Governance score (board, audit, anti-corruption, transparency)
  - Disclosure quality score (completeness, auditability, frequency)
  - SDG alignment score (17 SDG mapping)
  - Sector-adjusted benchmarking
  - Peer comparison
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any


@dataclass
class ESGScoringInput:
    # Company profile
    company_name: str
    sector: str
    country: str
    revenue_usd_m: float

    # Environmental
    scope1_emissions_t: float = 0.0
    scope2_emissions_t: float = 0.0
    scope3_emissions_t: float = 0.0
    has_net_zero_target: bool = False
    net_zero_year: Optional[int] = None
    has_sbti: bool = False
    renewable_energy_pct: float = 0.0
    water_intensity_m3_per_m_revenue: float = 0.0
    waste_recycling_rate_pct: float = 0.0
    biodiversity_policy: bool = False

    # Social
    employee_safety_incidents: int = 0
    living_wage_policy: bool = False
    diversity_board_pct: float = 0.0
    supply_chain_audits: bool = False
    community_investment_pct_revenue: float = 0.0

    # Governance
    board_independence_pct: float = 0.0
    esg_committee_exists: bool = False
    third_party_audit: bool = False
    anti_corruption_policy: bool = True
    executive_esg_link: bool = False
    whistleblower_policy: bool = True

    # Disclosure
    framework_disclosures: List[str] = field(default_factory=list)  # ["tcfd","gri","cdp",...]
    disclosure_frequency: str = "annual"  # "annual" | "semi-annual" | "quarterly"
    data_assurance_level: str = "none"     # "none" | "limited" | "reasonable"


@dataclass
class ESGScore:
    overall: float
    environmental: float
    social: float
    governance: float
    disclosure_quality: float
    sdg_alignment: float
    peer_percentile: float
    sector_benchmark: float
    esg_rating: str          # AAA / AA / A / BBB / BB / B / CCC (MSCI-style)
    key_strengths: List[str]
    key_gaps: List[str]
    sdg_mapping: Dict[str, float]
    framework_scores: Dict[str, float]


SECTOR_BENCHMARKS = {
    "oil-gas": {"e": 28, "s": 45, "g": 52},
    "utilities": {"e": 54, "s": 55, "g": 62},
    "mining": {"e": 36, "s": 44, "g": 58},
    "manufacturing": {"e": 48, "s": 51, "g": 60},
    "technology": {"e": 72, "s": 65, "g": 70},
    "financials": {"e": 56, "s": 58, "g": 68},
    "real-estate": {"e": 50, "s": 52, "g": 62},
    "agriculture": {"e": 42, "s": 54, "g": 48},
    "transportation": {"e": 44, "s": 56, "g": 58},
    "default": {"e": 50, "s": 52, "g": 60},
}

SDG_SECTOR_MAP = {
    "oil-gas":        {13: -0.5, 7: -0.3, 14: -0.2, 15: -0.2},
    "utilities":      {7: 0.6, 13: 0.3, 6: 0.2},
    "technology":     {9: 0.5, 4: 0.3, 8: 0.2, 17: 0.2},
    "agriculture":    {2: 0.5, 15: -0.3, 6: -0.2, 12: 0.2},
    "financials":     {1: 0.3, 8: 0.3, 10: 0.2, 17: 0.3},
    "transportation": {11: -0.2, 13: -0.3, 9: 0.2},
    "default":        {13: 0.0, 8: 0.1, 9: 0.1},
}


class ESGScoringEngine:

    def _score_environmental(self, inp: ESGScoringInput) -> tuple[float, list, list]:
        score = 0.0
        strengths, gaps = [], []

        # GHG emissions intensity
        total_scope12 = inp.scope1_emissions_t + inp.scope2_emissions_t
        if inp.revenue_usd_m > 0:
            intensity = total_scope12 / inp.revenue_usd_m
            if intensity < 100:
                score += 25; strengths.append("Low GHG intensity")
            elif intensity < 500:
                score += 15
            elif intensity < 1500:
                score += 5
            else:
                gaps.append("High GHG emissions intensity")

        # Net zero target
        if inp.has_net_zero_target:
            score += 15
            if inp.net_zero_year and inp.net_zero_year <= 2040:
                score += 5; strengths.append(f"Ambitious net-zero target ({inp.net_zero_year})")
        else:
            gaps.append("No net-zero target set")

        # SBTi
        if inp.has_sbti:
            score += 12; strengths.append("SBTi validated targets")
        else:
            gaps.append("No SBTi commitment")

        # Renewable energy
        if inp.renewable_energy_pct >= 80:
            score += 15; strengths.append("Near-100% renewable energy")
        elif inp.renewable_energy_pct >= 50:
            score += 10
        elif inp.renewable_energy_pct >= 25:
            score += 5
        else:
            gaps.append(f"Low renewable energy share ({inp.renewable_energy_pct:.0f}%)")

        # Water & waste
        if inp.waste_recycling_rate_pct >= 75:
            score += 8; strengths.append("Strong circular economy practices")
        elif inp.waste_recycling_rate_pct >= 50:
            score += 5

        # Biodiversity
        if inp.biodiversity_policy:
            score += 5

        # Scope 3 — missing data penalised
        if inp.scope3_emissions_t == 0:
            gaps.append("Scope 3 data not disclosed")
        else:
            score += 8

        return min(100, score), strengths, gaps

    def _score_social(self, inp: ESGScoringInput) -> tuple[float, list, list]:
        score = 0.0
        strengths, gaps = [], []

        if inp.living_wage_policy:
            score += 20; strengths.append("Living wage policy in place")
        else:
            gaps.append("No living wage policy")

        if inp.diversity_board_pct >= 40:
            score += 20; strengths.append("Strong board diversity")
        elif inp.diversity_board_pct >= 30:
            score += 12
        else:
            gaps.append(f"Low board diversity ({inp.diversity_board_pct:.0f}%)")

        if inp.supply_chain_audits:
            score += 18; strengths.append("Supply chain human rights audits")
        else:
            gaps.append("No supply chain due diligence audits")

        if inp.employee_safety_incidents == 0:
            score += 20; strengths.append("Zero safety incidents")
        elif inp.employee_safety_incidents < 3:
            score += 12
        else:
            gaps.append(f"Elevated safety incidents ({inp.employee_safety_incidents})")

        if inp.community_investment_pct_revenue >= 0.5:
            score += 12
        elif inp.community_investment_pct_revenue >= 0.1:
            score += 6

        return min(100, score), strengths, gaps

    def _score_governance(self, inp: ESGScoringInput) -> tuple[float, list, list]:
        score = 0.0
        strengths, gaps = [], []

        if inp.board_independence_pct >= 60:
            score += 22; strengths.append("Strong board independence")
        elif inp.board_independence_pct >= 40:
            score += 14
        else:
            gaps.append(f"Low board independence ({inp.board_independence_pct:.0f}%)")

        if inp.esg_committee_exists:
            score += 18; strengths.append("Board ESG committee established")
        else:
            gaps.append("No dedicated ESG governance committee")

        if inp.third_party_audit:
            score += 18; strengths.append("Third-party ESG audit")
        else:
            gaps.append("No external ESG assurance")

        if inp.anti_corruption_policy:
            score += 14

        if inp.executive_esg_link:
            score += 16; strengths.append("Executive pay linked to ESG")
        else:
            gaps.append("No ESG-linked executive remuneration")

        if inp.whistleblower_policy:
            score += 10

        return min(100, score), strengths, gaps

    def _score_disclosure(self, inp: ESGScoringInput) -> float:
        score = 0.0
        fw_count = len(inp.framework_disclosures)
        score += min(40, fw_count * 8)

        if inp.disclosure_frequency == "quarterly":
            score += 20
        elif inp.disclosure_frequency == "semi-annual":
            score += 12
        else:
            score += 6

        if inp.data_assurance_level == "reasonable":
            score += 30
        elif inp.data_assurance_level == "limited":
            score += 18

        return min(100, score)

    def _compute_sdg_alignment(self, inp: ESGScoringInput) -> tuple[float, Dict[str, float]]:
        sector_key = inp.sector.lower().replace(" ", "-")
        base_map = SDG_SECTOR_MAP.get(sector_key, SDG_SECTOR_MAP["default"])
        sdg_scores: Dict[str, float] = {}

        # Base alignment from sector
        all_sdgs = list(range(1, 18))
        for sdg in all_sdgs:
            base = base_map.get(sdg, 0.0)
            adj = 0.0
            if sdg == 13 and inp.has_net_zero_target:
                adj += 0.4
            if sdg == 7 and inp.renewable_energy_pct >= 50:
                adj += 0.3
            if sdg == 8 and inp.living_wage_policy:
                adj += 0.2
            if sdg == 12 and inp.waste_recycling_rate_pct >= 50:
                adj += 0.15
            sdg_scores[f"SDG {sdg}"] = round(max(-1, min(1, base + adj)), 2)

        total = sum(max(0, v) for v in sdg_scores.values())
        normalized = min(100, total / 17 * 100)
        return normalized, sdg_scores

    def compute(self, inp: ESGScoringInput) -> ESGScore:
        env_score, env_strengths, env_gaps = self._score_environmental(inp)
        soc_score, soc_strengths, soc_gaps = self._score_social(inp)
        gov_score, gov_strengths, gov_gaps = self._score_governance(inp)
        dis_score = self._score_disclosure(inp)
        sdg_score, sdg_map = self._compute_sdg_alignment(inp)

        # Weighted overall
        overall = (
            env_score * 0.35 +
            soc_score * 0.25 +
            gov_score * 0.25 +
            dis_score * 0.15
        )

        sector_key = inp.sector.lower().replace(" ", "-")
        sector_bench = SECTOR_BENCHMARKS.get(sector_key, SECTOR_BENCHMARKS["default"])
        bench_avg = (sector_bench["e"] + sector_bench["s"] + sector_bench["g"]) / 3

        # Peer percentile (simplified)
        peer_pct = min(99, max(1, (overall / bench_avg) * 50))

        esg_rating = (
            "AAA" if overall >= 85 else "AA" if overall >= 75 else
            "A"   if overall >= 65 else "BBB" if overall >= 55 else
            "BB"  if overall >= 45 else "B" if overall >= 35 else "CCC"
        )

        framework_scores = {}
        fw_map = {"tcfd": min(100, dis_score * 0.9 + env_score * 0.1),
                  "gri": min(100, env_score * 0.5 + soc_score * 0.3 + gov_score * 0.2),
                  "cdp": min(100, env_score * 0.7 + dis_score * 0.3),
                  "issb": min(100, env_score * 0.4 + dis_score * 0.4 + gov_score * 0.2),
                  "sasb": min(100, env_score * 0.35 + soc_score * 0.35 + gov_score * 0.3)}
        for fw in inp.framework_disclosures:
            if fw.lower() in fw_map:
                framework_scores[fw.upper()] = round(fw_map[fw.lower()], 1)

        return ESGScore(
            overall=round(overall, 2),
            environmental=round(env_score, 2),
            social=round(soc_score, 2),
            governance=round(gov_score, 2),
            disclosure_quality=round(dis_score, 2),
            sdg_alignment=round(sdg_score, 2),
            peer_percentile=round(peer_pct, 1),
            sector_benchmark=round(bench_avg, 1),
            esg_rating=esg_rating,
            key_strengths=(env_strengths + soc_strengths + gov_strengths)[:5],
            key_gaps=(env_gaps + soc_gaps + gov_gaps)[:5],
            sdg_mapping=sdg_map,
            framework_scores=framework_scores,
        )


esg_scoring_engine = ESGScoringEngine()
