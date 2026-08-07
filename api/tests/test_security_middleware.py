import json
import logging

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.orm import sessionmaker
from vonk_catalog.api import create_app
from vonk_catalog.settings import Settings


def production_settings(**overrides) -> Settings:
    values = {
        "production": True,
        "public_base_url": "https://api.vonkforge.ai",
        "session_secret": "s" * 64,
        "cors_allowed_origins": ["https://vonkforge.ai"],
    }
    values.update(overrides)
    return Settings(**values)


def test_security_headers_cors_and_request_identity_are_explicit() -> None:
    with TestClient(create_app(settings=production_settings())) as client:
        response = client.get("/health/live", headers={"X-Request-ID": "trace_123"})
        preflight = client.options(
            "/v1/recipes",
            headers={
                "Origin": "https://vonkforge.ai",
                "Access-Control-Request-Method": "GET",
            },
        )

    assert response.headers["x-request-id"] == "trace_123"
    assert (
        response.headers["strict-transport-security"]
        == "max-age=63072000; includeSubDomains; preload"
    )
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert "default-src 'none'" in response.headers["content-security-policy"]
    assert preflight.headers["access-control-allow-origin"] == "https://vonkforge.ai"
    assert preflight.headers["access-control-allow-credentials"] == "true"


def test_untrusted_request_id_is_replaced_and_logs_never_include_query_secrets(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO, logger="vonk_catalog.http")
    with TestClient(create_app(settings=production_settings())) as client:
        response = client.get(
            "/health/live?token=do-not-log-me",
            headers={
                "Authorization": "Bearer also-do-not-log",
                "X-Request-ID": "bad id!",
            },
        )

    assert response.headers["x-request-id"] != "bad id!"
    payload = json.loads(caplog.records[-1].message)
    assert payload["event"] == "http.request"
    assert payload["path"] == "/health/live"
    assert payload["status"] == 200
    assert "do-not-log-me" not in caplog.text
    assert "also-do-not-log" not in caplog.text


def test_rate_limit_is_bounded_and_returns_a_stable_problem() -> None:
    settings = production_settings(rate_limit_requests=2, rate_limit_window_seconds=60)
    with TestClient(create_app(settings=settings)) as client:
        assert client.get("/not-found").status_code == 404
        assert client.get("/not-found").status_code == 404
        limited = client.get("/not-found")

    assert limited.status_code == 429
    assert limited.headers["retry-after"] == "60"
    assert limited.json()["code"] == "request.rate_limited"
    assert limited.json()["request_id"] == limited.headers["x-request-id"]


def test_cookie_rotation_cannot_change_anonymous_rate_identity() -> None:
    settings = production_settings(rate_limit_requests=1, rate_limit_window_seconds=60)
    with TestClient(create_app(settings=settings)) as client:
        client.cookies.set("__Host-vonk_session", "attacker-selected-a")
        assert client.get("/missing").status_code == 404
        client.cookies.set("__Host-vonk_session", "attacker-selected-b")
        limited = client.get("/missing")

    assert limited.status_code == 429


def test_rate_limit_is_shared_by_app_instances(engine) -> None:
    settings = production_settings(rate_limit_requests=1, rate_limit_window_seconds=60)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    with (
        TestClient(create_app(database_sessions=sessions, settings=settings)) as first,
        TestClient(create_app(database_sessions=sessions, settings=settings)) as second,
    ):
        assert first.get("/missing").status_code == 404
        limited = second.get("/missing")

    assert limited.status_code == 429


def test_production_rejects_wildcard_or_non_https_cors_origins() -> None:
    with pytest.raises(ValidationError, match="CORS"):
        production_settings(cors_allowed_origins=["*"])
    with pytest.raises(ValidationError, match="CORS"):
        production_settings(cors_allowed_origins=["http://vonkforge.ai"])


def test_rate_identity_uses_the_rightmost_address_after_the_trusted_proxy() -> None:
    settings = production_settings(
        rate_limit_requests=1,
        rate_limit_window_seconds=60,
        trusted_proxy_hops=1,
    )
    with TestClient(create_app(settings=settings)) as client:
        assert (
            client.get(
                "/missing", headers={"X-Forwarded-For": "spoofed, 198.51.100.1"}
            ).status_code
            == 404
        )
        same_client = client.get(
            "/missing", headers={"X-Forwarded-For": "different-spoof, 198.51.100.1"}
        )
        other_client = client.get(
            "/missing", headers={"X-Forwarded-For": "spoofed, 198.51.100.2"}
        )

    assert same_client.status_code == 429
    assert other_client.status_code == 404
