-- ============================================================
-- Climactix Global — IAM Schema v1.0
-- Institutional-grade multi-tenant identity & access management
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE user_status    AS ENUM ('pending_verification', 'active', 'suspended', 'deactivated', 'locked');
CREATE TYPE user_type      AS ENUM ('public', 'community', 'enterprise_client', 'esg_analyst', 'government', 'investor', 'auditor', 'super_admin');
CREATE TYPE org_type       AS ENUM ('enterprise', 'investor', 'government', 'ngo', 'auditor', 'internal');
CREATE TYPE org_status     AS ENUM ('active', 'suspended', 'pending_onboarding', 'trial', 'churned');
CREATE TYPE subscription_tier AS ENUM ('free', 'community', 'enterprise', 'institutional', 'government', 'internal');
CREATE TYPE mfa_method     AS ENUM ('totp', 'sms', 'email', 'hardware_key');
CREATE TYPE sso_provider   AS ENUM ('google', 'microsoft', 'linkedin', 'saml', 'oidc');
CREATE TYPE token_type     AS ENUM ('access', 'refresh', 'email_verification', 'password_reset', 'api_key', 'invite', 'mfa_challenge');
CREATE TYPE audit_severity AS ENUM ('info', 'warning', 'critical', 'alert');
CREATE TYPE invite_status  AS ENUM ('pending', 'accepted', 'expired', 'revoked');

-- ============================================================
-- ORGANIZATIONS (TENANTS)
-- ============================================================

CREATE TABLE organizations (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id           VARCHAR(32)     NOT NULL UNIQUE,                -- CX-ORG-ENT-000001
    name                VARCHAR(255)    NOT NULL,
    display_name        VARCHAR(255),
    type                org_type        NOT NULL DEFAULT 'enterprise',
    status              org_status      NOT NULL DEFAULT 'pending_onboarding',
    subscription_tier   subscription_tier NOT NULL DEFAULT 'trial',
    domain              CITEXT,                                         -- verified domain for SSO
    logo_url            TEXT,
    country             VARCHAR(100),
    industry            VARCHAR(100),
    employee_count_range VARCHAR(50),
    climate_namespace   VARCHAR(100),                                   -- unique climate data namespace
    workspace_slug      VARCHAR(100)    NOT NULL UNIQUE,                -- kebab-case slug
    keycloak_realm      VARCHAR(100),                                   -- Keycloak realm name for enterprise SSO
    sso_enabled         BOOLEAN         NOT NULL DEFAULT FALSE,
    sso_provider        sso_provider,
    sso_metadata_url    TEXT,
    sso_entity_id       TEXT,
    sso_certificate     TEXT,
    max_seats           INTEGER         NOT NULL DEFAULT 5,
    current_seats       INTEGER         NOT NULL DEFAULT 0,
    trial_ends_at       TIMESTAMPTZ,
    subscription_ends_at TIMESTAMPTZ,
    onboarded_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    metadata            JSONB           NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_org_tenant_id     ON organizations(tenant_id);
CREATE INDEX idx_org_domain        ON organizations(domain);
CREATE INDEX idx_org_workspace     ON organizations(workspace_slug);
CREATE INDEX idx_org_status        ON organizations(status);
CREATE INDEX idx_org_type          ON organizations(type);

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    cx_user_id          VARCHAR(32)     NOT NULL UNIQUE,                -- CX-USR-000001
    email               CITEXT          NOT NULL UNIQUE,
    email_normalized    CITEXT          GENERATED ALWAYS AS (lower(trim(email))) STORED,
    password_hash       TEXT,                                           -- NULL for SSO-only users
    first_name          VARCHAR(100),
    last_name           VARCHAR(100),
    display_name        VARCHAR(255),
    avatar_url          TEXT,
    phone               VARCHAR(30),
    phone_verified      BOOLEAN         NOT NULL DEFAULT FALSE,
    user_type           user_type       NOT NULL DEFAULT 'public',
    status              user_status     NOT NULL DEFAULT 'pending_verification',
    email_verified      BOOLEAN         NOT NULL DEFAULT FALSE,
    email_verified_at   TIMESTAMPTZ,
    mfa_enabled         BOOLEAN         NOT NULL DEFAULT FALSE,
    mfa_method          mfa_method,
    mfa_secret_enc      BYTEA,                                          -- AES-256-GCM encrypted TOTP secret
    mfa_backup_codes    TEXT[],                                         -- hashed backup codes
    organization_id     UUID            REFERENCES organizations(id) ON DELETE SET NULL,
    keycloak_id         VARCHAR(255),                                   -- Keycloak user UUID
    failed_attempts     SMALLINT        NOT NULL DEFAULT 0,
    locked_until        TIMESTAMPTZ,
    last_login_at       TIMESTAMPTZ,
    last_login_ip       INET,
    last_login_ua       TEXT,
    password_changed_at TIMESTAMPTZ,
    deactivated_at      TIMESTAMPTZ,
    deactivated_reason  TEXT,
    timezone            VARCHAR(50)     NOT NULL DEFAULT 'UTC',
    locale              VARCHAR(10)     NOT NULL DEFAULT 'en',
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    metadata            JSONB           NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_users_email          ON users(email_normalized);
CREATE INDEX idx_users_cx_id          ON users(cx_user_id);
CREATE INDEX idx_users_org            ON users(organization_id);
CREATE INDEX idx_users_status         ON users(status);
CREATE INDEX idx_users_type           ON users(user_type);
CREATE INDEX idx_users_keycloak       ON users(keycloak_id);
CREATE INDEX idx_users_created        ON users(created_at DESC);

-- Full-text search
CREATE INDEX idx_users_fts ON users USING GIN (
    to_tsvector('english', coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(email::text, ''))
);

-- ============================================================
-- SSO IDENTITIES (linked social/enterprise accounts)
-- ============================================================

CREATE TABLE sso_identities (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider        sso_provider NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    provider_email  CITEXT,
    access_token    TEXT,
    refresh_token   TEXT,
    token_expires_at TIMESTAMPTZ,
    raw_profile     JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_user_id)
);

CREATE INDEX idx_sso_user    ON sso_identities(user_id);
CREATE INDEX idx_sso_provider ON sso_identities(provider, provider_user_id);

-- ============================================================
-- ORGANIZATION MEMBERS
-- ============================================================

CREATE TABLE organization_members (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_owner        BOOLEAN     NOT NULL DEFAULT FALSE,
    is_admin        BOOLEAN     NOT NULL DEFAULT FALSE,
    department      VARCHAR(100),
    job_title       VARCHAR(100),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    invited_by      UUID        REFERENCES users(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'active',             -- active / suspended / left
    UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_org_members_org  ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);

-- ============================================================
-- INVITES
-- ============================================================

CREATE TABLE invites (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invited_by      UUID        NOT NULL REFERENCES users(id),
    email           CITEXT      NOT NULL,
    role_id         UUID,                                               -- FK added after roles table
    token_hash      TEXT        NOT NULL UNIQUE,
    status          invite_status NOT NULL DEFAULT 'pending',
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '72 hours',
    accepted_at     TIMESTAMPTZ,
    accepted_by     UUID        REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invites_org   ON invites(organization_id);
CREATE INDEX idx_invites_email ON invites(email);
CREATE INDEX idx_invites_token ON invites(token_hash);

-- ============================================================
-- DEVICES
-- ============================================================

CREATE TABLE devices (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id       VARCHAR(128) NOT NULL,                             -- fingerprint hash
    device_name     VARCHAR(255),
    device_type     VARCHAR(50),                                        -- desktop / mobile / tablet
    browser         VARCHAR(100),
    os              VARCHAR(100),
    ip_address      INET,
    location        JSONB,                                              -- {city, country, lat, lng}
    is_trusted      BOOLEAN     NOT NULL DEFAULT FALSE,
    trusted_at      TIMESTAMPTZ,
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, device_id)
);

CREATE INDEX idx_devices_user   ON devices(user_id);
CREATE INDEX idx_devices_last   ON devices(last_seen_at DESC);

-- ============================================================
-- SESSIONS
-- ============================================================

CREATE TABLE sessions (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID        REFERENCES organizations(id) ON DELETE SET NULL,
    device_id       UUID        REFERENCES devices(id) ON DELETE SET NULL,
    session_token   TEXT        NOT NULL UNIQUE,                        -- opaque session identifier
    ip_address      INET,
    user_agent      TEXT,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    last_activity   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    revoked_reason  VARCHAR(100),                                       -- logout / admin / suspicious / expired
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user    ON sessions(user_id);
CREATE INDEX idx_sessions_token   ON sessions(session_token);
CREATE INDEX idx_sessions_active  ON sessions(user_id, is_active);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- ============================================================
-- REFRESH TOKENS
-- ============================================================

CREATE TABLE refresh_tokens (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      TEXT        NOT NULL UNIQUE,                        -- SHA-256 of raw token
    family_id       UUID        NOT NULL DEFAULT uuid_generate_v4(),   -- rotation family — detect reuse attacks
    generation      SMALLINT    NOT NULL DEFAULT 1,
    remember_me     BOOLEAN     NOT NULL DEFAULT FALSE,
    is_revoked      BOOLEAN     NOT NULL DEFAULT FALSE,
    revoked_at      TIMESTAMPTZ,
    revoked_reason  VARCHAR(50),
    ip_address      INET,
    user_agent      TEXT,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rt_token    ON refresh_tokens(token_hash);
CREATE INDEX idx_rt_session  ON refresh_tokens(session_id);
CREATE INDEX idx_rt_user     ON refresh_tokens(user_id);
CREATE INDEX idx_rt_family   ON refresh_tokens(family_id);
CREATE INDEX idx_rt_expires  ON refresh_tokens(expires_at);

-- ============================================================
-- OTP / VERIFICATION TOKENS
-- ============================================================

CREATE TABLE verification_tokens (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            token_type  NOT NULL,
    token_hash      TEXT        NOT NULL,                               -- SHA-256
    otp_code        VARCHAR(10),                                        -- 6-digit OTP (hashed separately)
    otp_code_hash   TEXT,
    used            BOOLEAN     NOT NULL DEFAULT FALSE,
    used_at         TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ NOT NULL,
    ip_address      INET,
    attempts        SMALLINT    NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (token_hash)
);

CREATE INDEX idx_vt_user    ON verification_tokens(user_id, type);
CREATE INDEX idx_vt_token   ON verification_tokens(token_hash);
CREATE INDEX idx_vt_expires ON verification_tokens(expires_at);

-- ============================================================
-- API KEYS
-- ============================================================

CREATE TABLE api_keys (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID        REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    key_prefix      VARCHAR(12) NOT NULL,                               -- first 12 chars for display: cx_live_xxxx
    key_hash        TEXT        NOT NULL UNIQUE,                        -- SHA-256 of full key
    scopes          TEXT[]      NOT NULL DEFAULT '{}',
    allowed_ips     INET[],
    expires_at      TIMESTAMPTZ,
    last_used_at    TIMESTAMPTZ,
    last_used_ip    INET,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    revoked_at      TIMESTAMPTZ,
    revoked_by      UUID        REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_apikeys_user   ON api_keys(user_id);
CREATE INDEX idx_apikeys_org    ON api_keys(organization_id);
CREATE INDEX idx_apikeys_hash   ON api_keys(key_hash);
CREATE INDEX idx_apikeys_active ON api_keys(is_active);

-- ============================================================
-- AUTO-UPDATE TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_sso_updated BEFORE UPDATE ON sso_identities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
