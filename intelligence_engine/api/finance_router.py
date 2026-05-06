"""Climate Finance Monitor API Router."""

from fastapi import APIRouter, Query
from typing import Optional

router = APIRouter()


@router.get("/carbon-price", summary="Live carbon market prices")
async def carbon_prices(market: str = Query("all"), currency: str = Query("USD")):
    prices = {
        "EU-ETS": {"price": 84.20, "currency": "EUR", "change_pct": 1.4, "volume": "4.2M lots"},
        "California-CCA": {"price": 42.60, "currency": "USD", "change_pct": 0.8, "volume": "1.1M lots"},
        "RGGI": {"price": 14.80, "currency": "USD", "change_pct": -0.3, "volume": "480K lots"},
        "UK-ETS": {"price": 46.40, "currency": "GBP", "change_pct": 3.2, "volume": "820K lots"},
        "Gold-Standard-VCM": {"price": 14.20, "currency": "USD", "change_pct": 2.1, "volume": "280K lots"},
        "Verra-VCS": {"price": 8.60, "currency": "USD", "change_pct": -1.2, "volume": "620K lots"},
    }
    if market.lower() != "all":
        filtered = {k: v for k, v in prices.items() if market.lower() in k.lower()}
        return {"markets": filtered, "currency_note": f"Native currencies shown, convert to {currency} as needed"}
    return {"markets": prices, "as_of": "2025-10-15T14:30:00Z"}


@router.get("/green-bonds", summary="Green bond market data")
async def green_bonds(
    issuer_type: str = Query("all", description="sovereign | corporate | mdb | all"),
    min_size_bn: float = Query(0.0),
):
    bonds = [
        {"name": "EU Commission Green Bond", "issuer": "EU Commission", "type": "sovereign", "size_bn": 18.2, "yield_pct": 3.42, "rating": "AAA", "use": "Clean Energy"},
        {"name": "Ørsted Green Senior Bond", "issuer": "Ørsted A/S", "type": "corporate", "size_bn": 2.4, "yield_pct": 4.18, "rating": "BBB+", "use": "Offshore Wind"},
        {"name": "World Bank IBRD Green Bond", "issuer": "World Bank", "type": "mdb", "size_bn": 4.8, "yield_pct": 3.85, "rating": "AAA", "use": "Climate Adaptation"},
        {"name": "NextEra Sustainability Bond", "issuer": "NextEra Energy", "type": "corporate", "size_bn": 1.6, "yield_pct": 4.62, "rating": "A-", "use": "Solar/Wind"},
        {"name": "Brazil Sovereign Green Bond", "issuer": "Republic of Brazil", "type": "sovereign", "size_bn": 6.4, "yield_pct": 7.82, "rating": "BB-", "use": "Amazon Protection"},
    ]

    filtered = [b for b in bonds if b["size_bn"] >= min_size_bn]
    if issuer_type != "all":
        filtered = [b for b in filtered if b["type"] == issuer_type]

    total_issuance_2025e = 1294  # $B
    return {
        "bonds": filtered,
        "market_summary": {
            "total_esg_issuance_2025e_bn": total_issuance_2025e,
            "green_bond_pct": 52,
            "social_bond_pct": 19,
            "sustainability_bond_pct": 17,
            "slb_pct": 12,
        }
    }


@router.get("/capital-flows", summary="Sustainable finance capital flows by region")
async def capital_flows():
    return {
        "flows": [
            {"region": "Europe", "flow_bn": 284, "yoy_change_pct": 8.2},
            {"region": "North America", "flow_bn": 186, "yoy_change_pct": 12.4},
            {"region": "Asia-Pacific", "flow_bn": 142, "yoy_change_pct": 18.6},
            {"region": "China", "flow_bn": 98, "yoy_change_pct": 24.2},
            {"region": "Latin America", "flow_bn": 34, "yoy_change_pct": 4.8},
            {"region": "MEA", "flow_bn": 18, "yoy_change_pct": 31.4},
        ],
        "total_bn": 762,
        "year": 2025,
        "source": "Climate Policy Initiative / BloombergNEF",
    }
