"""Text segmentation and context helpers shared by every extractor."""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class Segment:
    text: str
    start: int   # offset in the page's text after whitespace normalisation (for highlighting)


_ABBREV = r"(?<!\bNo\.)(?<!\bvs\.)(?<!\be\.g\.)(?<!\bi\.e\.)(?<!\bapprox\.)(?<!\bInc\.)(?<!\bLtd\.)(?<!\bCo\.)"


def normalise(text: str) -> str:
    """Join hard-wrapped lines inside paragraphs; keep paragraph breaks."""
    text = text.replace("\u00ad", "").replace("\u2010", "-").replace("\u2011", "-")
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)            # de-hyphenate wraps
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\u2029", text)                 # paragraph marker
    text = re.sub(r"\s*\n\s*", " ", text)
    return text.replace("\u2029", "\n\n").strip()


def segments(text: str, max_len: int = 600) -> list[Segment]:
    """Sentence-level segments. Long run-on blocks (often table text) are split
    on bullet / pipe boundaries so a segment never spans unrelated facts."""
    norm = normalise(text)
    out: list[Segment] = []
    for para in re.finditer(r"[^\n]+", norm):
        ptxt, pstart = para.group(0), para.start()
        cursor = 0
        for m in re.finditer(_ABBREV + r"(?<=[.!?;])\s+(?=[A-Z(•\-–\"“])|\s+[•▪●]\s+", ptxt):
            piece = ptxt[cursor:m.start() + 1].strip()
            if piece:
                out.append(Segment(piece, pstart + cursor))
            cursor = m.end()
        tail = ptxt[cursor:].strip()
        if tail:
            out.append(Segment(tail, pstart + cursor))
    final: list[Segment] = []
    for s in out:
        if len(s.text) <= max_len:
            final.append(s)
            continue
        off = 0
        for chunk in re.split(r"(?<=\|)\s|(?<=:)\s(?=[A-Z])", s.text):
            if chunk.strip():
                final.append(Segment(chunk.strip(), s.start + off))
            off += len(chunk) + 1
    return final


FUTURE_TARGET = re.compile(
    r"\b(?:by|before|until|no later than|target(?:ing)?|in)\s+(?:the\s+(?:end of\s+)?)?(?:FY\s?|CY\s?)?(20[2-9]\d)\b", re.I)
TARGET_VERBS = re.compile(
    r"\b(?:target|targets|targeting|aim|aims|aiming|commit(?:ted|s|ment)?|pledge[ds]?|goal|ambition|aspire|aspiration|"
    r"plan(?:s|ned)? to|will (?:reduce|achieve|reach|become|source|cut)|seek(?:s|ing)? to|strive|intend)\b", re.I)
YEAR_IN = re.compile(r"\b(?:in|during|for|as of|as at|FY|fiscal(?: year)?|financial year|year ended(?: \w+ \d{1,2},?)?|reporting year)\s*(?:FY\s?)?(20[1-4]\d)(?:\s?[-–/]\s?(\d{2}))?\b", re.I)
BASELINE = re.compile(
    r"(?:from|against|relative to|compared (?:to|with)|vs\.?|versus|over)\s+(?:a\s+|the\s+|our\s+)?(?:FY\s?|CY\s?)?((?:19|20)\d\d)(?:\s?[-–/]\s?\d{2})?"
    r"|((?:19|20)\d\d)(?:\s?[-–/]\s?\d{2})?\s+(?:baseline|base[- ]year|levels?)"
    r"|base[- ]?(?:line )?year(?: of| is|:)?\s+(?:FY\s?)?((?:19|20)\d\d)", re.I)


def stated_year(seg: str) -> int | None:
    m = YEAR_IN.search(seg)
    if not m:
        return None
    y, tail = m.group(1), m.group(2)
    return int(y[:2] + tail) if tail else int(y)


def baseline_year(seg: str) -> int | None:
    m = BASELINE.search(seg)
    if not m:
        return None
    return int(next(g for g in m.groups() if g))


def is_forward_looking(seg: str, reporting_year: int | None) -> bool:
    """True when a sentence states a goal rather than a reported value."""
    if not TARGET_VERBS.search(seg):
        return False
    m = FUTURE_TARGET.search(seg)
    if not m:
        return bool(re.search(r"\b(?:target|goal|ambition|aim)\b", seg, re.I))
    return reporting_year is None or int(m.group(1)) > reporting_year


def window(text: str, start: int, end: int, pad: int = 160) -> str:
    return text[max(0, start - pad):min(len(text), end + pad)]
