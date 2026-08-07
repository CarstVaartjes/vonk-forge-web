from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urlencode

import httpx
import jwt

from .settings import Settings


class OAuthVerificationError(RuntimeError):
    """The provider response did not prove the requested identity."""


@dataclass(frozen=True, slots=True)
class OAuthIdentity:
    provider: str
    subject: str
    display_name: str
    email: str | None
    email_verified: bool


class OAuthBackend(Protocol):
    def enabled_providers(self) -> tuple[str, ...]: ...

    def authorization_url(
        self,
        provider: str,
        *,
        state: str,
        code_challenge: str,
        nonce: str,
    ) -> str: ...

    def resolve_identity(
        self,
        provider: str,
        *,
        code: str,
        code_verifier: str,
        nonce: str,
    ) -> OAuthIdentity: ...


@dataclass(frozen=True, slots=True)
class Provider:
    client_id: str
    client_secret: str
    authorization_endpoint: str
    token_endpoint: str
    userinfo_endpoint: str
    scopes: str
    issuer: str | None = None
    jwks_uri: str | None = None


class HttpOAuthBackend:
    """Small standards-based OAuth/OIDC client with no ambient credentials."""

    def __init__(
        self,
        providers: dict[str, Provider],
        public_base_url: str,
        *,
        client: httpx.Client | None = None,
    ) -> None:
        self._providers = providers
        self._base = public_base_url.rstrip("/")
        self._client = client or httpx.Client(
            timeout=httpx.Timeout(10.0, connect=5.0),
            follow_redirects=False,
            trust_env=False,
        )

    @classmethod
    def from_settings(cls, settings: Settings) -> HttpOAuthBackend:
        providers: dict[str, Provider] = {}
        if settings.github_client_id and settings.github_client_secret:
            providers["github"] = Provider(
                settings.github_client_id,
                settings.github_client_secret.get_secret_value(),
                "https://github.com/login/oauth/authorize",
                "https://github.com/login/oauth/access_token",
                "https://api.github.com/user",
                "read:user user:email",
            )
        if settings.google_client_id and settings.google_client_secret:
            providers["google"] = Provider(
                settings.google_client_id,
                settings.google_client_secret.get_secret_value(),
                "https://accounts.google.com/o/oauth2/v2/auth",
                "https://oauth2.googleapis.com/token",
                "https://openidconnect.googleapis.com/v1/userinfo",
                "openid email profile",
                issuer="https://accounts.google.com",
                jwks_uri="https://www.googleapis.com/oauth2/v3/certs",
            )
        return cls(providers, settings.public_base_url)

    def enabled_providers(self) -> tuple[str, ...]:
        return tuple(sorted(self._providers))

    def _provider(self, name: str) -> Provider:
        try:
            return self._providers[name]
        except KeyError as error:
            raise OAuthVerificationError("OAuth provider is disabled") from error

    def _callback(self, provider: str) -> str:
        return f"{self._base}/v1/auth/{provider}/callback"

    def authorization_url(
        self,
        provider: str,
        *,
        state: str,
        code_challenge: str,
        nonce: str,
    ) -> str:
        configured = self._provider(provider)
        query = urlencode(
            {
                "client_id": configured.client_id,
                "redirect_uri": self._callback(provider),
                "response_type": "code",
                "scope": configured.scopes,
                "state": state,
                "code_challenge": code_challenge,
                "code_challenge_method": "S256",
                "nonce": nonce,
            }
        )
        return f"{configured.authorization_endpoint}?{query}"

    @staticmethod
    def _json(response: httpx.Response) -> dict[str, object] | list[object]:
        if response.status_code < 200 or response.status_code >= 300:
            raise OAuthVerificationError("OAuth provider rejected the request")
        if len(response.content) > 65_536:
            raise OAuthVerificationError("OAuth provider response is oversized")
        try:
            value = json.loads(response.content)
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise OAuthVerificationError(
                "OAuth provider returned invalid JSON"
            ) from error
        if not isinstance(value, (dict, list)):
            raise OAuthVerificationError("OAuth provider response has an invalid shape")
        return value

    def resolve_identity(
        self,
        provider: str,
        *,
        code: str,
        code_verifier: str,
        nonce: str,
    ) -> OAuthIdentity:
        configured = self._provider(provider)
        if not 1 <= len(code) <= 2048 or not 43 <= len(code_verifier) <= 128:
            raise OAuthVerificationError("OAuth callback is malformed")
        try:
            token_response = self._client.post(
                configured.token_endpoint,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "code_verifier": code_verifier,
                    "client_id": configured.client_id,
                    "client_secret": configured.client_secret,
                    "redirect_uri": self._callback(provider),
                },
                headers={"Accept": "application/json"},
            )
        except httpx.HTTPError as error:
            raise OAuthVerificationError("OAuth provider is unavailable") from error
        token = self._json(token_response)
        if not isinstance(token, dict):
            raise OAuthVerificationError("OAuth token response is invalid")
        access_token = token.get("access_token")
        if not isinstance(access_token, str) or not access_token:
            raise OAuthVerificationError("OAuth access token is missing")
        if provider == "google":
            return self._google_identity(configured, token, access_token, nonce)
        return self._github_identity(configured, access_token)

    def _github_identity(
        self, configured: Provider, access_token: str
    ) -> OAuthIdentity:
        headers = {
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {access_token}",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        try:
            profile = self._json(
                self._client.get(configured.userinfo_endpoint, headers=headers)
            )
            emails = self._json(
                self._client.get("https://api.github.com/user/emails", headers=headers)
            )
        except httpx.HTTPError as error:
            raise OAuthVerificationError("GitHub identity lookup failed") from error
        if not isinstance(profile, dict) or not isinstance(emails, list):
            raise OAuthVerificationError("GitHub identity response is invalid")
        subject = profile.get("id")
        name = profile.get("name") or profile.get("login")
        verified = [
            item.get("email")
            for item in emails
            if isinstance(item, dict)
            and item.get("verified") is True
            and item.get("primary") is True
            and isinstance(item.get("email"), str)
        ]
        if not isinstance(subject, (str, int)) or not isinstance(name, str):
            raise OAuthVerificationError("GitHub identity is incomplete")
        return OAuthIdentity(
            "github",
            str(subject),
            name[:160],
            verified[0].lower() if verified else None,
            bool(verified),
        )

    def _google_identity(
        self,
        configured: Provider,
        token: dict[str, object],
        access_token: str,
        nonce: str,
    ) -> OAuthIdentity:
        id_token = token.get("id_token")
        if not isinstance(id_token, str) or configured.jwks_uri is None:
            raise OAuthVerificationError("Google ID token is missing")
        try:
            jwks = self._json(self._client.get(configured.jwks_uri))
        except httpx.HTTPError as error:
            raise OAuthVerificationError(
                "Google signing keys are unavailable"
            ) from error
        if not isinstance(jwks, dict) or not isinstance(jwks.get("keys"), list):
            raise OAuthVerificationError("Google signing keys are invalid")
        header = jwt.get_unverified_header(id_token)
        key_data = next(
            (
                item
                for item in jwks["keys"]
                if isinstance(item, dict) and item.get("kid") == header.get("kid")
            ),
            None,
        )
        if key_data is None:
            raise OAuthVerificationError("Google signing key is unknown")
        try:
            claims = jwt.decode(
                id_token,
                key=jwt.PyJWK.from_dict(key_data).key,
                algorithms=["RS256"],
                audience=configured.client_id,
                issuer=["https://accounts.google.com", "accounts.google.com"],
                options={"require": ["exp", "iat", "sub", "nonce"]},
            )
        except jwt.PyJWTError as error:
            raise OAuthVerificationError("Google ID token is invalid") from error
        if claims.get("nonce") != nonce or claims.get("email_verified") is not True:
            raise OAuthVerificationError("Google identity proof is incomplete")
        subject = claims.get("sub")
        name = claims.get("name")
        email = claims.get("email")
        if not all(
            isinstance(value, str) and value for value in (subject, name, email)
        ):
            raise OAuthVerificationError("Google identity is incomplete")
        del access_token
        return OAuthIdentity("google", subject, name[:160], email.lower(), True)
