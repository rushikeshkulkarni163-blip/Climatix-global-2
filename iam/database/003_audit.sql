-- ============================================================
-- Climactix Global — Audit & Security Event Log v1.0
-- Immutable audit trail for compliance and forensics
-- ============================================================

-- ============================================================
-- AUDIT LOGS (append-only, never UPDATE or DELETE)
-- ============================================================

CREATE TABLE audit_logs (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id        VARCHAR(32)     NOT NULL UNIQUE,                    -- CX-AUD-000001 (sequential)
    event_type      VARCHAR(100)    NOT NULL,                           -- user.login, assessment.submit, role.assign...
    category        VARCHAR(50)     NOT NULL,                           -- auth, access, data, admin, security
    severity        audit_severity  NOT NULL DEFAULT 'info',
    actor_id        UUID            REFERENCES users(id) ON DELETE SET NULL,
    actor_email     VARCHAR(255),
    actor_role      VARCHAR(100),
    target_type     VARCHAR(100),                                        -- user, organization, assessment, report...
    target_id       VARCHAR(255),
    organization_id UUID            REFERENCES organizations(id) ON DELETE SET NULL,
    session_id      UUID,
    ip_address      INET,
    user_agent      TEXT,
    geo_country     VARCHAR(100),
    geo_city        VARCHAR(100),
    action          VARCHAR(200)    NOT NULL,
    resource_path   TEXT,
    http_method     VARCHAR(10),
    http_status     SMALLINT,
    request_id      VARCHAR(64),
    outcome         VARCHAR(20)     NOT NULL DEFAULT 'success',         -- success / failure / denied
    failure_reason  TEXT,
    before_state    JSONB,
    after_state     JSONB,
    metadata        JSONB           NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Audit logs are append-only: prevent modifications
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Partial indexes for common query patterns
CREATE INDEX idx_audit_actor     ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_org       ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_type      ON audit_logs(event_type, created_at DESC);
CREATE INDEX idx_audit_severity  ON audit_logs(severity, created_at DESC);
CREATE INDEX idx_audit_outcome   ON audit_logs(outcome, created_at DESC);
CREATE INDEX idx_audit_created   ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_ip        ON audit_logs(ip_address);
CREATE INDEX idx_audit_session   ON audit_logs(session_id);

-- Full-text search on audit actions
CREATE INDEX idx_audit_fts ON audit_logs USING GIN (
    to_tsvector('english', coalesce(event_type, '') || ' ' || coalesce(action, '') || ' ' || coalesce(failure_reason, ''))
);

-- TimescaleDB hypertable (if TimescaleDB is installed)
-- SELECT create_hypertable('audit_logs', 'created_at', if_not_exists => TRUE);

-- ============================================================
-- SECURITY EVENTS (high-signal, real-time alerting)
-- ============================================================

CREATE TABLE security_events (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_log_id    UUID        REFERENCES audit_logs(id),
    event_class     VARCHAR(100) NOT NULL,                              -- brute_force, credential_stuffing, anomalous_location...
    risk_score      SMALLINT    NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
    user_id         UUID        REFERENCES users(id) ON DELETE SET NULL,
    organization_id UUID        REFERENCES organizations(id) ON DELETE SET NULL,
    ip_address      INET,
    details         JSONB       NOT NULL DEFAULT '{}',
    is_resolved     BOOLEAN     NOT NULL DEFAULT FALSE,
    resolved_by     UUID        REFERENCES users(id),
    resolved_at     TIMESTAMPTZ,
    resolution_note TEXT,
    notified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sec_events_user    ON security_events(user_id, created_at DESC);
CREATE INDEX idx_sec_events_org     ON security_events(organization_id, created_at DESC);
CREATE INDEX idx_sec_events_class   ON security_events(event_class, created_at DESC);
CREATE INDEX idx_sec_events_risk    ON security_events(risk_score DESC);
CREATE INDEX idx_sec_events_open    ON security_events(is_resolved) WHERE NOT is_resolved;

-- ============================================================
-- LOGIN ATTEMPTS (rate limiting & brute force detection)
-- ============================================================

CREATE TABLE login_attempts (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           CITEXT      NOT NULL,
    ip_address      INET        NOT NULL,
    user_agent      TEXT,
    outcome         VARCHAR(20) NOT NULL,                               -- success / invalid_password / user_not_found / locked / mfa_failed
    user_id         UUID        REFERENCES users(id) ON DELETE SET NULL,
    organization_id UUID        REFERENCES organizations(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_email   ON login_attempts(email, created_at DESC);
CREATE INDEX idx_login_ip      ON login_attempts(ip_address, created_at DESC);
CREATE INDEX idx_login_created ON login_attempts(created_at DESC);

-- Retention: auto-delete login_attempts older than 90 days
CREATE OR REPLACE FUNCTION purge_old_login_attempts() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM login_attempts WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- ============================================================
-- AUDIT LOG SEQUENCE (for human-readable event IDs)
-- ============================================================

CREATE SEQUENCE audit_event_seq START 1 INCREMENT 1 NO CYCLE;

CREATE OR REPLACE FUNCTION next_audit_id() RETURNS VARCHAR(32) LANGUAGE plpgsql AS $$
BEGIN
    RETURN 'CX-AUD-' || LPAD(nextval('audit_event_seq')::TEXT, 9, '0');
END;
$$;

-- Trigger: auto-generate event_id
CREATE OR REPLACE FUNCTION set_audit_event_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.event_id IS NULL OR NEW.event_id = '' THEN
        NEW.event_id = next_audit_id();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_event_id
    BEFORE INSERT ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION set_audit_event_id();

-- ============================================================
-- GDPR / COMPLIANCE: DATA REQUESTS
-- ============================================================

CREATE TABLE data_requests (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID        NOT NULL REFERENCES users(id),
    organization_id UUID        REFERENCES organizations(id),
    type            VARCHAR(50) NOT NULL,                               -- export / delete / rectify
    status          VARCHAR(50) NOT NULL DEFAULT 'pending',             -- pending / processing / completed / rejected
    requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    processed_by    UUID        REFERENCES users(id),
    download_url    TEXT,
    download_expires_at TIMESTAMPTZ,
    rejection_reason TEXT,
    notes           TEXT
);

CREATE INDEX idx_dr_user ON data_requests(user_id);
CREATE INDEX idx_dr_status ON data_requests(status);
