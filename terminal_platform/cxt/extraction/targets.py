"""
Target & commitment extraction.

A sentence becomes a TARGET only when it names a climate outcome AND is
time-bound or quantified. Everything else that expresses intent is recorded
as a COMMITMENT with its strength class, so "we aspire to be net zero" can
never be confused with "SBTi-validated 50% absolute Scope 1+2 reduction by
2030 from a 2020 baseline".
"""

from __future__ import annotations

import re

from .domain import CommitmentClass, EvidenceItem, ParsedPage, TargetItem, TargetProgress
from .text import Segment, baseline_year, segments

KINDS: list[tuple[str, re.Pattern]] = [
    ("net_zero", re.compile(r"net[- ]zero|net zero", re.I)),
    ("carbon_neutral", re.compile(r"carbon[- ]neutral(?:ity)?|climate[- ]neutral(?:ity)?", re.I)),
    ("renewable_energy", re.compile(r"(?:\d{2,3}\s?%\s+)?renewable (?:electricity|energy|power)|re100", re.I)),
    ("ghg_reduction", re.compile(r"(?:reduc\w*|cut|lower|decrease)\b.{0,80}\b(?:emissions|ghg|greenhouse|carbon|scope\s?[123])|"
                                 r"(?:emissions|ghg|scope\s?[123]).{0,60}\b(?:reduc\w*|cut|decrease)", re.I)),
    ("energy_efficiency", re.compile(r"energy (?:intensity|efficiency).{0,60}(?:reduc|improv)", re.I)),
    ("water", re.compile(r"water (?:positive|neutral(?:ity)?|targets?|goals?)|(?:reduc\w*).{0,40}water|water.{0,40}(?:reduc\w*)", re.I)),
    ("waste", re.compile(r"zero waste|waste (?:targets?|goals?)|waste to landfill|(?:reduc\w*|divert\w*).{0,40}waste", re.I)),
    ("methane", re.compile(r"methane.{0,60}(?:reduc|intensity|near[- ]zero)", re.I)),
    ("nature", re.compile(r"no[- ]net[- ]loss|nature[- ]positive|deforestation[- ]free|net positive (?:impact on )?biodiversity", re.I)),
]

YEAR_BOUND = re.compile(r"\b(?:by|before|until|no later than|target year|in)\s+(?:the\s+end\s+of\s+)?(?:FY\s?|CY\s?)?(20[2-9]\d)\b", re.I)
YEAR_NAMED = re.compile(r"\b(20[1-9]\d)\s+(?:[\w-]+\s+){0,2}(?:targets?|goals?)\b", re.I)   # "our 2020 water target"
PCT = re.compile(r"(\d{1,3}(?:\.\d+)?)\s?(?:%|per ?cent)", re.I)

ASPIRATIONAL = re.compile(r"\b(?:aspir\w*|ambition\w*|aim(?:s|ing)? to|hope|strive|explore|seek(?:s|ing)? to|envision|journey towards|working towards)\b", re.I)
FIRM = re.compile(r"\b(?:target|targets|committed|commits?|commitment|pledged?|will (?:reduce|achieve|reach|become|source|cut)|have set|has set|set a)\b", re.I)
ANNOUNCE = re.compile(r"\b(?:plan(?:s|ned)? to|intend|announced|will)\b", re.I)
SCIENCE = re.compile(r"science[- ]based|\bsbti\b|1\.5\s?°?\s?c|well[- ]below 2", re.I)
VALIDATED = re.compile(r"(?:validated|approved|verified)\s+by\s+(?:the\s+)?(?:sbti|science based targets initiative)|sbti[- ](?:validated|approved)", re.I)
VALIDATION_PENDING = re.compile(r"(?:submitted|committed) to (?:the )?sbti|awaiting (?:sbti )?validation|commitment letter", re.I)
MANDATED = re.compile(r"\b(?:required by (?:law|regulation)|legally binding|statutory|mandated by|under the (?:climate|energy) (?:act|law)|regulatory requirement)\b", re.I)

ACHIEVED = re.compile(r"\b(?:achieved|met|exceeded|attained|reached)\b.{0,40}\b(?:target|goal|commitment)\b|\b(?:target|goal)\b.{0,30}\b(?:was|has been) (?:achieved|met|exceeded)", re.I)
MISSED = re.compile(r"\b(?:did not (?:meet|achieve)|missed|fell short|not (?:been )?(?:met|achieved))\b", re.I)
CANCELLED = re.compile(r"\b(?:withdr[ae]wn?|withdrew|discontinued|cancelled|abandoned|retired (?:the|our) target|no longer pursu)\w*", re.I)
PROGRESS = re.compile(r"(?:reduced|reduction of|decreased|cut|down|progress of)\b.{0,40}?(\d{1,3}(?:\.\d+)?)\s?%.{0,60}(?:since|from|against|compared|vs|to date|so far)", re.I)
ON_TRACK = re.compile(r"\bon track\b|\bprogress(?:ing)? (?:towards|against)\b", re.I)


def _scopes(seg: str) -> list[str]:
    s = seg.lower()
    found: set[str] = set()
    for m in re.finditer(r"scopes?\s?((?:[123](?:\s?(?:,|and|&|\+|/)\s?)?)+)", s):
        found.update(re.findall(r"[123]", m.group(1)))
    if re.search(r"value chain|supply chain emissions", s):
        found.add("3")
    if re.search(r"operational emissions|own operations", s) and not found:
        found.update({"1", "2"})
    return [f"Scope {n}" for n in sorted(found)]


def _commitment_class(seg: str, quantified: bool, time_bound: bool) -> CommitmentClass:
    if MANDATED.search(seg):
        return CommitmentClass.LEGALLY_MANDATED
    if VALIDATED.search(seg):
        return CommitmentClass.VALIDATED
    if SCIENCE.search(seg) and FIRM.search(seg) and not VALIDATION_PENDING.search(seg):
        return CommitmentClass.SCIENCE_BASED
    firm = bool(FIRM.search(seg))
    if ASPIRATIONAL.search(seg) and not firm:
        return CommitmentClass.ASPIRATIONAL
    if firm and time_bound and quantified:
        return CommitmentClass.FORMAL_TARGET
    if firm or ANNOUNCE.search(seg):
        return CommitmentClass.ANNOUNCED
    return CommitmentClass.ASPIRATIONAL


def _progress(seg: str) -> tuple[TargetProgress, float | None]:
    if CANCELLED.search(seg):
        return TargetProgress.CANCELLED, None
    if MISSED.search(seg):
        return TargetProgress.MISSED, None
    if ACHIEVED.search(seg):
        return TargetProgress.ACHIEVED, None
    m = PROGRESS.search(seg)
    if m:
        return TargetProgress.IN_PROGRESS, float(m.group(1))
    if ON_TRACK.search(seg):
        return TargetProgress.IN_PROGRESS, None
    return TargetProgress.NOT_STATED, None


def _reduction_pct(seg: str, kind: str) -> float | None:
    """The target percentage — not a progress figure in the same sentence."""
    for m in PCT.finditer(seg):
        before = seg[max(0, m.start() - 70):m.start()].lower()
        after = seg[m.end():m.end() + 50].lower()
        if re.search(r"(?:reduced|achieved|so far|to date|currently|down)\s*(?:by\s*)?$", before) or \
           re.match(r".{0,25}(?:so far|to date|since)", after):
            continue
        if kind == "renewable_energy" or re.search(r"reduc|cut|lower|decreas|by\s*$|target", before + after):
            v = float(m.group(1))
            if 0 < v <= 100:
                return v
    return None


_NEGATED = re.compile(r"\b(?:not|no|yet to|never)\b.{0,40}\b(?:set|established|adopted|have|target|commit\w*)\b|\bno (?:formal |quantified )?targets?\b", re.I)


def extract_targets(page: ParsedPage, section: str | None, doc_year: int | None,
                    segs: list[Segment] | None = None) -> tuple[list[TargetItem], list[EvidenceItem]]:
    """Returns (targets, commitment-only evidence)."""
    segs = segs if segs is not None else segments(page.text)
    targets: list[TargetItem] = []
    commitments: list[EvidenceItem] = []
    for i, seg in enumerate(segs):
        s = seg.text
        if len(s) < 20 or _NEGATED.search(s) or s.strip().lower() in {h.strip().lower() for _, h in page.headings}:
            continue   # explicit negatives are captured by signals.py, never as commitments
        intent = (FIRM.search(s) or ASPIRATIONAL.search(s) or ANNOUNCE.search(s) or ACHIEVED.search(s)
                  or MISSED.search(s) or CANCELLED.search(s))
        if not intent:
            continue
        n_before = len(targets)
        for clause in _clauses(s):
            _classify_clause(clause, s, page, section, doc_year, targets, commitments)
        # Validation status and progress are often reported in the next sentence
        # ("Our targets have been validated by SBTi. To date we have reduced…").
        neighbours = [x.text for x in segs[i + 1:i + 3]]
        for t in targets[n_before:]:
            _apply_neighbour_context(t, neighbours)
    return targets, commitments


def _apply_neighbour_context(t: TargetItem, neighbours: list[str]) -> None:
    for n in neighbours:
        if KINDS_ANY.search(n) and not re.search(r"\btargets?\b", n, re.I):
            break   # next sentence is about something else
        # Only near-term reduction targets inherit a generic "our targets were validated";
        # a net-zero target is upgraded only when the validation sentence names it.
        covers = t.target_kind == "ghg_reduction" or (t.target_kind == "net_zero" and re.search(r"net[- ]zero", n, re.I))
        if covers and VALIDATED.search(n) and re.search(r"\btargets?\b", n, re.I) and \
                t.commitment_class in (CommitmentClass.FORMAL_TARGET, CommitmentClass.SCIENCE_BASED):
            t.commitment_class = CommitmentClass.VALIDATED
            t.framework = "SBTi"
            t.evidence.attributes.update(commitment_class=t.commitment_class.value,
                                         class_basis="adjacent sentence", class_quote=n[:300])
        if t.target_kind == "ghg_reduction" and t.progress_status == TargetProgress.NOT_STATED:
            prog, cur = _progress(n)
            same_scope = not t.scope_coverage or set(_scopes(n)) in (set(), set(t.scope_coverage))
            if prog != TargetProgress.NOT_STATED and same_scope:
                t.progress_status, t.current_progress_pct = prog, cur
                t.evidence.attributes.update(progress_basis="adjacent sentence", progress_quote=n[:300])


KINDS_ANY = re.compile(r"net[- ]zero|carbon[- ]neutral|renewable|water|waste|methane", re.I)


# Split compound commitments ("cut Scope 1+2 by 50% by 2030 and reach net zero
# by 2040") so each clause yields its own target with its own year and figure.
_CLAUSE_SPLIT = re.compile(r";\s+|,?\s+and\s+(?=(?:to\s+)?(?:achieve|reach|become|reduce|source|cut|be\s|attain|deliver)\b)", re.I)


def _clauses(s: str) -> list[str]:
    parts = [p.strip() for p in _CLAUSE_SPLIT.split(s) if p and p.strip()]
    return parts if len(parts) > 1 else [s]


def _classify_clause(c: str, s: str, page: ParsedPage, section: str | None, doc_year: int | None,
                     targets: list, commitments: list) -> None:
    """One clause → at most one target or commitment. Class/framework read the whole sentence."""
    for kind, rx in KINDS:
        if not rx.search(c):
            continue
        ym = YEAR_BOUND.search(c) or YEAR_NAMED.search(c)
        target_year = int(ym.group(1)) if ym else None
        if target_year and doc_year and target_year < doc_year - 15:
            target_year = None
        pct = _reduction_pct(c, kind)
        quantified = pct is not None or kind in ("net_zero", "carbon_neutral", "nature") or bool(re.search(r"zero waste|100\s?%", c, re.I))
        time_bound = target_year is not None
        cls = _commitment_class(s, quantified, time_bound)
        progress, cur = _progress(c)
        framework = "SBTi" if re.search(r"\bsbti\b|science based targets initiative", s, re.I) else None
        scope_cov = _scopes(c)
        target_type = ("intensity" if re.search(r"intensity|per (?:tonne|unit|revenue|employee|m²|sq)", c, re.I)
                       else "absolute" if re.search(r"absolute", c, re.I) or kind in ("ghg_reduction",) and pct else None)
        attrs = {"kind": kind, "commitment_class": cls.value, "time_bound": time_bound, "quantified": quantified,
                 "is_ocr": page.is_ocr, "validation_pending": bool(VALIDATION_PENDING.search(s)),
                 "progress_status": progress.value}
        ev = EvidenceItem(evidence_type="target" if (time_bound or pct is not None) else "commitment",
                          topic=kind, page_no=page.page_no, quote=s[:700], section=section,
                          method="pattern", confidence=0, attributes=attrs)
        if time_bound or pct is not None:
            targets.append(TargetItem(
                evidence=ev, target_kind=kind, description=c[:300], scope_coverage=scope_cov,
                commitment_class=cls, reduction_pct=pct if kind != "renewable_energy" or pct else None,
                baseline_year=baseline_year(c) or (baseline_year(s) if kind == "ghg_reduction" else None),
                target_year=target_year, target_type=target_type,
                progress_status=progress, current_progress_pct=cur, framework=framework))
        else:
            commitments.append(ev)
        break   # one classification per clause — the first (most specific) kind wins
