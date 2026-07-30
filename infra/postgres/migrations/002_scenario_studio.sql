-- ============================================================
-- Climactix Global — Scenario Studio schema extension
-- Adds first-class asset/scenario/supply-chain/run entities on
-- top of the existing `companies` table (init.sql). Column and
-- naming conventions follow physical_risk_assessments /
-- transition_risk_assessments in init.sql.
-- ============================================================

-- ── Scenario Studio Assets ─────────────────────────────────────
-- One row per physical asset (factory, port, mine, data center, ...)
-- belonging to a company. Mirrors src/types/simulation.ts SimAsset
-- plus the financial/operational fields from AssetFinancialProfile.
CREATE TABLE IF NOT EXISTS scenario_studio_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(30) NOT NULL,               -- factory|office|warehouse|port|data-center|supply-node|mine|farm
    lat DECIMAL(10, 7) NOT NULL,
    lng DECIMAL(10, 7) NOT NULL,
    country VARCHAR(100),
    region VARCHAR(100),
    sector VARCHAR(50),
    revenue_usd_m DECIMAL(18, 2),
    employees INTEGER,
    capex_usd_m DECIMAL(18, 2),
    scope1_tco2e DECIMAL(18, 2),
    scope2_tco2e DECIMAL(18, 2),
    revenue_contribution_pct DECIMAL(5, 2),
    replacement_value_usd_m DECIMAL(18, 2),
    insurance_value_usd_m DECIMAL(18, 2),
    business_criticality VARCHAR(10) DEFAULT 'medium',   -- low|medium|high|critical
    energy_source VARCHAR(20) DEFAULT 'grid-mixed',      -- grid-fossil|grid-mixed|grid-renewable|on-site-renewable|diesel-backup
    water_dependency VARCHAR(10) DEFAULT 'medium',       -- low|medium|high
    is_sample BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Supply Chain Edges ──────────────────────────────────────────
-- Directed dependency: source asset feeds target asset.
CREATE TABLE IF NOT EXISTS scenario_studio_supply_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_asset_id UUID REFERENCES scenario_studio_assets(id) ON DELETE CASCADE,
    target_asset_id UUID REFERENCES scenario_studio_assets(id) ON DELETE CASCADE,
    dependency_pct DECIMAL(5, 2) DEFAULT 100.00,
    single_source BOOLEAN DEFAULT FALSE,
    tier INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Scenario Runs ────────────────────────────────────────────────
-- A saved simulation snapshot: company + scenario family + horizon,
-- with the computed portfolio-level output persisted for audit trail
-- and scenario-comparison history (not just recomputed on the fly).
CREATE TABLE IF NOT EXISTS scenario_studio_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    scenario_family VARCHAR(30) NOT NULL,   -- current-policies|ndcs|below-2c|net-zero-2050|delayed-transition|fragmented-world
    horizon_year INTEGER NOT NULL,
    total_revenue_at_risk_usd_m DECIMAL(18, 2),
    total_ebitda_at_risk_usd_m DECIMAL(18, 2),
    total_compliance_cost_usd_m DECIMAL(18, 2),
    climate_var_95_usd_m DECIMAL(18, 2),
    climate_var_99_usd_m DECIMAL(18, 2),
    expected_annual_loss_usd_m DECIMAL(18, 2),
    result_json JSONB,                       -- full ScenarioRunResult snapshot
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Reports ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scenario_studio_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    scenario_run_id UUID REFERENCES scenario_studio_runs(id) ON DELETE SET NULL,
    scenario_family VARCHAR(30),
    horizon_year INTEGER,
    generated_by UUID,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ss_assets_company ON scenario_studio_assets(company_id);
CREATE INDEX IF NOT EXISTS idx_ss_supply_source ON scenario_studio_supply_edges(source_asset_id);
CREATE INDEX IF NOT EXISTS idx_ss_supply_target ON scenario_studio_supply_edges(target_asset_id);
CREATE INDEX IF NOT EXISTS idx_ss_runs_company ON scenario_studio_runs(company_id, scenario_family, horizon_year);
CREATE INDEX IF NOT EXISTS idx_ss_reports_company ON scenario_studio_reports(company_id, generated_at DESC);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO climactix;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO climactix;
