"""
Test harness. Tests run against a real PostgreSQL database
(TERMINAL_TEST_DATABASE_URL, default postgresql+psycopg://localhost/climactix_terminal_test),
migrated with Alembic exactly as production is, and against a temporary
document store. Nothing is mocked except the network.
"""

from __future__ import annotations

import os
import tempfile
import uuid
from datetime import timedelta

_STORE = tempfile.mkdtemp(prefix="cxt-test-store-")
os.environ["TERMINAL_ENV"] = "test"
os.environ["TERMINAL_DATABASE_URL"] = os.environ.get(
    "TERMINAL_TEST_DATABASE_URL", "postgresql+psycopg://localhost/climactix_terminal_test")
os.environ["TERMINAL_STORAGE_DIR"] = _STORE
os.environ["TERMINAL_JWT_SECRET"] = "test-secret-" + "x" * 40  # test fixture, not a real credential  # pragma: allowlist secret  gitleaks:allow
os.environ["TERMINAL_SMTP_HOST"] = ""

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from cxt import companies, jobs, methodology, security  # noqa: E402
from cxt.config import get_settings  # noqa: E402
from cxt.db import get_engine, session_scope  # noqa: E402
from cxt.main import app  # noqa: E402
from cxt.models import Organisation, Subscription, User, utcnow  # noqa: E402
from tests.fixtures.make_samples import brsr_pdf  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASSWORD = "Correct-Horse-42-Battery"  # test fixture, not a real credential  # pragma: allowlist secret  gitleaks:allow
KEEP = {"alembic_version", "sectors"}


@pytest.fixture(scope="session", autouse=True)
def _schema():
    assert "test" in get_settings().database_url, "refusing to run tests against a non-test database"
    eng = get_engine()
    with eng.begin() as c:
        c.execute(text("DROP SCHEMA public CASCADE"))
        c.execute(text("CREATE SCHEMA public"))
    cfg = Config(os.path.join(ROOT, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(ROOT, "migrations"))
    command.upgrade(cfg, "head")
    yield


@pytest.fixture(autouse=True)
def _clean(_schema):
    eng = get_engine()
    with eng.begin() as c:
        tables = [r[0] for r in c.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public'"))
                  if r[0] not in KEEP]
        c.execute(text("SET session_replication_role = replica"))     # bypass the append-only triggers for cleanup
        c.execute(text("TRUNCATE " + ", ".join(tables) + " RESTART IDENTITY CASCADE"))
        c.execute(text("SET session_replication_role = DEFAULT"))
        c.execute(text("ALTER SEQUENCE company_cx_seq RESTART WITH 1"))
    with session_scope() as db:
        methodology.ensure_default(db)
    yield


class Actor:
    """Stand-in principal for direct service calls in tests."""
    def __init__(self, user_id=None, org_id=None, role="super_admin", email="test@climactix.example.com"):
        self.user_id, self.org_id, self.role, self.email, self.ip = user_id or uuid.uuid4(), org_id, role, email, None


class World:
    """Builds organisations, users and companies, and signs users in."""

    def __init__(self):
        self.clients: dict[str, TestClient] = {}

    def org(self, name: str, org_type: str, company_id=None, plan: str | None = "auto", days: int | None = None):
        with session_scope() as db:
            o = Organisation(name=name, org_type=org_type, company_id=company_id)
            db.add(o)
            db.flush()
            if plan == "auto":
                plan = {"climactix": "internal", "company": "company_annual"}.get(org_type, "institutional_pilot")
            if plan:
                ents = security.default_entitlements(plan, o)
                db.add(Subscription(organisation_id=o.id, plan=plan, status="active",
                                    starts_at=utcnow() - timedelta(days=1),
                                    ends_at=None if plan == "internal" else utcnow() + timedelta(days=days or 183),
                                    entitlements=ents))
            return o.id

    def user(self, email: str, role: str, org_id, status: str = "active"):
        with session_scope() as db:
            u = User(email=email, full_name=email.split("@")[0].title(), role=role, organisation_id=org_id,
                     status=status, password_hash=security.hash_password(PASSWORD))
            db.add(u)
            db.flush()
            return u.id

    def login(self, email: str) -> TestClient:
        c = TestClient(app)
        r = c.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
        assert r.status_code == 200, r.text
        c.cookies.clear()                                   # authenticate with the bearer token only
        c.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
        self.clients[email] = c
        return c

    def company(self, name: str, sector: str = "capital_goods", **kw):
        with session_scope() as db:
            c = companies.create_company(db, Actor(), legal_name=name, country="India", sector_code=sector,
                                         is_synthetic=True, **kw)
            return c.id


@pytest.fixture
def world():
    return World()


@pytest.fixture
def staff(world):
    """Climactix organisation with one user of each internal role, signed in."""
    org = world.org("Climactix Global", "climactix")
    out = {"org": org}
    for role in ("super_admin", "data_analyst", "assessment_reviewer"):
        email = f"{role}@climactix.example.com"
        out[role + "_id"] = world.user(email, role, org)
        out[role] = world.login(email)
    return out


def upload(client: TestClient, company_id, pdf: bytes, name: str = "report.pdf", **form):
    r = client.post(f"/api/v1/companies/{company_id}/documents",
                    files={"file": (name, pdf, "application/pdf")}, data=form)
    return r


def drain() -> int:
    return jobs.drain()


@pytest.fixture
def sample_pdf():
    return brsr_pdf()
