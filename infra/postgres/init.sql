-- ============================================================
-- Climactix Global — PostgreSQL Database Schema
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "timescaledb";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ── Companies ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    ticker VARCHAR(20),
    sector VARCHAR(100),
    sub_sector VARCHAR(100),
    country_code CHAR(3),
    revenue_usd_m DECIMAL(18, 2),
    employees INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── ESG Scores ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS esg_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    assessment_date DATE NOT NULL,
    environmental DECIMAL(5, 2),
    social DECIMAL(5, 2),
    governance DECIMAL(5, 2),
    overall DECIMAL(5, 2),
    esg_rating VARCHAR(5),
    disclosure_quality DECIMAL(5, 2),
    sdg_alignment DECIMAL(5, 2),
    framework VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Physical Risk Assessments ─────────────────────────────────
CREATE TABLE IF NOT EXISTS physical_risk_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id),
    asset_name VARCHAR(255),
    lat DECIMAL(10, 7),
    lng DECIMAL(10, 7),
    scenario VARCHAR(10),
    horizon INTEGER,
    overall_risk DECIMAL(5, 2),
    flood_risk DECIMAL(5, 2),
    heat_stress_acute DECIMAL(5, 2),
    heat_stress_chronic DECIMAL(5, 2),
    wildfire_risk DECIMAL(5, 2),
    sea_level_exposure DECIMAL(5, 2),
    storm_intensity DECIMAL(5, 2),
    water_stress DECIMAL(5, 2),
    risk_rating VARCHAR(10),
    confidence DECIMAL(4, 3),
    assessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Transition Risk Assessments ───────────────────────────────
CREATE TABLE IF NOT EXISTS transition_risk_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id),
    scenario VARCHAR(10),
    horizon INTEGER,
    overall_risk DECIMAL(5, 2),
    policy_risk DECIMAL(5, 2),
    technology_risk DECIMAL(5, 2),
    market_risk DECIMAL(5, 2),
    reputation_risk DECIMAL(5, 2),
    stranded_asset_prob DECIMAL(5, 2),
    carbon_cost_2030 DECIMAL(18, 2),
    carbon_cost_2050 DECIMAL(18, 2),
    revenue_at_risk_pct DECIMAL(5, 2),
    ebitda_impact_pct DECIMAL(5, 2),
    risk_rating VARCHAR(10),
    assessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Emissions (TimescaleDB hypertable) ────────────────────────
CREATE TABLE IF NOT EXISTS emissions (
    time TIMESTAMPTZ NOT NULL,
    company_id UUID REFERENCES companies(id),
    scope INTEGER CHECK (scope IN (1, 2, 3)),
    category VARCHAR(100),
    emissions_tco2e DECIMAL(18, 2),
    unit VARCHAR(20) DEFAULT 'tCO2e',
    verification_level VARCHAR(20) DEFAULT 'unverified',
    source VARCHAR(100)
);

SELECT create_hypertable('emissions', 'time', if_not_exists => TRUE);

-- ── Climate Signals (TimescaleDB) ─────────────────────────────
CREATE TABLE IF NOT EXISTS climate_signals (
    time TIMESTAMPTZ NOT NULL,
    signal_type VARCHAR(50),
    region VARCHAR(100),
    value DECIMAL(18, 4),
    unit VARCHAR(50),
    source VARCHAR(100),
    confidence DECIMAL(4, 3)
);

SELECT create_hypertable('climate_signals', 'time', if_not_exists => TRUE);

-- ── ESG News & Sentiment ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS esg_news (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id),
    headline TEXT,
    summary TEXT,
    source VARCHAR(100),
    sentiment_score DECIMAL(5, 3),
    sentiment_label VARCHAR(20),
    tags TEXT[],
    published_at TIMESTAMPTZ,
    ingested_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Disclosures ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS disclosures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id),
    framework VARCHAR(50),
    fiscal_year INTEGER,
    report_url TEXT,
    quality_score DECIMAL(5, 2),
    greenwash_risk VARCHAR(10),
    greenwash_score INTEGER,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'draft'
);

-- ── Supply Chain Vendors ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS supply_chain_vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    buyer_company_id UUID REFERENCES companies(id),
    supplier_name VARCHAR(255),
    country_code CHAR(3),
    tier INTEGER DEFAULT 1,
    annual_spend_usd_m DECIMAL(12, 2),
    scope1_emissions_t DECIMAL(18, 2),
    climate_risk_score DECIMAL(5, 2),
    risk_rating VARCHAR(10),
    verified BOOLEAN DEFAULT FALSE,
    sbti_committed BOOLEAN DEFAULT FALSE,
    last_assessed TIMESTAMPTZ DEFAULT NOW()
);

-- ── API Keys (Enterprise) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100),
    org_name VARCHAR(255),
    plan VARCHAR(50) DEFAULT 'enterprise',
    rate_limit_per_min INTEGER DEFAULT 1000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    active BOOLEAN DEFAULT TRUE
);

-- ── Audit Log ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    action VARCHAR(100),
    resource_type VARCHAR(50),
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indices ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_esg_scores_company ON esg_scores(company_id, assessment_date);
CREATE INDEX IF NOT EXISTS idx_physical_risk_company ON physical_risk_assessments(company_id, scenario);
CREATE INDEX IF NOT EXISTS idx_emissions_company_scope ON emissions(company_id, scope, time DESC);
CREATE INDEX IF NOT EXISTS idx_esg_news_company ON esg_news(company_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id, created_at DESC);

-- ── Continuous Aggregates (TimescaleDB) ───────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_emissions
    WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 month', time) AS month,
    company_id,
    scope,
    SUM(emissions_tco2e) AS total_emissions
FROM emissions
GROUP BY month, company_id, scope
WITH NO DATA;

-- ── Default data ──────────────────────────────────────────────
INSERT INTO companies (name, ticker, sector, country_code, revenue_usd_m, employees) VALUES
    ('Demo Corp', 'DEMO', 'Manufacturing', 'USA', 5000.00, 12000),
    ('GreenEnergy AS', 'GREN', 'Utilities', 'NOR', 2200.00, 4500),
    ('TechSustain Inc', 'TCHS', 'Technology', 'USA', 8400.00, 28000)
ON CONFLICT DO NOTHING;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO climactix;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO climactix;
