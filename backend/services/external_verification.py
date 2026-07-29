"""
Climactix — External Evidence Cross-Check Layer
==================================================
Part of the Climactix Evidence Intelligence Agent (see evidence_intelligence_agent.py).

Spec §6: compare company-submitted evidence against credible external
sources — government environmental databases, regulators, exchange filings,
CDP disclosures, satellite/environmental datasets, scientific literature,
industry benchmarks — separated into 5 evidentiary-weight tiers.

THIS BUILD SHIPS NO LIVE EXTERNAL DATA PROVIDERS. Every external regulatory /
CDP / satellite / scientific-literature integration in the spec requires a
licensed data feed, an API key, or a live web-search capability this
environment does not have configured. Rather than fabricate a plausible-
sounding "external match" (which would violate the platform's core "CLAIM ≠
EVIDENCE ≠ VERIFIED FACT" rule), this module returns an honest
EXTERNAL_SOURCE_UNAVAILABLE result and clearly says why.

The interface is deliberately provider-pluggable: `register_provider()` lets
a real integration (e.g. a CDP API client, a regulatory-filings scraper) be
dropped in later without any change to the callers in
evidence_intelligence_agent.py — registering a provider is the only step
needed to make this real.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Optional


# ── Source taxonomy (spec §6) ────────────────────────────────────────────────

SOURCE_CATEGORIES = (
    "primary_regulatory",     # Government/regulator filings, exchange disclosures
    "company_disclosed",      # The company's own annual/sustainability report, CDP response
    "independent_scientific", # Peer-reviewed literature, scientific datasets
    "modelled_geospatial",    # Satellite/remote-sensing, hazard/climate models
    "secondary_media",        # News coverage, press releases about the company
)

# Evidentiary trust weights, mirroring verification_engine._SOURCE_WEIGHTS —
# never treat a media report as equivalent to a regulatory filing (spec §6
# hard rule).
_SOURCE_CATEGORY_WEIGHTS = {
    "primary_regulatory": 1.00,
    "company_disclosed": 0.55,
    "independent_scientific": 0.90,
    "modelled_geospatial": 0.75,
    "secondary_media": 0.25,
}


@dataclass
class ExternalCheckResult:
    status: str                 # "MATCH" | "PARTIAL_MATCH" | "MISMATCH" | "EXTERNAL_SOURCE_UNAVAILABLE"
    source_category: Optional[str]
    source_label: Optional[str]
    reason: str
    checked_categories: list = field(default_factory=list)


ProviderFn = Callable[[dict, tuple], Optional[ExternalCheckResult]]

_PROVIDERS: list[ProviderFn] = []


def register_provider(provider: ProviderFn) -> None:
    """
    Register a real external-data provider. A provider is a callable
    `(claim_or_metric: dict, source_categories: tuple) -> ExternalCheckResult | None`
    — return None if the provider has nothing relevant to say (the next
    provider, or the unavailable fallback, is tried instead).

    No providers are registered by default in this build — see module
    docstring. Call this at process startup once a real integration exists,
    e.g.:
        external_verification.register_provider(cdp_api_client.check)
    """
    _PROVIDERS.append(provider)


def _no_provider_configured(claim_or_metric: dict, source_categories: tuple) -> ExternalCheckResult:
    metric_or_claim_label = claim_or_metric.get("metric") or claim_or_metric.get("claim") or "this item"
    return ExternalCheckResult(
        status="EXTERNAL_SOURCE_UNAVAILABLE",
        source_category=None,
        source_label=None,
        reason=(
            f"No external data provider is configured for {', '.join(source_categories)}. "
            f"'{metric_or_claim_label}' has not been cross-checked against any external source — "
            f"this is an evidence gap, not a confirmed mismatch. Register a provider via "
            f"external_verification.register_provider() to enable real cross-checks."
        ),
        checked_categories=[],
    )


def cross_check_external(claim_or_metric: dict, source_categories: tuple = SOURCE_CATEGORIES) -> ExternalCheckResult:
    """
    Main entry point for the Evidence Intelligence Agent (spec §6).

    `claim_or_metric`: a structured claim (from claim_intelligence.py) or
    metric (from metric_intelligence.py) dict.
    `source_categories`: which of the 5 tiers to attempt, in priority order.

    Tries each registered provider in order; the first one to return a
    non-None result wins. Returns the honest EXTERNAL_SOURCE_UNAVAILABLE
    stub if no provider is registered or none had anything to say — never
    fabricates a match.
    """
    for provider in _PROVIDERS:
        try:
            result = provider(claim_or_metric, source_categories)
        except Exception:
            continue
        if result is not None:
            return result
    return _no_provider_configured(claim_or_metric, source_categories)


def source_category_weight(category: Optional[str]) -> float:
    """Trust weight for a source category, for use in confidence scoring."""
    return _SOURCE_CATEGORY_WEIGHTS.get(category, 0.0)
