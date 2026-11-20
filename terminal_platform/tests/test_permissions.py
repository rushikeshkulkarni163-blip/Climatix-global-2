"""Authentication, role permissions, organisation isolation and subscription entitlements."""

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from cxt.db import session_scope
from cxt.main import app
from cxt.models import AuthSession, Subscription, User, utcnow
from tests.conftest import PASSWORD, drain, upload
from tests.fixtures.make_samples import brsr_pdf

API = "/api/v1"


@pytest.fixture
def scene(world, staff):
    """Two companies with scores, two banks, an investor, an insurer, a government body."""
    a = world.company("Alder Works Limited")
    b = world.company("Birch Mills Limited", sector="textiles")
    upload(staff["data_analyst"], a, brsr_pdf("Alder Works Limited"), "alder_brsr.pdf")
    upload(staff["data_analyst"], b, brsr_pdf("Birch Mills Limited"), "birch_brsr.pdf")
    drain()
    s = {"a": str(a), "b": str(b)}
    for key, name, typ, role in (("bank1", "Bank One", "bank", "bank_user"), ("bank2", "Bank Two", "bank", "bank_user"),
                                 ("inv", "Fund One", "investor", "investor_user"),
                                 ("ins", "Insurer One", "insurance", "insurance_user"),
                                 ("gov", "State Department", "government", "government_user")):
        org = world.org(name, typ)
        world.user(f"{key}@inst.example.com", role, org)
        s[key], s[key + "_org"] = world.login(f"{key}@inst.example.com"), org
    for key, cid in (("co_a", a), ("co_b", b)):
        org = world.org(f"Org {key}", "company", company_id=cid)
        world.user(f"{key}@corp.example.com", "company_admin", org)
        s[key] = world.login(f"{key}@corp.example.com")
    return s


def test_unauthenticated_requests_are_rejected():
    c = TestClient(app)
    for path in ("/companies", "/admin/dashboard", "/screen", "/portal", "/auth/me"):
        assert c.get(API + path).status_code == 401
    assert c.get(API + "/health").status_code == 200
    c.headers["Authorization"] = "Bearer not-a-token"
    assert c.get(API + "/companies").status_code == 401


def test_login_failures_lock_the_account_and_do_not_reveal_accounts(world, staff):
    c = TestClient(app)
    unknown = c.post(f"{API}/auth/login", json={"email": "nobody@nowhere.example.com", "password": "x" * 14})
    wrong = c.post(f"{API}/auth/login", json={"email": "data_analyst@climactix.example.com", "password": "x" * 14})
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json()["error"]["message"] == wrong.json()["error"]["message"]
    for _ in range(4):
        c.post(f"{API}/auth/login", json={"email": "data_analyst@climactix.example.com", "password": "x" * 14})
    locked = c.post(f"{API}/auth/login", json={"email": "data_analyst@climactix.example.com", "password": PASSWORD})
    assert locked.status_code == 429


def test_cookie_session_requires_csrf_header_and_survives_token_expiry(world, staff):
    c = TestClient(app)
    r = c.post(f"{API}/auth/login", json={"email": "super_admin@climactix.example.com", "password": PASSWORD})
    assert "cxt_session" in r.cookies and "httponly" in r.headers["set-cookie"].lower()
    assert c.get(f"{API}/auth/me").status_code == 200
    assert c.post(f"{API}/admin/sectors", json={"code": "ports", "name": "Ports"}).status_code == 403
    assert c.post(f"{API}/admin/sectors", json={"code": "ports", "name": "Ports"},
                  headers={"X-Requested-With": "cxt"}).status_code == 201


def test_logout_and_disabling_a_user_end_access_immediately(world, staff):
    org = world.org("Bank X", "bank")
    uid = world.user("x@bankx.example.com", "bank_user", org)
    c = world.login("x@bankx.example.com")
    assert c.get(f"{API}/auth/me").status_code == 200
    r = staff["super_admin"].post(f"{API}/admin/users/{uid}/status", params={"status": "disabled"})
    assert r.status_code == 200 and r.json()["status"] == "disabled"
    assert c.get(f"{API}/auth/me").status_code == 401                 # same token, now refused
    assert TestClient(app).post(f"{API}/auth/login", json={"email": "x@bankx.example.com", "password": PASSWORD}).status_code == 401
    d = world.login("data_analyst@climactix.example.com")
    assert d.post(f"{API}/auth/logout").status_code == 204
    assert d.get(f"{API}/auth/me").status_code == 401


def test_password_reset_is_single_use_and_revokes_sessions(world, staff):
    org = world.org("Bank Y", "bank")
    uid = world.user("y@banky.example.com", "bank_user", org)
    old = world.login("y@banky.example.com")
    anon = TestClient(app)
    assert anon.post(f"{API}/auth/password/forgot", json={"email": "y@banky.example.com"}).status_code == 202
    assert anon.post(f"{API}/auth/password/forgot", json={"email": "ghost@banky.example.com"}).status_code == 202
    link = staff["super_admin"].post(f"{API}/admin/users/{uid}/reset-link").json()["link"]
    token = link.split("token=")[1]
    assert anon.post(f"{API}/auth/password/reset", json={"token": token, "password": "short"}).status_code == 422  # test fixture  # pragma: allowlist secret  gitleaks:allow
    assert anon.post(f"{API}/auth/password/reset", json={"token": token, "password": "A-new-passphrase-77"}).status_code == 200  # test fixture  # pragma: allowlist secret  gitleaks:allow
    assert anon.post(f"{API}/auth/password/reset", json={"token": token, "password": "Another-passphrase-88"}).status_code == 400  # test fixture  # pragma: allowlist secret  gitleaks:allow
    assert old.get(f"{API}/auth/me").status_code == 401
    assert anon.post(f"{API}/auth/login", json={"email": "y@banky.example.com", "password": "A-new-passphrase-77"}).status_code == 200  # test fixture  # pragma: allowlist secret  gitleaks:allow


def test_role_permissions(scene, staff):
    new_company = {"legal_name": "Cedar Holdings Limited", "country": "India"}
    for who in ("bank1", "inv", "gov", "co_a"):
        assert scene[who].post(f"{API}/companies", json=new_company).status_code == 403
        assert scene[who].get(f"{API}/admin/dashboard").status_code == 403
        assert scene[who].get(f"{API}/admin/users").status_code == 403
        assert scene[who].get(f"{API}/review/items").status_code == 403
        assert scene[who].post(f"{API}/companies/{scene['a']}/assess").status_code == 403
    assert staff["data_analyst"].get(f"{API}/admin/users").status_code == 403         # analysts do not manage users
    assert staff["data_analyst"].get(f"{API}/admin/audit").status_code == 403
    assert staff["data_analyst"].post(f"{API}/companies/merge", json={
        "source_id": scene["a"], "target_id": scene["b"], "reason": "testing permissions"}).status_code == 403
    assert staff["assessment_reviewer"].post(f"{API}/companies", json=new_company).status_code == 403
    assert staff["data_analyst"].post(f"{API}/companies", json=new_company).status_code == 201


def test_bank_portfolios_are_invisible_to_other_organisations(scene):
    b1, b2 = scene["bank1"], scene["bank2"]
    pf = b1.post(f"{API}/portfolios", json={"name": "Corporate loan book"}).json()
    assert b1.post(f"{API}/portfolios/{pf['id']}/companies", json={"company_id": scene["a"], "note": "Term loan"}).status_code == 201
    assert [p["name"] for p in b1.get(f"{API}/portfolios").json()] == ["Corporate loan book"]
    assert b2.get(f"{API}/portfolios").json() == []
    assert b2.get(f"{API}/portfolios/{pf['id']}").status_code == 404
    assert b2.post(f"{API}/portfolios/{pf['id']}/companies", json={"company_id": scene["b"]}).status_code == 404
    assert b2.delete(f"{API}/portfolios/{pf['id']}").status_code == 404
    assert scene["inv"].get(f"{API}/portfolios/{pf['id']}").status_code == 404
    over = b1.get(f"{API}/portfolios/{pf['id']}").json()
    assert over["summary"]["companies"] == 1 and over["holdings"][0]["note"] == "Term loan"
    assert over["holdings"][0]["score"] is not None


def test_company_cannot_see_another_companys_submission(scene, staff):
    a = scene["co_a"].post(f"{API}/assessments", json={"fiscal_year": 2025}).json()
    ev = upload(scene["co_a"], scene["a"], brsr_pdf("Alder Works Limited", renewable=(40.0, 20.0)), "alder_private.pdf").json()
    drain()
    assert scene["co_b"].get(f"{API}/assessments/{a['id']}").status_code == 404
    assert scene["co_b"].put(f"{API}/assessments/{a['id']}/answers", json={"answers": {}}).status_code == 404
    assert scene["co_b"].post(f"{API}/assessments/{a['id']}/submit").status_code == 404
    assert scene["co_b"].get(f"{API}/documents/{ev['id']}").status_code == 404
    assert scene["co_b"].get(f"{API}/documents/{ev['id']}/download").status_code == 404
    assert scene["co_b"].get(f"{API}/documents/{ev['id']}/pages").status_code == 404
    # A company cannot attach another organisation's document as its evidence.
    b = scene["co_b"].post(f"{API}/assessments", json={"fiscal_year": 2025}).json()
    r = scene["co_b"].put(f"{API}/assessments/{b['id']}/answers",
                          json={"answers": {"re_renewable": {"value": {"value": 40}, "evidence_document_id": ev["id"]}}})
    assert r.status_code == 422
    # ...nor upload documents into another company's repository.
    assert upload(scene["co_b"], scene["a"], brsr_pdf(), "x.pdf").status_code == 403
    assert scene["co_b"].get(f"{API}/portal").json()["company"]["id"] == scene["b"]
    # Private documents never appear in another party's repository view or the public profile.
    titles = [d["title"] for y in scene["bank1"].get(f"{API}/companies/{scene['a']}/repository").json()["years"] for d in y["documents"]]
    assert "alder_private.pdf" not in titles
    own = [d["title"] for y in scene["co_a"].get(f"{API}/companies/{scene['a']}/repository").json()["years"] for d in y["documents"]]
    assert "alder_private.pdf" in own


def test_company_cannot_change_its_public_score(scene, staff):
    co = scene["co_a"]
    pts = staff["data_analyst"].get(f"{API}/companies/{scene['a']}/data-points", params={"metric": "scope1_emissions"}).json()["items"]
    dp = pts[0]["id"]
    assert co.post(f"{API}/data-points/{dp}/review", json={"decision": "correct", "corrected_value": 1, "note": "lower"}).status_code == 403
    assert co.post(f"{API}/companies/{scene['a']}/assess").status_code == 403
    assert upload(co, scene["a"], brsr_pdf("Alder Works Limited", s1=(10, 20)), "nicer.pdf").json()["visibility"] == "private"
    before = staff["data_analyst"].get(f"{API}/companies/{scene['a']}").json()["public_score"]
    drain()
    after = staff["data_analyst"].get(f"{API}/companies/{scene['a']}").json()["public_score"]
    assert after["id"] == before["id"] and after["overall"] == before["overall"]   # a private upload does not move it
    # The legitimate route is a correction request, decided by Climactix.
    r = co.post(f"{API}/corrections", json={"data_point_id": dp, "subject": "Scope 1 FY2024-25",
                                           "proposed_value": "181,900 tCO2e",
                                           "justification": "Restated after boundary correction in addendum"})
    assert r.status_code == 201 and r.json()["status"] == "open"
    assert co.post(f"{API}/corrections/{r.json()['id']}/decide", json={"decision": "accept", "note": "self-approve"}).status_code == 403
    assert scene["co_b"].get(f"{API}/corrections").json() == []
    d = staff["assessment_reviewer"].post(f"{API}/corrections/{r.json()['id']}/decide",
                                          json={"decision": "accept", "note": "Addendum confirms the restatement",
                                                "corrected_normalized_value": 181900})
    assert d.status_code == 200 and d.json()["applied_data_point_id"]
    drain()
    fixed = staff["data_analyst"].get(f"{API}/companies/{scene['a']}/data-points",
                                      params={"metric": "scope1_emissions", "year": "2025", "status": "verified"}).json()["items"]
    assert fixed[0]["value"] == 181900 and fixed[0]["provenance"]["extraction_method"] == "manual"


def test_company_score_is_private_until_the_company_shares_it(scene, staff):
    co, rev = scene["co_a"], staff["assessment_reviewer"]
    a = co.post(f"{API}/assessments", json={"fiscal_year": 2025}).json()
    answers = {q: {"value": v, "source_declaration": "Internal ledger FY2024-25"} for q, v in {
        "ep_scope1": {"value": 182400}, "ep_scope2": {"value": 96200}, "ep_water": {"value": 2860000},
        "ep_revenue": {"value": 8420}, "re_energy": {"value": 4120000}, "cs_netzero": {"value": "no"},
        "gd_board": {"value": "yes"}, "gd_assurance": {"value": "No external assurance"}}.items()}
    co.put(f"{API}/assessments/{a['id']}/answers", json={"answers": answers})
    assert co.post(f"{API}/assessments/{a['id']}/submit").status_code == 200
    assert rev.post(f"{API}/assessments/{a['id']}/validate", json={}).status_code == 200
    bank = scene["bank1"]
    assert bank.get(f"{API}/companies/{scene['a']}").json()["company_score"] is None
    assert bank.put(f"{API}/companies/{scene['a']}/sharing", params={"share": True}).status_code == 403
    assert co.put(f"{API}/companies/{scene['a']}/sharing", params={"share": True}).status_code == 200
    shared = bank.get(f"{API}/companies/{scene['a']}").json()
    assert shared["company_score"] is not None and shared["company_score"]["score_type"] == "company"
    assert bank.get(f"{API}/assessments/{a['id']}").status_code == 404        # the submission itself stays private


def test_government_sees_aggregates_only(scene, staff):
    gov = scene["gov"]
    assert gov.get(f"{API}/workspace").json()["title"] == "Government Intelligence"
    assert "not an official government portal" in gov.get(f"{API}/workspace").json()["purpose"]
    prof = gov.get(f"{API}/companies/{scene['a']}").json()
    assert prof["access_level"] == "directory" and "public_score" not in prof and "scores" in prof["withheld"]
    assert gov.get(f"{API}/screen").status_code == 402
    assert gov.get(f"{API}/companies/{scene['a']}/data-points").status_code == 402
    assert gov.get(f"{API}/companies/{scene['a']}/net-zero").status_code == 402
    assert gov.post(f"{API}/companies/{scene['a']}/report").status_code == 403
    assert gov.post(f"{API}/compare", json={"company_ids": [scene["a"], scene["b"]]}).status_code == 402
    assert "scores_included" in gov.get(f"{API}/companies").json() and gov.get(f"{API}/companies").json()["scores_included"] is False
    agg = gov.get(f"{API}/sectors/aggregates").json()
    row = next(s for s in agg["sectors"] if s["sector_code"] == "capital_goods")
    assert row["companies"] == 1 and row["companies_reporting"] == 1 and row["reporting_participation_pct"] == 100
    assert row["score"] is None and "withheld" in row["suppressed"]           # one company: statistics suppressed
    assert "legal_name" not in str(agg)
    cov = gov.get(f"{API}/coverage").json()
    assert cov["total"] == 2 and all("public_score" not in i for i in cov["items"])


def test_subscription_entitlements_and_expiry(scene, staff, world):
    bank = scene["bank1"]
    assert bank.get(f"{API}/screen").status_code == 200
    me = bank.get(f"{API}/auth/me").json()
    assert me["subscription"]["plan"] == "institutional_pilot" and "portfolio" in me["entitlements"]
    with session_scope() as db:
        sub = db.execute(select(Subscription).where(Subscription.organisation_id == scene["bank1_org"])).scalar_one()
        sub.ends_at = utcnow() - timedelta(minutes=1)
    r = bank.get(f"{API}/screen")
    assert r.status_code == 402 and "no active subscription" in r.json()["error"]["message"]
    assert bank.get(f"{API}/portfolios").status_code == 402
    assert bank.get(f"{API}/companies/{scene['a']}").json()["access_level"] == "directory"
    assert bank.get(f"{API}/auth/me").json()["subscription"] is None
    # An organisation without any subscription can sign in but sees the directory only.
    org = world.org("Bank Three", "bank", plan=None)
    world.user("b3@inst.example.com", "bank_user", org)
    b3 = world.login("b3@inst.example.com")
    assert b3.get(f"{API}/companies").status_code == 200 and b3.get(f"{API}/screen").status_code == 402
    # The administrator renews; access returns.
    r = staff["super_admin"].post(f"{API}/admin/subscriptions", json={"organisation_id": str(scene["bank1_org"]),
                                                                    "plan": "institutional_enterprise"})
    assert r.status_code == 201 and "api_access" in r.json()["entitlements"]
    assert bank.get(f"{API}/screen").status_code == 200


def test_pilot_runs_six_months_and_plans_are_matched_to_organisation_type(staff, world):
    admin = staff["super_admin"]
    org = world.org("Pilot Bank", "bank", plan=None)
    sub = admin.post(f"{API}/admin/subscriptions", json={"organisation_id": str(org), "plan": "institutional_pilot"}).json()
    assert 180 <= sub["days_remaining"] <= 183 and sub["plan"] == "institutional_pilot"
    cid = world.company("Dune Agro Limited", sector="agri_food")
    co = world.org("Dune Agro", "company", company_id=cid, plan=None)
    assert admin.post(f"{API}/admin/subscriptions", json={"organisation_id": str(co), "plan": "institutional_pilot"}).status_code == 422
    annual = admin.post(f"{API}/admin/subscriptions", json={"organisation_id": str(co), "plan": "company_annual"}).json()
    assert 363 <= annual["days_remaining"] <= 365 and "assessment_workflow" in annual["entitlements"]
    assert "company_intelligence" not in annual["entitlements"]
    assert admin.post(f"{API}/admin/subscriptions", json={"organisation_id": str(org), "plan": "internal"}).status_code == 422


def test_invitation_rules(staff, world):
    admin = staff["super_admin"]
    bank = world.org("Invite Bank", "bank")
    bad = admin.post(f"{API}/admin/users/invite", json={"email": "a@ib.example.com", "full_name": "A B",
                                                       "role": "super_admin", "organisation_id": str(bank)})
    assert bad.status_code == 422 and "climactix organisation" in bad.json()["error"]["message"]
    ok = admin.post(f"{API}/admin/users/invite", json={"email": "a@ib.example.com", "full_name": "A B",
                                                      "role": "bank_user", "organisation_id": str(bank)})
    assert ok.status_code == 201 and ok.json()["status"] == "invited"
    assert admin.post(f"{API}/admin/users/invite", json={"email": "A@ib.example.com", "full_name": "A B",
                                                        "role": "bank_user", "organisation_id": str(bank)}).status_code == 409
    assert TestClient(app).post(f"{API}/auth/login", json={"email": "a@ib.example.com", "password": PASSWORD}).status_code == 401
    assert admin.post(f"{API}/admin/users/{staff['super_admin_id']}/status", params={"status": "disabled"}).status_code == 409


def test_suspending_an_organisation_blocks_its_users(staff, world):
    org = world.org("Suspend Bank", "bank")
    world.user("s@sb.example.com", "bank_user", org)
    c = world.login("s@sb.example.com")
    assert staff["super_admin"].post(f"{API}/admin/organisations/{org}/status", params={"status": "suspended"}).status_code == 200
    assert c.get(f"{API}/auth/me").status_code == 401


def test_dev_login_is_off_by_default_and_refused_in_production(staff, monkeypatch):
    from cxt.config import Settings, get_settings
    c = TestClient(app)
    assert c.get(f"{API}/auth/dev-login").status_code == 404
    assert c.post(f"{API}/auth/dev-login", json={"email": "super_admin@climactix.example.com"}).status_code == 404
    monkeypatch.setattr(get_settings(), "dev_login", True)
    assert c.get(f"{API}/auth/dev-login").status_code == 200
    r = c.post(f"{API}/auth/dev-login", json={"email": "super_admin@climactix.example.com"})
    assert r.status_code == 200 and c.get(f"{API}/auth/me").json()["user"]["role"] == "super_admin"
    with pytest.raises(Exception, match="cannot be enabled in production"):
        Settings(env="production", jwt_secret="x" * 40, dev_login=True)
