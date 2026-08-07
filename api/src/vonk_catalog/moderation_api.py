from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from .auth import (
    AuthServices,
    optional_session,
    request_client,
    require_csrf,
    require_session,
)
from .moderation import ModerationService
from .problems import Problem


class ReportInput(BaseModel):
    revision_id: str = Field(min_length=32, max_length=36)
    category: Literal["malware", "security", "copyright", "misleading", "other"]
    detail: str = Field(min_length=10, max_length=4000)


class RevisionActionInput(BaseModel):
    action: Literal[
        "hide", "unhide", "compromise_warning", "warning_clear", "appeal_note"
    ]
    reason: str = Field(min_length=3, max_length=4000)


class PublisherActionInput(BaseModel):
    action: Literal["suspend", "reinstate"]
    reason: str = Field(min_length=3, max_length=4000)


def _step_up(request: Request, created_at: datetime) -> bool:
    value = (
        created_at if created_at.tzinfo is not None else created_at.replace(tzinfo=UTC)
    )
    return request.headers.get(
        "X-Vonk-Step-Up"
    ) == "confirmed" and value >= datetime.now(UTC) - timedelta(minutes=10)


def build_moderation_router(services: AuthServices, source_secret: bytes) -> APIRouter:
    router = APIRouter(prefix="/v1")

    @router.post("/reports", status_code=202)
    def report(body: ReportInput, request: Request) -> dict[str, str]:
        authenticated = optional_session(request, services)
        if authenticated is not None:
            require_csrf(request, services)
        client_ip, _ = request_client(request)
        with services.database_sessions.begin() as database:
            created = ModerationService(database, source_secret=source_secret).report(
                body.revision_id,
                None if authenticated is None else authenticated.user.id,
                client_ip,
                body.category,
                body.detail,
            )
            return {"report_id": created.id, "state": "received"}

    @router.post("/moderation/revisions/{revision_id}", status_code=201)
    def revision_action(
        revision_id: str, body: RevisionActionInput, request: Request
    ) -> dict[str, object]:
        authenticated = require_session(request, services)
        require_csrf(request, services)
        with services.database_sessions.begin() as database:
            event = ModerationService(database).revision_action(
                authenticated.user.id,
                revision_id,
                body.action,
                body.reason,
                step_up_confirmed=_step_up(request, authenticated.created_at),
            )
            return {"event_id": event.id, "sequence": event.sequence}

    @router.post("/moderation/publishers/{publisher_id}", status_code=201)
    def publisher_action(
        publisher_id: str, body: PublisherActionInput, request: Request
    ) -> dict[str, object]:
        authenticated = require_session(request, services)
        require_csrf(request, services)
        confirmed = _step_up(request, authenticated.created_at)
        with services.database_sessions.begin() as database:
            moderation = ModerationService(database)
            if body.action == "suspend":
                event = moderation.suspend_publisher(
                    authenticated.user.id,
                    publisher_id,
                    body.reason,
                    step_up_confirmed=confirmed,
                )
            elif body.action == "reinstate":
                event = moderation.reinstate_publisher(
                    authenticated.user.id,
                    publisher_id,
                    body.reason,
                    step_up_confirmed=confirmed,
                )
            else:
                raise Problem(
                    422,
                    "moderation.action_invalid",
                    "Moderation action is invalid",
                    "Choose suspend or reinstate.",
                )
            return {"event_id": event.id, "sequence": event.sequence}

    return router
