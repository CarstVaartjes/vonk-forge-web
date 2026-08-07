from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker
from vonk_catalog.api import create_app
from vonk_catalog.models import OAuthAccount, OAuthFlow
from vonk_catalog.oauth import OAuthIdentity, OAuthVerificationError
from vonk_catalog.settings import Settings


@dataclass
class FakeOAuthBackend:
    identities: dict[tuple[str, str], OAuthIdentity]

    def enabled_providers(self) -> tuple[str, ...]:
        return ("github", "google")

    def authorization_url(
        self,
        provider: str,
        *,
        state: str,
        code_challenge: str,
        nonce: str,
    ) -> str:
        return (
            f"https://login.example/{provider}?state={state}"
            f"&code_challenge={code_challenge}&nonce={nonce}"
        )

    def resolve_identity(
        self,
        provider: str,
        *,
        code: str,
        code_verifier: str,
        nonce: str,
    ) -> OAuthIdentity:
        if len(code_verifier) < 43 or not nonce:
            raise OAuthVerificationError("oauth proof is incomplete")
        try:
            return self.identities[(provider, code)]
        except KeyError as error:
            raise OAuthVerificationError(
                "provider response was not verified"
            ) from error


def _client(engine, backend: FakeOAuthBackend) -> TestClient:
    settings = Settings(
        production=True,
        session_secret="s" * 64,
        public_base_url="https://catalog.example",
    )
    return TestClient(
        create_app(
            database_sessions=sessionmaker(bind=engine, expire_on_commit=False),
            settings=settings,
            oauth_backend=backend,
        ),
        base_url="https://catalog.example",
    )


def _start(client: TestClient, provider: str, *, link: bool = False) -> str:
    response = client.get(
        f"/v1/auth/{provider}/start",
        params={"link": str(link).lower()},
        follow_redirects=False,
    )
    assert response.status_code == 307
    query = parse_qs(urlparse(response.headers["location"]).query)
    assert len(query["state"][0]) >= 43
    assert len(query["code_challenge"][0]) >= 43
    assert query["nonce"][0]
    return query["state"][0]


def test_provider_start_uses_state_pkce_nonce_and_hides_flow_secrets(engine) -> None:
    backend = FakeOAuthBackend({})
    with _client(engine, backend) as client:
        assert client.get("/v1/auth/providers").json() == {
            "providers": ["github", "google"]
        }
        state = _start(client, "google")

    with sessionmaker(bind=engine)() as session:
        flow = session.scalar(select(OAuthFlow))
        assert flow is not None
        assert state not in {flow.state_digest, flow.code_verifier, flow.nonce}
        assert len(flow.state_digest) == 64
        assert len(flow.code_verifier) >= 43


def test_unconfigured_providers_are_disabled_without_exposing_secrets(engine) -> None:
    settings = Settings(session_secret="d" * 64)
    with TestClient(
        create_app(
            database_sessions=sessionmaker(bind=engine, expire_on_commit=False),
            settings=settings,
        )
    ) as client:
        assert client.get("/v1/auth/providers").json() == {"providers": []}
        response = client.get("/v1/auth/github/start")
        assert response.status_code == 404
        body = response.json()
        assert body["code"] == "auth.provider_disabled"
        assert settings.session_secret.get_secret_value() not in response.text


def test_callback_rejects_state_or_provider_verification_mismatch(engine) -> None:
    backend = FakeOAuthBackend({})
    with _client(engine, backend) as client:
        state = _start(client, "github")
        mismatch = client.get(
            "/v1/auth/github/callback",
            params={"state": state + "x", "code": "good"},
        )
        assert mismatch.status_code == 400
        assert mismatch.json()["code"] == "auth.oauth_state_invalid"

        state = _start(client, "github")
        unverified = client.get(
            "/v1/auth/github/callback", params={"state": state, "code": "bad"}
        )
        assert unverified.status_code == 401
        assert unverified.json()["code"] == "auth.oauth_verification_failed"


def test_sign_in_link_rotation_csrf_logout_and_email_collision(engine) -> None:
    backend = FakeOAuthBackend(
        {
            ("github", "github-code"): OAuthIdentity(
                provider="github",
                subject="gh-1",
                display_name="Ada",
                email="ada@example.test",
                email_verified=True,
            ),
            ("google", "google-code"): OAuthIdentity(
                provider="google",
                subject="google-1",
                display_name="Ada Lovelace",
                email="ada@example.test",
                email_verified=True,
            ),
        }
    )
    with _client(engine, backend) as client:
        state = _start(client, "github")
        callback = client.get(
            "/v1/auth/github/callback",
            params={"state": state, "code": "github-code"},
            follow_redirects=False,
        )
        assert callback.status_code == 303
        cookie = callback.headers["set-cookie"]
        assert "__Host-vonk_session=" in cookie
        assert "HttpOnly" in cookie and "Secure" in cookie and "SameSite=lax" in cookie
        first_token = client.cookies.get("__Host-vonk_session")

        me = client.get("/v1/me")
        assert me.status_code == 200
        assert me.json()["user"]["display_name"] == "Ada"
        csrf = me.json()["csrf_token"]
        assert csrf not in cookie
        assert client.post("/v1/logout").status_code == 403

        state = _start(client, "google", link=True)
        linked = client.get(
            "/v1/auth/google/callback",
            params={"state": state, "code": "google-code"},
            follow_redirects=False,
        )
        assert linked.status_code == 303
        assert client.cookies.get("__Host-vonk_session") != first_token

        me = client.get("/v1/me").json()
        assert sorted(account["provider"] for account in me["accounts"]) == [
            "github",
            "google",
        ]
        csrf = me["csrf_token"]
        logged_out = client.post("/v1/logout", headers={"X-CSRF-Token": csrf})
        assert logged_out.status_code == 204
        assert client.get("/v1/me").status_code == 401

    with sessionmaker(bind=engine)() as session:
        assert len(list(session.scalars(select(OAuthAccount)))) == 2

    collision_backend = FakeOAuthBackend(
        {
            ("google", "collision"): OAuthIdentity(
                provider="google",
                subject="google-2",
                display_name="Impostor",
                email="ada@example.test",
                email_verified=True,
            )
        }
    )
    with _client(engine, collision_backend) as anonymous:
        state = _start(anonymous, "google")
        response = anonymous.get(
            "/v1/auth/google/callback",
            params={"state": state, "code": "collision"},
        )
        assert response.status_code == 409
        assert response.json()["code"] == "auth.email_link_proof_required"
