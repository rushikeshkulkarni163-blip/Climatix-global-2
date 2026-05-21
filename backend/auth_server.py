"""
Climactix Auth Server — SQLite, no PostgreSQL/Redis required.

Implements every endpoint auth.js calls:
  POST /auth/register
  POST /auth/verify-email
  POST /auth/login
  POST /auth/logout
  GET  /auth/me
  GET  /health

Start:
  cd backend && .venv/bin/python auth_server.py
"""

import hashlib
import hmac
import os
import secrets
import sqlite3
import time
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import Cookie, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Config ────────────────────────────────────────────────
DB_PATH    = Path(__file__).parent / "data" / "auth.db"
COOKIE     = "cx_auth"
SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_hex(32))
PORT       = int(os.getenv("PORT", 8000))

app = FastAPI(title="Climactix Auth")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Database ──────────────────────────────────────────────
@contextmanager
def _db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()

def _init_db():
    with _db() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id           TEXT PRIMARY KEY,
            full_name    TEXT NOT NULL,
            email        TEXT UNIQUE NOT NULL,
            company_name TEXT DEFAULT '',
            pw_hash      TEXT NOT NULL,
            role         TEXT DEFAULT 'user',
            tier         TEXT DEFAULT 'free',
            status       TEXT DEFAULT 'active',
            created_at   TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS sessions (
            id         TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token      TEXT UNIQUE NOT NULL,
            remember   INTEGER DEFAULT 0,
            expires_at REAL,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
        """)

# ── Password hashing (PBKDF2-SHA256, stdlib only) ─────────
def _hash(password: str) -> str:
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
    return f"pbkdf2:{salt}:{h.hex()}"

def _verify(password: str, stored: str) -> bool:
    try:
        _, salt, h = stored.split(":", 2)
        expected = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
        return hmac.compare_digest(expected, bytes.fromhex(h))
    except Exception:
        return False

# ── Session helpers ───────────────────────────────────────
def _make_session(user_id: str, remember: bool) -> str:
    token      = secrets.token_urlsafe(40)
    expires_at = time.time() + 30 * 86_400 if remember else None
    with _db() as db:
        db.execute(
            "INSERT INTO sessions (id, user_id, token, remember, expires_at) VALUES (?,?,?,?,?)",
            (str(uuid.uuid4()), user_id, token, int(remember), expires_at),
        )
    return token

def _user_from_token(token: str) -> Optional[dict]:
    with _db() as db:
        row = db.execute(
            """SELECT u.* FROM users u
               JOIN sessions s ON s.user_id = u.id
               WHERE s.token = ?
                 AND (s.expires_at IS NULL OR s.expires_at > ?)""",
            (token, time.time()),
        ).fetchone()
    return dict(row) if row else None

def _public(u: dict) -> dict:
    return {
        "id":           u["id"],
        "full_name":    u["full_name"],
        "email":        u["email"],
        "company_name": u["company_name"],
        "role":         u["role"],
        "tier":         u["tier"],
        "status":       u["status"],
    }

def _set_cookie(response: Response, token: str, remember: bool):
    response.set_cookie(
        COOKIE,
        token,
        max_age=30 * 86_400 if remember else None,
        httponly=True,
        samesite="lax",
        secure=False,
    )

# ── Request models ────────────────────────────────────────
class RegisterReq(BaseModel):
    full_name:    str
    email:        str
    company_name: str = ""
    password:     str

class VerifyReq(BaseModel):
    email: str
    token: str = ""

class LoginReq(BaseModel):
    email:              str
    password:           str
    remember:           bool = False
    device_fingerprint: str  = ""

# ── Routes ────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "db": "sqlite", "path": str(DB_PATH)}

@app.post("/auth/register", status_code=202)
def register(req: RegisterReq):
    email = req.email.lower().strip()
    if len(req.password) < 8:
        raise HTTPException(400, detail={"code": "weak-password",
                                         "message": "Password must be at least 8 characters."})
    with _db() as db:
        if db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone():
            raise HTTPException(400, detail={"code": "email-in-use",
                                             "message": "An account with this email already exists."})
        uid = str(uuid.uuid4())
        db.execute(
            "INSERT INTO users (id, full_name, email, company_name, pw_hash) VALUES (?,?,?,?,?)",
            (uid, req.full_name.strip(), email, req.company_name.strip(), _hash(req.password)),
        )
    # DEV_MODE: return verify_token immediately so verify-email is a passthrough
    return {"user_id": uid, "verify_token": "dev-bypass", "email": email}

@app.post("/auth/verify-email")
def verify_email(req: VerifyReq, response: Response):
    email = req.email.lower().strip()
    with _db() as db:
        db.execute("UPDATE users SET status = 'active' WHERE email = ?", (email,))
        row = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not row:
        raise HTTPException(404, detail={"code": "not-found", "message": "Account not found."})
    token = _make_session(row["id"], False)
    _set_cookie(response, token, False)
    return {"user": _public(dict(row))}

@app.post("/auth/login")
def login(req: LoginReq, response: Response):
    email = req.email.lower().strip()
    with _db() as db:
        row = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not row or not _verify(req.password, row["pw_hash"]):
        raise HTTPException(401, detail={"code": "invalid-credentials",
                                         "message": "Invalid email or password."})
    token = _make_session(row["id"], req.remember)
    _set_cookie(response, token, req.remember)
    return {"user": _public(dict(row))}

@app.post("/auth/logout")
def logout(response: Response, cx_auth: str = Cookie(default=None)):
    if cx_auth:
        with _db() as db:
            db.execute("DELETE FROM sessions WHERE token = ?", (cx_auth,))
    response.delete_cookie(COOKIE)
    return {"ok": True}

@app.get("/auth/me")
def me(cx_auth: str = Cookie(default=None)):
    if not cx_auth:
        raise HTTPException(401, detail={"code": "unauthenticated", "message": "Not signed in."})
    user = _user_from_token(cx_auth)
    if not user:
        raise HTTPException(401, detail={"code": "unauthenticated", "message": "Session expired."})
    return _public(user)

# ── Stub routes for pages that call these but aren't critical ─
@app.get("/auth/sessions")
def list_sessions(cx_auth: str = Cookie(default=None)):
    user = _user_from_token(cx_auth) if cx_auth else None
    if not user:
        raise HTTPException(401, detail={"code": "unauthenticated", "message": "Not signed in."})
    with _db() as db:
        rows = db.execute(
            "SELECT id, created_at, remember FROM sessions WHERE user_id = ? ORDER BY created_at DESC",
            (user["id"],)
        ).fetchall()
    return [{"id": r["id"], "created_at": r["created_at"], "current": False} for r in rows]

@app.delete("/auth/sessions/{sid}")
def revoke_session(sid: str, cx_auth: str = Cookie(default=None)):
    user = _user_from_token(cx_auth) if cx_auth else None
    if not user:
        raise HTTPException(401, detail={"code": "unauthenticated", "message": "Not signed in."})
    with _db() as db:
        db.execute("DELETE FROM sessions WHERE id = ? AND user_id = ?", (sid, user["id"]))
    return {"ok": True}

if __name__ == "__main__":
    _init_db()
    print(f"\n  Climactix Auth Server")
    print(f"  http://localhost:{PORT}")
    print(f"  SQLite → {DB_PATH}\n")
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")
