"""
Qualitative evidence signals: frameworks, physical & transition risk,
governance, assurance, climate claims, offsets, nature, scenario analysis,
policies — and explicit negative statements.

A signal requires context, not a bare keyword: "flood" alone is not physical
risk evidence; "flood risk at our coastal plants was assessed" is. Negative
statements ("we have not yet set a Scope 3 target") are captured as their own
evidence type because they are the ONLY basis on which an answer may be NO.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from .domain import EvidenceItem, ParsedPage
from .text import Segment, is_forward_looking, segments

# Claims that assert a current state; forward-looking sentences are commitments (targets.py), not these claims.
_ACHIEVEMENT_CLAIMS = {"carbon_neutral_claim", "renewable_claim", "green_claim"}


@dataclass(frozen=True)
class Signal:
    evidence_type: str
    topic: str
    pattern: str
    context: str | None = None     # second regex that must also match the sentence
    exclude: str | None = None


# Acronyms are matched case-sensitively (so "cdp" in prose or "gri" in a URL
# does not count); spelled-out names are case-insensitive via (?i:...).
FRAMEWORKS: dict[str, str] = {
    "GRI": r"\bGRI\b|(?i:global reporting initiative)",
    "SASB": r"\bSASB\b|(?i:sustainability accounting standards board)",
    "TCFD": r"\bTCFD\b|(?i:task force on climate[- ]related financial disclosures)",
    "ISSB": r"\bISSB\b|(?i:international sustainability standards board)",
    "IFRS_S1": r"\bIFRS\s?S1\b",
    "IFRS_S2": r"\bIFRS\s?S2\b",
    "CDP": r"\bCDP\b",
    "CSRD": r"\bCSRD\b|(?i:corporate sustainability reporting directive)",
    "ESRS": r"\bESRS\b|(?i:european sustainability reporting standards)",
    "BRSR": r"\bBRSR\b(?!\s?(?i:core))|(?i:business responsibility and sustainability report)",
    "BRSR_CORE": r"\bBRSR\s?(?i:core)\b",
    "UN_SDGs": r"\bSDGs?\b|(?i:sustainable development goals)",
    "SBTi": r"\bSBTi\b|(?i:science based targets initiative)",
    "TNFD": r"\bTNFD\b|(?i:taskforce on nature[- ]related)",
    "GHG_PROTOCOL": r"(?i:ghg protocol|greenhouse gas protocol)",
    "PCAF": r"\bPCAF\b|(?i:partnership for carbon accounting financials)",
    "ISO_14064": r"(?i:iso\s?14064)",
    "EU_TAXONOMY": r"(?i:eu taxonomy)",
}

_RELATION = [
    ("in_accordance", re.compile(r"in accordance with|prepared (?:in line with|according to|using)|complies with|compliant with", re.I)),
    ("aligned", re.compile(r"aligned (?:with|to)|alignment with|in line with|guided by|consistent with|follows? the", re.I)),
    ("with_reference", re.compile(r"with reference to|referenc(?:e|ing)|mapped to|index", re.I)),
    ("responded", re.compile(r"responded to|submitted|disclos\w+ (?:through|via|to)|score[ds]?\b|rated", re.I)),
]

_RISK_CTX = r"risk|exposure|exposed|impact|disrupt|vulnerab|assess|scenario|hazard|resilien|adapt|loss|damage|stress"

SIGNALS: list[Signal] = [
    # ── Physical risk ──────────────────────────────────────────────────────
    Signal("physical_risk", "flood", r"\bflood\w*|inundat\w*", _RISK_CTX),
    Signal("physical_risk", "heat", r"heat ?waves?|extreme heat|heat stress|rising temperatures?|high temperatures", _RISK_CTX),
    Signal("physical_risk", "drought", r"\bdroughts?\b", _RISK_CTX),
    Signal("physical_risk", "cyclone_storm", r"cyclones?|hurricanes?|typhoons?|(?:severe |tropical )?storms?\b", _RISK_CTX),
    Signal("physical_risk", "wildfire", r"wild ?fires?|forest fires?|bushfires?", _RISK_CTX),
    Signal("physical_risk", "water_stress", r"water[- ]stress\w*|water scarcity|aqueduct", _RISK_CTX + r"|basin|region|site|facilit"),
    Signal("physical_risk", "sea_level_rise", r"sea[- ]level rise|coastal (?:erosion|flooding)|storm surge", None),
    Signal("physical_risk", "extreme_precipitation", r"extreme (?:rainfall|precipitation)|heavy rainfall|monsoon variab\w*", _RISK_CTX),
    Signal("physical_risk", "landslide", r"landslides?|mudslides?", _RISK_CTX),
    Signal("physical_risk", "asset_exposure", r"physical (?:climate )?risk", r"asset|site|facilit|plant|location|operation"),
    Signal("physical_risk", "supply_chain_exposure", r"supply chain|suppliers?", r"physical (?:climate )?risk|extreme weather|flood|drought|heat|cyclone"),
    Signal("physical_risk", "operational_disruption", r"(?:operational|business|production) (?:disruption|interruption|downtime)", r"climate|weather|flood|heat|cyclone|storm"),
    # ── Transition risk ────────────────────────────────────────────────────
    Signal("transition_risk", "carbon_pricing", r"carbon pric\w+|carbon tax\w*|price on carbon", None),
    Signal("transition_risk", "eu_ets", r"\bEU ETS\b|emissions trading (?:system|scheme)|\bETS\b", None),
    Signal("transition_risk", "cbam", r"\bCBAM\b|carbon border adjustment", None),
    Signal("transition_risk", "regulatory", r"climate (?:regulation|legislation|policy changes?)|regulatory (?:risk|change)", r"climate|carbon|emission|transition"),
    Signal("transition_risk", "fuel_transition", r"fuel (?:switch\w*|transition)|alternative fuels?|green hydrogen|electrification", None),
    Signal("transition_risk", "technology_transition", r"technolog\w+ (?:risk|transition|disruption|shift)|low[- ]carbon technolog\w+", None),
    Signal("transition_risk", "market_transition", r"market (?:risk|shift|transition)|changing customer (?:preferences|demand)|demand for low[- ]carbon", r"climate|carbon|low[- ]carbon|transition"),
    Signal("transition_risk", "fossil_dependency", r"(?:dependen\w+ on|reliance on|share of) (?:fossil|coal|oil|gas)|coal[- ]fired|fossil fuel (?:revenue|exposure|dependen\w*)", None),
    Signal("transition_risk", "stranded_assets", r"stranded assets?|asset stranding|impairment", r"climate|carbon|transition|stranded"),
    Signal("transition_risk", "transition_plan", r"(?:climate )?transition plan|decarboni[sz]ation (?:roadmap|pathway|strategy|plan)|net[- ]zero (?:roadmap|plan|pathway|strategy)", None),
    Signal("transition_risk", "low_carbon_investment", r"(?:low[- ]carbon|green|climate|decarboni[sz]ation) (?:capex|investment|capital)", None),
    Signal("transition_risk", "scenario_analysis", r"scenario analysis|climate scenarios?|\bNGFS\b|\bRCP ?\d|\bSSP\d|IEA (?:NZE|STEPS|APS)|1\.5\s?°?C scenario", None),
    # ── Governance ─────────────────────────────────────────────────────────
    Signal("governance", "board_oversight", r"\bboard\b", r"climate|sustainab|esg", r"\bon[- ]?board\w*|board ?room"),
    Signal("governance", "climate_committee", r"(?:climate|sustainab\w*|esg|csr)[\w ,&-]{0,30}committee|committee[\w ,&-]{0,30}(?:climate|sustainab\w*|esg)", None),
    Signal("governance", "executive_accountability", r"chief (?:sustainability|executive|risk|financial) officer|\bCSO\b|\bCEO\b|head of sustainability|management committee",
           r"climate|sustainab|esg|emission|net[- ]zero", None),
    Signal("governance", "remuneration_link", r"remuneration|compensation|incentive|bonus|variable pay|\bLTIP\b|\bSTI\b",
           r"climate|emission|esg|sustainab|carbon|net[- ]zero"),
    Signal("governance", "risk_management", r"enterprise risk management|\bERM\b|risk register|risk management (?:framework|process)", r"climate|esg|sustainab"),
    Signal("governance", "internal_controls", r"internal controls?|data (?:governance|controls)|control environment", r"esg|sustainab|climate|emission|non-financial"),
    Signal("governance", "reporting_boundary", r"operational control|financial control|equity share|reporting boundary|organi[sz]ational boundary", None),
    # ── Assurance ──────────────────────────────────────────────────────────
    Signal("assurance", "external_assurance", r"(?:limited|reasonable|independent|third[- ]party|external) assurance|assured by|ISAE ?3000|ISAE ?3410|AA1000|verified by|independent verification", None),
    # ── Policies ───────────────────────────────────────────────────────────
    Signal("policy", "climate_policy", r"climate (?:change )?policy|environmental policy|energy policy|net[- ]zero policy", None),
    Signal("policy", "biodiversity_policy", r"biodiversity (?:policy|commitment|strategy)|no[- ]deforestation policy", None),
    Signal("policy", "human_rights_policy", r"human rights policy", None),
    Signal("policy", "supplier_code", r"supplier code of conduct|responsible sourcing policy|supplier (?:esg|sustainability) (?:requirements|assessment)", None),
    # ── Nature / water / waste context ─────────────────────────────────────
    Signal("nature", "protected_areas", r"protected areas?|key biodiversity areas?|world heritage|ramsar|high biodiversity value", None),
    Signal("nature", "nature_dependencies", r"nature[- ]related (?:risks?|dependenc\w+|impacts?)|ecosystem services|\bLEAP\b approach", None),
    Signal("nature", "biodiversity_risk", r"biodiversity (?:risk|loss|impact|assessment)", None),
    Signal("waste", "circularity", r"circular(?:ity| economy)|extended producer responsibility|\bEPR\b|recycled content", None),
    # ── Offsets & claims ───────────────────────────────────────────────────
    Signal("offsets", "carbon_credits", r"carbon credits?|offsets?|offsetting|\bVCS\b|verra|gold standard|\bVERs?\b|\bCERs?\b", r"carbon|emission|neutral|net[- ]zero|retire|purchase"),
    Signal("offsets", "recs", r"renewable energy certificates?|\bI-?RECs?\b|guarantees of origin|\bRECs\b", None),
    Signal("claim", "carbon_neutral_claim", r"(?:are|is|became|been|certified|achieved) (?:\w+ )?carbon[- ]neutral|carbon[- ]neutral (?:company|operations|since|status|certified)", None),
    Signal("claim", "net_zero_claim", r"net[- ]zero (?:company|business|by 20\d\d|commitment|ambition|target|goal|emissions by)|(?:achieve|reach|become) net[- ]zero", None),
    Signal("claim", "renewable_claim", r"100\s?% renewable", None),
    Signal("claim", "green_claim", r"climate[- ]positive|carbon[- ]negative|planet[- ]positive|green(?:est)? (?:company|products?) ", None),
]

NEGATIVES: list[tuple[str, str]] = [
    # (topic, pattern) — explicit statements that something does not exist / is not done
    ("scope3_emissions", r"(?:not|yet to)\s+(?:yet\s+)?(?:measure|calculat|report|disclos|quantif)\w*\s+(?:our\s+|its\s+)?scope\s?3|scope\s?3 (?:emissions )?(?:are|is|were) not (?:yet )?(?:measured|calculated|reported|disclosed|quantified)"),
    ("scope3_target", r"(?:not|no)\s+(?:yet\s+)?(?:set|established|adopted|have)\s+(?:a\s+)?(?:any\s+)?(?:\w+\s+)?scope\s?3 (?:target|reduction target)"),
    ("ghg_target", r"(?:have|has) not (?:yet )?(?:set|established|adopted) (?:a |any )?(?:\w+ )?(?:emissions?|ghg|reduction|climate) targets?|no (?:formal |quantified )?(?:emissions?|ghg|reduction|climate) targets?"),
    ("transition_plan", r"(?:have|has|does) not (?:yet )?(?:\w+ )?(?:developed|adopted|published|have) (?:a |any )?(?:formal )?(?:climate )?transition plan|no (?:formal )?transition plan"),
    ("scenario_analysis", r"(?:have|has) not (?:yet )?(?:conducted|undertaken|performed|carried out) (?:a |any )?(?:climate )?scenario analysis|no (?:climate )?scenario analysis"),
    ("external_assurance", r"(?:not|has not been|have not been|was not|were not) (?:\w+ )?(?:externally |independently )?(?:assured|verified)|no (?:external |independent )?assurance"),
    ("remuneration_link", r"(?:not|no) (?:currently )?(?:linked|tied) to (?:climate|esg|sustainab)|no (?:climate|esg)[- ]linked (?:remuneration|incentives?)"),
    ("climate_committee", r"(?:does not|do not) (?:have|maintain) a (?:dedicated )?(?:climate|sustainability|esg) committee|no (?:dedicated )?(?:climate|sustainability|esg) committee"),
    ("physical_risk_assessment", r"(?:have|has) not (?:yet )?(?:conducted|undertaken|performed|assessed) (?:a |any )?physical (?:climate )?risk"),
    ("internal_carbon_price", r"(?:do|does) not (?:currently )?(?:use|apply) (?:an )?internal carbon pric"),
    ("biodiversity_policy", r"(?:do|does) not (?:currently )?have a biodiversity policy|no biodiversity policy"),
    ("sbti", r"(?:not|yet to) (?:\w+ )?(?:committed to|joined|submitted to) (?:the )?sbti|targets? (?:are|is|have) not (?:been )?validated"),
]

_SIG_RX = [(s, re.compile(s.pattern, re.I), re.compile(s.context, re.I) if s.context else None,
            re.compile(s.exclude, re.I) if s.exclude else None) for s in SIGNALS]
_FW_RX = {k: re.compile(v) for k, v in FRAMEWORKS.items()}
_NEG_RX = [(t, re.compile(p, re.I)) for t, p in NEGATIVES]
_NOT_ASSURED = dict(_NEG_RX)["external_assurance"]

_ASSURANCE_LEVEL = [("reasonable", re.compile(r"reasonable assurance", re.I)),
                    ("limited", re.compile(r"limited assurance", re.I))]
_ASSURANCE_STD = re.compile(r"ISAE ?3000|ISAE ?3410|AA1000\w*|ISO ?14064-3", re.I)
_ASSURANCE_SCOPE = re.compile(r"scope\s?[123](?:\s?(?:,|and|&)\s?[123])*|energy|water|waste|ghg|emissions", re.I)


def extract_signals(page: ParsedPage, section: str | None, segs: list[Segment] | None = None) -> list[EvidenceItem]:
    segs = segs if segs is not None else segments(page.text)
    out: list[EvidenceItem] = []
    seen: set[tuple[str, str]] = set()

    def add(item: EvidenceItem):
        key = (item.evidence_type, item.topic, item.quote[:120])
        if key not in seen:
            seen.add(key)
            out.append(item)

    fw_on_page: dict[str, EvidenceItem] = {}
    headings = {h.strip().lower() for _, h in page.headings}
    for seg in segs:
        s = seg.text
        if len(s) < 15 or s.strip().lower() in headings:
            continue   # a heading ("Independent assurance") labels a section; it is not evidence

        for topic, rx in _NEG_RX:
            if rx.search(s):
                add(EvidenceItem("negative", topic, page.page_no, s[:600], section, attributes={"is_ocr": page.is_ocr}))

        forward = is_forward_looking(s, None)
        for sig, rx, ctx, ex in _SIG_RX:
            m = rx.search(s)
            if not m or (ctx and not ctx.search(s)) or (ex and ex.search(s)):
                continue
            if forward and sig.topic in _ACHIEVEMENT_CLAIMS:
                continue   # "we aim to source 100% renewable by 2030" is a commitment, not a claim of achievement
            attrs: dict = {"matched": m.group(0), "is_ocr": page.is_ocr}
            if sig.topic == "external_assurance":
                attrs["level"] = next((lvl for lvl, r in _ASSURANCE_LEVEL if r.search(s)), "unspecified")
                std = _ASSURANCE_STD.search(s)
                attrs["standard"] = std.group(0) if std else None
                attrs["covers"] = sorted({x.group(0).lower() for x in _ASSURANCE_SCOPE.finditer(s)})
                if _NOT_ASSURED.search(s):
                    continue    # "not externally assured" is a negative, not assurance evidence
            add(EvidenceItem(sig.evidence_type, sig.topic, page.page_no, s[:600], section, attributes=attrs))

        for fw, rx in _FW_RX.items():
            if not rx.search(s):
                continue
            relation = next((name for name, r in _RELATION if r.search(s)), "mention")
            prev = fw_on_page.get(fw)
            rank = [n for n, _ in _RELATION] + ["mention"]
            if prev is None or rank.index(relation) < rank.index(prev.attributes["relation"]):
                fw_on_page[fw] = EvidenceItem("framework", fw, page.page_no, s[:600], section,
                                              attributes={"relation": relation, "is_ocr": page.is_ocr})
    for item in fw_on_page.values():
        add(item)
    return out
