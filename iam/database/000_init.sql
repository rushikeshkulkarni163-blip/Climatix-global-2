-- ============================================================
-- Climactix IAM — Database Initialization
-- Run ORDER: 000 → 001 → 002 → 003 → 004
-- ============================================================

-- Sequences for human-readable IDs
CREATE SEQUENCE IF NOT EXISTS user_id_seq   START 1 INCREMENT 1 NO CYCLE;
CREATE SEQUENCE IF NOT EXISTS tenant_id_seq START 1 INCREMENT 1 NO CYCLE;

-- Extensions (run before schema tables)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "citext";
