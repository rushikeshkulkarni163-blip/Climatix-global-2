"""
Climactix Terminal API.

    uvicorn cxt.main:app --port 8100

Interactive API documentation is served at /api/v1/docs (OpenAPI at
/api/v1/openapi.json).
"""

from __future__ import annotations

import logging
import time
import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from . import ratelimit
from .config import get_settings
from .db import session_scope
from .routers import admin, assessments, auth, companies, institutional

log = logging.getLogger("cxt.api")
API = "/api/v1"

DESCRIPTION = """
Corporate sustainability and climate intelligence: company records, a company-wise report repository,
document extraction with provenance, assessments, the Climactix Score and institutional workspaces.

**Authentication.** `POST /auth/login` returns a short-lived bearer token and sets an httpOnly session
cookie. Send `Authorization: Bearer <token>`, or use the cookie together with the header
`X-Requested-With: cxt` on state-changing requests.

**Scores.** The Public Data Score, the Company Assessment Score and the Data Confidence Score are
separate outputs. A score of `null` means the evidence was insufficient, not that performance was poor.
The Climactix Score is not a certification, a credit rating or an assurance opinion.
"""


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title="Climactix Terminal API", version="1.0.0", description=DESCRIPTION,
                  docs_url=f"{API}/docs", redoc_url=None, openapi_url=f"{API}/openapi.json")
    app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in s.cors_origins.split(",") if o.strip()],
                       allow_credentials=True, allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
                       allow_headers=["Authorization", "Content-Type", "X-Requested-With"])

    @app.middleware("http")
    async def guard(request: Request, call_next):
        rid = uuid.uuid4().hex[:12]
        started = time.perf_counter()
        ip = request.client.host if request.client else "unknown"
        if request.url.path.startswith(API) and s.env != "test":
            bucket, limit = ratelimit.limits_for(request.url.path)
            ok, retry = ratelimit.check(f"{bucket}:{ip}", limit)
            if not ok:
                return JSONResponse({"error": {"code": 429, "message": "Too many requests. Slow down and retry.",
                                               "request_id": rid}}, status_code=429,
                                    headers={"Retry-After": str(retry)})
        try:
            response = await call_next(request)
        except Exception:
            log.exception("unhandled error rid=%s %s %s", rid, request.method, request.url.path)
            return JSONResponse({"error": {"code": 500, "message": "Internal error. Quote the request id to support.",
                                           "request_id": rid}}, status_code=500)
        p = getattr(request.state, "principal", None)
        if p is not None and p.refreshed_token:
            response.set_cookie(s.cookie_name, p.refreshed_token, httponly=True, secure=s.cookie_secure,
                                samesite="lax", max_age=s.session_hours * 3600, path="/")
        response.headers["X-Request-ID"] = rid
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = response.headers.get("Cache-Control", "no-store")
        if s.env == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        log.info("%s %s %s %.0fms rid=%s user=%s", request.method, request.url.path, response.status_code,
                 (time.perf_counter() - started) * 1000, rid, getattr(p, "email", "-"))
        return response

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        body = {"code": exc.status_code}
        if isinstance(exc.detail, dict):
            body.update(exc.detail)
        else:
            body["message"] = exc.detail
        return JSONResponse({"error": body}, status_code=exc.status_code, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        fields = [{"field": ".".join(str(x) for x in e["loc"][1:]), "problem": e["msg"]} for e in exc.errors()]
        return JSONResponse({"error": {"code": 422, "message": "The request is not valid", "fields": fields}},
                            status_code=422)

    @app.get(f"{API}/health", tags=["System"])
    def health():
        """Liveness and database connectivity."""
        try:
            with session_scope() as db:
                db.execute(text("SELECT 1"))
                rev = db.execute(text("SELECT version_num FROM alembic_version")).scalar()
            return {"status": "ok", "database": "ok", "schema_revision": rev, "version": app.version}
        except Exception:
            return JSONResponse({"status": "degraded", "database": "unavailable"}, status_code=503)

    for r in (auth.router, companies.router, assessments.router, institutional.router, admin.router):
        app.include_router(r, prefix=API)
    return app


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
app = create_app()
