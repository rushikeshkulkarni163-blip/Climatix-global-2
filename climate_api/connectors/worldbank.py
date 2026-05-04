"""
World Bank Open Data API connector.
No API key required. Free tier: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392
"""
import httpx
import asyncio
import logging
from typing import Optional, Dict, Any

from ..models.schemas import CountryMacroData

logger = logging.getLogger(__name__)

WB_BASE = "https://api.worldbank.org/v2"

# Indicator codes
INDICATORS: Dict[str, str] = {
    "gdp":              "NY.GDP.MKTP.CD",       # GDP (current USD)
    "gdp_growth":       "NY.GDP.MKTP.KD.ZG",    # GDP growth (annual %)
    "co2_per_capita":   "EN.ATM.CO2E.PC",        # CO2 emissions per capita (metric tons)
    "population":       "SP.POP.TOTL",           # Total population
    "energy_use":       "EG.USE.PCAP.KG.OE",     # Energy use (kg oil equiv. per capita)
    "renewable_pct":    "EG.FEC.RNEW.ZS",        # Renewable energy (% of total)
    "forest_area":      "AG.LND.FRST.ZS",        # Forest area (% of land)
}

# ISO3 → ISO2 lookup (World Bank uses ISO2)
_ISO3_TO_ISO2: Dict[str, str] = {
    "USA": "US", "CHN": "CN", "IND": "IN", "DEU": "DE", "AUS": "AU",
    "SGP": "SG", "BRA": "BR", "NLD": "NL", "ARE": "AE", "NGA": "NG",
    "JPN": "JP", "GBR": "GB", "FRA": "FR", "ZAF": "ZA", "RUS": "RU",
    "IDN": "ID", "MEX": "MX", "SAU": "SA", "KOR": "KR", "CAN": "CA",
    "THA": "TH", "MYS": "MY", "PHL": "PH", "VNM": "VN", "BGD": "BD",
    "PAK": "PK", "IRN": "IR", "TUR": "TR", "ARG": "AR", "COL": "CO",
    "EGY": "EG", "ETH": "ET", "KEN": "KE", "TZA": "TZ", "GHA": "GH",
    "MAR": "MA", "DZA": "DZ", "AGO": "AO", "MOZ": "MZ", "MDG": "MG",
    "NOR": "NO", "SWE": "SE", "DNK": "DK", "FIN": "FI", "POL": "PL",
    "CZE": "CZ", "HUN": "HU", "ROU": "RO", "UKR": "UA", "KAZ": "KZ",
}

# Simple in-memory cache (TTL: session-scoped)
_cache: Dict[str, CountryMacroData] = {}


async def _fetch_indicator(
    client: httpx.AsyncClient, country: str, indicator: str
) -> Optional[float]:
    url = f"{WB_BASE}/country/{country}/indicator/{indicator}"
    params = {"format": "json", "mrv": 5, "per_page": 5}
    try:
        r = await client.get(url, params=params, timeout=12.0)
        r.raise_for_status()
        data = r.json()
        if len(data) < 2 or not data[1]:
            return None
        for entry in data[1]:
            if entry.get("value") is not None:
                return float(entry["value"])
    except Exception as e:
        logger.debug(f"WB indicator {indicator} for {country}: {e}")
    return None


async def get_country_indicators(iso3: str) -> CountryMacroData:
    """Fetch key macro + climate indicators for a country from World Bank API."""
    iso3_upper = iso3.upper()
    if iso3_upper in _cache:
        return _cache[iso3_upper]

    country_code = _ISO3_TO_ISO2.get(iso3_upper, iso3_upper[:2])

    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(
            *[_fetch_indicator(client, country_code, ind) for ind in INDICATORS.values()],
            return_exceptions=True,
        )

    vals: Dict[str, Any] = {}
    for key, result in zip(INDICATORS.keys(), results):
        vals[key] = result if isinstance(result, float) else None

    macro = CountryMacroData(
        gdp_usd=vals.get("gdp"),
        gdp_growth_pct=vals.get("gdp_growth"),
        co2_per_capita=vals.get("co2_per_capita"),
        population=vals.get("population"),
        energy_use_per_capita=vals.get("energy_use"),
        renewable_energy_pct=vals.get("renewable_pct"),
        data_year=2022,
    )

    _cache[iso3_upper] = macro
    return macro
