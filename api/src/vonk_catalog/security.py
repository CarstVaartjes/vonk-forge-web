from __future__ import annotations

import hashlib
import ipaddress
import json
import logging
import re
import time
import uuid
from collections import defaultdict, deque
from collections.abc import Callable

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session, sessionmaker
from starlette.middleware.cors import CORSMiddleware

from .settings import Settings

REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,128}$")
LOGGER = logging.getLogger("vonk_catalog.http")


class SlidingWindowLimiter:
    def __init__(self, limit: int, window_seconds: int, max_keys: int = 10_000):
        self.limit = limit
        self.window_seconds = window_seconds
        self.max_keys = max_keys
        self.events: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str, now: float) -> tuple[bool, int]:
        cutoff = now - self.window_seconds
        bucket = self.events[key]
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
        if len(bucket) >= self.limit:
            return False, max(1, int(bucket[0] + self.window_seconds - now) + 1)
        bucket.append(now)
        if len(self.events) > self.max_keys:
            stale = next(
                (
                    item
                    for item, values in self.events.items()
                    if not values or values[-1] <= cutoff
                ),
                None,
            )
            self.events.pop(stale or next(iter(self.events)), None)
        return True, self.window_seconds


class DatabaseRateLimiter:
    def __init__(
        self,
        sessions: sessionmaker[Session],
        limit: int,
        window_seconds: int,
    ) -> None:
        self.sessions = sessions
        self.limit = limit
        self.window_seconds = window_seconds

    def allow(self, key: str, now: float) -> tuple[bool, int]:
        bucket_start = int(now // self.window_seconds) * self.window_seconds
        with self.sessions.begin() as session:
            count = session.scalar(
                text(
                    """
                    INSERT INTO request_rate_limit_buckets
                        (key_digest, bucket_start, request_count)
                    VALUES (:key, :bucket_start, 1)
                    ON CONFLICT (key_digest, bucket_start)
                    DO UPDATE SET request_count = request_rate_limit_buckets.request_count + 1
                    RETURNING request_count
                    """
                ),
                {"key": key, "bucket_start": bucket_start},
            )
            if count == 1:
                session.execute(
                    text(
                        "DELETE FROM request_rate_limit_buckets WHERE bucket_start < :cutoff"
                    ),
                    {"cutoff": bucket_start - 2 * self.window_seconds},
                )
        retry_after = max(1, int(bucket_start + self.window_seconds - now) + 1)
        return bool(count is not None and count <= self.limit), retry_after


def _client_key(request: Request) -> str:
    return hashlib.sha256(
        request.state.client_ip.encode("utf-8", errors="replace")
    ).hexdigest()


def _client_ip(request: Request, trusted_proxy_hops: int) -> str:
    direct = request.client.host if request.client else "unknown"
    if trusted_proxy_hops == 0:
        return direct
    chain = [
        item.strip() for item in request.headers.get("X-Forwarded-For", "").split(",")
    ]
    if len(chain) < trusted_proxy_hops:
        return direct
    try:
        return str(ipaddress.ip_address(chain[-trusted_proxy_hops]))
    except ValueError:
        return direct


def _problem(request_id: str, retry_after: int) -> JSONResponse:
    response = JSONResponse(
        status_code=429,
        media_type="application/problem+json",
        content={
            "type": "https://api.vonkforge.ai/problems/request.rate_limited",
            "title": "Request rate exceeded",
            "status": 429,
            "code": "request.rate_limited",
            "detail": "Wait before sending more requests.",
            "request_id": request_id,
        },
    )
    response.headers["Retry-After"] = str(retry_after)
    return response


def _add_headers(response, production: bool) -> None:
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    )
    if production:
        response.headers["Strict-Transport-Security"] = (
            "max-age=63072000; includeSubDomains; preload"
        )


def install_security(
    app: FastAPI,
    settings: Settings,
    database_sessions: sessionmaker[Session] | None = None,
) -> None:
    LOGGER.disabled = False
    LOGGER.setLevel(logging.INFO)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Accept",
            "Content-Type",
            "Idempotency-Key",
            "If-Match",
            "X-CSRF-Token",
            "X-Request-ID",
        ],
        expose_headers=["ETag", "Location", "X-Request-ID"],
        max_age=600,
    )
    limiter = (
        DatabaseRateLimiter(
            database_sessions,
            settings.rate_limit_requests,
            settings.rate_limit_window_seconds,
        )
        if database_sessions is not None
        else SlidingWindowLimiter(
            settings.rate_limit_requests, settings.rate_limit_window_seconds
        )
    )

    @app.middleware("http")
    async def secure_request(request: Request, call_next: Callable):
        started = time.monotonic()
        wall_time = time.time()
        supplied = request.headers.get("X-Request-ID", "")
        request_id = supplied if REQUEST_ID.fullmatch(supplied) else str(uuid.uuid4())
        request.state.request_id = request_id
        request.state.client_ip = _client_ip(request, settings.trusted_proxy_hops)
        status = 500
        if request.url.path.startswith("/health/") or request.method == "OPTIONS":
            allowed, retry_after = True, settings.rate_limit_window_seconds
        else:
            allowed, retry_after = limiter.allow(_client_key(request), wall_time)
        if allowed:
            response = await call_next(request)
        else:
            response = _problem(request_id, retry_after)
        status = response.status_code
        response.headers["X-Request-ID"] = request_id
        _add_headers(response, settings.production)
        if request.method != "GET" or request.url.path.startswith(
            ("/v1/me", "/v1/auth", "/v1/publishers", "/v1/moderation")
        ):
            response.headers.setdefault("Cache-Control", "no-store")
        LOGGER.info(
            json.dumps(
                {
                    "event": "http.request",
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status": status,
                    "duration_ms": round((time.monotonic() - started) * 1000, 3),
                },
                separators=(",", ":"),
            )
        )
        return response
