"""
Operational commands.

    python -m cxt.cli init            install the default methodology and the Climactix organisation
    python -m cxt.cli create-admin    create the first Super Administrator (password from prompt or
                                      TERMINAL_ADMIN_PASSWORD)
    python -m cxt.cli worker          run the background worker
    python -m cxt.cli drain           process queued jobs once and exit
    python -m cxt.cli seed-demo       load SYNTHETIC demonstration companies and documents
    python -m cxt.cli verify-audit    check the audit hash chain
"""

from __future__ import annotations

import argparse
import getpass
import logging
import os
import sys
from datetime import timedelta

from sqlalchemy import func, select

from . import audit, companies, jobs, methodology, pipeline, security
from .db import session_scope
from .models import Organisation, Subscription, User, utcnow


def init() -> None:
    with session_scope() as db:
        m = methodology.ensure_default(db)
        org = db.execute(select(Organisation).where(Organisation.org_type == "climactix")).scalar_one_or_none()
        if not org:
            org = Organisation(name="Climactix Global", org_type="climactix", country="India")
            db.add(org)
            db.flush()
            db.add(Subscription(organisation_id=org.id, plan="internal", status="active", starts_at=utcnow(),
                                entitlements=list(security.ENTITLEMENTS)))
            audit.record(db, None, "system.init", entity_type="organisation", entity_id=org.id,
                         detail={"organisation": org.name})
        print(f"methodology {m.version} approved; organisation '{org.name}' ready")


def create_admin(email: str, name: str) -> None:
    pw = os.environ.get("TERMINAL_ADMIN_PASSWORD") or getpass.getpass("Password for the new Super Administrator: ")
    try:
        security.validate_password(pw)
    except Exception as e:
        sys.exit(f"Password rejected: {getattr(e, 'detail', e)}")
    init()
    with session_scope() as db:
        org = db.execute(select(Organisation).where(Organisation.org_type == "climactix")).scalar_one()
        if db.execute(select(User).where(func.lower(User.email) == email.lower())).first():
            sys.exit(f"A user with email {email} already exists")
        u = User(email=email.lower(), full_name=name, role="super_admin", organisation_id=org.id, status="active",
                 password_hash=security.hash_password(pw))
        db.add(u)
        db.flush()
        audit.record(db, None, "user.create_admin", entity_type="user", entity_id=u.id, detail={"email": u.email})
    print(f"Super Administrator {email} created")


class _System:
    """Actor for seeded demonstration records."""
    user_id = None
    org_id = None
    role = "system"
    email = "seed-demo"
    ip = None


DEMO = [  # (legal name, sector, kwargs for the synthetic BRSR generator)
    ("Meridian Forge Industries Limited", "capital_goods", {}),
    ("Kaveri Basin Cements Limited", "cement",
     dict(s1=(2410000, 2385000), s2=(312000, 318000), s3=(None, None), energy=(18900000, 18400000),
          water=(5120000, 4980000), recycled=(410000, 402000), waste=(96000, 91000), waste_rec=(52000, 50500),
          haz=(4100, 3900), revenue=(6120, 5890), renewable=(9.5, 8.0), assurance=False, net_zero=False)),
    ("Northfield Auto Components Limited", "automobiles",
     dict(s1=(41200, 47800), s2=(88400, 101500), s3=(612000, None), energy=(1180000, 1290000),
          water=(640000, 702000), recycled=(288000, 245000), waste=(18400, 19900), waste_rec=(16100, 16800),
          haz=(820, 960), revenue=(3940, 3510), renewable=(52.0, 38.0))),
    ("Saffron Coast Textiles Limited", "textiles",
     dict(s1=(68000, 66500), s2=(142000, 139000), s3=(None, None), energy=(2460000, 2410000),
          water=(3980000, 3890000), recycled=(596000, 590000), waste=(22100, 21800), waste_rec=(11900, 11700),
          haz=(1320, 1290), revenue=(2210, 2180), renewable=(18.0, 17.0), assurance=False)),
]


def seed_demo() -> None:
    """Synthetic companies with generated documents. They are flagged
    is_synthetic everywhere they appear and never represent real organisations."""
    try:
        from tests.fixtures.make_samples import brsr_pdf
    except ImportError:
        sys.exit("Run from the terminal_platform directory so the sample generator can be imported")
    init()
    actor = _System()
    with session_scope() as db:
        for name, sector, kw in DEMO:
            if db.execute(select(func.count()).select_from(companies.Company).where(
                    companies.Company.legal_name == name)).scalar():
                print(f"exists: {name}")
                continue
            c = companies.create_company(db, actor, legal_name=name, country="India", sector_code=sector,
                                         is_synthetic=True, record_source="synthetic_demo",
                                         description="SYNTHETIC ENTITY created for demonstration and testing. "
                                                     "It does not represent a real company.")
            pdf = brsr_pdf(name, **kw)
            pipeline.ingest_bytes(db, actor, pdf, f"SYNTHETIC_{c.cx_id}_brsr_fy2024-25.pdf", "application/pdf",
                                  company_id=c.id, category="BRSR", source_type="upload",
                                  title=f"{name} — BRSR FY2024-25 (synthetic)")
            print(f"created {c.cx_id} {name}")
    n = jobs.drain()
    print(f"processed {n} job(s)")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    ap = argparse.ArgumentParser(prog="cxt.cli")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("init")
    a = sub.add_parser("create-admin")
    a.add_argument("--email", required=True)
    a.add_argument("--name", required=True)
    sub.add_parser("worker")
    sub.add_parser("drain")
    sub.add_parser("seed-demo")
    sub.add_parser("verify-audit")
    args = ap.parse_args()
    if args.cmd == "init":
        init()
    elif args.cmd == "create-admin":
        create_admin(args.email, args.name)
    elif args.cmd == "worker":
        jobs.work_forever()
    elif args.cmd == "drain":
        print(f"processed {jobs.drain()} job(s)")
    elif args.cmd == "seed-demo":
        seed_demo()
    elif args.cmd == "verify-audit":
        with session_scope() as db:
            r = audit.verify_chain(db)
        print(r)
        sys.exit(0 if r["ok"] else 1)


if __name__ == "__main__":
    main()
