"""Document ingestion, validation, extraction, company mapping, contradictions, review and versioning."""

import io

import pytest

from cxt.extraction import catalogue as X
from tests.conftest import drain, upload
from tests.fixtures.make_samples import brsr_pdf, scanned_pdf

API = "/api/v1"


def test_rejects_unsafe_and_unsupported_files(world, staff):
    a = staff["data_analyst"]
    cid = world.company("Elm Steel Limited", sector="metals_mining")
    cases = [
        ("empty.pdf", b"", 422),
        ("fake.pdf", b"MZ\x90\x00 not a pdf", 415),
        ("script.pdf", b"%PDF-1.4\n1 0 obj << /OpenAction << /JS (app.alert(1)) >> >>", 415),
        ("macro.xlsm", b"PK\x03\x04", 415),
        ("legacy.doc", b"\xd0\xcf\x11\xe0", 415),
        ("../../etc/passwd.pdf", b"%PDF-1.4", 422),
        ("notes.exe", b"MZ", 415),
    ]
    for name, data, code in cases:
        r = a.post(f"{API}/companies/{cid}/documents", files={"file": (name, data, "application/pdf")})
        assert r.status_code == code, (name, r.text)
    big = b"%PDF-1.4\n" + b"0" * (61 * 1024 * 1024)
    assert a.post(f"{API}/companies/{cid}/documents", files={"file": ("big.pdf", big)}).status_code == 413


def test_csv_xlsx_and_docx_are_extracted(world, staff):
    import docx
    import openpyxl
    a = staff["data_analyst"]
    cid = world.company("Fir Chemicals Limited", sector="chemicals")
    csv = (b"Fir Chemicals Limited environmental data\nParameter,Unit,FY 2024-25,FY 2023-24\n"
           b"Total Scope 1 emissions,tCO2e,\"50,100\",\"52,300\"\nTotal water withdrawal,kilolitres,\"810,000\",\"799,000\"\n")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "GHG"
    for row in (["Fir Chemicals Limited GHG inventory"], ["Parameter", "Unit", "FY 2024-25", "FY 2023-24"],
                ["Total Scope 2 emissions (location-based)", "tCO2e", 33000, 35100]):
        ws.append(row)
    xb = io.BytesIO(); wb.save(xb)
    d = docx.Document()
    d.add_heading("Fir Chemicals Limited Sustainability Report 2024-25", 1)
    d.add_paragraph("Fir Chemicals Limited has set a target to reach net zero Scope 1 and Scope 2 emissions by 2050.")
    d.add_paragraph("The Board oversees sustainability through its ESG Committee.")
    db = io.BytesIO(); d.save(db)
    for name, data in (("fir_env_fy2024-25.csv", csv), ("fir_ghg_fy2024-25.xlsx", xb.getvalue()),
                       ("fir_sustainability_report_2024-25.docx", db.getvalue())):
        r = a.post(f"{API}/companies/{cid}/documents", files={"file": (name, data)}, data={"fiscal_year": "2024-25"})
        assert r.status_code == 202, r.text
    drain()
    pts = {p["metric_key"]: p for p in a.get(f"{API}/companies/{cid}/data-points", params={"year": "2025"}).json()["items"]}
    assert pts["scope1_emissions"]["value"] == 50100
    assert pts["water_withdrawal"]["normalized_value"] == 810000
    assert pts["scope2_location"]["value"] == 33000 and pts["scope2_location"]["provenance"]["source_location"].startswith("Part")
    nz = a.get(f"{API}/companies/{cid}/net-zero").json()
    assert nz["summary"]["net_zero_year"] == 2050
    assert any(s["metric_key"] == "governance.climate_committee" for s in a.get(f"{API}/companies/{cid}").json()["signals"])


def test_scanned_pdf_without_ocr_goes_to_review_not_to_fabrication(world, staff):
    if X.ocr_available():
        pytest.skip("Tesseract is installed; this test covers the no-OCR path")
    a = staff["data_analyst"]
    cid = world.company("Gum Paper Limited", sector="consumer_goods")
    doc = upload(a, cid, scanned_pdf(), "scanned_annual_report.pdf").json()
    drain()
    d = a.get(f"{API}/documents/{doc['id']}").json()
    assert d["status"] == "requires_review" and d["data_points"] == 0
    items = a.get(f"{API}/review/items", params={"kind": "ocr_unavailable"}).json()
    assert items and "OCR is not available" in items[0]["summary"]
    assert a.get(f"{API}/companies/{cid}").json()["public_score"] is None
    img = a.post(f"{API}/companies/{cid}/documents", files={"file": ("page.png", b"\x89PNG\r\n\x1a\n" + b"0" * 64)})
    assert img.status_code == 202
    drain()
    assert a.get(f"{API}/documents/{img.json()['id']}").json()["status"] in ("requires_review", "failed")


def test_unassigned_upload_is_mapped_from_document_text(world, staff):
    a = staff["data_analyst"]
    hazel = world.company("Hazel Power Limited", sector="power_utilities")
    world.company("Ivy Foods Limited", sector="agri_food")
    r = a.post(f"{API}/documents", files={"file": ("brsr.pdf", brsr_pdf("Hazel Power Limited"))})
    assert r.status_code == 202
    drain()
    d = a.get(f"{API}/documents/{r.json()['id']}").json()
    assert d["company"]["id"] == str(hazel) and d["status"] == "completed"
    assert any("Mapped to Hazel Power Limited" in l["message"] for l in d["processing_log"])


def test_unknown_company_and_mismatch_go_to_mapping_review(world, staff):
    a = staff["data_analyst"]
    juniper = world.company("Juniper Glass Limited", sector="other")
    world.company("Kestrel Tyres Limited", sector="automobiles")
    r = a.post(f"{API}/documents", files={"file": ("x.pdf", brsr_pdf("Lotus Unknown Limited"))})
    drain()
    d = a.get(f"{API}/documents/{r.json()['id']}").json()
    assert d["status"] == "requires_review" and d["company"] is None
    item = a.get(f"{API}/review/items", params={"kind": "company_mapping"}).json()[0]
    # The reviewer assigns the company; the document is reprocessed and joins the repository.
    res = a.post(f"{API}/review/items/{item['id']}/resolve", json={"resolution": "Subsidiary filing", "company_id": str(juniper)})
    assert res.json()["reprocess_queued"] is True
    drain()
    assert a.get(f"{API}/documents/{r.json()['id']}").json()["company"]["id"] == str(juniper)
    # A report naming a different known company than the one it was filed under is held for review.
    kestrel_doc = upload(a, juniper, brsr_pdf("Kestrel Tyres Limited"), "kestrel.pdf").json()
    drain()
    assert a.get(f"{API}/documents/{kestrel_doc['id']}").json()["status"] == "requires_review"


def test_contradiction_is_flagged_withheld_and_settled_by_review(world, staff):
    a, rev = staff["data_analyst"], staff["assessment_reviewer"]
    cid = world.company("Maple Logistics Limited", sector="transport_logistics")
    upload(a, cid, brsr_pdf("Maple Logistics Limited"), "maple_brsr.pdf", category="BRSR")
    upload(a, cid, brsr_pdf("Maple Logistics Limited", s1=(150000, 196300)), "maple_sustainability.pdf",
           category="SUSTAINABILITY_REPORT")
    drain()
    items = a.get(f"{API}/review/items", params={"kind": "contradiction"}).json()
    c = next(i for i in items if i["detail"]["metric_key"] == "scope1_emissions")
    assert c["detail"]["fiscal_year"] == 2025 and {v["value"] for v in c["detail"]["values"]} == {182400, 150000}
    score = a.get(f"{API}/companies/{cid}").json()["public_score"]
    assert {"metric": "scope1_emissions", "fy": 2025} in score["result"]["deductions"][0]["evidence"] or \
        any(d["id"] == "open_contradictions" for d in score["result"]["deductions"])
    ep1 = next(i for p in score["result"]["pillars"] for i in p["indicators"] if i["id"] == "ep1")
    assert ep1["status"] in ("conflicting_data", "insufficient_evidence")
    right = next(v for v in c["detail"]["values"] if v["value"] == 182400)
    rev.post(f"{API}/data-points/{right['data_point_id']}/review", json={"decision": "verify", "note": "Matches BRSR p.2"})
    drain()
    assert not [i for i in a.get(f"{API}/review/items", params={"kind": "contradiction"}).json()
                if i["detail"]["metric_key"] == "scope1_emissions"]
    after = a.get(f"{API}/companies/{cid}").json()["public_score"]
    ep1 = next(i for p in after["result"]["pillars"] for i in p["indicators"] if i["id"] == "ep1")
    assert ep1["status"] == "scored"


def test_reviewer_correction_keeps_the_original_value(world, staff):
    a, rev = staff["data_analyst"], staff["assessment_reviewer"]
    cid = world.company("Neem Pharma Limited", sector="pharma_healthcare")
    upload(a, cid, brsr_pdf("Neem Pharma Limited"), "neem.pdf")
    drain()
    dp = a.get(f"{API}/companies/{cid}/data-points", params={"metric": "hazardous_waste", "year": "2025"}).json()["items"][0]
    assert rev.post(f"{API}/data-points/{dp['id']}/review", json={"decision": "correct", "corrected_value": 3210}).status_code == 422
    r = rev.post(f"{API}/data-points/{dp['id']}/review", json={"decision": "correct", "corrected_value": 3210,
                                                               "note": "Typo in table; footnote 4 gives 3,210 t"})
    assert r.status_code == 200 and r.json()["value"] == 3210 and r.json()["verification_status"] == "verified"
    orig = a.get(f"{API}/data-points/{dp['id']}").json()
    assert orig["value"] == 3120 and orig["verification_status"] == "rejected"
    assert rev.post(f"{API}/data-points/{dp['id']}/review", json={"decision": "verify"}).status_code == 409


def test_new_report_for_same_period_supersedes_and_history_is_kept(world, staff):
    a = staff["data_analyst"]
    cid = world.company("Oak Realty Limited", sector="real_estate")
    first = upload(a, cid, brsr_pdf("Oak Realty Limited"), "oak_v1.pdf", category="BRSR").json()
    drain()
    second = upload(a, cid, brsr_pdf("Oak Realty Limited", s1=(181000, 196300)), "oak_v2.pdf", category="BRSR").json()
    drain()
    d2 = a.get(f"{API}/documents/{second['id']}").json()
    assert d2["version_no"] == 2 and d2["supersedes_id"] == first["id"]
    repo = a.get(f"{API}/companies/{cid}/repository").json()
    assert [d["filename"] for d in repo["years"][0]["documents"]] == ["oak_v2.pdf"]
    hist = a.get(f"{API}/companies/{cid}/repository", params={"include_history": True}).json()
    assert len(hist["years"][0]["documents"]) == 2
    # Only the current version feeds the score; no contradiction is raised against a superseded report.
    assert not [i for i in a.get(f"{API}/review/items", params={"kind": "contradiction"}).json()
                if i["company"] and i["company"]["id"] == str(cid)]
    score = a.get(f"{API}/companies/{cid}").json()["public_score"]
    assert score["result"]["pillars"][0]["indicators"][0]["detail"]["latest_value"] == 181000 + 96200
    cmp_ = a.get(f"{API}/documents/compare/periods", params={"company_id": str(cid), "year_a": "2024", "year_b": "2025"}).json()
    s1 = next(m for m in cmp_["metrics"] if m["metric_key"] == "scope1_emissions")
    assert s1["a"]["value"] == 196300 and s1["b"]["value"] == 181000 and s1["change_pct"] == -7.8


def test_failed_processing_retries_then_surfaces(world, staff, monkeypatch):
    from cxt import pipeline
    from cxt.db import session_scope
    from cxt.models import Job
    a = staff["data_analyst"]
    cid = world.company("Pine Ceramics Limited", sector="cement")
    doc = upload(a, cid, brsr_pdf("Pine Ceramics Limited"), "pine.pdf").json()

    def boom(*args, **kw):
        raise RuntimeError("parser crashed")
    monkeypatch.setattr(pipeline.X, "parse", boom)
    for _ in range(3):
        drain()
        with session_scope() as db:
            for j in db.query(Job).filter(Job.status == "pending"):
                j.run_after = j.created_at                     # skip the back-off wait
    d = a.get(f"{API}/documents/{doc['id']}").json()
    assert d["status"] == "failed" and "parser crashed" in d["error"]
    assert a.get(f"{API}/review/items", params={"kind": "extraction_failure"}).json()
    job = next(j for j in staff["super_admin"].get(f"{API}/admin/jobs", params={"status": "failed"}).json())
    monkeypatch.undo()
    assert staff["super_admin"].post(f"{API}/admin/jobs/{job['id']}/retry").status_code == 202
    drain()
    assert a.get(f"{API}/documents/{doc['id']}").json()["status"] == "completed"


def test_document_download_and_preview(world, staff):
    a = staff["data_analyst"]
    cid = world.company("Quartz Mining Limited", sector="metals_mining")
    pdf = brsr_pdf("Quartz Mining Limited")
    doc = upload(a, cid, pdf, "quartz.pdf").json()
    drain()
    r = a.get(f"{API}/documents/{doc['id']}/download")
    assert r.status_code == 200 and r.content == pdf and r.headers["content-type"] == "application/pdf"
    pages = a.get(f"{API}/documents/{doc['id']}/pages", params={"page": 1, "count": 3}).json()
    assert pages["page_count"] == 3 and len(pages["pages"]) == 3
    assert any(dp["metric_key"] == "scope1_emissions" for dp in pages["pages"][1]["data_points"])
