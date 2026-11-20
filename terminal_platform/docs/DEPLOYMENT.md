# Deployment

## Components

| Component | Run as | Scale |
|---|---|---|
| API (`uvicorn cxt.main:app`) | container from `Dockerfile` | 1+ replicas behind TLS |
| Worker (`python -m cxt.cli worker`) | same image | 1+ (safe to run several) |
| PostgreSQL 16 with `pg_trgm` | managed database recommended | — |
| Document store | volume at `/data/documents`, or S3-compatible bucket | — |
| Console | the existing Next.js app, with `TERMINAL_API_URL` pointing at the API | — |

## First deployment

1. `cp .env.example .env`; set `TERMINAL_JWT_SECRET` (`openssl rand -hex 32`), `POSTGRES_PASSWORD`, `TERMINAL_CORS_ORIGINS`, `TERMINAL_PUBLIC_APP_URL`. With `TERMINAL_ENV=production` the API refuses to start without a 32+ character secret and sets secure cookies.
2. `docker compose up -d --build`. The API container applies migrations before starting.
3. `docker compose exec api python -m cxt.cli create-admin --email … --name …`
4. Create a second Super Administrator: methodology changes need a different administrator to approve them.
5. Next.js: set `TERMINAL_API_URL=http://<api-host>:8100` and redeploy so the `/cxt-api` rewrite targets it. The console must be served from the same site as the rewrite for the session cookie to apply.
6. Check `GET /api/v1/health` and the System configuration panel on `/console/admin`.

## Before production use

- **TLS** at the load balancer; forward `X-Forwarded-For` (the API trusts it only in production).
- **SMTP** for invitations and password resets.
- **Backups:** schedule `scripts/backup.sh` daily, copy the output off the host, and test `--restore` quarterly. Restore was verified on 17 Nov 2026 against the development database.
- **Malware scanning** of uploads if documents come from outside Climactix.
- **Rate limiting** at the gateway when running more than one API replica.
- **Retention:** sessions, used tokens, finished jobs and orphan logs are purged by the hourly maintenance job (`TERMINAL_SESSION_RETENTION_DAYS`, `TERMINAL_FAILED_JOB_RETENTION_DAYS`). Audit entries are never purged by the application; `TERMINAL_AUDIT_RETENTION_DAYS` documents the 7-year policy for archival outside the live database.
- **Monitoring:** alert on `/health` failures, on failed jobs (`/admin/jobs?status=failed`), on the age of the oldest pending job, and on `verify-audit` returning a broken chain.

## Upgrades

Build the new image; migrations run on API start. Scores computed by an earlier engine version stay reproducible from their stored snapshot; the reproducibility endpoint reports both the stored and the running engine versions.
