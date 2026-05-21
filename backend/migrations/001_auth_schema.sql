-- ============================================================
-- Climactix Global — Auth Schema Migration 001
-- Institutional-grade authentication tables
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_users (
  id              TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  email           TEXT UNIQUE NOT NULL,
  email_canonical TEXT UNIQUE NOT NULL,
  full_name       TEXT NOT NULL,
  company_name    TEXT NOT NULL DEFAULT '',
  password_hash   TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','active','suspended','deleted')),
  role            TEXT NOT NULL DEFAULT 'free_member',
  tier            SMALLINT NOT NULL DEFAULT 1
                  CHECK (tier BETWEEN 1 AND 5),
  failed_login_attempts SMALLINT NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  last_login_at   TIMESTAMPTZ,
  last_login_ip   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Email Tokens (verify + reset) ─────────────────────────
CREATE TABLE IF NOT EXISTS auth_email_tokens (
  id          TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  user_id     TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  purpose     TEXT NOT NULL CHECK (purpose IN ('verify_email','reset_password')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ
);

-- ── Sessions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  ip_address  TEXT,
  user_agent  TEXT,
  remember_me BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  revoke_reason TEXT
);

-- ── Refresh Tokens ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  id          TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  token_hash  TEXT UNIQUE NOT NULL,
  user_id     TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  session_id  TEXT NOT NULL REFERENCES auth_sessions(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ
);

-- ── Audit Events (append-only, never updated) ─────────────
CREATE TABLE IF NOT EXISTS auth_audit_events (
  id            TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  event_time    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type    TEXT NOT NULL,
  event_outcome TEXT NOT NULL CHECK (event_outcome IN ('success','failure','blocked')),
  actor_id      TEXT,
  actor_email   TEXT,
  ip_address    TEXT,
  user_agent    TEXT,
  metadata      JSONB
);

-- ── Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_auth_users_email        ON auth_users(email_canonical);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user      ON auth_sessions(user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires   ON auth_sessions(expires_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_auth_rt_hash            ON auth_refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_rt_session         ON auth_refresh_tokens(session_id);
CREATE INDEX IF NOT EXISTS idx_auth_email_tokens_user  ON auth_email_tokens(user_id, purpose) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_auth_audit_time         ON auth_audit_events(event_time DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_actor        ON auth_audit_events(actor_email, event_time DESC);
