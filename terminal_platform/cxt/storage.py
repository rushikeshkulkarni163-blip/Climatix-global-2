"""
Document object storage.

Objects are content-addressed (key derived from the SHA-256 of the bytes), so
a stored document is immutable and a new upload of changed content is a new
object; versioning is tracked on the Document row (version_no, supersedes_id).
Downloads are never served from a public path: the API streams the object
after an authorisation check, or issues a short-lived signed token.

Backends: local filesystem (default) and S3-compatible storage. The S3
backend needs boto3 and TERMINAL_S3_BUCKET; until both are present it reports
itself as not configured instead of silently falling back.
"""

from __future__ import annotations

import hashlib
import hmac
import time
from abc import ABC, abstractmethod
from pathlib import Path

from .config import get_settings


class StorageNotConfigured(RuntimeError):
    pass


class ObjectStore(ABC):
    @abstractmethod
    def put(self, key: str, data: bytes) -> None: ...

    @abstractmethod
    def get(self, key: str) -> bytes: ...

    @abstractmethod
    def exists(self, key: str) -> bool: ...


class LocalStore(ObjectStore):
    def __init__(self, root: str):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        p = (self.root / key).resolve()
        if self.root not in p.parents:
            raise ValueError("Storage key escapes the storage root")
        return p

    def put(self, key: str, data: bytes) -> None:
        p = self._path(key)
        p.parent.mkdir(parents=True, exist_ok=True)
        tmp = p.with_suffix(p.suffix + ".part")
        tmp.write_bytes(data)
        tmp.chmod(0o600)
        tmp.replace(p)

    def get(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def exists(self, key: str) -> bool:
        return self._path(key).exists()


class S3Store(ObjectStore):
    def __init__(self, bucket: str, endpoint: str | None):
        try:
            import boto3
        except ImportError as e:  # pragma: no cover - depends on deployment
            raise StorageNotConfigured("S3 storage selected but boto3 is not installed") from e
        if not bucket:
            raise StorageNotConfigured("S3 storage selected but TERMINAL_S3_BUCKET is not set")
        self.bucket = bucket
        self.client = boto3.client("s3", endpoint_url=endpoint or None)

    def put(self, key: str, data: bytes) -> None:  # pragma: no cover - needs live S3
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ServerSideEncryption="AES256")

    def get(self, key: str) -> bytes:  # pragma: no cover
        return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()

    def exists(self, key: str) -> bool:  # pragma: no cover
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:
            return False


_store: ObjectStore | None = None


def get_store() -> ObjectStore:
    global _store
    if _store is None:
        s = get_settings()
        _store = S3Store(s.s3_bucket, s.s3_endpoint) if s.storage_backend == "s3" else LocalStore(s.storage_dir)
    return _store


def reset_store() -> None:
    global _store
    _store = None


def document_key(sha256: str, file_format: str) -> str:
    return f"documents/{sha256[:2]}/{sha256[2:4]}/{sha256}.{file_format}"


def report_key(company_id: str, report_id: str) -> str:
    return f"reports/{company_id}/{report_id}.pdf"


# ── Short-lived download tokens ──────────────────────────────────────────────

def sign_download(object_id: str, user_id: str, ttl: int | None = None) -> str:
    s = get_settings()
    exp = int(time.time()) + (ttl or s.download_token_seconds)
    msg = f"{object_id}:{user_id}:{exp}".encode()
    sig = hmac.new(s.jwt_secret.encode(), msg, hashlib.sha256).hexdigest()
    return f"{exp}.{sig}"


def verify_download(token: str, object_id: str, user_id: str) -> bool:
    try:
        exp_s, sig = token.split(".", 1)
        exp = int(exp_s)
    except ValueError:
        return False
    if exp < time.time():
        return False
    msg = f"{object_id}:{user_id}:{exp}".encode()
    good = hmac.new(get_settings().jwt_secret.encode(), msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(good, sig)
