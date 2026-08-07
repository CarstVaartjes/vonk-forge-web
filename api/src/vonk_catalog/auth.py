from __future__ import annotations

from dataclasses import dataclass

from fastapi import Request
from sqlalchemy.orm import Session, sessionmaker

from .problems import Problem
from .session import AuthenticatedSession, SessionService


@dataclass(frozen=True, slots=True)
class AuthServices:
    database_sessions: sessionmaker[Session]
    sessions: SessionService
    cookie_name: str
    secure_cookie: bool


def request_client(request: Request) -> tuple[str, str]:
    client_ip = getattr(
        request.state,
        "client_ip",
        "unknown" if request.client is None else request.client.host,
    )
    user_agent = request.headers.get("User-Agent", "")[:1024]
    return client_ip[:128], user_agent


def optional_session(
    request: Request, services: AuthServices
) -> AuthenticatedSession | None:
    client_ip, user_agent = request_client(request)
    return services.sessions.authenticate(
        request.cookies.get(services.cookie_name), client_ip, user_agent
    )


def require_session(request: Request, services: AuthServices) -> AuthenticatedSession:
    authenticated = optional_session(request, services)
    if authenticated is None:
        raise Problem(401, "auth.required", "Sign-in required", "Sign in to continue.")
    return authenticated


def require_csrf(request: Request, services: AuthServices) -> None:
    token = request.cookies.get(services.cookie_name)
    candidate = request.headers.get("X-CSRF-Token")
    if not services.sessions.verify_csrf(token, candidate):
        raise Problem(
            403,
            "auth.csrf_invalid",
            "Request confirmation failed",
            "Refresh the page and retry the request.",
        )
