"""
Document classification, section mapping and sector detection.

Classification is a transparent weighted-keyword score so the basis can be
shown to the analyst ("classified as BRSR: 'Business Responsibility and
Sustainability Report' ×3, 'SEBI' ×2"). The analyst's declared type always
wins over the detected one; detection is advisory.
"""

from __future__ import annotations

import re
from collections import Counter
from datetime import date

from .domain import ParsedDocument

DOCUMENT_TYPES: dict[str, list[tuple[str, float]]] = {
    "BRSR":                   [(r"business responsibility and sustainability report", 5), (r"\bbrsr\b", 3), (r"\bsebi\b", 1), (r"principle \d", 1)],
    "BRSR_CORE":              [(r"brsr core", 6)],
    "CDP_DISCLOSURE":         [(r"\bcdp\b climate change (?:questionnaire|response)", 6), (r"\bC\d\.\d[a-z]?\b", 0.5)],
    "TCFD_REPORT":            [(r"task force on climate-related financial disclosures", 4), (r"\btcfd report\b", 5)],
    "ISSB_DISCLOSURE":        [(r"\bifrs s2\b", 3), (r"\bifrs s1\b", 2), (r"\bissb\b", 2)],
    "NET_ZERO_PLAN":          [(r"net[- ]zero (?:roadmap|strategy|plan|transition plan)", 5), (r"transition plan", 2)],
    "CLIMATE_REPORT":         [(r"climate (?:report|risk report|action report)", 4)],
    "SUSTAINABILITY_REPORT":  [(r"sustainability report", 4), (r"\besg report\b", 4), (r"\bgri content index\b", 3)],
    "INTEGRATED_REPORT":      [(r"integrated report", 5), (r"\b<ir>\b|six capitals", 2)],
    "ANNUAL_REPORT":          [(r"annual report", 4), (r"consolidated (?:balance sheet|financial statements)", 3), (r"independent auditor'?s report", 2), (r"directors'? report", 2)],
    "GHG_INVENTORY":          [(r"(?:ghg|greenhouse gas) (?:inventory|emissions report)", 5), (r"carbon footprint report", 5)],
    "ASSURANCE_STATEMENT":    [(r"(?:independent )?(?:limited|reasonable) assurance (?:report|statement)", 5), (r"isae 3000|isae 3410", 4)],
    "POLICY":                 [(r"\bpolicy\b", 1), (r"this policy applies", 4), (r"policy statement", 3)],
    "INVESTOR_PRESENTATION":  [(r"investor (?:presentation|day)", 5), (r"forward-looking statements", 1)],
    "WATER_REPORT":           [(r"water (?:report|stewardship report)", 5)],
    "HUMAN_RIGHTS_REPORT":    [(r"human rights (?:report|statement)", 5), (r"modern slavery statement", 5)],
    "REGULATORY_FILING":      [(r"form 10-k|form 20-f|\b10-k\b", 5), (r"securities and exchange commission", 2)],
}

SECTORS: dict[str, list[str]] = {
    "shipping":      [r"\bvessels?\b", r"\bfleet\b", r"\bcii\b", r"\beexi\b", r"imo dcs", r"fueleu", r"\bshipping\b", r"deadweight"],
    "banking":       [r"financed emissions", r"\bpcaf\b", r"loan book", r"\bnzba\b", r"lending portfolio", r"\bbank\b"],
    "real_estate":   [r"\bgresb\b", r"floor area", r"green building", r"\bleed\b", r"\bportfolio of (?:buildings|properties)", r"\btenants?\b"],
    "agriculture":   [r"\bfertili[sz]er", r"\blivestock\b", r"\bhectares?\b", r"land use", r"\bcrops?\b", r"enteric"],
    "oil_gas":       [r"\bupstream\b", r"\bboe\b", r"\bflaring\b", r"\brefiner(?:y|ies)\b", r"\bhydrocarbons?\b"],
    "utilities":     [r"generation capacity", r"\bmw\b capacity|installed capacity", r"\bgrid\b", r"coal[- ]fired", r"power plants?"],
    "manufacturing": [r"\bmanufacturing\b", r"\bplants?\b", r"production volume", r"per tonne of (?:product|output)", r"industrial heat", r"process emissions"],
}


def _score(text: str, patterns: list[tuple[str, float]]) -> tuple[float, list[str]]:
    score, basis = 0.0, []
    for pat, w in patterns:
        n = len(re.findall(pat, text, re.I))
        if n:
            score += w * min(n, 5)
            basis.append(f"'{pat}' ×{n}")
    return score, basis


def classify_document(doc: ParsedDocument, filename: str) -> tuple[str, dict]:
    """A document names itself in its title/filename; the body only corroborates.
    ("...forms the basis of our BRSR filing" inside a sustainability report must
    not make it a BRSR.)"""
    first_heads = " ".join(h for p in doc.pages[:2] for lvl, h in p.headings if lvl == 1)
    title_probe = f"{filename.replace('_', ' ').replace('-', ' ')} {doc.title or ''} {first_heads}"
    body = " ".join(p.text for p in doc.pages[:60])
    scored = []
    for dtype, pats in DOCUMENT_TYPES.items():
        t_score, t_basis = _score(title_probe, pats)
        b_score, b_basis = _score(body, pats)
        s = 4 * t_score + b_score
        if s:
            scored.append((s, dtype, [f"title: {b}" for b in t_basis] + b_basis))
    if not scored:
        return "OTHER", {"basis": [], "scores": {}}
    scored.sort(reverse=True)
    top = scored[0]
    return top[1], {"basis": top[2], "scores": {d: round(s, 1) for s, d, _ in scored[:5]}}


def detect_sector(texts: list[str]) -> tuple[str | None, dict]:
    blob = " ".join(texts)
    counts = Counter()
    for sector, pats in SECTORS.items():
        counts[sector] = sum(min(len(re.findall(p, blob, re.I)), 20) for p in pats)
    if not counts or counts.most_common(1)[0][1] < 5:
        return None, {"counts": dict(counts)}
    best, n = counts.most_common(1)[0]
    return best, {"counts": dict(counts), "signal_hits": n}


def build_section_map(doc: ParsedDocument) -> tuple[dict[int, str], list[dict]]:
    """Return (page_no → active top-level section heading, section spans)."""
    page_section: dict[int, str] = {}
    spans: list[dict] = []
    current: str | None = None
    for p in doc.pages:
        top = [h for lvl, h in p.headings if lvl == 1]
        if top:
            if spans:
                spans[-1]["page_end"] = max(spans[-1]["page_start"], p.page_no - 1)
            current = top[0][:200]
            spans.append({"heading": current, "level": 1, "page_start": p.page_no, "page_end": p.page_no})
        elif spans:
            spans[-1]["page_end"] = p.page_no
        if current:
            page_section[p.page_no] = current
        subs = [h for lvl, h in p.headings if lvl == 2]
        if subs:
            page_section[p.page_no] = f"{current} › {subs[0][:120]}" if current else subs[0][:200]
    return page_section, spans


def infer_reporting_year(doc: ParsedDocument) -> int | None:
    head = " ".join(p.text for p in doc.pages[:3])
    m = re.findall(r"\b(?:FY\s?)?(20[1-4]\d)(?:[-–/](?:20)?(\d{2}))?\b", head)
    years = []
    for y, tail in m:
        yr = int(y)
        if tail:  # FY2024-25 → 2025 (fiscal year end)
            yr = int(str(y)[:2] + tail) if len(tail) == 2 else int(tail)
        if 2010 <= yr <= date.today().year + 1:   # excludes target years (2030, 2050)
            years.append(yr)
    return Counter(years).most_common(1)[0][0] if years else None
