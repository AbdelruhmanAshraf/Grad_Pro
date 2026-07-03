"""Auth + rate-limit + payload guards for the Exercise Recognition + LLM proxy API.

Authentication
--------------
Every protected route depends on `firebase_user` (FastAPI dependency).
The dependency verifies a Firebase ID token from `Authorization: Bearer <id>`
using firebase-admin. The Admin SDK is initialised lazily; if it cannot
authenticate (no credentials available) the dependency falls back to the
"AI_ALLOW_ANONYMOUS" env flag — enabled for local dev only, and hard-refused
in production (APP_ENV=production).

Rate limiting
-------------
Simple per-user, per-window in-memory limiter. Adequate for a single-instance
FastAPI deploy (this module is CPU-bound by MediaPipe anyway; horizontal
scaling needs Redis). Buckets:
  - "frame"          -> bursty pose frames, default 300 calls / 30s
  - "session"        -> session start/end/status,   default 30 calls / 60s
  - "llm"            -> Kimi proxy chat,            default 10 calls / 60s
  - "security_event" -> client-reported events,     default 30 calls / 60s

Payload caps
------------
`assert_payload_size` rejects request bodies larger than the configured
default (4 MB). `assert_frame_payload_size` applies a tighter 1 MB cap to
`/api/frame` so a client cannot exhaust the worker with oversized frames.
"""
from __future__ import annotations

import os
import time
from collections import deque
from dataclasses import dataclass, field
from threading import Lock
from typing import Callable, Deque, Dict, Optional

from fastapi import Depends, Header, HTTPException, Request, status

try:
    import firebase_admin
    from firebase_admin import auth as fb_auth, credentials as fb_credentials
except ImportError:  # firebase-admin is optional in dev installs
    firebase_admin = None
    fb_auth = None
    fb_credentials = None


# --------------------------------------------------------------------------- #
# Firebase Admin bootstrap
# --------------------------------------------------------------------------- #

_FIREBASE_READY = False
_FIREBASE_INIT_LOCK = Lock()


def _firebase_available() -> bool:
    global _FIREBASE_READY
    if firebase_admin is None:
        return False
    if _FIREBASE_READY:
        return True
    with _FIREBASE_INIT_LOCK:
        if _FIREBASE_READY:
            return True
        try:
            if not firebase_admin._apps:  # type: ignore[attr-defined]
                cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
                if cred_path and os.path.exists(cred_path):
                    cred = fb_credentials.Certificate(cred_path)
                    firebase_admin.initialize_app(cred)
                else:
                    firebase_admin.initialize_app()
            _FIREBASE_READY = True
            return True
        except Exception as exc:  # pragma: no cover
            print(f"[security] firebase-admin init failed: {exc}", flush=True)
            return False


# --------------------------------------------------------------------------- #
# Auth dependency
# --------------------------------------------------------------------------- #

_APP_ENV = os.getenv("APP_ENV", "development").lower()
_ANON_REQUESTED = os.getenv("AI_ALLOW_ANONYMOUS", "0") in {"1", "true", "True", "yes"}
ALLOW_ANONYMOUS = _ANON_REQUESTED and _APP_ENV != "production"
if _APP_ENV == "production" and _ANON_REQUESTED:
    print(
        "[security] AI_ALLOW_ANONYMOUS ignored: environment is production",
        flush=True,
    )


@dataclass
class FirebaseUser:
    uid: str
    email: Optional[str] = None
    anonymous: bool = False


async def firebase_user(
    request: Request,
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> FirebaseUser:
    """Verify Firebase ID token from `Authorization: Bearer <token>`.

    Also stashes the resolved uid on `request.state.uid` so the request-log
    middleware can include it (redacted) in structured logs.

    In dev (AI_ALLOW_ANONYMOUS=1 and APP_ENV != production) and when
    firebase-admin is unavailable, accept the request and assign a stable
    anonymous uid so the rest of the pipeline still has someone to bill.
    """
    token: Optional[str] = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()

    if token and _firebase_available():
        try:
            decoded = fb_auth.verify_id_token(token, check_revoked=False)
            user = FirebaseUser(
                uid=decoded["uid"],
                email=decoded.get("email"),
                anonymous=False,
            )
            request.state.uid = user.uid
            return user
        except Exception as exc:
            if ALLOW_ANONYMOUS:
                import base64
                import json
                uid = "anonymous"
                try:
                    parts = token.split(".")
                    if len(parts) >= 2:
                        payload_b64 = parts[1]
                        payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
                        uid = json.loads(base64.urlsafe_b64decode(payload_b64).decode("utf-8")).get("uid", "anonymous")
                except Exception:
                    pass
                print(
                    f"[security] Firebase token verification failed in dev mode, "
                    f"falling back to unverified token uid ({uid}): {exc}",
                    flush=True,
                )
                user = FirebaseUser(uid=uid, anonymous=True)
                request.state.uid = user.uid
                return user
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid Firebase ID token: {exc}",
            ) from exc

    if ALLOW_ANONYMOUS:
        user = FirebaseUser(uid="anonymous", anonymous=True)
        request.state.uid = user.uid
        return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing or invalid Authorization header.",
    )


# --------------------------------------------------------------------------- #
# Rate limiter
# --------------------------------------------------------------------------- #


@dataclass
class _Bucket:
    window_s: float
    limit: int
    hits: Deque[float] = field(default_factory=deque)


class RateLimiter:
    def __init__(self) -> None:
        self._lock = Lock()
        self._users: Dict[str, Dict[str, _Bucket]] = {}
        self._defaults = {
            "frame": (
                float(os.getenv("AI_RATE_FRAME_WINDOW", "30")),
                int(os.getenv("AI_RATE_FRAME_LIMIT", "300")),
            ),
            "session": (
                float(os.getenv("AI_RATE_SESSION_WINDOW", "60")),
                int(os.getenv("AI_RATE_SESSION_LIMIT", "30")),
            ),
            "llm": (
                float(os.getenv("AI_RATE_LLM_WINDOW", "60")),
                int(os.getenv("AI_RATE_LLM_LIMIT", "10")),
            ),
            "security_event": (
                float(os.getenv("AI_RATE_SEC_EVENT_WINDOW", "60")),
                int(os.getenv("AI_RATE_SEC_EVENT_LIMIT", "30")),
            ),
        }

    def check(self, uid: str, scope: str) -> None:
        if ALLOW_ANONYMOUS:
            return  # No rate limits during local dev
        window_s, limit = self._defaults.get(scope, (60.0, 60))
        now = time.monotonic()
        with self._lock:
            user = self._users.setdefault(uid, {})
            bucket = user.get(scope)
            if bucket is None:
                bucket = _Bucket(window_s=window_s, limit=limit)
                user[scope] = bucket
            cutoff = now - bucket.window_s
            while bucket.hits and bucket.hits[0] < cutoff:
                bucket.hits.popleft()
            if len(bucket.hits) >= bucket.limit:
                retry_in = bucket.hits[0] + bucket.window_s - now
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded. Retry in {retry_in:.1f}s.",
                )
            bucket.hits.append(now)


_RATE_LIMITER = RateLimiter()


def rate_limit(scope: str):
    """FastAPI dependency factory: enforces per-uid rate limits for `scope`."""

    async def _dep(user: FirebaseUser = Depends(firebase_user)) -> FirebaseUser:
        _RATE_LIMITER.check(user.uid, scope)
        return user

    return _dep


# --------------------------------------------------------------------------- #
# Payload guard
# --------------------------------------------------------------------------- #

MAX_BODY_BYTES = int(os.getenv("AI_MAX_BODY_BYTES", str(4 * 1024 * 1024)))
MAX_FRAME_BYTES = int(os.getenv("AI_MAX_FRAME_BYTES", str(1 * 1024 * 1024)))


def make_payload_size_dep(max_bytes: int) -> Callable:
    """Factory: FastAPI dependency that rejects Content-Length > max_bytes."""

    async def _dep(request: Request) -> None:
        content_length = request.headers.get("content-length")
        if content_length is not None:
            try:
                if int(content_length) > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"Request body too large (max {max_bytes} bytes).",
                    )
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid Content-Length header.",
                )

    return _dep


assert_payload_size = make_payload_size_dep(MAX_BODY_BYTES)
assert_frame_payload_size = make_payload_size_dep(MAX_FRAME_BYTES)


# --------------------------------------------------------------------------- #
# Logging helper
# --------------------------------------------------------------------------- #


def redact_uid(uid: Optional[str]) -> str:
    """Redact a uid for structured logs — first 6 + last 2 chars."""
    if not uid:
        return "-"
    if len(uid) <= 8:
        return uid[:2] + "…"
    return f"{uid[:6]}…{uid[-2:]}"
