"""
Climactix AI — ESG Scoring Service
Produces three lightweight scores from the extracted ESG text and generated narratives:
  • ESG Score        (0–100) — how strong and comprehensive the ESG data is
  • SDG Alignment    (0–100) — breadth and depth of UN SDG coverage
  • Readability      (0–100) — how clear and accessible the generated content is
  • Content Quality  (0–100) — depth, specificity, and professional calibre
"""

import re


# ── Keyword libraries ──────────────────────────────────────────────────────────

_ENV_KEYWORDS = [
    "emission", "carbon", "co2", "ghg", "scope 1", "scope 2", "scope 3",
    "net-zero", "net zero", "renewable", "solar", "wind", "energy", "water",
    "waste", "circular", "biodiversity", "deforestation", "climate", "tcfd",
    "sbti", "science-based", "paris", "temperature", "decarboni",
]

_SOC_KEYWORDS = [
    "employee", "worker", "gender", "diversity", "inclusion", "health",
    "safety", "trir", "training", "community", "human rights", "supply chain",
    "labour", "labor", "living wage", "wellbeing", "engagement",
]

_GOV_KEYWORDS = [
    "board", "governance", "audit", "compliance", "policy", "transparency",
    "disclosure", "reporting", "framework", "assurance", "verification",
    "independent", "third-party", "executive", "remuneration", "ethics",
    "anti-corruption", "whistleblower", "risk management",
]

_POSITIVE_SIGNALS = [
    r"\d+%",           # percentage figures
    r"−\d",           # reductions
    r"reduced",
    r"decreased",
    r"improved",
    r"certified",
    r"verified",
    r"assured",
    r"third.party",
    r"sbti",
    r"science.based",
    r"net.zero",
    r"gri",
    r"tcfd",
    r"issb",
    r"csrd",
    r"re100",
    r"iso 50001",
    r"target",
    r"commitment",
]


# ── Public API ─────────────────────────────────────────────────────────────────

def calculate_scores(esg_text: str, narratives: dict) -> dict:
    """Return all four scores as a dict."""
    esg = _esg_score(esg_text)
    sdg = _sdg_score(narratives.get("sdg_mapping", {}))
    read = _readability_score(narratives)
    qual = _content_quality_score(narratives)

    return {
        "esg_score": esg,
        "sdg_alignment": sdg,
        "readability": read,
        "content_quality": qual,
    }


# ── Individual scorers ─────────────────────────────────────────────────────────

def _esg_score(text: str) -> int:
    """
    Rule-based ESG score using keyword density across E, S, G pillars
    plus positive signal count.
    """
    lower = text.lower()
    words = len(lower.split()) or 1

    e_hits = sum(lower.count(kw) for kw in _ENV_KEYWORDS)
    s_hits = sum(lower.count(kw) for kw in _SOC_KEYWORDS)
    g_hits = sum(lower.count(kw) for kw in _GOV_KEYWORDS)

    # Normalise per 1000 words, cap at saturation point
    e_norm = min(e_hits / words * 1000, 40)
    s_norm = min(s_hits / words * 1000, 30)
    g_norm = min(g_hits / words * 1000, 30)

    pillar_score = e_norm + s_norm + g_norm  # 0–100

    # Bonus for positive signals
    signal_hits = sum(
        len(re.findall(pat, lower)) for pat in _POSITIVE_SIGNALS
    )
    signal_bonus = min(signal_hits * 1.5, 20)

    raw = pillar_score * 0.75 + signal_bonus
    return _clamp(int(raw) + 42, 55, 97)   # floor at 55, cap at 97


def _sdg_score(sdg_mapping: dict) -> int:
    """Score based on number of SDGs mapped and average relevance score."""
    top_sdgs = sdg_mapping.get("top_sdgs", [])
    if not top_sdgs:
        return 58

    relevance_scores = [s.get("relevance_score", 70) for s in top_sdgs]
    avg_relevance = sum(relevance_scores) / len(relevance_scores)
    breadth_bonus = min(len(top_sdgs) * 4, 20)  # up to +20 for 5 SDGs

    raw = avg_relevance * 0.8 + breadth_bonus
    return _clamp(int(raw), 50, 96)


def _readability_score(narratives: dict) -> int:
    """
    Proxy readability: average sentence length (shorter = more readable).
    Measures all generated narrative text combined.
    """
    all_text = _collect_text(narratives)
    if not all_text:
        return 72

    sentences = re.split(r"[.!?]+", all_text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 10]
    if not sentences:
        return 72

    avg_words = sum(len(s.split()) for s in sentences) / len(sentences)

    # Target: 15–22 words per sentence = excellent readability
    if avg_words <= 18:
        score = 90
    elif avg_words <= 24:
        score = 82
    elif avg_words <= 30:
        score = 74
    else:
        score = 65

    return _clamp(score, 60, 95)


def _content_quality_score(narratives: dict) -> int:
    """
    Quality proxy: total generated word count + presence of key professional terms.
    """
    all_text = _collect_text(narratives)
    if not all_text:
        return 68

    word_count = len(all_text.split())
    lower = all_text.lower()

    # Professional specificity signals
    specificity_terms = [
        "material", "trajectory", "disclosure", "alignment", "framework",
        "target", "commitment", "pathway", "quantif", "assur",
        "metric", "baseline", "benchmark", "verified", "audit",
    ]
    specificity_hits = sum(lower.count(t) for t in specificity_terms)

    length_score = min(word_count / 30, 60)           # 1800 words → 60 pts
    specificity_score = min(specificity_hits * 1.8, 35)

    raw = length_score + specificity_score
    return _clamp(int(raw) + 25, 62, 98)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _collect_text(narratives: dict) -> str:
    """Flatten all string values in the narratives dict into a single blob."""
    parts = []

    def _recurse(obj):
        if isinstance(obj, str):
            parts.append(obj)
        elif isinstance(obj, list):
            for item in obj:
                _recurse(item)
        elif isinstance(obj, dict):
            for v in obj.values():
                _recurse(v)

    _recurse(narratives)
    return " ".join(parts)


def _clamp(value: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, value))
