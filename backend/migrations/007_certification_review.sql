-- ============================================================
-- Climactix Green Production — Migration 007
-- Certification Review Workflow: a governed application/review
-- pipeline sits in front of the existing certificate engine so a
-- production can never self-issue a certificate. Only a reviewer
-- decision (record_decision -> approved) triggers the existing
-- green_certification_engine.issue_certificate().
-- Idempotent: safe to run on every backend startup.
-- ============================================================

CREATE TABLE IF NOT EXISTS green_certification_applications (
  id                  TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  application_number  TEXT UNIQUE NOT NULL,
  production_id       TEXT NOT NULL REFERENCES green_productions(id) ON DELETE CASCADE,
  version             INTEGER NOT NULL DEFAULT 1,
  current_stage       TEXT NOT NULL DEFAULT 'submitted' CHECK (current_stage IN
                       ('submitted','initial_review','documentation_review','technical_assessment',
                        'quality_assurance','final_decision','certificate_issued')),
  status              TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN
                       ('submitted','under_review','more_info_required','approved',
                        'approved_with_conditions','rejected','certified','expired','renewal_due')),
  score               NUMERIC(5,2),
  expected_level_id   TEXT REFERENCES green_certification_levels(id),
  snapshot_id         TEXT REFERENCES green_score_snapshots(id),
  mandatory_criteria_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  questionnaire_snapshot      JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewer_name       TEXT,
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sla_due_at          TIMESTAMPTZ,
  decided_at          TIMESTAMPTZ,
  certified_at        TIMESTAMPTZ,
  certificate_id      TEXT REFERENCES green_certifications(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_green_cert_apps_production ON green_certification_applications(production_id);
CREATE INDEX IF NOT EXISTS idx_green_cert_apps_status ON green_certification_applications(status);

CREATE TABLE IF NOT EXISTS green_application_events (
  id                TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  application_id    TEXT NOT NULL REFERENCES green_certification_applications(id) ON DELETE CASCADE,
  event_type        TEXT NOT NULL CHECK (event_type IN
                     ('submitted','reviewer_assigned','stage_changed','comment_added',
                      'documents_requested','document_fulfilled','resubmitted',
                      'decision_recorded','certificate_issued')),
  actor             TEXT,
  from_value        TEXT,
  to_value          TEXT,
  comment           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_green_app_events_application ON green_application_events(application_id, created_at);

CREATE TABLE IF NOT EXISTS green_application_required_documents (
  id                TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
  application_id    TEXT NOT NULL REFERENCES green_certification_applications(id) ON DELETE CASCADE,
  description       TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','fulfilled')),
  deadline          DATE,
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fulfilled_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_green_app_reqdocs_application ON green_application_required_documents(application_id);
