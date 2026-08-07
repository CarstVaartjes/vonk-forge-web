from __future__ import annotations

from fastapi import APIRouter, Header, Request
from pydantic import BaseModel, Field

from .auth import AuthServices, require_csrf, require_session
from .problems import Problem
from .publication import PublicationService


class ForkInput(BaseModel):
    source_revision_id: str = Field(min_length=32, max_length=36)
    slug: str = Field(min_length=2, max_length=63)


def _key(value: str | None) -> str:
    if value is None:
        raise Problem(
            428,
            "publication.idempotency_key_required",
            "Publication identifier required",
            "Send a stable Idempotency-Key header.",
        )
    return value


def build_publication_router(services: AuthServices) -> APIRouter:
    router = APIRouter(prefix="/v1")

    @router.post("/publishers/{publisher}/drafts/{draft_id}/validate", status_code=202)
    def validate(publisher: str, draft_id: str, request: Request) -> dict[str, object]:
        authenticated = require_session(request, services)
        require_csrf(request, services)
        with services.database_sessions.begin() as database:
            job = PublicationService(database).request_validation(
                authenticated.user.id, publisher, draft_id
            )
            return {"job_id": job.id, "state": job.state}

    @router.post("/publishers/{publisher}/drafts/{draft_id}/publish", status_code=201)
    def publish(
        publisher: str,
        draft_id: str,
        request: Request,
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ) -> dict[str, object]:
        authenticated = require_session(request, services)
        require_csrf(request, services)
        with services.database_sessions.begin() as database:
            published = PublicationService(database).publish(
                authenticated.user.id,
                publisher,
                draft_id,
                idempotency_key=_key(idempotency_key),
            )
            revision = published.revision
            return {
                "revision_id": revision.id,
                "revision_number": revision.revision_number,
                "content_sha256": revision.content_sha256,
                "official": published.official,
                "published_at": revision.published_at.isoformat(),
            }

    @router.post("/publishers/{publisher}/forks", status_code=201)
    def fork(
        publisher: str,
        body: ForkInput,
        request: Request,
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ) -> dict[str, object]:
        authenticated = require_session(request, services)
        require_csrf(request, services)
        with services.database_sessions.begin() as database:
            draft = PublicationService(database).fork(
                authenticated.user.id,
                publisher,
                body.source_revision_id,
                new_slug=body.slug,
                idempotency_key=_key(idempotency_key),
            )
            return {
                "draft_id": draft.id,
                "version": draft.version,
                "content_sha256": draft.content_sha256,
            }

    return router
