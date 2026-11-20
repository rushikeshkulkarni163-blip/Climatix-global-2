"""Administration: merge, methodology governance, connectors, audit immutability, import, extraction units."""

import copy

import pytest
from sqlalchemy import text

from cxt.db import session_scope
from cxt.extraction import catalogue as X
from cxt.extraction import units as U
from cxt.methodology import DEFAULT_CONFIG
from tests.conftest import drain, upload
from tests.fixtures.make_samples import brsr_pdf

API = "/api/v1"


def test_merge_moves_everything_and_is_audited(world, staff):
    a, admin = staff["data_analyst"], staff["super_admin"]
    tgt = world.company("Rowan Textiles Limited", sector="textiles", registration_id="L17110MH1990PLC055123")
    src = world.company("Rowan Textile Mills", sector="textiles")
    upload(a, src, brsr_pdf("Rowan Textile Mills"), "rowan_mills.pdf")
    drain()
    items = a.get(f"{API}/review/items", params={"kind": "duplicate_company"}).json()
    assert any(i["company"]["id"] == str(src) for i in items)
    assert admin.post(f"{API}/companies/merge", json={"source_id": str(src), "target_id": str(src),
                                                     "reason": "self merge attempt"}).status_code == 422
    r = admin.post(f"{API}/companies/merge", json={"source_id": str(src), "target_id": str(tgt),
                                                  "reason": "Same legal entity; trading name recorded separately"})
    assert r.status_code == 200, r.text
    assert r.json()["moved"]["documents"] == 1 and r.json()["moved"]["data_points"] > 10
    drain()
    prof = a.get(f"{API}/companies/{tgt}").json()
    assert "Rowan Textile Mills" in prof["company"]["aliases"] and prof["document_count"] == 1
    assert prof["public_score"] is not None
    assert a.get(f"{API}/companies/{src}").json()["company"]["id"] == str(tgt)        # old id redirects
    assert a.get(f"{API}/companies", params={"q": "rowan"}).json()["total"] == 1
    assert a.get(f"{API}/companies/{tgt}/merges").json()[0]["source"]["legal_name"] == "Rowan Textile Mills"
    log = admin.get(f"{API}/admin/audit", params={"action": "company.merge"}).json()["items"]
    assert log and log[0]["detail"]["reason"].startswith("Same legal entity")


def test_methodology_change_is_versioned_approved_by_another_admin_and_never_rewrites_history(world, staff):
    admin, analyst = staff["super_admin"], staff["data_analyst"]
    second_org = staff["org"]
    world.user("second_admin@climactix.example.com", "super_admin", second_org)
    admin2 = world.login("second_admin@climactix.example.com")
    cid = world.company("Sal Engineering Limited")
    upload(analyst, cid, brsr_pdf("Sal Engineering Limited"), "sal.pdf")
    drain()
    old = analyst.get(f"{API}/companies/{cid}").json()["public_score"]

    cfg = copy.deepcopy(DEFAULT_CONFIG)
    for p in cfg["pillars"]:
        p["weight"] = {"environmental_performance": 30, "governance_disclosure": 5}.get(p["id"], p["weight"])
    assert analyst.post(f"{API}/admin/methodology", json={"version": "1.1", "config": cfg,
                                                          "change_note": "Reweight environment"}).status_code == 403
    bad = copy.deepcopy(cfg); bad["pillars"][0]["weight"] = 99
    assert admin.post(f"{API}/admin/methodology", json={"version": "1.1", "config": bad,
                                                        "change_note": "Invalid weights test"}).status_code == 422
    d = admin.post(f"{API}/admin/methodology", json={"version": "1.1", "config": cfg,
                                                     "change_note": "Environmental performance 30, governance 5"})
    assert d.status_code == 201 and d.json()["status"] == "draft"
    drain()
    assert analyst.get(f"{API}/companies/{cid}").json()["public_score"]["id"] == old["id"]      # a draft changes nothing
    assert all(m["status"] != "draft" for m in analyst.get(f"{API}/admin/methodology").json())
    r = admin.post(f"{API}/admin/methodology/{d.json()['id']}/approve")
    assert r.status_code == 409 and "different Super Administrator" in r.json()["error"]["message"]
    r = admin2.post(f"{API}/admin/methodology/{d.json()['id']}/approve")
    assert r.status_code == 200 and r.json()["companies_queued_for_rescoring"] == 1
    drain()
    new = analyst.get(f"{API}/companies/{cid}").json()
    assert new["public_score"]["methodology_version"] == "1.1" and new["public_score"]["id"] != old["id"]
    statuses = {m["version"]: m["status"] for m in admin.get(f"{API}/admin/methodology").json()}
    assert statuses == {"1.0": "retired", "1.1": "approved"}
    # The 1.0 score is still on record and still reproduces under 1.0.
    rep = analyst.get(f"{API}/scores/{old['id']}/reproduce").json()
    assert rep["reproduced"] is True and rep["methodology_version"] == "1.0"
    assert [h["methodology_version"] for h in new["score_history"]] == ["1.0", "1.1"]


def test_scores_and_audit_rows_are_immutable_in_the_database(world, staff):
    analyst = staff["data_analyst"]
    cid = world.company("Teak Ports Limited", sector="transport_logistics")
    upload(analyst, cid, brsr_pdf("Teak Ports Limited"), "teak.pdf")
    drain()
    with pytest.raises(Exception, match="append-only"):
        with session_scope() as db:
            db.execute(text("UPDATE audit_log SET action = 'tampered'"))
    with pytest.raises(Exception, match="append-only"):
        with session_scope() as db:
            db.execute(text("DELETE FROM audit_log"))
    with pytest.raises(Exception, match="immutable"):
        with session_scope() as db:
            db.execute(text("UPDATE scores SET overall = 99"))
    with pytest.raises(Exception, match="immutable"):
        with session_scope() as db:
            db.execute(text("DELETE FROM scores"))
    assert staff["super_admin"].get(f"{API}/admin/audit/verify").json()["ok"] is True


def test_connectors_report_pending_configuration_honestly(world, staff):
    a = staff["data_analyst"]
    cid = world.company("Umber Metals Limited", sector="metals_mining")
    ref = a.get(f"{API}/reference").json()["connectors"]
    status = {c["key"]: c["status"] for c in ref}
    assert status["public_url"] == status["web_discovery"] == "operational"
    assert status["bse_filings"] == status["nse_filings"] == status["mca_registry"] == "pending_configuration"
    src = a.post(f"{API}/companies/{cid}/sources", json={"connector": "bse_filings", "label": "BSE"}).json()
    assert src["status"] == "pending_configuration" and "agreement" in src["requires"]
    r = a.post(f"{API}/sources/{src['id']}/ingest", json={"urls": ["https://example.com/x.pdf"]})
    assert r.status_code == 409 and "not configured" in r.json()["error"]["message"]
    web = a.post(f"{API}/companies/{cid}/sources", json={"connector": "public_url",
                                                         "url": "https://example.com/report.pdf"}).json()
    r = a.post(f"{API}/sources/{web['id']}/ingest", json={"urls": ["https://evil.example.net/other.pdf"]})
    assert r.status_code == 422                                          # only the registered URL may be fetched


def test_ssrf_guard_refuses_private_addresses(world, staff, monkeypatch):
    from cxt import connectors
    for url in ("http://127.0.0.1/admin", "http://169.254.169.254/latest/meta-data", "file:///etc/passwd",
                "http://10.0.0.5/report.pdf"):
        with pytest.raises(connectors.ConnectorError):
            connectors.fetch(url)


def test_discovery_lists_report_links_from_a_page(monkeypatch):
    from cxt import connectors
    html = b"""<html><body>
      <a href="/files/Annual-Report-2024-25.pdf">Annual Report 2024-25</a>
      <a href="/files/BRSR_FY2024-25.pdf">Business Responsibility and Sustainability Report</a>
      <a href="/files/menu.pdf">Canteen menu</a>
      <a href="/about">About us</a></body></html>"""
    monkeypatch.setattr(connectors, "fetch", lambda url, max_bytes=None: (html, "ir", "text/html", "https://co.example.com/ir"))
    found = connectors.discover("https://co.example.com/ir")
    assert [f["url"] for f in found] == ["https://co.example.com/files/Annual-Report-2024-25.pdf",
                                         "https://co.example.com/files/BRSR_FY2024-25.pdf"]
    assert found[0]["period_hint"] == "2024-25"


def test_csv_company_import(staff):
    admin = staff["data_analyst"]
    csv = ("legal_name,country,sector_code,registration_id\n"
           "Vetiver Agro Limited,India,agri_food,\n"
           "Willow Power Limited,India,power_utilities,L40100MH2001PLC123456\n"
           "Vetiver Agro Ltd,India,agri_food,\n"
           ",India,,\n"
           "Xylem Water Limited,India,no_such_sector,\n")
    r = admin.post(f"{API}/companies/import", files={"file": ("companies.csv", csv.encode())}).json()
    assert [c["legal_name"] for c in r["created"]] == ["Vetiver Agro Limited", "Willow Power Limited"]
    reasons = {s["row"]: s["reason"] for s in r["skipped"]}
    assert "already exists" in reasons[4] and "required" in reasons[5] and "Unknown sector" in reasons[6]


def test_admin_dashboard_tracks_lifecycle_stages(world, staff):
    admin, a = staff["super_admin"], staff["data_analyst"]
    world.company("Yew Empty Limited")
    waiting = world.company("Zinnia Waiting Limited")
    scored = world.company("Acacia Scored Limited")
    upload(a, scored, brsr_pdf("Acacia Scored Limited"), "acacia.pdf")
    drain()
    upload(a, waiting, brsr_pdf("Zinnia Waiting Limited"), "zinnia.pdf")
    dash = admin.get(f"{API}/admin/dashboard").json()
    stages = {s["stage"]: [c["legal_name"] for c in s["companies"]] for s in dash["companies"]["by_stage"]}
    assert stages["no_reports"] == ["Yew Empty Limited"]
    assert stages["awaiting_extraction"] == ["Zinnia Waiting Limited"]
    assert stages["score_generated"] == ["Acacia Scored Limited"]
    assert dash["system"]["ocr"]["available"] in (True, False) and "detail" in dash["system"]["ocr"]


@pytest.mark.parametrize("text_in,unit,family,base", [
    ("Scope 1 emissions were 1.2 million tCO2e", "tCO2e", "ghg", 1.2e6),
    ("consumed 4,120 GJ", "GJ", "energy", 4120 * 0.2777778),
    ("withdrew 2.4 ML of water", "ML", "volume", 2400),
    ("reduced by 12% this year", "%", "percent", 12),
])
def test_unit_normalisation(text_in, unit, family, base):
    q = U.find_quantities(text_in)[0]
    assert (q.unit, q.family) == (unit, family) and q.base_value == pytest.approx(base, rel=1e-6)


def test_ambiguous_units_and_currency_scales_are_never_guessed():
    assert not [q for q in U.find_quantities("Total waste 3,400 MT") if q.family == "mass"]     # MT is ambiguous
    assert U.find_quantities("in the last 3 years 12,000 tonnes")[0].family == "mass"          # 'years' is not rupees
    assert X.currency_from_label("Revenue (₹ crore)") == ("INR", 1e7, "INR crore")
    assert X.currency_from_label("Revenue") is None
    assert X.currency_from_label("Amount in Rs. lakhs")[1] == 1e5


def test_forward_looking_target_is_not_read_as_a_reported_value():
    page = X.ParsedTable  # noqa: F841 - imported for API stability
    from cxt.extraction.domain import ParsedDocument, ParsedPage
    doc = ParsedDocument("txt", [ParsedPage(1, "Part 1", "Acme Limited Sustainability Report 2024-25. "
                                                        "We will reduce Scope 1 emissions to 50,000 tCO2e by 2030. "
                                                        "Scope 1 emissions in FY2024-25 were 81,200 tCO2e.")])
    ex = X.run_extraction(doc, "acme_sustainability_report.txt", 2025)
    s1 = [k for k in ex.kpis if k.metric_key == "scope1_emissions"]
    assert [k.value for k in s1] == [81200]
