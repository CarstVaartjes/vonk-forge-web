from __future__ import annotations

from collections.abc import Callable, Iterator

from fastapi import APIRouter, Depends, Header, Query, Response
from sqlalchemy.orm import Session

from .contracts import contract_path
from .moderation import ModerationService
from .problems import Problem
from .repositories import CatalogRepository, PublishedRecipe

SessionProvider = Callable[[], Session]


def build_public_router(session_provider: SessionProvider | None) -> APIRouter:
    router = APIRouter(prefix="/v1")

    def database_session() -> Iterator[Session]:
        if session_provider is None:
            raise Problem(
                503,
                "catalog.database_unavailable",
                "Catalog database unavailable",
                "The catalog database is not ready.",
            )
        with session_provider() as session:
            yield session

    @router.get("/recipes")
    def list_recipes(
        q: str | None = Query(default=None, min_length=1, max_length=120),
        publisher: str | None = Query(default=None, max_length=63),
        runtime: str | None = Query(default=None, max_length=64),
        workload_family: str | None = Query(default=None, max_length=64),
        topology: str | None = Query(default=None, pattern="^(single|gang)$"),
        min_nodes: int | None = Query(default=None, ge=1, le=16),
        max_nodes: int | None = Query(default=None, ge=1, le=16),
        max_memory_bytes: int | None = Query(default=None, ge=1),
        max_installed_bytes: int | None = Query(default=None, ge=1),
        limit: int = Query(default=20, ge=1, le=100),
        session: Session = Depends(database_session),
    ) -> dict[str, object]:
        items = CatalogRepository(session).list_latest(
            query=q,
            publisher=publisher,
            runtime=runtime,
            workload_family=workload_family,
            topology=topology,
            min_nodes=min_nodes,
            max_nodes=max_nodes,
            max_memory_bytes=max_memory_bytes,
            max_installed_bytes=max_installed_bytes,
            limit=limit,
        )
        visible = [item for item in items if _visible(session, item)]
        return {
            "items": [_summary(item, _warning(session, item)) for item in visible],
            "next_cursor": None,
        }

    @router.get("/recipes/{publisher}/{slug}")
    def recipe_detail(
        publisher: str,
        slug: str,
        session: Session = Depends(database_session),
    ) -> dict[str, object]:
        item = CatalogRepository(session).latest(publisher, slug)
        if item is None or not _visible(session, item):
            raise _not_found()
        return {
            **_summary(item, _warning(session, item)),
            "latest_revision": _revision(item),
        }

    @router.get(
        "/recipes/{publisher}/{slug}/revisions/{revision_number}",
        response_model=None,
    )
    def recipe_revision(
        publisher: str,
        slug: str,
        revision_number: int,
        response: Response,
        if_none_match: str | None = Header(default=None),
        session: Session = Depends(database_session),
    ) -> dict[str, object] | Response:
        item = CatalogRepository(session).revision(publisher, slug, revision_number)
        if item is None or not _visible(session, item):
            raise _not_found()
        etag = f'"sha256:{item.revision.content_sha256}"'
        headers = {
            "Cache-Control": "public, max-age=31536000, immutable",
            "ETag": etag,
        }
        if if_none_match == etag:
            return Response(status_code=304, headers=headers)
        response.headers.update(headers)
        return _revision(item)

    @router.get("/schemas/recipe/v1")
    def recipe_schema(response: Response) -> dict[str, object]:
        response.headers["Cache-Control"] = "public, max-age=3600"
        import json

        return json.loads(contract_path("recipe", "v1.schema.json").read_text())

    return router


def _not_found() -> Problem:
    return Problem(
        404,
        "catalog.not_found",
        "Recipe not found",
        "The requested published recipe does not exist.",
    )


def _summary(item: PublishedRecipe, warning: str | None = None) -> dict[str, object]:
    document = item.revision.document
    return {
        "publisher": item.publisher.slug,
        "slug": item.recipe.slug,
        "title": item.recipe.title,
        "official": item.publisher.system_role == "official",
        "revision_number": item.revision.revision_number,
        "content_sha256": item.revision.content_sha256,
        "published_at": item.revision.published_at.isoformat(),
        "runtime": document.get("runtime"),
        "workload": document.get("workload"),
        "resources": document.get("resources"),
        "topology": document.get("topology"),
        "moderation_warning": warning,
    }


def _visible(session: Session, item: PublishedRecipe) -> bool:
    moderation = ModerationService(session)
    return (
        not moderation.publisher_suspended(item.publisher.id)
        and not moderation.revision_state(item.revision.id).hidden
    )


def _warning(session: Session, item: PublishedRecipe) -> str | None:
    return ModerationService(session).revision_state(item.revision.id).warning


def _revision(item: PublishedRecipe) -> dict[str, object]:
    return {
        "publisher": item.publisher.slug,
        "slug": item.recipe.slug,
        "revision_number": item.revision.revision_number,
        "content_sha256": item.revision.content_sha256,
        "schema_version": item.revision.schema_version,
        "published_at": item.revision.published_at.isoformat(),
        "document": item.revision.document,
    }
