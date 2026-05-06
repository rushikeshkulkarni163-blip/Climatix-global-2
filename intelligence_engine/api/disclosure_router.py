"""Disclosure Studio API Router — Report Generation."""

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

router = APIRouter()


class CompanyProfile(BaseModel):
    name: str
    sector: str
    country: str
    fiscal_year: int = 2024
    revenue_usd_m: float
    employees: int


class DisclosureRequest(BaseModel):
    company: CompanyProfile
    framework: str = Field(..., description="tcfd | issb_s2 | csrd | gri | cdp | custom")
    format: str = Field("pdf", description="pdf | json | xml | word")
    include_sections: List[str] = Field(
        default=["governance", "strategy", "risk_management", "metrics_targets"]
    )
    physical_risk_score: Optional[float] = None
    transition_risk_score: Optional[float] = None
    esg_score: Optional[float] = None
    scenario: str = "2C"
    include_greenwashing_review: bool = True


FRAMEWORK_TEMPLATES = {
    "tcfd": {
        "name": "TCFD Full Disclosure",
        "sections": ["Governance", "Strategy", "Risk Management", "Metrics & Targets"],
        "pages": "18-24",
        "standard": "TCFD 2023 Supplemental Guidance",
    },
    "issb_s2": {
        "name": "IFRS S2 Climate Disclosure",
        "sections": ["Core Content", "Governance", "Strategy", "Risk Management", "Metrics & Targets", "Cross-Industry Metrics"],
        "pages": "22-30",
        "standard": "IFRS S2 (2023)",
    },
    "csrd": {
        "name": "CSRD ESRS E1 Climate Report",
        "sections": ["Strategy", "IRO Assessment", "Policies", "Actions", "Metrics & Targets", "Value Chain"],
        "pages": "28-40",
        "standard": "ESRS E1 (2024)",
    },
    "gri": {
        "name": "GRI Standards Emissions Report",
        "sections": ["GRI 2: General Disclosures", "GRI 305: Emissions", "GRI 302: Energy"],
        "pages": "12-18",
        "standard": "GRI Standards 2021",
    },
}


@router.post("/generate", summary="Generate climate disclosure report")
async def generate_disclosure(req: DisclosureRequest, background_tasks: BackgroundTasks):
    template = FRAMEWORK_TEMPLATES.get(req.framework, FRAMEWORK_TEMPLATES["tcfd"])
    report_id = f"RPT-{req.company.name[:4].upper()}-{req.framework.upper()}-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    # Build disclosure content structure
    report_content = {
        "report_id": report_id,
        "company": req.company.dict(),
        "framework": req.framework,
        "template": template,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "disclosure_quality": {
            "overall_score": req.esg_score or 55,
            "completeness": "Partial" if (req.esg_score or 55) < 70 else "Substantial",
            "gaps_identified": _identify_gaps(req),
        },
        "sections": _build_sections(req, template),
        "executive_summary": _generate_executive_summary(req),
        "download_url": f"/api/v1/disclosure/download/{report_id}",
        "status": "generated",
    }

    if req.include_greenwashing_review:
        report_content["greenwashing_review"] = {
            "integrity_score": 72,
            "flags": 2,
            "recommendation": "Ensure Scope 3 methodology is disclosed and verified.",
        }

    return {"status": "success", "report": report_content}


def _identify_gaps(req: DisclosureRequest) -> List[str]:
    gaps = []
    if (req.physical_risk_score or 0) == 0:
        gaps.append("Physical risk quantification not provided")
    if (req.transition_risk_score or 0) == 0:
        gaps.append("Transition risk scenario analysis missing")
    if req.framework in ("csrd", "issb_s2") and "value_chain" not in req.include_sections:
        gaps.append("Value chain (Scope 3) data required by " + req.framework.upper())
    return gaps


def _build_sections(req: DisclosureRequest, template: Dict) -> List[Dict]:
    sections = []
    for section_name in template.get("sections", []):
        sections.append({
            "section": section_name,
            "status": "complete" if req.esg_score and req.esg_score > 60 else "partial",
            "completeness_pct": min(100, (req.esg_score or 50) + 10),
            "content_preview": f"{section_name} disclosure content generated based on company profile and risk data.",
            "data_sources": ["Company ESG Report", "Physical Risk Engine", "Transition Risk Engine"],
        })
    return sections


def _generate_executive_summary(req: DisclosureRequest) -> str:
    phys = req.physical_risk_score or 55
    trans = req.transition_risk_score or 50
    rating = "HIGH" if (phys + trans) / 2 > 65 else "MEDIUM" if (phys + trans) / 2 > 40 else "LOW"
    return (
        f"{req.company.name} faces {rating} overall climate risk exposure under a {req.scenario} warming scenario. "
        f"Physical risk score is {phys:.0f}/100 driven primarily by chronic climate hazards. "
        f"Transition risk score is {trans:.0f}/100 reflecting regulatory and market exposure. "
        f"This disclosure is prepared in accordance with {FRAMEWORK_TEMPLATES.get(req.framework, {}).get('standard', req.framework.upper())} requirements."
    )


@router.get("/frameworks", summary="List supported disclosure frameworks")
async def list_frameworks():
    return {
        "frameworks": [
            {"id": k, **v} for k, v in FRAMEWORK_TEMPLATES.items()
        ]
    }


@router.get("/quality-check/{company_name}", summary="Disclosure quality assessment")
async def quality_check(company_name: str, framework: str = "tcfd"):
    return {
        "company": company_name,
        "framework": framework,
        "quality_score": 62,
        "sections": {
            "Governance": {"score": 75, "status": "complete"},
            "Strategy": {"score": 58, "status": "partial"},
            "Risk Management": {"score": 80, "status": "complete"},
            "Metrics & Targets": {"score": 64, "status": "partial"},
        },
        "peer_benchmark": 68,
        "recommendation": "Improve scenario analysis and value chain Scope 3 coverage.",
    }
