-- ============================================================
-- Climactix Green Production — Migration 005
-- Day-indexed activity tracking, so the platform reports as a
-- continuous data log from a production's first shoot day through
-- its final wrap date, not just an aggregate total.
-- Idempotent: safe to run on every backend startup.
-- ============================================================

ALTER TABLE green_activity_logs
  ADD COLUMN IF NOT EXISTS activity_date DATE NOT NULL DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_green_activity_date
  ON green_activity_logs(production_id, activity_date);

CREATE INDEX IF NOT EXISTS idx_green_water_date
  ON green_water_records(production_id, recorded_at);

CREATE INDEX IF NOT EXISTS idx_green_waste_date
  ON green_waste_records(production_id, recorded_at);
