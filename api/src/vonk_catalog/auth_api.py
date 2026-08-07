from __future__ import annotations

import base64
import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from urllib.parse import urljoin

from fastapi import APIRouter, Query, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from .auth import (
    AuthServices,
    optional_session,
    request_client,
    require_csrf,
    require_session,
)
from .models import OAuthAccount, OAuthFlow, User
from .oauth import OAuthBackend, OAuthIdentity, OAuthVerificationError
from .problems import Problem
from .settings import Settings


def _now() -> datetime:
    return datetime.now(UTC)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _state_digest(value: str) -> str:
    return hashlib.sha256(value.encode("ascii")).hexdigest()


def _challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def _safe_return_to(value: str | None) -> str:
    if (
        value is None
        or not value.startswith("/")
        or value.startswith("//")
        or "\\" in value
        or len(value) > 256
    ):
        return "/workspace"
    return value


def _validated_identity(identity: OAuthIdentity, provider: str) -> OAuthIdentity:
    if (
        identity.provider != provider
        or not 1 <= len(identity.subject) <= 255
        or not 1 <= len(identity.display_name) <= 160
        or (identity.email is not None and len(identity.email) > 320)
        or (identity.email is not None and not identity.email_verified)
    ):
        raise Problem(
            401,
            "auth.oauth_verification_failed",
            "OAuth verification failed",
            "The provider did not return a verified identity.",
        )
    return identity


def build_auth_router(
    services: AuthServices,
    backend: OAuthBackend,
    settings: Settings,
) -> APIRouter:
    router = APIRouter(prefix="/v1")
    flow_ttl = timedelta(seconds=settings.oauth_flow_ttl_seconds)

    @router.get("/auth/providers")
    def providers() -> dict[str, list[str]]:
        return {"providers": list(backend.enabled_providers())}

    @router.get("/auth/{provider}/start", response_model=None)
    def start(
        provider: str,
        request: Request,
        link: bool = Query(default=False),
        return_to: str | None = Query(default=None, max_length=256),
    ) -> RedirectResponse:
        if provider not in backend.enabled_providers():
            raise Problem(
                404,
                "auth.provider_disabled",
                "OAuth provider unavailable",
                "Choose one of the enabled sign-in providers.",
            )
        current = optional_session(request, services)
        if link and current is None:
            raise Problem(401, "auth.required", "Sign-in required", "Sign in first.")
        state = secrets.token_urlsafe(48)
        verifier = secrets.token_urlsafe(64)
        nonce = secrets.token_urlsafe(32)
        now = _now()
        with services.database_sessions.begin() as database:
            database.add(
                OAuthFlow(
                    state_digest=_state_digest(state),
                    provider=provider,
                    code_verifier=verifier,
                    nonce=nonce,
                    link_user_id=None
                    if current is None or not link
                    else current.user.id,
                    return_to=_safe_return_to(return_to),
                    expires_at=now + flow_ttl,
                    created_at=now,
                )
            )
        try:
            destination = backend.authorization_url(
                provider,
                state=state,
                code_challenge=_challenge(verifier),
                nonce=nonce,
            )
        except OAuthVerificationError as error:
            raise Problem(
                503,
                "auth.provider_unavailable",
                "OAuth provider unavailable",
                "The selected provider cannot start sign-in.",
            ) from error
        return RedirectResponse(destination, status_code=307)

    @router.get("/auth/{provider}/callback", response_model=None)
    def callback(
        provider: str,
        request: Request,
        state: str = Query(min_length=43, max_length=128),
        code: str = Query(min_length=1, max_length=2048),
    ) -> RedirectResponse:
        now = _now()
        with services.database_sessions.begin() as database:
            flow = database.scalar(
                select(OAuthFlow)
                .where(OAuthFlow.state_digest == _state_digest(state))
                .with_for_update()
            )
            if (
                flow is None
                or flow.provider != provider
                or flow.used_at is not None
                or _aware(flow.expires_at) <= now
            ):
                raise Problem(
                    400,
                    "auth.oauth_state_invalid",
                    "OAuth state is invalid",
                    "Start sign-in again from Vonk Forge.",
                )
            flow.used_at = now
            verifier = flow.code_verifier
            nonce = flow.nonce
            link_user_id = flow.link_user_id
            return_to = flow.return_to

        try:
            identity = _validated_identity(
                backend.resolve_identity(
                    provider,
                    code=code,
                    code_verifier=verifier,
                    nonce=nonce,
                ),
                provider,
            )
        except OAuthVerificationError as error:
            raise Problem(
                401,
                "auth.oauth_verification_failed",
                "OAuth verification failed",
                "The provider response could not be verified.",
            ) from error

        current = optional_session(request, services)
        if link_user_id is not None and (
            current is None or current.user.id != link_user_id
        ):
            raise Problem(
                401,
                "auth.link_session_changed",
                "Account-link session changed",
                "Sign in and restart account linking.",
            )
        email = identity.email.lower() if identity.email is not None else None
        try:
            with services.database_sessions.begin() as database:
                account = database.scalar(
                    select(OAuthAccount).where(
                        OAuthAccount.provider == provider,
                        OAuthAccount.subject == identity.subject,
                    )
                )
                if account is not None:
                    if link_user_id is not None and account.user_id != link_user_id:
                        raise Problem(
                            409,
                            "auth.identity_already_linked",
                            "Identity already linked",
                            "This provider identity belongs to another account.",
                        )
                    user_id = account.user_id
                    account.email = email
                elif link_user_id is not None:
                    user_id = link_user_id
                    database.add(
                        OAuthAccount(
                            user_id=user_id,
                            provider=provider,
                            subject=identity.subject,
                            email=email,
                        )
                    )
                else:
                    collision = None
                    if email is not None:
                        collision = database.scalar(
                            select(OAuthAccount.id).where(
                                func.lower(OAuthAccount.email) == email
                            )
                        )
                    if collision is not None:
                        raise Problem(
                            409,
                            "auth.email_link_proof_required",
                            "Account-link proof required",
                            "Sign in to the existing account before linking this provider.",
                        )
                    user = User(display_name=identity.display_name)
                    database.add(user)
                    database.flush()
                    user_id = user.id
                    database.add(
                        OAuthAccount(
                            user_id=user_id,
                            provider=provider,
                            subject=identity.subject,
                            email=email,
                        )
                    )
        except IntegrityError as error:
            raise Problem(
                409,
                "auth.identity_conflict",
                "Identity changed concurrently",
                "Restart sign-in and retry.",
            ) from error

        client_ip, user_agent = request_client(request)
        old_token = request.cookies.get(services.cookie_name)
        created = services.sessions.rotate(old_token, user_id, client_ip, user_agent)
        response = RedirectResponse(
            urljoin(settings.public_base_url.rstrip("/") + "/", return_to.lstrip("/")),
            status_code=303,
        )
        response.set_cookie(
            services.cookie_name,
            created.token,
            max_age=settings.session_ttl_seconds,
            expires=created.expires_at,
            path="/",
            secure=services.secure_cookie,
            httponly=True,
            samesite="lax",
        )
        return response

    @router.get("/me")
    def me(request: Request) -> dict[str, object]:
        authenticated = require_session(request, services)
        with services.database_sessions() as database:
            accounts = list(
                database.scalars(
                    select(OAuthAccount)
                    .where(OAuthAccount.user_id == authenticated.user.id)
                    .order_by(OAuthAccount.provider)
                )
            )
        token = request.cookies[services.cookie_name]
        return {
            "user": {
                "id": authenticated.user.id,
                "display_name": authenticated.user.display_name,
            },
            "accounts": [
                {"provider": account.provider, "email": account.email}
                for account in accounts
            ],
            "csrf_token": services.sessions.csrf_for(token),
            "session_expires_at": authenticated.expires_at.isoformat(),
        }

    @router.post("/logout", status_code=204)
    def logout(request: Request) -> Response:
        require_session(request, services)
        require_csrf(request, services)
        services.sessions.revoke(request.cookies.get(services.cookie_name))
        response = Response(status_code=204)
        response.delete_cookie(
            services.cookie_name,
            path="/",
            secure=services.secure_cookie,
            httponly=True,
            samesite="lax",
        )
        return response

    return router
