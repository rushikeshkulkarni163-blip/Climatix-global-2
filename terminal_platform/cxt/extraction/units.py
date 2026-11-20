"""
Number and unit parsing / normalisation.

Values are only ever normalised between units of the same physical family
(tCO2e ↔ ktCO2e, GJ ↔ MWh). A unit that cannot be recognised is never
guessed: the caller must drop the value rather than invent a unit.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Multipliers written as words after a number ("2.4 million m³", "₹ 1,200 crore").
_MULT = {
    "thousand": 1e3, "k": 1e3, "lakh": 1e5, "lakhs": 1e5, "million": 1e6, "mn": 1e6, "mio": 1e6,
    "crore": 1e7, "crores": 1e7, "cr": 1e7, "billion": 1e9, "bn": 1e9,
}

_GHG = r"(?:co2|co₂|co\s?2)\s?-?\s?(?:e|eq|equivalents?|e\b)?"

# (regex, canonical unit, family, factor to the family's base unit)
UNIT_TABLE: list[tuple[str, str, str, float]] = [
    # GHG — base tCO2e
    (rf"mt\s?{_GHG}|million (?:metric )?(?:tonnes|tons) (?:of )?{_GHG}", "MtCO2e", "ghg", 1e6),
    (rf"kt\s?{_GHG}|thousand (?:metric )?(?:tonnes|tons) (?:of )?{_GHG}", "ktCO2e", "ghg", 1e3),
    (rf"(?:metric )?(?:tonnes|tons|t)\s?(?:of\s)?{_GHG}|tco2e|tco₂e|tco2", "tCO2e", "ghg", 1.0),
    (rf"kg\s?{_GHG}", "kgCO2e", "ghg", 1e-3),
    # Energy — base MWh
    (r"pj\b", "PJ", "energy", 277_777.78), (r"tj\b", "TJ", "energy", 277.7778),
    (r"gj\b|gigajoules?", "GJ", "energy", 0.2777778),
    (r"twh\b", "TWh", "energy", 1e6), (r"gwh\b", "GWh", "energy", 1e3),
    (r"mwh\b|megawatt[- ]hours?", "MWh", "energy", 1.0), (r"kwh\b|kilowatt[- ]hours?", "kWh", "energy", 1e-3),
    # Water — base m³
    (r"(?:mega ?lit(?:re|er)s?|ml)\b", "ML", "volume", 1e3),
    (r"(?:kilo ?lit(?:re|er)s?|kl)\b", "kL", "volume", 1.0),
    (r"m³|m3\b|cubic met(?:re|er)s?|cbm\b", "m3", "volume", 1.0),
    (r"lit(?:re|er)s?\b", "L", "volume", 1e-3),
    # Mass — base tonnes. "MT" is deliberately absent: it means metric tonnes
    # in Indian reports and million tonnes elsewhere — too ambiguous to normalise.
    (r"(?:metric )?(?:tonnes|tons)\b|\bt\b", "t", "mass", 1.0), (r"kg\b|kilograms?", "kg", "mass", 1e-3),
    # Percent
    (r"%|per ?cent\b", "%", "percent", 1.0),
]

_UNIT_RE = [(re.compile(rf"^\s?(?:{pat})", re.I), canon, fam, f) for pat, canon, fam, f in UNIT_TABLE]

NUMBER_RE = re.compile(
    r"(?<![\w.])(?P<num>\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)"
    r"(?:\s?(?P<mult>thousand|million|billion|lakhs?|crores?|mn|bn|mio|cr|k)\b)?",
    re.I,
)

_CURRENCY_PREFIX = re.compile(r"(?:₹|us\$|\$|€|£|(?<![A-Za-z])(?:rs\.?|inr|usd|eur|gbp))\s?$", re.I)
_CURRENCY_CANON = {"₹": "INR", "rs": "INR", "rs.": "INR", "inr": "INR", "usd": "USD", "us$": "USD", "$": "USD",
                   "eur": "EUR", "€": "EUR", "£": "GBP", "gbp": "GBP"}


@dataclass
class Quantity:
    value: float              # as written × word multiplier, in `unit`
    unit: str                 # canonical unit, e.g. tCO2e, MWh, %, INR
    family: str               # ghg | energy | volume | mass | percent | currency | intensity
    base_value: float | None  # normalised to the family base unit (None for intensity)
    base_unit: str | None
    start: int
    end: int
    raw: str


_BASE = {"ghg": "tCO2e", "energy": "MWh", "volume": "m3", "mass": "t", "percent": "%"}


def parse_number(num: str, mult: str | None = None) -> float:
    v = float(num.replace(",", ""))
    if mult:
        v *= _MULT[mult.lower()]
    return v


def match_unit(text: str, pos: int) -> tuple[str, str, float, int] | None:
    """Try to read a unit starting at text[pos]. Returns (canon, family, factor, end)."""
    tail = text[pos:pos + 60]
    for rx, canon, fam, f in _UNIT_RE:
        m = rx.match(tail)
        if m:
            return canon, fam, f, pos + m.end()
    return None


def find_quantities(text: str) -> list[Quantity]:
    """All number+unit pairs in `text`. Bare numbers without a unit are skipped,
    except four-digit years which callers read separately."""
    out: list[Quantity] = []
    for m in NUMBER_RE.finditer(text):
        num, mult = m.group("num"), m.group("mult")
        # Skip calendar years unless immediately followed by a unit ("2025 tCO2e" is implausible).
        if re.fullmatch(r"(19|20)\d\d", num) and not mult:
            continue
        value = parse_number(num, mult)
        end = m.end()

        pre = text[max(0, m.start() - 6):m.start()]
        cur = _CURRENCY_PREFIX.search(pre)
        if cur:
            code = _CURRENCY_CANON.get(cur.group(0).strip().lower().rstrip("."), cur.group(0).strip().upper())
            out.append(Quantity(value, code, "currency", None, None, m.start() - len(cur.group(0)), end,
                                text[m.start() - len(cur.group(0)):end]))
            continue

        u = match_unit(text, end)
        if not u:
            continue
        canon, fam, factor, uend = u
        # Intensity: "<qty> <unit> per <denominator>" or "<unit>/<denominator>"
        den = re.match(r"\s?(?:/|per)\s?([A-Za-z₹$€][\w₹$€ .]{0,30}?)(?=[,;.)\n]|\s(?:in|for|during|compared|against|from)\b|$)",
                       text[uend:uend + 45])
        if den and fam in ("ghg", "energy", "volume", "mass"):
            unit = f"{canon}/{den.group(1).strip()}"
            out.append(Quantity(value, unit, "intensity", None, None, m.start(), uend + den.end(),
                                text[m.start():uend + den.end()]))
            continue
        out.append(Quantity(value, canon, fam, value * factor, _BASE[fam], m.start(), uend, text[m.start():uend]))
    return out


def unit_from_label(label: str) -> tuple[str, str, float] | None:
    """Read a unit from a table header / row label such as 'Scope 1 (tCO2e)' or 'Energy, GJ'."""
    for m in re.finditer(r"[(\[,|]\s*|\bin\s+", label):
        u = match_unit(label, m.end())
        if u:
            canon, fam, f, uend = u
            den = re.match(r"\s?(?:/|per)\s?([\w₹$€ .]{1,30}?)(?=[)\]]|$)", label[uend:])
            if den:
                return f"{canon}/{den.group(1).strip()}", "intensity", 1.0
            return canon, fam, f
    return None


def parse_cell_number(cell: str) -> float | None:
    c = cell.strip().replace("−", "-")
    if not c or c in {"-", "–", "—", "NA", "N/A", "n/a", "NR", "nd", "—*"}:
        return None
    m = re.fullmatch(r"\(?(-?\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|-?\d+(?:\.\d+)?)\)?\s?(%)?\s?\*?", c)
    if not m:
        return None
    return float(m.group(1).replace(",", ""))


def year_from_header(cell: str) -> int | None:
    c = cell.strip()
    m = re.fullmatch(r"(?:FY\s?)?(20\d\d)(?:\s?[-–/]\s?(\d{2,4}))?(?:\s?\(base(?: year)?\))?", c, re.I)
    if not m:
        return None
    y, tail = m.group(1), m.group(2)
    if tail:
        return int(y[:2] + tail[-2:])   # FY2024-25 → 2025
    return int(y)
