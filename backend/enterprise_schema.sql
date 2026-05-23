-- ============================================================
-- Climactix Enterprise — PostgreSQL Database Schema v1.0
-- Multi-tenant institutional climate intelligence platform
-- ============================================================

-- ── Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- TENANT ISOLATION
-- ============================================================

CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    tier            VARCHAR(50)  NOT NULL DEFAULT 'enterprise', -- enterprise / institutional / regulator
    status          VARCHAR(50)  NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

-- ============================================================
-- COMPANY ENTITIES
-- ============================================================

CREATE TABLE companies (
    id              VARCHAR(32)  PRIMARY KEY,               -- CX-IND-LOG-000847
    tenant_id       UUID         REFERENCES tenants(id),
    name            VARCHAR(255) NOT NULL,
    legal_name      VARCHAR(255),
    industry_key    VARCHAR(50)  NOT NULL,                  -- banking / manufacturing / logistics / ...
    industry_label  VARCHAR(255),
    industry_code   VARCHAR(10),                            -- BNK / MFG / LOG / ...
    country         VARCHAR(100) NOT NULL,
    country_code    VARCHAR(3)   NOT NULL,                  -- ISO Alpha-3
    sector          VARCHAR(150),
    employee_count  VARCHAR(50),
    revenue_amount  NUMERIC(18,2),
    revenue_unit    VARCHAR(20),
    risk_tier       VARCHAR(100),
    risk_color      VARCHAR(10),
    assessment_type VARCHAR(255),
    status          VARCHAR(50)  NOT NULL DEFAULT 'active',
    current_score   INTEGER,
    current_rating  VARCHAR(20),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ,
    metadata        JSONB
);

CREATE INDEX idx_companies_industry ON companies(industry_key);
CREATE INDEX idx_companies_country  ON companies(country_code);
CREATE INDEX idx_companies_tenant   ON companies(tenant_id);
CREATE INDEX idx_companies_rating   ON companies(current_rating);

-- ============================================================
-- USERS & AUTHENTICATION
-- ============================================================

CREATE TABLE users (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   TEXT         NOT NULL,
    name            VARCHAR(255),
    phone           VARCHAR(50),
    mfa_enabled     BOOLEAN     NOT NULL DEFAULT FALSE,
    mfa_secret      TEXT,                                   -- TOTP secret (encrypted)
    status          VARCHAR(50) NOT NULL DEFAULT 'active',  -- active / suspended / pending
    email_verified  BOOLEAN     NOT NULL DEFAULT FALSE,
    last_login      TIMESTAMPTZ,
    failed_attempts INTEGER     NOT NULL DEFAULT 0,
    locked_until    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ,
    metadata        JSONB
);

CREATE INDEX idx_users_email  ON users(email);
CREATE INDEX idx_users_status ON users(status);

-- ============================================================
-- REPRESENTATIVES (CX-REP IDs)
-- ============================================================

CREATE TABLE representatives (
    id                  VARCHAR(32)  PRIMARY KEY,            -- CX-REP-IND-0009421
    user_id             UUID         REFERENCES users(id),
    company_id          VARCHAR(32)  REFERENCES companies(id),
    name                VARCHAR(255) NOT NULL,
    email               VARCHAR(255) NOT NULL,
    designation         VARCHAR(255),
    department          VARCHAR(255),
    role                VARCHAR(100) NOT NULL DEFAULT 'sustainability_officer',
    authority_level     VARCHAR(50)  NOT NULL DEFAULT 'standard',
    approval_authority  BOOLEAN      NOT NULL DEFAULT FALSE,
    status              VARCHAR(50)  NOT NULL DEFAULT 'active',
    last_active         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ,
    metadata            JSONB
);

CREATE INDEX idx_reps_user    ON representatives(user_id);
CREATE INDEX idx_reps_company ON representatives(company_id);
CREATE INDEX idx_reps_role    ON representatives(role);

-- ============================================================
-- RBAC: PERMISSIONS & ROLE DEFINITIONS
-- ============================================================

CREATE TABLE role_definitions (
    id              SERIAL       PRIMARY KEY,
    role_key        VARCHAR(100) NOT NULL UNIQUE,            -- sustainability_officer / risk_officer / ...
    label           VARCHAR(255) NOT NULL,
    description     TEXT,
    permissions     TEXT[]       NOT NULL DEFAULT '{}',
    badge_color     VARCHAR(10),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE representative_permissions (
    id              SERIAL      PRIMARY KEY,
    rep_id          VARCHAR(32) REFERENCES representatives(id),
    permission      VARCHAR(100) NOT NULL,
    granted_by      UUID        REFERENCES users(id),
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ
);

CREATE INDEX idx_rep_perms_rep ON representative_permissions(rep_id);

-- ============================================================
-- SESSIONS & AUTH TOKENS
-- ============================================================

CREATE TABLE sessions (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID         NOT NULL REFERENCES users(id),
    rep_id          VARCHAR(32)  REFERENCES representatives(id),
    company_id      VARCHAR(32)  REFERENCES companies(id),
    role            VARCHAR(100),
    token_hash      TEXT         NOT NULL UNIQUE,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ  NOT NULL,
    revoked_at      TIMESTAMPTZ,
    last_used       TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user    ON sessions(user_id);
CREATE INDEX idx_sessions_token   ON sessions(token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

CREATE TABLE otp_tokens (
    id          SERIAL      PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES users(id),
    token_hash  TEXT        NOT NULL,
    purpose     VARCHAR(50) NOT NULL DEFAULT 'login',       -- login / password_reset / email_verify
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_otp_user    ON otp_tokens(user_id);
CREATE INDEX idx_otp_expires ON otp_tokens(expires_at);

-- ============================================================
-- ASSESSMENTS
-- ============================================================

CREATE TABLE assessments (
    id              VARCHAR(32)  PRIMARY KEY,               -- CX-ASS-1234567890
    company_id      VARCHAR(32)  NOT NULL REFERENCES companies(id),
    rep_id          VARCHAR(32)  REFERENCES representatives(id),
    industry_key    VARCHAR(50)  NOT NULL,
    year            INTEGER      NOT NULL,
    version         INTEGER      NOT NULL DEFAULT 1,
    status          VARCHAR(50)  NOT NULL DEFAULT 'in_progress', -- in_progress / submitted / under_review / approved / rejected
    overall_score   INTEGER,                                -- 10–100 C-SCORE
    rating          VARCHAR(20),                            -- AAA-C / AA-C / A-C / BBB-C / BB-C / B-C / CCC-C
    submitted_at    TIMESTAMPTZ,
    approved_at     TIMESTAMPTZ,
    approved_by     UUID         REFERENCES users(id),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ,
    metadata        JSONB
);

CREATE INDEX idx_asm_company ON assessments(company_id);
CREATE INDEX idx_asm_status  ON assessments(status);
CREATE INDEX idx_asm_year    ON assessments(year);
CREATE INDEX idx_asm_rating  ON assessments(rating);

-- ============================================================
-- ASSESSMENT ANSWERS
-- ============================================================

CREATE TABLE assessment_answers (
    id              SERIAL      PRIMARY KEY,
    assessment_id   VARCHAR(32) NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    question_id     VARCHAR(50) NOT NULL,                   -- e.g. CX-G01, BNK-F01
    section_name    VARCHAR(255),
    clayer          VARCHAR(20),                            -- c_core / c_fin / c_risk_p / ...
    question_type   VARCHAR(50),                            -- yesno / dropdown / number / text / upload
    raw_answer      TEXT,
    scored_value    NUMERIC(6,2),                           -- 0–100 raw answer value
    ai_score        INTEGER,                                -- AI analysis score for text answers
    ai_maturity     VARCHAR(100),                           -- Institutional Grade / Operational Integration / ...
    ai_indicators   TEXT[],
    word_count      INTEGER,
    answered_by     VARCHAR(32) REFERENCES representatives(id),
    answered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

CREATE INDEX idx_answers_assessment ON assessment_answers(assessment_id);
CREATE INDEX idx_answers_question   ON assessment_answers(question_id);
CREATE INDEX idx_answers_clayer     ON assessment_answers(clayer);
CREATE UNIQUE INDEX uq_answers ON assessment_answers(assessment_id, question_id);

-- ============================================================
-- C-LAYER SCORES
-- ============================================================

CREATE TABLE clayer_scores (
    id              SERIAL      PRIMARY KEY,
    assessment_id   VARCHAR(32) NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    clayer_id       VARCHAR(20) NOT NULL,                   -- c_core / c_fin / c_risk_p / ...
    clayer_label    VARCHAR(20),
    weight          INTEGER,                                -- 10 / 15 / 20 / ...
    raw_score       NUMERIC(6,2),                           -- average raw answer value
    climactix_score INTEGER,                                -- 10–100 (toClimactixScale)
    questions_total INTEGER,
    questions_answered INTEGER,
    calculated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clayer_scores_asm ON clayer_scores(assessment_id);
CREATE UNIQUE INDEX uq_clayer_scores ON clayer_scores(assessment_id, clayer_id);

-- ============================================================
-- EVIDENCE / DOCUMENT VAULT
-- ============================================================

CREATE TABLE evidence_documents (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      VARCHAR(32)  NOT NULL REFERENCES companies(id),
    assessment_id   VARCHAR(32)  REFERENCES assessments(id),
    question_id     VARCHAR(50),
    rep_id          VARCHAR(32)  REFERENCES representatives(id),
    filename        VARCHAR(500) NOT NULL,
    original_name   VARCHAR(500),
    file_type       VARCHAR(50),
    file_size_bytes BIGINT,
    storage_path    TEXT,
    sha256_hash     TEXT,                                   -- document integrity fingerprint
    document_type   VARCHAR(100),                           -- ghg_report / tcfd_disclosure / sustainability_report / ...
    description     TEXT,
    year_reference  INTEGER,
    status          VARCHAR(50)  NOT NULL DEFAULT 'uploaded', -- uploaded / verified / rejected
    verified_by     UUID         REFERENCES users(id),
    verified_at     TIMESTAMPTZ,
    is_public       BOOLEAN      NOT NULL DEFAULT FALSE,    -- investor/regulator visibility
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    metadata        JSONB
);

CREATE INDEX idx_evidence_company    ON evidence_documents(company_id);
CREATE INDEX idx_evidence_assessment ON evidence_documents(assessment_id);
CREATE INDEX idx_evidence_question   ON evidence_documents(question_id);

-- ============================================================
-- AI ANALYSIS RESULTS
-- ============================================================

CREATE TABLE ai_analysis (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id   VARCHAR(32)  NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    question_id     VARCHAR(50),
    analysis_type   VARCHAR(100) NOT NULL,                  -- text_analysis / contradiction_check / greenwashing_scan / disclosure_quality
    input_text      TEXT,
    output_score    NUMERIC(6,2),
    output_maturity VARCHAR(100),
    output_summary  TEXT,
    indicators      TEXT[],
    contradictions  JSONB,                                  -- [{field1, field2, description}]
    greenwashing_probability NUMERIC(5,2),                  -- 0–100%
    model_version   VARCHAR(50),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_analysis_asm ON ai_analysis(assessment_id);
CREATE INDEX idx_ai_analysis_type ON ai_analysis(analysis_type);

-- ============================================================
-- REVIEWER COMMENTS & WORKFLOW
-- ============================================================

CREATE TABLE reviewer_comments (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id   VARCHAR(32)  NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    question_id     VARCHAR(50),
    reviewer_id     UUID         NOT NULL REFERENCES users(id),
    reviewer_role   VARCHAR(100),
    comment_text    TEXT         NOT NULL,
    action_required BOOLEAN      NOT NULL DEFAULT FALSE,
    status          VARCHAR(50)  NOT NULL DEFAULT 'open',   -- open / addressed / closed
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

CREATE INDEX idx_comments_assessment ON reviewer_comments(assessment_id);

-- ============================================================
-- AUDIT LOGS
-- ============================================================

CREATE TABLE audit_logs (
    id              BIGSERIAL   PRIMARY KEY,
    event_type      VARCHAR(100) NOT NULL,                  -- LOGIN / LOGOUT / ASSESSMENT_STARTED / COMPANY_CREATED / ...
    entity_id       VARCHAR(100),                           -- company_id / rep_id / assessment_id / user_id
    entity_type     VARCHAR(50),                            -- company / rep / assessment / user
    actor_user_id   UUID        REFERENCES users(id),
    actor_rep_id    VARCHAR(32) REFERENCES representatives(id),
    session_id      UUID        REFERENCES sessions(id),
    ip_address      INET,
    user_agent      TEXT,
    event_data      JSONB,                                  -- {name, changes, before, after}
    severity        VARCHAR(20) NOT NULL DEFAULT 'info',    -- info / warning / critical
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_entity     ON audit_logs(entity_id);
CREATE INDEX idx_audit_actor      ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_created    ON audit_logs(created_at DESC);

-- ============================================================
-- FRAMEWORK MAPPING
-- ============================================================

CREATE TABLE framework_mappings (
    id              SERIAL       PRIMARY KEY,
    assessment_id   VARCHAR(32)  NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    framework_code  VARCHAR(50)  NOT NULL,                  -- TCFD / SFDR / CSRD / GHG-P / SBTi / PCAF / ISSB
    framework_label VARCHAR(255),
    compliance_status VARCHAR(50) NOT NULL,                 -- aligned / partial / missing / n/a
    coverage_score  INTEGER,                                -- 0–100
    key_gaps        TEXT[],
    calculated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_framework_asm ON framework_mappings(assessment_id);
CREATE UNIQUE INDEX uq_framework ON framework_mappings(assessment_id, framework_code);

-- ============================================================
-- INVESTOR & REGULATOR ACCESS PORTAL
-- ============================================================

CREATE TABLE access_grants (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id      VARCHAR(32)  NOT NULL REFERENCES companies(id),
    granted_to_user UUID         NOT NULL REFERENCES users(id),
    granted_by_user UUID         NOT NULL REFERENCES users(id),
    access_role     VARCHAR(100) NOT NULL,                  -- investor_access / regulator_access / external_auditor
    scope           TEXT[],                                 -- [scores, evidence, analysis, full]
    starts_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    status          VARCHAR(50)  NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_access_company ON access_grants(company_id);
CREATE INDEX idx_access_user    ON access_grants(granted_to_user);

-- ============================================================
-- INDUSTRY QUESTION BANK (versioned)
-- ============================================================

CREATE TABLE question_bank (
    id              SERIAL       PRIMARY KEY,
    question_id     VARCHAR(50)  NOT NULL,                  -- CX-G01 / BNK-F01 / MFG-E01
    version         INTEGER      NOT NULL DEFAULT 1,
    industry_key    VARCHAR(50),                            -- NULL = core question
    section_name    VARCHAR(255) NOT NULL,
    clayer          VARCHAR(20)  NOT NULL,
    question_type   VARCHAR(50)  NOT NULL,                  -- yesno / dropdown / number / text / upload / select5
    label           TEXT         NOT NULL,
    sublabel        TEXT,
    is_critical     BOOLEAN      NOT NULL DEFAULT FALSE,
    options         JSONB,                                  -- [{label, score}] for dropdown
    unit            VARCHAR(50),                            -- % / tCO₂e / USD M / ...
    min_words       INTEGER,
    weight          NUMERIC(5,2),
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(question_id, version)
);

CREATE INDEX idx_qbank_industry ON question_bank(industry_key);
CREATE INDEX idx_qbank_clayer   ON question_bank(clayer);

-- ============================================================
-- ASSESSMENT HISTORY (VERSION CONTROL)
-- ============================================================

CREATE TABLE assessment_versions (
    id              SERIAL       PRIMARY KEY,
    assessment_id   VARCHAR(32)  NOT NULL REFERENCES assessments(id),
    version         INTEGER      NOT NULL,
    overall_score   INTEGER,
    rating          VARCHAR(20),
    answers_snapshot JSONB,
    scores_snapshot  JSONB,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by      UUID         REFERENCES users(id)
);

CREATE INDEX idx_asm_ver_assessment ON assessment_versions(assessment_id);

-- ============================================================
-- SEED: ROLE DEFINITIONS
-- ============================================================

INSERT INTO role_definitions (role_key, label, description, permissions, badge_color) VALUES
('super_admin',          'Super Admin',              'Full platform access — Climactix internal only',
  ARRAY['read_all','write_all','delete_all','manage_users','manage_companies','view_audit','export_all','manage_frameworks','approve_assessments','override_scores'], '#FF3333'),
('climactix_analyst',    'Climactix Analyst',        'Internal analyst — review all company assessments',
  ARRAY['read_all','write_analysis','view_evidence','export_reports','view_audit','approve_assessments'], '#FF6600'),
('company_admin',        'Company Admin',            'Full access within company tenant',
  ARRAY['read_company','write_company','manage_reps','view_evidence','export_company','submit_assessment','view_scores'], '#0099CC'),
('sustainability_officer','Sustainability Officer',  'Lead assessment completion and ESG disclosure',
  ARRAY['read_company','write_assessment','upload_evidence','view_scores','export_reports','view_analysis'], '#00CC44'),
('risk_officer',         'Risk Officer',             'Physical and transition risk modules',
  ARRAY['read_company','write_risk_sections','view_scores','view_evidence','view_analysis'], '#FF6600'),
('finance_officer',      'Finance Officer',          'Financial materiality and carbon liability',
  ARRAY['read_company','write_finance_sections','view_scores','export_financial'], '#FFB800'),
('board_reviewer',       'Board Reviewer',           'Read-only executive dashboard and reports',
  ARRAY['read_company','view_scores','export_reports','view_summary','view_analysis'], '#888888'),
('external_auditor',     'External Auditor',         'Evidence review and audit trail access',
  ARRAY['view_evidence','view_audit','read_company','export_audit','sign_evidence'], '#888888'),
('investor_access',      'Investor Access',          'Institutional investor portal — read-only',
  ARRAY['view_scores','view_summary','export_investor_report','view_analysis'], '#3399FF'),
('regulator_access',     'Regulator Access',         'Full disclosure access for regulatory review',
  ARRAY['read_company','view_evidence','view_audit','view_scores','export_regulatory','request_documents'], '#FF3333'),
('read_only',            'Read-Only Stakeholder',    'Minimal read access — summary and scores only',
  ARRAY['view_summary','view_scores'], '#555555');

-- ============================================================
-- SEED: ID COUNTER SEQUENCE
-- ============================================================

CREATE SEQUENCE company_id_seq START WITH 848;
CREATE SEQUENCE rep_id_seq     START WITH 9422;
CREATE SEQUENCE user_id_seq    START WITH 1204;

-- ============================================================
-- VIEWS
-- ============================================================

-- Company intelligence summary
CREATE VIEW company_intelligence AS
SELECT
    c.id                AS entity_id,
    c.name              AS company_name,
    c.industry_label,
    c.country,
    c.risk_tier,
    c.current_score     AS c_score,
    c.current_rating    AS climate_rating,
    COUNT(DISTINCT a.id) AS total_assessments,
    COUNT(DISTINCT CASE WHEN a.status='submitted' THEN a.id END) AS completed_assessments,
    COUNT(DISTINCT r.id) AS total_representatives,
    COUNT(DISTINCT e.id) AS total_evidence_docs,
    MAX(a.submitted_at)  AS last_assessment_date
FROM companies c
LEFT JOIN assessments a ON a.company_id = c.id
LEFT JOIN representatives r ON r.company_id = c.id
LEFT JOIN evidence_documents e ON e.company_id = c.id
GROUP BY c.id, c.name, c.industry_label, c.country, c.risk_tier, c.current_score, c.current_rating;

-- Assessment progress summary
CREATE VIEW assessment_progress AS
SELECT
    a.id               AS assessment_id,
    a.company_id,
    a.year,
    a.status,
    a.overall_score,
    a.rating,
    COUNT(aa.id)                              AS questions_answered,
    COUNT(CASE WHEN aa.scored_value IS NOT NULL THEN 1 END) AS questions_scored,
    AVG(aa.scored_value)                      AS avg_raw_score,
    SUM(CASE WHEN aa.question_type='text' THEN aa.ai_score ELSE NULL END) AS total_ai_score
FROM assessments a
LEFT JOIN assessment_answers aa ON aa.assessment_id = a.id
GROUP BY a.id, a.company_id, a.year, a.status, a.overall_score, a.rating;

-- Climate leaderboard
CREATE VIEW climate_leaderboard AS
SELECT
    c.id            AS entity_id,
    c.name          AS company_name,
    c.industry_label,
    c.country,
    c.current_score AS c_score,
    c.current_rating AS rating,
    c.risk_tier,
    RANK() OVER (ORDER BY c.current_score DESC NULLS LAST) AS global_rank,
    RANK() OVER (PARTITION BY c.industry_key ORDER BY c.current_score DESC NULLS LAST) AS industry_rank
FROM companies c
WHERE c.status = 'active' AND c.current_score IS NOT NULL;

-- ============================================================
-- SECURITY: ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE companies                ENABLE ROW LEVEL SECURITY;
ALTER TABLE representatives          ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_answers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs               ENABLE ROW LEVEL SECURITY;

-- Company isolation policy (each rep can only see their own company's data)
CREATE POLICY company_isolation ON companies
    USING (id = current_setting('app.company_id', true)::VARCHAR
           OR current_setting('app.role', true) IN ('super_admin','climactix_analyst'));

CREATE POLICY company_assessments_isolation ON assessments
    USING (company_id = current_setting('app.company_id', true)::VARCHAR
           OR current_setting('app.role', true) IN ('super_admin','climactix_analyst','investor_access','regulator_access'));

-- ============================================================
-- API FUNCTION: Score Assessment
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_assessment_score(p_assessment_id VARCHAR)
RETURNS TABLE(clayer_id VARCHAR, score INTEGER, weight INTEGER, weighted_score NUMERIC) AS $$
BEGIN
    RETURN QUERY
    WITH layer_scores AS (
        SELECT
            aa.clayer,
            AVG(aa.scored_value) AS raw_avg,
            COUNT(aa.id) AS total_answered
        FROM assessment_answers aa
        WHERE aa.assessment_id = p_assessment_id
          AND aa.scored_value IS NOT NULL
        GROUP BY aa.clayer
    ),
    clayer_defs(cl_id, cl_weight) AS (VALUES
        ('c_core',10),('c_fin',20),('c_risk_p',15),('c_risk_t',15),
        ('c_capital',10),('c_supply',10),('c_adapt',10),('c_truth',10)
    )
    SELECT
        cd.cl_id::VARCHAR,
        GREATEST(10, LEAST(100, ROUND(10 + (ls.raw_avg / 100.0 * 90))))::INTEGER,
        cd.cl_weight,
        GREATEST(10, LEAST(100, ROUND(10 + (ls.raw_avg / 100.0 * 90)))) * cd.cl_weight / 100.0
    FROM clayer_defs cd
    LEFT JOIN layer_scores ls ON ls.clayer = cd.cl_id
    WHERE ls.raw_avg IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- END OF SCHEMA
-- ============================================================
