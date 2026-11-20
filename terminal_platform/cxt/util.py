"""Small shared helpers."""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from datetime import date
from typing import Any

_SUFFIXES = (r"\b(?:limited|ltd|pvt|private|public|plc|inc|incorporated|corp|corporation|company|co|llp|llc|"
             r"sa|ag|nv|gmbh|holdings?|group|the)\b")


def normalise_name(name: str) -> str:
    """Comparison key for company names: case, punctuation, accents and legal
    suffixes removed. 'Tata Motors Ltd.' and 'TATA MOTORS LIMITED' collide."""
    n = unicodedata.normalize("NFKD", name or "").encode("ascii", "ignore").decode().lower()
    n = n.replace("&", " and ")
    n = re.sub(r"[^a-z0-9 ]+", " ", n)
    n = re.sub(_SUFFIXES, " ", n)
    return re.sub(r"\s+", " ", n).strip()


def fy_label(fiscal_year: int | None) -> str | None:
    """2025 -> 'FY2024-25' (the year stored is the year the period ends)."""
    if not fiscal_year:
        return None
    return f"FY{fiscal_year - 1}-{str(fiscal_year)[2:]}"


def parse_fy(value: str | int | None) -> int | None:
    """Accepts 2025, '2025', 'FY2024-25', '2024-25', 'FY25'."""
    if value is None or value == "":
        return None
    if isinstance(value, int):
        return value
    v = str(value).strip().upper().replace("FY", "").strip()
    m = re.fullmatch(r"(20\d\d)\s?[-–/]\s?(\d{2}|20\d\d)", v)
    if m:
        return int(m.group(1)[:2] + m.group(2)[-2:])
    if re.fullmatch(r"20\d\d", v):
        return int(v)
    if re.fullmatch(r"\d\d", v):
        return 2000 + int(v)
    raise ValueError(f"Unrecognised fiscal year: {value!r}")


def current_fiscal_year(today: date | None = None) -> int:
    """Indian fiscal convention (April-March): the FY in progress today."""
    t = today or date.today()
    return t.year + 1 if t.month >= 4 else t.year


def canonical_json(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), default=str, ensure_ascii=False)


def sha256_hex(data: bytes | str) -> str:
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def content_hash(obj: Any) -> str:
    return sha256_hex(canonical_json(obj))
