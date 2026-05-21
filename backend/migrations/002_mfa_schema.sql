-- ============================================================
-- Climactix Global — Auth Schema Migration 002
-- MFA (TOTP), trusted devices, API keys, CSRF tokens
-- ============================================================

-- ── MFA columns on users ───────────────────────────────────
ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS mfa_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS totp_secret_enc  TEXT;

-- ── Trusted devices ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_devices (
  id            TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  user_id       TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  fingerprint   TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT 'Unknown Device',
  last_seen_ip  TEXT,
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trusted       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at    TIMESTAMPTZ,
  UNIQUE (user_id, fingerprint)
);

-- ── API keys ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_api_keys (
  id            TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  key_hash      TEXT UNIQUE NOT NULL,
  key_prefix    TEXT NOT NULL,
  user_id       TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  permissions   TEXT[] NOT NULL DEFAULT '{}',
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ
);

-- ── Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_auth_devices_user      ON auth_devices(user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_auth_api_keys_user     ON auth_api_keys(user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_auth_api_keys_hash     ON auth_api_keys(key_hash);
