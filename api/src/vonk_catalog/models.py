from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    event,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

JSON_DOCUMENT = JSON().with_variant(JSONB(), "postgresql")


def new_uuid() -> str:
    return str(uuid.uuid4())


def utcnow() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    display_name: Mapped[str] = mapped_column(String(160))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"
    __table_args__ = (UniqueConstraint("provider", "subject"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    provider: Mapped[str] = mapped_column(String(32))
    subject: Mapped[str] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(320))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )


class OAuthFlow(Base):
    __tablename__ = "oauth_flows"
    __table_args__ = (
        CheckConstraint(
            "provider IN ('github', 'google')", name="ck_oauth_flow_provider"
        ),
    )

    state_digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    provider: Mapped[str] = mapped_column(String(32), index=True)
    code_verifier: Mapped[str] = mapped_column(String(128))
    nonce: Mapped[str] = mapped_column(String(128))
    link_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    return_to: Mapped[str] = mapped_column(String(256), default="/workspace")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )


class BrowserSession(Base):
    __tablename__ = "browser_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_digest: Mapped[str] = mapped_column(String(64), unique=True)
    previous_session_id: Mapped[str | None] = mapped_column(
        ForeignKey("browser_sessions.id", ondelete="SET NULL"), index=True
    )
    ip_digest: Mapped[str] = mapped_column(String(64))
    user_agent_digest: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    last_used_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Publisher(Base):
    __tablename__ = "publishers"
    __table_args__ = (
        CheckConstraint("slug = lower(slug)", name="ck_publishers_lower_slug"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    slug: Mapped[str] = mapped_column(String(63), unique=True)
    name: Mapped[str] = mapped_column(String(160))
    system_role: Mapped[str | None] = mapped_column(String(32), unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )


class PublisherMembership(Base):
    __tablename__ = "publisher_memberships"
    __table_args__ = (
        CheckConstraint(
            "role IN ('owner', 'editor', 'viewer')", name="ck_membership_role"
        ),
    )

    publisher_id: Mapped[str] = mapped_column(
        ForeignKey("publishers.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )


class Recipe(Base):
    __tablename__ = "recipes"
    __table_args__ = (
        UniqueConstraint("publisher_id", "slug"),
        CheckConstraint("slug = lower(slug)", name="ck_recipes_lower_slug"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    publisher_id: Mapped[str] = mapped_column(
        ForeignKey("publishers.id", ondelete="RESTRICT"), index=True
    )
    slug: Mapped[str] = mapped_column(String(63))
    title: Mapped[str] = mapped_column(String(160))
    state: Mapped[str] = mapped_column(String(24), default="active")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class RecipeDraft(Base):
    __tablename__ = "recipe_drafts"
    __table_args__ = (CheckConstraint("version >= 1", name="ck_draft_version"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    recipe_id: Mapped[str] = mapped_column(
        ForeignKey("recipes.id", ondelete="CASCADE"), index=True
    )
    document: Mapped[dict[str, Any]] = mapped_column(JSON_DOCUMENT)
    content_sha256: Mapped[str] = mapped_column(String(64))
    version: Mapped[int] = mapped_column(Integer, default=1)
    state: Mapped[str] = mapped_column(String(24), default="private")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class RecipeRevision(Base):
    __tablename__ = "recipe_revisions"
    __table_args__ = (
        UniqueConstraint("recipe_id", "revision_number"),
        UniqueConstraint("recipe_id", "content_sha256"),
        CheckConstraint("revision_number >= 1", name="ck_revision_number"),
        CheckConstraint("schema_version >= 1", name="ck_revision_schema"),
        Index("ix_recipe_revisions_published", "published_at", "id"),
        Index("ix_recipe_revisions_content_hash", "content_sha256"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    recipe_id: Mapped[str] = mapped_column(
        ForeignKey("recipes.id", ondelete="RESTRICT"), index=True
    )
    revision_number: Mapped[int] = mapped_column(Integer)
    content_sha256: Mapped[str] = mapped_column(String(64))
    schema_version: Mapped[int] = mapped_column(Integer)
    document: Mapped[dict[str, Any]] = mapped_column(JSON_DOCUMENT)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


@event.listens_for(RecipeRevision, "before_update")
@event.listens_for(RecipeRevision, "before_delete")
def _keep_revision_immutable(*_: object) -> None:
    raise ValueError("published recipe revisions are immutable")


class ValidationResult(Base):
    __tablename__ = "validation_results"
    __table_args__ = (
        UniqueConstraint("draft_id", "draft_version", "content_sha256"),
        CheckConstraint("draft_version >= 1", name="ck_validation_draft_version"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    draft_id: Mapped[str] = mapped_column(
        ForeignKey("recipe_drafts.id", ondelete="CASCADE"), index=True
    )
    draft_version: Mapped[int] = mapped_column(Integer)
    content_sha256: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(24))
    checks: Mapped[list[dict[str, Any]]] = mapped_column(JSON_DOCUMENT)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )


class TestReport(Base):
    __tablename__ = "test_reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    draft_id: Mapped[str] = mapped_column(
        ForeignKey("recipe_drafts.id", ondelete="CASCADE"), index=True
    )
    recipe_sha256: Mapped[str] = mapped_column(String(64), index=True)
    report: Mapped[dict[str, Any]] = mapped_column(JSON_DOCUMENT)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )


class RecipeFork(Base):
    __tablename__ = "recipe_forks"
    __table_args__ = (UniqueConstraint("recipe_id", "source_revision_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    recipe_id: Mapped[str] = mapped_column(
        ForeignKey("recipes.id", ondelete="CASCADE"), index=True
    )
    source_revision_id: Mapped[str] = mapped_column(
        ForeignKey("recipe_revisions.id", ondelete="RESTRICT"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )


class ModerationEvent(Base):
    __tablename__ = "moderation_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    revision_id: Mapped[str] = mapped_column(
        ForeignKey("recipe_revisions.id", ondelete="RESTRICT"), index=True
    )
    actor_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    action: Mapped[str] = mapped_column(String(32))
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )


class CatalogJob(Base):
    __tablename__ = "catalog_jobs"
    __table_args__ = (
        CheckConstraint("attempt >= 0", name="ck_catalog_job_attempt"),
        Index("ix_catalog_jobs_claim", "state", "lease_until", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    kind: Mapped[str] = mapped_column(String(48))
    state: Mapped[str] = mapped_column(String(24), default="pending")
    payload: Mapped[dict[str, Any]] = mapped_column(JSON_DOCUMENT)
    idempotency_key: Mapped[str] = mapped_column(String(128), unique=True)
    lease_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), index=True
    )
    attempt: Mapped[int] = mapped_column(Integer, default=0)
    problem_code: Mapped[str | None] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
