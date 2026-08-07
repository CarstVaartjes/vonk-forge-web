from __future__ import annotations

import hashlib
import re
import secrets
import unicodedata
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .models import (
    OAuthAccount,
    Publisher,
    PublisherAuditEvent,
    PublisherInvitation,
    PublisherMembership,
)
from .problems import Problem

Clock = Callable[[], datetime]
ROLE_LEVEL = {"viewer": 1, "editor": 2, "owner": 3}
RESERVED_SKELETONS = {
    "admin",
    "administrator",
    "github",
    "google",
    "official",
    "support",
    "vonk",
    "vonkforge",
}


def _now() -> datetime:
    return datetime.now(UTC)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def normalize_slug(value: str) -> str:
    slug = unicodedata.normalize("NFKC", value).strip().lower()
    if not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", slug):
        raise Problem(
            422,
            "publisher.slug_invalid",
            "Publisher slug is invalid",
            "Use 1-63 lowercase ASCII letters, numbers, and internal hyphens.",
        )
    skeleton = slug.replace("-", "")
    if skeleton in RESERVED_SKELETONS or any(
        skeleton.startswith(prefix) for prefix in ("vonkforge", "official", "support")
    ):
        raise Problem(
            409,
            "publisher.slug_reserved",
            "Publisher slug is reserved",
            "Choose a namespace that cannot be confused with Vonk Forge or a provider.",
        )
    return slug


def _digest(token: str) -> str:
    return hashlib.sha256(token.encode("ascii")).hexdigest()


@dataclass(frozen=True, slots=True)
class CreatedInvitation:
    id: str
    token: str
    expires_at: datetime


class PublisherService:
    def __init__(self, database: Session, *, clock: Clock = _now) -> None:
        self.database = database
        self.clock = clock

    def _publisher(self, slug: str) -> Publisher:
        publisher = self.database.scalar(
            select(Publisher).where(Publisher.slug == slug.strip().lower())
        )
        if publisher is None:
            raise Problem(
                404,
                "publisher.not_found",
                "Publisher not found",
                "No such publisher exists.",
            )
        return publisher

    def _audit(
        self,
        publisher_id: str,
        actor_user_id: str | None,
        action: str,
        *,
        subject_user_id: str | None = None,
        details: dict[str, object] | None = None,
    ) -> None:
        self.database.add(
            PublisherAuditEvent(
                publisher_id=publisher_id,
                actor_user_id=actor_user_id,
                action=action,
                subject_user_id=subject_user_id,
                details=details or {},
                created_at=_aware(self.clock()),
            )
        )

    def create(self, user_id: str, slug: str, name: str) -> Publisher:
        normalized = normalize_slug(slug)
        display_name = name.strip()
        if not 1 <= len(display_name) <= 160:
            raise Problem(
                422,
                "publisher.name_invalid",
                "Publisher name is invalid",
                "Use a name between 1 and 160 characters.",
            )
        publisher = Publisher(slug=normalized, name=display_name)
        self.database.add(publisher)
        try:
            self.database.flush()
        except IntegrityError as error:
            raise Problem(
                409,
                "publisher.slug_taken",
                "Publisher slug is taken",
                "Choose another namespace.",
            ) from error
        self.database.add(
            PublisherMembership(
                publisher_id=publisher.id, user_id=user_id, role="owner"
            )
        )
        self._audit(
            publisher.id,
            user_id,
            "publisher.created",
            subject_user_id=user_id,
            details={"slug": normalized},
        )
        self.database.flush()
        return publisher

    def require_role(self, user_id: str, slug: str, minimum: str) -> Publisher:
        if minimum not in ROLE_LEVEL:
            raise ValueError("unknown publisher role")
        publisher = self._publisher(slug)
        membership = self.database.get(PublisherMembership, (publisher.id, user_id))
        if membership is None or ROLE_LEVEL[membership.role] < ROLE_LEVEL[minimum]:
            raise Problem(
                403,
                "publisher.access_denied",
                "Publisher access denied",
                "Your publisher role does not allow this action.",
            )
        return publisher

    def invite(
        self, actor_user_id: str, slug: str, email: str, role: str
    ) -> CreatedInvitation:
        publisher = self.require_role(actor_user_id, slug, "owner")
        normalized_email = email.strip().lower()
        if (
            role not in ROLE_LEVEL
            or not normalized_email
            or len(normalized_email) > 320
        ):
            raise Problem(
                422,
                "publisher.invitation_invalid",
                "Invitation is invalid",
                "Provide a valid role and account email.",
            )
        token = secrets.token_urlsafe(48)
        expires_at = _aware(self.clock()) + timedelta(days=7)
        row = PublisherInvitation(
            publisher_id=publisher.id,
            invited_by_user_id=actor_user_id,
            email=normalized_email,
            role=role,
            token_digest=_digest(token),
            expires_at=expires_at,
            created_at=_aware(self.clock()),
        )
        self.database.add(row)
        self.database.flush()
        self._audit(
            publisher.id,
            actor_user_id,
            "membership.invited",
            details={"invitation_id": row.id, "role": role},
        )
        return CreatedInvitation(row.id, token, expires_at)

    def invitation_by_token(self, token: str) -> PublisherInvitation:
        if not token.isascii() or not 43 <= len(token) <= 128:
            raise Problem(
                404,
                "publisher.invitation_not_found",
                "Invitation not found",
                "This invitation is invalid.",
            )
        row = self.database.scalar(
            select(PublisherInvitation).where(
                PublisherInvitation.token_digest == _digest(token)
            )
        )
        if row is None:
            raise Problem(
                404,
                "publisher.invitation_not_found",
                "Invitation not found",
                "This invitation is invalid.",
            )
        return row

    def accept_invitation(self, user_id: str, token: str) -> PublisherMembership:
        row = self.invitation_by_token(token)
        now = _aware(self.clock())
        if row.accepted_at is not None:
            existing = self.database.get(
                PublisherMembership, (row.publisher_id, user_id)
            )
            if row.accepted_by_user_id == user_id and existing is not None:
                return existing
            raise Problem(
                409,
                "publisher.invitation_used",
                "Invitation already used",
                "Ask a publisher owner for a new invitation.",
            )
        if _aware(row.expires_at) <= now:
            raise Problem(
                410,
                "publisher.invitation_expired",
                "Invitation expired",
                "Ask a publisher owner for a new invitation.",
            )
        has_email = self.database.scalar(
            select(OAuthAccount.id).where(
                OAuthAccount.user_id == user_id,
                func.lower(OAuthAccount.email) == row.email,
            )
        )
        if has_email is None:
            raise Problem(
                403,
                "publisher.invitation_identity_mismatch",
                "Invitation identity does not match",
                "Sign in with the verified account email that was invited.",
            )
        membership = self.database.get(PublisherMembership, (row.publisher_id, user_id))
        if membership is None:
            membership = PublisherMembership(
                publisher_id=row.publisher_id, user_id=user_id, role=row.role
            )
            self.database.add(membership)
        row.accepted_by_user_id = user_id
        row.accepted_at = now
        self._audit(
            row.publisher_id,
            user_id,
            "membership.accepted",
            subject_user_id=user_id,
            details={"role": row.role},
        )
        self.database.flush()
        return membership

    def _owner_count(self, publisher_id: str) -> int:
        return int(
            self.database.scalar(
                select(func.count())
                .select_from(PublisherMembership)
                .where(
                    PublisherMembership.publisher_id == publisher_id,
                    PublisherMembership.role == "owner",
                )
            )
            or 0
        )

    def change_role(
        self, actor_user_id: str, slug: str, subject_user_id: str, role: str
    ) -> None:
        publisher = self.require_role(actor_user_id, slug, "owner")
        if role not in ROLE_LEVEL:
            raise Problem(
                422,
                "publisher.role_invalid",
                "Role is invalid",
                "Choose owner, editor, or viewer.",
            )
        membership = self.database.get(
            PublisherMembership, (publisher.id, subject_user_id)
        )
        if membership is None:
            raise Problem(
                404,
                "publisher.member_not_found",
                "Publisher member not found",
                "Invite this account first.",
            )
        if (
            membership.role == "owner"
            and role != "owner"
            and self._owner_count(publisher.id) <= 1
        ):
            raise Problem(
                409,
                "publisher.last_owner",
                "Publisher needs an owner",
                "Promote another owner before changing this role.",
            )
        previous = membership.role
        membership.role = role
        self._audit(
            publisher.id,
            actor_user_id,
            "membership.role_changed",
            subject_user_id=subject_user_id,
            details={"from": previous, "to": role},
        )
        self.database.flush()

    def remove_member(
        self, actor_user_id: str, slug: str, subject_user_id: str
    ) -> None:
        publisher = self.require_role(actor_user_id, slug, "owner")
        membership = self.database.get(
            PublisherMembership, (publisher.id, subject_user_id)
        )
        if membership is None:
            raise Problem(
                404,
                "publisher.member_not_found",
                "Publisher member not found",
                "The account is not a member.",
            )
        if membership.role == "owner" and self._owner_count(publisher.id) <= 1:
            raise Problem(
                409,
                "publisher.last_owner",
                "Publisher needs an owner",
                "Promote another owner before removing this account.",
            )
        previous = membership.role
        self.database.delete(membership)
        self._audit(
            publisher.id,
            actor_user_id,
            "membership.removed",
            subject_user_id=subject_user_id,
            details={"role": previous},
        )
        self.database.flush()


def seed_official_publisher(
    database: Session, provider: str, subject: str
) -> Publisher:
    account = database.scalar(
        select(OAuthAccount).where(
            OAuthAccount.provider == provider, OAuthAccount.subject == subject
        )
    )
    if account is None:
        raise Problem(
            404,
            "publisher.founder_identity_missing",
            "Founder identity not found",
            "The configured founder must sign in before seeding the official publisher.",
        )
    publisher = database.scalar(
        select(Publisher).where(Publisher.system_role == "official")
    )
    if publisher is None:
        publisher = Publisher(slug="vonk", name="Vonk Forge", system_role="official")
        database.add(publisher)
        database.flush()
    membership = database.get(PublisherMembership, (publisher.id, account.user_id))
    if membership is None:
        database.add(
            PublisherMembership(
                publisher_id=publisher.id, user_id=account.user_id, role="owner"
            )
        )
        database.add(
            PublisherAuditEvent(
                publisher_id=publisher.id,
                actor_user_id=account.user_id,
                action="publisher.official_seeded",
                subject_user_id=account.user_id,
                details={"provider": provider},
            )
        )
        database.flush()
    return publisher
