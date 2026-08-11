-- ============================================================
-- Climactix Earth Observation & Climate Data Repository — Phase 1
-- Data Source Registry, Asset system, Environmental Indicator
-- schema, time-series hypertable, processing jobs, API usage.
-- Column/naming conventions follow infra/postgres/init.sql
-- (physical_risk_assessments, climate_signals hypertable).
-- Idempotent: safe to run on every intelligence_engine startup.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- ============================================================
-- DATA SOURCE REGISTRY  (spec §6)
-- ============================================================

CREATE TABLE IF NOT EXISTS data_sources (
    source_id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_key                VARCHAR(50) UNIQUE NOT NULL,   -- stable slug, e.g. 'sentinel-2'
    source_name                VARCHAR(255) NOT NULL,
    provider                   VARCHAR(120) NOT NULL,
    dataset_name                VARCHAR(255) NOT NULL,
    dataset_type                VARCHAR(50) NOT NULL,          -- satellite_optical|satellite_sar|satellite_altimetry|reanalysis|climatology|atmospheric
    api_endpoint                TEXT,
    authentication_type        VARCHAR(50) NOT NULL DEFAULT 'none', -- none|oauth2_client_credentials|bearer_token|api_token|application_token
    documentation_url          TEXT,
    license                     VARCHAR(255),
    spatial_resolution          VARCHAR(100),
    temporal_resolution        VARCHAR(100),
    coverage                    VARCHAR(100) DEFAULT 'Global',
    variables                   TEXT[] DEFAULT ARRAY[]::TEXT[],
    update_frequency            VARCHAR(100),
    ingestion_method            VARCHAR(50) NOT NULL DEFAULT 'on_demand_api', -- on_demand_api|stac_search|scheduled_pull
    status                       VARCHAR(20) NOT NULL DEFAULT 'demo',  -- active|demo|degraded|inactive
    last_successful_sync       TIMESTAMPTZ,
    last_error                  TEXT,
    data_quality                 VARCHAR(20) DEFAULT 'unverified',      -- verified|unverified|synthetic
    version                      VARCHAR(20) DEFAULT '1.0',
    attribution_requirement     TEXT,
    created_at                   TIMESTAMPTZ DEFAULT NOW(),
    updated_at                   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ASSET SYSTEM  (spec §12)
-- One row per physical asset (factory, port, mine, film location,
-- infrastructure, ...). Deliberately shaped like scenario_studio_assets
-- (infra/postgres/migrations/002, not currently wired anywhere) so the
-- two can be reconciled later — kept independent here since that
-- migration is not actually applied by any running service today.
-- ============================================================

CREATE TABLE IF NOT EXISTS eo_assets (
    asset_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id          UUID REFERENCES companies(id) ON DELETE CASCADE,
    asset_name           VARCHAR(255) NOT NULL,
    asset_type           VARCHAR(50) NOT NULL,   -- factory|office|warehouse|port|mine|power-plant|farm|film-location|infrastructure|city|village|other
    lat                   DECIMAL(10, 7) NOT NULL,
    lng                   DECIMAL(10, 7) NOT NULL,
    geom                  GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
                              ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
                          ) STORED,
    polygon               GEOGRAPHY(POLYGON, 4326),
    country               VARCHAR(100),
    region                VARCHAR(100),
    industry              VARCHAR(100),
    operational_status   VARCHAR(20) DEFAULT 'active',  -- active|inactive|under-construction|decommissioned
    date_added            TIMESTAMPTZ DEFAULT NOW(),
    data_availability     JSONB DEFAULT '{}'::jsonb,     -- {indicator_key: bool} cache of what has been observed for this asset
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eo_assets_company ON eo_assets(company_id);
CREATE INDEX IF NOT EXISTS idx_eo_assets_geom     ON eo_assets USING GIST(geom);

-- ============================================================
-- EARTH OBSERVATION DATASET CATALOGUE  (spec §7)
-- Metadata only — no raster storage. One row per discovered scene.
-- ============================================================

CREATE TABLE IF NOT EXISTS eo_datasets (
    dataset_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id            UUID REFERENCES data_sources(source_id) ON DELETE CASCADE,
    product_name          VARCHAR(255) NOT NULL,
    acquisition_time      TIMESTAMPTZ,
    processing_time       TIMESTAMPTZ,
    bbox                  GEOGRAPHY(POLYGON, 4326),
    cloud_cover_pct       DECIMAL(5, 2),
    spatial_resolution    VARCHAR(50),
    temporal_resolution   VARCHAR(50),
    bands                 TEXT[] DEFAULT ARRAY[]::TEXT[],
    variables             TEXT[] DEFAULT ARRAY[]::TEXT[],
    reference_url         TEXT,                            -- STAC item / provider URL, not a local file path
    processing_level      VARCHAR(20),                      -- L1C|L2A|L3|reanalysis|climatology
    quality_flag          VARCHAR(20) DEFAULT 'unverified',
    checksum               VARCHAR(128),
    metadata               JSONB DEFAULT '{}'::jsonb,
    source_version         VARCHAR(20),
    created_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eo_datasets_source ON eo_datasets(source_id);
CREATE INDEX IF NOT EXISTS idx_eo_datasets_bbox    ON eo_datasets USING GIST(bbox);
CREATE INDEX IF NOT EXISTS idx_eo_datasets_time     ON eo_datasets(acquisition_time DESC);

-- ============================================================
-- ENVIRONMENTAL INDICATORS  (spec §15, §38)
-- ============================================================

CREATE TABLE IF NOT EXISTS environmental_indicators (
    indicator_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id                UUID REFERENCES eo_assets(asset_id) ON DELETE CASCADE,
    name                     VARCHAR(120) NOT NULL,           -- e.g. 'NDVI', 'Land Surface Temperature'
    category                 VARCHAR(20) NOT NULL CHECK (category IN
                              ('CLIMATE','WATER','LAND','NATURE','AIR','CARBON','COASTAL','DISASTER','ENERGY','AGRICULTURE')),
    source_id                UUID REFERENCES data_sources(source_id),
    source_dataset           VARCHAR(255),
    calculation_method       TEXT,
    unit                      VARCHAR(50),
    spatial_resolution        VARCHAR(50),
    temporal_resolution       VARCHAR(50),
    observation_type          VARCHAR(30) NOT NULL CHECK (observation_type IN
                              ('DIRECT_OBSERVATION','DERIVED_INDICATOR','MODELLED','REANALYSIS',
                               'SCENARIO_PROJECTION','PROXY','COMPANY_REPORTED')),
    baseline_value             DECIMAL(14, 4),
    current_value              DECIMAL(14, 4),
    trend                       VARCHAR(20),                    -- improving|stable|deteriorating|insufficient_data
    confidence                  VARCHAR(10) NOT NULL DEFAULT 'LOW' CHECK (confidence IN ('HIGH','MEDIUM','LOW')),
    is_demo                     BOOLEAN NOT NULL DEFAULT TRUE,   -- TRUE until a live provider credential backs this value
    last_updated                TIMESTAMPTZ DEFAULT NOW(),
    limitations                  TEXT,
    created_at                    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_env_indicators_asset    ON environmental_indicators(asset_id);
CREATE INDEX IF NOT EXISTS idx_env_indicators_category ON environmental_indicators(category);

-- ============================================================
-- TIME-SERIES  (spec §14) — TimescaleDB hypertable, same pattern
-- as climate_signals / emissions in infra/postgres/init.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS eo_time_series (
    time            TIMESTAMPTZ NOT NULL,
    asset_id         UUID REFERENCES eo_assets(asset_id) ON DELETE CASCADE,
    indicator_name    VARCHAR(120) NOT NULL,
    value             DECIMAL(14, 4),
    unit              VARCHAR(50),
    source            VARCHAR(120),
    confidence        VARCHAR(10) DEFAULT 'LOW' CHECK (confidence IN ('HIGH','MEDIUM','LOW')),
    is_demo            BOOLEAN NOT NULL DEFAULT TRUE
);

SELECT create_hypertable('eo_time_series', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_eo_ts_asset_indicator ON eo_time_series(asset_id, indicator_name, time DESC);

-- ============================================================
-- PROCESSING JOBS  (spec §11 pipeline tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS eo_processing_jobs (
    job_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requested_by      UUID,
    asset_id           UUID REFERENCES eo_assets(asset_id) ON DELETE CASCADE,
    indicator_name     VARCHAR(120),
    source_id          UUID REFERENCES data_sources(source_id),
    status              VARCHAR(20) NOT NULL DEFAULT 'queued',  -- queued|running|completed|failed
    error                TEXT,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    completed_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_eo_jobs_status ON eo_processing_jobs(status, created_at DESC);

-- ============================================================
-- API USAGE  (spec §10/§25/§27/§29 — caching, rate-limit, quality dashboard)
-- ============================================================

CREATE TABLE IF NOT EXISTS api_usage (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id          UUID REFERENCES data_sources(source_id),
    endpoint            VARCHAR(255),
    called_at           TIMESTAMPTZ DEFAULT NOW(),
    status_code         INTEGER,
    latency_ms           INTEGER,
    cached               BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_api_usage_source_time ON api_usage(source_id, called_at DESC);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO climactix;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO climactix;
