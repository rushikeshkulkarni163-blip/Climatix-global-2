# Climactix Global — Security Architecture

**Classification:** Internal  
**Standard:** SOC 2 Type II / ISO 27001 aligned  
**Last Updated:** 2026-05-29

---

## 1. IMMEDIATE ACTION CHECKLIST

If you are reading this after a potential secret exposure, execute in order:

- [ ] **Revoke Anthropic key** — console.anthropic.com → API Keys → Revoke old key → Create new
- [ ] **Revoke OpenAI keys** (2 keys were present) — platform.openai.com → API Keys → Revoke all old keys
- [ ] **Rotate all `.env` secrets** using the generation commands below
- [ ] **Change admin/analyst passwords** in backend `.env`
- [ ] **Change database password** — update `DB_PASSWORD` and re-initialize Postgres volume
- [ ] **Invalidate all active sessions** — restart backend services to force re-authentication
- [ ] **Run `git log --all`** to verify no secrets were ever committed

---

## 2. SECRET GENERATION

Always generate secrets with a CSPRNG. Never invent them manually.

```bash
# 64-byte hex (for JWT, HMAC secrets, SECRET_KEY)
python3 -c "import secrets; print(secrets.token_hex(64))"

# 32-byte hex (for passwords, shorter secrets)
python3 -c "import secrets; print(secrets.token_hex(32))"

# Base64 URL-safe (for tokens)
python3 -c "import secrets; print(secrets.token_urlsafe(48))"

# Strong password (for human-readable)
openssl rand -base64 24
```

---

## 3. ENVIRONMENT FILE ARCHITECTURE

### Files and their purpose

| File | Purpose | Git status |
|------|---------|------------|
| `.env` | Docker Compose runtime secrets | **NEVER COMMIT** — in `.gitignore` |
| `backend/.env` | FastAPI backend secrets | **NEVER COMMIT** |
| `climactix-ai/.env` | AI engine secrets | **NEVER COMMIT** |
| `climactix-global/.env.local` | Next.js server-side secrets | **NEVER COMMIT** |
| `backend/.env.example` | Safe template (no real values) | Committed — safe |
| `backend/.env.prod.example` | Safe production template | Committed — safe |
| `server/.env.example` | Node.js server template | Committed — safe |

### Frontend environment variable naming rules

| Prefix | Visibility | Example |
|--------|-----------|---------|
| `NEXT_PUBLIC_` | Browser bundle — public | `NEXT_PUBLIC_APP_URL` |
| *(none)* | Server-side only — never in browser | `ANTHROPIC_API_KEY` |

**CRITICAL**: Never prefix AI keys, JWT secrets, or database credentials with `NEXT_PUBLIC_`.

---

## 4. SECRET ROTATION SCHEDULE

| Secret | Rotation Frequency | Trigger Events |
|--------|------------------|----------------|
| AI API keys (Anthropic, OpenAI) | Every 90 days | Any team member departure |
| JWT secret | Every 180 days | Suspected exposure |
| Admin/Analyst passwords | Every 90 days | Any portal access change |
| Database password | Every 180 days | Any credential exposure |
| HMAC secrets | Every 180 days | Any exposure |
| SSL/TLS certificates | Before expiry (auto-renew) | Expiry |

---

## 5. BACKEND SECURITY ARCHITECTURE

### API proxy pattern (enforced)

```
Browser
  │
  ▼
Next.js server (SSR routes / API routes)    ← holds AI keys server-side
  │
  ▼
FastAPI Intelligence Engine                 ← holds DB credentials, HMAC secrets
  │
  ├─▶ Anthropic API
  ├─▶ OpenAI API
  └─▶ PostgreSQL / Redis / Neo4j
```

The browser never has direct access to any external API. All AI calls route through the backend. This prevents key theft from browser DevTools.

### Rate limiting (implemented in `backend/middleware/security.py`)

| Endpoint type | Limit | Window |
|--------------|-------|--------|
| Auth endpoints (`/auth/*`, `/admin/login`) | 10 requests | 60 seconds |
| All other endpoints | 120 requests | 60 seconds |

### Security headers (applied to every response)

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | Restrictive policy — see middleware |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` (production only) |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Permissions-Policy` | All hardware APIs disabled |

---

## 6. PASSWORD HASHING STANDARDS

| Context | Algorithm | Notes |
|---------|----------|-------|
| Next.js (server-side) | `scrypt` via Node `crypto` | Per-user random 32-byte salt, N=16384 |
| Frontend localStorage fallback | `SubtleCrypto SHA-256` | Dev/demo mode only — real auth uses Firebase |
| Internal analyst portal | `SubtleCrypto SHA-256` | localStorage — not for production auth |

**Deprecated (removed):** `btoa(password + salt)` — base64 encoding is not hashing.

---

## 7. DEMO ACCOUNT CONFIGURATION

Demo credentials are no longer stored in source code. Configure via runtime config:

```html
<!-- In your local dev HTML page (NOT committed) -->
<script>
  window.CX_DEMO_CONFIG = {
    enabled: true,
    password: "your-local-demo-password"
  };
</script>
```

Or set `SEED_ADMIN_PASSWORD`, `SEED_ANALYST_PASSWORD`, `SEED_DEMO_PASSWORD` in `climactix-global/.env.local` for the Next.js app.

---

## 8. DOCKER SECURITY

### Port policy (as of docker-compose.yml hardening)

| Service | Previous | Current |
|---------|---------|---------|
| PostgreSQL | `5432:5432` (exposed to host) | `expose: 5432` (internal only) |
| Redis | `6379:6379` (exposed) | `expose: 6379` (internal only) |
| Intelligence Engine | `8000:8000` (exposed) | `expose: 8000` (internal only) |
| Neo4j | `7474/7687` (exposed) | `expose` (internal only) |
| Kafka | `9092:9092` (exposed) | `expose: 9092` (internal only) |
| Grafana | `3001:3000` (exposed) | `expose: 3000` (internal only) |
| Prometheus | `9090:9090` (exposed) | `expose: 9090` (internal only) |
| Frontend | `3000:3000` (public) | `3000:3000` (public — intentional) |

### Required environment variables

All Docker services now **require** explicit env var values. No `${VAR:-default}` fallbacks for credentials. The compose file will fail if required vars are missing.

---

## 9. GITHUB SECURITY CONFIGURATION

Enable these settings in GitHub repository settings:

**Security → Code security and analysis:**
- [x] Dependency graph
- [x] Dependabot alerts
- [x] Dependabot security updates
- [x] Secret scanning
- [x] Push protection (blocks commits containing secrets)
- [x] Code scanning (uses GitHub Actions SARIF uploads)

**Branches → Branch protection rules for `main`:**
- [x] Require pull request reviews (minimum 1)
- [x] Require status checks to pass: `secret-scan`, `python-security`, `node-audit`
- [x] Require linear history
- [x] Do not allow bypassing the above settings

---

## 10. INCIDENT RESPONSE

### If a secret is confirmed exposed:

1. **Immediately revoke** the affected key/secret at the provider
2. **Generate a replacement** using the commands in Section 2
3. **Update** all `.env` files with the new secret
4. **Force-invalidate** sessions by restarting affected services
5. **Search git history** for any other copies: `git log --all -S "EXPOSED_VALUE"`
6. **Notify** team members who may have local copies
7. **Document** the incident: what was exposed, when, likely exposure window

### Key contacts

| Service | Rotation Portal |
|---------|----------------|
| Anthropic | console.anthropic.com → API Keys |
| OpenAI | platform.openai.com → API Keys |
| GitHub | github.com/settings/tokens |
| Firebase | console.firebase.google.com |

---

## 11. COMPLIANCE NOTES

### SOC 2 Type II — relevant controls addressed
- CC6.1: Logical access managed via RBAC (admin/analyst/user roles)
- CC6.2: Secrets in environment variables, not source code
- CC6.6: Rate limiting on authentication endpoints
- CC6.7: Security headers prevent clickjacking, XSS, MIME sniffing
- CC7.2: Automated secret scanning via Gitleaks + GitHub secret scanning

### ISO 27001 — relevant domains addressed
- A.9 Access Control: RBAC, session TTLs
- A.10 Cryptography: scrypt for passwords, HMAC-SHA256 for sessions
- A.12 Operations Security: audit logging, dependency scanning
- A.14 System Acquisition: security scanning in CI/CD pipeline
