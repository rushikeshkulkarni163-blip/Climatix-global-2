"""integrity controls and reference data

- company_cx_seq: source of the unique corporate ID (CX-000001)
- audit_log is append-only: UPDATE, DELETE and TRUNCATE are rejected by trigger
- scores are immutable apart from the is_current flag
- sector reference list

Revision ID: 0002
Revises: 0001
"""
import uuid

from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

SECTORS = [
    ("automobiles", "Automobiles and components"), ("banking_finance", "Banking and financial services"),
    ("cement", "Cement and construction materials"), ("chemicals", "Chemicals and fertilisers"),
    ("consumer_goods", "Consumer goods"), ("energy_oil_gas", "Oil and gas"),
    ("it_services", "Information technology and services"), ("metals_mining", "Metals and mining"),
    ("pharma_healthcare", "Pharmaceuticals and healthcare"), ("power_utilities", "Power and utilities"),
    ("real_estate", "Real estate and construction"), ("telecom", "Telecommunications"),
    ("textiles", "Textiles and apparel"), ("transport_logistics", "Transport and logistics"),
    ("capital_goods", "Capital goods and engineering"), ("agri_food", "Agriculture and food products"),
    ("other", "Other / diversified"),
]


def upgrade() -> None:
    op.execute("CREATE SEQUENCE IF NOT EXISTS company_cx_seq START 1")
    op.execute("""
        CREATE OR REPLACE FUNCTION cxt_audit_immutable() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'audit_log is append-only';
        END $$ LANGUAGE plpgsql""")
    op.execute("CREATE TRIGGER audit_log_no_change BEFORE UPDATE OR DELETE ON audit_log "
               "FOR EACH ROW EXECUTE FUNCTION cxt_audit_immutable()")
    op.execute("CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log "
               "FOR EACH STATEMENT EXECUTE FUNCTION cxt_audit_immutable()")
    op.execute("""
        CREATE OR REPLACE FUNCTION cxt_score_immutable() RETURNS trigger AS $$
        BEGIN
            IF TG_OP = 'DELETE' THEN
                RAISE EXCEPTION 'scores are immutable';
            END IF;
            IF (to_jsonb(NEW) - 'is_current' - 'company_id') IS DISTINCT FROM (to_jsonb(OLD) - 'is_current' - 'company_id') THEN
                RAISE EXCEPTION 'scores are immutable: only is_current (and company_id on merge) may change';
            END IF;
            RETURN NEW;
        END $$ LANGUAGE plpgsql""")
    op.execute("CREATE TRIGGER scores_immutable BEFORE UPDATE OR DELETE ON scores "
               "FOR EACH ROW EXECUTE FUNCTION cxt_score_immutable()")
    sectors = sa.table("sectors", sa.column("id", sa.UUID()), sa.column("code", sa.String()),
                       sa.column("name", sa.String()), sa.column("active", sa.Boolean()))
    op.bulk_insert(sectors, [{"id": uuid.uuid5(uuid.NAMESPACE_URL, f"cxt-sector:{c}"), "code": c, "name": n,
                              "active": True} for c, n in SECTORS])


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS scores_immutable ON scores")
    op.execute("DROP FUNCTION IF EXISTS cxt_score_immutable()")
    op.execute("DROP TRIGGER IF EXISTS audit_log_no_truncate ON audit_log")
    op.execute("DROP TRIGGER IF EXISTS audit_log_no_change ON audit_log")
    op.execute("DROP FUNCTION IF EXISTS cxt_audit_immutable()")
    op.execute("DELETE FROM sectors")
    op.execute("DROP SEQUENCE IF EXISTS company_cx_seq")
