"""
End-to-end: the final acceptance workflow, driven through the HTTP API
against PostgreSQL, the real pipeline and the real scoring engine.
Step numbers refer to the acceptance criteria in docs/ARCHITECTURE.md.
"""

from sqlalchemy import select

from cxt.db import session_scope
from cxt.models import AuditLog, Company, Document
from tests.conftest import drain, upload
from tests.fixtures.make_samples import brsr_pdf

API = "/api/v1"


def test_full_data_lifecycle(world, staff):
    admin, analyst, reviewer = staff["super_admin"], staff["data_analyst"], staff["assessment_reviewer"]

    # 1-2. An administrator creates a company; it receives a unique corporate profile.
    r = analyst.post(f"{API}/companies", json={"legal_name": "Meridian Forge Industries Limited", "country": "India",
                                              "sector_code": "capital_goods", "is_synthetic": True,
                                              "registration_id": "L28920MH1995PLC004520"})
    assert r.status_code == 201, r.text
    company = r.json()
    cid = company["id"]
    assert company["cx_id"] == "CX-000001" and company["registration_type"] == "CIN"
    dup = analyst.post(f"{API}/companies", json={"legal_name": "MERIDIAN FORGE INDUSTRIES LTD.", "country": "India"})
    assert dup.status_code == 409 and dup.json()["error"]["duplicates"][0]["cx_id"] == "CX-000001"

    # 3. A public report is uploaded. The upload is accepted for processing, not merely filed.
    report = brsr_pdf()
    r = upload(analyst, cid, report, "meridian_forge_brsr_fy2024-25.pdf")
    assert r.status_code == 202, r.text
    doc_id = r.json()["id"]
    assert r.json()["status"] == "pending"
    assert upload(analyst, cid, report, "copy.pdf").json()["duplicate"] is True         # duplicate detection (same bytes)

    # 4-5. The worker processes, classifies and maps it to the company and reporting year.
    assert drain() >= 2                                         # process_document, then assess_company
    d = analyst.get(f"{API}/documents/{doc_id}").json()
    assert d["status"] == "completed" and d["stage"] == "repository"
    assert d["category"] == "BRSR" and d["fiscal_year"] == 2025 and d["fy_label"] == "FY2024-25"
    assert d["company"]["cx_id"] == "CX-000001"
    stages = [l["stage"] for l in d["processing_log"]]
    for s in ("ingestion", "extraction", "classification", "validation", "company_mapping", "repository"):
        assert s in stages
    assert d["data_points"] > 20

    # 6. Every extracted data point traces to its source.
    pts = analyst.get(f"{API}/companies/{cid}/data-points", params={"metric": "scope1_emissions"}).json()["items"]
    cur = next(p for p in pts if p["fiscal_year"] == 2025)
    assert cur["value"] == 182400 and cur["unit"] == "tCO2e"
    prov = cur["provenance"]
    assert prov["document_id"] == doc_id and prov["page_no"] == 2 and prov["reporting_period"] == "FY2024-25"
    assert prov["extraction_method"] == "table" and "Scope 1" in prov["quote"] and prov["extracted_at"]
    assert cur["verification_status"] == "extracted" and 0 < cur["confidence"] <= 100
    page = analyst.get(f"{API}/documents/{doc_id}/pages", params={"page": prov["page_no"]}).json()["pages"][0]
    assert "182,400" in page["text"] or any("182,400" in c for t in page["tables"] for row in t["rows"] for c in row)
    energy = analyst.get(f"{API}/companies/{cid}/data-points", params={"metric": "total_energy", "year": "FY2024-25"}).json()["items"][0]
    assert energy["value"] == 4120000 and energy["unit"] == "GJ"                         # as reported
    assert energy["normalized_unit"] == "MWh" and abs(energy["normalized_value"] - 1144444.5) < 1   # normalised
    rev = analyst.get(f"{API}/companies/{cid}/data-points", params={"metric": "revenue", "year": "2025"}).json()["items"][0]
    assert rev["unit"] == "INR crore" and rev["normalized_value"] == 8420 * 1e7

    # 7. The company-wise repository updated automatically.
    repo = analyst.get(f"{API}/companies/{cid}/repository").json()
    assert repo["years"][0]["fy_label"] == "FY2024-25"
    assert repo["years"][0]["documents"][0]["category_label"] == "BRSR Report"
    assert analyst.get(f"{API}/companies/{cid}/repository", params={"category": "ANNUAL_REPORT"}).json()["total"] == 0

    # 8, 11, 12. The assessment engine analysed the evidence: Public Data Score and independent confidence.
    prof = analyst.get(f"{API}/companies/{cid}").json()
    pub = prof["public_score"]
    assert pub is not None and 0 <= pub["overall"] <= 100 and pub["methodology_version"] == "1.0"
    assert pub["confidence"] != pub["overall"] and pub["result"]["confidence"]["components"]["verification"] == 0
    assert len(pub["result"]["pillars"]) == 6 and prof["company_score"] is None
    assert pub["result"]["gaps"], "indicators without evidence are reported, not scored"
    rep = analyst.get(f"{API}/scores/{pub['id']}/reproduce").json()
    assert rep["reproduced"] is True and rep["overall"] == pub["overall"]

    # 10 (public channel). A reviewer verifies a value: confidence rises, a new score version is kept.
    r = reviewer.post(f"{API}/data-points/{cur['id']}/review", json={"decision": "verify", "note": "Checked against p.2"})
    assert r.status_code == 200 and r.json()["verification_status"] == "verified"
    drain()
    prof2 = analyst.get(f"{API}/companies/{cid}").json()
    assert prof2["public_score"]["id"] != pub["id"]
    assert prof2["public_score"]["confidence"] > pub["confidence"]
    assert prof2["public_score"]["overall"] == pub["overall"]          # verification changes confidence, not performance

    # 9. The company registers and submits additional assessment information with evidence.
    co_org = admin.post(f"{API}/admin/organisations", json={"name": "Meridian Forge", "org_type": "company",
                                                           "company_id": cid}).json()
    admin.post(f"{API}/admin/subscriptions", json={"organisation_id": co_org["id"], "plan": "company_annual"})
    inv = admin.post(f"{API}/admin/users/invite", json={"email": "esg@meridianforge.example.com", "full_name": "Asha Rao",
                                                       "role": "company_admin", "organisation_id": co_org["id"]}).json()
    assert inv["email_delivered"] is False and "token=" in inv["invite_link"]      # SMTP is not configured: stated, not hidden
    token = inv["invite_link"].split("token=")[1]
    from fastapi.testclient import TestClient
    from cxt.main import app
    anon = TestClient(app)
    assert anon.post(f"{API}/auth/invite/accept", json={"token": token, "password": "Meridian-Forge-2026x"}).status_code == 200  # test fixture  # pragma: allowlist secret  gitleaks:allow
    assert anon.post(f"{API}/auth/invite/accept", json={"token": token, "password": "Meridian-Forge-2026x"}).status_code == 400  # test fixture  # pragma: allowlist secret  gitleaks:allow
    r = anon.post(f"{API}/auth/login", json={"email": "esg@meridianforge.example.com", "password": "Meridian-Forge-2026x"})  # test fixture  # pragma: allowlist secret  gitleaks:allow
    company_user = TestClient(app)
    company_user.headers["Authorization"] = f"Bearer {r.json()['access_token']}"

    portal = company_user.get(f"{API}/portal").json()
    assert portal["company"]["cx_id"] == "CX-000001" and portal["public_score"]["overall"] == pub["overall"]
    a = company_user.post(f"{API}/assessments", json={"fiscal_year": 2025}).json()
    aid = a["id"]
    assert a["version_no"] == 1 and a["status"] == "draft" and a["progress"]["missing_required"]
    ev = upload(company_user, cid, brsr_pdf(renewable=(46.0, 30.0)), "internal_energy_statement.pdf",
                category="SUPPORTING_EVIDENCE", fiscal_year="2024-25").json()
    assert ev["visibility"] == "private"
    drain()
    answers = {
        "ep_scope1": {"value": {"value": 182400, "prior_value": 196300}, "evidence_document_id": ev["id"]},
        "ep_scope2": {"value": {"value": 96200, "prior_value": 104800}, "evidence_document_id": ev["id"]},
        "ep_water": {"value": {"value": 2860000, "prior_value": 3010000}, "source_declaration": "Plant water meters, FY2024-25 ledger"},
        "ep_revenue": {"value": {"value": 8420, "prior_value": 7910}, "source_declaration": "Audited financial statements FY2024-25"},
        "re_energy": {"value": {"value": 4120000, "prior_value": 4310000}, "evidence_document_id": ev["id"]},
        "re_renewable": {"value": {"value": 46}, "evidence_document_id": ev["id"]},
        "cs_netzero": {"value": {"value": "yes"}, "evidence_document_id": ev["id"]},
        "cs_netzero_year": {"value": {"value": 2045}, "evidence_document_id": ev["id"]},
        "gd_board": {"value": {"value": "yes"}, "source_declaration": "Board charter, clause 4"},
        "gd_assurance": {"value": {"value": "Limited assurance"}, "evidence_document_id": ev["id"]},
        "sr_ltifr": {"value": {"value": 0.42}},                       # no evidence and no source declared
    }
    r = company_user.put(f"{API}/assessments/{aid}/answers", json={"answers": answers})
    assert r.status_code == 200, r.text
    r = company_user.post(f"{API}/assessments/{aid}/submit")
    assert r.status_code == 422 and r.json()["error"]["answers_without_source"][0]["question_id"] == "sr_ltifr"
    company_user.put(f"{API}/assessments/{aid}/answers",
                     json={"answers": {"sr_ltifr": {"value": {"value": 0.42}, "source_declaration": "Safety register 2024-25"}}})
    r = company_user.post(f"{API}/assessments/{aid}/submit")
    assert r.status_code == 200 and r.json()["status"] == "submitted" and r.json()["editable"] is False
    assert company_user.put(f"{API}/assessments/{aid}/answers", json={"answers": {"re_renewable": {"value": {"value": 99}}}}).status_code == 409

    # 10. Evidence is reviewed and validated.
    assert reviewer.get(f"{API}/review/assessments").json()[0]["id"] == aid
    assert reviewer.post(f"{API}/assessments/{aid}/validate", json={}).status_code == 422       # evidence undecided
    for q in ("ep_scope1", "ep_scope2", "re_energy", "re_renewable", "cs_netzero", "cs_netzero_year"):
        assert reviewer.post(f"{API}/assessments/{aid}/answers/{q}/review", json={"decision": "accept"}).status_code == 200
    assert reviewer.post(f"{API}/assessments/{aid}/answers/gd_assurance/review", json={"decision": "reject"}).status_code == 422
    reviewer.post(f"{API}/assessments/{aid}/answers/gd_assurance/review",
                  json={"decision": "reject", "comment": "The statement does not name the assurance provider"})
    assert reviewer.post(f"{API}/assessments/{aid}/answers/ep_water/review", json={"decision": "accept"}).status_code == 422
    r = reviewer.post(f"{API}/assessments/{aid}/validate", json={"comment": "Reviewed against submitted statement"})
    assert r.status_code == 200, r.text
    done = r.json()
    assert done["status"] == "scored"
    co = done["score"]

    # 11-12. Company Assessment Score: separate from, and never altering, the Public Data Score.
    assert co["score_type"] == "company" and co["id"] != prof2["public_score"]["id"]
    tr4 = next(i for p in co["result"]["pillars"] for i in p["indicators"] if i["id"] == "tr4")
    assert tr4["detail"]["value"] == 46 and tr4["evidence"][0]["src"] == "company" and tr4["evidence"][0]["verified"]
    claims = {c["metric"] for c in co["result"]["unverified_claims"]}
    assert "ltifr" in claims                                           # declared without accepted evidence: listed, not scored
    assert any(d["id"] == "rejected_evidence" for d in co["result"]["deductions"])
    after = analyst.get(f"{API}/companies/{cid}").json()
    assert after["public_score"]["id"] == prof2["public_score"]["id"]                    # public score untouched
    pub_tr4 = next(i for p in after["public_score"]["result"]["pillars"] for i in p["indicators"] if i["id"] == "tr4")
    assert pub_tr4["detail"]["value"] == 31.5
    assert after["company_score"]["overall"] == co["overall"]

    # 13. History is preserved.
    hist = after["score_history"]
    assert [h["score_type"] for h in hist] == ["public", "public", "company"]
    assert sum(1 for h in hist if h["is_current"]) == 2
    assert {(x["channel"], x["version_no"]) for x in after["assessment_history"]} == {("public", 1), ("public", 2), ("company", 1)}
    events = [e["event"] for e in done["history"]]
    assert events == ["created", "submitted", "review_started", "validated", "scored"]

    # 15-16. An authorised bank searches and reviews the company; private material stays private.
    bank_org = world.org("First Meridian Bank", "bank")
    world.user("credit@fmbank.example.com", "bank_user", bank_org)
    bank = world.login("credit@fmbank.example.com")
    found = bank.get(f"{API}/screen", params={"q": "meridian forge"}).json()
    assert found["total"] == 1 and found["items"][0]["score"] == after["public_score"]["overall"]
    view = bank.get(f"{API}/companies/{cid}").json()
    assert view["access_level"] == "intelligence" and view["public_score"]["overall"] is not None
    assert view["company_score"] is None and "company_score" in view["withheld"]
    assert all(m["values"].get("2025", {}).get("channel", "public") == "public" for m in view["metrics"])
    assert bank.get(f"{API}/assessments/{aid}").status_code == 404
    assert bank.get(f"{API}/documents/{ev['id']}").status_code == 404
    assert bank.get(f"{API}/scores/{co['id']}").status_code == 403
    assert bank.get(f"{API}/documents/{doc_id}/download").status_code == 200
    nz = bank.get(f"{API}/companies/{cid}/net-zero").json()
    assert nz["summary"]["net_zero_year"] == 2045 and nz["summary"]["near_term"] == {"reduction_pct": 42.0, "target_year": 2030}
    assert nz["progress"]["assessable"] is False and "baseline year (2020)" in nz["progress"]["reason"]
    assert nz["validated_targets"] == []

    # 14. A company intelligence report is generated from the stored data.
    r = bank.post(f"{API}/companies/{cid}/report")
    assert r.status_code == 201, r.text
    pdf = bank.get(f"{API}/reports/{r.json()['id']}/download")
    assert pdf.status_code == 200 and pdf.content[:5] == b"%PDF-" and len(pdf.content) > 5000
    import fitz
    text = " ".join(pg.get_text() for pg in fitz.open(stream=pdf.content, filetype="pdf"))
    assert "Meridian Forge Industries Limited" in text and "CX-000001" in text
    assert f"{after['public_score']['overall']:.1f} / 100" in text and "182,400" in text
    assert "Company Assessment Score" not in text and "SYNTHETIC ENTITY" in text
    assert bank.post(f"{API}/companies/{cid}/report", params={"include_company_assessment": True}).status_code == 403
    own = company_user.post(f"{API}/companies/{cid}/report", params={"include_company_assessment": True})
    assert own.status_code == 201 and own.json()["includes_company_assessment"] is True

    # 17. Every important action is in the audit trail, and the chain is intact.
    log = admin.get(f"{API}/admin/audit", params={"company_id": cid, "limit": 500}).json()
    actions = {i["action"] for i in log["items"]}
    for a_ in ("company.create", "document.ingest", "document.duplicate", "score.compute", "data_point.verify",
               "assessment.create", "assessment.submit", "assessment.evidence_accepted", "assessment.evidence_rejected",
               "assessment.validate", "report.generate", "document.download", "organisation.create"):
        assert a_ in actions, a_
    all_actions = {i["action"] for i in admin.get(f"{API}/admin/audit", params={"limit": 500}).json()["items"]}
    assert {"auth.login", "user.invite", "auth.invite_accepted", "subscription.create"} <= all_actions
    assert admin.get(f"{API}/admin/audit/verify").json() == {"ok": True, "checked": admin.get(f"{API}/admin/audit").json()["total"], "broken_at": None}
    assert bank.get(f"{API}/admin/audit").status_code == 403

    # The admin dashboard shows where the company stands.
    dash = admin.get(f"{API}/admin/dashboard").json()
    stage = {s["stage"]: s["count"] for s in dash["companies"]["by_stage"]}
    assert stage["score_generated"] == 1 and dash["scores"] == {"public_current": 1, "company_current": 1}
    assert dash["system"]["payments"]["configured"] is False
