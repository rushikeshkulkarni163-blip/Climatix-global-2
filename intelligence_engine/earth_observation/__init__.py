"""
Climactix Earth Observation & Climate Data Repository — Phase 1.

Central data layer that turns satellite/EO and climate provider APIs into
Climactix's own internal, provider-agnostic Earth Observation API
(api/earth_observation_router.py). Nothing outside this package talks to
a provider directly, and nothing outside intelligence_engine talks to a
provider at all — the frontend only ever calls Climactix's own API.
"""
