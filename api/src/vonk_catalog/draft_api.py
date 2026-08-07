from __future__ import annotations

from fastapi import APIRouter, Header, Request, Response
from sqlalchemy import select

from .auth import AuthServices, require_csrf, require_session
from .drafts import MAX_BODY_BYTES, DraftService, decode_upload
from .models import Recipe, RecipeDraft
from .problems import Problem
from .publishers import PublisherService


def _etag(version: int) -> str:
    return f'"draft-version-{version}"'


def _expected_version(if_match: str | None) -> int:
    if (
        if_match is None
        or not if_match.startswith('"draft-version-')
        or not if_match.endswith('"')
    ):
        raise Problem(
            428,
            "draft.if_match_required",
            "Draft version required",
            "Send the draft ETag in If-Match.",
        )
    try:
        value = int(if_match[15:-1])
    except ValueError as error:
        raise Problem(
            400,
            "draft.if_match_invalid",
            "Draft version is invalid",
            "Reload the draft and use its ETag.",
        ) from error
    if value < 1:
        raise Problem(
            400,
            "draft.if_match_invalid",
            "Draft version is invalid",
            "Reload the draft and use its ETag.",
        )
    return value


async def _bounded_body(request: Request) -> bytes:
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            if int(content_length) > MAX_BODY_BYTES:
                raise Problem(
                    413,
                    "draft.body_too_large",
                    "Upload is too large",
                    "The maximum upload size is 1 MiB.",
                )
        except ValueError as error:
            raise Problem(
                400,
                "draft.content_length_invalid",
                "Content length is invalid",
                "Send a valid Content-Length header.",
            ) from error
    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > MAX_BODY_BYTES:
            raise Problem(
                413,
                "draft.body_too_large",
                "Upload is too large",
                "The maximum upload size is 1 MiB.",
            )
        chunks.append(chunk)
    return b"".join(chunks)


def _serialize(draft: RecipeDraft, publisher: str) -> dict[str, object]:
    return {
        "id": draft.id,
        "publisher": publisher,
        "recipe_id": draft.recipe_id,
        "version": draft.version,
        "state": draft.state,
        "content_sha256": draft.content_sha256,
        "recipe": draft.document,
        "validation_problems": draft.validation_problems,
    }


def build_draft_router(services: AuthServices) -> APIRouter:
    router = APIRouter(prefix="/v1")

    @router.get("/publishers/{publisher}/drafts")
    def list_drafts(publisher: str, request: Request) -> dict[str, object]:
        authenticated = require_session(request, services)
        with services.database_sessions() as database:
            namespace = PublisherService(database).require_role(
                authenticated.user.id, publisher, "viewer"
            )
            rows = list(
                database.scalars(
                    select(RecipeDraft)
                    .join(Recipe)
                    .where(Recipe.publisher_id == namespace.id)
                    .order_by(RecipeDraft.updated_at.desc(), RecipeDraft.id)
                )
            )
            return {"items": [_serialize(row, namespace.slug) for row in rows]}

    @router.post("/publishers/{publisher}/drafts", status_code=201)
    async def create_draft(
        publisher: str,
        request: Request,
        response: Response,
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ) -> dict[str, object]:
        authenticated = require_session(request, services)
        require_csrf(request, services)
        if idempotency_key is None:
            raise Problem(
                428,
                "draft.idempotency_key_required",
                "Upload identifier required",
                "Send a stable Idempotency-Key header.",
            )
        upload = decode_upload(
            await _bounded_body(request), request.headers.get("content-type")
        )
        with services.database_sessions.begin() as database:
            draft = DraftService(database).create(
                authenticated.user.id,
                publisher,
                upload["recipe"],
                idempotency_key=idempotency_key,
                test_report=upload.get("test_report"),
            )
            result = _serialize(draft, publisher)
        response.headers["ETag"] = _etag(draft.version)
        response.headers["Location"] = f"/v1/publishers/{publisher}/drafts/{draft.id}"
        return result

    @router.get("/publishers/{publisher}/drafts/{draft_id}")
    def get_draft(
        publisher: str, draft_id: str, request: Request, response: Response
    ) -> dict[str, object]:
        authenticated = require_session(request, services)
        with services.database_sessions() as database:
            draft = DraftService(database).get(
                authenticated.user.id, publisher, draft_id
            )
            result = _serialize(draft, publisher)
        response.headers["ETag"] = _etag(draft.version)
        return result

    @router.put("/publishers/{publisher}/drafts/{draft_id}")
    async def update_draft(
        publisher: str,
        draft_id: str,
        request: Request,
        response: Response,
        if_match: str | None = Header(default=None, alias="If-Match"),
    ) -> dict[str, object]:
        authenticated = require_session(request, services)
        require_csrf(request, services)
        upload = decode_upload(
            await _bounded_body(request), request.headers.get("content-type")
        )
        with services.database_sessions.begin() as database:
            service = DraftService(database)
            draft = service.update(
                authenticated.user.id,
                publisher,
                draft_id,
                upload["recipe"],
                expected_version=_expected_version(if_match),
            )
            if upload.get("test_report") is not None:
                service.add_test_report(
                    authenticated.user.id, publisher, draft.id, upload["test_report"]
                )
            result = _serialize(draft, publisher)
        response.headers["ETag"] = _etag(draft.version)
        return result

    @router.delete("/publishers/{publisher}/drafts/{draft_id}", status_code=204)
    def delete_draft(
        publisher: str,
        draft_id: str,
        request: Request,
        if_match: str | None = Header(default=None, alias="If-Match"),
    ) -> Response:
        authenticated = require_session(request, services)
        require_csrf(request, services)
        with services.database_sessions.begin() as database:
            DraftService(database).delete(
                authenticated.user.id,
                publisher,
                draft_id,
                expected_version=_expected_version(if_match),
            )
        return Response(status_code=204)

    return router
