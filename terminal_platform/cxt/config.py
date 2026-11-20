"""
Runtime configuration. Every value comes from the environment (prefix
TERMINAL_) or a local .env file that is never committed. There are no
default secrets: outside TERMINAL_ENV=development/test the service refuses
to start without an explicit JWT secret.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="TERMINAL_", env_file=str(ROOT / ".env"), extra="ignore")

    env: str = "development"                       # development | test | production
    database_url: str = "postgresql+psycopg://localhost/climactix_terminal"
    jwt_secret: str = ""
    jwt_issuer: str = "climactix-terminal"
    access_token_minutes: int = 30
    session_hours: int = 12
    cookie_name: str = "cxt_session"
    cookie_secure: bool = False                    # forced True in production
    cors_origins: str = "http://localhost:3000"
    public_app_url: str = "http://localhost:3000/console"
    # Local development only: one-click sign-in from loopback. Refused in production.
    dev_login: bool = False

    # Document storage
    storage_backend: str = "local"                 # local | s3
    storage_dir: str = str(ROOT / "var" / "documents")
    s3_bucket: str = ""
    s3_endpoint: str = ""
    max_upload_mb: int = 60
    download_token_seconds: int = 300

    # Public-source ingestion
    fetch_allowlist: str = ""                      # comma-separated hosts; empty = any public host
    fetch_user_agent: str = "ClimactixTerminalBot/1.0 (public disclosure retrieval)"
    respect_robots: bool = True

    # Extraction
    review_confidence_threshold: float = 70.0      # data points below this go to human review
    llm_provider: str = ""                         # "" (disabled) | anthropic
    llm_model: str = "claude-sonnet-5-5"
    anthropic_api_key: str = ""

    # Outbound email (password recovery, invitations)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""

    # Abuse controls
    rate_limit_per_minute: int = 240
    auth_rate_limit_per_minute: int = 10
    max_failed_logins: int = 5
    lockout_minutes: int = 15

    # Data retention
    audit_retention_days: int = 2555               # 7 years
    failed_job_retention_days: int = 90
    session_retention_days: int = 30

    @model_validator(mode="after")
    def _check(self) -> "Settings":
        if self.env not in ("development", "test", "production"):
            raise ValueError("TERMINAL_ENV must be development, test or production")
        if not self.jwt_secret:
            if self.env == "production":
                raise ValueError("TERMINAL_JWT_SECRET must be set in production")
            # Per-process random secret: sessions do not survive a restart, and
            # nothing guessable is ever used to sign a token.
            import secrets
            self.jwt_secret = secrets.token_urlsafe(48)
        if self.env == "production":
            if self.dev_login:
                raise ValueError("TERMINAL_DEV_LOGIN cannot be enabled in production")
            if len(self.jwt_secret) < 32:
                raise ValueError("TERMINAL_JWT_SECRET must be at least 32 characters")
            self.cookie_secure = True
        return self

    @property
    def email_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_from)

    @property
    def llm_configured(self) -> bool:
        return self.llm_provider == "anthropic" and bool(self.anthropic_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
