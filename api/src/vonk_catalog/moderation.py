from __future__ import annotations

import hashlib
import hmac
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import (
    ModerationEvent,
    ModerationReport,
    Publisher,
    PublisherModerationEvent,
    Recipe,
    RecipeRevision,
    User,
)
from .problems import Problem

Clock = Callable[[], datetime]
REVISION_ACTIONS = {
    "hide",
    "unhide",
    "compromise_warning",
    "warning_clear",
    "appeal_note",
}
REPORT_CATEGORIES = {"malware", "security", "copyright", "misleading", "other"}


def _now() -> datetime:
    return datetime.now(UTC)


@dataclass(frozen=True, slots=True)
class RevisionModerationState:
    hidden: bool
    warning: str | None


class ModerationService:
    def __init__(
        self,
        database: Session,
        *,
        clock: Clock = _now,
        report_limit: int = 5,
        source_secret: bytes = b"development-moderation-source-secret",
    ) -> None:
        self.database = database
        self.clock = clock
        self.report_limit = report_limit
        self.source_secret = source_secret

    def _source(self, ip_address: str) -> str:
        return hmac.new(
            self.source_secret,
            ip_address[:128].encode(),
            hashlib.sha256,
        ).hexdigest()

    def report(
        self,
        revision_id: str,
        reporter_user_id: str | None,
        ip_address: str,
        category: str,
        detail: str,
    ) -> ModerationReport:
        if self.database.get(RecipeRevision, revision_id) is None:
            raise Problem(
                404,
                "moderation.revision_not_found",
                "Revision not found",
                "Report an existing immutable revision.",
            )
        cleaned = detail.strip()
        if category not in REPORT_CATEGORIES or not 10 <= len(cleaned) <= 4000:
            raise Problem(
                422,
                "moderation.report_invalid",
                "Report is invalid",
                "Choose a valid category and provide 10-4000 characters of detail.",
            )
        source = self._source(ip_address)
        cutoff = self.clock() - timedelta(hours=1)
        count = int(
            self.database.scalar(
                select(func.count())
                .select_from(ModerationReport)
                .where(
                    ModerationReport.source_digest == source,
                    ModerationReport.created_at >= cutoff,
                )
            )
            or 0
        )
        if count >= self.report_limit:
            raise Problem(
                429,
                "moderation.report_rate_limited",
                "Report limit reached",
                "Wait before submitting another report.",
            )
        report = ModerationReport(
            revision_id=revision_id,
            reporter_user_id=reporter_user_id,
            source_digest=source,
            category=category,
            detail=cleaned,
            created_at=self.clock(),
        )
        self.database.add(report)
        self.database.flush()
        return report

    def _actor(self, user_id: str, *, admin: bool = False) -> User:
        actor = self.database.get(User, user_id)
        allowed = {"admin"} if admin else {"admin", "moderator"}
        if actor is None or actor.system_role not in allowed:
            code = (
                "moderation.admin_required"
                if admin
                else "moderation.moderator_required"
            )
            raise Problem(
                403,
                code,
                "Moderation role required",
                "This action requires a separate catalog administration role.",
            )
        return actor

    @staticmethod
    def _step_up(confirmed: bool) -> None:
        if not confirmed:
            raise Problem(
                403,
                "moderation.step_up_required",
                "Recent sign-in confirmation required",
                "Sign in again and explicitly confirm this high-impact action.",
            )

    def _revision_context(self, revision_id: str) -> tuple[RecipeRevision, Publisher]:
        row = self.database.execute(
            select(RecipeRevision, Publisher)
            .join(Recipe, Recipe.id == RecipeRevision.recipe_id)
            .join(Publisher, Publisher.id == Recipe.publisher_id)
            .where(RecipeRevision.id == revision_id)
        ).one_or_none()
        if row is None:
            raise Problem(
                404,
                "moderation.revision_not_found",
                "Revision not found",
                "Choose an existing immutable revision.",
            )
        return row

    def revision_action(
        self,
        actor_user_id: str,
        revision_id: str,
        action: str,
        reason: str,
        *,
        step_up_confirmed: bool = False,
    ) -> ModerationEvent:
        if action not in REVISION_ACTIONS:
            raise Problem(
                422,
                "moderation.action_invalid",
                "Moderation action is invalid",
                "Choose a supported reversible action.",
            )
        revision, publisher = self._revision_context(revision_id)
        high_impact = publisher.system_role == "official" and action != "appeal_note"
        self._actor(actor_user_id, admin=high_impact)
        if high_impact:
            self._step_up(step_up_confirmed)
        cleaned = reason.strip()
        if not 3 <= len(cleaned) <= 4000:
            raise Problem(
                422,
                "moderation.reason_invalid",
                "Moderation reason is invalid",
                "Provide a 3-4000 character audit reason.",
            )
        event = ModerationEvent(
            revision_id=revision.id,
            actor_user_id=actor_user_id,
            action=action,
            sequence=int(
                self.database.scalar(
                    select(func.max(ModerationEvent.sequence)).where(
                        ModerationEvent.revision_id == revision.id
                    )
                )
                or 0
            )
            + 1,
            reason=cleaned,
            details={"official": publisher.system_role == "official"},
            created_at=self.clock(),
        )
        self.database.add(event)
        self.database.flush()
        return event

    def revision_state(self, revision_id: str) -> RevisionModerationState:
        hidden = False
        warning: str | None = None
        events = self.database.scalars(
            select(ModerationEvent)
            .where(ModerationEvent.revision_id == revision_id)
            .order_by(ModerationEvent.sequence)
        )
        for event in events:
            if event.action == "hide":
                hidden = True
            elif event.action == "unhide":
                hidden = False
            elif event.action == "compromise_warning":
                warning = event.reason
            elif event.action == "warning_clear":
                warning = None
        return RevisionModerationState(hidden, warning)

    def revision_visible(self, revision_id: str, publisher_id: str) -> bool:
        return (
            not self.publisher_suspended(publisher_id)
            and not self.revision_state(revision_id).hidden
        )

    def _publisher_action(
        self,
        actor_user_id: str,
        publisher_id: str,
        action: str,
        reason: str,
        *,
        step_up_confirmed: bool,
    ) -> PublisherModerationEvent:
        self._actor(actor_user_id, admin=True)
        self._step_up(step_up_confirmed)
        if self.database.get(Publisher, publisher_id) is None:
            raise Problem(
                404,
                "moderation.publisher_not_found",
                "Publisher not found",
                "Choose an existing publisher.",
            )
        cleaned = reason.strip()
        if not 3 <= len(cleaned) <= 4000:
            raise Problem(
                422,
                "moderation.reason_invalid",
                "Moderation reason is invalid",
                "Provide a 3-4000 character audit reason.",
            )
        event = PublisherModerationEvent(
            publisher_id=publisher_id,
            actor_user_id=actor_user_id,
            action=action,
            sequence=int(
                self.database.scalar(
                    select(func.max(PublisherModerationEvent.sequence)).where(
                        PublisherModerationEvent.publisher_id == publisher_id
                    )
                )
                or 0
            )
            + 1,
            reason=cleaned,
            details={"step_up_confirmed": True},
            created_at=self.clock(),
        )
        self.database.add(event)
        self.database.flush()
        return event

    def suspend_publisher(
        self,
        actor_user_id: str,
        publisher_id: str,
        reason: str,
        *,
        step_up_confirmed: bool,
    ) -> PublisherModerationEvent:
        return self._publisher_action(
            actor_user_id,
            publisher_id,
            "suspend",
            reason,
            step_up_confirmed=step_up_confirmed,
        )

    def reinstate_publisher(
        self,
        actor_user_id: str,
        publisher_id: str,
        reason: str,
        *,
        step_up_confirmed: bool,
    ) -> PublisherModerationEvent:
        return self._publisher_action(
            actor_user_id,
            publisher_id,
            "reinstate",
            reason,
            step_up_confirmed=step_up_confirmed,
        )

    def publisher_suspended(self, publisher_id: str) -> bool:
        suspended = False
        events = self.database.scalars(
            select(PublisherModerationEvent)
            .where(PublisherModerationEvent.publisher_id == publisher_id)
            .order_by(PublisherModerationEvent.sequence)
        )
        for event in events:
            if event.action == "suspend":
                suspended = True
            elif event.action == "reinstate":
                suspended = False
        return suspended
