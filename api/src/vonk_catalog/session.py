from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from .models import BrowserSession, User

Clock = Callable[[], datetime]


def _now() -> datetime:
    return datetime.now(UTC)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


@dataclass(frozen=True, slots=True)
class CreatedSession:
    id: str
    token: str
    csrf_token: str
    expires_at: datetime


@dataclass(frozen=True, slots=True)
class AuthenticatedSession:
    id: str
    user: User
    expires_at: datetime


class SessionService:
    def __init__(
        self,
        sessions: sessionmaker[Session],
        secret: bytes,
        *,
        ttl: timedelta = timedelta(days=30),
        clock: Clock = _now,
    ) -> None:
        if len(secret) < 32 or ttl < timedelta(minutes=5):
            raise ValueError("session security configuration is invalid")
        self._sessions = sessions
        self._secret = secret
        self._ttl = ttl
        self._clock = clock

    def _digest(self, purpose: bytes, value: str) -> str:
        return hmac.new(
            self._secret, purpose + value.encode(), hashlib.sha256
        ).hexdigest()

    def _audit_digest(self, purpose: bytes, value: str) -> str:
        return self._digest(purpose, value[:1024])

    def csrf_for(self, token: str) -> str:
        raw = hmac.new(
            self._secret, b"csrf-token\x00" + token.encode(), hashlib.sha256
        ).digest()
        return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")

    def create(
        self,
        user_id: str,
        client_ip: str,
        user_agent: str,
        *,
        previous_session_id: str | None = None,
    ) -> CreatedSession:
        now = _aware(self._clock())
        token = secrets.token_urlsafe(48)
        row = BrowserSession(
            user_id=user_id,
            token_digest=self._digest(b"session\x00", token),
            previous_session_id=previous_session_id,
            ip_digest=self._audit_digest(b"ip\x00", client_ip),
            user_agent_digest=self._audit_digest(b"ua\x00", user_agent),
            created_at=now,
            last_used_at=now,
            expires_at=now + self._ttl,
        )
        with self._sessions.begin() as database:
            if database.get(User, user_id) is None:
                raise KeyError(user_id)
            database.add(row)
            database.flush()
        return CreatedSession(row.id, token, self.csrf_for(token), row.expires_at)

    def authenticate(
        self, token: str | None, client_ip: str, user_agent: str
    ) -> AuthenticatedSession | None:
        if token is None or not 43 <= len(token) <= 128 or not token.isascii():
            return None
        now = _aware(self._clock())
        digest = self._digest(b"session\x00", token)
        with self._sessions.begin() as database:
            row = database.scalar(
                select(BrowserSession).where(BrowserSession.token_digest == digest)
            )
            if (
                row is None
                or row.revoked_at is not None
                or _aware(row.expires_at) <= now
            ):
                return None
            user = database.get(User, row.user_id)
            if user is None:
                return None
            row.last_used_at = now
            row.ip_digest = self._audit_digest(b"ip\x00", client_ip)
            row.user_agent_digest = self._audit_digest(b"ua\x00", user_agent)
            database.flush()
            database.expunge(user)
            return AuthenticatedSession(row.id, user, _aware(row.expires_at))

    def verify_csrf(self, token: str | None, candidate: str | None) -> bool:
        if token is None or candidate is None:
            return False
        return hmac.compare_digest(self.csrf_for(token), candidate)

    def revoke(self, token: str | None) -> None:
        if token is None or not token.isascii() or len(token) > 128:
            return
        with self._sessions.begin() as database:
            row = database.scalar(
                select(BrowserSession).where(
                    BrowserSession.token_digest == self._digest(b"session\x00", token)
                )
            )
            if row is not None and row.revoked_at is None:
                row.revoked_at = _aware(self._clock())

    def rotate(
        self,
        old_token: str | None,
        user_id: str,
        client_ip: str,
        user_agent: str,
    ) -> CreatedSession:
        previous_id: str | None = None
        if old_token is not None:
            current = self.authenticate(old_token, client_ip, user_agent)
            if current is not None:
                previous_id = current.id
                self.revoke(old_token)
        return self.create(
            user_id,
            client_ip,
            user_agent,
            previous_session_id=previous_id,
        )
