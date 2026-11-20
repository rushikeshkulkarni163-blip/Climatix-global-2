"""
Public-source connectors.

A connector is either OPERATIONAL (it performs real retrieval now) or
PENDING_CONFIGURATION (the interface exists, but the access it needs — an
API agreement, credentials, or confirmation that automated access is
permitted — has not been set up). A pending connector never returns data and
says exactly what is missing; nothing here simulates a source.

Operational today
  public_url       Retrieve one document from a public URL.
  web_discovery    Read a public page (investor relations, sustainability,
                   annual-report archive) and list the report documents it
                   links to, for an analyst to select and ingest.

Both honour robots.txt, identify themselves with a descriptive User-Agent,
refuse non-public network addresses (SSRF guard, re-checked on every
redirect) and enforce the upload size limit.
"""

from __future__ import annotations

import re
import urllib.robotparser
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urljoin, urlparse

import httpx

from .config import get_settings
from .extraction.parsers import UnsupportedFormat, _assert_public_host


class ConnectorError(Exception):
    pass


@dataclass(frozen=True)
class ConnectorInfo:
    key: str
    name: str
    status: str                   # operational | pending_configuration
    description: str
    requires: Optional[str] = None


CONNECTORS: dict[str, ConnectorInfo] = {c.key: c for c in [
    ConnectorInfo("public_url", "Direct document URL", "operational",
                  "Retrieves a single publicly accessible report (PDF, DOCX, XLSX, CSV) from its URL."),
    ConnectorInfo("web_discovery", "Company web page discovery", "operational",
                  "Scans a public investor-relations or sustainability page and lists the report documents it "
                  "links to. An analyst selects which to ingest."),
    ConnectorInfo("bse_filings", "BSE corporate filings", "pending_configuration",
                  "Annual reports and BRSR filings from BSE listing-centre announcements.",
                  "No programmatic access is configured. BSE does not publish an open API for bulk filings; "
                  "a data agreement or licensed feed is required before this connector can be enabled."),
    ConnectorInfo("nse_filings", "NSE corporate filings", "pending_configuration",
                  "Annual reports and BRSR (XBRL) filings from NSE corporate announcements.",
                  "No programmatic access is configured. NSE restricts automated retrieval; a licensed data "
                  "feed or written permission is required before this connector can be enabled."),
    ConnectorInfo("mca_registry", "MCA company master data", "pending_configuration",
                  "Company master data (CIN, registered office, status) from the Ministry of Corporate Affairs.",
                  "Requires an MCA API subscription or an authorised data reseller; no credentials are configured."),
    ConnectorInfo("financial_data_provider", "Licensed financial data provider", "pending_configuration",
                  "Revenue, EBITDA and capital expenditure from a licensed market-data provider.",
                  "No provider has been contracted. Financial figures are currently taken only from the "
                  "company's own published reports."),
]}

_REPORT_HINT = re.compile(
    r"annual[- _]?report|integrated[- _]?report|sustainab|\besg\b|\bbrsr\b|business[- _]responsibility|"
    r"climate|net[- _]?zero|tcfd|carbon|environment|csr[- _]report", re.I)
_DOC_EXT = re.compile(r"\.(pdf|docx|xlsx|csv)(?:$|[?#])", re.I)


def describe() -> list[dict]:
    return [{"key": c.key, "name": c.name, "status": c.status, "description": c.description,
             "requires": c.requires} for c in CONNECTORS.values()]


def require_operational(key: str) -> ConnectorInfo:
    c = CONNECTORS.get(key)
    if not c:
        raise ConnectorError(f"Unknown connector '{key}'")
    if c.status != "operational":
        raise ConnectorError(f"{c.name} is not configured: {c.requires}")
    return c


def _allowlist() -> tuple[str, ...]:
    return tuple(h.strip().lower() for h in get_settings().fetch_allowlist.split(",") if h.strip())


def _robots_allows(client: httpx.Client, url: str) -> bool:
    s = get_settings()
    if not s.respect_robots:
        return True
    p = urlparse(url)
    try:
        r = client.get(f"{p.scheme}://{p.netloc}/robots.txt", timeout=10)
    except httpx.HTTPError:
        return True                       # robots.txt unreachable: no stated restriction
    if r.status_code >= 400:
        return True
    rp = urllib.robotparser.RobotFileParser()
    rp.parse(r.text.splitlines())
    return rp.can_fetch(s.fetch_user_agent, url)


def fetch(url: str, max_bytes: Optional[int] = None) -> tuple[bytes, str, str, str]:
    """Download a public resource. Returns (content, filename, content_type, final_url)."""
    s = get_settings()
    limit = max_bytes or s.max_upload_mb * 1024 * 1024
    current = url.strip()
    headers = {"User-Agent": s.fetch_user_agent, "Accept": "*/*"}
    with httpx.Client(timeout=40, follow_redirects=False, headers=headers) as client:
        for _ in range(5):                # redirects followed manually so each hop is re-validated
            p = urlparse(current)
            if p.scheme not in ("http", "https") or not p.hostname:
                raise ConnectorError("Only http(s) URLs are supported")
            try:
                _assert_public_host(p.hostname, _allowlist())
            except UnsupportedFormat as e:
                raise ConnectorError(str(e))
            except OSError:
                raise ConnectorError(f"Host {p.hostname} could not be resolved")
            if not _robots_allows(client, current):
                raise ConnectorError(f"robots.txt at {p.hostname} does not permit automated retrieval of this URL")
            try:
                with client.stream("GET", current) as r:
                    if r.status_code in (301, 302, 303, 307, 308) and r.headers.get("location"):
                        current = urljoin(current, r.headers["location"])
                        continue
                    if r.status_code >= 400:
                        raise ConnectorError(f"Source returned HTTP {r.status_code}")
                    buf = bytearray()
                    for chunk in r.iter_bytes():
                        buf.extend(chunk)
                        if len(buf) > limit:
                            raise ConnectorError("Remote document exceeds the size limit")
                    ct = r.headers.get("content-type", "").split(";")[0].strip()
            except httpx.HTTPError as e:
                raise ConnectorError(f"Retrieval failed: {type(e).__name__}")
            name = p.path.rsplit("/", 1)[-1] or p.hostname
            cd = re.search(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)"?', r.headers.get("content-disposition", ""), re.I)
            if cd:
                name = cd.group(1).strip()
            name = re.sub(r"[^\w.\- ()]", "_", name)[:200] or "document"
            if "pdf" in ct and not name.lower().endswith(".pdf"):
                name += ".pdf"
            return bytes(buf), name, ct, current
    raise ConnectorError("Too many redirects")


def discover(page_url: str) -> list[dict]:
    """List candidate report documents linked from a public page."""
    from bs4 import BeautifulSoup
    content, _, ct, final = fetch(page_url, max_bytes=8 * 1024 * 1024)
    if "html" not in ct and not content.lstrip()[:15].lower().startswith((b"<!doctype", b"<html")):
        raise ConnectorError("The URL is not an HTML page; use the direct document connector instead")
    soup = BeautifulSoup(content, "html.parser")
    out, seen = [], set()
    for a in soup.find_all("a", href=True):
        href = urljoin(final, a["href"].strip())
        if href in seen or not href.startswith(("http://", "https://")) or not _DOC_EXT.search(href):
            continue
        label = " ".join(a.get_text(" ", strip=True).split())[:200]
        probe = f"{label} {href.rsplit('/', 1)[-1]}"
        if not _REPORT_HINT.search(probe):
            continue
        seen.add(href)
        year = re.search(r"(20[12]\d)\s?[-–_/]\s?(\d{2,4})|\b(20[12]\d)\b", probe)
        out.append({"url": href, "label": label or href.rsplit("/", 1)[-1],
                    "period_hint": year.group(0) if year else None})
    return out[:200]
